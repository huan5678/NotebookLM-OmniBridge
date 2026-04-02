/**
 * Settings Panel
 * 一鍵設定頁面
 */

import React, { useState, useEffect } from 'react';
import { login, logout, checkAuth, AuthState } from '../services/googleAuth';
import { getSettings, addFolderMapping } from '../services/settings';

interface Props {
  onClose?: () => void;
}

export function SettingsPanel({ onClose }: Props) {
  const [auth, setAuth] = useState<AuthState>({ isLoggedIn: false, email: null, accessToken: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkAuth().then(setAuth);
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const state = await login();
      setAuth(state);
    } catch (e) {
      console.error('Login failed:', e);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    setAuth({ isLoggedIn: false, email: null, accessToken: null });
  };

  return (
    <div className="settings-panel">
      <header className="panel-header">
        <h2>⚙️ 設定</h2>
        {onClose && <button onClick={onClose}>✕</button>}
      </header>

      <section className="auth-section">
        <h3>Google 帳戶</h3>
        {auth.isLoggedIn ? (
          <div className="logged-in">
            <p>✅ 已登入：{auth.email}</p>
            <button onClick={handleLogout} className="logout-btn">
              登出
            </button>
          </div>
        ) : (
          <div className="logged-out">
            <p>點擊下方按鈕登入 Google</p>
            <button 
              onClick={handleLogin} 
              disabled={loading}
              className="login-btn"
            >
              {loading ? '登入中...' : '🔐 登入 Google'}
            </button>
          </div>
        )}
      </section>

      <section className="help-section">
        <h3>幫助</h3>
        <details>
          <summary>為什麼需要權限？</summary>
          <p>這個工具需要存取 Google 雲端硬碟來儲存您擷取的網頁內容，自動同步到 NotebookLM。</p>
        </details>
      </section>
    </div>
  );
}
