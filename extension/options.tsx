import React, { useState, useEffect } from "react"
import "~style.css"
import { getSettings, saveSettings } from "~lib/settings"
import { initTheme, setTheme, getTheme, type ThemeMode } from "~lib/theme"
import { t } from "~lib/i18n"

const PAGE_STYLE: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  padding: 24,
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  fontFamily: "system-ui, -apple-system, sans-serif",
  minHeight: "100vh",
}

const CODE_STYLE: React.CSSProperties = {
  display: "block",
  padding: 10,
  background: "var(--bg-secondary)",
  borderRadius: 6,
  color: "var(--text-secondary)",
  fontSize: 12,
  fontFamily: "monospace",
  whiteSpace: "pre-wrap",
  userSelect: "all",
  marginTop: 6,
}

const STEP_STYLE: React.CSSProperties = {
  padding: 14,
  background: "var(--bg-secondary)",
  borderRadius: 8,
  border: "1px solid var(--border)",
}

interface StepStatus {
  backend: "unknown" | "ok" | "fail"
  auth: "unknown" | "ok" | "fail"
}

function Options() {
  const [apiUrl, setApiUrl] = useState("")
  const [saved, setSaved] = useState(false)
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<StepStatus>({ backend: "unknown", auth: "unknown" })
  const [themeMode, setThemeMode] = useState<ThemeMode>("system")

  useEffect(() => {
    initTheme()
    getSettings().then((s) => {
      setApiUrl(s.apiUrl)
      checkAll(s.apiUrl)
    })
    getTheme().then(setThemeMode)
  }, [])

  async function checkAll(url?: string) {
    const base = (url || apiUrl).replace(/\/+$/, "")
    setChecking(true)
    const next: StepStatus = { backend: "unknown", auth: "unknown" }

    try {
      const healthResp = await fetch(`${base}/health`)
      next.backend = healthResp.ok ? "ok" : "fail"
    } catch {
      next.backend = "fail"
    }

    if (next.backend === "ok") {
      try {
        const statusResp = await fetch(`${base}/status`)
        if (statusResp.ok) {
          const data = await statusResp.json()
          next.auth = data.authenticated === false ? "fail" : "ok"
        }
      } catch {
        next.auth = "fail"
      }
    }

    setStatus(next)
    setChecking(false)
  }

  async function handleSave() {
    const cleaned = apiUrl.replace(/\/+$/, "")
    setApiUrl(cleaned)
    await saveSettings({ apiUrl: cleaned })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    checkAll(cleaned)
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

  const allGood = status.backend === "ok" && status.auth === "ok"

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
        <div style={STEP_STYLE}>
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

        {/* Step 1: Python + pip */}
        <div style={STEP_STYLE}>
          <StepHeader num={1} title={t("options_step1_title")} />
          <code style={CODE_STYLE}>pip install notebooklm-py fastapi uvicorn</code>
        </div>

        {/* Step 2: Login */}
        <div style={STEP_STYLE}>
          <StepHeader num={2} title={t("options_step2_title")} status={status.auth} />
          <code style={CODE_STYLE}>python3.11 -m notebooklm login</code>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "6px 0 0" }}>
            {t("options_step2_hint")}
          </p>
        </div>

        {/* Step 3: Start backend */}
        <div style={STEP_STYLE}>
          <StepHeader num={3} title={t("options_step3_title")} status={status.backend} />
          <code style={CODE_STYLE}>cd backend && uvicorn server.main:app --port 8000</code>
        </div>

        {/* Step 4: API URL config */}
        <div style={STEP_STYLE}>
          <StepHeader num={4} title={t("options_step4_title")} />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:8000"
              style={{
                flex: 1,
                padding: 8,
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
            <button onClick={handleSave} style={primaryBtnStyle}>
              {saved ? t("options_saved_btn") : t("options_save_btn")}
            </button>
          </div>
        </div>
      </div>

      {/* Check button */}
      <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => checkAll()}
          disabled={checking}
          style={secondaryBtnStyle}
        >
          {checking ? t("options_checking") : t("options_check_btn")}
        </button>
        {allGood && (
          <span style={{ fontSize: 13, color: "var(--success-text)" }}>
            {t("options_all_good")}
          </span>
        )}
      </div>
    </div>
  )
}

function StepHeader({ num, title, status }: {
  num: number
  title: string
  status?: "unknown" | "ok" | "fail"
}) {
  const indicator = status === "ok"
    ? { text: "OK", color: "var(--success-text)", bg: "var(--success-bg)" }
    : status === "fail"
    ? { text: "!", color: "var(--error-text)", bg: "var(--error-bg)" }
    : null

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: "var(--accent)",
        color: "var(--accent-text)",
        fontSize: 12,
        fontWeight: 600,
        flexShrink: 0,
      }}>
        {num}
      </span>
      <span style={{ fontSize: 14, fontWeight: 500 }}>{title}</span>
      {indicator && (
        <span style={{
          marginLeft: "auto",
          padding: "1px 8px",
          borderRadius: 10,
          fontSize: 11,
          background: indicator.bg,
          color: indicator.color,
        }}>
          {indicator.text}
        </span>
      )}
    </div>
  )
}

const primaryBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "var(--accent)",
  color: "var(--accent-text)",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "var(--bg-tertiary)",
  color: "var(--text-primary)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
}

export default Options
