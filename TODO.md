# NotebookLM Omni-Bridge - 方案 C (精簡一鍵設定)

## 目標
讓非工程人員也能輕鬆使用，一鍵 Google 登入 + 自動化

---

## 當前狀態

- [x] MVP 基礎架構 (FastAPI + notebooklm-py)
- [x] 方案選擇：方案 C（精簡化方案 B）
- [ ] **Phase 1: OAuth + 基本設定**

---

## 開發任務

### Phase 1: Google OAuth + 基本設定 🔴

- [ ] Google OAuth 設定精靈（一鍵登入）
- [ ] 權限申請 (Drive API, OAuth)
- [ ] 自動化建立 Drive 資料夾
- [ ] chrome.storage 設定頁面
- [ ] 登入/登出狀態顯示

### Phase 2: Drive 整合 🟡

- [ ] Google Drive API client
- [ ] 列出使用者資料夾
- [ ] 建立新資料夾
- [ ] 選擇資料夾對話框

### Phase 3: 存儲流程 🟡

- [ ] 網頁內容抓取 (Content Script)
- [ ] Markdown 轉換
- [ ] Drive API 上傳
- [ ] 進度通知

### Phase 4: 通知系統 🟢

- [ ] 存儲完成通知
- [ ] 延遲提示 ("等待同步中...")
- [ ] 同步完成通知

### Phase 5: UI/UX 🟢

- [ ] 重設計 Side Panel
- [ ] 設定頁面
- [ ] 右鍵選單

---

## 使用者流程（目標：30秒內完成設定）

```
1. 安裝 Extension
2. 點擊「登入 Google」→ 選擇帳號 → 允許
3. 完成！開始使用
```

---

## 下一步

開始 Phase 1：建立 Google OAuth 流程
