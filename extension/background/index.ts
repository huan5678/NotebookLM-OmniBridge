/**
 * Background Service Worker
 * 中繼 Extension UI 與 Google NotebookLM RPC 之間的通訊
 */

import type { IngestProgressMessage } from "~lib/types"
import { NotebookLMApi, AuthError } from "~lib/notebooklm-api"

const TAG = "[BG]"
const api = new NotebookLMApi()

function isWebPageTab(tab?: chrome.tabs.Tab | null): tab is chrome.tabs.Tab & { id: number } {
  if (!tab?.id) return false
  const url = tab.url ?? tab.pendingUrl ?? ""
  return !!url && !url.startsWith("chrome://") && !url.startsWith("chrome-extension://") &&
         !url.startsWith("edge://") && !url.startsWith("about:") && !url.startsWith("devtools://")
}

/**
 * Find a tab suitable for content extraction. Priority:
 * 1. Active tab in the last-focused *normal* browser window
 * 2. Any active tab across windows that is a regular web page
 * Skips chrome://, chrome-extension:// (e.g. side panel hosts, popup windows)
 */
async function findWebPageTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const lastFocused = await chrome.windows.getLastFocused({
      populate: true,
      windowTypes: ["normal"],
    })
    const activeInLF = lastFocused?.tabs?.find((t) => t.active)
    if (isWebPageTab(activeInLF)) return activeInLF
  } catch {}
  try {
    const allActive = await chrome.tabs.query({ active: true })
    const webTab = allActive.find(isWebPageTab)
    if (webTab) return webTab
  } catch {}
  return null
}

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
    | "NOTEBOOKLM_LIST_ARTIFACTS"
    | "NOTEBOOKLM_GENERATE_ARTIFACT"
    | "NOTEBOOKLM_DELETE_ARTIFACT"
    | "NOTEBOOKLM_GET_ARTIFACT_HTML"
    | "OPEN_SIDE_PANEL"
  notebookId?: string
  sourceId?: string
  artifactId?: string
  artifactType?: string
  artifactOptions?: Record<string, any>
  name?: string
  message?: string
  url?: string
  text?: string
  title?: string
}

chrome.runtime.onMessage.addListener(
  (msg: InboundMessage, sender, sendResponse) => {
    // Ignore messages meant for the offscreen document
    if ((msg as any).type === "OFFSCREEN_FETCH") return false

    ;(async () => {
      try {
        switch (msg.type) {
          case "OPEN_SIDE_PANEL": {
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
            const tab = await findWebPageTab()
            if (tab?.id) {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
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
            // Prefer the last-focused normal window so capturing works even when
            // Studio/Editor/Chat popup windows are the currently-focused window.
            let targetTab = await findWebPageTab()
            if (!targetTab?.id) {
              throw new Error(chrome.i18n.getMessage("bg_no_tab") || "找不到當前標籤頁")
            }
            const tabId = targetTab.id
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
                  // Step 1: Remove noise elements from a clone
                  const clone = document.cloneNode(true) as HTMLElement
                  const noiseSelectors = [
                    "script", "style", "noscript", "iframe", "svg", "canvas",
                    "symbol", "defs", "path", "use",
                    "nav", "header", "footer", "aside", "form", "button",
                    "select", "input", "textarea",
                    ".ad", ".advertisement", ".sidebar", ".menu", ".nav",
                    ".breadcrumb", ".pagination", ".share", ".social",
                    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
                    '[role="complementary"]', '[role="search"]',
                    ".comments", ".social-share", ".related-posts", ".recommended",
                    ".cookie-banner", ".popup", ".modal", ".newsletter",
                    ".toc", ".table-of-contents",
                    ".header-frame", ".footer", ".m-header-frame", ".m-nav-frame",
                    ".sub-nav-frame", ".sub-sub-nav-frame", ".search_fun_container",
                    ".gotop", ".ad-banner", ".leftsidebar",
                    ".keyword-wrapper", ".keyword-tip",
                    "#header-wrapper", "#footer", "#cookiearea",
                  ]
                  noiseSelectors.forEach((sel) =>
                    clone.querySelectorAll(sel).forEach((el) => el.remove())
                  )

                  // Step 2: Try semantic/CMS-specific selectors first
                  const semanticSelectors = [
                    // CMS-specific (common news sites)
                    "#newsText", ".Article", ".main_p",
                    ".dt-news-content", ".news-content",
                    ".story-content", ".article-text",
                    // Generic semantic
                    "article", '[role="main"]', "main",
                    ".post-content", ".article-content", ".entry-content",
                    ".post-body", ".article-body", ".story-body",
                    "#content .content", ".page-content",
                  ]
                  for (const sel of semanticSelectors) {
                    const el = clone.querySelector(sel)
                    if (el && (el.textContent?.trim().length ?? 0) > 50) {
                      return htmlToMarkdown(el)
                    }
                  }

                  // Step 3: Score all container elements by content density
                  const candidates = clone.querySelectorAll("div, section, td")
                  let bestEl: Element | null = null
                  let bestScore = 0

                  candidates.forEach((el) => {
                    const text = el.textContent?.trim() ?? ""
                    if (text.length < 150) return

                    // Count meaningful paragraphs (>40 chars)
                    const paragraphs = el.querySelectorAll("p")
                    let meaningfulP = 0
                    paragraphs.forEach((p) => {
                      if ((p.textContent?.trim().length ?? 0) > 40) meaningfulP++
                    })

                    // Calculate link density: ratio of link text to total text
                    let linkTextLen = 0
                    el.querySelectorAll("a").forEach((a) => {
                      linkTextLen += a.textContent?.length ?? 0
                    })
                    const linkDensity = linkTextLen / Math.max(text.length, 1)

                    // High link density = navigation, not content
                    if (linkDensity > 0.5) return

                    // Score: paragraphs matter most, text length second, link density penalty
                    let score = meaningfulP * 5 + text.length / 100
                    score *= (1 - linkDensity)

                    // Bonus for elements with many <p>, <pre>, <blockquote>
                    const richContent = el.querySelectorAll("p, pre, blockquote, h2, h3, li")
                    score += richContent.length * 1.5

                    // Penalty for deeply nested short containers (likely wrappers)
                    if (el.children.length < 2 && el.querySelector("div")) {
                      score *= 0.5
                    }

                    if (score > bestScore) {
                      bestScore = score
                      bestEl = el
                    }
                  })

                  if (bestEl) {
                    return htmlToMarkdown(bestEl)
                  }

                  // Step 4: Last resort — body text after noise removal
                  return htmlToMarkdown(clone)
                }

                function htmlToMarkdown(el: Element): string {
                  function walk(node: Node, listDepth: number, listType: "ul" | "ol", listIndex: number[]): string {
                    if (node.nodeType === Node.TEXT_NODE) {
                      return (node.textContent ?? "").replace(/\s+/g, " ")
                    }
                    if (node.nodeType !== Node.ELEMENT_NODE) return ""
                    const tag = (node as Element).tagName.toLowerCase()

                    // Skip hidden elements
                    const style = window.getComputedStyle(node as Element)
                    if (style.display === "none" || style.visibility === "hidden") return ""

                    // Collect children text
                    const childTexts = () => {
                      let result = ""
                      node.childNodes.forEach((c) => { result += walk(c, listDepth, listType, listIndex) })
                      return result
                    }

                    switch (tag) {
                      case "h1": return `\n\n# ${childTexts().trim()}\n\n`
                      case "h2": return `\n\n## ${childTexts().trim()}\n\n`
                      case "h3": return `\n\n### ${childTexts().trim()}\n\n`
                      case "h4": return `\n\n#### ${childTexts().trim()}\n\n`
                      case "h5":
                      case "h6": return `\n\n**${childTexts().trim()}**\n\n`
                      case "p": return `\n\n${childTexts().trim()}\n\n`
                      case "br": return "\n"
                      case "hr": return "\n\n---\n\n"
                      case "strong":
                      case "b": {
                        const t = childTexts().trim()
                        return t ? `**${t}**` : ""
                      }
                      case "em":
                      case "i": {
                        const t = childTexts().trim()
                        return t ? `_${t}_` : ""
                      }
                      case "code": {
                        const t = childTexts().trim()
                        return t ? `\`${t}\`` : ""
                      }
                      case "pre": {
                        const codeEl = (node as Element).querySelector("code")
                        const t = (codeEl ?? node).textContent?.trim() ?? ""
                        return t ? `\n\n\`\`\`\n${t}\n\`\`\`\n\n` : ""
                      }
                      case "blockquote": {
                        const inner = childTexts().trim()
                        if (!inner) return ""
                        return "\n\n" + inner.split("\n").map((l) => `> ${l}`).join("\n") + "\n\n"
                      }
                      case "a": {
                        const href = (node as HTMLAnchorElement).href
                        const t = childTexts().trim()
                        if (!t) return ""
                        if (href && !href.startsWith("javascript:")) return `[${t}](${href})`
                        return t
                      }
                      case "img": {
                        const alt = (node as HTMLImageElement).alt || ""
                        const src = (node as HTMLImageElement).src || ""
                        if (src) return `![${alt}](${src})`
                        return ""
                      }
                      case "ul": {
                        let result = "\n"
                        let idx = 0
                        node.childNodes.forEach((c) => {
                          if ((c as Element).tagName?.toLowerCase() === "li") {
                            const indent = "  ".repeat(listDepth)
                            const text = walk(c, listDepth + 1, "ul", [...listIndex, idx]).trim()
                            if (text) result += `${indent}- ${text}\n`
                            idx++
                          }
                        })
                        return result + "\n"
                      }
                      case "ol": {
                        let result = "\n"
                        let idx = 1
                        node.childNodes.forEach((c) => {
                          if ((c as Element).tagName?.toLowerCase() === "li") {
                            const indent = "  ".repeat(listDepth)
                            const text = walk(c, listDepth + 1, "ol", [...listIndex, idx]).trim()
                            if (text) result += `${indent}${idx}. ${text}\n`
                            idx++
                          }
                        })
                        return result + "\n"
                      }
                      case "li": return childTexts()
                      case "table": {
                        const rows: string[][] = []
                        ;(node as Element).querySelectorAll("tr").forEach((tr) => {
                          const cells: string[] = []
                          tr.querySelectorAll("th, td").forEach((cell) => {
                            cells.push(cell.textContent?.trim() ?? "")
                          })
                          if (cells.length > 0) rows.push(cells)
                        })
                        if (rows.length === 0) return ""
                        const colCount = Math.max(...rows.map((r) => r.length))
                        let md = "\n\n"
                        rows.forEach((row, i) => {
                          const padded = row.concat(Array(colCount - row.length).fill(""))
                          md += "| " + padded.join(" | ") + " |\n"
                          if (i === 0) md += "| " + padded.map(() => "---").join(" | ") + " |\n"
                        })
                        return md + "\n"
                      }
                      case "tr": case "th": case "td": case "thead": case "tbody":
                        return "" // handled by table
                      case "figure": {
                        const img = (node as Element).querySelector("img")
                        const caption = (node as Element).querySelector("figcaption")
                        let result = ""
                        if (img) result += `![${img.alt || ""}](${img.src || ""})`
                        if (caption) result += `\n*${caption.textContent?.trim()}*`
                        return result ? `\n\n${result}\n\n` : ""
                      }
                      default:
                        return childTexts()
                    }
                  }

                  const raw = walk(el, 0, "ul", [])
                  // Clean up: collapse 3+ newlines to 2, trim lines
                  return raw
                    .replace(/\n{3,}/g, "\n\n")
                    .split("\n")
                    .map((l) => l.trimEnd())
                    .join("\n")
                    .trim()
                }

                const storedSelection = ((window as any).__omniBridgeSelection as string) ?? ""
                const liveSelection = window.getSelection()?.toString().trim() ?? ""
                const selectedText = storedSelection || liveSelection
                const fullText = extractReadableText()
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

          case "NOTEBOOKLM_STATUS": {
            try {
              console.log(TAG, "NOTEBOOKLM_STATUS: checking auth...")
              const authenticated = await api.isAuthenticated()
              console.log(TAG, "NOTEBOOKLM_STATUS: authenticated =", authenticated)
              if (!authenticated) {
                sendResponse({
                  success: true,
                  data: {
                    connected: true,
                    authenticated: false,
                    current_notebook: null,
                    notebooks: [],
                  },
                })
                break
              }
              const notebooks = await api.listNotebooks()
              sendResponse({
                success: true,
                data: {
                  connected: true,
                  authenticated: true,
                  current_notebook: null,
                  notebooks: notebooks.map((nb) => ({
                    id: nb.id,
                    title: nb.title,
                    is_owner: nb.is_owner,
                    created_at: nb.created_at,
                  })),
                },
              })
            } catch (err) {
              if (err instanceof AuthError) {
                sendResponse({
                  success: true,
                  data: {
                    connected: true,
                    authenticated: false,
                    current_notebook: null,
                    notebooks: [],
                  },
                })
              } else {
                sendResponse({
                  success: true,
                  data: {
                    connected: false,
                    authenticated: false,
                    current_notebook: null,
                    notebooks: [],
                  },
                })
              }
            }
            break
          }

          case "NOTEBOOKLM_LIST": {
            const notebooks = await api.listNotebooks()
            sendResponse({
              success: true,
              data: {
                notebooks: notebooks.map((nb) => ({
                  id: nb.id,
                  title: nb.title,
                  is_owner: nb.is_owner,
                  created_at: nb.created_at,
                })),
              },
            })
            break
          }

          case "NOTEBOOKLM_SELECT": {
            // No-op for direct RPC — notebook selection is implicit per-call
            sendResponse({ success: true, data: { success: true, notebook_id: msg.notebookId } })
            break
          }

          case "NOTEBOOKLM_CREATE": {
            const notebook = await api.createNotebook(msg.name!)
            sendResponse({ success: true, data: notebook })
            break
          }

          case "NOTEBOOKLM_CHAT": {
            const answer = await api.chat(msg.message!, msg.notebookId!)
            sendResponse({ success: true, data: { response: answer } })
            break
          }

          case "NOTEBOOKLM_INGEST": {
            try {
              pushProgress(1, chrome.i18n.getMessage("ingest_progress_prepare") || "選取 Notebook...", false)

              if (!msg.notebookId) throw new Error("No notebook selected")

              pushProgress(2, chrome.i18n.getMessage("ingest_progress_send") || "傳送內容...", false)
              pushProgress(3, chrome.i18n.getMessage("ingest_progress_processing") || "NotebookLM 處理中...", false)

              let sourceId: string
              if (msg.url) {
                sourceId = await api.addUrlSource(msg.url, msg.notebookId)
              } else if (msg.text) {
                sourceId = await api.addTextSource(msg.title || "Untitled", msg.text, msg.notebookId)
              } else {
                throw new Error("url or text required")
              }

              pushProgress(4, chrome.i18n.getMessage("ingest_progress_done") || "完成", true)
              sendResponse({ success: true, data: { success: true, source_id: sourceId } })
            } catch (ingestErr) {
              pushProgress(-1, String(ingestErr), true, String(ingestErr))
              sendResponse({ success: false, error: String(ingestErr) })
            }
            break
          }

          case "NOTEBOOKLM_LIST_SOURCES": {
            const { sources } = await api.getNotebook(msg.notebookId!)
            sendResponse({
              success: true,
              data: {
                sources: sources.map((s) => ({
                  id: s.id,
                  title: s.title,
                  type: s.type,
                  url: s.url,
                  status: s.status,
                  created_at: s.created_at,
                })),
              },
            })
            break
          }

          case "NOTEBOOKLM_DELETE_SOURCE": {
            await api.deleteSource(msg.sourceId!)
            sendResponse({ success: true, data: { success: true } })
            break
          }

          case "NOTEBOOKLM_RENAME_SOURCE": {
            await api.renameSource(msg.sourceId!, msg.title!)
            sendResponse({ success: true, data: { success: true } })
            break
          }

          case "NOTEBOOKLM_LIST_ARTIFACTS": {
            const artifacts = await api.listArtifacts(msg.notebookId!)
            sendResponse({ success: true, data: { artifacts } })
            break
          }

          case "NOTEBOOKLM_GENERATE_ARTIFACT": {
            const result = await api.generateArtifact(
              msg.notebookId!,
              msg.artifactType as any,
              msg.artifactOptions,
            )
            sendResponse({ success: true, data: result })
            break
          }

          case "NOTEBOOKLM_DELETE_ARTIFACT": {
            await api.deleteArtifact(msg.artifactId!, msg.notebookId!)
            sendResponse({ success: true, data: { success: true } })
            break
          }

          case "NOTEBOOKLM_GET_ARTIFACT_HTML": {
            const html = await api.getArtifactHtml(msg.artifactId!, msg.notebookId!)
            sendResponse({ success: true, data: { html } })
            break
          }

          default:
            sendResponse({ success: false, error: "Unknown message type" })
        }
      } catch (err) {
        console.error(TAG, err)
        if (err instanceof AuthError) {
          sendResponse({ success: false, error: "NOT_AUTHENTICATED" })
        } else {
          sendResponse({ success: false, error: String(err) })
        }
      }
    })()
    return true
  }
)

// On install: set up side panel + context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

  chrome.contextMenus.create({
    id: "send-to-notebooklm",
    title: chrome.i18n.getMessage("context_menu_send") || "傳送至 NotebookLM",
    contexts: ["selection", "page"],
  })
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "send-to-notebooklm" || !tab?.id) return
  if (!isWebPageTab(tab)) {
    console.warn(TAG, "Context menu ignored on non-web page:", tab.url)
    return
  }

  try {
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

    const { text, title } = result.result as { text: string; title: string; url: string }

    // Get a notebook to send to (use first available)
    const notebooks = await api.listNotebooks()
    if (notebooks.length === 0) return

    await api.addTextSource(title, text, notebooks[0].id)

    chrome.notifications?.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icon128.plasmo.png"),
      title: "NotebookLM Omni-Bridge",
      message: chrome.i18n.getMessage("notification_sent", title) || `已傳送「${title}」`,
    })
  } catch (err) {
    console.error(TAG, "Context menu ingest failed:", err)
  }
})

console.log(TAG, "NotebookLM Omni-Bridge background loaded (direct RPC mode)")
