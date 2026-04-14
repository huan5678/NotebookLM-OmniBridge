/**
 * Background Service Worker
 * 中繼 Extension UI 與 FastAPI Backend 之間的通訊
 */

import type { IngestProgressMessage } from "~lib/types"

const DEFAULT_API = "http://localhost:8000"
const TAG = "[BG]"

function pushProgress(step: number, label: string, done: boolean, error?: string): void {
  const msg: IngestProgressMessage = {
    type: "NOTEBOOKLM_INGEST_PROGRESS",
    step,
    label,
    done,
    error,
  }
  chrome.runtime.sendMessage(msg).catch(() => {})
}

interface InboundMessage {
  type:
    | "SETUP_SELECTION_WATCHER"
    | "ABSORB_PAGE"
    | "NOTEBOOKLM_LIST"
    | "NOTEBOOKLM_SELECT"
    | "NOTEBOOKLM_CREATE"
    | "NOTEBOOKLM_CHAT"
    | "NOTEBOOKLM_INGEST"
    | "NOTEBOOKLM_STATUS"
    | "NOTEBOOKLM_LIST_SOURCES"
    | "NOTEBOOKLM_DELETE_SOURCE"
    | "NOTEBOOKLM_RENAME_SOURCE"
    | "OPEN_SIDE_PANEL"
  notebookId?: string
  sourceId?: string
  name?: string
  message?: string
  url?: string
  text?: string
  title?: string
}

async function getApiUrl(): Promise<string> {
  const result = await chrome.storage.local.get({ apiUrl: DEFAULT_API })
  return (result.apiUrl as string).replace(/\/+$/, "")
}

async function apiGet<T>(path: string): Promise<T> {
  const base = await getApiUrl()
  const resp = await fetch(`${base}${path}`)
  if (!resp.ok) throw new Error(`後端錯誤 ${resp.status}: ${await resp.text()}`)
  return resp.json()
}

async function apiPost<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const base = await getApiUrl()
  const resp = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`後端錯誤 ${resp.status}: ${await resp.text()}`)
  return resp.json()
}

async function apiDelete<T>(path: string): Promise<T> {
  const base = await getApiUrl()
  const resp = await fetch(`${base}${path}`, { method: "DELETE" })
  if (!resp.ok) throw new Error(`後端錯誤 ${resp.status}: ${await resp.text()}`)
  return resp.json()
}

async function apiPatch<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const base = await getApiUrl()
  const resp = await fetch(`${base}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`後端錯誤 ${resp.status}: ${await resp.text()}`)
  return resp.json()
}

chrome.runtime.onMessage.addListener(
  (msg: InboundMessage, sender, sendResponse) => {
    ;(async () => {
      try {
        switch (msg.type) {
          case "OPEN_SIDE_PANEL": {
            // popup 沒有 sender.tab，需要從當前 window 取得 windowId
            const windowId =
              sender.tab?.windowId ??
              (await chrome.windows.getCurrent()).id
            if (windowId) {
              await chrome.sidePanel.open({ windowId })
            }
            sendResponse({ success: true })
            break
          }

          case "SETUP_SELECTION_WATCHER": {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
            if (tabs[0]?.id) {
              await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: () => {
                  if ((window as any).__omniBridgeWatcher) return
                  ;(window as any).__omniBridgeWatcher = true
                  ;(window as any).__omniBridgeSelection = ""
                  document.addEventListener("selectionchange", () => {
                    const sel = window.getSelection()?.toString().trim() ?? ""
                    if (sel) (window as any).__omniBridgeSelection = sel
                  })
                },
              })
            }
            sendResponse({ success: true })
            break
          }

          case "ABSORB_PAGE": {
            const tabs = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            })
            if (!tabs[0]?.id) throw new Error(chrome.i18n.getMessage("bg_no_tab") || "找不到當前標籤頁")
            const tabId = tabs[0].id
            const [result] = await chrome.scripting.executeScript({
              target: { tabId },
              func: () => {
                function getPageTitle(): string {
                  const el = document.querySelector(
                    'meta[property="og:title"]'
                  ) as HTMLMetaElement | null
                  return el?.content?.trim() || document.title || "(無標題)"
                }

                function extractReadableText(): string {
                  const clone = document.cloneNode(true) as HTMLElement
                  const removeSelectors = [
                    "script", "style", "noscript", "iframe", "svg", "canvas",
                    "nav", "header", "footer", "aside",
                    ".ad", ".advertisement", ".sidebar", ".menu",
                    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
                    ".comments", ".social-share", ".related-posts",
                  ]
                  removeSelectors.forEach((sel) =>
                    clone.querySelectorAll(sel).forEach((el) => el.remove())
                  )
                  const contentSelectors = [
                    "article", '[role="main"]', "main",
                    ".post-content", ".article-content", ".entry-content",
                    ".content", "#content", ".post", ".article",
                  ]
                  for (const sel of contentSelectors) {
                    const el = clone.querySelector(sel)
                    if (el && (el.textContent?.trim().length ?? 0) > 200) {
                      return el.textContent?.trim() ?? ""
                    }
                  }
                  return clone.textContent?.trim() ?? ""
                }

                // Read stored selection (from watcher) or try live selection
                const storedSelection = ((window as any).__omniBridgeSelection as string) ?? ""
                const liveSelection = window.getSelection()?.toString().trim() ?? ""
                const selectedText = storedSelection || liveSelection
                const fullText = extractReadableText()

                // Clear stored selection after reading
                ;(window as any).__omniBridgeSelection = ""

                return {
                  title: getPageTitle(),
                  url: window.location.href,
                  selectedText,
                  fullText,
                  timestamp: new Date().toISOString(),
                }
              },
            })
            sendResponse({ success: true, data: result.result })
            break
          }

          case "NOTEBOOKLM_LIST": {
            const data = await apiGet("/notebooks")
            sendResponse({ success: true, data })
            break
          }

          case "NOTEBOOKLM_SELECT": {
            const data = await apiPost(`/notebooks/${msg.notebookId}/select`)
            sendResponse({ success: true, data })
            break
          }

          case "NOTEBOOKLM_CREATE": {
            const data = await apiPost(`/notebooks?name=${encodeURIComponent(msg.name!)}`)
            sendResponse({ success: true, data })
            break
          }

          case "NOTEBOOKLM_CHAT": {
            const data = await apiPost("/chat", {
              message: msg.message,
              notebook_id: msg.notebookId,
            })
            sendResponse({ success: true, data })
            break
          }

          case "NOTEBOOKLM_INGEST": {
            try {
              // Step 1: Prepare notebook
              pushProgress(1, chrome.i18n.getMessage("ingest_progress_prepare") || "選取 Notebook...", false)
              const prep = await apiPost<{ success: boolean; notebook_id?: string; error?: string }>(
                "/ingest/prepare",
                { notebook_id: msg.notebookId },
              )
              if (!prep.success) throw new Error(prep.error ?? "準備失敗")

              // Step 2: Sending content
              pushProgress(2, chrome.i18n.getMessage("ingest_progress_send") || "傳送內容...", false)

              // Step 3: Waiting for NotebookLM
              pushProgress(3, chrome.i18n.getMessage("ingest_progress_processing") || "NotebookLM 處理中...", false)

              const addBody: Record<string, unknown> = {
                notebook_id: prep.notebook_id ?? msg.notebookId,
              }
              if (msg.url) addBody.url = msg.url
              if (msg.text) {
                addBody.text = msg.text
                addBody.title = msg.title
              }
              const result = await apiPost<{ success: boolean; source_id?: string; error?: string }>(
                "/ingest/add_source",
                addBody,
              )
              if (!result.success) throw new Error(result.error ?? "攝入失敗")

              // Step 4: Done
              pushProgress(4, chrome.i18n.getMessage("ingest_progress_done") || "完成", true)
              sendResponse({ success: true, data: result })
            } catch (ingestErr) {
              pushProgress(-1, String(ingestErr), true, String(ingestErr))
              sendResponse({ success: false, error: String(ingestErr) })
            }
            break
          }

          case "NOTEBOOKLM_LIST_SOURCES": {
            const data = await apiGet(`/notebooks/${msg.notebookId}/sources`)
            sendResponse({ success: true, data })
            break
          }

          case "NOTEBOOKLM_DELETE_SOURCE": {
            const data = await apiDelete(`/notebooks/${msg.notebookId}/sources/${msg.sourceId}`)
            sendResponse({ success: true, data })
            break
          }

          case "NOTEBOOKLM_RENAME_SOURCE": {
            const data = await apiPatch(`/notebooks/${msg.notebookId}/sources/${msg.sourceId}`, { title: msg.title })
            sendResponse({ success: true, data })
            break
          }

          case "NOTEBOOKLM_STATUS": {
            const data = await apiGet("/status")
            sendResponse({ success: true, data })
            break
          }

          default:
            sendResponse({ success: false, error: "Unknown message type" })
        }
      } catch (err) {
        console.error(TAG, err)
        sendResponse({ success: false, error: String(err) })
      }
    })()
    return true
  }
)

// On install: set up side panel + context menu
chrome.runtime.onInstalled.addListener(() => {
  // 點擊 extension icon 直接開啟 side panel（不經過 popup）
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

  chrome.contextMenus.create({
    id: "send-to-notebooklm",
    title: chrome.i18n.getMessage("context_menu_send") || "傳送至 NotebookLM",
    contexts: ["selection", "page"],
  })
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "send-to-notebooklm" || !tab?.id) return

  try {
    // Get selected text or page content
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const sel = window.getSelection()?.toString().trim()
        return {
          text: sel || document.body.innerText.slice(0, 50000),
          title: document.title,
          url: window.location.href,
        }
      },
    })

    const { text, title, url } = result.result as { text: string; title: string; url: string }

    // Send to backend
    const base = await getApiUrl()
    const resp = await fetch(`${base}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, title, url }),
    })

    if (resp.ok) {
      // Show success notification if permission available
      chrome.notifications?.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icon128.plasmo.png"),
        title: "NotebookLM Omni-Bridge",
        message: chrome.i18n.getMessage("notification_sent", title) || `已傳送「${title}」`,
      })
    }
  } catch (err) {
    console.error(TAG, "Context menu ingest failed:", err)
  }
})

console.log(TAG, "NotebookLM Omni-Bridge background loaded")
