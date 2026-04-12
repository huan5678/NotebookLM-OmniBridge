import React, { useState, useCallback, useRef, useEffect } from "react"
import { bgSend } from "~lib/messaging"
import type { ChatMessage } from "~lib/types"

interface Props {
  currentNotebook: string | null
}

export function ChatTab({ currentNotebook }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: msg.role === "user" ? "#e94560" : "#0f3460",
              color: "#fff",
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              fontSize: 13,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div style={{
            padding: "8px 12px",
            borderRadius: 8,
            background: "#0f3460",
            color: "#aaa",
            fontSize: 13,
          }}>
            思考中...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div style={{ color: "#f07070", fontSize: 11 }}>
          {error}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
        style={{ display: "flex", gap: 6 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="輸入訊息..."
          disabled={loading}
          style={{
            flex: 1,
            padding: 10,
            background: "#0f3460",
            color: "#eee",
            border: "1px solid #533483",
            borderRadius: 6,
            fontSize: 13,
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: "10px 16px",
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
    </div>
  )
}
