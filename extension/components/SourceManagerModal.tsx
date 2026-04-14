import React, { useState, useEffect, useCallback } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { bgSend } from "~lib/messaging"
import { t } from "~lib/i18n"
import type { Source } from "~lib/types"

interface Props {
  notebookId: string | null
  notebookTitle: string
}

export function SourceManagerModal({ notebookId, notebookTitle }: Props) {
  const [open, setOpen] = useState(false)
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadSources = useCallback(async () => {
    if (!notebookId) return
    setLoading(true)
    setError(null)
    try {
      const data = await bgSend<{ sources: Source[] }>({
        type: "NOTEBOOKLM_LIST_SOURCES",
        notebookId,
      })
      setSources(data.sources ?? [])
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [notebookId])

  useEffect(() => {
    if (open && notebookId) {
      loadSources()
    }
  }, [open, notebookId, loadSources])

  async function handleDelete(sourceId: string) {
    try {
      await bgSend({
        type: "NOTEBOOKLM_DELETE_SOURCE",
        notebookId,
        sourceId,
      })
      setSources((prev) => prev.filter((s) => s.id !== sourceId))
      setDeletingId(null)
    } catch (err) {
      setError(t("sources_delete_failed", String(err)))
    }
  }

  async function handleRename(sourceId: string) {
    if (!editTitle.trim()) return
    try {
      await bgSend({
        type: "NOTEBOOKLM_RENAME_SOURCE",
        notebookId,
        sourceId,
        title: editTitle.trim(),
      })
      setSources((prev) =>
        prev.map((s) => (s.id === sourceId ? { ...s, title: editTitle.trim() } : s))
      )
      setEditingId(null)
      setEditTitle("")
    } catch (err) {
      setError(t("sources_rename_failed", String(err)))
    }
  }

  function sourceTypeLabel(type: string): string {
    const normalized = type.replace(/^SourceType\./i, "").toLowerCase()
    const map: Record<string, string> = {
      web_page: "URL",
      pdf: "PDF",
      pasted_text: "Text",
      youtube: "YouTube",
      google_docs: "GDocs",
      google_slides: "GSlides",
      google_spreadsheet: "GSheet",
      markdown: "MD",
      docx: "DOCX",
      csv: "CSV",
      image: "Image",
      media: "Media",
    }
    return map[normalized] || normalized
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          disabled={!notebookId}
          title={t("sources_manage_title")}
          style={{
            flexShrink: 0,
            padding: "4px 8px",
            background: "var(--bg-input)",
            color: notebookId ? "var(--accent)" : "var(--text-disabled)",
            border: "1px solid",
            borderColor: notebookId ? "var(--accent)" : "var(--border)",
            borderRadius: 6,
            cursor: notebookId ? "pointer" : "not-allowed",
            fontSize: 13,
            lineHeight: 1,
          }}
        >
          {"{}"}
        </button>
      </Dialog.Trigger>

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
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(92vw, 480px)",
            maxHeight: "80vh",
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
              padding: "14px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <Dialog.Title
              style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}
            >
              {t("sources_modal_title", notebookTitle)}
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

          {/* Body */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "8px 16px 16px",
            }}
          >
            {error && (
              <div
                style={{
                  padding: "8px 10px",
                  background: "var(--error-bg)",
                  color: "var(--error-text)",
                  borderRadius: 4,
                  fontSize: 12,
                  marginBottom: 8,
                }}
              >
                {error}
              </div>
            )}

            {loading && (
              <p style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: 20 }}>
                {t("sources_loading")}
              </p>
            )}

            {!loading && sources.length === 0 && (
              <p style={{ color: "var(--text-disabled)", fontSize: 12, textAlign: "center", padding: 20 }}>
                {t("sources_empty")}
              </p>
            )}

            {!loading &&
              sources.map((src) => (
                <div
                  key={src.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {/* Type badge */}
                  <span
                    style={{
                      flexShrink: 0,
                      padding: "2px 6px",
                      background: "var(--bg-tertiary)",
                      color: "var(--text-secondary)",
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 500,
                    }}
                  >
                    {sourceTypeLabel(src.type)}
                  </span>

                  {/* Title or edit input */}
                  {editingId === src.id ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(src.id)
                        if (e.key === "Escape") setEditingId(null)
                      }}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: "3px 6px",
                        background: "var(--bg-input)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border-accent)",
                        borderRadius: 4,
                        fontSize: 12,
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 12,
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={src.title}
                    >
                      {src.title || t("sources_untitled")}
                    </span>
                  )}

                  {/* Actions */}
                  {editingId === src.id ? (
                    <>
                      <button
                        onClick={() => handleRename(src.id)}
                        style={actionBtnStyle}
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{ ...actionBtnStyle, color: "var(--text-muted)" }}
                      >
                        X
                      </button>
                    </>
                  ) : deletingId === src.id ? (
                    <>
                      <span style={{ fontSize: 11, color: "var(--error-text)" }}>{t("sources_delete_confirm")}</span>
                      <button
                        onClick={() => handleDelete(src.id)}
                        style={{ ...actionBtnStyle, color: "var(--error-text)" }}
                      >
                        {t("sources_delete_btn")}
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        style={{ ...actionBtnStyle, color: "var(--text-muted)" }}
                      >
                        {t("sources_cancel")}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(src.id)
                          setEditTitle(src.title || "")
                          setDeletingId(null)
                        }}
                        title={t("sources_rename_title")}
                        style={actionBtnStyle}
                      >
                        {t("sources_rename_btn")}
                      </button>
                      <button
                        onClick={() => {
                          setDeletingId(src.id)
                          setEditingId(null)
                        }}
                        title={t("sources_delete_title")}
                        style={{ ...actionBtnStyle, color: "var(--error-text)" }}
                      >
                        {t("sources_delete_btn")}
                      </button>
                    </>
                  )}
                </div>
              ))}
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
              {t("sources_count", String(sources.length))}
            </span>
            <button
              onClick={loadSources}
              disabled={loading}
              style={{
                padding: "4px 12px",
                background: "var(--bg-input)",
                color: "var(--accent)",
                border: "1px solid var(--accent)",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              {loading ? t("sources_refreshing") : t("sources_refresh")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const actionBtnStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: "2px 8px",
  background: "transparent",
  color: "var(--accent)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 11,
}
