# NotebookLM Omni-Bridge

把整個網路，接進你的第二大腦。

一個 Chrome 擴充套件，讓你在任何網頁上按一下，就能把內容送進 Google NotebookLM 並直接對話。

- 🌐 Landing Page：<https://huan5678.github.io/NotebookLM-OmniBridge/>
- 💬 預設語系：繁體中文（另支援英文）
- 🧩 Chrome Extension Manifest V3 / Plasmo + React

---

## 功能

- **一鍵吸取**：在任何網頁點擊按鈕（或右鍵選單），將頁面內容 / 選取文字送進指定 Notebook
- **多視窗對話**：獨立 Popup 對話視窗，可同時開多個並分別對應不同的 Notebook
- **語音輸入**：對話輸入框整合 Web Speech API，支援語音轉文字
- **Markdown 渲染**：AI 回覆自動渲染 Markdown，可將回覆加入 Source
- **檔案上傳**：支援 `.txt / .md / .csv / .json / .html` 等格式直接匯入
- **Cookie 驗證**：直接使用瀏覽器既有的 Google 登入狀態，不需額外 OAuth 設定
- **可選後端**：另附 Python FastAPI + MCP Server，供外部 AI Agent（如 Claude）存取

## 架構

```
Chrome Extension (Plasmo + React, MV3)
  ↕ fetch() with credentials:"include"（使用瀏覽器 cookie）
Google NotebookLM 內部 RPC (notebooklm.google.com)
```

預設不需要任何後端 — 擴充功能直接呼叫 Google 的 batchexecute RPC。

**可選後端**（只有使用 MCP Server 時才需要）：

```
MCP Server (stdio)
  ↕ HTTP
Python FastAPI Backend (backend/)
  ↕ subprocess
notebooklm-py CLI
```

## 安裝（開發用）

```bash
# 安裝相依
npm install

# 開發模式（熱更新）
npm run dev

# 產出正式版
npm run build

# 型別檢查
npm run typecheck
```

在 Chrome 載入擴充功能：
`chrome://extensions` → 開啟「開發人員模式」→ 載入未封裝項目 → 選 `extension/build/chrome-mv3-dev/`（開發）或 `extension/build/chrome-mv3-prod/`（正式）。

## Monorepo 結構

npm workspaces：

| 目錄 | 說明 |
| --- | --- |
| `extension/` | Chrome Extension（Plasmo + React） |
| `core/` | TypeScript 核心函式庫 `@nac/core`（NotebookLMClient、MarkdownConverter） |
| `mcp-server/` | MCP Server `@nac/mcp-server`，提供 `notebooklm_list`、`notebooklm_ingest`、`notebooklm_chat` 等工具 |
| `backend/` | Python FastAPI Server（可選），包裝 `notebooklm-py` CLI |
| `docs/landing/` | GitHub Pages Landing 頁面原始碼 |

## 後端（可選）

僅當你要透過 MCP Server 讓外部 Agent 操作 NotebookLM 時才需要：

```bash
cd backend
pip install -r requirements.txt
uvicorn server.main:app --port 8000

# 啟動 MCP Server
npm run mcp
```

## 測試

```bash
# 前端（Vitest）
npx vitest run

# 後端（pytest）
cd backend && pytest
```

## 授權與聲明

- 本擴充套件使用未文件化的 Google NotebookLM 內部 API，屬非官方整合
- NotebookLM 與 Google 為 Google LLC 之商標，本專案非 Google 官方產品

## 相關連結

- [NotebookLM](https://notebooklm.google.com)
- [notebooklm-py](https://github.com/teng-lin/notebooklm-py)（後端 CLI 依賴）
- [Plasmo](https://www.plasmo.com)
