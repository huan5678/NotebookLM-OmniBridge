const DEFAULTS = {
  apiUrl: "http://localhost:8000",
}

export type Settings = typeof DEFAULTS

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(DEFAULTS)
  return result as Settings
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(settings)
}

export async function getApiUrl(): Promise<string> {
  const { apiUrl } = await getSettings()
  return apiUrl
}
