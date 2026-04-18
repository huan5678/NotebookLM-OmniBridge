import React, { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { marked } from "marked"
import { Mic, Square, ArrowUp, Copy, Check, Plus } from "lucide-react"
import "~style.css"
import { initTheme } from "~lib/theme"
import { bgSend } from "~lib/messaging"
import { t } from "~lib/i18n"
import { startSpeechRecognition, isSpeechSupported } from "~lib/speech"
import type { ChatMessage, Notebook } from "~lib/types"

marked.setOptions({ breaks: true, gfm: true })

function ChatPage() {
  const [notebookId, setNotebookId] = useState<string | null>(null)
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState("")
  const [recording, setRecording] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const stopRecRef = useRef<(() => void) | null>(null)
  const inputBaseRef = useRef("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow textarea height based on content.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [inputValue])

  useEffect(() => {
    initTheme()
    // Default to the notebook currently selected in the side panel.
    chrome.storage.session.get(["currentNotebook"]).then((data) => {
      if (data.currentNotebook) setNotebookId(data.currentNotebook)
    })
    // Load notebook list for the switcher dropdown (independent per chat window).
    bgSend<{ notebooks: Notebook[] }>({ type: "NOTEBOOKLM_LIST" })
      .then((res) => setNotebooks(res.notebooks ?? []))
      .catch(() => {})
  }, [])

  const notebookTitle = useMemo(
    () => notebooks.find((n) => n.id === notebookId)?.title ?? "",
    [notebooks, notebookId]
  )

  const handleSwitchNotebook = useCallback((nextId: string) => {
    if (!nextId || nextId === notebookId) return
    if (messages.length > 0 && !window.confirm(t("chat_switch_confirm"))) return
    setNotebookId(nextId)
    setMessages([])
    setError(null)
  }, [notebookId, messages.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || !notebookId) return

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: text }
    setMessages((prev) => [...prev, userMsg])
    setInputValue("")
    setLoading(true)
    setError(null)

    try {
      const result = await bgSend<{ response: string; error?: string }>({
        type: "NOTEBOOKLM_CHAT",
        message: text,
        notebookId,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 1).toString(), role: "assistant", content: result.response || t("chat_no_reply") },
        ])
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [inputValue, notebookId])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Cmd/Ctrl+Enter submits; plain Enter inserts a newline (textarea default).
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  // Stop recognition when leaving the page.
  useEffect(() => () => stopRecRef.current?.(), [])

  const handleToggleVoice = useCallback(() => {
    if (recording) {
      stopRecRef.current?.()
      return
    }
    if (!isSpeechSupported()) {
      setError(t("chat_voice_unsupported"))
      return
    }
    setError(null)
    inputBaseRef.current = inputValue ? inputValue.replace(/\s*$/, " ") : ""
    const stop = startSpeechRecognition({
      lang: chrome.i18n.getUILanguage?.() || "zh-TW",
      onResult: (transcript) => {
        setInputValue(inputBaseRef.current + transcript)
      },
      onEnd: () => {
        setRecording(false)
        stopRecRef.current = null
      },
      onError: (err) => {
        setError(t("chat_voice_error", String(err)))
        setRecording(false)
        stopRecRef.current = null
      },
    })
    if (stop) {
      stopRecRef.current = stop
      setRecording(true)
    } else {
      setError(t("chat_voice_unsupported"))
    }
  }, [recording, inputValue])

  const handleAddSource = useCallback(async (content: string) => {
    if (!notebookId) return
    const sel = window.getSelection()?.toString().trim()
    const textToAdd = sel || content
    // Open editor window with this content
    await chrome.storage.session.set({
      editorContent: textToAdd,
      editorTitle: t("chat_add_source_title"),
    })
    chrome.windows.create({
      url: "tabs/editor.html",
      type: "popup",
      width: 560,
      height: 520,
    })
  }, [notebookId])

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
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}>
        <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0, flexShrink: 0 }}>
          {t("chat_float_title")}
        </h1>
        <select
          value={notebookId ?? ""}
          onChange={(e) => handleSwitchNotebook(e.target.value)}
          title={t("chat_switch_notebook")}
          style={{
            flex: 1,
            minWidth: 0,
            maxWidth: 320,
            padding: "6px 8px",
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          {!notebookId && (
            <option value="" disabled>
              {t("chat_no_notebook")}
            </option>
          )}
          {notebooks.length === 0 && notebookId && (
            <option value={notebookId}>{notebookTitle || notebookId}</option>
          )}
          {notebooks.map((nb) => (
            <option key={nb.id} value={nb.id}>
              {nb.title}
              {nb.is_owner ? "" : t("notebook_readonly")}
            </option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", marginTop: 60 }}>
            {notebookId ? t("chat_empty") : t("chat_no_notebook")}
          </p>
        )}
        {messages.map((msg) =>
          msg.role === "user" ? (
            <div key={msg.id} style={{
              alignSelf: "flex-end",
              maxWidth: "80%",
              padding: "8px 12px",
              borderRadius: 16,
              fontSize: 14,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "var(--accent)",
              color: "var(--accent-text)",
            }}>
              {msg.content}
            </div>
          ) : (
            <AssistantBubble key={msg.id} content={msg.content} onAddSource={handleAddSource} />
          )
        )}
        {loading && (
          <div style={{
            alignSelf: "flex-start",
            padding: "8px 12px",
            borderRadius: 16,
            fontSize: 14,
            background: "var(--bg-tertiary)",
            color: "var(--text-muted)",
          }}>
            {t("chat_thinking")}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "4px 12px", fontSize: 12, color: "var(--error-text)" }}>{error}</div>
      )}

      {/* Input */}
      <div style={{ padding: 10, borderTop: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={recording ? t("chat_voice_stop") : t("chat_placeholder_multiline")}
          rows={3}
          style={{
            flex: 1,
            padding: "10px 12px",
            minHeight: 72,
            maxHeight: 200,
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            border: recording ? "1px solid var(--error-text)" : "1px solid var(--border)",
            borderRadius: 10,
            fontSize: 14,
            resize: "none",
            overflowY: "auto",
            fontFamily: "system-ui, sans-serif",
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={handleToggleVoice}
          title={recording ? t("chat_voice_stop") : t("chat_voice_start")}
          aria-label={recording ? t("chat_voice_stop") : t("chat_voice_start")}
          aria-pressed={recording}
          style={{
            width: 40,
            height: 40,
            padding: 0,
            background: recording ? "var(--error-text)" : "transparent",
            color: recording ? "#fff" : "var(--text-muted)",
            border: `1px solid ${recording ? "var(--error-text)" : "var(--border)"}`,
            borderRadius: 10,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {recording ? <Square size={18} fill="currentColor" /> : <Mic size={18} />}
        </button>
        <button
          onClick={handleSend}
          disabled={loading || !inputValue.trim() || !notebookId}
          aria-label={t("chat_float_title")}
          style={{
            width: 40,
            height: 40,
            padding: 0,
            background: "var(--accent)",
            color: "var(--accent-text)",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: loading || !inputValue.trim() || !notebookId ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          <ArrowUp size={18} />
        </button>
      </div>

      <style>{markdownCSS}</style>
    </div>
  )
}

function AssistantBubble({ content, onAddSource }: { content: string; onAddSource: (text: string) => void }) {
  const html = useMemo(() => marked.parse(content) as string, [content])
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard permissions may be denied in the popup context; ignore silently.
    }
  }, [content])

  return (
    <div style={{ alignSelf: "flex-start", maxWidth: "85%" }}>
      <div
        className="md-bubble"
        style={{
          padding: "8px 12px",
          borderRadius: 16,
          fontSize: 14,
          wordBreak: "break-word",
          background: "var(--bg-tertiary)",
          color: "var(--text-primary)",
          lineHeight: 1.6,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button
          onClick={handleCopy}
          title={copied ? t("chat_copied") : t("chat_copy")}
          aria-label={copied ? t("chat_copied") : t("chat_copy")}
          style={msgActionBtnStyle(copied)}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? t("chat_copied") : t("chat_copy")}</span>
        </button>
        <button
          onClick={() => onAddSource(content)}
          title={t("chat_add_source")}
          aria-label={t("chat_add_source")}
          style={msgActionBtnStyle(false)}
        >
          <Plus size={12} />
          <span>{t("chat_add_source")}</span>
        </button>
      </div>
    </div>
  )
}

function msgActionBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 8px",
    background: "transparent",
    color: active ? "var(--success-text, #4ade80)" : "var(--text-muted)",
    border: `1px solid ${active ? "var(--success-text, #4ade80)" : "var(--border)"}`,
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 11,
    lineHeight: 1,
  }
}

const markdownCSS = `
.md-bubble p { margin: 0 0 6px; line-height: 1.6; }
.md-bubble p:last-child { margin-bottom: 0; }
.md-bubble h1, .md-bubble h2, .md-bubble h3 { margin: 8px 0 4px; font-size: 15px; font-weight: 600; }
.md-bubble ul, .md-bubble ol { margin: 4px 0; padding-left: 18px; }
.md-bubble li { margin: 2px 0; }
.md-bubble code { background: var(--bg-secondary); padding: 1px 5px; border-radius: 3px; font-size: 12px; font-family: "SF Mono", Menlo, monospace; }
.md-bubble pre { background: var(--bg-secondary); padding: 8px 10px; border-radius: 6px; overflow-x: auto; margin: 6px 0; }
.md-bubble pre code { background: none; padding: 0; }
.md-bubble a { color: var(--accent); text-decoration: underline; }
.md-bubble blockquote { border-left: 3px solid var(--border-accent); margin: 6px 0; padding: 2px 10px; color: var(--text-secondary); }
.md-bubble strong { color: var(--text-primary); }
`

export default ChatPage
