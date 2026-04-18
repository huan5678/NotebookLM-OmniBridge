import React, { useState, useEffect, useCallback } from "react"
import {
  AudioLines,
  FileText,
  Target,
  Layers,
  Brain,
  Clapperboard,
  ChartBar,
  Table,
  Package,
  CheckCircle2,
  Loader,
  XCircle,
  HelpCircle,
  RefreshCw,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import "~style.css"
import { initTheme } from "~lib/theme"
import { bgSend } from "~lib/messaging"
import { t } from "~lib/i18n"

type ArtifactType = "audio" | "report" | "quiz" | "flashcards" | "mind_map" | "video"

interface ArtifactInfo {
  id: string
  title: string
  type: number
  kind: string
  status: string
  createdAt?: string
}

const TYPE_BUTTONS: { type: ArtifactType; labelKey: string; Icon: LucideIcon }[] = [
  { type: "audio", labelKey: "studio_type_audio", Icon: AudioLines },
  { type: "report", labelKey: "studio_type_report", Icon: FileText },
  { type: "quiz", labelKey: "studio_type_quiz", Icon: Target },
  { type: "flashcards", labelKey: "studio_type_flashcards", Icon: Layers },
  { type: "mind_map", labelKey: "studio_type_mind_map", Icon: Brain },
  { type: "video", labelKey: "studio_type_video", Icon: Clapperboard },
]

const KIND_ICONS: Record<string, LucideIcon> = {
  audio: AudioLines,
  report: FileText,
  quiz: Target,
  flashcards: Layers,
  mind_map: Brain,
  video: Clapperboard,
  infographic: ChartBar,
  slide_deck: ChartBar,
  data_table: Table,
}

const REPORT_FORMATS = [
  { value: 1, label: "Briefing Doc" },
  { value: 2, label: "Study Guide" },
  { value: 3, label: "Blog Post" },
  { value: 4, label: "White Paper" },
]

function StudioPage() {
  const [notebookId, setNotebookId] = useState<string | null>(null)
  const [notebookTitle, setNotebookTitle] = useState("")
  const [selectedType, setSelectedType] = useState<ArtifactType>("report")
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState("")

  // Options
  const [reportFormat, setReportFormat] = useState(1)
  const [instructions, setInstructions] = useState("")

  useEffect(() => {
    initTheme()
    chrome.storage.session.get(["currentNotebook", "currentNotebookTitle"]).then((data) => {
      setNotebookId(data.currentNotebook ?? null)
      setNotebookTitle(data.currentNotebookTitle ?? "")
      if (data.currentNotebook) loadArtifacts(data.currentNotebook)
    })
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.currentNotebook) {
        setNotebookId(changes.currentNotebook.newValue ?? null)
        if (changes.currentNotebook.newValue) loadArtifacts(changes.currentNotebook.newValue)
      }
      if (changes.currentNotebookTitle) setNotebookTitle(changes.currentNotebookTitle.newValue ?? "")
    }
    chrome.storage.session.onChanged.addListener(listener)
    return () => chrome.storage.session.onChanged.removeListener(listener)
  }, [])

  const loadArtifacts = useCallback(async (nbId: string) => {
    try {
      const data = await bgSend<{ artifacts: ArtifactInfo[] }>({
        type: "NOTEBOOKLM_LIST_ARTIFACTS",
        notebookId: nbId,
      })
      setArtifacts(data.artifacts ?? [])
    } catch {}
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!notebookId || generating) return
    setGenerating(true)
    setError(null)
    setStatus(t("studio_generating"))
    try {
      const opts: Record<string, any> = {}
      if (instructions.trim()) opts.instructions = instructions.trim()
      if (selectedType === "report") opts.reportFormat = reportFormat

      const result = await bgSend<{ success: boolean; error?: string }>({
        type: "NOTEBOOKLM_GENERATE_ARTIFACT",
        notebookId,
        artifactType: selectedType,
        artifactOptions: opts,
      })

      if (result.success) {
        setStatus(t("studio_status_in_progress"))
        // Reload list after a delay to pick up the new artifact
        setTimeout(() => loadArtifacts(notebookId), 3000)
        setTimeout(() => loadArtifacts(notebookId), 8000)
        setTimeout(() => loadArtifacts(notebookId), 15000)
      } else {
        setError(result.error ?? "Generation failed")
        setStatus("")
      }
    } catch (err) {
      setError(String(err))
      setStatus("")
    } finally {
      setGenerating(false)
    }
  }, [notebookId, selectedType, reportFormat, instructions, generating, loadArtifacts])

  const handleDelete = useCallback(async (artifactId: string) => {
    if (!notebookId) return
    try {
      await bgSend({ type: "NOTEBOOKLM_DELETE_ARTIFACT", artifactId, notebookId })
      setArtifacts((prev) => prev.filter((a) => a.id !== artifactId))
    } catch (err) {
      setError(String(err))
    }
  }, [notebookId])

  const handleRefresh = useCallback(() => {
    if (notebookId) loadArtifacts(notebookId)
  }, [notebookId, loadArtifacts])

  const StatusIcon = ({ status }: { status: string }) => {
    const color =
      status === "completed" ? "var(--success-text)" :
      status === "failed" ? "var(--error-text)" :
      "var(--text-muted)"
    const Icon =
      status === "completed" ? CheckCircle2 :
      status === "failed" ? XCircle :
      status === "in_progress" || status === "pending" ? Loader :
      HelpCircle
    const spin = Icon === Loader
    return (
      <Icon
        size={12}
        color={color}
        style={spin ? { animation: "studio-spin 1.2s linear infinite" } : undefined}
      />
    )
  }

  const KindIcon = ({ kind }: { kind: string }) => {
    const Icon = KIND_ICONS[kind] ?? Package
    return <Icon size={16} color="var(--text-secondary)" />
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "var(--bg-primary)", color: "var(--text-primary)",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
        <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{t("studio_title")}</h1>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
          {notebookTitle || "—"}
        </p>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Type selector */}
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TYPE_BUTTONS.map((btn) => {
              const active = selectedType === btn.type
              return (
                <button
                  key={btn.type}
                  onClick={() => setSelectedType(btn.type)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 12px",
                    background: active ? "var(--accent)" : "var(--bg-input)",
                    color: active ? "var(--accent-text)" : "var(--text-secondary)",
                    border: "1px solid",
                    borderColor: active ? "var(--accent)" : "var(--border)",
                    borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: active ? 600 : 400,
                  }}
                >
                  <btn.Icon size={14} />
                  <span>{t(btn.labelKey as any)}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Options panel */}
        <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: 12, border: "1px solid var(--border)" }}>
          {selectedType === "report" && (
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Format</label>
              <select
                value={reportFormat}
                onChange={(e) => setReportFormat(Number(e.target.value))}
                style={{
                  width: "100%", padding: 6, background: "var(--bg-input)", color: "var(--text-primary)",
                  border: "1px solid var(--border)", borderRadius: 4, fontSize: 13,
                }}
              >
                {REPORT_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Instructions (optional)
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Custom instructions..."
              rows={2}
              style={{
                width: "100%", padding: 6, background: "var(--bg-input)", color: "var(--text-primary)",
                border: "1px solid var(--border)", borderRadius: 4, fontSize: 13, resize: "none",
                fontFamily: "system-ui, sans-serif", boxSizing: "border-box",
              }}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !notebookId}
            style={{
              marginTop: 8, width: "100%", padding: 8,
              background: "var(--accent)", color: "var(--accent-text)",
              border: "none", borderRadius: 6, cursor: generating ? "not-allowed" : "pointer",
              fontSize: 14, fontWeight: 500, opacity: generating || !notebookId ? 0.5 : 1,
            }}
          >
            {generating ? t("studio_generating") : t("studio_generate")}
          </button>

          {status && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "6px 0 0", textAlign: "center" }}>{status}</p>}
          {error && <p style={{ fontSize: 11, color: "var(--error-text)", margin: "6px 0 0" }}>{error}</p>}
        </div>

        {/* Artifacts list */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{t("studio_artifacts")}</span>
            <button
              onClick={handleRefresh}
              title={t("sources_refresh")}
              aria-label={t("sources_refresh")}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 24,
                padding: 0, background: "var(--bg-input)", color: "var(--accent)",
                border: "1px solid var(--accent)", borderRadius: 4, cursor: "pointer",
              }}
            >
              <RefreshCw size={12} />
            </button>
          </div>

          {artifacts.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--text-disabled)", textAlign: "center", padding: 20 }}>
              {t("studio_empty")}
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {artifacts.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                  background: "var(--bg-secondary)", borderRadius: 6, border: "1px solid var(--border)",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <KindIcon kind={a.kind} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.title || a.kind}
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text-muted)" }}>
                    <span>{a.kind}</span>
                    <StatusIcon status={a.status} />
                    <span>{t(
                      a.status === "completed" ? "studio_status_completed" :
                      a.status === "failed" ? "studio_status_failed" :
                      "studio_status_in_progress" as any
                    )}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(a.id)}
                  title="Delete"
                  aria-label="Delete"
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 26, height: 24,
                    padding: 0, background: "transparent", color: "var(--error-text)",
                    border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer",
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes studio-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default StudioPage
