import { Router } from "express"
import type { Request, Response } from "express"
import { pool } from "../db.js"

type SyncSnapshot = Record<string, unknown>

const shouldClearManualImage = (attribution: unknown) => {
  const normalized = String(attribution || "")
    .trim()
    .toLowerCase()
  return !normalized
}

const needsAttributionBackfill = (attribution: unknown) => {
  const normalized = String(attribution || "")
    .trim()
    .toLowerCase()
  return !normalized || normalized === "url manual"
}

const inferAttributionFromUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.toLowerCase()
    const sourceMap: { match: string; label: string; source: string }[] = [
      { match: "wikipedia.org", label: "Wikipedia", source: "wikipedia-url" },
      { match: "wikimedia.org", label: "Wikimedia Commons", source: "wikimedia-url" },
      { match: "unsplash.com", label: "Unsplash", source: "unsplash-url" },
      { match: "pexels.com", label: "Pexels", source: "pexels-url" },
      { match: "pixabay.com", label: "Pixabay", source: "pixabay-url" },
      { match: "openverse.org", label: "Openverse", source: "openverse-url" },
      { match: "pxhere.com", label: "pxhere", source: "pxhere-url" },
    ]
    const matched = sourceMap.find((item) => host.includes(item.match))
    const pathname = decodeURIComponent(url.pathname || "")
    const rawTitle = pathname.split("/").filter(Boolean).pop() || ""
    const title = rawTitle
      .replace(/\.[a-z0-9]{2,5}$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
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
  } catch {
    return null
  }
}

const normalizeSourceFromUrl = (rawUrl: string, currentSource: unknown) => {
  const current = String(currentSource || "").trim().toLowerCase()
  const legacyMap: Record<string, string> = {
    "manual-url-scan": "url-scan",
    "wikipedia-manual-url": "wikipedia-url",
    "wikimedia commons-manual-url": "wikimedia-url",
    "unsplash-manual-url": "unsplash-url",
    "pexels-manual-url": "pexels-url",
    "pixabay-manual-url": "pixabay-url",
    "openverse-manual-url": "openverse-url",
    "pxhere-manual-url": "pxhere-url",
  }
  if (legacyMap[current]) return legacyMap[current]

  const inferred = inferAttributionFromUrl(rawUrl)
  if (inferred?.source) {
    if (!current || current === "manual-url" || current === "url-scan") {
      return inferred.source
    }
  }

  return currentSource ? String(currentSource) : ""
}

const sanitizeSnapshotImages = (snapshot: SyncSnapshot): SyncSnapshot => {
  const next = JSON.parse(JSON.stringify(snapshot)) as SyncSnapshot
  const foods = (next.foods as Record<string, Record<string, unknown>>) || {}
  Object.values(foods).forEach((food) => {
    const hasCustomImage = String(food.customImageUrl || "").trim() !== ""
    if (!hasCustomImage) return
    const customImageUrl = String(food.customImageUrl || "").trim()
    if (/^https?:\/\//i.test(customImageUrl)) {
      food.imageSource = normalizeSourceFromUrl(customImageUrl, food.imageSource)
    }
    if (/^https?:\/\//i.test(customImageUrl) && needsAttributionBackfill(food.customImageAttribution)) {
      const inferred = inferAttributionFromUrl(customImageUrl)
      if (inferred) {
        food.customImageAttribution = inferred.imageAttribution
        food.customImageAttributionUrl = inferred.imageAttributionUrl
        food.imageSource = inferred.source
      }
    }
    if (!shouldClearManualImage(food.customImageAttribution)) return
    food.customImageUrl = ""
    food.customImageAttribution = ""
    food.customImageAttributionUrl = ""
    food.imageSource = ""
    food.imageGeneratedAt = ""
    food.updatedAt = new Date().toISOString()
  })
  next.foods = foods

  const familyOverrides =
    (next.familyOverrides as Record<string, Record<string, unknown>>) || {}
  Object.keys(familyOverrides).forEach((family) => {
    const item = familyOverrides[family] || {}
    const hasImage = String(item.imageUrl || "").trim() !== ""
    if (!hasImage) return
    const imageUrl = String(item.imageUrl || "").trim()
    if (/^https?:\/\//i.test(imageUrl)) {
      item.imageSource = normalizeSourceFromUrl(imageUrl, item.imageSource)
      if (needsAttributionBackfill(item.imageAttribution)) {
        const inferred = inferAttributionFromUrl(imageUrl)
        if (inferred) {
          item.imageAttribution = inferred.imageAttribution
          item.imageAttributionUrl = inferred.imageAttributionUrl
          item.imageSource = inferred.source
        }
      }
    }
    if (!shouldClearManualImage(item.imageAttribution)) return
    delete familyOverrides[family]
  })
  next.familyOverrides = familyOverrides

  return next
}

type PullBody = {
  shareCode?: string
  profileId?: string
}

type PushBody = {
  shareCode?: string
  profileId?: string
  baseRevision?: number
  snapshot?: SyncSnapshot
}

export const router = Router()

const tokenPattern = /^[a-zA-Z0-9_-]{8,128}$/

const isValidToken = (value?: string) => Boolean(value && tokenPattern.test(value))

const isValidSnapshot = (snapshot: unknown): snapshot is SyncSnapshot => {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return false
  try {
    return JSON.stringify(snapshot).length <= 1_000_000
  } catch {
    return false
  }
}

router.post("/pull", async (req: Request<unknown, unknown, PullBody>, res: Response) => {
  const { shareCode, profileId } = req.body
  if (!isValidToken(shareCode)) {
    res.status(400).json({ error: "shareCode format is invalid" })
    return
  }
  if (profileId && !isValidToken(profileId)) {
    res.status(400).json({ error: "profileId format is invalid" })
    return
  }

  const result = profileId
    ? await pool.query(
        "select snapshot, revision from profile_snapshots where share_code = $1 and profile_id = $2",
        [shareCode, profileId]
      )
    : await pool.query(
        "select snapshot, revision from profile_snapshots where share_code = $1 limit 1",
        [shareCode]
      )

  if (result.rowCount === 0) {
    res.status(404).json({ error: "not found" })
    return
  }

  res.json({ snapshot: result.rows[0].snapshot })
})

router.post("/push", async (req: Request<unknown, unknown, PushBody>, res: Response) => {
  const { shareCode, profileId, baseRevision, snapshot } = req.body
  if (!isValidToken(shareCode) || !isValidToken(profileId)) {
    res.status(400).json({ error: "shareCode or profileId format is invalid" })
    return
  }
  if (!isValidSnapshot(snapshot)) {
    res.status(400).json({ error: "snapshot is invalid" })
    return
  }
  if (typeof baseRevision !== "number" || !Number.isInteger(baseRevision) || baseRevision < 0) {
    res.status(400).json({ error: "baseRevision must be a positive integer" })
    return
  }
  if (!shareCode || !profileId || !snapshot) {
    res.status(400).json({ error: "shareCode, profileId and snapshot are required" })
    return
  }

  const sanitizedSnapshot = sanitizeSnapshotImages(snapshot)

  const existing = await pool.query(
    "select revision, snapshot from profile_snapshots where share_code = $1 and profile_id = $2",
    [shareCode, profileId]
  )

  if (existing.rowCount === 0) {
    const nextRevision = 1
    const snapshotToSave = {
      ...sanitizedSnapshot,
      revision: nextRevision,
      updatedAt: new Date().toISOString(),
    }
    await pool.query(
      "insert into profile_snapshots (profile_id, share_code, snapshot, revision, updated_at) values ($1, $2, $3, $4, now())",
      [profileId, shareCode, snapshotToSave, nextRevision]
    )
    res.json({ snapshot: snapshotToSave, revision: nextRevision })
    return
  }

  const currentRevision = Number(existing.rows[0].revision)
  if (baseRevision !== currentRevision) {
    res.status(409).json({
      snapshot: existing.rows[0].snapshot,
      revision: currentRevision,
      conflict: true,
    })
    return
  }

  const nextRevision = currentRevision + 1
  const snapshotToSave = {
    ...sanitizedSnapshot,
    revision: nextRevision,
    updatedAt: new Date().toISOString(),
  }

  await pool.query(
    "update profile_snapshots set snapshot = $1, revision = $2, updated_at = now() where share_code = $3 and profile_id = $4",
    [snapshotToSave, nextRevision, shareCode, profileId]
  )

  res.json({ snapshot: snapshotToSave, revision: nextRevision })
})
