# NotebookLM Omni-Bridge - 最終架構

## 方案選擇：Google Drive 橋樑 (方案 B)

**原因**：避免 ToS 風險，使用官方支援的 Google Drive API

---

## 完整流程

```
1. 設定階段
   ┌─────────────────────────────────────┐
   │  Extension 安裝                     │
   │      ↓                               │
   │  Google OAuth (Drive 權限)           │
   │      ↓                               │
   │  建立/選擇 Drive 資料夾對應表        │
   │      ↓                               │
   │  NotebookLM 綁定相同資料夾           │
   └─────────────────────────────────────┘

2. 使用階段
   ┌─────────────────────────────────────┐
   │  瀏覽網頁 → 選取文字/右鍵             │
   │      ↓                               │
   │  選擇目標 Notebook (資料夾)           │
   │      ↓                               │
   │  存儲 Markdown 到 Drive            │
   │      ↓                               │
   │  [通知] "已存儲，等待同步..."       │
   │      ↓                               │
   │  NotebookLM 自動同步 (3-5分鐘)      │
   │      ↓                               │
   │  [通知] "同步完成，可對話"           │
   │      ↓                               │
   │  使用者開啟對話                     │
   └─────────────────────────────────────┘
```

---

## 需要開發的功能

### 1. 設定模組 (Settings)

| 功能 | 說明 |
|------|------|
| Google OAuth 登入 | 取得 Drive API 權限 |
| 資料夾管理 | 建立/選擇/刪除資料夾對應 |
| Notebook 對應表 | 資料夾 ↔ NotebookLM notebook 映射 |
| 設定存儲 | chrome.storage.local |

### 2. 存儲模組 (Ingest)

| 功能 | 說明 |
|------|------|
| 網頁內容抓取 | 轉 Markdown |
| Drive API 上傳 | 寫入指定資料夾 |
| 進度回饋 | toast/notification |
| 延遲提示 | "等待同步中..." |

### 3. 通知模組 (Notification)

| 功能 | 說明 |
|------|------|
| 存儲完成 | 已存儲到 Drive |
| 同步完成 | 可開始對話 |
| 錯誤處理 | 失敗通知 |

### 4. 對話模組 (Chat)

| 功能 | 說明 |
|------|------|
| Notebook 選擇 | 切換要對話的來源 |
| 開啟 NotebookLM | 開啟新分頁 |
| 顯示狀態 | 同步進度 |

---

## UI 設計

### 設定頁面
```
┌─────────────────────────────┐
│  ⚙️ NotebookLM Omni-Bridge  │
├─────────────────────────────┤
│  狀態: ● 已連接             │
│                             │
│  📁 資料夾對應表             │
│  ┌─────────────────────────┐│
│  │ AI Notes      → Notion  ││
│  │ Daily-Papers → Papers  ││
│  │ Research    → Research ││
│  └─────────────────────────┘│
│                             │
│  [+ 新增對應] [設定]        │
└─────────────────────────────┘
```

### Side Panel (主要UI)
```
┌──────────────���──────────────┐
│  🤖 NotebookLM Omni-Bridge  │
├─────────────────────────────┤
│  📁 選擇 Notebook:        │
│  [ ▼ 選擇...]             │
├─────────────────────────────┤
│  [吸取當前頁面]            │
│  [右鍵選單: 傳送]          │
├─────────────────────────────┤
│  狀態:                     │
│  • 同步狀態                │
│  • 上次同步時間             │
├─────────────────────────────┤
│  [開啟 NotebookLM]          │
│  [設定]                    │
└─────────────────────────────┘
```

---

## API 設計

| Method | Endpoint | 說明 |
|--------|----------|------|
| POST | `/auth/google` | OAuth 登入 |
| GET | `/drive/list` | 列出資料夾 |
| POST | `/drive/ingest` | 存儲到 Drive |
| GET | `/status` | 同步狀態 |

---

## 技術堆疊

| 組件 | 技術 |
|------|------|
| Extension | Plasmo + React + TypeScript |
| OAuth | Google Identity Services |
| Drive | Google Drive API v3 |
| 存儲 | chrome.storage.local |
| 通知 | chrome.notifications |

---

## 開發順序

1. **OAuth + 基本設定**
2. **Drive API 整合**
3. **存儲流程**
4. **通知系統**
5. **UI 優化**

---

## 風險與緩解

| 風險 | 緩解 |
|------|------|
| 同步延遲 | 明確提示使用者 |
| OAuth 失效 | 自動引導重新登入 |
| 資料夾權限 | 權限檢查 |

---

## 參考資源

- Google Drive API: https://developers.google.com/drive/api
- Google OAuth: https://developers.google.com/identity/oauth2/web/overview
- Plasmo: https://docs.plasmo.com/
