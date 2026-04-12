# NotebookLM Omni-Bridge — 開發任務追蹤

## 已完成

- [x] Phase 1: Codebase 清理 (刪除死代碼、修 .gitignore、整理目錄)
- [x] Phase 2: Plasmo + React Extension (元件化 UI、Background、Content Script)
- [x] Phase 3: FastAPI 後端整合 (CORS、select endpoint、text ingestion)
- [x] Phase 4: 功能補完 (Settings 頁面、連線偵測、text ingestion 前端串接)

---

## P0 — 必須先通 (端對端可用)

- [ ] **驗證 notebooklm-py CLI 指令格式**
  - 安裝 notebooklm-py，確認 `list --json`, `use`, `source add`, `ask` 等指令實際輸出
  - 對照 `backend/notebooklm_client/client.py` 的解析邏輯，修正不一致

- [ ] **修正 `_run_cli` 為真正 async**
  - `client.py` 目前用 `subprocess.run` (同步) 包在 async 裡，會 block event loop
  - 改為 `asyncio.create_subprocess_exec`

- [ ] **Login / Auth 引導流程**
  - 使用者首次使用需跑 `notebooklm login` 做 OAuth
  - 後端需偵測未登入狀態，回傳明確提示
  - Extension 顯示引導訊息

- [ ] **端對端實測**
  - 完整走通：Extension 吸取頁面 → FastAPI → notebooklm-py → NotebookLM
  - 確認 list notebooks → select → ingest → chat 全流程

---

## P1 — 核心體驗

- [ ] **右鍵選單 (Context Menu)**
  - 選取文字 → 右鍵 → 「傳送至 NotebookLM」
  - 需在 background 註冊 `chrome.contextMenus`

- [ ] **Notebook 建立**
  - Extension 內可建立新 Notebook (目前只能選擇已有的)
  - FastAPI `POST /notebooks` 已有，前端需加入 UI

- [ ] **Chrome Notifications**
  - 攝入完成通知
  - 錯誤通知
  - 需加入 `notifications` permission

- [ ] **清理過時測試**
  - `tests/` 目錄的 .test.ts 檔案參照舊架構，需重寫或刪除
  - `backend/tests/` 需對照新 API 格式更新

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
  ↕ HTTP fetch (可配置 URL)
Python FastAPI Backend (預設 port 8000)
  ↕ subprocess (async)
notebooklm-py CLI
  ↕ Google APIs
NotebookLM
```

### 關鍵檔案
- Extension 入口: `extension/sidepanel.tsx`, `extension/popup.tsx`, `extension/options.tsx`
- Background: `extension/background/index.ts`
- React 元件: `extension/components/SidePanel.tsx`, `ChatTab.tsx`, `IngestTab.tsx`
- FastAPI: `backend/server/main.py`
- Client: `backend/notebooklm_client/client.py`
- MCP Server: `mcp-server/src/index.ts`
