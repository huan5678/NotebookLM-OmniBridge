/**
 * Background Service Worker
 * 中繼 Extension UI 與 FastAPI Backend 之間的通訊
 */

const API_SERVER = "http://localhost:8000"
const TAG = "[BG]"

interface InboundMessage {
  type:
    | "ABSORB_PAGE"
    | "NOTEBOOKLM_LIST"
    | "NOTEBOOKLM_SELECT"
    | "NOTEBOOKLM_CHAT"
    | "NOTEBOOKLM_INGEST"
    | "NOTEBOOKLM_STATUS"
    | "OPEN_SIDE_PANEL"
  notebookId?: string
  message?: string
  url?: string
  text?: string
  title?: string
}

async function apiGet<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_SERVER}${path}`)
  if (!resp.ok) throw new Error(`API ${resp.status}: ${await resp.text()}`)
  return resp.json()
}

async function apiPost<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const resp = await fetch(`${API_SERVER}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`API ${resp.status}: ${await resp.text()}`)
  return resp.json()
}

chrome.runtime.onMessage.addListener(
  (msg: InboundMessage, sender, sendResponse) => {
    ;(async () => {
      try {
        switch (msg.type) {
          case "OPEN_SIDE_PANEL": {
            const windowId = sender.tab?.windowId
            if (windowId) {
              await chrome.sidePanel.open({ windowId })
            }
            sendResponse({ success: true })
            break
          }

          case "ABSORB_PAGE": {
            const tabs = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            })
            if (!tabs[0]?.id) throw new Error("找不到當前標籤頁")
            const tabId = tabs[0].id
            const [result] = await chrome.scripting.executeScript({
              target: { tabId },
              func: () => {
                // Inline content script for page absorption
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

                const selection = window.getSelection()
                const selectedText = selection?.toString().trim() ?? ""
                const fullText = extractReadableText()
                return {
                  title: getPageTitle(),
                  url: window.location.href,
                  selectedText,
                  fullText: selectedText || fullText,
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

          case "NOTEBOOKLM_CHAT": {
            const data = await apiPost("/chat", {
              message: msg.message,
              notebook_id: msg.notebookId,
            })
            sendResponse({ success: true, data })
            break
          }

          case "NOTEBOOKLM_INGEST": {
            const body: Record<string, unknown> = { notebook_id: msg.notebookId }
            if (msg.url) body.url = msg.url
            if (msg.text) {
              body.text = msg.text
              body.title = msg.title
            }
            const data = await apiPost("/ingest", body)
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

console.log(TAG, "NotebookLM Omni-Bridge background loaded")
