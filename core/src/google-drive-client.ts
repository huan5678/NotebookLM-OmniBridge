import { google } from 'googleapis';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export interface DriveConfig {
  credentialsPath: string;
  tokenPath: string;
  folderId?: string; // Optional: pre-created folder ID
}

export class GoogleDriveClient {
  private auth: any;
  private drive: google.drive.Drive;
  private config: DriveConfig;

  constructor(config: DriveConfig) {
    this.config = config;
    const { OAuth2Client } = google.auth;
    this.auth = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
    );
    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  async authenticateWithToken(token: string): Promise<void> {
    this.auth.setCredentials({ access_token: token });
    // Verify connection
    await this.drive.files.list({ pageSize: 1 });
  }

  async authenticateWithRefreshToken(refreshToken: string): Promise<void> {
    this.auth.credentials = { refresh_token: refreshToken };
    // This will auto-refresh the access token
    const tokenResponse = await this.auth.getAccessToken();
    this.auth.setCredentials(tokenResponse.res.data);
  }

  async createFolder(name: string, parentId?: string): Promise<string> {
    const fileMetadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId && { parents: [parentId] })
    };

    const res = await this.drive.files.create({
      resource: fileMetadata,
      fields: 'id, name, mimeType'
    });

    return res.data.id!;
  }

  async findOrCreateFolder(path: string, rootId?: string): Promise<string> {
    // Traverse path like "NotebookLM/My Notebook/inputs"
    const parts = path.split('/').filter(Boolean);
    let currentParent = rootId;

    for (const part of parts) {
      const folderId = await this.findFolder(part, currentParent);
      if (folderId) {
        currentParent = folderId;
      } else {
        currentParent = await this.createFolder(part, currentParent);
      }
    }

    return currentParent!;
  }

  async findFolder(name: string, parentId?: string): Promise<string | null> {
    const queryParts = [
      `mimeType='application/vnd.google-apps.folder'`,
      `name='${name}'`,
      `trashed=false`,
      ...(parentId ? [`'${parentId}' in parents`] : [])
    ];

    const res = await this.drive.files.list({
      q: queryParts.join(' and '),
      fields: 'files(id, name)',
      pageSize: 1
    });

    const files = res.data.files;
    return files && files.length > 0 ? files[0].id! : null;
  }

  async uploadMarkdown(content: string, fileName: string, folderId: string): Promise<string> {
    const fileMetadata = {
      name: `${fileName}.md`,
      parents: [folderId],
      mimeType: 'text/markdown'
    };

    const media = {
      mimeType: 'text/markdown',
      body: Buffer.from(content, 'utf-8')
    };

    const res = await this.drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id, name, webViewLink'
    });

    return res.data.id!;
  }

  async getFileContent(fileId: string): Promise<string> {
    const res = await this.drive.files.get({
      fileId,
      alt: 'media'
    });

    return res.data as string;
  }

  async listFiles(folderId: string): Promise<Array<{ id: string; name: string }>> {
    const res = await this.drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name)'
    });

    return (res.data.files || []).map(f => ({ id: f.id!, name: f.name }));
  }

  async ensureNotebookFolder(notebookTitle: string): Promise<string> {
    // Base folder: NotebookLM
    const baseFolderId = await this.findOrCreateFolder('NotebookLM');
    
    // Notebook-specific folder
    const notebookFolderId = await this.findOrCreateFolder(notebookTitle, baseFolderId);
    
    // inputs subfolder for source files
    const inputsFolderId = await this.findOrCreateFolder('inputs', notebookFolderId);

    return inputsFolderId;
  }
}
