import React, { useState, useCallback } from "react"
import { bgSend } from "~lib/messaging"
import type { PageContent } from "~lib/types"

interface Props {
  currentNotebook: string | null
}

export function IngestTab({ currentNotebook }: Props) {
  const [pageContent, setPageContent] = useState<PageContent | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("選擇 Notebook → 吸取頁面 → 發送")
  const [urlInput, setUrlInput] = useState("")
  const [urlMode, setUrlMode] = useState(false)

  const handleAbsorb = useCallback(async () => {
    setLoading(true)
    setStatus("吸取中...")
    try {
      const data = await bgSend<PageContent>({ type: "ABSORB_PAGE" })
      setPageContent(data)
      setStatus(
        data.selectedText
          ? `已取得選取文字 (${data.selectedText.length} 字)`
          : `已取得頁面內容 (${data.fullText.length} 字)`
      )
    } catch (err) {
      setStatus(`吸取失敗: ${err}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleIngestUrl = useCallback(async () => {
    if (!urlInput.trim()) return
    if (!currentNotebook) {
      setStatus("請先選擇 Notebook")
      return
    }
    setLoading(true)
    setStatus("攝入中...")
    try {
      await bgSend({
        type: "NOTEBOOKLM_INGEST",
        url: urlInput.trim(),
        notebookId: currentNotebook,
      })
      setStatus("已發送至 NotebookLM")
      setUrlInput("")
    } catch (err) {
      setStatus(`攝入失敗: ${err}`)
    } finally {
      setLoading(false)
    }
  }, [urlInput, currentNotebook])

  const handleIngestPage = useCallback(async () => {
    if (!pageContent) return
    if (!currentNotebook) {
      setStatus("請先選擇 Notebook")
      return
    }
    setLoading(true)
    setStatus("攝入中...")
    try {
      await bgSend({
        type: "NOTEBOOKLM_INGEST",
        url: pageContent.url,
        notebookId: currentNotebook,
      })
      setStatus("已發送至 NotebookLM")
    } catch (err) {
      setStatus(`攝入失敗: ${err}`)
    } finally {
      setLoading(false)
    }
  }, [pageContent, currentNotebook])

  const previewText = pageContent
    ? (pageContent.selectedText || pageContent.fullText)
    : ""

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
      {/* Action buttons */}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={handleAbsorb}
          disabled={loading}
          style={{
            flex: 1,
            padding: 8,
            background: "#e94560",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 13,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "吸取中..." : "吸取當前頁面"}
        </button>
        <button
          onClick={() => setUrlMode((v) => !v)}
          style={{
            padding: "8px 12px",
            background: "#0f3460",
            color: "#e94560",
            border: "1px solid #e94560",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          URL
        </button>
      </div>

      {/* URL input */}
      {urlMode && (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://..."
            style={{
              flex: 1,
              padding: 8,
              background: "#0f3460",
              color: "#eee",
              border: "1px solid #e94560",
              borderRadius: 6,
              fontSize: 13,
            }}
          />
          <button
            onClick={handleIngestUrl}
            disabled={loading || !urlInput.trim()}
            style={{
              padding: "8px 12px",
              background: "#e94560",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            攝入
          </button>
        </div>
      )}

      {/* Page preview */}
      {pageContent && (
        <div style={{
          flex: 1,
          overflow: "auto",
          background: "#0f3460",
          borderRadius: 8,
          padding: 10,
          border: "1px solid #533483",
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>
            {pageContent.title}
          </div>
          <div style={{
            fontSize: 12,
            color: "#ccc",
            whiteSpace: "pre-wrap",
            maxHeight: 180,
            overflow: "auto",
          }}>
            {previewText.slice(0, 2000)}
            {previewText.length > 2000 && "..."}
          </div>
          <button
            onClick={handleIngestPage}
            disabled={loading || !currentNotebook}
            style={{
              marginTop: 8,
              width: "100%",
              padding: 8,
              background: "#533483",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            發送至 NotebookLM
          </button>
        </div>
      )}

      {/* Status */}
      <div style={{ fontSize: 11, color: "#888", textAlign: "center", marginTop: "auto" }}>
        {status}
      </div>
    </div>
  )
}
