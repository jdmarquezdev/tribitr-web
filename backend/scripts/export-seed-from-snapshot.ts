import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
import { Pool } from "pg"

type SnapshotFoodState = {
  customImageUrl?: string
  customImageAttribution?: string
  customImageAttributionUrl?: string
  description?: string
}

type SnapshotFood = {
  id: string
  name: string
  family: string
  allergens: string[]
  seedDescription?: string
  imageUrl?: string
  imageAttribution?: string
  imageAttributionUrl?: string
}

type ProfileSnapshot = {
  foods?: Record<string, SnapshotFoodState>
  customFoods?: Record<string, SnapshotFood>
  order?: string[]
  familyOrder?: string[]
  familyOverrides?: Record<
    string,
    {
      imageUrl?: string
      imageAttribution?: string
      imageAttributionUrl?: string
    }
  >
}

type SeedData = {
  foods: SnapshotFood[]
  families?: {
    family: string
    imageUrl?: string
    imageAttribution?: string
    imageAttributionUrl?: string
  }[]
  all?: {
    imageUrl?: string
    imageAttribution?: string
    imageAttributionUrl?: string
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..", "..")
const backendDir = path.resolve(__dirname, "..")
const seedPath = path.join(rootDir, "src", "data", "foods.seed.json")

dotenv.config({ path: path.join(backendDir, ".env") })

const parseArg = (name: string) => {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (!match) return ""
  return match.split("=").slice(1).join("=").trim()
}

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
}

const toSeedFood = (
  id: string,
  base: SnapshotFood,
  state: SnapshotFoodState | undefined
): SnapshotFood => {
  const customImageUrl = String(state?.customImageUrl || "").trim()
  const hasCustomImage = Boolean(customImageUrl)
  return {
    id,
    name: String(base.name || "").trim(),
    family: String(base.family || "").trim(),
    allergens: normalizeStringArray(base.allergens),
    seedDescription:
      String(state?.description || "").trim() || String(base.seedDescription || "").trim(),
    imageUrl: hasCustomImage ? customImageUrl : String(base.imageUrl || "").trim(),
    imageAttribution: hasCustomImage
      ? String(state?.customImageAttribution || "").trim()
      : String(base.imageAttribution || "").trim(),
    imageAttributionUrl: hasCustomImage
      ? String(state?.customImageAttributionUrl || "").trim()
      : String(base.imageAttributionUrl || "").trim(),
  }
}

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no esta definido en backend/.env")
  }

  const shareCodeArg = parseArg("shareCode")
  const profileIdArg = parseArg("profileId")
  if ((shareCodeArg && !profileIdArg) || (!shareCodeArg && profileIdArg)) {
    throw new Error("Debes pasar ambos flags o ninguno: --shareCode=... --profileId=...")
  }

  const pool = new Pool({ connectionString: databaseUrl })
  try {
    const query = shareCodeArg
      ? {
          text: "select snapshot, share_code, profile_id, revision, updated_at from profile_snapshots where share_code = $1 and profile_id = $2 order by updated_at desc limit 1",
          values: [shareCodeArg, profileIdArg],
        }
      : {
          text: "select snapshot, share_code, profile_id, revision, updated_at from profile_snapshots order by updated_at desc limit 1",
          values: [] as string[],
        }

    const result = await pool.query(query.text, query.values)
    if (result.rowCount === 0) {
      throw new Error("No se encontro snapshot para exportar")
    }

    const row = result.rows[0] as {
      snapshot: ProfileSnapshot
      share_code: string
      profile_id: string
      revision: number
      updated_at: string
    }
    const snapshot = row.snapshot || {}

    const currentSeed = JSON.parse(fs.readFileSync(seedPath, "utf8")) as SeedData
    const seedFoods = Array.isArray(currentSeed.foods) ? currentSeed.foods : []
    const seedById = new Map(seedFoods.map((food) => [food.id, food]))
    const customFoods = snapshot.customFoods || {}
    const order = normalizeStringArray(snapshot.order)

    const ids = Array.from(
      new Set([...order, ...seedFoods.map((food) => food.id), ...Object.keys(customFoods)])
    )

    const foods = ids
      .map((id) => {
        const base = customFoods[id] || seedById.get(id)
        if (!base) return null
        return toSeedFood(id, base, snapshot.foods?.[id])
      })
      .filter((food): food is SnapshotFood => Boolean(food && food.id && food.name && food.family))

    const existingFamilies = new Map(
      (currentSeed.families || []).map((item) => [String(item.family), item])
    )
    const familyOverrides = snapshot.familyOverrides || {}
    const familyOrder = normalizeStringArray(snapshot.familyOrder)
    const familySet = new Set([
      ...familyOrder,
      ...foods.map((food) => food.family),
      ...existingFamilies.keys(),
    ])

    const families = Array.from(familySet)
      .sort((left, right) => {
        const leftIndex = familyOrder.indexOf(left)
        const rightIndex = familyOrder.indexOf(right)
        const leftRank = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex
        const rightRank = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex
        if (leftRank !== rightRank) return leftRank - rightRank
        return left.localeCompare(right, "es", { sensitivity: "base" })
      })
      .map((family) => {
        const override = familyOverrides[family] || {}
        const existing =
          (existingFamilies.get(family) as {
            imageUrl?: string
            imageAttribution?: string
            imageAttributionUrl?: string
          }) || {}
        return {
          family,
          imageUrl: String(override.imageUrl || existing.imageUrl || "").trim(),
          imageAttribution: String(
            override.imageAttribution || existing.imageAttribution || ""
          ).trim(),
          imageAttributionUrl: String(
            override.imageAttributionUrl || existing.imageAttributionUrl || ""
          ).trim(),
        }
      })

    const nextSeed: SeedData = {
      foods,
      families,
      all: currentSeed.all || {
        imageUrl: "",
        imageAttribution: "",
        imageAttributionUrl: "",
      },
    }

    fs.writeFileSync(seedPath, `${JSON.stringify(nextSeed, null, 2)}\n`, "utf8")

    console.log(
      JSON.stringify(
        {
          ok: true,
          profileId: row.profile_id,
          shareCode: row.share_code,
          revision: row.revision,
          updatedAt: row.updated_at,
          foods: foods.length,
          families: families.length,
          output: seedPath,
        },
        null,
        2
      )
    )
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
