import React, { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { marked } from "marked"
import { Loader2 } from "lucide-react"
import "~style.css"
import { initTheme } from "~lib/theme"
import { bgSend } from "~lib/messaging"
import { t } from "~lib/i18n"

marked.setOptions({ breaks: true, gfm: true })

type MdAction = "bold" | "italic" | "heading" | "ul" | "ol" | "quote"

const TOOLBAR: { action: MdAction; icon: string; label: string }[] = [
  { action: "bold", icon: "B", label: "Bold" },
  { action: "italic", icon: "I", label: "Italic" },
  { action: "heading", icon: "H", label: "Heading" },
  { action: "ul", icon: "\u2022", label: "List" },
  { action: "ol", icon: "1.", label: "Numbered" },
  { action: "quote", icon: ">", label: "Quote" },
]

function applyMarkdown(ta: HTMLTextAreaElement, action: MdAction, setText: (v: string) => void) {
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const text = ta.value
  const selected = text.slice(start, end)

  // Helper: toggle inline wrap (e.g. ** for bold, _ for italic)
  function toggleInline(marker: string, placeholder: string) {
    const mLen = marker.length
    // Check if selection is already wrapped
    if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= mLen * 2) {
      // Unwrap: remove markers from selection
      const inner = selected.slice(mLen, -mLen)
      apply(inner, inner.length)
      return
    }
    // Check if surrounding text has markers (cursor inside or selection within markers)
    const before = text.slice(Math.max(0, start - mLen), start)
    const after = text.slice(end, end + mLen)
    if (before === marker && after === marker) {
      // Unwrap: remove surrounding markers
      const newText = text.slice(0, start - mLen) + selected + text.slice(end + mLen)
      setText(newText)
      requestAnimationFrame(() => {
        ta.focus()
        ta.setSelectionRange(start - mLen, end - mLen)
      })
      return
    }
    // Wrap
    if (selected) {
      apply(`${marker}${selected}${marker}`, selected.length + mLen * 2)
    } else {
      apply(`${marker}${placeholder}${marker}`, mLen)
    }
  }

  // Helper: toggle line prefix (e.g. "- " for ul, "> " for quote)
  function toggleLinePrefix(prefix: string | ((i: number) => string), placeholder: string) {
    const getPrefix = typeof prefix === "string" ? () => prefix : prefix
    if (selected) {
      const lines = selected.split("\n")
      // Check if all lines already have the prefix → remove
      const allPrefixed = lines.every((l, i) => l.startsWith(getPrefix(i)))
      if (allPrefixed) {
        const stripped = lines.map((l, i) => l.slice(getPrefix(i).length)).join("\n")
        apply(stripped, stripped.length)
      } else {
        const prefixed = lines.map((l, i) => `${getPrefix(i)}${l}`).join("\n")
        apply(prefixed, prefixed.length)
      }
    } else {
      const p = getPrefix(0)
      apply(`${p}${placeholder}`, p.length)
    }
  }

  // Helper: apply replacement and position cursor
  function apply(replacement: string, cursorOffset: number) {
    const newText = text.slice(0, start) + replacement + text.slice(end)
    setText(newText)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + cursorOffset
      ta.setSelectionRange(pos, pos)
    })
  }

  switch (action) {
    case "bold":
      toggleInline("**", "bold")
      break
    case "italic":
      toggleInline("_", "italic")
      break
    case "heading": {
      // Toggle: if line starts with ## remove it, otherwise add it
      // Find start of current line
      const lineStart = text.lastIndexOf("\n", start - 1) + 1
      const lineEnd = text.indexOf("\n", end)
      const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
      if (line.startsWith("## ")) {
        const newLine = line.slice(3)
        const newText = text.slice(0, lineStart) + newLine + text.slice(lineEnd === -1 ? text.length : lineEnd)
        setText(newText)
        requestAnimationFrame(() => {
          ta.focus()
          ta.setSelectionRange(Math.max(lineStart, start - 3), Math.max(lineStart, end - 3))
        })
      } else {
        const newLine = `## ${line}`
        const newText = text.slice(0, lineStart) + newLine + text.slice(lineEnd === -1 ? text.length : lineEnd)
        setText(newText)
        requestAnimationFrame(() => {
          ta.focus()
          ta.setSelectionRange(start + 3, end + 3)
        })
      }
      break
    }
    case "ul":
      toggleLinePrefix("- ", "item")
      break
    case "ol":
      toggleLinePrefix((i) => `${i + 1}. `, "item")
      break
    case "quote":
      toggleLinePrefix("> ", "quote")
      break
  }
}

function EditorPage() {
  const [content, setContent] = useState("")
  const [title, setTitle] = useState("")
  const [notebookId, setNotebookId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [previewMode, setPreviewMode] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const renderedHtml = useMemo(() => {
    if (!previewMode) return ""
    return marked.parse(content) as string
  }, [content, previewMode])

  useEffect(() => {
    initTheme()
    chrome.storage.session.get(["editorContent", "editorTitle", "currentNotebook"]).then((data) => {
      setContent(data.editorContent ?? "")
      setTitle(data.editorTitle ?? "")
      setNotebookId(data.currentNotebook ?? null)
    })
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    if (previewMode) return
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 500)}px`
  }, [content, previewMode])

  const handleToolbar = useCallback((action: MdAction) => {
    if (!textareaRef.current || previewMode) return
    applyMarkdown(textareaRef.current, action, setContent)
  }, [previewMode])

  const handleSubmit = useCallback(async () => {
    if (!content.trim() || !notebookId || loading) return
    setLoading(true)
    setStatus(t("ingest_ingesting"))
    try {
      await bgSend({
        type: "NOTEBOOKLM_INGEST",
        text: content,
        title: title || "Untitled",
        notebookId,
      })
      setStatus(t("ingest_sent"))
      setTimeout(() => window.close(), 1000)
    } catch (err) {
      setStatus(String(err))
    } finally {
      setLoading(false)
    }
  }, [content, title, notebookId, loading])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "4px 12px",
    background: active ? "var(--accent)" : "transparent",
    color: active ? "var(--accent-text)" : "var(--text-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
  })

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
        <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{t("editor_modal_title")}</h1>
      </div>

      {/* Editable region — wrapped so overlay can cover it while submitting */}
      <div
        style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
        aria-busy={loading}
      >
        {/* Title input */}
        <div style={{ padding: "8px 16px 0" }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("editor_title_placeholder")}
            disabled={loading}
            style={{
              width: "100%",
              padding: "6px 10px",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Toolbar + preview toggle */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 16px",
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", gap: 3 }}>
            {TOOLBAR.map((btn) => {
              const disabled = previewMode || loading
              return (
                <button
                  key={btn.action}
                  onClick={() => handleToolbar(btn.action)}
                  title={btn.label}
                  disabled={disabled}
                  style={{
                    padding: "4px 10px",
                    background: "transparent",
                    color: disabled ? "var(--text-disabled)" : "var(--text-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    cursor: disabled ? "default" : "pointer",
                    fontSize: 13,
                    fontWeight: btn.action === "bold" ? 700 : btn.action === "italic" ? 400 : 500,
                    fontStyle: btn.action === "italic" ? "italic" : "normal",
                    opacity: disabled ? 0.4 : 1,
                  }}
                >
                  {btn.icon}
                </button>
              )
            })}
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            <button onClick={() => setPreviewMode(false)} disabled={loading} style={toggleBtnStyle(!previewMode)}>
              Edit
            </button>
            <button onClick={() => setPreviewMode(true)} disabled={loading} style={toggleBtnStyle(previewMode)}>
              Preview
            </button>
          </div>
        </div>

        {/* Editor / Preview */}
        <div style={{ flex: 1, overflow: "auto", padding: "8px 16px 16px" }} onKeyDown={handleKeyDown}>
          {previewMode ? (
            <div
              className="md-preview"
              style={{
                padding: 12,
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 14,
                lineHeight: 1.7,
                minHeight: 200,
              }}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          ) : (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("editor_content_placeholder")}
              disabled={loading}
              readOnly={loading}
              style={{
                width: "100%",
                minHeight: 200,
                padding: 12,
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 14,
                fontFamily: "'SF Mono', Menlo, monospace",
                lineHeight: 1.6,
                resize: "none",
                boxSizing: "border-box",
              }}
            />
          )}
        </div>

        {/* Overlay while submitting — blocks all interaction with the editable region */}
        {loading && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--overlay, rgba(0,0,0,0.55))",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              zIndex: 10,
              cursor: "wait",
            }}
          >
            <Loader2
              size={28}
              color="var(--accent)"
              style={{ animation: "editor-spin 1s linear infinite" }}
            />
            <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
              {status || t("ingest_ingesting")}
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: "10px 16px",
        borderTop: "1px solid var(--border)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {status || `${content.length} chars \u00B7 Cmd+Enter ${t("editor_submit_hint")}`}
        </span>
        <button
          onClick={handleSubmit}
          disabled={loading || !content.trim() || !notebookId}
          style={{
            padding: "8px 20px",
            background: "var(--accent)",
            color: "var(--accent-text)",
            border: "none",
            borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 500,
            opacity: loading || !content.trim() || !notebookId ? 0.5 : 1,
          }}
        >
          {loading ? t("ingest_ingesting") : t("ingest_send_btn")}
        </button>
      </div>

      <style>{previewCSS}</style>
    </div>
  )
}

const previewCSS = `
@keyframes editor-spin { to { transform: rotate(360deg); } }
.md-preview p { margin: 0 0 8px; }
.md-preview p:last-child { margin-bottom: 0; }
.md-preview h1 { font-size: 20px; font-weight: 700; margin: 16px 0 8px; border-bottom: 1px solid var(--border); padding-bottom: 4px; }
.md-preview h2 { font-size: 18px; font-weight: 600; margin: 14px 0 6px; }
.md-preview h3 { font-size: 16px; font-weight: 600; margin: 12px 0 4px; }
.md-preview h4 { font-size: 15px; font-weight: 600; margin: 10px 0 4px; }
.md-preview ul, .md-preview ol { margin: 6px 0; padding-left: 20px; }
.md-preview li { margin: 3px 0; }
.md-preview code { background: var(--bg-tertiary); padding: 2px 5px; border-radius: 3px; font-size: 13px; font-family: "SF Mono", Menlo, monospace; }
.md-preview pre { background: var(--bg-tertiary); padding: 10px 12px; border-radius: 6px; overflow-x: auto; margin: 8px 0; }
.md-preview pre code { background: none; padding: 0; font-size: 13px; }
.md-preview blockquote { border-left: 3px solid var(--accent); margin: 8px 0; padding: 4px 12px; color: var(--text-secondary); background: var(--bg-tertiary); border-radius: 0 4px 4px 0; }
.md-preview a { color: var(--accent); text-decoration: underline; }
.md-preview img { max-width: 100%; border-radius: 6px; margin: 6px 0; }
.md-preview table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 13px; }
.md-preview th, .md-preview td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; }
.md-preview th { background: var(--bg-tertiary); font-weight: 600; }
.md-preview strong { color: var(--text-primary); }
.md-preview hr { border: none; border-top: 1px solid var(--border); margin: 12px 0; }
`

export default EditorPage
