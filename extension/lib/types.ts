export interface Notebook {
  id: string
  title: string
  is_owner: boolean
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
