import React, { useState, useEffect, useCallback } from "react"
import { bgSend } from "~lib/messaging"
import type { Notebook } from "~lib/types"
import { NotebookSelector } from "./NotebookSelector"
import { IngestTab } from "./IngestTab"
import { ChatTab } from "./ChatTab"

export function SidePanel() {
  const [activeTab, setActiveTab] = useState<"ingest" | "chat">("ingest")
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [currentNotebook, setCurrentNotebook] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    try {
      const data = await bgSend<{ connected: boolean; current_notebook: string | null; notebooks?: Notebook[] }>({
        type: "NOTEBOOKLM_STATUS",
      })
      setConnected(data.connected)

      const nbData = await bgSend<{ notebooks: Notebook[] }>({
        type: "NOTEBOOKLM_LIST",
      })
      setNotebooks(nbData.notebooks ?? [])
      if (nbData.notebooks?.[0] && !currentNotebook) {
        setCurrentNotebook(nbData.notebooks[0].id)
      }
    } catch {
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }

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
        <span style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 12,
          fontSize: 11,
          background: connected ? "#1b4332" : "#4a1b1b",
          color: connected ? "#52b788" : "#f07070",
        }}>
          {connected ? "● 已連接" : "● 未連接"}
        </span>
      </div>

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
