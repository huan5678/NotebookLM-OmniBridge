# NotebookLM Omni-Bridge - 專案規格書

## 1. 專案概述

### 願景
打破 NotebookLM 的「網頁孤島」狀態，將其能力寄生到使用者的日常瀏覽行為中。

### 核心功能
- **及時存儲**：網頁內容一鍵傳送到 NotebookLM
- **及時對談**：Chrome 側邊欄直接提問
- **跨頁面引用**：將當前瀏覽內容與已存儲知識對比分析

---

## 2. 技術架構（參考 fazzes + nirholas + notebooklm-py）

### 參照學習
- **fazzes/Claude-code**：可運行 CLI 基礎架構
- **nirholas/claude-code**：完整架構文件 + Tool/Command 設計
- **teng-lin/notebooklm-py**：NotebookLM Python API

### 簡化方案（使用 notebooklm-py）⭐
| 組件 | 技術 | 職責 |
|------|------|------|
| **Chrome Extension** | Plasmo + React + TypeScript | Side Panel UI、Content Script |
| **Agent 後端** | Next.js + notebooklm-py | 呼叫非官方 API |
| **知識來源** | notebooklm-py 直接新增 | URL, PDF, YouTube, Drive |
| **對談引擎** | notebooklm-py.chat() | NotebookLM RAG |
| **下載** | notebooklm-py.download() | MP3, PDF 等格式 |

---

## 3. 功能模組設計

### 3.1 Frontend (Chrome Extension)

#### 目錄結構（參考 nirholas/src/tools/）
```
src/frontend/
├── components/          # React components
├── hooks/              # 自訂 hooks
├── services/           # API 服務
├── side-panel/         # 側邊欄主要 UI
├── content-script/     # 網頁注入腳本
└── background/         # Service Worker
```

#### 關鍵功能
- `GoogleOAuth.ts` - Google 登入權限
- `SidePanel.tsx` - 側邊欄主界面
- `WebIngest.ts` - 網頁內容吸取
- `ChatInterface.ts` - 對談輸入框

### 3.2 Backend (Agent Logic)

#### 目錄結構（參考 fazzes/src/）
```
src/backend/
├── api/
│   ├── ingest.ts      # 知識寫入 API
│   ├── chat.ts         # 對談 API
│   └── auth.ts         # 認證 API
├── services/
│   ├── notebooklm.ts   # notebooklm-py 封裝
│   └── memory.ts       # 對話記憶
├── tools/             # 參考 nirholas tools 模式
└── commands/          # slash commands
```

#### 工具設計（參考 nirholas/Tool pattern）
```typescript
// 範例：IngestTool
export const IngestTool = buildTool({
  name: 'IngestTool',
  description: '將網頁內容吸取並存儲到 NotebookLM',
  inputSchema: z.object({
    url: z.string().url(),
    mode: z.enum(['snippet', 'full', 'summary'])
  }),
  async call(args, context) {
    // 呼叫 notebooklm-py
  }
});
```

### 3.3 共享類型

#### 參考 instructkr/models.py 模式
```
src/shared/
├── types/
│   ├── tool.ts         # Tool 介面
│   ├── command.ts      # Command 介面
│   └── memory.ts       # Memory 類型
├── schemas/
│   └── index.ts        # Zod schemas
└── constants/
    └── index.ts        # 常數定義
```

---

## 4. API 設計

### 使用方式
```bash
# 啟動開發伺服器
bun run dev

#  ingestion
POST /api/ingest
  Body: { url, mode, notebook_id? }

#  chat
POST /api/chat
  Body: { message, notebook_id, history }

#  auth
GET  /api/auth/login
GET  /api/auth/callback
```

---

## 5. notebooklm-py 整合

### 為什麼用 notebooklm-py
- 不用自己實作 Drive API
- 直接呼叫 NotebookLM API
- 支援 Audio Overview 生成
- 穩定由維護者更新

### 範例用法
```python
from notebooklm import NotebookLM

nlm = NotebookLM()
# 建立或取得 notebook
notebook = nlm.get_or_create_notebook("OmniBridge Sources")

# 加入網頁來源
notebook.add_source(url="https://article.com")

# 對談
response = notebook.chat("summarize this article")

# 下載 Audio Overview
notebook.generate_audio_overview()
notebook.download("podcast.mp3")
```

---

## 6. MVP Roadmap

### Week 1: 基礎設施

| Day | 任務 | 產出 |
|-----|------|------|
| 1-2 | Extension 骨架 + Side Panel | Plasmo init + 側邊欄開啟 |
| 3-4 | notebooklm-py OAuth | 登入 + token 處理 |
| 5-7 | 知識寫入 API | URL → notebooklm-py |

### Week 2: RAG 整合

| Day | 任務 | 產出 |
|-----|------|------|
| 8-10 | Chat API 串接 | notebooklm-py.chat() |
| 11-12 | Chat UI 整合 | 側邊欄對談 |
| 13-14 | Streaming | 即時回應 |

---

## 7. 關鍵設計決策

### 命名規範（參考 Claude Code）
- Tool 命名：`IngestTool`, `ChatTool`, `DownloadTool`
- Command 命名：`/ingest`, `/chat`, `/download`
- 檔案：`PascalCase.tsx`, `camelCase.ts`

### 權限模式（參考 nirholas/Permission System）
- 使用 notebooklm-py 處理 OAuth
- notebook_id 對應使用者 NotebookLM 帳戶

---

## 8. 參考資源

- [[fazxes/Claude-code]] - 可運行重建
- [[nirholas/claude-code]] - 架構文件
- [[instructkr/claude-code]] - 移植方法
- [[teng-lin/notebooklm-py]] - NotebookLM API
- Plasmo Framework - Extension 開發
