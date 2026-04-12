import { spawn } from 'child_process';
import { Notebook, ChatMessage, NotebookLMConfig } from './types.js';

const DEFAULT_CONFIG: NotebookLMConfig = {
  storagePath: `${process.env.HOME}/.notebooklm/storage_state.json`,
  usePythonCLI: true,
  pythonPath: 'python3.11'
};

export class NotebookLMClient {
  private config: NotebookLMConfig;
  private currentNotebook?: string;

  constructor(config: Partial<NotebookLMConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async listNotebooks(): Promise<Notebook[]> {
    if (this.config.usePythonCLI) {
      return this.listNotebooksCLI();
    }
    throw new Error('Direct API mode not implemented yet');
  }

  async getNotebook(notebookId: string): Promise<Notebook | null> {
    const notebooks = await this.listNotebooks();
    return notebooks.find(nb => nb.id === notebookId || nb.id.startsWith(notebookId)) || null;
  }

  async getOrCreateNotebook(name: string): Promise<Notebook> {
    const notebooks = await this.listNotebooks();
    
    // Try to find by partial match
    const existing = notebooks.find(nb => name.toLowerCase() === nb.title.toLowerCase());
    if (existing) {
      this.currentNotebook = existing.id;
      return existing;
    }

    // Create new notebook
    await this.createNotebook(name);
    const updated = await this.listNotebooks();
    const created = updated.find(nb => nb.title === name);
    if (!created) {
      throw new Error(`Failed to create notebook: ${name}`);
    }
    this.currentNotebook = created.id;
    return created;
  }

  async useNotebook(notebookId: string): Promise<boolean> {
    if (this.config.usePythonCLI) {
      const result = await this.runCLI(['use', notebookId]);
      if (result.success) {
        this.currentNotebook = notebookId;
        return true;
      }
      return false;
    }
    this.currentNotebook = notebookId;
    return true;
  }

  async addSource(url: string): Promise<boolean> {
    if (!this.currentNotebook) {
      throw new Error('No notebook selected. Call useNotebook() first.');
    }
    if (this.config.usePythonCLI) {
      const result = await this.runCLI(['source', 'add', url]);
      return result.success;
    }
    throw new Error('Not implemented');
  }

  async chat(message: string): Promise<string> {
    if (!this.currentNotebook) {
      throw new Error('No notebook selected. Call useNotebook() first.');
    }
    if (this.config.usePythonCLI) {
      const result = await this.runCLI(['ask', message]);
      if (!result.success) {
        throw new Error(`Chat failed: ${result.stderr}`);
      }
      return result.stdout;
    }
    throw new Error('Not implemented');
  }

  getCurrentNotebook(): string | undefined {
    return this.currentNotebook;
  }

  // Private methods
  private async listNotebooksCLI(): Promise<Notebook[]> {
    const result = await this.runCLI(['list', '--json']);
    if (!result.success) {
      return [];
    }

    try {
      const data = JSON.parse(result.stdout);
      return (data.notebooks || []).map((nb: any): Notebook => ({
        id: nb.id,
        title: nb.title,
        isOwner: nb.is_owner,
        createdAt: nb.created_at
      }));
    } catch (e) {
      console.error('Failed to parse notebooks JSON:', e);
      return [];
    }
  }

  private async createNotebook(name: string): Promise<void> {
    await this.runCLI(['create', name]);
  }

  private async runCLI(args: string[]): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const cmd = this.config.usePythonCLI ? this.config.pythonPath : 'node';
      const module = this.config.usePythonCLI ? '-m' : undefined;
      const script = this.config.usePythonCLI ? 'notebooklm' : undefined;
      
      const proc = spawn(cmd, [
        ...(module ? [module] : []),
        ...(script ? [script] : []),
        ...args
      ]);

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout,
          stderr
        });
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          stdout: '',
          stderr: err.message
        });
      });
    });
  }
}
