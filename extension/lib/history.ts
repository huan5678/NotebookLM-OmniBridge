export interface IngestRecord {
  id: string
  title: string
  url?: string
  notebookId: string
  timestamp: string
}

const STORAGE_KEY = "ingestHistory"
const MAX_RECORDS = 50

export async function getHistory(): Promise<IngestRecord[]> {
  const result = await chrome.storage.local.get({ [STORAGE_KEY]: [] })
  return result[STORAGE_KEY] as IngestRecord[]
}

export async function addToHistory(record: Omit<IngestRecord, "id" | "timestamp">): Promise<void> {
  const history = await getHistory()
  history.unshift({
    ...record,
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
  })
  await chrome.storage.local.set({
    [STORAGE_KEY]: history.slice(0, MAX_RECORDS),
  })
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] })
}

export async function removeFromHistory(id: string): Promise<void> {
  const history = await getHistory()
  await chrome.storage.local.set({
    [STORAGE_KEY]: history.filter((r) => r.id !== id),
  })
}
