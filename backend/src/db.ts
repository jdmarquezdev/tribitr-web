import pg from "pg"

const { Pool } = pg

let poolInstance: pg.Pool | null = null

const getDatabaseUrl = () => {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required")
  }
  return databaseUrl
}

const getPool = () => {
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: getDatabaseUrl(),
    })
  }
  return poolInstance
}

export const pool = {
  query: (...args: any[]) => {
    const instance = getPool()
    return (instance.query as any).call(instance, ...args)
  },
}

export const ensureSchema = async () => {
  getDatabaseUrl()
  await pool.query(`
    create table if not exists profile_snapshots (
      profile_id text not null,
      share_code text not null,
      snapshot jsonb not null,
      revision integer not null,
      updated_at timestamptz not null default now(),
      primary key (profile_id, share_code)
    );
  `)
  await pool.query(
    "create index if not exists idx_profile_snapshots_share_code on profile_snapshots (share_code);"
  )
}
