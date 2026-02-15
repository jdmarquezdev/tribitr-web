import { openDB, DBSchema } from "idb"

export type ThemeMode = "light" | "dark" | "system"
export type AppLanguage = "es" | "en"

export type Profile = {
  id: string
  name: string
  shareCode: string
  babyName?: string
  babyBirthDate?: string
  correctedWeeks?: number
  updatedAt: string
}

export type FoodState = {
  foodId: string
  isHidden: boolean
  notes: string
  exposures: { checkedAt: string }[]
  customImageUrl?: string
  customImageAttribution?: string
  customImageAttributionUrl?: string
  imageGeneratedAt?: string
  imageSource?: string
  description?: string
  reactions?: string
  descriptionGeneratedAt?: string
  descriptionModel?: string
  updatedAt: string
}

export type ProfileSnapshot = {
  schemaVersion: number
  profileId: string
  profileName: string
  shareCode: string
  babyName?: string
  babyBirthDate?: string
  correctedWeeks?: number
  revision: number
  updatedAt: string
  settings: {
    theme: ThemeMode
    language: AppLanguage
    hideIntroduced: boolean
    showHidden: boolean
    showNotSuitableFoods?: boolean
  }
  foods: Record<string, FoodState>
  customFoods?: Record<
    string,
    {
      id: string
      name: string
      family: string
      allergens: string[]
      imageUrl: string
      imageAttribution?: string
      imageAttributionUrl?: string
    }
  >
  customFamilies?: string[]
  familyOrder?: string[]
  familyOverrides?: Record<
    string,
    {
      imageUrl: string
      imageAttribution?: string
      imageAttributionUrl?: string
      imageSource?: string
    }
  >
  order: string[]
  meta: {
    orderUpdatedAt?: string
  }
}

export const SNAPSHOT_SCHEMA_VERSION = 1

type TribitrDB = DBSchema & {
  profiles: {
    key: string
    value: Profile
  }
  snapshots: {
    key: string
    value: ProfileSnapshot
  }
  seed: {
    key: string
    value: { version: number; appliedAt: string }
  }
  ui: {
    key: string
    value: Record<string, unknown>
  }
}

const dbPromise = openDB<TribitrDB>("tribitr", 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("profiles")) {
      db.createObjectStore("profiles", { keyPath: "id" })
    }
    if (!db.objectStoreNames.contains("snapshots")) {
      db.createObjectStore("snapshots", { keyPath: "profileId" })
    }
    if (!db.objectStoreNames.contains("seed")) {
      db.createObjectStore("seed")
    }
    if (!db.objectStoreNames.contains("ui")) {
      db.createObjectStore("ui")
    }
  },
})

export const getProfiles = async () => {
  const db = await dbPromise
  return db.getAll("profiles")
}

export const saveProfiles = async (profiles: Profile[]) => {
  const db = await dbPromise
  const tx = db.transaction("profiles", "readwrite")
  const store = tx.objectStore("profiles")
  await store.clear()
  await Promise.all(profiles.map((profile) => store.put(profile)))
  await tx.done
}

export const getSnapshot = async (profileId: string) => {
  const db = await dbPromise
  return db.get("snapshots", profileId)
}

export const saveSnapshot = async (snapshot: ProfileSnapshot) => {
  const db = await dbPromise
  await db.put("snapshots", snapshot)
}

export const deleteSnapshot = async (profileId: string) => {
  const db = await dbPromise
  await db.delete("snapshots", profileId)
}
