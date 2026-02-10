import { Router } from "express"
import type { Request, Response } from "express"
import { pool } from "../db.js"

type AiBody = {
  name?: string
  family?: string
  allergens?: string[]
  imageUrl?: string
  shareCode?: string
  profileId?: string
}

export const router = Router()

const provider = (process.env.AI_PROVIDER || "ollama").toLowerCase()

const openAiBaseUrls: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  grok: "https://api.x.ai/v1",
}

const getOpenAiConfig = () => {
  const baseUrl =
    process.env.OPENAI_BASE_URL || openAiBaseUrls[provider] || openAiBaseUrls.openai
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY
  const model = process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini"
  return { baseUrl, apiKey, model }
}

const getOllamaConfig = () => {
  const baseUrl = process.env.OLLAMA_BASE_URL || "https://ollama.com"
  const apiKey = process.env.OLLAMA_API_KEY
  const model = process.env.OLLAMA_MODEL || "gpt-oss:120b"
  return { baseUrl, apiKey, model }
}

const getAnthropicConfig = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022"
  return { apiKey, model }
}

const getGeminiConfig = () => {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash"
  return { apiKey, model }
}

const tokenPattern = /^[a-zA-Z0-9_-]{8,128}$/

const isValidToken = (value?: string) => Boolean(value && tokenPattern.test(value))

const aiRequiresProfileLink = process.env.AI_REQUIRE_PROFILE_LINK !== "false"

const requestTimeoutMs = Number(process.env.AI_REQUEST_TIMEOUT_MS || 12000)

const withTimeoutSignal = () => AbortSignal.timeout(requestTimeoutMs)

const parseAiJson = (content: string) => {
  const trimmed = content.trim()
  if (!trimmed) return {}
  try {
    return JSON.parse(trimmed) as { description?: string; reactions?: string }
  } catch {
    const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i)
    if (!fenced?.[1]) return {}
    try {
      return JSON.parse(fenced[1]) as { description?: string; reactions?: string }
    } catch {
      return {}
    }
  }
}

const isHttpUrl = (value?: string) =>
  Boolean(value && /^https?:\/\//i.test(value.trim()))

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const toTokens = (value: string) => normalizeText(value).split(" ").filter(Boolean)

const tokenEquivalent = (a: string, b: string) => {
  if (a === b) return true
  if (a.length < 3 || b.length < 3) return false
  if (a.endsWith("s") && a.slice(0, -1) === b) return true
  if (b.endsWith("s") && b.slice(0, -1) === a) return true
  if (a.endsWith("es") && a.slice(0, -2) === b) return true
  if (b.endsWith("es") && b.slice(0, -2) === a) return true
  return false
}

type ImageCandidate = {
  imageUrl: string
  imageAttribution: string
  imageAttributionUrl: string
  source: string
}

const titleMatchesFood = (title: string, foodName: string) => {
  const titleTokens = toTokens(title)
  const foodTokens = toTokens(foodName).filter((token) => token.length >= 3)
  if (titleTokens.length === 0 || foodTokens.length === 0) return false

  return foodTokens.every((foodToken) =>
    titleTokens.some((titleToken) => tokenEquivalent(titleToken, foodToken))
  )
}

const toTitleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")

const toReadableTitle = (pathname: string) => {
  const segment = decodeURIComponent(pathname.split("/").filter(Boolean).pop() || "")
  const cleaned = segment
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!cleaned) return ""
  return cleaned.length > 80 ? cleaned.slice(0, 80).trim() : cleaned
}

const inferAttributionFromImageUrl = (rawUrl: string) => {
  const url = new URL(rawUrl)
  const host = url.hostname.toLowerCase()
  const hostSourceMap: { match: string; label: string; source: string }[] = [
    { match: "wikipedia.org", label: "Wikipedia", source: "wikipedia-url" },
    { match: "wikimedia.org", label: "Wikimedia Commons", source: "wikimedia-url" },
    { match: "unsplash.com", label: "Unsplash", source: "unsplash-url" },
    { match: "pexels.com", label: "Pexels", source: "pexels-url" },
    { match: "pixabay.com", label: "Pixabay", source: "pixabay-url" },
    { match: "openverse.org", label: "Openverse", source: "openverse-url" },
    { match: "pxhere.com", label: "pxhere", source: "pxhere-url" },
    { match: "flickr.com", label: "Flickr", source: "flickr-url" },
  ]
  const matched = hostSourceMap.find((item) => host.includes(item.match))
  const title = toReadableTitle(url.pathname)
  const baseUrl = `${url.protocol}//${url.host}`

  if (matched) {
    return {
      imageAttribution: title ? `${matched.label}: ${title}` : matched.label,
      imageAttributionUrl: baseUrl,
      source: matched.source,
    }
  }

  return {
    imageAttribution: title ? `Fuente: ${host} (${title})` : `Fuente: ${host}`,
    imageAttributionUrl: baseUrl,
    source: "url-scan",
  }
}

const searchWikipediaByTitle = async (title: string, foodName: string) => {
  const url = new URL("https://es.wikipedia.org/w/api.php")
  url.searchParams.set("action", "query")
  url.searchParams.set("titles", title)
  url.searchParams.set("prop", "pageimages|info")
  url.searchParams.set("inprop", "url")
  url.searchParams.set("pithumbsize", "1200")
  url.searchParams.set("format", "json")
  url.searchParams.set("origin", "*")

  const response = await fetch(url, { signal: withTimeoutSignal() })
  if (!response.ok) return null
  const data = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string
          fullurl?: string
          thumbnail?: { source?: string }
          missing?: string
        }
      >
    }
  }

  const page = Object.values(data.query?.pages || {}).find(
    (item) =>
      !item.missing &&
      item.title &&
      item.thumbnail?.source &&
      isHttpUrl(item.thumbnail.source) &&
      titleMatchesFood(item.title, foodName)
  )
  if (!page?.thumbnail?.source || !page.title) return null

  return {
    imageUrl: page.thumbnail.source,
    imageAttribution: `Wikipedia: ${page.title}`,
    imageAttributionUrl: page.fullurl || "https://es.wikipedia.org",
    source: "wikipedia-title",
  }
}

const safeProviderError = (res: Response, prefix: string, detail: string) => {
  if (process.env.NODE_ENV === "production") {
    res.status(502).json({ error: `${prefix} error` })
    return
  }
  res.status(502).json({ error: `${prefix} error`, detail })
}

const ensureProfileAccess = async (
  res: Response,
  shareCode?: string,
  profileId?: string
) => {
  if (!aiRequiresProfileLink) return true
  if (!isValidToken(shareCode) || !isValidToken(profileId)) {
    res.status(400).json({ error: "shareCode and profileId are required" })
    return false
  }
  const profileExists = await pool.query(
    "select 1 from profile_snapshots where share_code = $1 and profile_id = $2 limit 1",
    [shareCode, profileId]
  )
  if (profileExists.rowCount === 0) {
    res.status(403).json({ error: "profile link not found" })
    return false
  }
  return true
}

const searchWikipediaImage = async (
  query: string,
  foodName: string,
  limit = 6
): Promise<ImageCandidate[]> => {
  const url = new URL("https://es.wikipedia.org/w/api.php")
  url.searchParams.set("action", "query")
  url.searchParams.set("generator", "search")
  url.searchParams.set("gsrsearch", query)
  url.searchParams.set("gsrlimit", "8")
  url.searchParams.set("prop", "pageimages|info")
  url.searchParams.set("inprop", "url")
  url.searchParams.set("pithumbsize", "1200")
  url.searchParams.set("format", "json")
  url.searchParams.set("origin", "*")

  const response = await fetch(url, { signal: withTimeoutSignal() })
  if (!response.ok) return []
  const data = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string
          fullurl?: string
          thumbnail?: { source?: string }
        }
      >
    }
  }
  const pages = Object.values(data.query?.pages || {})
  return pages
    .filter(
      (page) =>
        page.thumbnail?.source &&
        page.title &&
        isHttpUrl(page.thumbnail.source) &&
        titleMatchesFood(page.title, foodName)
    )
    .slice(0, limit)
    .map((page) => ({
      imageUrl: page.thumbnail?.source || "",
      imageAttribution: `Wikipedia: ${page.title || query}`,
      imageAttributionUrl: page.fullurl || "https://es.wikipedia.org",
      source: "wikipedia",
    }))
    .filter((item) => Boolean(item.imageUrl))
}

const searchOpenverseImage = async (
  query: string,
  foodName: string,
  limit = 6
): Promise<ImageCandidate[]> => {
  const url = new URL("https://api.openverse.org/v1/images/")
  url.searchParams.set("q", query)
  url.searchParams.set("page_size", "10")
  url.searchParams.set("license_type", "commercial")

  const response = await fetch(url, { signal: withTimeoutSignal() })
  if (!response.ok) return []
  const data = (await response.json()) as {
    results?: {
      url?: string
      title?: string
      creator?: string
      foreign_landing_url?: string
    }[]
  }
  return (data.results || [])
    .filter(
      (item) =>
        isHttpUrl(item.url) &&
        Boolean(item.title) &&
        titleMatchesFood(item.title || "", foodName)
    )
    .slice(0, limit)
    .map((candidate) => {
      const title = candidate.title || query
      const creator = candidate.creator ? ` - ${candidate.creator}` : ""
      return {
        imageUrl: candidate.url || "",
        imageAttribution: `Openverse: ${title}${creator}`,
        imageAttributionUrl: candidate.foreign_landing_url || candidate.url || "",
        source: "openverse",
      }
    })
    .filter((item) => Boolean(item.imageUrl))
}

const uniqueCandidates = (candidates: ImageCandidate[], limit = 12) => {
  const seen = new Set<string>()
  const output: ImageCandidate[] = []
  for (const item of candidates) {
    const key = item.imageUrl.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    output.push(item)
    if (output.length >= limit) break
  }
  return output
}

const getImageCandidates = async (safeName: string, safeFamily: string) => {
  const queries = [safeName, `${safeName} ${safeFamily}`]
  const titleCandidates = Array.from(
    new Set([safeName, toTitleCase(safeName), `${toTitleCase(safeName)} (alimento)`])
  )
  const candidates: ImageCandidate[] = []

  for (const title of titleCandidates) {
    const result = await searchWikipediaByTitle(title, safeName)
    if (result) candidates.push(result)
  }
  for (const query of queries) {
    const result = await searchWikipediaImage(query, safeName, 6)
    candidates.push(...result)
  }
  for (const query of queries) {
    const result = await searchOpenverseImage(query, safeName, 6)
    candidates.push(...result)
  }

  return uniqueCandidates(candidates, 12)
}

router.post(
  "/food",
  async (req: Request<unknown, unknown, AiBody>, res: Response) => {
    const { name, family, allergens, shareCode, profileId } = req.body
    const safeName = (name || "").trim()
    const safeFamily = (family || "").trim()
    if (!safeName || !safeFamily) {
      res.status(400).json({ error: "name and family are required" })
      return
    }
    if (safeName.length > 120 || safeFamily.length > 80) {
      res.status(400).json({ error: "name or family too long" })
      return
    }
    if (allergens && (!Array.isArray(allergens) || allergens.length > 12)) {
      res.status(400).json({ error: "allergens is invalid" })
      return
    }
    const hasAccess = await ensureProfileAccess(res, shareCode, profileId)
    if (!hasAccess) return

    const allergenText = (allergens || []).length
      ? "Alergenos: " + (allergens || []).join(", ") + "."
      : "Sin alergenos."

    const system =
      "Eres un asistente para una app de alimentacion infantil. Escribe en Espanol (Espana), texto breve y util. No des consejos medicos ni instrucciones clinicas. Incluye un disclaimer corto de 1 frase."

    const prompt = [
      `Alimento: ${safeName}. Familia: ${safeFamily}. ${allergenText} Genera:`,
      "1) Una descripcion o curiosidad breve (1-2 frases).",
      "2) Posibles reacciones tipicas (1-2 frases, generales, sin alarmismo).",
      "Responde en JSON con las claves: description, reactions.",
    ].join("\n")

    try {
      if (provider === "ollama") {
        const { baseUrl, apiKey, model } = getOllamaConfig()
        if (!apiKey) {
          res.status(500).json({ error: "OLLAMA_API_KEY not configured" })
          return
        }
        const response = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + apiKey,
            "Content-Type": "application/json",
          },
          signal: withTimeoutSignal(),
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
            stream: false,
          }),
        })

        if (!response.ok) {
          const text = await response.text()
          safeProviderError(res, "Ollama", text)
          return
        }

        const data = (await response.json()) as {
          message?: { content?: string }
        }
        const content = data.message?.content || ""
        const parsed = parseAiJson(content)

        res.json({
          description: parsed.description || "",
          reactions: parsed.reactions || "",
          model,
        })
        return
      }

      if (provider === "claude") {
        const { apiKey, model } = getAnthropicConfig()
        if (!apiKey) {
          res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" })
          return
        }
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          signal: withTimeoutSignal(),
          body: JSON.stringify({
            model,
            max_tokens: 200,
            messages: [{ role: "user", content: prompt }],
            system,
          }),
        })

        if (!response.ok) {
          const text = await response.text()
          safeProviderError(res, "Anthropic", text)
          return
        }

        const data = (await response.json()) as {
          content?: { text?: string }[]
        }
        const content = data.content?.[0]?.text || ""
        const parsed = parseAiJson(content)

        res.json({
          description: parsed.description || "",
          reactions: parsed.reactions || "",
          model,
        })
        return
      }

      if (provider === "gemini") {
        const { apiKey, model } = getGeminiConfig()
        if (!apiKey) {
          res.status(500).json({ error: "GEMINI_API_KEY not configured" })
          return
        }
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: withTimeoutSignal(),
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              systemInstruction: { parts: [{ text: system }] },
            }),
          }
        )

        if (!response.ok) {
          const text = await response.text()
          safeProviderError(res, "Gemini", text)
          return
        }

        const data = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[]
        }
        const content =
          data.candidates?.[0]?.content?.parts?.[0]?.text || ""
        const parsed = parseAiJson(content)

        res.json({
          description: parsed.description || "",
          reactions: parsed.reactions || "",
          model,
        })
        return
      }

      const { baseUrl, apiKey, model } = getOpenAiConfig()
      if (!apiKey) {
        res.status(500).json({ error: "OPENAI_API_KEY not configured" })
        return
      }
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
          "Content-Type": "application/json",
        },
        signal: withTimeoutSignal(),
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          temperature: 0.5,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        safeProviderError(res, "OpenAI-compatible", text)
        return
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[]
      }
      const content = data.choices?.[0]?.message?.content || ""
      const parsed = parseAiJson(content)

      res.json({
        description: parsed.description || "",
        reactions: parsed.reactions || "",
        model,
      })
    } catch {
      res.status(502).json({ error: "AI request failed" })
    }
  }
)

router.post(
  "/image-attribution",
  async (req: Request<unknown, unknown, AiBody>, res: Response) => {
    const { imageUrl, shareCode, profileId } = req.body
    const safeImageUrl = (imageUrl || "").trim()
    if (!isHttpUrl(safeImageUrl)) {
      res.status(400).json({ error: "imageUrl must be a valid http/https URL" })
      return
    }

    const hasAccess = await ensureProfileAccess(res, shareCode, profileId)
    if (!hasAccess) return

    try {
      const attribution = inferAttributionFromImageUrl(safeImageUrl)
      res.json(attribution)
    } catch {
      res.status(400).json({ error: "imageUrl is invalid" })
    }
  }
)

router.post(
  "/food-images",
  async (req: Request<unknown, unknown, AiBody>, res: Response) => {
    const { name, family, shareCode, profileId } = req.body
    const safeName = (name || "").trim()
    const safeFamily = (family || "").trim()
    if (!safeName || !safeFamily) {
      res.status(400).json({ error: "name and family are required" })
      return
    }
    if (safeName.length > 120 || safeFamily.length > 80) {
      res.status(400).json({ error: "name or family too long" })
      return
    }

    const hasAccess = await ensureProfileAccess(res, shareCode, profileId)
    if (!hasAccess) return

    try {
      const candidates = await getImageCandidates(safeName, safeFamily)
      if (candidates.length === 0) {
        res.status(404).json({ error: "No image found" })
        return
      }
      res.json({ candidates })
    } catch {
      res.status(502).json({ error: "Image search failed" })
    }
  }
)

router.post(
  "/food-image",
  async (req: Request<unknown, unknown, AiBody>, res: Response) => {
    const { name, family, shareCode, profileId } = req.body
    const safeName = (name || "").trim()
    const safeFamily = (family || "").trim()
    if (!safeName || !safeFamily) {
      res.status(400).json({ error: "name and family are required" })
      return
    }
    if (safeName.length > 120 || safeFamily.length > 80) {
      res.status(400).json({ error: "name or family too long" })
      return
    }

    const hasAccess = await ensureProfileAccess(res, shareCode, profileId)
    if (!hasAccess) return

    try {
      const candidates = await getImageCandidates(safeName, safeFamily)
      if (candidates[0]) {
        res.json(candidates[0])
        return
      }
      res.status(404).json({ error: "No image found" })
    } catch {
      res.status(502).json({ error: "Image search failed" })
    }
  }
)
