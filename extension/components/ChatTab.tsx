import React, { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { marked } from "marked"
import { bgSend } from "~lib/messaging"
import { startSpeechRecognition, isSpeechSupported } from "~lib/speech"
import type { ChatMessage } from "~lib/types"

// Configure marked for safe output
marked.setOptions({
  breaks: true,
  gfm: true,
})

interface Props {
  currentNotebook: string | null
}

export function ChatTab({ currentNotebook }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const stopRecRef = useRef<(() => void) | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return
    if (!currentNotebook) {
      setError("請先選擇 Notebook")
      return
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)
    setError(null)

    try {
      const result = await bgSend<{ response: string; error?: string }>({
        type: "NOTEBOOKLM_CHAT",
        message: userMsg.content,
        notebookId: currentNotebook,
      })
      if (result.error) {
        setError(result.error)
      } else {
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: result.response || "（無回覆）",
        }
        setMessages((prev) => [...prev, assistantMsg])
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [input, loading, currentNotebook])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
      {/* Messages */}
      <div style={{
        flex: 1,
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "4px 0",
      }}>
        {messages.length === 0 && (
          <p style={{ color: "#666", fontSize: 13, textAlign: "center", marginTop: 40 }}>
            選擇 Notebook 後開始對話
          </p>
        )}
        {messages.map((msg) =>
          msg.role === "user" ? (
            <div key={msg.id} style={userBubbleStyle}>
              {msg.content}
            </div>
          ) : (
            <MarkdownBubble key={msg.id} content={msg.content} />
          )
        )}
        {loading && (
          <div style={{ ...assistantBubbleStyle, color: "#aaa" }}>
            思考中...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div style={{ color: "#f07070", fontSize: 11 }}>{error}</div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend() }}
        style={{ display: "flex", gap: 4 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={recording ? "聆聽中..." : "輸入訊息..."}
          disabled={loading}
          style={{
            flex: 1,
            padding: 10,
            background: "#0f3460",
            color: "#eee",
            border: recording ? "1px solid #e94560" : "1px solid #533483",
            borderRadius: 6,
            fontSize: 13,
          }}
        />
        {isSpeechSupported() && (
          <button
            type="button"
            onClick={() => {
              if (recording) {
                stopRecRef.current?.()
                stopRecRef.current = null
                setRecording(false)
              } else {
                setRecording(true)
                stopRecRef.current = startSpeechRecognition({
                  onResult: (t) => setInput(t),
                  onEnd: () => setRecording(false),
                  onError: () => setRecording(false),
                })
              }
            }}
            style={{
              padding: "8px 10px",
              background: recording ? "#e94560" : "#0f3460",
              color: recording ? "#fff" : "#888",
              border: "1px solid #533483",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
            }}
            title={recording ? "停止錄音" : "語音輸入"}
          >
            {recording ? "■" : "🎤"}
          </button>
        )}
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: "10px 14px",
            background: "#e94560",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          傳送
        </button>
      </form>

      {/* Markdown styles for assistant bubbles */}
      <style>{markdownCSS}</style>
    </div>
  )
}

function MarkdownBubble({ content }: { content: string }) {
  const html = useMemo(() => marked.parse(content) as string, [content])
  return (
    <div
      style={assistantBubbleStyle}
      className="md-bubble"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

const userBubbleStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  background: "#e94560",
  color: "#fff",
  alignSelf: "flex-end",
  maxWidth: "85%",
  fontSize: 13,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
}

const assistantBubbleStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  background: "#0f3460",
  color: "#ddd",
  alignSelf: "flex-start",
  maxWidth: "90%",
  fontSize: 13,
  wordBreak: "break-word",
}

const markdownCSS = `
.md-bubble p { margin: 0 0 6px; line-height: 1.5; }
.md-bubble p:last-child { margin-bottom: 0; }
.md-bubble h1, .md-bubble h2, .md-bubble h3 {
  margin: 8px 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}
.md-bubble h1 { font-size: 16px; }
.md-bubble h2 { font-size: 15px; }
.md-bubble ul, .md-bubble ol {
  margin: 4px 0;
  padding-left: 18px;
}
.md-bubble li { margin: 2px 0; }
.md-bubble code {
  background: #1a1a2e;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
  font-family: "SF Mono", Menlo, monospace;
  color: #e0e0e0;
}
.md-bubble pre {
  background: #1a1a2e;
  padding: 8px 10px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 6px 0;
}
.md-bubble pre code {
  background: none;
  padding: 0;
  font-size: 12px;
}
.md-bubble a {
  color: #e94560;
  text-decoration: underline;
}
.md-bubble blockquote {
  border-left: 3px solid #533483;
  margin: 6px 0;
  padding: 2px 10px;
  color: #aaa;
}
.md-bubble table {
  border-collapse: collapse;
  margin: 6px 0;
  font-size: 12px;
  width: 100%;
}
.md-bubble th, .md-bubble td {
  border: 1px solid #2a2a4a;
  padding: 4px 8px;
  text-align: left;
}
.md-bubble th {
  background: #1a1a2e;
  color: #aaa;
  font-weight: 600;
}
.md-bubble strong { color: #fff; }
.md-bubble hr {
  border: none;
  border-top: 1px solid #2a2a4a;
  margin: 8px 0;
}
`
