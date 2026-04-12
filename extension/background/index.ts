/**
 * Background Service Worker
 * 中繼 Extension UI 與 FastAPI Backend 之間的通訊
 */

const DEFAULT_API = "http://localhost:8000"
const TAG = "[BG]"

interface InboundMessage {
  type:
    | "ABSORB_PAGE"
    | "NOTEBOOKLM_LIST"
    | "NOTEBOOKLM_SELECT"
    | "NOTEBOOKLM_CREATE"
    | "NOTEBOOKLM_CHAT"
    | "NOTEBOOKLM_INGEST"
    | "NOTEBOOKLM_STATUS"
    | "OPEN_SIDE_PANEL"
  notebookId?: string
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

// Context menu — right-click "Send to NotebookLM"
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "send-to-notebooklm",
    title: "傳送至 NotebookLM",
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
        message: `已傳送「${title}」`,
      })
    }
  } catch (err) {
    console.error(TAG, "Context menu ingest failed:", err)
  }
})

console.log(TAG, "NotebookLM Omni-Bridge background loaded")
