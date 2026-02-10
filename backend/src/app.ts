import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import type { NextFunction, Request, Response } from "express"
import { router as syncRouter } from "./routes/sync.js"
import { router as aiRouter } from "./routes/ai.js"
import { router as backupRouter } from "./routes/backup.js"

const parseAllowedOrigins = () =>
  (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

const toPositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const isPrivateDevIp = (ip?: string) => {
  if (!ip) return false
  if (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("::ffff:10.") ||
    ip.startsWith("::ffff:192.168.")
  ) {
    return true
  }
  const match = ip.match(/^(?:172\.|::ffff:172\.)(\d{1,3})\./)
  if (!match?.[1]) return false
  const second = Number(match[1])
  return second >= 16 && second <= 31
}

type BlockEntry = {
  failures: number
  blockedUntil: number
  updatedAt: number
}

type ProgressiveBlockerOptions = {
  threshold: number
  baseBlockMs: number
  maxBlockMs: number
  resetMs: number
  shouldCountStatus: (statusCode: number) => boolean
}

const createProgressiveBlocker = ({
  threshold,
  baseBlockMs,
  maxBlockMs,
  resetMs,
  shouldCountStatus,
}: ProgressiveBlockerOptions) => {
  const entries = new Map<string, BlockEntry>()

  const clearExpired = () => {
    const now = Date.now()
    entries.forEach((entry, key) => {
      const isIdle = now - entry.updatedAt > resetMs
      const isUnblocked = entry.blockedUntil <= now
      if (isIdle && isUnblocked) entries.delete(key)
    })
  }

  const interval = setInterval(clearExpired, Math.max(10_000, resetMs))
  interval.unref()

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || "unknown"
    const now = Date.now()
    const current = entries.get(ip)
    if (current && now - current.updatedAt > resetMs && current.blockedUntil <= now) {
      entries.delete(ip)
    }

    const entry = entries.get(ip)
    if (entry && entry.blockedUntil > now) {
      const retryAfterSeconds = Math.ceil((entry.blockedUntil - now) / 1000)
      res.setHeader("Retry-After", String(retryAfterSeconds))
      res.status(429).json({ error: "Too many failed attempts. Retry later." })
      return
    }

    res.on("finish", () => {
      const statusCode = res.statusCode
      const currentEntry = entries.get(ip)
      const timestamp = Date.now()

      if (statusCode >= 200 && statusCode < 400) {
        entries.delete(ip)
        return
      }

      if (!shouldCountStatus(statusCode)) return

      const nextEntry: BlockEntry = currentEntry
        ? { ...currentEntry }
        : { failures: 0, blockedUntil: 0, updatedAt: timestamp }
      nextEntry.failures += 1
      nextEntry.updatedAt = timestamp

      if (nextEntry.failures >= threshold) {
        const multiplier = Math.max(0, nextEntry.failures - threshold)
        const blockMs = Math.min(maxBlockMs, baseBlockMs * 2 ** multiplier)
        nextEntry.blockedUntil = timestamp + blockMs
      }

      entries.set(ip, nextEntry)
    })

    next()
  }
}

export const createApp = () => {
  const app = express()
  app.set("trust proxy", 1)
  const isProduction = process.env.NODE_ENV === "production"
  const skipRateLimitInDev = process.env.SKIP_RATE_LIMIT_IN_DEV !== "false"
  const shouldSkipRateLimit = (req: Request) =>
    !isProduction && skipRateLimitInDev && isPrivateDevIp(req.ip)

  const securityAlertEnabled = process.env.SECURITY_ALERT_ENABLED !== "false"
  const securitySummaryEveryMs = toPositiveInt(
    process.env.SECURITY_ALERT_SUMMARY_MS,
    300_000
  )
  const securitySummaryThreshold = toPositiveInt(
    process.env.SECURITY_ALERT_SUMMARY_THRESHOLD,
    5
  )
  const securityCounters = new Map<string, number>()

  if (securityAlertEnabled) {
    const interval = setInterval(() => {
      const entries = Array.from(securityCounters.entries()).filter(
        ([, count]) => count >= securitySummaryThreshold
      )
      if (entries.length > 0) {
        const summary = entries
          .map(([key, count]) => `${key}=${count}`)
          .join(" ")
        console.warn(`[security-summary] ${summary}`)
      }
      securityCounters.clear()
    }, securitySummaryEveryMs)
    interval.unref()
  }

  const allowedOrigins = parseAllowedOrigins()

  const corsMiddleware = cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true)
        return
      }
      if (allowedOrigins.length === 0) {
        if (process.env.NODE_ENV !== "production") {
          callback(null, true)
          return
        }
        callback(new Error("CORS blocked"))
        return
      }
      callback(null, allowedOrigins.includes(origin))
    },
    methods: ["GET", "POST"],
    credentials: false,
  })

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: toPositiveInt(process.env.API_RATE_LIMIT_MAX, isProduction ? 600 : 5000),
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    handler: (_req, res) => {
      res
        .status(429)
        .json({ error: "Too many requests, try again later." })
    },
  })

  const syncLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: toPositiveInt(process.env.SYNC_RATE_LIMIT_MAX, isProduction ? 400 : 5000),
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: true,
    skip: shouldSkipRateLimit,
    handler: (_req, res) => {
      res
        .status(429)
        .json({ error: "Too many requests, try again later." })
    },
  })

  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: toPositiveInt(process.env.AI_RATE_LIMIT_MAX, isProduction ? 30 : 200),
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    handler: (_req, res) => {
      res
        .status(429)
        .json({ error: "Too many requests, try again later." })
    },
  })

  const failBlockEnabled = process.env.FAIL_BLOCK_ENABLED !== "false"
  const failBlockBaseMs = toPositiveInt(process.env.FAIL_BLOCK_BASE_MS, 60_000)
  const failBlockMaxMs = toPositiveInt(process.env.FAIL_BLOCK_MAX_MS, 30 * 60_000)
  const failBlockResetMs = toPositiveInt(process.env.FAIL_BLOCK_RESET_MS, 60 * 60_000)
  const failBlockSyncThreshold = toPositiveInt(
    process.env.FAIL_BLOCK_SYNC_THRESHOLD,
    8
  )
  const failBlockAiThreshold = toPositiveInt(process.env.FAIL_BLOCK_AI_THRESHOLD, 5)

  const syncFailBlocker = createProgressiveBlocker({
    threshold: failBlockSyncThreshold,
    baseBlockMs: failBlockBaseMs,
    maxBlockMs: failBlockMaxMs,
    resetMs: failBlockResetMs,
    shouldCountStatus: (statusCode) => [400, 401, 403, 404].includes(statusCode),
  })

  const aiFailBlocker = createProgressiveBlocker({
    threshold: failBlockAiThreshold,
    baseBlockMs: failBlockBaseMs,
    maxBlockMs: failBlockMaxMs,
    resetMs: failBlockResetMs,
    shouldCountStatus: (statusCode) => [400, 401, 403].includes(statusCode),
  })

  app.use(helmet())
  app.use(corsMiddleware)
  app.use(express.json({ limit: "2mb" }))

  if (securityAlertEnabled) {
    app.use((req, res, next) => {
      res.on("finish", () => {
        if (![403, 429].includes(res.statusCode)) return
        const key = `${res.statusCode}:${req.method}:${req.path}`
        const current = securityCounters.get(key) || 0
        securityCounters.set(key, current + 1)
        const forwarded = req.headers["x-forwarded-for"]
        const source =
          typeof forwarded === "string"
            ? forwarded.split(",")[0]?.trim() || req.ip
            : req.ip
        console.warn(
          `[security] status=${res.statusCode} method=${req.method} path=${req.path} ip=${source}`
        )
      })
      next()
    })
  }

  app.use("/api", apiLimiter)

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true })
  })

  app.use(
    "/api/sync",
    ...(failBlockEnabled ? [syncFailBlocker] : []),
    syncLimiter,
    syncRouter
  )
  app.use(
    "/api/ai",
    ...(failBlockEnabled ? [aiFailBlocker] : []),
    aiLimiter,
    aiRouter
  )
  app.use("/api/backup", backupRouter)

  return app
}
