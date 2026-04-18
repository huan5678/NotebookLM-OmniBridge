import React, { useState, useEffect, useCallback, useRef } from "react"
import { X } from "lucide-react"
import { bgSend } from "~lib/messaging"
import { addToHistory, getHistory, removeFromHistory, type IngestRecord } from "~lib/history"
import { t } from "~lib/i18n"
import type { PageContent, IngestProgressMessage } from "~lib/types"
// Editor is now a popup window, not an inline modal

const ACCEPTED_TYPES = ".txt,.md,.csv,.json,.html,.xml,.log"

interface Props {
  currentNotebook: string | null
  onLoadingChange?: (loading: boolean) => void
}

export function IngestTab({ currentNotebook, onLoadingChange }: Props) {
  const [pageContent, setPageContent] = useState<PageContent | null>(null)
  const [loadingState, setLoadingState] = useState(false)
  const setLoading = useCallback((v: boolean) => {
    setLoadingState(v)
    onLoadingChange?.(v)
  }, [onLoadingChange])
  const [status, setStatus] = useState(t("ingest_status_default"))
  const [urlInput, setUrlInput] = useState("")
  const [urlMode, setUrlMode] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [history, setHistory] = useState<IngestRecord[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Progress bar state
  const [ingestStep, setIngestStep] = useState(0)
  const [ingestError, setIngestError] = useState<string | null>(null)

  // Open editor as popup window
  const openEditor = useCallback(async (content: string, title: string) => {
    await chrome.storage.session.set({ editorContent: content, editorTitle: title })
    chrome.windows.create({ url: "tabs/editor.html", type: "popup", width: 560, height: 520 })
  }, [])

  useEffect(() => {
    getHistory().then(setHistory)
  }, [])

  // Listen for progress updates from background
  useEffect(() => {
    const handler = (msg: IngestProgressMessage) => {
      if (msg.type !== "NOTEBOOKLM_INGEST_PROGRESS") return
      setIngestStep(msg.step)
      if (msg.error) {
        setIngestError(msg.error)
        return
      }
      setIngestError(null)
      // Ingest succeeded (broadcast fires for sidebar ingests and editor-popup ingests alike).
      // Drop the absorbed page preview so the card disappears from the sidebar.
      if (msg.step === 4 && msg.done) {
        setPageContent(null)
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  async function recordIngest(title: string, url?: string) {
    if (!currentNotebook) return
    await addToHistory({ title, url, notebookId: currentNotebook })
    setHistory(await getHistory())
  }

  const handleDeleteHistory = useCallback(async (id: string) => {
    await removeFromHistory(id)
    setHistory(await getHistory())
  }, [])

  function resetProgress() {
    setIngestStep(0)
    setIngestError(null)
  }

  const handleAbsorb = useCallback(async () => {
    setLoading(true)
    setStatus(t("ingest_absorbing"))
    try {
      const data = await bgSend<PageContent>({ type: "ABSORB_PAGE" })
      setPageContent(data)
      setStatus(
        data.selectedText
          ? t("ingest_absorbed_selection", String(data.selectedText.length))
          : t("ingest_absorbed_page", String(data.fullText.length))
      )
    } catch (err) {
      setStatus(t("ingest_absorb_failed", String(err)))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleIngestUrl = useCallback(async () => {
    if (!urlInput.trim()) return
    if (!currentNotebook) {
      setStatus(t("ingest_no_notebook"))
      return
    }
    setLoading(true)
    resetProgress()
    setStatus(t("ingest_ingesting"))
    try {
      await bgSend({
        type: "NOTEBOOKLM_INGEST",
        url: urlInput.trim(),
        notebookId: currentNotebook,
      })
      setStatus(t("ingest_sent"))
      await recordIngest(urlInput.trim(), urlInput.trim())
      setUrlInput("")
    } catch (err) {
      setStatus(t("ingest_ingest_failed", String(err)))
    } finally {
      setLoading(false)
    }
  }, [urlInput, currentNotebook])

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (!currentNotebook) {
      setStatus(t("ingest_no_notebook"))
      return
    }
    const file = files[0]
    setLoading(true)
    resetProgress()
    setStatus(t("ingest_reading_file", file.name))
    try {
      const text = await file.text()
      await bgSend({
        type: "NOTEBOOKLM_INGEST",
        text,
        title: file.name,
        notebookId: currentNotebook,
      })
      setStatus(t("ingest_file_sent", file.name))
      await recordIngest(file.name)
    } catch (err) {
      setStatus(t("ingest_upload_failed", String(err)))
    } finally {
      setLoading(false)
      setDragging(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [currentNotebook])

  // Content to show in preview / pass to editor
  const previewText = pageContent
    ? (pageContent.selectedText || pageContent.fullText)
    : ""

  const STEP_LABELS = [
    "",
    t("ingest_progress_prepare"),
    t("ingest_progress_send"),
    t("ingest_progress_processing"),
    t("ingest_progress_done"),
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
      {/* Action buttons */}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={handleAbsorb}
          disabled={loadingState}
          style={{
            flex: 1,
            padding: 8,
            background: "var(--accent)",
            color: "var(--accent-text)",
            border: "none",
            borderRadius: 6,
            cursor: loadingState ? "not-allowed" : "pointer",
            fontSize: 13,
            opacity: loadingState ? 0.6 : 1,
          }}
        >
          {loadingState ? t("ingest_processing") : t("ingest_absorb_btn")}
        </button>
        <button
          onClick={() => setUrlMode((v) => !v)}
          style={{
            padding: "8px 12px",
            background: "var(--bg-input)",
            color: "var(--accent)",
            border: "1px solid var(--accent)",
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
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-accent)",
              borderRadius: 6,
              fontSize: 13,
            }}
          />
          <button
            onClick={handleIngestUrl}
            disabled={loadingState || !urlInput.trim()}
            style={{
              padding: "8px 12px",
              background: "var(--accent)",
              color: "var(--accent-text)",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {t("ingest_ingest_btn")}
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
          border: dragging ? "2px dashed var(--accent)" : "2px dashed var(--border)",
          borderRadius: 8,
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "var(--bg-tertiary)" : "transparent",
          transition: "all 0.2s",
        }}
      >
        <div style={{ fontSize: 12, color: dragging ? "var(--accent)" : "var(--text-muted)" }}>
          {t("ingest_drop_zone")}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-disabled)", marginTop: 2 }}>
          {t("ingest_drop_zone_hint")}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          style={{ display: "none" }}
          onChange={(e) => handleFileUpload(e.target.files)}
        />
      </div>

      {/* Page preview — compact, click to edit in modal */}
      {pageContent && (
        <div
          style={{
            overflow: "hidden",
            background: "var(--bg-secondary)",
            borderRadius: 8,
            padding: 10,
            border: "1px solid var(--border)",
            cursor: "pointer",
          }}
          onClick={() => openEditor(previewText, pageContent?.title ?? "")}
        >
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 6,
            marginBottom: 4,
          }}>
            <span style={{
              flex: 1,
              minWidth: 0,
              fontSize: 12,
              color: "var(--text-primary)",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {pageContent.title}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); openEditor(previewText, pageContent?.title ?? "") }}
              style={{
                padding: "2px 8px",
                background: "var(--accent)",
                color: "var(--accent-text)",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              {t("editor_edit_btn")}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setPageContent(null); setStatus(t("ingest_status_default")) }}
              title={t("ingest_dismiss_preview")}
              aria-label={t("ingest_dismiss_preview")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 22,
                height: 22,
                padding: 0,
                background: "transparent",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <X size={12} />
            </button>
          </div>
          {pageContent.selectedText && (
            <div style={{
              fontSize: 10,
              color: "var(--accent)",
              marginBottom: 4,
            }}>
              {t("ingest_absorbed_selection", String(pageContent.selectedText.length))}
            </div>
          )}
          <div style={{
            fontSize: 11,
            color: "var(--text-secondary)",
            whiteSpace: "pre-wrap",
            maxHeight: 80,
            overflow: "hidden",
            lineHeight: 1.4,
          }}>
            {previewText.slice(0, 300)}
            {previewText.length > 300 && "..."}
          </div>
        </div>
      )}

      {/* Progress bar */}
      {loadingState && ingestStep > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 6, justifyContent: "center" }}>
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: ingestStep >= s
                    ? (ingestError ? "var(--error-text)" : "var(--accent)")
                    : "var(--border)",
                  transition: "background 0.3s ease",
                }}
              />
            ))}
          </div>
          <div style={{
            fontSize: 11,
            color: ingestError ? "var(--error-text)" : "var(--accent)",
            textAlign: "center",
            transition: "color 0.2s",
          }}>
            {ingestError
              ? t("ingest_progress_failed", ingestError)
              : (STEP_LABELS[ingestStep] || t("ingest_progress_prepare"))}
          </div>
          <div style={{
            marginTop: 6,
            height: 3,
            background: "var(--border)",
            borderRadius: 2,
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${(Math.max(0, ingestStep) / 4) * 100}%`,
              background: ingestError ? "var(--error-text)" : "var(--accent)",
              borderRadius: 2,
              transition: "width 0.4s ease",
            }} />
          </div>
        </div>
      )}

      {/* Status */}
      {!loadingState && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
          {status}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div style={{ marginTop: "auto" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
            {t("ingest_history_label")}
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
                color: "var(--text-secondary)",
                padding: "3px 6px",
                background: "var(--bg-secondary)",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
                <span style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}>
                  {r.title}
                </span>
                <span style={{ color: "var(--text-disabled)", flexShrink: 0 }}>
                  {formatTime(r.timestamp)}
                </span>
                <button
                  onClick={() => handleDeleteHistory(r.id)}
                  title={t("ingest_history_remove")}
                  aria-label={t("ingest_history_remove")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 18,
                    height: 18,
                    padding: 0,
                    background: "transparent",
                    color: "var(--text-muted)",
                    border: "none",
                    borderRadius: 3,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <X size={12} />
                </button>
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
  const locale = chrome.i18n.getUILanguage()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
  }
  return d.toLocaleDateString(locale, { month: "short", day: "numeric" })
}
