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

---

## 待做 — 端對端實測

- [ ] **端對端實測**
  - 啟動 FastAPI → 載入 Extension → 實際走通全流程
  - list notebooks → select → 吸取頁面 → ingest → chat
  - 右鍵選單攝入 → 通知
  - MCP Server → FastAPI → notebooklm-py

---

## 未來可做

- [ ] 更精緻的 Extension Icon (設計師操刀)
- [ ] 攝入進度條 (長文本攝入時)
- [ ] 多語系支援 (目前僅繁體中文)
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
