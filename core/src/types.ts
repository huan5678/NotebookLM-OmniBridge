export interface Notebook {
  id: string;
  title: string;
  isOwner: boolean;
  createdAt: string;
}

export interface Source {
  id: string;
  url?: string;
  text?: string;
  fileName: string;
  notebookId: string;
  createdAt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface NotebookLMConfig {
  storagePath: string;
  usePythonCLI: boolean;
  pythonPath: string;
}

export interface IngestOptions {
  notebookId?: string;
  folderPath?: string;
}

export interface ChatOptions {
  notebookId?: string;
  stream?: boolean;
}

export interface NACStatus {
  connected: boolean;
  currentNotebook?: Notebook;
  notebooks: Notebook[];
}
