import React, { useState, useEffect } from "react"
import { getSettings, saveSettings, type Settings } from "~lib/settings"

function Options() {
  const [apiUrl, setApiUrl] = useState("")
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    getSettings().then((s) => setApiUrl(s.apiUrl))
  }, [])

  async function handleSave() {
    await saveSettings({ apiUrl: apiUrl.replace(/\/+$/, "") })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const url = apiUrl.replace(/\/+$/, "")
      const resp = await fetch(`${url}/health`)
      if (resp.ok) {
        setTestResult({ ok: true, message: "連線成功" })
      } else {
        setTestResult({ ok: false, message: `伺服器回傳 ${resp.status}` })
      }
    } catch {
      setTestResult({ ok: false, message: "無法連線，請確認後端已啟動" })
    } finally {
      setTesting(false)
    }
  }

  async function handleReset() {
    setApiUrl("http://localhost:8000")
    await saveSettings({ apiUrl: "http://localhost:8000" })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{
      maxWidth: 480,
      margin: "0 auto",
      padding: 24,
      background: "#1a1a2e",
      color: "#eee",
      fontFamily: "system-ui, -apple-system, sans-serif",
      minHeight: "100vh",
    }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>
        NotebookLM Omni-Bridge 設定
      </h1>

      {/* API URL */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, color: "#aaa", marginBottom: 6 }}>
          後端伺服器 URL
        </label>
        <input
          type="url"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="http://localhost:8000"
          style={{
            width: "100%",
            padding: 10,
            background: "#0f3460",
            color: "#eee",
            border: "1px solid #533483",
            borderRadius: 6,
            fontSize: 14,
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={handleSave}
          style={{
            padding: "8px 20px",
            background: "#e94560",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {saved ? "已儲存" : "儲存"}
        </button>
        <button
          onClick={handleTest}
          disabled={testing}
          style={{
            padding: "8px 20px",
            background: "#533483",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
            opacity: testing ? 0.6 : 1,
          }}
        >
          {testing ? "測試中..." : "測試連線"}
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: "8px 20px",
            background: "transparent",
            color: "#888",
            border: "1px solid #444",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          重設預設
        </button>
      </div>

      {/* Test result */}
      {testResult && (
        <div style={{
          padding: 10,
          borderRadius: 6,
          fontSize: 13,
          background: testResult.ok ? "#1b4332" : "#4a1b1b",
          color: testResult.ok ? "#52b788" : "#f07070",
        }}>
          {testResult.ok ? "●" : "●"} {testResult.message}
        </div>
      )}

      {/* Help */}
      <div style={{ marginTop: 32, fontSize: 12, color: "#666", lineHeight: 1.6 }}>
        <p>啟動後端伺服器：</p>
        <code style={{
          display: "block",
          padding: 8,
          background: "#0f3460",
          borderRadius: 4,
          color: "#aaa",
          fontSize: 11,
        }}>
          cd backend && pip install -r requirements.txt && uvicorn server.main:app --port 8000
        </code>
      </div>
    </div>
  )
}

export default Options
