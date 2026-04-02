/**
 * Settings Storage Service
 */

export interface Settings {
  auth: {
    isLoggedIn: boolean;
    email: string | null;
  };
  folders: {
    [notebookName: string]: {
      driveFolderId: string;
      driveFolderName: string;
    }
  };
  defaultNotebook: string | null;
}

const DEFAULT_SETTINGS: Settings = {
  auth: { isLoggedIn: false, email: null },
  folders: {},
  defaultNotebook: null
};

/**
 * 取得設定
 */
export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...result };
}

/**
 * 儲存設定
 */
export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(settings);
}

/**
 * 建立資料夾對應
 */
export async function addFolderMapping(
  notebookName: string, 
  driveFolderId: string, 
  driveFolderName: string
): Promise<void> {
  const settings = await getSettings();
  settings.folders[notebookName] = { driveFolderId, driveFolderName };
  await saveSettings(settings);
}

/**
 * 取得預設 Notebook
 */
export async function getDefaultNotebook(): Promise<string | null> {
  const settings = await getSettings();
  return settings.defaultNotebook;
}

/**
 * 設定預設 Notebook
 */
export async function setDefaultNotebook(name: string): Promise<void> {
  await saveSettings({ defaultNotebook: name });
}
