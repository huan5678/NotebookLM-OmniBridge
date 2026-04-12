import React, { useState, useEffect, useCallback } from "react"
import { bgSend } from "~lib/messaging"
import type { Notebook } from "~lib/types"
import { NotebookSelector } from "./NotebookSelector"
import { IngestTab } from "./IngestTab"
import { ChatTab } from "./ChatTab"

const RETRY_INTERVAL = 10000

export function SidePanel() {
  const [activeTab, setActiveTab] = useState<"ingest" | "chat">("ingest")
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [currentNotebook, setCurrentNotebook] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const data = await bgSend<{
        connected: boolean
        current_notebook: string | null
        notebooks?: Notebook[]
      }>({ type: "NOTEBOOKLM_STATUS" })
      setConnected(data.connected)
      setError(null)

      const nbData = await bgSend<{ notebooks: Notebook[] }>({
        type: "NOTEBOOKLM_LIST",
      })
      setNotebooks(nbData.notebooks ?? [])
      if (nbData.notebooks?.[0] && !currentNotebook) {
        setCurrentNotebook(nbData.notebooks[0].id)
      }
    } catch (err) {
      setConnected(false)
      setError("無法連接後端伺服器")
    } finally {
      setLoading(false)
    }
  }, [currentNotebook])

  useEffect(() => {
    loadStatus()
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
    { id: "ingest" as const, label: "吸取" },
    { id: "chat" as const, label: "對話" },
  ]

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: "#1a1a2e",
      color: "#eee",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid #2a2a4a",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
            NotebookLM Omni-Bridge
          </h1>
          <p style={{ fontSize: 10, color: "#666", margin: "2px 0 0" }}>
            {loading ? "載入中..." : `${notebooks.length} 個 Notebook`}
          </p>
        </div>
        <span
          onClick={loadStatus}
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: 12,
            fontSize: 11,
            background: connected ? "#1b4332" : "#4a1b1b",
            color: connected ? "#52b788" : "#f07070",
            cursor: "pointer",
          }}
          title="點擊重新連線"
        >
          {connected ? "● 已連接" : "● 未連接"}
        </span>
      </div>

      {/* Disconnected banner */}
      {!loading && !connected && (
        <div style={{
          padding: "10px 16px",
          background: "#4a1b1b",
          color: "#f07070",
          fontSize: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}>
          <span>{error || "無法連接後端伺服器"}</span>
          <span style={{ color: "#aaa", fontSize: 11 }}>
            請確認後端已啟動：cd backend && uvicorn server.main:app
          </span>
          <button
            onClick={loadStatus}
            style={{
              alignSelf: "flex-start",
              padding: "4px 12px",
              background: "#e94560",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            重試連線
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #2a2a4a" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: 10,
              background: "transparent",
              color: activeTab === tab.id ? "#e94560" : "#888",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #e94560" : "2px solid transparent",
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
        />
        {activeTab === "ingest" ? (
          <IngestTab currentNotebook={currentNotebook} />
        ) : (
          <ChatTab currentNotebook={currentNotebook} />
        )}
      </div>
    </div>
  )
}
