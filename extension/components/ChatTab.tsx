import React, { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { marked } from "marked"
import { bgSend } from "~lib/messaging"
import type { ChatMessage } from "~lib/types"
import { PromptInputBox } from "~components/ui/ai-prompt-box"

marked.setOptions({ breaks: true, gfm: true })

interface Props {
  currentNotebook: string | null
}

export function ChatTab({ currentNotebook }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = useCallback(async (text: string, files?: File[]) => {
    if (!text.trim() && (!files || files.length === 0)) return
    if (!currentNotebook) {
      setError("請先選擇 Notebook")
      return
    }

    // If files attached, read and ingest them
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const content = await file.text()
          await bgSend({
            type: "NOTEBOOKLM_INGEST",
            text: content,
            title: file.name,
            notebookId: currentNotebook,
          })
        } catch {}
      }
    }

    if (!text.trim()) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
    }
    setMessages((prev) => [...prev, userMsg])
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
  }, [currentNotebook])

  return (
    <div className="flex flex-col gap-2 flex-1 min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-auto flex flex-col gap-2 py-1">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-10">
            選擇 Notebook 後開始對話
          </p>
        )}
        {messages.map((msg) =>
          msg.role === "user" ? (
            <div key={msg.id} className="self-end max-w-[85%] px-3 py-2 rounded-2xl bg-[#e94560] text-white text-sm whitespace-pre-wrap break-words">
              {msg.content}
            </div>
          ) : (
            <MarkdownBubble key={msg.id} content={msg.content} />
          )
        )}
        {loading && (
          <div className="self-start max-w-[90%] px-3 py-2 rounded-2xl bg-[#0f3460] text-gray-400 text-sm">
            <span className="animate-pulse">思考中...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="text-red-400 text-xs px-1">{error}</div>
      )}

      {/* Prompt Input */}
      <PromptInputBox
        onSend={handleSend}
        isLoading={loading}
        placeholder="輸入訊息..."
      />

      <style>{markdownCSS}</style>
    </div>
  )
}

function MarkdownBubble({ content }: { content: string }) {
  const html = useMemo(() => marked.parse(content) as string, [content])
  return (
    <div
      className="md-bubble self-start max-w-[90%] px-3 py-2 rounded-2xl bg-[#0f3460] text-gray-200 text-sm break-words"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
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
