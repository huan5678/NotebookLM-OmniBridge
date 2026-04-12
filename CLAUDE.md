# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NotebookLM Omni-Bridge — Chrome extension that sends web content to Google NotebookLM and provides a chat interface. Architecture:

```
Chrome Extension (Plasmo + React)
  ↕ HTTP fetch (configurable URL, default localhost:8000)
Python FastAPI Backend
  ↕ subprocess (notebooklm-py CLI)
NotebookLM (Google APIs)
```

MCP Server exists as a separate module for AI tool integration (Claude, etc.), independent of the Extension ↔ FastAPI flow.

## Build & Development Commands

```bash
# Extension (Plasmo + React)
npm run dev              # plasmo dev — hot-reload extension build
npm run build            # plasmo build — production build
npm run typecheck        # tsc --noEmit on extension

# Backend (Python FastAPI)
cd backend && pip install -r requirements.txt
cd backend && uvicorn server.main:app --port 8000

# Backend tests
cd backend && pytest

# Core library
npm run build -w core    # tsc
npm run dev -w core      # tsc --watch

# MCP Server
npm run mcp              # node dist/index.js

# Frontend tests (vitest, jsdom)
npx vitest run           # run all tests
npx vitest run tests/unit/api.test.ts   # single test
```

Load extension in Chrome: `chrome://extensions` → Load unpacked → `extension/build/chrome-mv3-dev/` (dev) or `extension/build/chrome-mv3-prod/` (prod).

## Monorepo Structure

npm workspaces with 3 JS packages + 1 Python package:

- **extension/** — Chrome Extension entry points. Plasmo framework auto-generates manifest from `package.json` `manifest` field. Entry files: `popup.tsx`, `sidepanel.tsx`, `options.tsx`. Background service worker at `background/index.ts`.
- **core/** — TypeScript library (`@nac/core`). NotebookLMClient (wraps Python CLI via spawn), GoogleDriveClient, MarkdownConverter.
- **mcp-server/** — MCP Server (`@nac/mcp-server`). Stdio transport, exposes tools: `notebooklm_list_notebooks`, `notebooklm_ingest`, `notebooklm_chat`, `notebooklm_status`.
- **backend/** — Python FastAPI server. `notebooklm_client/client.py` wraps `notebooklm-py` CLI. `server/main.py` exposes REST endpoints consumed by the extension.

## Key Architecture Patterns

**Extension messaging**: Side panel UI → `chrome.runtime.sendMessage` → Background service worker → `fetch()` to FastAPI → response back through same chain. Message types defined in `background/index.ts`: `ABSORB_PAGE`, `NOTEBOOKLM_LIST`, `NOTEBOOKLM_SELECT`, `NOTEBOOKLM_CHAT`, `NOTEBOOKLM_INGEST`, `NOTEBOOKLM_STATUS`.

**Page absorption**: Background uses `chrome.scripting.executeScript` with an inline function (not a separate content script file) to extract page content. Returns `{title, url, selectedText, fullText, timestamp}`.

**Settings**: Stored in `chrome.storage.local` via `extension/lib/settings.ts`. Background reads API URL dynamically from storage on each request.

**Plasmo conventions**: Plasmo uses file-based routing — `popup.tsx`, `sidepanel.tsx`, `options.tsx` at extension root become extension pages. `background/index.ts` becomes the service worker. Path alias `~` maps to extension root.

## Language Notes

- UI text is in **Traditional Chinese** (繁體中文). Maintain this convention for all user-facing strings in the extension.
- Code comments and variable names are in English.
- Backend Python docstrings and API descriptions are in English.
