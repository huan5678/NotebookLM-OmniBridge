# NotebookLM Omni-Bridge — 開發任務追蹤

## 已完成

- [x] Phase 1: Codebase 清理 (刪除死代碼、修 .gitignore、整理目錄)
- [x] Phase 2: Plasmo + React Extension (元件化 UI、Background、Content Script)
- [x] Phase 3: FastAPI 後端整合 (CORS、select endpoint、text ingestion)
- [x] Phase 4: 功能補完 (Settings 頁面、連線偵測、text ingestion 前端串接)
- [x] P0: 驗證 notebooklm-py CLI 指令格式 + 修正 async client
- [x] P0: Login / Auth 引導流程
- [x] P1: 右鍵選單 + Chrome Notifications
- [x] P1: Notebook 建立 UI
- [x] P1: 清理過時測試 (backend 10/10 通過)
- [x] P2: 首次使用 Onboarding (options.tsx 步驟式引導 + 環境檢查)
- [x] P2: 攝入歷史記錄 (chrome.storage.local, IngestTab 底部顯示)
- [x] P2: Extension Icon (SVG → PNG 512x512, Plasmo 自動縮放)
- [x] P2: MCP Server 改為 proxy FastAPI (消除重複邏輯)
- [x] P3: 來源管理 Modal (list / delete / rename sources via Radix Dialog)
- [x] P3: Ingest 修正 (--type text 防止 Errno 63 + -n notebook_id 確保目標正確)
- [x] P3: Ingest Loading Overlay (全螢幕遮罩防止誤操作)
- [x] P3: 配色重構 (純黑白灰 + #EDFF00 強調色 + Light/Dark/System mode, WCAG AAA)

---

## 已完成 — 端對端實測

- [x] **端對端實測** (2026-04-14)
  - [x] API: list notebooks → select → ingest text → chat (全通過)
  - [x] API: source management — list / rename / delete (全通過)
  - [x] MCP Server → FastAPI → notebooklm-py (initialize + tools/list + status 全通過)
  - [x] Backend pytest: 14/14 通過 (5 個 pre-existing 失敗已排除)

---

## 已完成 — 進度條 + i18n

- [x] **攝入進度條** (2026-04-14)
  - [x] 後端拆分 /ingest/prepare + /ingest/add_source 兩階段 endpoint
  - [x] Background 兩階段呼叫 + chrome.runtime.sendMessage 推送 4 步驟進度
  - [x] IngestTab 內嵌進度條 UI (步驟圓點 + 文字標籤 + 動畫軌道條)
  - [x] 移除 SidePanel 全螢幕 loading overlay
- [x] **多語系 i18n** (2026-04-14)
  - [x] Chrome 原生 chrome.i18n.getMessage + typed t() wrapper
  - [x] 69+ 字串抽取至 locales/zh_TW + locales/en
  - [x] 7 個元件全部替換為 t() 呼叫
  - [x] Background service worker 字串 i18n 化
  - [x] package.json default_locale + __MSG_ext_description__
  - [x] formatTime locale 動態化 (chrome.i18n.getUILanguage)

---

## 已完成 — 架構重構：消除後端依賴

- [x] **方案 C: Extension 直連 Google RPC** (2026-04-15)
  - [x] 新建 `extension/lib/notebooklm-api.ts` — 直接呼叫 batchexecute RPC
  - [x] 移植 notebooklm-py 的 response parser 到 TypeScript
  - [x] 改寫 background/index.ts — 移除 HTTP helpers，改用 NotebookLMApi
  - [x] 認證改為 browser cookies — 無需 Python、無需 Playwright login
  - [x] Options 頁面簡化為主題 + 登入狀態檢查
  - [x] SidePanel 狀態語意從 connected → authenticated
  - [x] Backend/MCP Server 保留為 optional

---

## 未來可做

- [ ] 更精緻的 Extension Icon (設計師操刀)
- [ ] CI pipeline (GitHub Actions)
- [ ] Chrome Web Store 發布準備

---

## 架構備註

```
Chrome Extension (Plasmo + React)
  ↕ HTTP fetch (可配置 URL, 預設 localhost:8000)
Python FastAPI Backend
  ↕ asyncio.create_subprocess_exec
notebooklm-py CLI
  ↕ Google APIs
NotebookLM

MCP Server (stdio)
  ↕ HTTP proxy
FastAPI Backend (同上)
```
