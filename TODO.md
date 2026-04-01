# NotebookLM Omni-Bridge - 方案 B (Google Drive) 開發計劃

## 当前状态

- [x] MVP 基础架构 (FastAPI + notebooklm-py)
- [x] 測試通過
- [x] E2E 验证
- [ ] **方案 B 完整实现**

---

## 方案 B 开发任务

### Phase 1: 基础设定

- [ ] Google OAuth 流程
- [ ] 權限申請 (Drive API)
- [ ] chrome.storage 設定頁面
- [ ] 登入/登出流程

### Phase 2: Drive 整合

- [ ] Google Drive API client
- [ ] 列出資料夾
- [ ] 建立資料夾
- [ ] 選擇資料夾對話框

### Phase 3: 存儲流程

- [ ] 網頁內容抓取 (Content Script)
- [ ] Markdown 轉換
- [ ] Drive API 上傳
- [ ] 進度條/通知

### Phase 4: 通知系統

- [ ] 存儲完成通知
- [ ] 延遲提示
- [ ] 同步完成通知
- [ ] 錯誤處理

### Phase 5: UI/UX

- [ ] Side Panel 重新設計
- [ ] 設定頁面
- [ ] 右鍵選單
- [ ] 快捷鍵

---

## 需要的新檔案

```
src/frontend/
├── components/
│   ├── SettingsPanel.tsx     # 設定頁面
│   ├── FolderSelector.tsx    # 資料夾選擇
│   └── StatusIndicator.tsx    # 狀態顯示
├── services/
│   ├── googleAuth.ts         # OAuth 服務
│   ├── driveApi.ts          # Drive API
│   └── storage.ts          # 設定存儲
├── content-script/
│   ├── pageIngest.ts        # 網頁內容抓取
│   └── contextMenu.ts      # 右鍵選單
└── background/
    └── notifications.ts    # 通知處理
```

---

## 快速開始

```bash
# 開發
npm run dev

# 測試
npm run test:run
```

---

## Google API 設定

需要申請：
1. Google Cloud Console 專案
2. Drive API v3
3. OAuth 2.0 Client ID
