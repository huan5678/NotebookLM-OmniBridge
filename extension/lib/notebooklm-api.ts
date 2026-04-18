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

export interface ArtifactInfo {
  id: string
  title: string
  type: number
  kind: string
  status: string // "in_progress" | "completed" | "failed" | "pending"
  createdAt?: string
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
    type: "audio" | "report" | "quiz" | "flashcards" | "mind_map" | "video",
    options?: {
      instructions?: string
      language?: string
      reportFormat?: number // 1=briefing, 2=study_guide, 3=blog, 4=white_paper
      quizQuantity?: number
      quizDifficulty?: number
      audioFormat?: number
      audioLength?: number
    },
  ): Promise<GenerationResult> {
    const { sources } = await this.getNotebook(notebookId)
    const sourceIds = sources.map((s) => s.id)
    const sourceTriple = sourceIds.map((id) => [[id]])
    const sourceDouble = sourceIds.map((id) => [id])
    const lang = options?.language ?? "en"
    const instr = options?.instructions ?? null

    let artifactParams: any[]

    switch (type) {
      case "audio":
        artifactParams = [
          [2], notebookId,
          [null, null, ArtifactTypeCode.AUDIO, sourceTriple, null, null,
            [null, [instr, options?.audioLength ?? null, null, sourceDouble, lang, null, options?.audioFormat ?? null]]],
        ]
        break

      case "report": {
        const fmt = options?.reportFormat ?? 1
        const reportConfigs: Record<number, { title: string; desc: string; prompt: string }> = {
          1: { title: "Briefing Doc", desc: "A comprehensive overview", prompt: "Create a comprehensive briefing document" },
          2: { title: "Study Guide", desc: "A study guide", prompt: "Create a study guide with key concepts and review questions" },
          3: { title: "Blog Post", desc: "A blog post", prompt: "Write an engaging blog post" },
          4: { title: "White Paper", desc: "A white paper", prompt: "Write a detailed white paper" },
        }
        const cfg = reportConfigs[fmt] ?? reportConfigs[1]
        const prompt = instr ?? cfg.prompt
        artifactParams = [
          [2], notebookId,
          [null, null, ArtifactTypeCode.REPORT, sourceTriple, null, null, null,
            [null, [cfg.title, cfg.desc, null, sourceDouble, lang, prompt, null, true]]],
        ]
        break
      }

      case "quiz":
        artifactParams = [
          [2], notebookId,
          [null, null, ArtifactTypeCode.QUIZ, sourceTriple, null, null, null, null, null,
            [null, [2, null, instr, null, null, null, null, [options?.quizQuantity ?? null, options?.quizDifficulty ?? null]]]],
        ]
        break

      case "flashcards":
        artifactParams = [
          [2], notebookId,
          [null, null, ArtifactTypeCode.QUIZ, sourceTriple, null, null, null, null, null,
            [null, [1, null, instr, null, null, null, [options?.quizDifficulty ?? null, options?.quizQuantity ?? null]]]],
        ]
        break

      case "mind_map":
        artifactParams = [
          [2], notebookId,
          [null, null, ArtifactTypeCode.MIND_MAP, sourceTriple],
        ]
        break

      case "video":
        artifactParams = [
          [2], notebookId,
          [null, null, ArtifactTypeCode.VIDEO, sourceTriple, null, null, null, null,
            [null, null, [sourceDouble, lang, instr]]],
        ]
        break

      default:
        throw new Error(`Unknown artifact type: ${type}`)
    }

    try {
      const result = await this.batchExecute(
        RPC.CREATE_ARTIFACT, artifactParams, `/notebook/${notebookId}`,
      )
      // Parse result for artifact ID
      let artifactId = ""
      if (Array.isArray(result) && result[0]) {
        artifactId = typeof result[0] === "string" ? result[0] : String(result[0])
      }
      return { success: true, artifactId }
    } catch (err) {
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

  return {
    id: String(id),
    title: String(title),
    type: typeCode,
    kind,
    status: ARTIFACT_STATUS_NAMES[statusCode] ?? "unknown",
    createdAt,
  }
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
