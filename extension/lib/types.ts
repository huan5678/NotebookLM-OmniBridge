export interface Notebook {
  id: string
  title: string
  is_owner: boolean
  created_at: string
}

export interface Source {
  id: string
  title: string
  type: string
  url?: string
  status: string
  created_at: string
}

export interface PageContent {
  title: string
  url: string
  selectedText: string
  fullText: string
  timestamp: string
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

export interface IngestProgressMessage {
  type: "NOTEBOOKLM_INGEST_PROGRESS"
  step: number
  label: string
  done: boolean
  error?: string
}
