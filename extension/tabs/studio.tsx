import React, { useState, useEffect, useCallback } from "react"
import {
  AudioLines,
  FileText,
  Target,
  Layers,
  Brain,
  Clapperboard,
  Images,
  Presentation,
  Table2,
  Package,
  CheckCircle2,
  Loader,
  XCircle,
  HelpCircle,
  RefreshCw,
  Trash2,
  ExternalLink,
  Eye,
  FileDown,
  type LucideIcon,
} from "lucide-react"
import "~style.css"
import { initTheme } from "~lib/theme"
import { bgSend } from "~lib/messaging"
import { t } from "~lib/i18n"

type ArtifactType =
  | "audio"
  | "report"
  | "quiz"
  | "flashcards"
  | "mind_map"
  | "video"
  | "infographic"
  | "slide_deck"
  | "data_table"

interface ArtifactInfo {
  id: string
  title: string
  type: number
  kind: string
  status: string
  createdAt?: string
  // Preview/download fields (populated for completed artifacts)
  mediaUrl?: string
  slidePdfUrl?: string
  slidePptxUrl?: string
  reportMarkdown?: string
  dataTable?: { headers: string[]; rows: string[][] }
}

const TYPE_BUTTONS: { type: ArtifactType; labelKey: string; Icon: LucideIcon }[] = [
  { type: "audio", labelKey: "studio_type_audio", Icon: AudioLines },
  { type: "report", labelKey: "studio_type_report", Icon: FileText },
  { type: "quiz", labelKey: "studio_type_quiz", Icon: Target },
  { type: "flashcards", labelKey: "studio_type_flashcards", Icon: Layers },
  { type: "mind_map", labelKey: "studio_type_mind_map", Icon: Brain },
  { type: "video", labelKey: "studio_type_video", Icon: Clapperboard },
  { type: "infographic", labelKey: "studio_type_infographic", Icon: Images },
  { type: "slide_deck", labelKey: "studio_type_slide_deck", Icon: Presentation },
  { type: "data_table", labelKey: "studio_type_data_table", Icon: Table2 },
]

const KIND_ICONS: Record<string, LucideIcon> = {
  audio: AudioLines,
  report: FileText,
  quiz: Target,
  flashcards: Layers,
  mind_map: Brain,
  video: Clapperboard,
  infographic: Images,
  slide_deck: Presentation,
  data_table: Table2,
}

type Choice = { value: number; label: string }

const LANGUAGES: { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh_hant", label: "中文（繁體）" },
  { value: "zh_hans", label: "中文（简体）" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
]

const REPORT_FORMATS: Choice[] = [
  { value: 1, label: "Briefing Doc" },
  { value: 2, label: "Study Guide" },
  { value: 3, label: "Blog Post" },
  { value: 4, label: "Custom" },
]

const AUDIO_FORMATS: Choice[] = [
  { value: 1, label: "Deep Dive" },
  { value: 2, label: "Brief" },
  { value: 3, label: "Critique" },
  { value: 4, label: "Debate" },
]

const AUDIO_LENGTHS: Choice[] = [
  { value: 1, label: "Short" },
  { value: 2, label: "Default" },
  { value: 3, label: "Long" },
]

const VIDEO_FORMATS: Choice[] = [
  { value: 1, label: "Explainer" },
  { value: 2, label: "Brief" },
  { value: 3, label: "Cinematic" },
]

const VIDEO_STYLES: Choice[] = [
  { value: 1, label: "Auto" },
  { value: 3, label: "Classic" },
  { value: 4, label: "Whiteboard" },
  { value: 5, label: "Kawaii" },
  { value: 6, label: "Anime" },
  { value: 7, label: "Watercolor" },
  { value: 8, label: "Retro Print" },
  { value: 9, label: "Heritage" },
  { value: 10, label: "Paper Craft" },
]

const QUIZ_QUANTITIES: Choice[] = [
  { value: 1, label: "Fewer" },
  { value: 2, label: "Standard" },
]

const QUIZ_DIFFICULTIES: Choice[] = [
  { value: 1, label: "Easy" },
  { value: 2, label: "Medium" },
  { value: 3, label: "Hard" },
]

const INFOGRAPHIC_ORIENTATIONS: Choice[] = [
  { value: 1, label: "Landscape" },
  { value: 2, label: "Portrait" },
  { value: 3, label: "Square" },
]

const INFOGRAPHIC_DETAILS: Choice[] = [
  { value: 1, label: "Concise" },
  { value: 2, label: "Standard" },
  { value: 3, label: "Detailed" },
]

const INFOGRAPHIC_STYLES: Choice[] = [
  { value: 1, label: "Auto" },
  { value: 2, label: "Sketch Note" },
  { value: 3, label: "Professional" },
  { value: 4, label: "Bento Grid" },
  { value: 5, label: "Editorial" },
  { value: 6, label: "Instructional" },
  { value: 7, label: "Bricks" },
  { value: 8, label: "Clay" },
  { value: 9, label: "Anime" },
  { value: 10, label: "Kawaii" },
  { value: 11, label: "Scientific" },
]

const SLIDE_FORMATS: Choice[] = [
  { value: 1, label: "Detailed Deck" },
  { value: 2, label: "Presenter Slides" },
]

const SLIDE_LENGTHS: Choice[] = [
  { value: 1, label: "Default" },
  { value: 2, label: "Short" },
]

type GenOpts = {
  language: string
  audioFormat?: number
  audioLength?: number
  videoFormat?: number
  videoStyle?: number
  reportFormat: number
  quizQuantity?: number
  quizDifficulty?: number
  orientation?: number
  detailLevel?: number
  style?: number
  slideFormat?: number
  slideLength?: number
}

// --- Preview helpers ---

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>
  )[c])
}

function buildMarkdownHtml(title: string, md: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.65;color:#1f1f1f;background:#fff}
h1{margin-top:0;font-size:24px}pre{white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f4f4f5;padding:16px;border-radius:8px;font-size:13px;line-height:1.5}</style>
</head><body><h1>${escapeHtml(title)}</h1><pre>${escapeHtml(md)}</pre></body></html>`
}

function buildTableHtml(title: string, tbl: { headers: string[]; rows: string[][] }): string {
  const th = tbl.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")
  const body = tbl.rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
    .join("")
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;margin:40px auto;padding:0 20px;max-width:1200px;color:#1f1f1f;background:#fff}
h1{font-size:22px;margin-top:0}table{border-collapse:collapse;width:100%;font-size:13px}
th,td{border:1px solid #e4e4e7;padding:8px 12px;text-align:left;vertical-align:top}
th{background:#f4f4f5;font-weight:600;position:sticky;top:0}tr:nth-child(even) td{background:#fafafa}</style>
</head><body><h1>${escapeHtml(title)}</h1><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></body></html>`
}

function openHtmlInTab(html: string): void {
  const url = "data:text/html;charset=utf-8," + encodeURIComponent(html)
  chrome.tabs.create({ url }).catch((err) => console.error("[Studio] openHtmlInTab failed:", err))
}

function StudioPage() {
  const [notebookId, setNotebookId] = useState<string | null>(null)
  const [notebookTitle, setNotebookTitle] = useState("")
  const [selectedType, setSelectedType] = useState<ArtifactType>("report")
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState("")

  // Options
  const [opts, setOpts] = useState<GenOpts>({ language: "en", reportFormat: 1 })
  const [instructions, setInstructions] = useState("")

  const updateOpt = useCallback(<K extends keyof GenOpts>(key: K, value: GenOpts[K]) => {
    setOpts((prev) => ({ ...prev, [key]: value }))
  }, [])

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
      // Whitelist options relevant to the selected type to avoid sending noise
      const payload: Record<string, any> = { language: opts.language }
      if (instructions.trim()) payload.instructions = instructions.trim()

      switch (selectedType) {
        case "audio":
          if (opts.audioFormat) payload.audioFormat = opts.audioFormat
          if (opts.audioLength) payload.audioLength = opts.audioLength
          break
        case "video":
          if (opts.videoFormat) payload.videoFormat = opts.videoFormat
          if (opts.videoStyle) payload.videoStyle = opts.videoStyle
          break
        case "report":
          payload.reportFormat = opts.reportFormat
          break
        case "quiz":
        case "flashcards":
          if (opts.quizQuantity) payload.quizQuantity = opts.quizQuantity
          if (opts.quizDifficulty) payload.quizDifficulty = opts.quizDifficulty
          break
        case "infographic":
          if (opts.orientation) payload.orientation = opts.orientation
          if (opts.detailLevel) payload.detailLevel = opts.detailLevel
          if (opts.style) payload.style = opts.style
          break
        case "slide_deck":
          if (opts.slideFormat) payload.slideFormat = opts.slideFormat
          if (opts.slideLength) payload.slideLength = opts.slideLength
          break
      }

      const result = await bgSend<{ success: boolean; error?: string }>({
        type: "NOTEBOOKLM_GENERATE_ARTIFACT",
        notebookId,
        artifactType: selectedType,
        artifactOptions: payload,
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
  }, [notebookId, selectedType, opts, instructions, generating, loadArtifacts])

  const handleDelete = useCallback(async (artifactId: string) => {
    if (!notebookId) return
    try {
      await bgSend({ type: "NOTEBOOKLM_DELETE_ARTIFACT", artifactId, notebookId })
      setArtifacts((prev) => prev.filter((a) => a.id !== artifactId))
    } catch (err) {
      setError(String(err))
    }
  }, [notebookId])

  const handleOpenInteractive = useCallback(async (artifactId: string, title: string) => {
    if (!notebookId) return
    try {
      const html = await bgSend<string>({
        type: "NOTEBOOKLM_GET_ARTIFACT_HTML",
        artifactId,
        notebookId,
      })
      if (typeof html === "string" && html.length > 0) {
        openHtmlInTab(html)
      } else {
        setError("Could not fetch interactive content")
      }
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
          <OptionsPanel
            selectedType={selectedType}
            opts={opts}
            updateOpt={updateOpt}
            instructions={instructions}
            setInstructions={setInstructions}
          />

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
                {/* Action buttons — preview / download / open */}
                {a.status === "completed" && (
                  <>
                    {a.mediaUrl && (
                      <ActionBtn
                        onClick={() => chrome.tabs.create({ url: a.mediaUrl! })}
                        title={t("artifact_open")}
                      >
                        <ExternalLink size={12} />
                      </ActionBtn>
                    )}
                    {a.slidePdfUrl && (
                      <ActionBtn
                        onClick={() => chrome.tabs.create({ url: a.slidePdfUrl! })}
                        title="PDF"
                      >
                        <FileDown size={12} />
                      </ActionBtn>
                    )}
                    {a.slidePptxUrl && (
                      <ActionBtn
                        onClick={() => chrome.tabs.create({ url: a.slidePptxUrl! })}
                        title="PPTX"
                      >
                        <FileDown size={12} />
                      </ActionBtn>
                    )}
                    {a.reportMarkdown && (
                      <ActionBtn
                        onClick={() => openHtmlInTab(buildMarkdownHtml(a.title || "Report", a.reportMarkdown!))}
                        title={t("artifact_preview")}
                      >
                        <Eye size={12} />
                      </ActionBtn>
                    )}
                    {a.dataTable && (
                      <ActionBtn
                        onClick={() => openHtmlInTab(buildTableHtml(a.title || "Data Table", a.dataTable!))}
                        title={t("artifact_preview")}
                      >
                        <Eye size={12} />
                      </ActionBtn>
                    )}
                    {(a.kind === "quiz" || a.kind === "flashcards") && (
                      <ActionBtn
                        onClick={() => handleOpenInteractive(a.id, a.title)}
                        title={t("artifact_open")}
                      >
                        <ExternalLink size={12} />
                      </ActionBtn>
                    )}
                  </>
                )}
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

// --- Shared Action Button (used in artifact rows) ---

function ActionBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 26, height: 24,
        padding: 0, background: "transparent", color: "var(--accent)",
        border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer",
      }}
    >
      {children}
    </button>
  )
}

// --- Options Panel (per-type customization) ---

const fieldWrapStyle: React.CSSProperties = { marginBottom: 8 }
const labelStyle: React.CSSProperties = {
  fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4,
}
const selectStyle: React.CSSProperties = {
  width: "100%", padding: 6, background: "var(--bg-input)", color: "var(--text-primary)",
  border: "1px solid var(--border)", borderRadius: 4, fontSize: 13,
}

function NumberSelect({
  value, onChange, choices, allowNone = true,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  choices: Choice[]
  allowNone?: boolean
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      style={selectStyle}
    >
      {allowNone && <option value="">—</option>}
      {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
    </select>
  )
}

function RowFields({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>{children}</div>
}

function OptionsPanel({
  selectedType,
  opts,
  updateOpt,
  instructions,
  setInstructions,
}: {
  selectedType: ArtifactType
  opts: GenOpts
  updateOpt: <K extends keyof GenOpts>(key: K, value: GenOpts[K]) => void
  instructions: string
  setInstructions: (v: string) => void
}) {
  return (
    <>
      {/* Language — always visible */}
      <div style={fieldWrapStyle}>
        <label style={labelStyle}>{t("studio_label_language")}</label>
        <select
          value={opts.language}
          onChange={(e) => updateOpt("language", e.target.value)}
          style={selectStyle}
        >
          {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </div>

      {/* Type-specific dropdowns */}
      {selectedType === "audio" && (
        <RowFields>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t("studio_label_format")}</label>
            <NumberSelect value={opts.audioFormat} onChange={(v) => updateOpt("audioFormat", v)} choices={AUDIO_FORMATS} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t("studio_label_length")}</label>
            <NumberSelect value={opts.audioLength} onChange={(v) => updateOpt("audioLength", v)} choices={AUDIO_LENGTHS} />
          </div>
        </RowFields>
      )}

      {selectedType === "video" && (
        <RowFields>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t("studio_label_format")}</label>
            <NumberSelect value={opts.videoFormat} onChange={(v) => updateOpt("videoFormat", v)} choices={VIDEO_FORMATS} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t("studio_label_style")}</label>
            <NumberSelect value={opts.videoStyle} onChange={(v) => updateOpt("videoStyle", v)} choices={VIDEO_STYLES} />
          </div>
        </RowFields>
      )}

      {selectedType === "report" && (
        <div style={fieldWrapStyle}>
          <label style={labelStyle}>{t("studio_label_format")}</label>
          <select
            value={opts.reportFormat}
            onChange={(e) => updateOpt("reportFormat", Number(e.target.value))}
            style={selectStyle}
          >
            {REPORT_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      )}

      {(selectedType === "quiz" || selectedType === "flashcards") && (
        <RowFields>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t("studio_label_quantity")}</label>
            <NumberSelect value={opts.quizQuantity} onChange={(v) => updateOpt("quizQuantity", v)} choices={QUIZ_QUANTITIES} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t("studio_label_difficulty")}</label>
            <NumberSelect value={opts.quizDifficulty} onChange={(v) => updateOpt("quizDifficulty", v)} choices={QUIZ_DIFFICULTIES} />
          </div>
        </RowFields>
      )}

      {selectedType === "infographic" && (
        <>
          <RowFields>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t("studio_label_orientation")}</label>
              <NumberSelect value={opts.orientation} onChange={(v) => updateOpt("orientation", v)} choices={INFOGRAPHIC_ORIENTATIONS} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t("studio_label_detail")}</label>
              <NumberSelect value={opts.detailLevel} onChange={(v) => updateOpt("detailLevel", v)} choices={INFOGRAPHIC_DETAILS} />
            </div>
          </RowFields>
          <div style={fieldWrapStyle}>
            <label style={labelStyle}>{t("studio_label_style")}</label>
            <NumberSelect value={opts.style} onChange={(v) => updateOpt("style", v)} choices={INFOGRAPHIC_STYLES} />
          </div>
        </>
      )}

      {selectedType === "slide_deck" && (
        <RowFields>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t("studio_label_format")}</label>
            <NumberSelect value={opts.slideFormat} onChange={(v) => updateOpt("slideFormat", v)} choices={SLIDE_FORMATS} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t("studio_label_length")}</label>
            <NumberSelect value={opts.slideLength} onChange={(v) => updateOpt("slideLength", v)} choices={SLIDE_LENGTHS} />
          </div>
        </RowFields>
      )}

      {/* Instructions — always visible at bottom */}
      <div style={fieldWrapStyle}>
        <label style={labelStyle}>
          {selectedType === "report" && opts.reportFormat === 4
            ? t("studio_label_instructions_custom")
            : t("studio_label_instructions")}
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={t("studio_instructions_placeholder")}
          rows={2}
          style={{
            width: "100%", padding: 6, background: "var(--bg-input)", color: "var(--text-primary)",
            border: "1px solid var(--border)", borderRadius: 4, fontSize: 13, resize: "none",
            fontFamily: "system-ui, sans-serif", boxSizing: "border-box",
          }}
        />
      </div>
    </>
  )
}

export default StudioPage
