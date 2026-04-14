import React, { useEffect } from "react"
import "~style.css"
import { initTheme } from "~lib/theme"
import { t } from "~lib/i18n"

function Popup() {
  useEffect(() => { initTheme() }, [])

  return (
    <div style={{
      width: 260,
      padding: 16,
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      fontFamily: "system-ui, -apple-system, sans-serif",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
        NotebookLM Omni-Bridge
      </h1>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
        {t("popup_open_hint")}
      </p>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
        {t("popup_chrome_hint")}
      </p>
    </div>
  )
}

export default Popup
