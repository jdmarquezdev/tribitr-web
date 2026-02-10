import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, it } from "node:test"
import request from "supertest"
import { createApp } from "./app.js"

const envBackup = { ...process.env }

const setTestEnv = () => {
  process.env.NODE_ENV = "test"
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/tribitr_test"
  process.env.CORS_ORIGINS = ""
  process.env.AI_REQUIRE_PROFILE_LINK = "false"
  process.env.API_RATE_LIMIT_MAX = "1000"
  process.env.SYNC_RATE_LIMIT_MAX = "1000"
  process.env.AI_RATE_LIMIT_MAX = "1000"
  process.env.FAIL_BLOCK_ENABLED = "true"
  process.env.FAIL_BLOCK_BASE_MS = "200"
  process.env.FAIL_BLOCK_MAX_MS = "1000"
  process.env.FAIL_BLOCK_RESET_MS = "2000"
  process.env.FAIL_BLOCK_SYNC_THRESHOLD = "2"
  process.env.FAIL_BLOCK_AI_THRESHOLD = "2"
}

describe("backend security middleware", () => {
  beforeEach(() => {
    setTestEnv()
  })

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      if (!(key in envBackup)) delete process.env[key]
    })
    Object.assign(process.env, envBackup)
  })

  it("returns 400 for invalid sync token format", async () => {
    const app = createApp()
    const response = await request(app)
      .post("/api/sync/pull")
      .send({ shareCode: "%%%", profileId: "bad*id" })

    assert.equal(response.status, 400)
    assert.match(String(response.body.error || ""), /invalid/i)
  })

  it("blocks repeated failed ai attempts with retry-after", async () => {
    const app = createApp()

    const first = await request(app).post("/api/ai/food").send({})
    const second = await request(app).post("/api/ai/food").send({})
    const third = await request(app).post("/api/ai/food").send({})

    assert.equal(first.status, 400)
    assert.equal(second.status, 400)
    assert.equal(third.status, 429)
    assert.ok(third.headers["retry-after"])
  })

  it("allows configured CORS origin", async () => {
    process.env.CORS_ORIGINS = "https://tribitr.example.com"
    const app = createApp()

    const response = await request(app)
      .post("/api/sync/pull")
      .set("Origin", "https://tribitr.example.com")
      .send({ shareCode: "bad" })

    assert.equal(response.status, 400)
    assert.equal(
      response.headers["access-control-allow-origin"],
      "https://tribitr.example.com"
    )
  })

  it("does not expose CORS header for disallowed origin", async () => {
    process.env.CORS_ORIGINS = "https://tribitr.example.com"
    const app = createApp()

    const response = await request(app)
      .post("/api/sync/pull")
      .set("Origin", "https://evil.example.com")
      .send({ shareCode: "bad" })

    assert.equal(response.status, 400)
    assert.equal(response.headers["access-control-allow-origin"], undefined)
  })
})
