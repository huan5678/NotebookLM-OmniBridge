import React, { useState, useEffect, useCallback } from "react"
import { bgSend } from "~lib/messaging"
import { t } from "~lib/i18n"
import type { Notebook } from "~lib/types"
import { NotebookSelector } from "./NotebookSelector"
import { SourceManagerModal } from "./SourceManagerModal"
import { IngestTab } from "./IngestTab"

const RETRY_INTERVAL = 30000

const retryBtnStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  padding: "4px 12px",
  background: "var(--accent)",
  color: "var(--accent-text)",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 11,
}

export function SidePanel() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [currentNotebook, setCurrentNotebook] = useState<string | null>(null)
  const [authenticated, setAuthenticated] = useState(true)
  const [loading, setLoading] = useState(true)

  const loadStatus = useCallback(async () => {
    try {
      const data = await bgSend<{
        connected: boolean
        authenticated?: boolean
        current_notebook: string | null
        notebooks?: Notebook[]
        message?: string
      }>({ type: "NOTEBOOKLM_STATUS" })
      setAuthenticated(data.authenticated !== false)

      if (data.authenticated !== false) {
        const nbData = await bgSend<{ notebooks: Notebook[] }>({
          type: "NOTEBOOKLM_LIST",
        })
        setNotebooks(nbData.notebooks ?? [])
        if (nbData.notebooks?.[0] && !currentNotebook) {
          const firstId = nbData.notebooks[0].id
          setCurrentNotebook(firstId)
          syncNotebookToStorage(firstId, nbData.notebooks[0].title)
        }
      }
    } catch (err) {
      setAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }, [currentNotebook])

  useEffect(() => {
    loadStatus()
    bgSend({ type: "SETUP_SELECTION_WATCHER" }).catch(() => {})
  }, [])

  useEffect(() => {
    if (authenticated || loading) return
    const timer = setInterval(loadStatus, RETRY_INTERVAL)
    return () => clearInterval(timer)
  }, [authenticated, loading, loadStatus])

  const handleSelectNotebook = useCallback((id: string) => {
    setCurrentNotebook(id)
    bgSend({ type: "NOTEBOOKLM_SELECT", notebookId: id }).catch(console.error)
    const nb = notebooks.find((n) => n.id === id)
    syncNotebookToStorage(id, nb?.title ?? "")
  }, [notebooks])

  const openChat = useCallback(() => {
    chrome.windows.create({ url: "tabs/chat.html", type: "popup", width: 480, height: 600 })
  }, [])

  const openStudio = useCallback(() => {
    chrome.windows.create({ url: "tabs/studio.html", type: "popup", width: 520, height: 640 })
  }, [])

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
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
            NotebookLM Omni-Bridge
          </h1>
          <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "2px 0 0" }}>
            {loading ? t("sidepanel_loading") : t("sidepanel_notebook_count", String(notebooks.length))}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={openStudio}
            title={t("studio_title")}
            style={{
              padding: "4px 10px",
              background: "var(--bg-input)",
              color: "var(--accent)",
              border: "1px solid var(--accent)",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {t("studio_title")}
          </button>
          <button
            onClick={openChat}
            title={t("chat_float_title")}
            style={{
              padding: "4px 10px",
              background: "var(--accent)",
              color: "var(--accent-text)",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {t("chat_float_title")}
          </button>
          <span
            onClick={loadStatus}
            style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: 12,
              fontSize: 11,
              background: authenticated ? "var(--success-bg)" : "var(--error-bg)",
              color: authenticated ? "var(--success-text)" : "var(--error-text)",
              cursor: "pointer",
            }}
            title={t("sidepanel_click_reconnect")}
          >
            {authenticated ? t("sidepanel_connected") : t("sidepanel_disconnected")}
          </span>
        </div>
      </div>

      {/* Status banners */}
      {!loading && !authenticated && (
        <div style={{
          padding: "10px 16px",
          background: "var(--warning-bg)",
          color: "var(--warning-text)",
          fontSize: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}>
          <span>{t("sidepanel_not_logged_in")}</span>
          <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
            {t("sidepanel_login_cmd")}
          </span>
          <button onClick={loadStatus} style={retryBtnStyle}>{t("sidepanel_login_done")}</button>
        </div>
      )}

      {/* Content — always shows IngestTab */}
      <div style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column" }}>
        <NotebookSelector
          notebooks={notebooks}
          current={currentNotebook}
          onChange={handleSelectNotebook}
          onRefresh={loadStatus}
        >
          <SourceManagerModal
            notebookId={currentNotebook}
            notebookTitle={notebooks.find((n) => n.id === currentNotebook)?.title ?? ""}
          />
        </NotebookSelector>
        <IngestTab currentNotebook={currentNotebook} />
      </div>
    </div>
  )
}

function syncNotebookToStorage(id: string, title: string) {
  chrome.storage.session.set({ currentNotebook: id, currentNotebookTitle: title }).catch(() => {})
}
