import React, { useState, useRef, useCallback, useEffect } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { t } from "~lib/i18n"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  initialContent: string
  onSubmit: (content: string, title: string) => void
  loading?: boolean
}

type MdAction = "bold" | "italic" | "heading" | "ul" | "ol" | "quote"

const TOOLBAR: { action: MdAction; icon: string; label: string }[] = [
  { action: "bold", icon: "B", label: "Bold" },
  { action: "italic", icon: "I", label: "Italic" },
  { action: "heading", icon: "H", label: "Heading" },
  { action: "ul", icon: "\u2022", label: "List" },
  { action: "ol", icon: "1.", label: "Numbered" },
  { action: "quote", icon: ">", label: "Quote" },
]

function applyMarkdown(
  textarea: HTMLTextAreaElement,
  action: MdAction,
  setText: (v: string) => void,
) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const text = textarea.value
  const selected = text.slice(start, end)
  let replacement = ""
  let cursorOffset = 0

  switch (action) {
    case "bold":
      replacement = `**${selected || t("editor_bold_placeholder")}**`
      cursorOffset = selected ? replacement.length : 2
      break
    case "italic":
      replacement = `_${selected || t("editor_italic_placeholder")}_`
      cursorOffset = selected ? replacement.length : 1
      break
    case "heading":
      replacement = `\n## ${selected || t("editor_heading_placeholder")}`
      cursorOffset = replacement.length
      break
    case "ul":
      replacement = selected
        ? selected.split("\n").map((l) => `- ${l}`).join("\n")
        : `- ${t("editor_list_placeholder")}`
      cursorOffset = replacement.length
      break
    case "ol":
      replacement = selected
        ? selected.split("\n").map((l, i) => `${i + 1}. ${l}`).join("\n")
        : `1. ${t("editor_list_placeholder")}`
      cursorOffset = replacement.length
      break
    case "quote":
      replacement = selected
        ? selected.split("\n").map((l) => `> ${l}`).join("\n")
        : `> ${t("editor_quote_placeholder")}`
      cursorOffset = replacement.length
      break
  }

  const newText = text.slice(0, start) + replacement + text.slice(end)
  setText(newText)

  requestAnimationFrame(() => {
    textarea.focus()
    const pos = start + cursorOffset
    textarea.setSelectionRange(pos, pos)
  })
}

export function IngestEditorModal({ open, onOpenChange, title: initialTitle, initialContent, onSubmit, loading }: Props) {
  const [content, setContent] = useState(initialContent)
  const [title, setTitle] = useState(initialTitle)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync when props change
  useEffect(() => {
    if (open) {
      setContent(initialContent)
      setTitle(initialTitle)
    }
  }, [open, initialContent, initialTitle])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 400)}px`
  }, [content])

  const handleToolbar = useCallback((action: MdAction) => {
    if (!textareaRef.current) return
    applyMarkdown(textareaRef.current, action, setContent)
  }, [])

  const handleSubmit = useCallback(() => {
    if (!content.trim() || loading) return
    onSubmit(content, title)
  }, [content, title, loading, onSubmit])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--overlay)",
            zIndex: 1000,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          onKeyDown={handleKeyDown}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(95vw, 560px)",
            maxHeight: "85vh",
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 0,
            zIndex: 1001,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <Dialog.Title
              style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}
            >
              {t("editor_modal_title")}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: 18,
                  cursor: "pointer",
                  lineHeight: 1,
                  padding: "0 4px",
                }}
              >
                x
              </button>
            </Dialog.Close>
          </div>

          {/* Title input */}
          <div style={{ padding: "8px 16px 0" }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("editor_title_placeholder")}
              style={{
                width: "100%",
                padding: "6px 8px",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 500,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Toolbar */}
          <div
            style={{
              display: "flex",
              gap: 2,
              padding: "6px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {TOOLBAR.map((btn) => (
              <button
                key={btn.action}
                onClick={() => handleToolbar(btn.action)}
                title={btn.label}
                style={{
                  padding: "3px 8px",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: btn.action === "bold" ? 700 : btn.action === "italic" ? 400 : 500,
                  fontStyle: btn.action === "italic" ? "italic" : "normal",
                  fontFamily: "system-ui, sans-serif",
                  lineHeight: 1.2,
                }}
              >
                {btn.icon}
              </button>
            ))}
          </div>

          {/* Editor */}
          <div style={{ flex: 1, overflow: "auto", padding: "8px 16px 16px" }}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("editor_content_placeholder")}
              style={{
                width: "100%",
                minHeight: 200,
                padding: 10,
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 13,
                fontFamily: "'SF Mono', Menlo, monospace",
                lineHeight: 1.6,
                resize: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "10px 16px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {t("editor_char_count", String(content.length))}
              {" \u00B7 Cmd+Enter "}
              {t("editor_submit_hint")}
            </span>
            <button
              onClick={handleSubmit}
              disabled={loading || !content.trim()}
              style={{
                padding: "6px 16px",
                background: "var(--accent)",
                color: "var(--accent-text)",
                border: "none",
                borderRadius: 6,
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: 13,
                fontWeight: 500,
                opacity: loading || !content.trim() ? 0.6 : 1,
              }}
            >
              {loading ? t("ingest_ingesting") : t("ingest_send_btn")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
