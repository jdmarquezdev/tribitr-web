import "dotenv/config"
import { ensureSchema } from "./db.js"
import { createApp } from "./app.js"

const port = Number(process.env.PORT || 3001)

const app = createApp()

const start = async () => {
  await ensureSchema()
  app.listen(port, () => {
    console.log(`Tribitr backend listening on ${port}`)
  })
}

start().catch((error) => {
  console.error("Failed to start backend", error)
  process.exit(1)
})
