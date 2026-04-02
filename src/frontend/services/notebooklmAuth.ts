/**
 * 利用 notebooklm 的已登入會話
 * 不需要額外 OAuth 設定
 */

export interface NotebookLMCookies {
  cookies: string;
  origins: string;
}

/**
 * 取得 notebooklm 的 cookies
 * 讓 Extension 可以直接使用 notebooklm API
 */
export async function getNotebookLMCookies(): Promise<NotebookLMCookies | null> {
  try {
    const response = await fetch('file:///Users/huan_mini/.notebooklm/storage_state.json');
    const data = await response.json();
    return {
      cookies: JSON.stringify(data.cookies),
      origins: JSON.stringify(data.origins)
    };
  } catch {
    return null;
  }
}

/**
 * 檢查是否已登入 notebooklm
 */
export async function isNotebookLMLoggedIn(): Promise<boolean> {
  const result = await getNotebookLMCookies();
  return result !== null;
}
