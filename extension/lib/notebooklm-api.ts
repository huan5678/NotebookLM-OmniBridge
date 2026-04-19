/**
 * NotebookLM Direct RPC Client
 *
 * Calls Google NotebookLM's internal batchexecute RPC endpoints directly
 * from the Chrome extension service worker, using the browser's Google
 * session cookies for authentication.
 *
 * Protocol details reverse-engineered from notebooklm-py (v0.3.4).
 */

import type { Notebook, Source } from "./types"

// --- Constants ---

const NLM_BASE = "https://notebooklm.google.com"
const BATCHEXECUTE_URL = `${NLM_BASE}/_/LabsTailwindUi/data/batchexecute`
const QUERY_URL = `${NLM_BASE}/_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed`

const DEFAULT_BL = "boq_labs-tailwind-frontend_20260301.03_p0"
const SESSION_TTL_MS = 25 * 60 * 1000 // 25 minutes

// RPC Method IDs (from notebooklm-py rpc/types.py)
const RPC = {
  LIST_NOTEBOOKS: "wXbhsf",
  CREATE_NOTEBOOK: "CCqFvf",
  GET_NOTEBOOK: "rLM1Ne",
  ADD_SOURCE: "izAoDd",
  DELETE_SOURCE: "tGMBJ",
  UPDATE_SOURCE: "b7Wfje",
  // Artifacts
  CREATE_ARTIFACT: "R7cb6c",
  LIST_ARTIFACTS: "gArtLc",
  DELETE_ARTIFACT: "V5N4be",
  GET_INTERACTIVE_HTML: "v9rmvd",
} as const

// Artifact type codes
export const ArtifactTypeCode = {
  AUDIO: 1,
  REPORT: 2,
  VIDEO: 3,
  QUIZ: 4,
  MIND_MAP: 5,
  INFOGRAPHIC: 7,
  SLIDE_DECK: 8,
  DATA_TABLE: 9,
} as const

// --- Artifact option enums (ported from notebooklm-py rpc/types.py) ---

export const AudioFormat = {
  DEEP_DIVE: 1, BRIEF: 2, CRITIQUE: 3, DEBATE: 4,
} as const

export const AudioLength = {
  SHORT: 1, DEFAULT: 2, LONG: 3,
} as const

export const VideoFormat = {
  EXPLAINER: 1, BRIEF: 2, CINEMATIC: 3,
} as const

export const VideoStyle = {
  AUTO_SELECT: 1, CUSTOM: 2, CLASSIC: 3, WHITEBOARD: 4,
  KAWAII: 5, ANIME: 6, WATERCOLOR: 7, RETRO_PRINT: 8,
  HERITAGE: 9, PAPER_CRAFT: 10,
} as const

export const QuizQuantity = {
  FEWER: 1, STANDARD: 2,
} as const

export const QuizDifficulty = {
  EASY: 1, MEDIUM: 2, HARD: 3,
} as const

export const InfographicOrientation = {
  LANDSCAPE: 1, PORTRAIT: 2, SQUARE: 3,
} as const

export const InfographicDetail = {
  CONCISE: 1, STANDARD: 2, DETAILED: 3,
} as const

export const InfographicStyle = {
  AUTO_SELECT: 1, SKETCH_NOTE: 2, PROFESSIONAL: 3, BENTO_GRID: 4,
  EDITORIAL: 5, INSTRUCTIONAL: 6, BRICKS: 7, CLAY: 8,
  ANIME: 9, KAWAII: 10, SCIENTIFIC: 11,
} as const

export const SlideDeckFormat = {
  DETAILED_DECK: 1, PRESENTER_SLIDES: 2,
} as const

export const SlideDeckLength = {
  DEFAULT: 1, SHORT: 2,
} as const

// Report format: uses numeric code internally (our own convention);
// maps to title/description/prompt config inside generateArtifact.
export const ReportFormatCode = {
  BRIEFING_DOC: 1, STUDY_GUIDE: 2, BLOG_POST: 3, CUSTOM: 4,
} as const

export interface ArtifactInfo {
  id: string
  title: string
  type: number
  kind: string
  status: string // "in_progress" | "completed" | "failed" | "pending"
  createdAt?: string
  // Preview/download (extracted at parse time from raw list data)
  mediaUrl?: string // Audio (MP4), Video (MP4), Infographic (PNG)
  slidePdfUrl?: string
  slidePptxUrl?: string
  reportMarkdown?: string
  dataTable?: { headers: string[]; rows: string[][] }
}

export interface GenerationResult {
  success: boolean
  artifactId?: string
  error?: string
}

// --- Response Parser (ported from notebooklm-py rpc/decoder.py) ---

function stripAntiXssi(text: string): string {
  if (text.startsWith(")]}'")) {
    const idx = text.indexOf("\n")
    return idx >= 0 ? text.slice(idx + 1) : text
  }
  return text
}

function parseChunkedResponse(text: string): any[] {
  if (!text || !text.trim()) return []
  const chunks: any[] = []
  const lines = text.trim().split("\n")
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) { i++; continue }
    // Try as byte-count
    if (/^\d+$/.test(line)) {
      i++
      if (i < lines.length) {
        try { chunks.push(JSON.parse(lines[i])) } catch {}
      }
      i++
    } else {
      try { chunks.push(JSON.parse(line)) } catch {}
      i++
    }
  }
  return chunks
}

function extractRpcResult(chunks: any[], rpcId: string): any {
  for (const chunk of chunks) {
    if (!Array.isArray(chunk)) continue
    const items = (Array.isArray(chunk[0]) ? chunk : [chunk]) as any[][]
    for (const item of items) {
      if (!Array.isArray(item) || item.length < 3) continue
      // Error response
      if (item[0] === "er" && item[1] === rpcId) {
        throw new Error(`RPC error for ${rpcId}: ${JSON.stringify(item[2])}`)
      }
      // Success response
      if (item[0] === "wrb.fr" && item[1] === rpcId) {
        const data = item[2]
        if (typeof data === "string") {
          try { return JSON.parse(data) } catch { return data }
        }
        return data
      }
    }
  }
  return null
}

function decodeResponse(raw: string, rpcId: string): any {
  const cleaned = stripAntiXssi(raw)
  const chunks = parseChunkedResponse(cleaned)
  return extractRpcResult(chunks, rpcId)
}

// --- Notebook/Source Parsers (ported from notebooklm-py types.py) ---

function parseNotebook(data: any[]): Notebook {
  const rawTitle = (typeof data[0] === "string") ? data[0] : ""
  const title = rawTitle.replace("thought\n", "").trim()
  const id = (typeof data[2] === "string") ? data[2] : ""

  let created_at = ""
  if (Array.isArray(data[5]) && Array.isArray(data[5][5]) && data[5][5][0]) {
    try { created_at = new Date(data[5][5][0] * 1000).toISOString() } catch {}
  }

  let is_owner = true
  if (Array.isArray(data[5]) && data[5].length > 1) {
    is_owner = data[5][1] === false
  }

  return { id, title, is_owner, created_at }
}

function parseSourceFromNotebook(src: any[]): Source {
  const src_id = Array.isArray(src[0]) ? String(src[0][0]) : String(src[0])
  const title = src[1] ?? null

  let url: string | undefined
  if (Array.isArray(src[2]) && src[2].length > 7 && Array.isArray(src[2][7]) && src[2][7][0]) {
    url = src[2][7][0]
  }

  let created_at = ""
  if (Array.isArray(src[2]) && Array.isArray(src[2][2]) && src[2][2][0]) {
    try { created_at = new Date(src[2][2][0] * 1000).toISOString() } catch {}
  }

  // Status: 1=processing, 2=ready, 3=error
  let status = "ready"
  if (Array.isArray(src[3]) && src[3].length > 1) {
    const code = src[3][1]
    if (code === 1) status = "processing"
    else if (code === 3) status = "error"
  }

  // Type code at src[2][4]
  let type = "text"
  if (Array.isArray(src[2]) && typeof src[2][4] === "number") {
    const typeMap: Record<number, string> = {
      1: "google_docs", 2: "google_slides", 3: "pdf",
      4: "pasted_text", 5: "web_page", 8: "youtube",
      14: "markdown", 16: "docx", 17: "csv",
    }
    type = typeMap[src[2][4]] ?? "text"
  }

  return { id: src_id, title: title ?? "", type, url, status, created_at }
}

// --- Chat Response Parser (ported from notebooklm-py _chat.py) ---

function parseChatResponse(raw: string): string {
  const text = raw.startsWith(")]}'") ? raw.slice(4) : raw
  const lines = text.trim().split("\n")
  let bestMarked = ""
  let bestUnmarked = ""

  function processChunk(jsonStr: string) {
    let data: any
    try { data = JSON.parse(jsonStr) } catch { return }
    if (!Array.isArray(data)) return

    for (const item of data) {
      if (!Array.isArray(item) || item.length < 3 || item[0] !== "wrb.fr") continue
      const innerJson = item[2]
      if (typeof innerJson !== "string") continue
      try {
        const inner = JSON.parse(innerJson)
        if (!Array.isArray(inner) || !Array.isArray(inner[0])) continue
        const first = inner[0]
        const answerText = first[0]
        if (typeof answerText !== "string" || !answerText) continue
        // Check if this is a marked answer (has citation metadata)
        const isAnswer = Array.isArray(first[4]) && first[4].length > 0 && first[4][first[4].length - 1] === 1
        if (isAnswer && answerText.length > bestMarked.length) {
          bestMarked = answerText
        } else if (!isAnswer && answerText.length > bestUnmarked.length) {
          bestUnmarked = answerText
        }
      } catch {}
    }
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) { i++; continue }
    if (/^\d+$/.test(line)) {
      i++
      if (i < lines.length) processChunk(lines[i])
      i++
    } else {
      processChunk(line)
      i++
    }
  }

  return bestMarked || bestUnmarked || ""
}

// --- Offscreen Fetch Helper ---

let offscreenReady = false

async function ensureOffscreen(): Promise<void> {
  if (offscreenReady) return
  // Check if offscreen document already exists
  const contexts = await (chrome.runtime as any).getContexts?.({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  }) ?? []
  if (contexts.length > 0) {
    offscreenReady = true
    return
  }
  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
      justification: "Make authenticated fetch to Google NotebookLM with cookies",
    })
    offscreenReady = true
    console.log("[NLM-API] offscreen document created")
  } catch (e: any) {
    if (e.message?.includes("Only a single offscreen")) {
      offscreenReady = true // already exists
    } else {
      throw e
    }
  }
}

interface OffscreenResponse {
  ok: boolean
  status: number
  url: string
  text: string
  error?: string
}

async function fetchWithCookies(
  url: string,
  init: RequestInit = {},
): Promise<OffscreenResponse> {
  await ensureOffscreen()
  console.log("[NLM-API] offscreen fetch:", url.slice(0, 80))

  const resp = await chrome.runtime.sendMessage({
    type: "OFFSCREEN_FETCH",
    url,
    method: (init.method as string) || "GET",
    headers: init.headers || {},
    body: init.body || undefined,
  }) as OffscreenResponse

  console.log("[NLM-API] offscreen response:", resp.status, resp.url?.slice(0, 100))

  if (resp.error) throw new Error(resp.error)
  return resp
}

// --- Main API Client ---

export class NotebookLMApi {
  private csrfToken = ""
  private sessionId = ""
  private fetchedAt = 0
  private reqidCounter = 100000

  /**
   * Ensure we have a valid session (CSRF token + session ID).
   * Checks chrome.storage.session cache first, then fetches from NLM page.
   */
  async ensureSession(): Promise<void> {
    // Check in-memory first
    if (this.csrfToken && Date.now() - this.fetchedAt < SESSION_TTL_MS) return

    // Check chrome.storage.session
    try {
      const stored = await chrome.storage.session.get(["nlm_csrf", "nlm_sid", "nlm_fetched"])
      if (stored.nlm_csrf && stored.nlm_sid && Date.now() - (stored.nlm_fetched || 0) < SESSION_TTL_MS) {
        this.csrfToken = stored.nlm_csrf
        this.sessionId = stored.nlm_sid
        this.fetchedAt = stored.nlm_fetched
        return
      }
    } catch {}

    // Fetch fresh from NotebookLM page
    await this.initSession()
  }

  /**
   * Fetch CSRF token and session ID from the NotebookLM homepage.
   * Throws if user is not authenticated.
   */
  async initSession(): Promise<void> {
    console.log("[NLM-API] initSession: fetching NLM homepage via offscreen...")
    const resp = await fetchWithCookies(NLM_BASE)

    // Check for auth redirect
    if (resp.url.includes("accounts.google") || resp.url.includes("ServiceLogin")) {
      console.log("[NLM-API] initSession: redirected to login page:", resp.url.slice(0, 100))
      throw new AuthError("Not logged in to Google")
    }

    if (!resp.ok) {
      console.log("[NLM-API] initSession: bad status:", resp.status)
      throw new AuthError(`NotebookLM returned ${resp.status}`)
    }

    const html = resp.text
    console.log("[NLM-API] initSession: got HTML, length:", html.length)

    // Extract CSRF token: "SNlM0e":"<token>"
    const csrfMatch = html.match(/"SNlM0e"\s*:\s*"([^"]+)"/)
    if (!csrfMatch) {
      console.log("[NLM-API] initSession: no CSRF token found. HTML snippet:", html.slice(0, 500))
      if (html.includes("accounts.google.com") || html.includes("ServiceLogin")) {
        throw new AuthError("Not logged in to Google")
      }
      throw new AuthError("Could not extract CSRF token from NotebookLM page")
    }

    // Extract session ID: "FdrFJe":"<session_id>"
    const sidMatch = html.match(/"FdrFJe"\s*:\s*"([^"]+)"/)
    if (!sidMatch) {
      throw new AuthError("Could not extract session ID from NotebookLM page")
    }

    this.csrfToken = csrfMatch[1]
    this.sessionId = sidMatch[1]
    this.fetchedAt = Date.now()
    console.log("[NLM-API] initSession: CSRF token obtained, session ready")

    await this.persistSession()
  }

  private async persistSession(): Promise<void> {
    try {
      await chrome.storage.session.set({
        nlm_csrf: this.csrfToken,
        nlm_sid: this.sessionId,
        nlm_fetched: this.fetchedAt,
      })
    } catch {}
  }

  /**
   * Clear cached session (forces re-fetch on next call).
   */
  async clearSession(): Promise<void> {
    this.csrfToken = ""
    this.sessionId = ""
    this.fetchedAt = 0
    try { await chrome.storage.session.remove(["nlm_csrf", "nlm_sid", "nlm_fetched"]) } catch {}
  }

  // --- RPC Infrastructure ---

  private async batchExecute(
    rpcId: string,
    params: any[],
    sourcePath = "/",
  ): Promise<any> {
    await this.ensureSession()

    // Build f.req body
    const paramsJson = JSON.stringify(params)
    const rpcPayload = JSON.stringify([[[rpcId, paramsJson, null, "generic"]]])
    const body = `f.req=${encodeURIComponent(rpcPayload)}&at=${encodeURIComponent(this.csrfToken)}&`

    // Build URL with query params
    const urlParams = new URLSearchParams({
      rpcids: rpcId,
      "source-path": sourcePath,
      hl: "en",
      rt: "c",
    })
    if (this.sessionId) urlParams.set("f.sid", this.sessionId)

    const url = `${BATCHEXECUTE_URL}?${urlParams.toString()}`

    const resp = await fetchWithCookies(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
    })

    if (resp.url.includes("accounts.google") || resp.url.includes("ServiceLogin")) {
      await this.clearSession()
      throw new AuthError("Session expired — redirected to login")
    }

    if (resp.status === 401 || resp.status === 403) {
      await this.clearSession()
      throw new AuthError(`RPC returned ${resp.status}`)
    }

    if (!resp.ok) {
      throw new Error(`RPC ${rpcId} failed: HTTP ${resp.status}`)
    }

    const result = decodeResponse(resp.text, rpcId)

    return result
  }

  // --- Public API ---

  async isAuthenticated(): Promise<boolean> {
    try {
      await this.ensureSession()
      return true
    } catch (e) {
      if (e instanceof AuthError) return false
      throw e
    }
  }

  async listNotebooks(): Promise<Notebook[]> {
    const params = [null, 1, null, [2]]
    const result = await this.batchExecute(RPC.LIST_NOTEBOOKS, params)
    if (!result || !Array.isArray(result)) return []
    const rawList = Array.isArray(result[0]) ? result[0] : result
    return rawList
      .filter((nb: any) => Array.isArray(nb))
      .map((nb: any) => parseNotebook(nb))
  }

  async createNotebook(title: string): Promise<Notebook> {
    const params = [title, null, null, [2], [1]]
    const result = await this.batchExecute(RPC.CREATE_NOTEBOOK, params)
    return parseNotebook(result)
  }

  async getNotebook(notebookId: string): Promise<{ notebook: Notebook; sources: Source[] }> {
    const params = [notebookId, null, [2], null, 0]
    const result = await this.batchExecute(
      RPC.GET_NOTEBOOK,
      params,
      `/notebook/${notebookId}`,
    )

    if (!result || !Array.isArray(result) || result.length === 0) {
      return { notebook: { id: notebookId, title: "", is_owner: true, created_at: "" }, sources: [] }
    }

    const nbInfo = result[0]
    const notebook = parseNotebook(Array.isArray(nbInfo) ? nbInfo : result)

    // Sources are at nbInfo[1]
    const sources: Source[] = []
    if (Array.isArray(nbInfo) && Array.isArray(nbInfo[1])) {
      for (const src of nbInfo[1]) {
        if (Array.isArray(src) && src.length > 0) {
          try { sources.push(parseSourceFromNotebook(src)) } catch {}
        }
      }
    }

    return { notebook, sources }
  }

  async addUrlSource(url: string, notebookId: string): Promise<string> {
    const params = [
      [[null, null, [url], null, null, null, null, null]],
      notebookId,
      [2],
      null,
      null,
    ]
    const result = await this.batchExecute(
      RPC.ADD_SOURCE,
      params,
      `/notebook/${notebookId}`,
    )
    return extractSourceId(result) ?? "unknown"
  }

  async addTextSource(title: string, content: string, notebookId: string): Promise<string> {
    const params = [
      [[null, [title, content], null, null, null, null, null, null]],
      notebookId,
      [2],
      null,
      null,
    ]
    const result = await this.batchExecute(
      RPC.ADD_SOURCE,
      params,
      `/notebook/${notebookId}`,
    )
    return extractSourceId(result) ?? "unknown"
  }

  async deleteSource(sourceId: string): Promise<void> {
    const params = [[[sourceId]]]
    await this.batchExecute(RPC.DELETE_SOURCE, params)
  }

  async renameSource(sourceId: string, newTitle: string): Promise<void> {
    const params = [null, [sourceId], [[[newTitle]]]]
    await this.batchExecute(RPC.UPDATE_SOURCE, params)
  }

  async chat(message: string, notebookId: string): Promise<string> {
    await this.ensureSession()

    // Get source IDs for this notebook
    const { sources } = await this.getNotebook(notebookId)
    const sourcesArray = sources.map((s) => [[s.id]])

    // Build chat params
    const conversationId = crypto.randomUUID()
    const chatParams: any[] = [
      sourcesArray,
      message,
      null, // conversation history (new conversation)
      [2, null, [1], [1]],
      conversationId,
      null,
      null,
      notebookId,
      1,
    ]

    const paramsJson = JSON.stringify(chatParams)
    const fReq = JSON.stringify([null, paramsJson])
    const body = `f.req=${encodeURIComponent(fReq)}&at=${encodeURIComponent(this.csrfToken)}&`

    this.reqidCounter += 100000
    const urlParams = new URLSearchParams({
      bl: DEFAULT_BL,
      hl: "en",
      _reqid: String(this.reqidCounter),
      rt: "c",
    })
    if (this.sessionId) urlParams.set("f.sid", this.sessionId)

    const url = `${QUERY_URL}?${urlParams.toString()}`

    const resp = await fetchWithCookies(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
    })

    if (resp.url.includes("accounts.google") || resp.url.includes("ServiceLogin")) {
      await this.clearSession()
      throw new AuthError("Chat session expired")
    }

    if (resp.status === 401 || resp.status === 403) {
      await this.clearSession()
      throw new AuthError(`Chat returned ${resp.status}`)
    }

    if (!resp.ok) {
      throw new Error(`Chat failed: HTTP ${resp.status}`)
    }

    const raw = resp.text
    return parseChatResponse(raw)
  }

  // --- Artifact / Studio API ---

  async listArtifacts(notebookId: string): Promise<ArtifactInfo[]> {
    const params = [[2], notebookId, 'NOT artifact.status = "ARTIFACT_STATUS_SUGGESTED"']
    const result = await this.batchExecute(
      RPC.LIST_ARTIFACTS, params, `/notebook/${notebookId}`,
    )
    if (!result || !Array.isArray(result)) return []
    const list = Array.isArray(result[0]) ? result[0] : result
    return list
      .filter((a: any) => Array.isArray(a) && a.length > 0)
      .map((a: any) => parseArtifact(a))
  }

  async deleteArtifact(artifactId: string, notebookId: string): Promise<void> {
    const params = [artifactId]
    await this.batchExecute(RPC.DELETE_ARTIFACT, params, `/notebook/${notebookId}`)
  }

  async getArtifactHtml(artifactId: string, notebookId: string): Promise<string> {
    const params = [artifactId]
    const result = await this.batchExecute(
      RPC.GET_INTERACTIVE_HTML, params, `/notebook/${notebookId}`,
    )
    if (typeof result === "string") return result
    if (Array.isArray(result) && typeof result[0] === "string") return result[0]
    return ""
  }

  async generateArtifact(
    notebookId: string,
    type: "audio" | "report" | "quiz" | "flashcards" | "mind_map" | "video" | "infographic" | "slide_deck" | "data_table",
    options?: {
      instructions?: string
      language?: string
      // Audio
      audioFormat?: number // AudioFormat enum: 1=deep_dive, 2=brief, 3=critique, 4=debate
      audioLength?: number // AudioLength enum: 1=short, 2=default, 3=long
      // Video
      videoFormat?: number // VideoFormat enum: 1=explainer, 2=brief, 3=cinematic
      videoStyle?: number // VideoStyle enum: 1=auto, 3=classic, ... 10=paper_craft
      // Report
      reportFormat?: number // ReportFormatCode: 1=briefing, 2=study_guide, 3=blog_post, 4=custom
      // Quiz & Flashcards
      quizQuantity?: number // QuizQuantity: 1=fewer, 2=standard
      quizDifficulty?: number // QuizDifficulty: 1=easy, 2=medium, 3=hard
      // Infographic
      orientation?: number // InfographicOrientation: 1=landscape, 2=portrait, 3=square
      detailLevel?: number // InfographicDetail: 1=concise, 2=standard, 3=detailed
      style?: number // InfographicStyle: 1=auto ... 11=scientific
      // Slide deck
      slideFormat?: number // SlideDeckFormat: 1=detailed, 2=presenter
      slideLength?: number // SlideDeckLength: 1=default, 2=short
    },
  ): Promise<GenerationResult> {
    const { sources } = await this.getNotebook(notebookId)
    const sourceIds = sources.map((s) => s.id)
    const sourceTriple = sourceIds.map((id) => [[id]])
    const sourceDouble = sourceIds.map((id) => [id])
    const lang = options?.language ?? "en"
    const instr = options?.instructions ?? null

    // Rich first-arg envelope matching real NotebookLM web UI traffic (2026-04).
    // Required for new artifact types (infographic/slide_deck/data_table); harmless for others.
    const ENVELOPE_RICH = [2, null, null, [1, null, null, null, null, null, null, null, null, null, [1]], [[1, 4, 2, 3, 6, 5]]]
    const ENVELOPE_SIMPLE = [2]

    let artifactParams: any[]

    switch (type) {
      // Audio Overview — params from notebooklm-py generate_audio
      case "audio":
        artifactParams = [
          ENVELOPE_SIMPLE, notebookId,
          [
            null, null, ArtifactTypeCode.AUDIO, sourceTriple,
            null, null,
            [null, [instr, options?.audioLength ?? null, null, sourceDouble, lang, null, options?.audioFormat ?? null]],
          ],
        ]
        break

      // Video Overview — params from notebooklm-py generate_video (now includes format + style)
      case "video":
        artifactParams = [
          ENVELOPE_SIMPLE, notebookId,
          [
            null, null, ArtifactTypeCode.VIDEO, sourceTriple,
            null, null, null, null,
            [null, null, [sourceDouble, lang, instr, null, options?.videoFormat ?? null, options?.videoStyle ?? null]],
          ],
        ]
        break

      // Report — 4 built-in formats + custom, with append-mode for instructions
      case "report": {
        const fmt = options?.reportFormat ?? 1
        const reportConfigs: Record<number, { title: string; desc: string; prompt: string }> = {
          1: {
            title: "Briefing Doc",
            desc: "Key insights and important quotes",
            prompt: "Create a comprehensive briefing document that includes an Executive Summary, detailed analysis of key themes, important quotes with context, and actionable insights.",
          },
          2: {
            title: "Study Guide",
            desc: "Short-answer quiz, essay questions, glossary",
            prompt: "Create a comprehensive study guide that includes key concepts, short-answer practice questions, essay prompts for deeper exploration, and a glossary of important terms.",
          },
          3: {
            title: "Blog Post",
            desc: "Insightful takeaways in readable article format",
            prompt: "Write an engaging blog post that presents the key insights in an accessible, reader-friendly format. Include an attention-grabbing introduction, well-organized sections, and a compelling conclusion with takeaways.",
          },
          4: {
            title: "Custom Report",
            desc: "Custom format",
            prompt: "Create a report based on the provided sources.",
          },
        }
        const cfg = reportConfigs[fmt] ?? reportConfigs[1]
        // For built-in formats (1-3), append instructions to template.
        // For custom format (4), instructions *replace* the prompt entirely.
        let prompt = cfg.prompt
        if (instr) {
          prompt = fmt === 4 ? instr : `${cfg.prompt}\n\n${instr}`
        }
        artifactParams = [
          ENVELOPE_SIMPLE, notebookId,
          [
            null, null, ArtifactTypeCode.REPORT, sourceTriple,
            null, null, null,
            [null, [cfg.title, cfg.desc, null, sourceDouble, lang, prompt, null, true]],
          ],
        ]
        break
      }

      // Quiz — variant 2 of type 4
      case "quiz":
        artifactParams = [
          ENVELOPE_SIMPLE, notebookId,
          [
            null, null, ArtifactTypeCode.QUIZ, sourceTriple,
            null, null, null, null, null,
            [null, [2, null, instr, null, null, null, null, [options?.quizQuantity ?? null, options?.quizDifficulty ?? null]]],
          ],
        ]
        break

      // Flashcards — variant 1 of type 4; difficulty/quantity order flipped
      case "flashcards":
        artifactParams = [
          ENVELOPE_SIMPLE, notebookId,
          [
            null, null, ArtifactTypeCode.QUIZ, sourceTriple,
            null, null, null, null, null,
            [null, [1, null, instr, null, null, null, [options?.quizDifficulty ?? null, options?.quizQuantity ?? null]]],
          ],
        ]
        break

      // Mind Map — minimal form (works against current API despite notebooklm-py
      // using a different RPC GENERATE_MIND_MAP). Revisit if server rejects.
      case "mind_map":
        artifactParams = [
          ENVELOPE_SIMPLE, notebookId,
          [null, null, ArtifactTypeCode.MIND_MAP, sourceTriple],
        ]
        break

      // Infographic — uses rich envelope + 11 nulls → options at [15].
      // Reverse-engineered from captured NotebookLM traffic (2026-04).
      case "infographic": {
        const optsBundle = [[instr, lang, null, options?.orientation ?? null, options?.detailLevel ?? null, options?.style ?? null]]
        artifactParams = [
          ENVELOPE_RICH, notebookId,
          [
            null, null, ArtifactTypeCode.INFOGRAPHIC, sourceTriple,
            null, null, null, null, null, null, null, null, null, null, null, // 11 nulls (indices 4-14)
            optsBundle, // index 15
          ],
        ]
        break
      }

      // Slide Deck — envelope + 13 nulls → options at [17] per notebooklm-py.
      case "slide_deck": {
        const optsBundle = [[instr, lang, options?.slideFormat ?? null, options?.slideLength ?? null]]
        artifactParams = [
          ENVELOPE_RICH, notebookId,
          [
            null, null, ArtifactTypeCode.SLIDE_DECK, sourceTriple,
            null, null, null, null, null, null, null, null, null, null, null, null, null, // 13 nulls (indices 4-16)
            optsBundle, // index 17
          ],
        ]
        break
      }

      // Data Table — envelope + 15 nulls → options at [19] per notebooklm-py.
      case "data_table": {
        const optsBundle = [null, [instr, lang]]
        artifactParams = [
          ENVELOPE_RICH, notebookId,
          [
            null, null, ArtifactTypeCode.DATA_TABLE, sourceTriple,
            null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, // 15 nulls (indices 4-18)
            optsBundle, // index 19
          ],
        ]
        break
      }

      default:
        throw new Error(`Unknown artifact type: ${type}`)
    }

    try {
      console.log(`[NLM-API] generateArtifact(${type}) params:`, JSON.stringify(artifactParams).slice(0, 500))
      const result = await this.batchExecute(
        RPC.CREATE_ARTIFACT, artifactParams, `/notebook/${notebookId}`,
      )
      console.log(`[NLM-API] generateArtifact(${type}) result:`, JSON.stringify(result).slice(0, 500))
      // Parse result for artifact ID
      let artifactId = ""
      if (Array.isArray(result) && result[0]) {
        artifactId = typeof result[0] === "string" ? result[0] : String(result[0])
      }
      return { success: true, artifactId }
    } catch (err) {
      console.error(`[NLM-API] generateArtifact(${type}) failed:`, err)
      return { success: false, error: String(err) }
    }
  }
}

// --- Helpers ---

const ARTIFACT_TYPE_NAMES: Record<number, string> = {
  1: "audio", 2: "report", 3: "video", 4: "quiz",
  5: "mind_map", 7: "infographic", 8: "slide_deck", 9: "data_table",
}

const ARTIFACT_STATUS_NAMES: Record<number, string> = {
  1: "in_progress", 2: "pending", 3: "completed", 4: "failed",
}

function parseArtifact(data: any[]): ArtifactInfo {
  const id = data[0] ?? ""
  const title = data[1] ?? ""
  const typeCode = data[2] ?? 0
  const statusCode = data[4] ?? 0

  // Detect quiz vs flashcards (variant at data[9][1][0])
  let kind = ARTIFACT_TYPE_NAMES[typeCode] ?? "unknown"
  if (typeCode === 4) {
    try {
      const variant = data[9]?.[1]?.[0]
      kind = variant === 1 ? "flashcards" : "quiz"
    } catch {}
  }

  let createdAt: string | undefined
  if (Array.isArray(data[15]) && data[15][0]) {
    try { createdAt = new Date(data[15][0] * 1000).toISOString() } catch {}
  }

  const info: ArtifactInfo = {
    id: String(id),
    title: String(title),
    type: typeCode,
    kind,
    status: ARTIFACT_STATUS_NAMES[statusCode] ?? "unknown",
    createdAt,
  }

  // Only extract media/content when status is completed
  if (info.status !== "completed") return info

  try {
    if (typeCode === ArtifactTypeCode.AUDIO) {
      info.mediaUrl = extractAudioUrl(data) ?? undefined
    } else if (typeCode === ArtifactTypeCode.VIDEO) {
      info.mediaUrl = extractVideoUrl(data) ?? undefined
    } else if (typeCode === ArtifactTypeCode.INFOGRAPHIC) {
      info.mediaUrl = extractInfographicUrl(data) ?? undefined
    } else if (typeCode === ArtifactTypeCode.SLIDE_DECK) {
      const slide = extractSlideDeckUrls(data)
      info.slidePdfUrl = slide?.pdf
      info.slidePptxUrl = slide?.pptx
    } else if (typeCode === ArtifactTypeCode.REPORT) {
      info.reportMarkdown = extractReportMarkdown(data) ?? undefined
    } else if (typeCode === ArtifactTypeCode.DATA_TABLE) {
      info.dataTable = extractDataTable(data) ?? undefined
    }
  } catch (e) {
    console.warn(`[NLM-API] Failed to extract preview data for ${kind}:`, e)
  }

  return info
}

// --- Per-type extractors (ported from notebooklm-py download_*) ---

function isMediaUrl(url: any): boolean {
  return typeof url === "string" && /^https?:\/\//.test(url)
}

// Audio URL lives at data[6][5][i] — prefer audio/mp4
function extractAudioUrl(data: any[]): string | null {
  const metadata = data[6]
  if (!Array.isArray(metadata) || metadata.length <= 5) return null
  const mediaList = metadata[5]
  if (!Array.isArray(mediaList)) return null
  for (const item of mediaList) {
    if (Array.isArray(item) && item.length > 2 && item[2] === "audio/mp4" && isMediaUrl(item[0])) {
      return item[0]
    }
  }
  const first = mediaList[0]
  if (Array.isArray(first) && isMediaUrl(first[0])) return first[0]
  return null
}

// Video URL at data[8] — nested search for video/mp4
function extractVideoUrl(data: any[]): string | null {
  const metadata = data[8]
  if (!Array.isArray(metadata)) return null
  let mediaList: any[] | null = null
  for (const item of metadata) {
    if (Array.isArray(item) && item.length > 0 && Array.isArray(item[0]) && isMediaUrl(item[0][0])) {
      mediaList = item
      break
    }
  }
  if (!mediaList) return null
  let url: string | null = null
  for (const item of mediaList) {
    if (Array.isArray(item) && item.length > 2 && item[2] === "video/mp4" && isMediaUrl(item[0])) {
      url = item[0]
      if (item[1] === 4) break
    }
  }
  if (!url && Array.isArray(mediaList[0]) && isMediaUrl(mediaList[0][0])) url = mediaList[0][0]
  return url
}

// Infographic PNG URL — deeply nested; iterate forward
function extractInfographicUrl(data: any[]): string | null {
  for (const item of data) {
    if (!Array.isArray(item) || item.length <= 2) continue
    const content = item[2]
    if (!Array.isArray(content) || content.length === 0) continue
    const first = content[0]
    if (!Array.isArray(first) || first.length <= 1) continue
    const img = first[1]
    if (Array.isArray(img) && img.length > 0 && isMediaUrl(img[0])) return img[0]
  }
  return null
}

// Slide Deck — metadata at [16] = [config, title, slides, pdf_url, pptx_url]
function extractSlideDeckUrls(data: any[]): { pdf?: string; pptx?: string } | null {
  const metadata = data[16]
  if (!Array.isArray(metadata)) return null
  const pdf = isMediaUrl(metadata[3]) ? metadata[3] : undefined
  const pptx = isMediaUrl(metadata[4]) ? metadata[4] : undefined
  return { pdf, pptx }
}

// Report markdown string at data[7][0]
function extractReportMarkdown(data: any[]): string | null {
  const wrapper = data[7]
  if (Array.isArray(wrapper) && typeof wrapper[0] === "string") return wrapper[0]
  if (typeof wrapper === "string") return wrapper
  return null
}

// Data Table structured at data[18]
function extractDataTable(data: any[]): { headers: string[]; rows: string[][] } | null {
  const raw = data[18]
  if (!Array.isArray(raw)) return null
  // Heuristic: find headers (array of strings) and rows (array of string arrays)
  // Structure observed in notebooklm-py is nested; try common shapes
  try {
    // Shape A: [[[headers], [row1], [row2], ...]]
    // Shape B: [headers, [row1, row2, ...]]
    let table: any = raw
    while (Array.isArray(table) && table.length === 1 && Array.isArray(table[0])) {
      table = table[0]
    }
    if (Array.isArray(table) && table.length >= 1 && Array.isArray(table[0])) {
      const headers = table[0].filter((x: any) => typeof x === "string")
      const rows: string[][] = []
      for (let i = 1; i < table.length; i++) {
        const r = table[i]
        if (Array.isArray(r)) {
          rows.push(r.map((c: any) => (c == null ? "" : String(c))))
        }
      }
      if (headers.length) return { headers, rows }
    }
  } catch {}
  return null
}

function extractSourceId(result: any): string | null {
  if (!result || !Array.isArray(result)) return null
  // Try deeply nested: [[[[id], ...]]]
  try {
    let data = result
    while (Array.isArray(data) && Array.isArray(data[0])) {
      data = data[0]
    }
    if (Array.isArray(data) && data[0]) return String(data[0])
  } catch {}
  return null
}

// --- Custom Error ---

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthError"
  }
}
