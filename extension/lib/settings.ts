const DEFAULTS = {} as const

export type Settings = typeof DEFAULTS

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(DEFAULTS)
  return result as Settings
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(settings)
}
