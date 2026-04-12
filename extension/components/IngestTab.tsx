import React, { useState, useEffect, useCallback, useRef } from "react"
import { bgSend } from "~lib/messaging"
import { addToHistory, getHistory, type IngestRecord } from "~lib/history"
import type { PageContent } from "~lib/types"

const ACCEPTED_TYPES = ".txt,.md,.csv,.json,.html,.xml,.log"

interface Props {
  currentNotebook: string | null
}

export function IngestTab({ currentNotebook }: Props) {
  const [pageContent, setPageContent] = useState<PageContent | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("選擇 Notebook → 吸取頁面 → 發送")
  const [urlInput, setUrlInput] = useState("")
  const [urlMode, setUrlMode] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [history, setHistory] = useState<IngestRecord[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getHistory().then(setHistory)
  }, [])

  async function recordIngest(title: string, url?: string) {
    if (!currentNotebook) return
    await addToHistory({ title, url, notebookId: currentNotebook })
    setHistory(await getHistory())
  }

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
      await recordIngest(urlInput.trim(), urlInput.trim())
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
      const text = pageContent.selectedText || pageContent.fullText
      if (text) {
        await bgSend({
          type: "NOTEBOOKLM_INGEST",
          text,
          title: pageContent.title,
          notebookId: currentNotebook,
        })
      } else {
        await bgSend({
          type: "NOTEBOOKLM_INGEST",
          url: pageContent.url,
          notebookId: currentNotebook,
        })
      }
      setStatus("已發送至 NotebookLM")
      await recordIngest(pageContent.title, pageContent.url)
      setPageContent(null)
    } catch (err) {
      setStatus(`攝入失敗: ${err}`)
    } finally {
      setLoading(false)
    }
  }, [pageContent, currentNotebook])

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (!currentNotebook) {
      setStatus("請先選擇 Notebook")
      return
    }
    const file = files[0]
    setLoading(true)
    setStatus(`讀取 ${file.name}...`)
    try {
      const text = await file.text()
      await bgSend({
        type: "NOTEBOOKLM_INGEST",
        text,
        title: file.name,
        notebookId: currentNotebook,
      })
      setStatus(`已發送「${file.name}」至 NotebookLM`)
      await recordIngest(file.name)
    } catch (err) {
      setStatus(`上傳失敗: ${err}`)
    } finally {
      setLoading(false)
      setDragging(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [currentNotebook])

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
          {loading ? "處理中..." : "吸取當前頁面"}
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

      {/* File upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFileUpload(e.dataTransfer.files) }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: "12px 10px",
          border: dragging ? "2px dashed #e94560" : "2px dashed #2a2a4a",
          borderRadius: 8,
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "#e9456010" : "transparent",
          transition: "all 0.2s",
        }}
      >
        <div style={{ fontSize: 12, color: dragging ? "#e94560" : "#666" }}>
          拖放檔案至此 或 點擊選擇
        </div>
        <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>
          支援 .txt .md .csv .json .html
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          style={{ display: "none" }}
          onChange={(e) => handleFileUpload(e.target.files)}
        />
      </div>

      {/* Page preview */}
      {pageContent && (
        <div style={{
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
      <div style={{ fontSize: 11, color: "#888", textAlign: "center" }}>
        {status}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div style={{ marginTop: "auto" }}>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
            最近攝入
          </div>
          <div style={{
            maxHeight: 120,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}>
            {history.slice(0, 10).map((r) => (
              <div key={r.id} style={{
                fontSize: 11,
                color: "#888",
                padding: "3px 6px",
                background: "#16213e",
                borderRadius: 4,
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
              }}>
                <span style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}>
                  {r.title}
                </span>
                <span style={{ color: "#555", flexShrink: 0 }}>
                  {formatTime(r.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })
  }
  return d.toLocaleDateString("zh-TW", { month: "short", day: "numeric" })
}
