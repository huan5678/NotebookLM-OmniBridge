import React, { useState, useEffect } from "react"
import "~style.css"
import { initTheme, setTheme, getTheme, type ThemeMode } from "~lib/theme"
import { t } from "~lib/i18n"
import { bgSend } from "~lib/messaging"

const PAGE_STYLE: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  padding: 24,
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  fontFamily: "system-ui, -apple-system, sans-serif",
  minHeight: "100vh",
}

const CARD_STYLE: React.CSSProperties = {
  padding: 14,
  background: "var(--bg-secondary)",
  borderRadius: 8,
  border: "1px solid var(--border)",
}

function Options() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("system")
  const [authStatus, setAuthStatus] = useState<"unknown" | "ok" | "fail">("unknown")
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    initTheme()
    getTheme().then(setThemeMode)
    checkAuth()
  }, [])

  async function checkAuth() {
    setChecking(true)
    try {
      const data = await bgSend<{
        connected: boolean
        authenticated?: boolean
      }>({ type: "NOTEBOOKLM_STATUS" })
      setAuthStatus(data.authenticated !== false ? "ok" : "fail")
    } catch {
      setAuthStatus("fail")
    } finally {
      setChecking(false)
    }
  }

  async function handleThemeChange(mode: ThemeMode) {
    setThemeMode(mode)
    await setTheme(mode)
  }

  const themeLabels: Record<ThemeMode, string> = {
    light: t("options_theme_light"),
    dark: t("options_theme_dark"),
    system: t("options_theme_system"),
  }

  return (
    <div style={PAGE_STYLE}>
      <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 6px" }}>
        NotebookLM Omni-Bridge
      </h1>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 20px" }}>
        {t("options_subtitle")}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Theme */}
        <div style={CARD_STYLE}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{t("options_theme")}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["light", "dark", "system"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => handleThemeChange(mode)}
                style={{
                  flex: 1,
                  padding: "6px 12px",
                  background: themeMode === mode ? "var(--accent)" : "var(--bg-input)",
                  color: themeMode === mode ? "var(--accent-text)" : "var(--text-secondary)",
                  border: "1px solid",
                  borderColor: themeMode === mode ? "var(--accent)" : "var(--border)",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: themeMode === mode ? 600 : 400,
                }}
              >
                {themeLabels[mode]}
              </button>
            ))}
          </div>
        </div>

        {/* Auth Status */}
        <div style={CARD_STYLE}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>
              {t("options_auth_status")}
            </span>
            {authStatus === "ok" && (
              <span style={{
                marginLeft: "auto",
                padding: "1px 8px",
                borderRadius: 10,
                fontSize: 11,
                background: "var(--success-bg)",
                color: "var(--success-text)",
              }}>
                {t("options_auth_ok")}
              </span>
            )}
            {authStatus === "fail" && (
              <span style={{
                marginLeft: "auto",
                padding: "1px 8px",
                borderRadius: 10,
                fontSize: 11,
                background: "var(--error-bg)",
                color: "var(--error-text)",
              }}>
                {t("options_auth_fail")}
              </span>
            )}
          </div>
          {authStatus === "fail" && (
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 8px" }}>
              {t("options_auth_hint")}
            </p>
          )}
          <button
            onClick={checkAuth}
            disabled={checking}
            style={{
              padding: "6px 14px",
              background: "var(--bg-tertiary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {checking ? t("options_checking") : t("options_check_btn")}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Options
