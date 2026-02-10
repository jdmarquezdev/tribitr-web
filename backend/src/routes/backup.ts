import { Router } from "express"
import type { Request, Response } from "express"
import { pool } from "../db.js"

type BackupRow = {
  profileId: string
  shareCode: string
  revision: number
  updatedAt: string
  snapshot: Record<string, unknown>
}

type BackupPayload = {
  exportedAt: string
  metadata: {
    appName: string
    appVersion: string
    schemaVersion: number
  }
  rows: BackupRow[]
}

type ImportBody = {
  backup?: BackupPayload
}

const router = Router()

const isNonEmptyString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

router.post("/export", async (req: Request, res: Response) => {
  const result = await pool.query(
    "select profile_id, share_code, revision, updated_at, snapshot from profile_snapshots order by updated_at desc"
  )

  const rows: BackupRow[] = result.rows.map((row: any) => ({
    profileId: String(row.profile_id),
    shareCode: String(row.share_code),
    revision: Number(row.revision || 0),
    updatedAt: new Date(row.updated_at).toISOString(),
    snapshot: isPlainObject(row.snapshot) ? row.snapshot : {},
  }))

  const backup: BackupPayload = {
    exportedAt: new Date().toISOString(),
    metadata: {
      appName: "Tribitr",
      appVersion: process.env.npm_package_version || "0.0.0",
      schemaVersion: 1,
    },
    rows,
  }

  res.json({ backup })
})

router.post("/import", async (req: Request<any, any, ImportBody, any>, res: Response) => {
  const backup = req.body?.backup
  if (!backup || !Array.isArray(backup.rows)) {
    res.status(400).json({ error: "backup.rows is required" })
    return
  }

  const parsedRows = backup.rows
    .map((row) => ({
      profileId: String(row.profileId || "").trim(),
      shareCode: String(row.shareCode || "").trim(),
      revision: Number(row.revision || 0),
      updatedAt: String(row.updatedAt || "").trim(),
      snapshot: isPlainObject(row.snapshot) ? row.snapshot : null,
    }))
    .filter((row) => row.snapshot)

  const invalid = parsedRows.some(
    (row) =>
      !isNonEmptyString(row.profileId) ||
      !isNonEmptyString(row.shareCode) ||
      !Number.isInteger(row.revision) ||
      row.revision < 0 ||
      !isNonEmptyString(row.updatedAt)
  )

  if (invalid) {
    res.status(400).json({ error: "backup format is invalid" })
    return
  }

  await pool.query("begin")
  try {
    await pool.query("delete from profile_snapshots")
    for (const row of parsedRows) {
      await pool.query(
        `insert into profile_snapshots (profile_id, share_code, snapshot, revision, updated_at)
         values ($1, $2, $3, $4, $5)`,
        [row.profileId, row.shareCode, row.snapshot, row.revision, row.updatedAt]
      )
    }
    await pool.query("commit")
    res.json({ ok: true, mode: "replace", importedRows: parsedRows.length })
  } catch (error) {
    await pool.query("rollback")
    res.status(500).json({
      error: "backup import failed",
      detail: error instanceof Error ? error.message : String(error),
    })
  }
})

export { router }
