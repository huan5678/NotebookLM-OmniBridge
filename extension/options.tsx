import React, { useState, useEffect } from "react"
import { getSettings, saveSettings } from "~lib/settings"

const PAGE_STYLE: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  padding: 24,
  background: "#1a1a2e",
  color: "#eee",
  fontFamily: "system-ui, -apple-system, sans-serif",
  minHeight: "100vh",
}

const CODE_STYLE: React.CSSProperties = {
  display: "block",
  padding: 10,
  background: "#0f3460",
  borderRadius: 6,
  color: "#ccc",
  fontSize: 12,
  fontFamily: "monospace",
  whiteSpace: "pre-wrap",
  userSelect: "all",
  marginTop: 6,
}

const STEP_STYLE: React.CSSProperties = {
  padding: 14,
  background: "#16213e",
  borderRadius: 8,
  border: "1px solid #2a2a4a",
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

  useEffect(() => {
    getSettings().then((s) => {
      setApiUrl(s.apiUrl)
      checkAll(s.apiUrl)
    })
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

  const allGood = status.backend === "ok" && status.auth === "ok"

  return (
    <div style={PAGE_STYLE}>
      <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 6px" }}>
        NotebookLM Omni-Bridge
      </h1>
      <p style={{ fontSize: 12, color: "#888", margin: "0 0 20px" }}>
        設定與環境檢查
      </p>

      {/* Setup steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Step 1: Python + pip */}
        <div style={STEP_STYLE}>
          <StepHeader num={1} title="安裝 Python 套件" />
          <code style={CODE_STYLE}>pip install notebooklm-py fastapi uvicorn</code>
        </div>

        {/* Step 2: Login */}
        <div style={STEP_STYLE}>
          <StepHeader num={2} title="登入 NotebookLM" status={status.auth} />
          <code style={CODE_STYLE}>python3.11 -m notebooklm login</code>
          <p style={{ fontSize: 11, color: "#888", margin: "6px 0 0" }}>
            會開啟瀏覽器進行 Google OAuth 登入
          </p>
        </div>

        {/* Step 3: Start backend */}
        <div style={STEP_STYLE}>
          <StepHeader num={3} title="啟動後端伺服器" status={status.backend} />
          <code style={CODE_STYLE}>cd backend && uvicorn server.main:app --port 8000</code>
        </div>

        {/* Step 4: API URL config */}
        <div style={STEP_STYLE}>
          <StepHeader num={4} title="後端 URL 設定" />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:8000"
              style={{
                flex: 1,
                padding: 8,
                background: "#0f3460",
                color: "#eee",
                border: "1px solid #533483",
                borderRadius: 6,
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
            <button onClick={handleSave} style={btnStyle("#e94560")}>
              {saved ? "已儲存" : "儲存"}
            </button>
          </div>
        </div>
      </div>

      {/* Check button */}
      <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => checkAll()}
          disabled={checking}
          style={btnStyle("#533483")}
        >
          {checking ? "檢查中..." : "重新檢查"}
        </button>
        {allGood && (
          <span style={{ fontSize: 13, color: "#52b788" }}>
            全部就緒，可以使用了
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
    ? { text: "OK", color: "#52b788", bg: "#1b4332" }
    : status === "fail"
    ? { text: "!", color: "#f07070", bg: "#4a1b1b" }
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
        background: "#e94560",
        color: "#fff",
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

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: "8px 16px",
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
  }
}

export default Options
