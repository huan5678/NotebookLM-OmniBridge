# NotebookLM Omni-Bridge - 方案 C (精簡一鍵設定)

## 當前狀態

- [x] Google Drive API 已啟用 ✅
- [x] notebooklm 已登入（重用credentials）
- [x] Phase 1: OAuth 服務建立
- [ ] **Phase 1: 與 notebooklm 整合**

---

## OAuth 選項

| 選項 | 說明 | 狀態 |
|------|------|------|
| **A** | 重用 notebooklm credentials | ✅ 可行 |
| **B** | Chrome Identity API | 需要 Web Store 發布 |
| **C** | 建立 OAuth Client ID | 需要手動設定 |

---

## 下一步：重用 notebooklm 登入

優勢：
- 使用者已經登入 notebooklm
- 不需要額外 OAuth 設定
- 直接使用 NotebookLM API

流程：
1. 讀取 notebooklm 的 storage_state.json
2. 用這些 cookies 存取 NotebookLM API
3. 提供設定精靈讓使用者選擇 Notebook
