# NotebookLM Py - 學習筆記

## 來源
- GitHub: [[teng-lin/notebooklm-py]]
- PyPI: notebooklm-py
- Unofficial API - 使用未文件化的 Google APIs

---

## 功能覆蓋

| Category | Capabilities |
|----------|--------------|
| **Notebooks** | Create, list, rename, delete |
| **Sources** | URLs, PDFs, YouTube, Drive, Audio, Video, Images |
| **Chat** | Chat with notebooks |
| **Artifacts** | Audio Overview (podcast), Video, Slides, Quiz, Flashcards, Infographics, Data Tables, Mind Maps, Study Guides |
| **Download** | MP3, MP4, PDF, PNG, CSV, JSON, Markdown, Google Docs/Sheets |

---

## 使用方式

### Python API
```python
from notebooklm import NotebookLM

nlm = NotebookLM()
notebooks = nlm.list_notebooks()
notebook = nlm.create_notebook("My Research")
notebook.add_source(url="https://...")
notebook.chat("summarize this")
notebook.generate_audio_overview()
notebook.download("audio_overview.mp3")
```

### CLI
```bash
notebooklm login          # OAuth 登入
notebooklm list           # 列出 notebooks
notebooklm create <name> # 建立 notebook
notebooklm add <url>     # 加入來源
notebooklm chat <msg>    # 對談
notebooklm generate      # 生成 Audio Overview
```

### Agent Integration
- Claude Code skill
- Codex `.agents` 目錄
- 可被 OpenClaw 使用

---

## 對 Omni-Bridge 的價值

| notebooklm-py 功能 | Omni-Bridge 應用 |
|-------------------|------------------|
| `add_source(url=...)` | 直接呼叫而非自己實作 Drive API |
| `add_source(drive_folder=...)` | 掛載 Drive 資料夾作為來源 |
| `chat()` | 對談介面參考 |
| `generate_audio_overview()` | 生成 podcast 功能 |
| `download()` | 下載各種格式 |

---

## 關鍵發現

1. **不需要自己實作 Drive API**：notebooklm-py 已經支援 `add_source(drive_folder=...)`
2. **直接呼叫 NotebookLM API**：繞過官方 UI 限制
3. **Agent Skill 模式**：可以做為 OpenClaw skill 整合

---

## 整合策略更新

### 原始方案（自己實作）
```
Chrome Extension → 後端 → Drive API → NotebookLM sync
```

### 新方案（使用 notebooklm-py）
```
Chrome Extension → 後端 → notebooklm-py → NotebookLM API
```

**優點**：
- 不用自己處理 Drive API
- 直接享受 NotebookLM 的 RAG 能力
- 可以生成 Audio Overview
- 更穩定（由維護者處理 API 變化）

---

## 需要學習的檔案

- [ ] `notebooklm/__init__.py` - 主要 API
- [ ] `notebooklm/notebook.py` - Notebook 類別
- [ ] `notebooklm/auth.py` - OAuth 流程
- [ ] `SKILL.md` - Agent 整合方式
