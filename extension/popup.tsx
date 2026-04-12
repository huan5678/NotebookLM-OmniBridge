import React from "react"

function Popup() {
  const openSidePanel = () => {
    chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" })
    window.close()
  }

  return (
    <div style={{
      width: 280,
      padding: 16,
      background: "#1a1a2e",
      color: "#eee",
      fontFamily: "system-ui, -apple-system, sans-serif",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
        NotebookLM Omni-Bridge
      </h1>
      <p style={{ fontSize: 12, color: "#aaa", margin: 0 }}>
        請使用側邊面板操作
      </p>
      <button
        onClick={openSidePanel}
        style={{
          padding: "8px 16px",
          background: "#e94560",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        開啟側邊面板
      </button>
    </div>
  )
}

export default Popup
