import React from "react"

/**
 * Popup 只在 setPanelBehavior 未生效時作為 fallback 顯示。
 * 正常情況下，點擊 icon 會直接開啟 side panel。
 */
function Popup() {
  return (
    <div style={{
      width: 260,
      padding: 16,
      background: "#1a1a2e",
      color: "#eee",
      fontFamily: "system-ui, -apple-system, sans-serif",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
        NotebookLM Omni-Bridge
      </h1>
      <p style={{ fontSize: 12, color: "#aaa", margin: 0 }}>
        請從瀏覽器右上角開啟側邊面板
      </p>
      <p style={{ fontSize: 11, color: "#666", margin: 0 }}>
        Chrome 選單 → 更多工具 → 側邊面板，
        或重新載入此擴充功能。
      </p>
    </div>
  )
}

export default Popup
