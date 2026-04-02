/**
 * Google Auth - 使用 Chrome Identity API
 * 不需要 OAuth Client ID!
 */

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

/**
 * 使用 Chrome Identity API 登入
 * Chrome 會自動處理 OAuth
 */
export async function loginSimple(): Promise<{token: string, email: string}> {
  try {
    // 使用 Chrome 內建的 identity API
    const response = await chrome.identity.getAuthToken({
      interactive: true,
      scopes: SCOPES
    });
    
    if (response && typeof response === 'string') {
      // Get user email
      const email = await getUserEmail(response);
      return { token: response, email };
    }
    
    throw new Error('No token received');
  } catch (e) {
    // 如果失敗，嘗試使用 launchWebAuthFlow
    return loginWithWebAuth();
  }
}

async function getUserEmail(token: string): Promise<string> {
  const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await resp.json();
  return data.email || 'unknown';
}

/**
 * Fallback: 使用 Web Auth Flow
 */
async function loginWithWebAuth(): Promise<{token: string, email: string}> {
  // 使用預設的 client_id (Extension 會自動處理)
  // 需要在 manifest.json 設定 oauth2
  throw new Error('請在 Extension 管理頁面允許權限');
}

/**
 * 檢查是否有有效 token
 */
export async function checkToken(): Promise<{token: string, email: string} | null> {
  try {
    const result = await chrome.identity.getAuthToken({ interactive: false });
    if (result && typeof result === 'string') {
      const email = await getUserEmail(result);
      return { token: result, email };
    }
  } catch {
    // No token
  }
  return null;
}

/**
 * 移除 token
 */
export async function logoutSimple(): Promise<void> {
  // 清除 token
  const result = await chrome.identity.getAuthToken({ interactive: false });
  if (result && typeof result === 'string') {
    await chrome.identity.removeCachedAuthToken({ token: result });
  }
}
