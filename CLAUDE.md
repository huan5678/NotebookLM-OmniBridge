# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NotebookLM Omni-Bridge — Chrome extension that sends web content to Google NotebookLM and provides a chat interface. Architecture:

```
Chrome Extension (Plasmo + React, MV3)
  ↕ fetch() with credentials:"include" (browser cookies)
Google NotebookLM internal RPC (notebooklm.google.com)
```

The extension calls Google's batchexecute RPC endpoints directly — no backend server required. Authentication uses the browser's existing Google session cookies.

**Optional backend** (for MCP server integration only):
```
MCP Server (stdio)
  ↕ HTTP proxy
Python FastAPI Backend (backend/)
  ↕ subprocess
notebooklm-py CLI
```

## Build & Development Commands

```bash
# Extension (Plasmo + React)
npm run dev              # plasmo dev — hot-reload extension build
npm run build            # plasmo build — production build
npm run typecheck        # tsc --noEmit on extension

# Backend (Python FastAPI) — OPTIONAL, only for MCP server
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
- **backend/** — Python FastAPI server (optional). `notebooklm_client/client.py` wraps `notebooklm-py` CLI. `server/main.py` exposes REST endpoints used by MCP server.

## Key Architecture Patterns

**Direct RPC**: The extension's background service worker calls Google's NotebookLM batchexecute API directly via `fetch()` with `credentials: "include"`. The RPC client is at `extension/lib/notebooklm-api.ts`. Authentication is cookie-based — the user must be logged into Google in Chrome.

**Extension messaging**: Side panel UI → `chrome.runtime.sendMessage` → Background service worker → `NotebookLMApi` → Google RPC → response back through same chain. Message types defined in `background/index.ts`: `ABSORB_PAGE`, `NOTEBOOKLM_LIST`, `NOTEBOOKLM_SELECT`, `NOTEBOOKLM_CHAT`, `NOTEBOOKLM_INGEST`, `NOTEBOOKLM_STATUS`.

**Page absorption**: Background uses `chrome.scripting.executeScript` with an inline function (not a separate content script file) to extract page content. A `selectionchange` watcher is injected on side panel mount to preserve text selection across focus changes. Returns `{title, url, selectedText, fullText, timestamp}`.

**i18n**: Chrome native `chrome.i18n.getMessage()` with a typed `t()` wrapper at `extension/lib/i18n.ts`. Locales at `extension/locales/{zh_TW,en}/messages.json`. Language follows browser locale.

**Plasmo conventions**: Plasmo uses file-based routing — `popup.tsx`, `sidepanel.tsx`, `options.tsx` at extension root become extension pages. `background/index.ts` becomes the service worker. Path alias `~` maps to extension root.

## Language Notes

- UI text uses **i18n** with `t()` calls. Default locale is **Traditional Chinese** (繁體中文), with English translation available.
- Code comments and variable names are in English.
- Backend Python docstrings and API descriptions are in English.
