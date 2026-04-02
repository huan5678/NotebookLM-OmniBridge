/**
 * Google OAuth Service
 * 一鍵登入，自動化權限處理
 */

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

const CLIENT_ID = 'YOUR_CLIENT_ID'; // TODO: 填入 Google Cloud OAuth Client ID
const REDIRECT_URI = chrome.identity.getRedirectURL();

export interface AuthState {
  isLoggedIn: boolean;
  email: string | null;
  accessToken: string | null;
}

/**
 * 發起 Google OAuth 登入
 */
export async function login(): Promise<AuthState> {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('prompt', 'consent');

  // Open OAuth page
  const result = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true
  });

  if (result) {
    // Extract token from redirect URL
    const url = new URL(result);
    const accessToken = url.hash.substring(1).split('&')
      .find(k => k.startsWith('access_token='))
      ?.split('=')[1];

    if (accessToken) {
      // Get user info
      const userInfo = await getUserInfo(accessToken);
      const state: AuthState = {
        isLoggedIn: true,
        email: userInfo.email,
        accessToken
      };
      
      // Save to storage
      await chrome.storage.local.set({ auth: state });
      return state;
    }
  }
  
  throw new Error('登入失敗');
}

/**
 * 取得用戶資訊
 */
async function getUserInfo(accessToken: string): Promise<{email: string}> {
  const response = await fetch(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return response.json();
}

/**
 * 檢查登入狀態
 */
export async function checkAuth(): Promise<AuthState> {
  const result = await chrome.storage.local.get('auth');
  if (result.auth?.isLoggedIn) {
    // Verify token still works
    try {
      await getUserInfo(result.auth.accessToken);
      return result.auth;
    } catch {
      // Token expired, clear auth
      await chrome.storage.local.remove('auth');
    }
  }
  return { isLoggedIn: false, email: null, accessToken: null };
}

/**
 * 登出
 */
export async function logout(): Promise<void> {
  await chrome.storage.local.remove('auth');
}
