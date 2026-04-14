import React, { useState, useEffect, useCallback } from "react"
import { bgSend } from "~lib/messaging"
import { t } from "~lib/i18n"
import type { Notebook } from "~lib/types"
import { NotebookSelector } from "./NotebookSelector"
import { SourceManagerModal } from "./SourceManagerModal"
import { IngestTab } from "./IngestTab"
import { ChatTab } from "./ChatTab"

const RETRY_INTERVAL = 10000

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
  const [activeTab, setActiveTab] = useState<"ingest" | "chat">("ingest")
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [currentNotebook, setCurrentNotebook] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
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
      setConnected(data.connected)
      setAuthenticated(data.authenticated !== false)

      if (data.connected && data.authenticated !== false) {
        const nbData = await bgSend<{ notebooks: Notebook[] }>({
          type: "NOTEBOOKLM_LIST",
        })
        setNotebooks(nbData.notebooks ?? [])
        if (nbData.notebooks?.[0] && !currentNotebook) {
          setCurrentNotebook(nbData.notebooks[0].id)
        }
      }
    } catch (err) {
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [currentNotebook])

  useEffect(() => {
    loadStatus()
    // Inject selection watcher into the active tab
    bgSend({ type: "SETUP_SELECTION_WATCHER" }).catch(() => {})
  }, [])

  // Auto-retry when disconnected
  useEffect(() => {
    if (connected || loading) return
    const timer = setInterval(loadStatus, RETRY_INTERVAL)
    return () => clearInterval(timer)
  }, [connected, loading, loadStatus])

  const handleSelectNotebook = useCallback((id: string) => {
    setCurrentNotebook(id)
    bgSend({ type: "NOTEBOOKLM_SELECT", notebookId: id }).catch(console.error)
  }, [])

  const tabs = [
    { id: "ingest" as const, label: t("sidepanel_tab_ingest") },
    { id: "chat" as const, label: t("sidepanel_tab_chat") },
  ]

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
        <span
          onClick={loadStatus}
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: 12,
            fontSize: 11,
            background: connected ? "var(--success-bg)" : "var(--error-bg)",
            color: connected ? "var(--success-text)" : "var(--error-text)",
            cursor: "pointer",
          }}
          title={t("sidepanel_click_reconnect")}
        >
          {connected ? t("sidepanel_connected") : t("sidepanel_disconnected")}
        </span>
      </div>

      {/* Status banners */}
      {!loading && !connected && (
        <div style={{
          padding: "10px 16px",
          background: "var(--error-bg)",
          color: "var(--error-text)",
          fontSize: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}>
          <span>{t("sidepanel_error_no_backend")}</span>
          <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
            {t("sidepanel_error_backend_cmd")}
          </span>
          <button onClick={loadStatus} style={retryBtnStyle}>{t("sidepanel_retry")}</button>
        </div>
      )}
      {!loading && connected && !authenticated && (
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

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: 10,
              background: "transparent",
              color: activeTab === tab.id ? "var(--accent)" : "var(--text-muted)",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", padding: 12, display: "flex", flexDirection: "column" }}>
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
        {activeTab === "ingest" ? (
          <IngestTab currentNotebook={currentNotebook} />
        ) : (
          <ChatTab currentNotebook={currentNotebook} />
        )}
      </div>
    </div>
  )
}
