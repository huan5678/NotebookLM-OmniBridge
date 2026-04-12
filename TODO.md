# NotebookLM Omni-Bridge — 開發任務追蹤

## 已完成

- [x] Phase 1: Codebase 清理 (刪除死代碼、修 .gitignore、整理目錄)
- [x] Phase 2: Plasmo + React Extension (元件化 UI、Background、Content Script)
- [x] Phase 3: FastAPI 後端整合 (CORS、select endpoint、text ingestion)
- [x] Phase 4: 功能補完 (Settings 頁面、連線偵測、text ingestion 前端串接)
- [x] P0: 驗證 notebooklm-py CLI 指令格式 — 已對照確認一致
- [x] P0: 修正 `_run_cli` 為真正 async — 改用 `asyncio.create_subprocess_exec`
- [x] P0: Login / Auth 引導流程 — `/status` 偵測 auth、Extension 顯示引導 banner
- [x] P1: 右鍵選單 (Context Menu) — 選取文字/頁面 → 右鍵 → 傳送至 NotebookLM
- [x] P1: Notebook 建立 — NotebookSelector 加入「+」建立新 Notebook
- [x] P1: Chrome Notifications — 右鍵攝入成功後顯示通知
- [x] P1: 清理過時測試 — 刪除 3 個 stale frontend tests，更新 backend tests (10/10 通過)

---

## P0 — 端對端實測

- [ ] **端對端實測**
  - 啟動 FastAPI → 載入 Extension → 實際走通全流程
  - list notebooks → select → 吸取頁面 → ingest → chat

---

## P2 — 優化

- [ ] **首次使用 Onboarding**
  - 安裝後引導：Python 環境 → pip install → notebooklm login → 啟動後端
  - 可做在 options.tsx 或獨立 welcome page

- [ ] **同步狀態追蹤**
  - 記錄上次攝入時間
  - 顯示攝入歷史記錄

- [ ] **Extension Icon**
  - 替換 Plasmo 預設的空白 icon
  - 設計符合品牌的 icon

- [ ] **MCP Server 整合**
  - 考慮 MCP Server 改用 Python (共用 FastAPI backend) 或加 HTTP wrapper
  - 目前 TypeScript MCP Server 與 Python backend 邏輯重複

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
```
