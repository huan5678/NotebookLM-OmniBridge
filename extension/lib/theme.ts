export type ThemeMode = "light" | "dark" | "system"

const STORAGE_KEY = "theme"

function applyTheme(mode: ThemeMode) {
  const isDark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  document.documentElement.classList.toggle("dark", isDark)
}

export async function initTheme() {
  const result = await chrome.storage.local.get({ [STORAGE_KEY]: "system" })
  const mode = result[STORAGE_KEY] as ThemeMode
  applyTheme(mode)

  // Listen for system preference changes
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    chrome.storage.local.get({ [STORAGE_KEY]: "system" }).then((r) => {
      if ((r[STORAGE_KEY] as ThemeMode) === "system") {
        applyTheme("system")
      }
    })
  })

  // Listen for storage changes (e.g. options page changes theme)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[STORAGE_KEY]) {
      applyTheme(changes[STORAGE_KEY].newValue as ThemeMode)
    }
  })
}

export async function setTheme(mode: ThemeMode) {
  await chrome.storage.local.set({ [STORAGE_KEY]: mode })
  applyTheme(mode)
}

export async function getTheme(): Promise<ThemeMode> {
  const result = await chrome.storage.local.get({ [STORAGE_KEY]: "system" })
  return result[STORAGE_KEY] as ThemeMode
}
