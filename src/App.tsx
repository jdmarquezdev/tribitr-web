import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import QRCode from "qrcode"
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import seedData from "./data/foods.seed.json"
import packageInfo from "../package.json"
import {
  AppLanguage,
  FoodState,
  Profile,
  ProfileSnapshot,
  SNAPSHOT_SCHEMA_VERSION,
  ThemeMode,
  deleteSnapshot,
  getProfiles,
  getSnapshot,
  saveProfiles,
  saveSnapshot,
} from "./data/db"
import { createTranslator } from "./i18n"
import iconAdd from "./assets/material/add.svg"
import iconArrowBack from "./assets/material/arrow_back.svg"
import iconCheck from "./assets/material/check.svg"
import iconClose from "./assets/material/close.svg"
import iconContentCopy from "./assets/material/content_copy.svg"
import iconDelete from "./assets/material/delete.svg"
import iconDragIndicator from "./assets/material/drag_indicator.svg"
import iconErrorOutline from "./assets/material/error_outline.svg"
import iconFilterList from "./assets/material/filter_list.svg"
import iconQrCode from "./assets/material/qr_code.svg"
import iconSettings from "./assets/material/settings.svg"
import iconShare from "./assets/material/share.svg"
import iconSort from "./assets/material/sort.svg"
import iconSync from "./assets/material/sync.svg"

type FoodSeed = {
  id: string
  name: string
  family: string
  allergens: string[]
  recommendedFromMonths?: number
  imageUrl: string
  imageAttribution?: string
  imageAttributionUrl?: string
}

type FamilySeed = {
  family: string
  imageUrl: string
  imageAttribution?: string
  imageAttributionUrl?: string
}

type SeedData = {
  foods: FoodSeed[]
  families?: FamilySeed[]
  all?: {
    imageUrl: string
    imageAttribution?: string
    imageAttributionUrl?: string
  }
}

type ExportPayload = {
  exportedAt: string
  metadata: {
    appName: string
    appVersion: string
    schemaVersion: number
  }
  seed: SeedData
  snapshot: ProfileSnapshot
}

type FullBackupPayload = {
  exportedAt: string
  metadata: {
    appName: string
    appVersion: string
    schemaVersion: number
  }
  rows: {
    profileId: string
    shareCode: string
    revision: number
    updatedAt: string
    snapshot: Record<string, unknown>
  }[]
}

type ViewMode = "home" | "list" | "settings"

const AUTHOR_NAME = "Juan Diego Marquez Tebar"
const AUTHOR_EMAIL = "hola@jdmarquez.dev"
const AUTHOR_GITHUB_URL = "https://github.com/juandiegomarquez"
const AUTHOR_LINKEDIN_URL = "https://www.linkedin.com/in/juandiegomarquez/"

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M12 .297a12 12 0 0 0-3.793 23.386c.6.111.82-.259.82-.577v-2.234c-3.338.726-4.042-1.611-4.042-1.611a3.186 3.186 0 0 0-1.336-1.76c-1.091-.744.083-.729.083-.729a2.52 2.52 0 0 1 1.84 1.24 2.55 2.55 0 0 0 3.487.995 2.552 2.552 0 0 1 .762-1.598c-2.665-.3-5.466-1.333-5.466-5.93a4.64 4.64 0 0 1 1.235-3.222 4.31 4.31 0 0 1 .117-3.176s1.008-.322 3.301 1.23a11.38 11.38 0 0 1 6.004 0c2.291-1.552 3.297-1.23 3.297-1.23a4.31 4.31 0 0 1 .12 3.176 4.63 4.63 0 0 1 1.234 3.222c0 4.61-2.804 5.625-5.476 5.921a2.862 2.862 0 0 1 .817 2.22v3.293c0 .321.216.694.825.576A12.001 12.001 0 0 0 12 .297"
    />
  </svg>
)

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M20.447 20.452H16.89V14.87c0-1.331-.028-3.043-1.852-3.043-1.853 0-2.136 1.446-2.136 2.946v5.679H9.347V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.369-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.063 2.063 0 1 1 0-4.126 2.063 2.063 0 0 1 0 4.126zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729V22.27C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
    />
  </svg>
)

type MaterialMaskIconProps = {
  src: string
}

const MaterialMaskIcon = ({ src }: MaterialMaskIconProps) => {
  const style = {
    mask: `url("${src}") center / contain no-repeat`,
    WebkitMask: `url("${src}") center / contain no-repeat`,
    backgroundColor: "currentColor",
  } satisfies CSSProperties
  return <span aria-hidden="true" className="inline-block h-4 w-4 shrink-0" style={style} />
}

const CopyIcon = () => (
  <MaterialMaskIcon src={iconContentCopy} />
)

const ShareIcon = () => (
  <MaterialMaskIcon src={iconShare} />
)

const QrIcon = () => (
  <MaterialMaskIcon src={iconQrCode} />
)

const SyncIcon = () => (
  <MaterialMaskIcon src={iconSync} />
)

const AddIcon = () => (
  <MaterialMaskIcon src={iconAdd} />
)

const FilterListIcon = () => (
  <MaterialMaskIcon src={iconFilterList} />
)

const SortIcon = () => (
  <MaterialMaskIcon src={iconSort} />
)

const ArrowBackIcon = () => (
  <MaterialMaskIcon src={iconArrowBack} />
)

const ErrorOutlineIcon = () => (
  <MaterialMaskIcon src={iconErrorOutline} />
)

const DragIndicatorIcon = () => (
  <MaterialMaskIcon src={iconDragIndicator} />
)

const SettingsIcon = () => (
  <MaterialMaskIcon src={iconSettings} />
)

const CloseIcon = () => (
  <MaterialMaskIcon src={iconClose} />
)

const CheckIcon = () => (
  <MaterialMaskIcon src={iconCheck} />
)

const DeleteIcon = () => (
  <MaterialMaskIcon src={iconDelete} />
)

const parseBooleanFlag = (value?: string | null) => {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (["1", "true", "on", "yes"].includes(normalized)) return true
  if (["0", "false", "off", "no"].includes(normalized)) return false
  return null
}

const resolveFamilyHomeEnabled = () => {
  const envValue = parseBooleanFlag(import.meta.env.VITE_ENABLE_FAMILY_HOME)
  const queryValue = parseBooleanFlag(
    new URLSearchParams(window.location.search).get("families")
  )
  if (queryValue !== null) return queryValue
  if (envValue !== null) return envValue
  return true
}

const allergenIcon: Record<string, string> = {
  apio: "🥬",
  cacahuete: "🥜",
  crustaceos: "🦐",
  frutos_secos: "🌰",
  leche: "🥛",
  huevo: "🥚",
  gluten: "🌾",
  pescado: "🐟",
  moluscos: "🦪",
  mostaza: "🟡",
  sesamo: "🌱",
  soja: "🫘",
}

const allergenLabelByLanguage: Record<AppLanguage, Record<string, string>> = {
  es: {
    apio: "Apio",
    cacahuete: "Cacahuete",
    crustaceos: "Crustaceos",
    frutos_secos: "Frutos secos",
    gluten: "Gluten",
    huevo: "Huevo",
    leche: "Leche",
    moluscos: "Moluscos",
    mostaza: "Mostaza",
    pescado: "Pescado",
    sesamo: "Sesamo",
    soja: "Soja",
  },
  en: {
    apio: "Celery",
    cacahuete: "Peanut",
    crustaceos: "Crustaceans",
    frutos_secos: "Tree nuts",
    gluten: "Gluten",
    huevo: "Egg",
    leche: "Milk",
    moluscos: "Mollusks",
    mostaza: "Mustard",
    pescado: "Fish",
    sesamo: "Sesame",
    soja: "Soy",
  },
}

const renderAllergens = (allergens: string[], language: AppLanguage) => {
  if (!allergens.length) return language === "en" ? "No allergens" : "Sin alergenos"
  return (
    <span className="inline-flex items-center gap-1">
      {allergens.map((item) => (
        <span
          key={item}
          role="img"
          aria-label={allergenLabelByLanguage[language][item] || item}
          title={allergenLabelByLanguage[language][item] || item}
        >
          {allergenIcon[item] ?? "⚠️"}
        </span>
      ))}
    </span>
  )
}

const allergenLegend = [
  { key: "apio" },
  { key: "cacahuete" },
  { key: "crustaceos" },
  { key: "frutos_secos" },
  { key: "gluten" },
  { key: "huevo" },
  { key: "leche" },
  { key: "moluscos" },
  { key: "mostaza" },
  { key: "pescado" },
  { key: "sesamo" },
  { key: "soja" },
]

const formatFamily = (value: string) =>
  value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const createFoodId = (name: string, existingIds: Set<string>) => {
  const base = slugify(name) || "alimento"
  let candidate = base
  let count = 2
  while (existingIds.has(candidate)) {
    candidate = `${base}-${count}`
    count += 1
  }
  return candidate
}

const formatDateTime = (value: string, language: AppLanguage = "es") =>
  new Intl.DateTimeFormat(language === "en" ? "en-GB" : "es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))

const formatDateWithTimeSeconds = (value: string, language: AppLanguage = "es") =>
  new Intl.DateTimeFormat(language === "en" ? "en-GB" : "es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value))

const formatRelativeFromNow = (value: string, language: AppLanguage = "es") => {
  const diffMs = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(diffMs) || diffMs < 0) return language === "en" ? "now" : "ahora"
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return language === "en" ? "now" : "ahora"
  if (mins < 60) return language === "en" ? `${mins} min ago` : `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return language === "en" ? `${hours} h ago` : `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return language === "en" ? `${days} d ago` : `hace ${days} d`
}

const dayMs = 24 * 60 * 60 * 1000
const monthMs = 30.4375 * dayMs

const calculateCorrectedAgeMonths = (birthDate?: string, correctedWeeks = 0) => {
  if (!birthDate) return null
  const parsedBirthDate = new Date(`${birthDate}T12:00:00`)
  const birthMs = parsedBirthDate.getTime()
  if (!Number.isFinite(birthMs)) return null
  const correctionMs = Math.max(0, correctedWeeks) * 7 * dayMs
  const effectiveAgeMs = Date.now() - birthMs - correctionMs
  if (!Number.isFinite(effectiveAgeMs)) return null
  if (effectiveAgeMs <= 0) return 0
  return Math.floor(effectiveAgeMs / monthMs)
}

const getFoodSuitability = (
  recommendedFromMonths: number | undefined,
  ageMonths: number | null
) => {
  if (typeof recommendedFromMonths !== "number") {
    return {
      hasRecommendation: false,
      isTooEarly: false,
      isSuitable: true,
    }
  }
  if (ageMonths === null) {
    return {
      hasRecommendation: true,
      isTooEarly: false,
      isSuitable: true,
    }
  }
  return {
    hasRecommendation: true,
    isTooEarly: ageMonths < recommendedFromMonths,
    isSuitable: ageMonths >= recommendedFromMonths,
  }
}

const buildPlaceholderImage = (label: string) => {
  const initials = label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 240'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#d9f3df'/><stop offset='100%' stop-color='#bfe8cc'/></linearGradient></defs><rect width='320' height='240' rx='24' fill='url(#g)'/><circle cx='160' cy='95' r='34' fill='#ffffff' fill-opacity='0.9'/><rect x='96' y='140' width='128' height='42' rx='21' fill='#ffffff' fill-opacity='0.9'/><text x='160' y='222' text-anchor='middle' font-family='Arial, sans-serif' font-size='26' font-weight='700' fill='#2f6f44'>${initials || "TB"}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const getImageSrc = (url: string | undefined, label: string) => {
  const trimmed = (url || "").trim()
  if (trimmed) return trimmed
  return buildPlaceholderImage(label)
}

const inferImageAttributionFromUrl = (rawUrl: string) => {
  const fallback = {
    imageAttribution: "Fuente manual",
    imageAttributionUrl: "",
    source: "manual-url",
  }
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.toLowerCase()
    const knownSources: { match: string; label: string; source: string }[] = [
      { match: "wikipedia.org", label: "Wikipedia", source: "wikipedia-url" },
      { match: "wikimedia.org", label: "Wikimedia Commons", source: "wikimedia-url" },
      { match: "unsplash.com", label: "Unsplash", source: "unsplash-url" },
      { match: "pexels.com", label: "Pexels", source: "pexels-url" },
      { match: "pixabay.com", label: "Pixabay", source: "pixabay-url" },
      { match: "openverse.org", label: "Openverse", source: "openverse-url" },
      { match: "pxhere.com", label: "pxhere", source: "pxhere-url" },
    ]
    const matched = knownSources.find((item) => host.includes(item.match))
    return {
      imageAttribution: matched ? matched.label : `Fuente: ${host}`,
      imageAttributionUrl: `${url.protocol}//${url.host}`,
      source: matched ? matched.source : "url-scan",
    }
  } catch {
    return fallback
  }
}

const formatImageSourceLabel = (source?: string, language: AppLanguage = "es") => {
  const key = (source || "").trim().toLowerCase()
  if (!key) return ""
  const map: Record<string, string> =
    language === "en"
      ? {
          "manual-file": "Local file",
          "manual-url": "Manual URL",
          "manual-url-scan": "Detected URL",
          "url-scan": "Detected URL",
          "wikipedia-url": "Wikipedia",
          wikipedia: "Wikipedia",
          "wikipedia-title": "Wikipedia",
          "wikimedia-url": "Wikimedia Commons",
          "unsplash-url": "Unsplash",
          "pexels-url": "Pexels",
          "pixabay-url": "Pixabay",
          "openverse-url": "Openverse",
          openverse: "Openverse",
          "pxhere-url": "pxhere",
          "wikimedia commons-manual-url": "Wikimedia Commons",
          "ai-search": "AI search",
        }
      : {
          "manual-file": "Archivo local",
          "manual-url": "URL manual",
          "manual-url-scan": "URL detectada",
          "url-scan": "URL detectada",
          "wikipedia-url": "Wikipedia",
          wikipedia: "Wikipedia",
          "wikipedia-title": "Wikipedia",
          "wikimedia-url": "Wikimedia Commons",
          "unsplash-url": "Unsplash",
          "pexels-url": "Pexels",
          "pixabay-url": "Pixabay",
          "openverse-url": "Openverse",
          openverse: "Openverse",
          "pxhere-url": "pxhere",
          "wikimedia commons-manual-url": "Wikimedia Commons",
          "ai-search": "Busqueda IA",
        }
  return map[key] || source || ""
}

const AttributionTooltip = ({
  label,
  url,
  className,
}: {
  label: string
  url?: string
  className?: string
}) => {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const tooltipId = useId()

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current) return
      if (wrapperRef.current.contains(event.target as Node)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", closeOnOutside)
    document.addEventListener("touchstart", closeOnOutside)
    return () => {
      document.removeEventListener("mousedown", closeOnOutside)
      document.removeEventListener("touchstart", closeOnOutside)
    }
  }, [open])

  return (
    <div className={className || "relative"}>
      <div
        ref={wrapperRef}
        className="relative"
        onMouseLeave={() => setOpen(false)}
      >
        <span
          role="button"
          tabIndex={0}
          aria-label="Ver atribucion de la imagen"
          aria-expanded={open}
          aria-controls={tooltipId}
          title="Ver atribucion"
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-[var(--border)] text-[11px] text-[var(--muted)]"
          onMouseEnter={() => setOpen(true)}
          onFocus={() => setOpen(true)}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setOpen((prev) => !prev)
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return
            event.preventDefault()
            event.stopPropagation()
            setOpen((prev) => !prev)
          }}
        >
          i
        </span>
        <div
          id={tooltipId}
          role="tooltip"
          className={`absolute right-0 top-7 z-10 w-48 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 text-[11px] text-[var(--muted)] shadow-soft transition ${
            open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {url ? (
            <a className="underline" href={url} target="_blank" rel="noreferrer">
              Foto: {label}
            </a>
          ) : (
            <>Foto: {label}</>
          )}
        </div>
      </div>
    </div>
  )
}

const buildInitialState = (seed: FoodSeed[]) => {
  const now = new Date().toISOString()
  const state: Record<string, FoodState> = {}
  seed.forEach((food) => {
    state[food.id] = {
      foodId: food.id,
      isHidden: false,
      notes: "",
      exposures: [],
      customImageUrl: "",
      customImageAttribution: "",
      customImageAttributionUrl: "",
      imageGeneratedAt: "",
      imageSource: "",
      description: "",
      reactions: "",
      descriptionGeneratedAt: "",
      descriptionModel: "",
      updatedAt: now,
    }
  })
  return state
}

const seed = Array.isArray(seedData)
  ? ({ foods: seedData } as SeedData)
  : (seedData as SeedData)
const foodsSeed = seed.foods
const initialOrder = [...foodsSeed]
  .sort((left, right) =>
    left.name.localeCompare(right.name, "es", {
      sensitivity: "base",
    })
  )
  .map((food) => food.id)

const profilesSeed = [{ id: "profile-1", name: "Bebé" }]

const createShareCode = () => {
  if (crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, "")
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

const createSnapshot = (
  profile: Profile,
  foods: Record<string, FoodState> = buildInitialState(foodsSeed),
  customFoods: Record<string, FoodSeed> = {},
  customFamilies: string[] = [],
  familyOrder: string[] = [],
  familyOverrides: Record<string, FamilyOverride> = {},
  order: string[] = initialOrder,
  orderUpdatedAt = new Date().toISOString()
): ProfileSnapshot => {
  const now = new Date().toISOString()
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    profileId: profile.id,
    profileName: profile.name,
    shareCode: profile.shareCode,
    babyName: profile.babyName ?? "",
    babyBirthDate: profile.babyBirthDate ?? "",
    correctedWeeks: profile.correctedWeeks ?? 0,
    revision: 1,
    updatedAt: now,
    settings: {
      theme: "system",
      language: "es",
      hideIntroduced: false,
      showHidden: false,
      showNotSuitableFoods: false,
    },
    foods,
    customFoods,
    customFamilies,
    familyOrder,
    familyOverrides,
    order,
    meta: {
      orderUpdatedAt,
    },
  }
}

const normalizeFoods = (foods: Record<string, FoodState>) => {
  const normalized: Record<string, FoodState> = {}
  Object.entries(foods).forEach(([id, food]) => {
    const legacy = food as FoodState & {
      ai?: {
        description?: string
        reactions?: string
        generatedAt?: string
        model?: string
      }
    }
    const legacyDescription = legacy.ai?.description
    const legacyReactions = legacy.ai?.reactions
    const legacyGeneratedAt = legacy.ai?.generatedAt
    const legacyModel = legacy.ai?.model
    normalized[id] = {
      ...food,
      customImageUrl: food.customImageUrl ?? "",
      customImageAttribution: food.customImageAttribution ?? "",
      customImageAttributionUrl: food.customImageAttributionUrl ?? "",
      imageGeneratedAt: food.imageGeneratedAt ?? "",
      imageSource: food.imageSource ?? "",
      description: food.description ?? legacyDescription ?? "",
      reactions: food.reactions ?? legacyReactions ?? "",
      descriptionGeneratedAt:
        food.descriptionGeneratedAt ?? legacyGeneratedAt ?? "",
      descriptionModel: food.descriptionModel ?? legacyModel ?? "",
    }
  })
  return normalized
}

const normalizeCustomFoods = (
  customFoods?: Record<string, FoodSeed>
): Record<string, FoodSeed> => {
  if (!customFoods) return {}
  const normalized: Record<string, FoodSeed> = {}
  Object.entries(customFoods).forEach(([id, food]) => {
    if (!food?.name || !food?.family) return
    normalized[id] = {
      id,
      name: food.name,
      family: food.family,
      allergens: Array.isArray(food.allergens) ? food.allergens : [],
      imageUrl: food.imageUrl || "",
      imageAttribution: food.imageAttribution || "",
      imageAttributionUrl: food.imageAttributionUrl || "",
    }
  })
  return normalized
}

type FamilyOverride = {
  imageUrl: string
  imageAttribution?: string
  imageAttributionUrl?: string
  imageSource?: string
}

const normalizeFamilyList = (families?: string[]) => {
  if (!Array.isArray(families)) return []
  const normalized = families
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  return Array.from(new Set(normalized))
}

const normalizeFamilyOverrides = (
  overrides?: Record<string, FamilyOverride>
): Record<string, FamilyOverride> => {
  if (!overrides) return {}
  const normalized: Record<string, FamilyOverride> = {}
  Object.entries(overrides).forEach(([family, data]) => {
    const key = family.trim().toLowerCase()
    if (!key || !data?.imageUrl) return
    normalized[key] = {
      imageUrl: data.imageUrl,
      imageAttribution: data.imageAttribution || "",
      imageAttributionUrl: data.imageAttributionUrl || "",
      imageSource: data.imageSource || "",
    }
  })
  return normalized
}

const getOrderUpdatedAt = (snapshot?: ProfileSnapshot) => {
  if (!snapshot) return ""
  return snapshot.meta?.orderUpdatedAt || snapshot.updatedAt || ""
}

const toTimestamp = (value?: string) => {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const mergeExposures = (
  left: { checkedAt: string }[] = [],
  right: { checkedAt: string }[] = []
) => {
  const all = [...left, ...right].filter((item) => item?.checkedAt)
  const unique = Array.from(new Set(all.map((item) => item.checkedAt))).map(
    (checkedAt) => ({ checkedAt })
  )
  unique.sort((a, b) => toTimestamp(a.checkedAt) - toTimestamp(b.checkedAt))
  return unique.slice(0, 3)
}

const mergeFoodState = (localFood: FoodState, remoteFood: FoodState): FoodState => {
  const localTime = toTimestamp(localFood.updatedAt)
  const remoteTime = toTimestamp(remoteFood.updatedAt)
  const newer = localTime >= remoteTime ? localFood : remoteFood
  const older = localTime >= remoteTime ? remoteFood : localFood
  const newerAiTime = toTimestamp(newer.descriptionGeneratedAt)
  const olderAiTime = toTimestamp(older.descriptionGeneratedAt)
  const aiSource = newerAiTime >= olderAiTime ? newer : older

  return {
    ...newer,
    exposures: mergeExposures(localFood.exposures, remoteFood.exposures),
    customImageUrl: newer.customImageUrl || older.customImageUrl || "",
    customImageAttribution:
      newer.customImageAttribution || older.customImageAttribution || "",
    customImageAttributionUrl:
      newer.customImageAttributionUrl || older.customImageAttributionUrl || "",
    imageGeneratedAt: newer.imageGeneratedAt || older.imageGeneratedAt || "",
    imageSource: newer.imageSource || older.imageSource || "",
    description: aiSource.description ?? "",
    reactions: aiSource.reactions ?? "",
    descriptionGeneratedAt: aiSource.descriptionGeneratedAt ?? "",
    descriptionModel: aiSource.descriptionModel ?? "",
    updatedAt:
      localTime >= remoteTime
        ? localFood.updatedAt || remoteFood.updatedAt
        : remoteFood.updatedAt || localFood.updatedAt,
  }
}

const mergeSnapshots = (
  local: ProfileSnapshot,
  remote: ProfileSnapshot
): ProfileSnapshot => {
  const mergedFoods: Record<string, FoodState> = {}
  const allFoodIds = new Set([
    ...Object.keys(local.foods),
    ...Object.keys(remote.foods),
  ])
  allFoodIds.forEach((id) => {
    const localFood = local.foods[id]
    const remoteFood = remote.foods[id]
    if (!localFood && remoteFood) {
      mergedFoods[id] = remoteFood
      return
    }
    if (localFood && !remoteFood) {
      mergedFoods[id] = localFood
      return
    }
    if (!localFood || !remoteFood) return
    mergedFoods[id] = mergeFoodState(localFood, remoteFood)
  })

  const localOrderTime = Date.parse(getOrderUpdatedAt(local))
  const remoteOrderTime = Date.parse(getOrderUpdatedAt(remote))
  const mergedOrder =
    localOrderTime >= remoteOrderTime ? local.order : remote.order

  const localUpdatedAt = Date.parse(local.updatedAt)
  const remoteUpdatedAt = Date.parse(remote.updatedAt)
  const settings =
    localUpdatedAt >= remoteUpdatedAt ? local.settings : remote.settings
  const newestSnapshot = localUpdatedAt >= remoteUpdatedAt ? local : remote

  const mergedCustomFoods = {
    ...normalizeCustomFoods(local.customFoods as Record<string, FoodSeed>),
    ...normalizeCustomFoods(remote.customFoods as Record<string, FoodSeed>),
  }
  const mergedCustomFamilies = Array.from(
    new Set([
      ...normalizeFamilyList(local.customFamilies),
      ...normalizeFamilyList(remote.customFamilies),
    ])
  )
  const mergedFamilyOverrides = {
    ...normalizeFamilyOverrides(local.familyOverrides as Record<string, FamilyOverride>),
    ...normalizeFamilyOverrides(remote.familyOverrides as Record<string, FamilyOverride>),
  }
  const localFamilyOrder = normalizeFamilyList(local.familyOrder)
  const remoteFamilyOrder = normalizeFamilyList(remote.familyOrder)
  const mergedFamilyOrder =
    localFamilyOrder.length === 0 && remoteFamilyOrder.length > 0
      ? remoteFamilyOrder
      : remoteFamilyOrder.length === 0 && localFamilyOrder.length > 0
        ? localFamilyOrder
        : localUpdatedAt >= remoteUpdatedAt
          ? localFamilyOrder
          : remoteFamilyOrder

  return {
    ...remote,
    profileName: remote.profileName || local.profileName,
    shareCode: remote.shareCode || local.shareCode,
    babyName: newestSnapshot.babyName || "",
    babyBirthDate: newestSnapshot.babyBirthDate || "",
    correctedWeeks: newestSnapshot.correctedWeeks ?? 0,
    foods: normalizeFoods(mergedFoods),
    customFoods: mergedCustomFoods,
    customFamilies: mergedCustomFamilies,
    familyOrder: mergedFamilyOrder,
    familyOverrides: mergedFamilyOverrides,
    order: mergedOrder,
    settings,
    updatedAt:
      localUpdatedAt >= remoteUpdatedAt ? local.updatedAt : remote.updatedAt,
    meta: {
      orderUpdatedAt:
        localOrderTime >= remoteOrderTime
          ? getOrderUpdatedAt(local)
          : getOrderUpdatedAt(remote),
    },
  }
}

type SortableRowProps = {
  food: FoodSeed
  state: FoodState
  language: AppLanguage
  ageMonths: number | null
  onToggleExposure: (id: string, index: number) => void
  onOpen: (id: string) => void
}

type PillMenuOption = {
  value: string
  label: string
}

type PillMenuProps = {
  icon?: ReactNode
  value: string
  options: PillMenuOption[]
  ariaLabel: string
  onChange: (value: string) => void
  minWidthClass?: string
  buttonClassName?: string
  menuClassName?: string
}

type SortableFamilyRowProps = {
  family: string
  language: AppLanguage
  foodCount: number
  hasCustomImage: boolean
  imageLoading: boolean
  imageError?: string
  onGenerateImage: (family: string) => void
  onOpenImagePicker: (family: string) => void
  onClearImage: (family: string) => void
  onRemoveFamily: (family: string) => void
}

type UndoToast = {
  message: string
  undo: () => void
}

type OnboardingStep = {
  id: string
  title: string
  description: string
  selector: string
  view: ViewMode
  placement?: "auto" | "above" | "below"
  beforeStep?: () => void
}

const SortableFoodRow = ({
  food,
  state,
  language,
  ageMonths,
  onToggleExposure,
  onOpen,
}: SortableRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: food.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const progress = state.exposures.length
  const isIntroduced = progress >= 3
  const suitability = getFoodSuitability(food.recommendedFromMonths, ageMonths)
  const ageWarningHighlighted =
    typeof food.recommendedFromMonths === "number" &&
    (food.recommendedFromMonths >= 12 || suitability.isTooEarly)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card relative flex flex-col gap-4 border-[var(--accent)]/50 p-4 shadow-soft transition ${
        isIntroduced ? "card-introduced" : ""
      } ${isDragging ? "opacity-80" : "opacity-100"}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex items-start gap-4 sm:flex-1">
          <button
            type="button"
              className="mt-1 rounded-full border border-[var(--border)] bg-[var(--pill-muted)] px-2 py-1 text-xs text-[var(--muted)]"
              {...attributes}
              {...listeners}
              aria-label={language === "en" ? "Drag" : "Arrastrar"}
            >
            <DragIndicatorIcon />
          </button>
          <button type="button" onClick={() => onOpen(food.id)}>
            <img
              src={getImageSrc(state.customImageUrl || food.imageUrl, food.name)}
              alt={food.name}
              className="h-16 w-16 rounded-2xl object-cover"
            />
          </button>
          <div className="flex-1">
            <button
              type="button"
              onClick={() => onOpen(food.id)}
              className="text-left"
            >
              <h3 className="text-lg font-semibold text-[var(--text)]">
                {food.name}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="pill pill-strong">
                  {progress}/3 {isIntroduced ? (language === "en" ? "introduced" : "introducido") : language === "en" ? "exposures" : "exposiciones"}
                </span>
                <span className="pill">{formatFamily(food.family)}</span>
                <span className="pill">{renderAllergens(food.allergens, language)}</span>
                {typeof food.recommendedFromMonths === "number" && (
                  <span
                    className={`pill ${
                      ageWarningHighlighted
                        ? "border !border-red-700 !bg-red-600 !text-white font-semibold"
                        : ""
                    }`}
                  >
                    {suitability.isTooEarly
                      ? `${language === "en" ? "Not suitable" : "No apto"}: +${food.recommendedFromMonths}m`
                      : `+${food.recommendedFromMonths}m`}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <div className="order-1 h-9 w-9 self-end sm:order-2 sm:self-auto">
            {isIntroduced ? (
              <span className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--accent)] bg-[var(--pill)] text-base font-semibold text-[var(--accent-strong)] sm:static">
                ✓
              </span>
            ) : (
              <span className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-transparent sm:static" />
            )}
          </div>
          <div className="order-2 grid w-full grid-cols-3 gap-3 sm:order-1 sm:flex sm:w-auto sm:items-center">
            {Array.from({ length: 3 }).map((_, index) => (
              <label
                key={`${food.id}-${index}`}
                className={`flex h-14 w-full flex-1 items-center justify-center rounded-2xl border text-lg font-semibold transition sm:w-14 sm:flex-none ${
                  index < progress
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                <input
                        type="checkbox"
                        className="sr-only"
                        checked={index < progress}
                        onChange={() => onToggleExposure(food.id, index)}
                      />
                {index + 1}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const SortableFamilyRow = ({
  family,
  language,
  foodCount,
  hasCustomImage,
  imageLoading,
  imageError,
  onGenerateImage,
  onOpenImagePicker,
  onClearImage,
  onRemoveFamily,
}: SortableFamilyRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: family })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-2xl border border-[var(--border)] bg-[var(--pill)]/40 p-3 ${
        isDragging ? "opacity-80" : "opacity-100"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={
              language === "en"
                ? `Drag family ${formatFamily(family)}`
                : `Arrastrar familia ${formatFamily(family)}`
            }
            className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-2 py-1 text-xs text-[var(--muted)]"
          >
            |||
          </button>
            <div>
              <div className="text-sm font-semibold">{formatFamily(family)}</div>
              <div className="text-xs text-[var(--muted)]">
                {foodCount} {language === "en" ? "foods" : "alimentos"}
              </div>
            </div>
          </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={imageLoading}
            onClick={() => onGenerateImage(family)}
            className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-3 py-1 text-xs"
          >
            {imageLoading
              ? language === "en"
                ? "Searching..."
                : "Buscando..."
              : language === "en"
                ? "Find image"
                : "Buscar imagen"}
          </button>
          <button
            type="button"
            onClick={() => onOpenImagePicker(family)}
            className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-3 py-1 text-xs"
          >
            {hasCustomImage
              ? language === "en"
                ? "Edit image"
                : "Editar imagen"
              : language === "en"
                ? "Manual image"
                : "Imagen manual"}
          </button>
          {hasCustomImage && (
            <button
              type="button"
              onClick={() => onClearImage(family)}
              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs"
            >
              {language === "en" ? "Delete image" : "Borrar imagen"}
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemoveFamily(family)}
            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs"
          >
            {language === "en" ? "Remove" : "Quitar"}
          </button>
        </div>
      </div>
      {imageError && <div className="mt-2 text-xs text-[var(--accent-strong)]">{imageError}</div>}
    </div>
  )
}

const PillMenu = ({
  icon,
  value,
  options,
  ariaLabel,
  onChange,
  minWidthClass = "min-w-[120px]",
  buttonClassName = "",
  menuClassName = "",
}: PillMenuProps) => {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return
      if (menuRef.current.contains(event.target as Node)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const selected = options.find((item) => item.value === value) || options[0]

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--pill)] px-3 py-2 text-xs ${buttonClassName}`}
      >
        {icon && <span aria-hidden="true" className="text-[var(--muted)]">{icon}</span>}
        <span className="max-w-[120px] truncate">{selected?.label}</span>
        <span aria-hidden="true" className="text-[10px] text-[var(--muted)]">
          ▾
        </span>
      </button>
      {open && (
        <div
          className={`absolute right-0 z-30 mt-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-soft ${minWidthClass} ${menuClassName}`}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={`block w-full rounded-xl px-3 py-2 text-left text-xs ${
                value === option.value
                  ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                  : "text-[var(--text)] hover:bg-[var(--pill-muted)]"
              } ${index > 0 ? "mt-1" : ""}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const applyTheme = (theme: ThemeMode) => {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const isDark = theme === "dark" || (theme === "system" && prefersDark)
  document.documentElement.classList.toggle("theme-dark", isDark)
}

const App = () => {
  const familyHomeEnabled = useMemo(resolveFamilyHomeEnabled, [])
  const defaultMainView: ViewMode = familyHomeEnabled ? "home" : "list"
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem("tribitr-theme")
    return (stored as ThemeMode) || "system"
  })
  const [isReady, setIsReady] = useState(false)
  const [isProfileLoaded, setIsProfileLoaded] = useState(false)
  const [view, setView] = useState<ViewMode>(defaultMainView)
  const [settingsSection, setSettingsSection] = useState<
    "profile" | "sync" | "appearance" | "data" | "legal"
  >("profile")
  const [activeFoodId, setActiveFoodId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [hideIntroduced, setHideIntroduced] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [showNotSuitableFoods, setShowNotSuitableFoods] = useState(false)
  const [language, setLanguage] = useState<AppLanguage>("es")
  const [activeFamily, setActiveFamily] = useState<string>("Todos")
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profileId, setProfileId] = useState("")
  const [order, setOrder] = useState<string[]>(initialOrder)
  const [orderUpdatedAt, setOrderUpdatedAt] = useState<string>(
    new Date().toISOString()
  )
  const [foodStates, setFoodStates] = useState<Record<string, FoodState>>(
    buildInitialState(foodsSeed)
  )
  const [customFoods, setCustomFoods] = useState<Record<string, FoodSeed>>({})
  const [customFamilies, setCustomFamilies] = useState<string[]>([])
  const [familyOrder, setFamilyOrder] = useState<string[]>([])
  const [familyOverrides, setFamilyOverrides] = useState<Record<string, FamilyOverride>>({})
  const [showFamilyManager, setShowFamilyManager] = useState(false)
  const [newFamilyName, setNewFamilyName] = useState("")
  const [familyImageLoading, setFamilyImageLoading] = useState<Record<string, boolean>>({})
  const [familyImageError, setFamilyImageError] = useState<Record<string, string>>({})
  const [showFamilyImagePicker, setShowFamilyImagePicker] = useState(false)
  const [activeFamilyForImage, setActiveFamilyForImage] = useState<string | null>(null)
  const [familyImageCandidates, setFamilyImageCandidates] = useState<
    {
      imageUrl: string
      imageAttribution?: string
      imageAttributionUrl?: string
      source?: string
    }[]
  >([])
  const [familyImageUrlInput, setFamilyImageUrlInput] = useState("")
  const [familyManualImageError, setFamilyManualImageError] = useState("")
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({})
  const [aiError, setAiError] = useState<Record<string, string>>({})
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({})
  const [imageError, setImageError] = useState<Record<string, string>>({})
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [imageCandidates, setImageCandidates] = useState<
    {
      imageUrl: string
      imageAttribution?: string
      imageAttributionUrl?: string
      source?: string
    }[]
  >([])
  const [imageUrlInput, setImageUrlInput] = useState("")
  const [manualImageError, setManualImageError] = useState("")
  const [showLegend, setShowLegend] = useState(false)
  const [showHiddenManager, setShowHiddenManager] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const fullBackupImportInputRef = useRef<HTMLInputElement | null>(null)
  const [syncReady, setSyncReady] = useState(false)
  const [syncRevision, setSyncRevision] = useState(0)
  const [lastSyncAt, setLastSyncAt] = useState<string>("")
  const [syncError, setSyncError] = useState<string>("")
  const [saveError, setSaveError] = useState<string>("")
  const [isLocalSaving, setIsLocalSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showSyncingIndicator, setShowSyncingIndicator] = useState(false)
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null)
  const [showOnboardingPrompt, setShowOnboardingPrompt] = useState(false)
  const [onboardingActive, setOnboardingActive] = useState(false)
  const [onboardingStepIndex, setOnboardingStepIndex] = useState(0)
  const [onboardingTargetRect, setOnboardingTargetRect] = useState<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)
  const [newProfileName, setNewProfileName] = useState("")
  const [showCreateProfileAction, setShowCreateProfileAction] = useState(false)
  const [babyNameInput, setBabyNameInput] = useState("")
  const [babyBirthDateInput, setBabyBirthDateInput] = useState("")
  const [correctedWeeksInput, setCorrectedWeeksInput] = useState("0")
  const [showAddFood, setShowAddFood] = useState(false)
  const [newFoodName, setNewFoodName] = useState("")
  const [newFoodFamily, setNewFoodFamily] = useState("")
  const [newFoodAllergens, setNewFoodAllergens] = useState("")
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [joinShareCode, setJoinShareCode] = useState("")
  const [floatingNotice, setFloatingNotice] = useState<{
    text: string
    type: "success" | "error"
  } | null>(null)
  const floatingNoticeTimerRef = useRef<number | null>(null)
  const filterMenuRef = useRef<HTMLDivElement | null>(null)
  const sortMenuRef = useRef<HTMLDivElement | null>(null)
  const [showShareQr, setShowShareQr] = useState(false)
  const [shareQrUrl, setShareQrUrl] = useState("")
  const [shareQrLink, setShareQrLink] = useState("")
  const [shareQrError, setShareQrError] = useState("")
  const [shareQrLoading, setShareQrLoading] = useState(false)
  const aiAutoRequestedRef = useRef<Record<string, boolean>>({})
  const undoTimerRef = useRef<number | null>(null)
  const syncIndicatorTimerRef = useRef<number | null>(null)
  const onboardingStorageKey = "tribitr-onboarding-v1"
  const cookieNoticeStorageKey = "tribitr-cookie-notice-v1"
  const [cookieNoticeAccepted, setCookieNoticeAccepted] = useState<boolean>(() => {
    return localStorage.getItem(cookieNoticeStorageKey) === "accepted"
  })
  const t = useMemo(() => createTranslator(language), [language])

  useEffect(() => {
    return () => {
      if (floatingNoticeTimerRef.current) {
        window.clearTimeout(floatingNoticeTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (filterMenuRef.current && !filterMenuRef.current.contains(target)) {
        setShowFilterMenu(false)
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(target)) {
        setShowSortMenu(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setShowFilterMenu(false)
      setShowSortMenu(false)
    }
    document.addEventListener("mousedown", onMouseDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  const correctedWeeks = Math.max(0, Number.parseInt(correctedWeeksInput, 10) || 0)
  const correctedAgeMonths = calculateCorrectedAgeMonths(babyBirthDateInput, correctedWeeks)

  const allFoods = useMemo(
    () => [...foodsSeed, ...Object.values(customFoods)],
    [customFoods]
  )

  const foodsById = useMemo(() => {
    const map: Record<string, FoodSeed> = {}
    allFoods.forEach((food) => {
      map[food.id] = food
    })
    return map
  }, [allFoods])

  const families = useMemo(() => {
    const baseFamilies = Array.from(
      new Set([
        ...(seed?.families?.map((item) => item.family) || []),
        ...allFoods.map((food) => food.family),
        ...normalizeFamilyList(customFamilies),
      ])
    )
    const rank = new Map<string, number>()
    normalizeFamilyList(familyOrder).forEach((family, index) => rank.set(family, index))
    return [...baseFamilies].sort((left, right) => {
      const leftRank = rank.has(left) ? rank.get(left)! : Number.MAX_SAFE_INTEGER
      const rightRank = rank.has(right) ? rank.get(right)! : Number.MAX_SAFE_INTEGER
      if (leftRank !== rightRank) return leftRank - rightRank
      return left.localeCompare(right, "es", { sensitivity: "base" })
    })
  }, [allFoods, customFamilies, familyOrder])

  const familyCovers = useMemo(() => {
    const map: Record<
      string,
      { imageUrl: string; attribution?: string; attributionUrl?: string }
    > = {}
    seed?.families?.forEach((item) => {
      map[item.family] = {
        imageUrl: item.imageUrl,
        attribution: item.imageAttribution,
        attributionUrl: item.imageAttributionUrl,
      }
    })
    allFoods.forEach((food) => {
      if (!map[food.family]) {
        map[food.family] = {
          imageUrl: food.imageUrl,
          attribution: food.imageAttribution,
          attributionUrl: food.imageAttributionUrl,
        }
      }
    })
    Object.entries(normalizeFamilyOverrides(familyOverrides)).forEach(([family, override]) => {
      map[family] = {
        imageUrl: override.imageUrl,
        attribution: override.imageAttribution,
        attributionUrl: override.imageAttributionUrl,
      }
    })
    return map
  }, [allFoods, familyOverrides])
  const allFoodsCover = seed?.all || foodsSeed[0]

  const visibleFoodCount = useMemo(
    () => allFoods.filter((food) => !foodStates[food.id]?.isHidden).length,
    [allFoods, foodStates]
  )

  const visibleFoodCountByFamily = useMemo(() => {
    const counts: Record<string, number> = {}
    allFoods.forEach((food) => {
      if (foodStates[food.id]?.isHidden) return
      counts[food.family] = (counts[food.family] || 0) + 1
    })
    return counts
  }, [allFoods, foodStates])

  const onboardingSteps = useMemo<OnboardingStep[]>(() => {
    const steps: OnboardingStep[] = [
      {
        id: "profile",
        title: t("Perfiles"),
        description: t("Aquí cambias entre perfiles para llevar el seguimiento de cada bebé."),
        selector: '[data-tour="profile-selector"]',
        view: defaultMainView,
      },
      {
        id: "settings-entry",
        title: t("Ajustes"),
        description: t("Desde este botón abres Ajustes para sincronización, perfiles y configuración de la app."),
        selector: '[data-tour="settings-entry"]',
        view: defaultMainView,
      },
    ]
    if (familyHomeEnabled) {
      steps.push({
        id: "families",
        title: t("Familias de alimentos"),
        description: t("Empieza por una familia o entra en Todos para ver la lista completa de alimentos."),
        selector: '[data-tour="home-families"]',
        view: "home",
        placement: "above",
      })
    }
    steps.push(
      {
        id: "list-controls",
        title: t("Controles de la lista"),
        description: t("Usa búsqueda, filtros y ordenar para encontrar rápido alimentos; en Filtros tienes familia, ocultar 3/3 y mostrar ocultos."),
        selector: '[data-tour="list-controls"]',
        view: "list",
        beforeStep: () => {
          setActiveFamily("Todos")
          setShowFilterMenu(false)
          setShowSortMenu(false)
        },
      },
      {
        id: "settings-profiles",
        title: t("Perfiles"),
        description: t("En Ajustes > Perfiles puedes crear, editar y seleccionar el perfil activo del bebé."),
        selector: '[data-tour="settings-profiles"]',
        view: "settings",
        beforeStep: () => setSettingsSection("profile"),
      },
      {
        id: "settings-configuration",
        title: t("Configuración"),
        description: t("En Configuración ajustas tema e idioma y gestionas familias, ocultos y alérgenos."),
        selector: '[data-tour="settings-configuration"]',
        view: "settings",
        beforeStep: () => setSettingsSection("appearance"),
      },
      {
        id: "settings-data",
        title: t("Exportar / Importar"),
        description: t("Desde Exportar / Importar puedes guardar o restaurar perfiles y copias de seguridad."),
        selector: '[data-tour="settings-data"]',
        view: "settings",
        beforeStep: () => setSettingsSection("data"),
      },
      {
        id: "settings-sync",
        title: t("Sincronizacion"),
        description: t("Aquí puedes copiar, compartir o mostrar QR del código del perfil y forzar sincronización manual."),
        selector: '[data-tour="settings-sync"]',
        view: "settings",
        beforeStep: () => setSettingsSection("sync"),
      }
    )
    return steps
  }, [defaultMainView, familyHomeEnabled, t])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      const storedProfiles = await getProfiles()
      let nextProfiles = storedProfiles
      if (storedProfiles.length === 0) {
        nextProfiles = profilesSeed.map((profile) => ({
          id: profile.id,
          name: profile.name,
          shareCode: createShareCode(),
          updatedAt: new Date().toISOString(),
        }))
        await saveProfiles(nextProfiles)
        await Promise.all(
          nextProfiles.map((profile) => saveSnapshot(createSnapshot(profile)))
        )
      }
      if (!isMounted) return
      setProfiles(nextProfiles)
      setProfileId((prev) => prev || nextProfiles[0]?.id || "")
      setIsReady(true)
    }

    load()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (activeFamily === "Todos") return
    if (families.includes(activeFamily)) return
    setActiveFamily("Todos")
  }, [activeFamily, families])

  useEffect(() => {
    if (!isReady || !profileId) return
    let isMounted = true
    setIsProfileLoaded(false)
    setSyncReady(false)
    setSyncError("")
    setLastSyncAt("")
    const loadSnapshot = async () => {
      let snapshot = await getSnapshot(profileId)
      if (!snapshot) {
        const profile = profiles.find((item) => item.id === profileId)
        if (!profile) return
        snapshot = createSnapshot(profile)
        await saveSnapshot(snapshot)
      }
      if (!isMounted || !snapshot) return
      const normalizedCustomFoods = normalizeCustomFoods(
        snapshot.customFoods as Record<string, FoodSeed>
      )
      const normalizedCustomFamilies = normalizeFamilyList(snapshot.customFamilies)
      const normalizedFamilyOrder = normalizeFamilyList(snapshot.familyOrder)
      const normalizedFamilyOverrides = normalizeFamilyOverrides(
        snapshot.familyOverrides as Record<string, FamilyOverride>
      )
      const mergedFoods = {
        ...buildInitialState(foodsSeed),
        ...normalizeFoods(snapshot.foods),
      }
      Object.values(normalizedCustomFoods).forEach((food) => {
        if (!mergedFoods[food.id]) {
          mergedFoods[food.id] = {
            foodId: food.id,
            isHidden: false,
            notes: "",
            exposures: [],
            customImageUrl: "",
            customImageAttribution: "",
            customImageAttributionUrl: "",
            imageGeneratedAt: "",
            imageSource: "",
            description: "",
            reactions: "",
            descriptionGeneratedAt: "",
            descriptionModel: "",
            updatedAt: new Date().toISOString(),
          }
        }
      })
      const mergedOrder = Array.from(new Set([...snapshot.order, ...initialOrder]))
      Object.keys(normalizedCustomFoods).forEach((id) => {
        if (!mergedOrder.includes(id)) mergedOrder.push(id)
      })
      setFoodStates(mergedFoods)
      setCustomFoods(normalizedCustomFoods)
      setCustomFamilies(normalizedCustomFamilies)
      setFamilyOrder(normalizedFamilyOrder)
      setFamilyOverrides(normalizedFamilyOverrides)
      setOrder(mergedOrder)
      setOrderUpdatedAt(getOrderUpdatedAt(snapshot) || new Date().toISOString())
      setHideIntroduced(snapshot.settings.hideIntroduced)
      setShowHidden(snapshot.settings.showHidden)
      setShowNotSuitableFoods(snapshot.settings.showNotSuitableFoods ?? false)
      setTheme(snapshot.settings.theme)
      setLanguage(snapshot.settings.language ?? "es")
      setNewProfileName(snapshot.profileName ?? "")
      setBabyNameInput(snapshot.profileName || snapshot.babyName || "")
      setBabyBirthDateInput(snapshot.babyBirthDate ?? "")
      setCorrectedWeeksInput(String(snapshot.correctedWeeks ?? 0))
      setSyncRevision(snapshot.revision ?? 0)
      setIsProfileLoaded(true)
    }

    loadSnapshot()
    return () => {
      isMounted = false
    }
  }, [isReady, profileId, profiles])

  useEffect(() => {
    localStorage.setItem("tribitr-theme", theme)
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    if (!isReady) return
    const params = new URLSearchParams(window.location.search)
    const shareParam = params.get("share")
    const pidParam = params.get("pid")
    if (!shareParam) return
    const code = extractShareCode(shareParam)
    if (!code) return
    setJoinShareCode(code)
    joinWithCode(code, pidParam || undefined)
  }, [isReady])

  useEffect(() => {
    if (theme !== "system") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => applyTheme("system")
    media.addEventListener("change", handler)
    return () => media.removeEventListener("change", handler)
  }, [theme])

  const showUndo = (message: string, undo: () => void) => {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
    setUndoToast({ message, undo })
    undoTimerRef.current = window.setTimeout(() => {
      setUndoToast(null)
      undoTimerRef.current = null
    }, 8000)
  }

  const handleUndoAction = () => {
    if (!undoToast) return
    undoToast.undo()
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
    setUndoToast(null)
  }

  useEffect(
    () => () => {
      if (undoTimerRef.current) {
        window.clearTimeout(undoTimerRef.current)
      }
      if (syncIndicatorTimerRef.current) {
        window.clearTimeout(syncIndicatorTimerRef.current)
      }
    },
    []
  )

  useEffect(() => {
    if (isSyncing) {
      if (syncIndicatorTimerRef.current) {
        window.clearTimeout(syncIndicatorTimerRef.current)
      }
      syncIndicatorTimerRef.current = window.setTimeout(() => {
        setShowSyncingIndicator(true)
      }, 900)
      return
    }
    if (syncIndicatorTimerRef.current) {
      window.clearTimeout(syncIndicatorTimerRef.current)
      syncIndicatorTimerRef.current = null
    }
    setShowSyncingIndicator(false)
  }, [isSyncing])

  const currentOnboardingStep = onboardingSteps[onboardingStepIndex]

  const closeOnboarding = () => {
    setOnboardingActive(false)
    setOnboardingTargetRect(null)
  }

  const completeOnboarding = () => {
    localStorage.setItem(onboardingStorageKey, "done")
    setShowOnboardingPrompt(false)
    closeOnboarding()
  }

  const startOnboarding = () => {
    setShowOnboardingPrompt(false)
    setOnboardingTargetRect(null)
    setOnboardingStepIndex(0)
    setOnboardingActive(true)
  }

  useEffect(() => {
    if (!isReady || !isProfileLoaded) return
    const completed = localStorage.getItem(onboardingStorageKey) === "done"
    if (completed) return
    if (onboardingActive) return
    setShowOnboardingPrompt(true)
  }, [isReady, isProfileLoaded, onboardingActive, onboardingStorageKey])

  useEffect(() => {
    if (!onboardingActive || !currentOnboardingStep) return

    currentOnboardingStep.beforeStep?.()
    if (view !== currentOnboardingStep.view) {
      setView(currentOnboardingStep.view)
    }

    const applyTarget = () => {
      const element = document.querySelector(currentOnboardingStep.selector) as HTMLElement | null
      if (!element) {
        setOnboardingTargetRect(null)
        return
      }
      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" })
      const rect = element.getBoundingClientRect()
      setOnboardingTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      })
    }

    const rafId = window.requestAnimationFrame(() => {
      window.setTimeout(applyTarget, 120)
    })

    const refreshTarget = () => applyTarget()
    window.addEventListener("resize", refreshTarget)
    window.addEventListener("scroll", refreshTarget, { passive: true })

    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener("resize", refreshTarget)
      window.removeEventListener("scroll", refreshTarget)
    }
  }, [onboardingActive, onboardingStepIndex, currentOnboardingStep, view])

  useEffect(() => {
    if (!onboardingActive) return
    setOnboardingTargetRect(null)
  }, [onboardingActive, onboardingStepIndex])

  useEffect(() => {
    if (!onboardingActive) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        completeOnboarding()
        return
      }
      if (event.key === "ArrowRight") {
        event.preventDefault()
        goNextOnboardingStep()
        return
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        goPrevOnboardingStep()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onboardingActive, onboardingStepIndex, onboardingSteps.length])

  const [syncNowTick, setSyncNowTick] = useState(Date.now())

  useEffect(() => {
    if (!lastSyncAt) return
    const timer = window.setInterval(() => {
      setSyncNowTick(Date.now())
    }, 60000)
    return () => window.clearInterval(timer)
  }, [lastSyncAt])

  const goNextOnboardingStep = () => {
    if (onboardingStepIndex >= onboardingSteps.length - 1) {
      completeOnboarding()
      return
    }
    setOnboardingTargetRect(null)
    setOnboardingStepIndex((prev) => prev + 1)
  }

  const goPrevOnboardingStep = () => {
    setOnboardingTargetRect(null)
    setOnboardingStepIndex((prev) => Math.max(prev - 1, 0))
  }

  const normalizeApiBase = (value: string) => {
    const trimmed = value.trim().replace(/\/$/, "")
    if (!trimmed) return ""
    try {
      const url = new URL(trimmed)
      if (!url.port) {
        const match = url.pathname.match(/^\/:(\d+)$/)
        if (match?.[1]) {
          url.port = match[1]
          url.pathname = "/"
        }
      }
      return url.toString().replace(/\/$/, "")
    } catch {
      return trimmed
    }
  }

  const apiBase = useMemo(() => {
    if (import.meta.env.VITE_API_URL)
      return normalizeApiBase(import.meta.env.VITE_API_URL)
    const params = new URLSearchParams(window.location.search)
    const apiParam = params.get("api")
    if (apiParam) {
      try {
        const apiUrl = new URL(apiParam)
        if (
          (apiUrl.hostname === "localhost" || apiUrl.hostname === "127.0.0.1") &&
          window.location.hostname !== "localhost" &&
          window.location.hostname !== "127.0.0.1"
        ) {
          apiUrl.hostname = window.location.hostname
        }
        return normalizeApiBase(apiUrl.toString())
      } catch {
        return normalizeApiBase(apiParam)
      }
    }
    return getShareApiBase()
  }, [])

  const buildLocalSnapshot = () => {
    const profile = profiles.find((item) => item.id === profileId)
    if (!profile) return null
    return {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      profileId,
      profileName: profile.name,
      shareCode: profile.shareCode,
      babyName: babyNameInput.trim(),
      babyBirthDate: babyBirthDateInput.trim(),
      correctedWeeks,
      revision: syncRevision || 1,
      updatedAt: new Date().toISOString(),
      settings: {
        theme,
        language,
        hideIntroduced,
        showHidden,
        showNotSuitableFoods,
      },
      foods: normalizeFoods(foodStates),
      customFoods: normalizeCustomFoods(customFoods),
      customFamilies: normalizeFamilyList(customFamilies),
      familyOrder: normalizeFamilyList(familyOrder),
      familyOverrides: normalizeFamilyOverrides(familyOverrides),
      order,
      meta: {
        orderUpdatedAt,
      },
    }
  }

  const applySnapshot = (snapshot: ProfileSnapshot) => {
    const normalizedCustomFoods = normalizeCustomFoods(
      snapshot.customFoods as Record<string, FoodSeed>
    )
    const normalizedCustomFamilies = normalizeFamilyList(snapshot.customFamilies)
    const normalizedFamilyOrder = normalizeFamilyList(snapshot.familyOrder)
    const normalizedFamilyOverrides = normalizeFamilyOverrides(
      snapshot.familyOverrides as Record<string, FamilyOverride>
    )
    const mergedFoods = {
      ...buildInitialState(foodsSeed),
      ...normalizeFoods(snapshot.foods),
    }
    Object.values(normalizedCustomFoods).forEach((food) => {
      if (!mergedFoods[food.id]) {
        mergedFoods[food.id] = {
          foodId: food.id,
          isHidden: false,
          notes: "",
          exposures: [],
          customImageUrl: "",
          customImageAttribution: "",
          customImageAttributionUrl: "",
          imageGeneratedAt: "",
          imageSource: "",
          description: "",
          reactions: "",
          descriptionGeneratedAt: "",
          descriptionModel: "",
          updatedAt: new Date().toISOString(),
        }
      }
    })
    const mergedOrder = Array.from(new Set([...snapshot.order, ...initialOrder]))
    const customIds = Object.keys(normalizedCustomFoods)
    customIds.forEach((id) => {
      if (!mergedOrder.includes(id)) mergedOrder.push(id)
    })
    setFoodStates(mergedFoods)
    setCustomFoods(normalizedCustomFoods)
    setCustomFamilies(normalizedCustomFamilies)
    setFamilyOrder(normalizedFamilyOrder)
    setFamilyOverrides(normalizedFamilyOverrides)
    setOrder(mergedOrder)
    setOrderUpdatedAt(getOrderUpdatedAt(snapshot) || new Date().toISOString())
    setHideIntroduced(snapshot.settings.hideIntroduced)
    setShowHidden(snapshot.settings.showHidden)
    setShowNotSuitableFoods(snapshot.settings.showNotSuitableFoods ?? false)
    setTheme(snapshot.settings.theme)
    setLanguage(snapshot.settings.language ?? "es")
    setNewProfileName(snapshot.profileName ?? "")
    setBabyNameInput(snapshot.profileName || snapshot.babyName || "")
    setBabyBirthDateInput(snapshot.babyBirthDate ?? "")
    setCorrectedWeeksInput(String(snapshot.correctedWeeks ?? 0))
    setSyncRevision(snapshot.revision ?? 0)
    saveSnapshot(snapshot)
  }

  useEffect(() => {
    if (!isReady || !isProfileLoaded || !profileId) return
    setIsLocalSaving(true)
    const handler = window.setTimeout(async () => {
      const snapshot = buildLocalSnapshot()
      if (!snapshot) {
        setIsLocalSaving(false)
        return
      }
      try {
        await saveSnapshot(snapshot)
        setSaveError("")
      } catch {
        setSaveError(t("No se pudo guardar en local"))
      } finally {
        setIsLocalSaving(false)
      }
    }, 300)
    return () => window.clearTimeout(handler)
  }, [
    isReady,
    isProfileLoaded,
    profileId,
    profiles,
    theme,
    hideIntroduced,
    showHidden,
    showNotSuitableFoods,
    language,
    babyNameInput,
    babyBirthDateInput,
    correctedWeeksInput,
    foodStates,
    customFoods,
    customFamilies,
    familyOrder,
    familyOverrides,
    order,
    orderUpdatedAt,
    syncRevision,
  ])

  useEffect(() => {
    if (!isReady || !isProfileLoaded || !profileId) return
    let isMounted = true
    const runPull = async () => {
      const profile = profiles.find((item) => item.id === profileId)
      if (!profile) return
      setIsSyncing(true)
      try {
        const response = await fetch(`${apiBase}/api/sync/pull`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shareCode: profile.shareCode,
            profileId: profile.id,
          }),
        })
        if (response.status === 404) {
          setSyncReady(true)
          return
        }
        if (!response.ok) throw new Error("pull failed")
        const data = (await response.json()) as { snapshot: ProfileSnapshot }
        const localSnapshot = buildLocalSnapshot()
        if (!localSnapshot) return
        const merged = mergeSnapshots(localSnapshot, data.snapshot)
        if (isMounted) {
          applySnapshot(merged)
          setLastSyncAt(new Date().toISOString())
          setSyncError("")
        }
      } catch {
        if (!isMounted) return
        setSyncError(t("No se pudo sincronizar"))
      } finally {
        if (isMounted) setIsSyncing(false)
        if (isMounted) setSyncReady(true)
      }
    }

    runPull()
    return () => {
      isMounted = false
    }
  }, [isReady, isProfileLoaded, profileId, profiles, apiBase, language])

  useEffect(() => {
    if (!syncReady || !profileId) return
    const handler = window.setTimeout(async () => {
      const profile = profiles.find((item) => item.id === profileId)
      if (!profile) return
      const snapshot = buildLocalSnapshot()
      if (!snapshot) return
      setIsSyncing(true)
      try {
        const response = await fetch(`${apiBase}/api/sync/push`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shareCode: profile.shareCode,
            profileId: profile.id,
            baseRevision: syncRevision,
            snapshot,
          }),
        })
        if (response.status === 409) {
          const conflictData = (await response.json()) as {
            snapshot: ProfileSnapshot
            revision: number
          }
          const merged = mergeSnapshots(snapshot, conflictData.snapshot)
          merged.revision = conflictData.revision
          applySnapshot(merged)
          const retry = await fetch(`${apiBase}/api/sync/push`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              shareCode: profile.shareCode,
              profileId: profile.id,
              baseRevision: conflictData.revision,
              snapshot: merged,
            }),
          })
          if (!retry.ok) throw new Error("push retry failed")
          const retryData = (await retry.json()) as {
            snapshot: ProfileSnapshot
            revision: number
          }
          applySnapshot(retryData.snapshot)
          setSyncError("")
          return
        }
        if (!response.ok) throw new Error("push failed")
        const data = (await response.json()) as {
          snapshot: ProfileSnapshot
          revision: number
        }
        applySnapshot(data.snapshot)
        setSyncError("")
      } catch {
        setSyncError(t("No se pudo sincronizar"))
      } finally {
        setIsSyncing(false)
      }
    }, 1200)
    return () => window.clearTimeout(handler)
  }, [
    syncReady,
    profileId,
    profiles,
    apiBase,
    foodStates,
    customFoods,
    customFamilies,
    familyOrder,
    familyOverrides,
    order,
    orderUpdatedAt,
    theme,
    language,
    hideIntroduced,
    showHidden,
    showNotSuitableFoods,
    babyNameInput,
    babyBirthDateInput,
    correctedWeeksInput,
    syncRevision,
  ])

  useEffect(() => {
    if (!syncReady || !profileId) return
    const interval = window.setInterval(async () => {
      const profile = profiles.find((item) => item.id === profileId)
      if (!profile) return
      setIsSyncing(true)
      try {
        const response = await fetch(`${apiBase}/api/sync/pull`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shareCode: profile.shareCode,
            profileId: profile.id,
          }),
        })
        if (response.status === 404) return
        if (!response.ok) throw new Error("pull failed")
        const data = (await response.json()) as { snapshot: ProfileSnapshot }
        const localSnapshot = buildLocalSnapshot()
        if (!localSnapshot) return
        const merged = mergeSnapshots(localSnapshot, data.snapshot)
        applySnapshot(merged)
        setLastSyncAt(new Date().toISOString())
        setSyncError("")
      } catch {
        setSyncError(t("No se pudo sincronizar"))
      } finally {
        setIsSyncing(false)
      }
    }, 900000)

    return () => window.clearInterval(interval)
  }, [syncReady, profileId, profiles, apiBase, language])

  useEffect(() => {
    if (!syncReady || !profileId) return
    const onFocus = () => {
      const profile = profiles.find((item) => item.id === profileId)
      if (!profile) return
      setIsSyncing(true)
      fetch(`${apiBase}/api/sync/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareCode: profile.shareCode,
          profileId: profile.id,
        }),
      })
        .then(async (response) => {
          if (response.status === 404) return
          if (!response.ok) throw new Error("pull failed")
          const data = (await response.json()) as { snapshot: ProfileSnapshot }
          const localSnapshot = buildLocalSnapshot()
          if (!localSnapshot) return
          const merged = mergeSnapshots(localSnapshot, data.snapshot)
          applySnapshot(merged)
          setLastSyncAt(new Date().toISOString())
          setSyncError("")
        })
        .catch(() => {
          setSyncError(t("No se pudo sincronizar"))
        })
        .finally(() => {
          setIsSyncing(false)
        })
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [syncReady, profileId, profiles, apiBase, language])

  const updateFoodState = (id: string, patch: Partial<FoodState>) => {
    setFoodStates((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...patch,
        updatedAt: new Date().toISOString(),
      },
    }))
  }

  const toggleExposure = (id: string, index: number) => {
    setFoodStates((prev) => {
      const current = prev[id]
      const count = current.exposures.length
      let nextCount = count
      if (index < count) nextCount = index
      if (index === count) nextCount = count + 1
      const now = new Date().toISOString()
      const nextExposures = Array.from({ length: nextCount }, (_, idx) => {
        return current.exposures[idx] ?? { checkedAt: now }
      })
      return {
        ...prev,
        [id]: {
          ...current,
          exposures: nextExposures,
          updatedAt: now,
        },
      }
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrder((prev) => {
      const oldIndex = prev.indexOf(String(active.id))
      const newIndex = prev.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
    setOrderUpdatedAt(new Date().toISOString())
  }

  const sortOrderAlphabetically = (direction: "asc" | "desc") => {
    setOrder((prev) => {
      const sorted = [...prev].sort((leftId, rightId) => {
        const leftName = foodsById[leftId]?.name || leftId
        const rightName = foodsById[rightId]?.name || rightId
        const result = leftName.localeCompare(rightName, "es", {
          sensitivity: "base",
        })
        return direction === "asc" ? result : -result
      })
      return sorted
    })
    setOrderUpdatedAt(new Date().toISOString())
  }

  const handleSortDirectionChange = (value: string) => {
    const direction = value === "desc" ? "desc" : "asc"
    setSortDirection(direction)
    sortOrderAlphabetically(direction)
  }

  const handleAddFood = () => {
    const name = newFoodName.trim()
    const family = newFoodFamily.trim().toLowerCase()
    if (!name || !family) {
      window.alert("Nombre y familia son obligatorios.")
      return
    }
    const allergens = newFoodAllergens
      .split(",")
      .map((item) => slugify(item).replace(/-/g, "_"))
      .filter(Boolean)
    const existingIds = new Set([...Object.keys(foodsById), ...Object.keys(foodStates)])
    const id = createFoodId(name, existingIds)
    const now = new Date().toISOString()
    const customFood: FoodSeed = {
      id,
      name,
      family,
      allergens,
      imageUrl: "",
      imageAttribution: "",
      imageAttributionUrl: "",
    }
    setCustomFoods((prev) => ({ ...prev, [id]: customFood }))
    setCustomFamilies((prev) => Array.from(new Set([...prev, family])))
    setFamilyOrder((prev) => {
      if (prev.includes(family)) return prev
      return [...prev, family]
    })
    setFoodStates((prev) => ({
      ...prev,
      [id]: {
        foodId: id,
        isHidden: false,
        notes: "",
        exposures: [],
        customImageUrl: "",
        customImageAttribution: "",
        customImageAttributionUrl: "",
        imageGeneratedAt: "",
        imageSource: "",
        description: "",
        reactions: "",
        descriptionGeneratedAt: "",
        descriptionModel: "",
        updatedAt: now,
      },
    }))
    setOrder((prev) => Array.from(new Set([...prev, id])))
    setOrderUpdatedAt(now)
    if (sortDirection === "asc" || sortDirection === "desc") {
      sortOrderAlphabetically(sortDirection)
    }
    setNewFoodName("")
    setNewFoodFamily("")
    setNewFoodAllergens("")
    setShowAddFood(false)
  }

  const handleAddFamily = () => {
    const family = newFamilyName.trim().toLowerCase()
    if (!family) return
    if (families.includes(family)) {
      window.alert("Esa familia ya existe.")
      return
    }
    setCustomFamilies((prev) => Array.from(new Set([...prev, family])))
    setFamilyOrder((prev) => [...prev, family])
    setNewFamilyName("")
  }

  const handleFamilyDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = families.indexOf(String(active.id))
    const newIndex = families.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    setFamilyOrder(arrayMove(families, oldIndex, newIndex))
  }

  const handleRemoveFamily = (family: string) => {
    const hasFoods = allFoods.some((food) => food.family === family)
    if (hasFoods) {
      window.alert("No se puede quitar una familia que tiene alimentos asignados.")
      return
    }
    const prevCustomFamilies = [...customFamilies]
    const prevFamilyOrder = [...familyOrder]
    const prevFamilyOverrides = { ...familyOverrides }
    const prevActiveFamily = activeFamily
    setCustomFamilies((prev) => prev.filter((item) => item !== family))
    setFamilyOrder((prev) => prev.filter((item) => item !== family))
    setFamilyOverrides((prev) => {
      const next = { ...prev }
      delete next[family]
      return next
    })
    if (activeFamily === family) setActiveFamily("Todos")
    showUndo(
      t(`Familia ${formatFamily(family)} eliminada`, `Family ${formatFamily(family)} removed`),
      () => {
      setCustomFamilies(prevCustomFamilies)
      setFamilyOrder(prevFamilyOrder)
      setFamilyOverrides(prevFamilyOverrides)
      setActiveFamily(prevActiveFamily)
      }
    )
  }

  const applyFamilyImage = (
    family: string,
    payload: {
      imageUrl: string
      imageAttribution?: string
      imageAttributionUrl?: string
      source?: string
    }
  ) => {
    setFamilyOverrides((prev) => ({
      ...prev,
      [family]: {
        imageUrl: payload.imageUrl,
        imageAttribution: payload.imageAttribution ?? "",
        imageAttributionUrl: payload.imageAttributionUrl ?? "",
        imageSource: payload.source ?? "manual",
      },
    }))
    setFamilyImageError((prev) => ({ ...prev, [family]: "" }))
  }

  const handleGenerateFamilyImage = async (family: string) => {
    setFamilyImageLoading((prev) => ({ ...prev, [family]: true }))
    setFamilyImageError((prev) => ({ ...prev, [family]: "" }))
    setFamilyImageCandidates([])
    try {
      const activeProfile = profiles.find((item) => item.id === profileId)
      if (!activeProfile) throw new Error("profile missing")
      const response = await fetch(`${apiBase}/api/ai/food-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formatFamily(family),
          family,
          shareCode: activeProfile.shareCode,
          profileId: activeProfile.id,
        }),
      })
      if (!response.ok) throw new Error("image failed")
      const data = (await response.json()) as {
        candidates?: {
          imageUrl: string
          imageAttribution?: string
          imageAttributionUrl?: string
          source?: string
        }[]
      }
      const candidates = (data.candidates || []).filter((item) =>
        isValidManualImageUrl(item.imageUrl || "")
      )
      if (candidates.length === 0) throw new Error("No image found")
      setActiveFamilyForImage(family)
      setFamilyImageCandidates(candidates)
      setFamilyImageUrlInput("")
      setFamilyManualImageError("")
      setShowFamilyImagePicker(true)
    } catch {
      setFamilyImageError((prev) => ({
        ...prev,
        [family]: t("No se pudo buscar imagen para la familia."),
      }))
    }
    setFamilyImageLoading((prev) => ({ ...prev, [family]: false }))
  }

  const handleFamilyManualUrlApply = async () => {
    if (!activeFamilyForImage) return
    const trimmed = familyImageUrlInput.trim()
    if (!isValidManualImageUrl(trimmed)) {
      setFamilyManualImageError("Introduce una URL valida (http/https) o data URL de imagen.")
      return
    }
    const inferred = await resolveImageAttribution(trimmed)
    applyFamilyImage(activeFamilyForImage, {
      imageUrl: trimmed,
      imageAttribution: inferred.imageAttribution,
      imageAttributionUrl: inferred.imageAttributionUrl,
      source: inferred.source,
    })
    setFamilyImageUrlInput("")
    setFamilyManualImageError("")
    setShowFamilyImagePicker(false)
  }

  const handleFamilyLocalImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!activeFamilyForImage) return
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setFamilyManualImageError("El archivo debe ser una imagen.")
      return
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(new Error("read failed"))
      reader.readAsDataURL(file)
    })
    applyFamilyImage(activeFamilyForImage, {
      imageUrl: dataUrl,
      imageAttribution: `Imagen local: ${file.name}`,
      source: "manual-file",
    })
    setFamilyManualImageError("")
    setShowFamilyImagePicker(false)
    event.target.value = ""
  }

  const handleClearFamilyImage = (family: string) => {
    const previous = familyOverrides[family]
    if (!previous?.imageUrl) return
    setFamilyOverrides((prev) => {
      const next = { ...prev }
      delete next[family]
      return next
    })
    setFamilyImageError((prev) => ({ ...prev, [family]: "" }))
    showUndo(`Imagen de ${formatFamily(family)} eliminada`, () => {
      setFamilyOverrides((prev) => ({ ...prev, [family]: previous }))
    })
  }

  const handleGenerateAi = async (id: string) => {
    setAiLoading((prev) => ({ ...prev, [id]: true }))
    setAiError((prev) => ({ ...prev, [id]: "" }))
    try {
      const food = foodsById[id]
      const activeProfile = profiles.find((item) => item.id === profileId)
      if (!activeProfile) throw new Error("profile missing")
      const response = await fetch(`${apiBase}/api/ai/food`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: food.name,
          family: food.family,
          allergens: food.allergens,
          shareCode: activeProfile.shareCode,
          profileId: activeProfile.id,
        }),
      })
      if (!response.ok) throw new Error("ai failed")
      const data = (await response.json()) as {
        description?: string
        reactions?: string
        model?: string
      }
      updateFoodState(id, {
        description: data.description ?? "",
        reactions: data.reactions ?? "",
        descriptionModel: data.model ?? "",
        descriptionGeneratedAt: new Date().toISOString(),
      })
    } catch {
      setAiError((prev) => ({ ...prev, [id]: "No se puedo generar la descripcion" }))
    }
    setAiLoading((prev) => ({ ...prev, [id]: false }))
  }

  const isValidManualImageUrl = (value: string) =>
    /^https?:\/\//i.test(value) || /^data:image\//i.test(value)

  const resolveImageAttribution = async (imageUrl: string) => {
    const fallback = inferImageAttributionFromUrl(imageUrl)
    if (!/^https?:\/\//i.test(imageUrl)) return fallback
    const activeProfile = profiles.find((item) => item.id === profileId)
    if (!activeProfile) return fallback
    try {
      const response = await fetch(`${apiBase}/api/ai/image-attribution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          shareCode: activeProfile.shareCode,
          profileId: activeProfile.id,
        }),
      })
      if (!response.ok) return fallback
      const data = (await response.json()) as {
        imageAttribution?: string
        imageAttributionUrl?: string
        source?: string
      }
      return {
        imageAttribution: data.imageAttribution || fallback.imageAttribution,
        imageAttributionUrl: data.imageAttributionUrl || fallback.imageAttributionUrl,
        source: data.source || fallback.source,
      }
    } catch {
      return fallback
    }
  }

  const applyCustomImage = (
    id: string,
    payload: {
      imageUrl: string
      imageAttribution?: string
      imageAttributionUrl?: string
      source?: string
    }
  ) => {
    updateFoodState(id, {
      customImageUrl: payload.imageUrl,
      customImageAttribution: payload.imageAttribution ?? "",
      customImageAttributionUrl: payload.imageAttributionUrl ?? "",
      imageGeneratedAt: new Date().toISOString(),
      imageSource: payload.source ?? "manual",
    })
    setImageError((prev) => ({ ...prev, [id]: "" }))
  }

  const handleGenerateImage = async (id: string) => {
    setImageLoading((prev) => ({ ...prev, [id]: true }))
    setImageError((prev) => ({ ...prev, [id]: "" }))
    setImageCandidates([])
    try {
      const food = foodsById[id]
      const activeProfile = profiles.find((item) => item.id === profileId)
      if (!activeProfile) throw new Error("profile missing")
      const response = await fetch(`${apiBase}/api/ai/food-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: food.name,
          family: food.family,
          shareCode: activeProfile.shareCode,
          profileId: activeProfile.id,
        }),
      })
      if (!response.ok) {
        let backendMessage = t("No se pudo buscar imagen ahora.")
        try {
          const payload = (await response.json()) as { error?: string }
          if (payload.error) backendMessage = payload.error
        } catch {
        }
        throw new Error(backendMessage)
      }
      const data = (await response.json()) as {
        candidates?: {
          imageUrl: string
          imageAttribution?: string
          imageAttributionUrl?: string
          source?: string
        }[]
      }
      const candidates = (data.candidates || []).filter((item) =>
        isValidManualImageUrl(item.imageUrl || "")
      )
      if (candidates.length === 0) throw new Error("No image found")
      setImageCandidates(candidates)
      setShowImagePicker(true)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("[image-search]", error)
      }
      const raw =
        error instanceof Error ? error.message : t("No se pudo buscar imagen.")
      const message =
        raw === "No image found" ? "No se encontro imagen para este alimento." : raw
      setImageError((prev) => ({ ...prev, [id]: message }))
    }
    setImageLoading((prev) => ({ ...prev, [id]: false }))
  }

  const handleManualUrlApply = async () => {
    if (!activeFoodId) return
    const trimmed = imageUrlInput.trim()
    if (!isValidManualImageUrl(trimmed)) {
      setManualImageError("Introduce una URL valida (http/https) o data URL de imagen.")
      return
    }
    const inferred = await resolveImageAttribution(trimmed)
    applyCustomImage(activeFoodId, {
      imageUrl: trimmed,
      imageAttribution: inferred.imageAttribution,
      imageAttributionUrl: inferred.imageAttributionUrl,
      source: inferred.source,
    })
    setImageUrlInput("")
    setManualImageError("")
    setShowImagePicker(false)
  }

  const handleLocalImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!activeFoodId) return
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setManualImageError("El archivo debe ser una imagen.")
      return
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(new Error("read failed"))
      reader.readAsDataURL(file)
    })
    applyCustomImage(activeFoodId, {
      imageUrl: dataUrl,
      imageAttribution: `Imagen local: ${file.name}`,
      source: "manual-file",
    })
    setManualImageError("")
    setShowImagePicker(false)
    event.target.value = ""
  }

  const handleClearCustomImage = (id: string) => {
    const current = foodStates[id]
    if (!current?.customImageUrl) return
    const previous = {
      customImageUrl: current.customImageUrl,
      customImageAttribution: current.customImageAttribution,
      customImageAttributionUrl: current.customImageAttributionUrl,
      imageGeneratedAt: current.imageGeneratedAt,
      imageSource: current.imageSource,
    }
    updateFoodState(id, {
      customImageUrl: "",
      customImageAttribution: "",
      customImageAttributionUrl: "",
      imageGeneratedAt: "",
      imageSource: "",
    })
    setImageError((prev) => ({ ...prev, [id]: "" }))
    showUndo(`Imagen de ${foodsById[id]?.name || "alimento"} eliminada`, () => {
      updateFoodState(id, previous)
    })
  }

  const handleToggleFoodHidden = (id: string) => {
    const current = foodStates[id]
    if (!current) return
    const previousHidden = current.isHidden
    updateFoodState(id, { isHidden: !previousHidden })
    showUndo(previousHidden ? "Alimento mostrado de nuevo" : "Alimento ocultado", () => {
      updateFoodState(id, { isHidden: previousHidden })
    })
  }

  const handleExport = async () => {
    if (!profileId) return
    const profile = profiles.find((item) => item.id === profileId)
    if (!profile) return
    const snapshot: ProfileSnapshot = {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      profileId,
      profileName: profile.name,
      shareCode: profile.shareCode,
      babyName: babyNameInput.trim(),
      babyBirthDate: babyBirthDateInput.trim(),
      correctedWeeks,
      revision: 1,
      updatedAt: new Date().toISOString(),
      settings: {
        theme,
        language,
        hideIntroduced,
        showHidden,
        showNotSuitableFoods,
      },
      foods: normalizeFoods(foodStates),
      customFoods: normalizeCustomFoods(customFoods),
      customFamilies: normalizeFamilyList(customFamilies),
      familyOrder: normalizeFamilyList(familyOrder),
      familyOverrides: normalizeFamilyOverrides(familyOverrides),
      order,
      meta: {
        orderUpdatedAt,
      },
    }
    const payload: ExportPayload = {
      exportedAt: new Date().toISOString(),
      metadata: {
        appName: "Tribitr",
        appVersion: packageInfo.version ?? "0.0.0",
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      },
      seed,
      snapshot,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `tribitr-${snapshot.profileName || snapshot.profileId}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as Partial<ExportPayload & ProfileSnapshot>
      const snapshotSource = parsed.snapshot ?? parsed
      const data: ProfileSnapshot = {
        schemaVersion: snapshotSource.schemaVersion ?? SNAPSHOT_SCHEMA_VERSION,
        profileId: snapshotSource.profileId ?? "",
        profileName: snapshotSource.profileName ?? "",
        shareCode: snapshotSource.shareCode ?? "",
        babyName: snapshotSource.babyName ?? "",
        babyBirthDate: snapshotSource.babyBirthDate ?? "",
        correctedWeeks: snapshotSource.correctedWeeks ?? 0,
        revision: snapshotSource.revision ?? 1,
        updatedAt: snapshotSource.updatedAt ?? new Date().toISOString(),
        settings: {
          theme: snapshotSource.settings?.theme ?? "system",
          language: snapshotSource.settings?.language ?? "es",
          hideIntroduced: snapshotSource.settings?.hideIntroduced ?? false,
          showHidden: snapshotSource.settings?.showHidden ?? false,
          showNotSuitableFoods: snapshotSource.settings?.showNotSuitableFoods ?? false,
        },
        foods: snapshotSource.foods ?? {},
        customFoods: normalizeCustomFoods(snapshotSource.customFoods as Record<string, FoodSeed>),
        customFamilies: normalizeFamilyList(snapshotSource.customFamilies),
        familyOrder: normalizeFamilyList(snapshotSource.familyOrder),
        familyOverrides: normalizeFamilyOverrides(
          snapshotSource.familyOverrides as Record<string, FamilyOverride>
        ),
        order: Array.isArray(snapshotSource.order) ? snapshotSource.order : [],
        meta: {
          orderUpdatedAt: snapshotSource.meta?.orderUpdatedAt,
        },
      }
      if (!data.profileId || data.order.length === 0 || !data.foods) {
        throw new Error(t("Formato invalido"))
      }
      const seedFromFile = Array.isArray(parsed.seed)
        ? parsed.seed
        : parsed.seed?.foods || foodsSeed
      const missingFoods = seedFromFile
        .map((item) => item.id)
        .filter((id) => !data.foods[id])
      if (missingFoods.length) {
        const fallback = buildInitialState(
          seedFromFile.filter((food) => missingFoods.includes(food.id))
        )
        data.foods = { ...fallback, ...data.foods }
        data.order = Array.from(new Set([...data.order, ...missingFoods]))
      }
      Object.keys(data.customFoods || {}).forEach((id) => {
        if (!data.foods[id]) {
          data.foods[id] = {
            foodId: id,
            isHidden: false,
            notes: "",
            exposures: [],
            customImageUrl: "",
            customImageAttribution: "",
            customImageAttributionUrl: "",
            imageGeneratedAt: "",
            imageSource: "",
            description: "",
            reactions: "",
            descriptionGeneratedAt: "",
            descriptionModel: "",
            updatedAt: new Date().toISOString(),
          }
        }
      })
      data.foods = normalizeFoods(data.foods)
      await saveSnapshot(data)
      const profile = profiles.find((item) => item.id === data.profileId)
      if (!profile) {
        const nextProfile: Profile = {
          id: data.profileId,
          name: data.profileName || t("Perfil importado"),
          shareCode: data.shareCode || createShareCode(),
          babyName: data.babyName ?? "",
          babyBirthDate: data.babyBirthDate ?? "",
          correctedWeeks: data.correctedWeeks ?? 0,
          updatedAt: new Date().toISOString(),
        }
        const nextProfiles = [...profiles, nextProfile]
        await saveProfiles(nextProfiles)
        setProfiles(nextProfiles)
      } else {
        const nextProfiles = profiles.map((item) =>
          item.id === data.profileId
            ? {
                ...item,
                name: data.profileName || item.name,
                shareCode: data.shareCode || item.shareCode,
                babyName: data.babyName ?? "",
                babyBirthDate: data.babyBirthDate ?? "",
                correctedWeeks: data.correctedWeeks ?? 0,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
        await saveProfiles(nextProfiles)
        setProfiles(nextProfiles)
      }
      setProfileId(data.profileId)
      setFoodStates(data.foods)
      setCustomFoods(data.customFoods || {})
      setCustomFamilies(data.customFamilies || [])
      setFamilyOrder(data.familyOrder || [])
      setFamilyOverrides(data.familyOverrides || {})
      setOrder(data.order)
      setHideIntroduced(data.settings?.hideIntroduced ?? false)
      setShowHidden(data.settings?.showHidden ?? false)
      setShowNotSuitableFoods(data.settings?.showNotSuitableFoods ?? false)
      setTheme(data.settings?.theme ?? "system")
      setLanguage(data.settings?.language ?? "es")
      setNewProfileName(data.profileName ?? "")
      setBabyNameInput(data.profileName || data.babyName || "")
      setBabyBirthDateInput(data.babyBirthDate ?? "")
      setCorrectedWeeksInput(String(data.correctedWeeks ?? 0))
    } catch {
      window.alert(t("No se pudo importar el archivo. Revisa el formato JSON."))
    } finally {
      if (importInputRef.current) importInputRef.current.value = ""
    }
  }

  const handleExportFullBackup = async () => {
    try {
      const response = await fetch(`${apiBase}/api/backup/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `backup export failed (${response.status})`)
      }
      const data = (await response.json()) as { backup?: FullBackupPayload }
      if (!data.backup?.rows) throw new Error(t("Formato de backup invalido"))
      const blob = new Blob([JSON.stringify(data.backup, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      const stamp = new Date().toISOString().replace(/[:.]/g, "-")
      link.download = `tribitr-backup-completo-${stamp}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("No se pudo exportar el backup")
      window.alert(`${t("Error al exportar backup completo.")}\n${message}`)
    }
  }

  const handleImportFullBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as Partial<FullBackupPayload> | { backup?: FullBackupPayload }
      const backup = (parsed as { backup?: FullBackupPayload }).backup ?? (parsed as FullBackupPayload)
      if (!backup?.rows || !Array.isArray(backup.rows)) {
        throw new Error(t("Formato de backup invalido"))
      }
      const confirmed = window.confirm(
        "Esto reemplazara toda la base de datos remota con el contenido del backup. ¿Continuar?"
      )
      if (!confirmed) return

      const response = await fetch(`${apiBase}/api/backup/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup }),
      })
      if (!response.ok) {
        const textError = await response.text()
        throw new Error(textError || `backup import failed (${response.status})`)
      }
      window.alert(
        "Backup completo importado correctamente. Se recargara la app para sincronizar el nuevo estado."
      )
      window.location.reload()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("No se pudo importar el backup")
      window.alert(`${t("Error al importar backup completo.")}\n${message}`)
    } finally {
      if (fullBackupImportInputRef.current) fullBackupImportInputRef.current.value = ""
    }
  }

  const buildShareLink = (code: string) => {
    const base = `${window.location.origin}${window.location.pathname}`
    const params = new URLSearchParams({ share: code })
    return `${base}?${params.toString()}`
  }

  const getShareApiBase = () => {
    const { hostname, protocol, port, origin } = window.location
    if (port === "5173") {
      return origin
    }
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:3001"
    }
    if (!port || port === "80" || port === "443") {
      return origin
    }
    return `${protocol}//${hostname}:3001`
  }

  const clearShareParam = () => {
    const url = new URL(window.location.href)
    if (
      !url.searchParams.has("share") &&
      !url.searchParams.has("pid") &&
      !url.searchParams.has("api")
    )
      return
    url.searchParams.delete("share")
    url.searchParams.delete("pid")
    url.searchParams.delete("api")
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState({}, "", next)
  }

  const extractShareCode = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return ""
    try {
      const url = new URL(trimmed)
      const param = url.searchParams.get("share")
      if (param) return param
    } catch {
    }
    const match = trimmed.match(/[?&]share=([^&]+)/)
    if (match?.[1]) return decodeURIComponent(match[1])
    return trimmed
  }

  const extractProfileId = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return ""
    try {
      const url = new URL(trimmed)
      const param = url.searchParams.get("pid")
      if (param) return param
    } catch {
    }
    const match = trimmed.match(/[?&]pid=([^&]+)/)
    if (match?.[1]) return decodeURIComponent(match[1])
    return ""
  }

  const copyTextToClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.setAttribute("readonly", "")
    textarea.style.position = "absolute"
    textarea.style.left = "-9999px"
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand("copy")
    document.body.removeChild(textarea)
  }

  const showFloatingNotice = (text: string, type: "success" | "error") => {
    setFloatingNotice({ text, type })
    if (floatingNoticeTimerRef.current) {
      window.clearTimeout(floatingNoticeTimerRef.current)
    }
    floatingNoticeTimerRef.current = window.setTimeout(() => {
      setFloatingNotice(null)
      floatingNoticeTimerRef.current = null
    }, 2600)
  }

  const handleCopyShareLinkFromSettings = async () => {
    const profile = profiles.find((item) => item.id === profileId)
    if (!profile) return
    try {
      await copyTextToClipboard(buildShareLink(profile.shareCode))
      showFloatingNotice(t("Enlace copiado al portapapeles."), "success")
    } catch {
      showFloatingNotice(t("No se pudo copiar el enlace."), "error")
    }
  }

  const handleShareProfile = async () => {
    const profile = profiles.find((item) => item.id === profileId)
    if (!profile) return
    const link = buildShareLink(profile.shareCode)
    const shareText = t("Perfil Tribitr: {name}\nCodigo: {code}\nEnlace: {link}")
      .replace("{name}", profile.name)
      .replace("{code}", profile.shareCode)
      .replace("{link}", link)

    if (navigator.share) {
      try {
        await navigator.share({
          title: t("Enlace secreto de Tribitr"),
          text: shareText,
          url: link,
        })
        return
      } catch (error) {
        const shareCancelled =
          error instanceof DOMException &&
          (error.name === "AbortError" || error.name === "NotAllowedError")
        if (shareCancelled) return
      }
    }

    try {
      await copyTextToClipboard(profile.shareCode)
      showFloatingNotice(t("Codigo copiado al portapapeles."), "success")
    } catch {
      showFloatingNotice(t("No se pudo compartir ni copiar el codigo."), "error")
    }
  }

  const handleOpenShareQr = async () => {
    const profile = profiles.find((item) => item.id === profileId)
    if (!profile) return
    const link = buildShareLink(profile.shareCode)
    setShareQrLoading(true)
    setShareQrError("")
    setShareQrUrl("")
    setShareQrLink(link)
    setShowShareQr(true)
    try {
      const url = await QRCode.toDataURL(link, {
        width: 320,
        margin: 2,
        color: { dark: "#1b1b1b", light: "#ffffff" },
      })
      setShareQrUrl(url)
    } catch {
      setShareQrError(t("No se pudo generar el codigo QR."))
    } finally {
      setShareQrLoading(false)
    }
  }

  const handleCopyShareLink = async () => {
    if (!shareQrLink) return
    try {
      await copyTextToClipboard(shareQrLink)
      showFloatingNotice(t("Enlace copiado al portapapeles."), "success")
    } catch {
      showFloatingNotice(t("No se pudo copiar el enlace."), "error")
    }
  }

  const handleSyncNow = async () => {
    if (!syncReady || !profileId) return
    const profile = profiles.find((item) => item.id === profileId)
    if (!profile) return
    setIsSyncing(true)
    try {
      const response = await fetch(`${apiBase}/api/sync/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareCode: profile.shareCode,
          profileId: profile.id,
        }),
      })
      if (response.status === 404) {
        setLastSyncAt(new Date().toISOString())
        setSyncError("")
        showFloatingNotice(t("Sincronizacion completada."), "success")
        return
      }
      if (!response.ok) throw new Error("pull failed")
      const data = (await response.json()) as { snapshot: ProfileSnapshot }
      const localSnapshot = buildLocalSnapshot()
      if (!localSnapshot) return
      const merged = mergeSnapshots(localSnapshot, data.snapshot)
      applySnapshot(merged)
      setLastSyncAt(new Date().toISOString())
      setSyncError("")
      showFloatingNotice(t("Sincronizacion completada."), "success")
    } catch {
      setSyncError(t("No se pudo sincronizar"))
      showFloatingNotice(t("No se pudo sincronizar"), "error")
    } finally {
      setIsSyncing(false)
    }
  }

  const joinWithCode = async (value: string, pid?: string) => {
    const code = extractShareCode(value)
    if (!code) return
    try {
      const targetProfileId = pid || extractProfileId(value)
      const response = await fetch(`${apiBase}/api/sync/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareCode: code,
          profileId: targetProfileId || undefined,
        }),
      })
      if (response.status === 404) {
        window.alert(
          t(
            "No se encontro ningun perfil para ese enlace. Asegurate de que el otro dispositivo haya sincronizado."
          )
        )
        return
      }
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `pull failed (${response.status})`)
      }
      const data = (await response.json()) as { snapshot: ProfileSnapshot }
      const snapshot = data.snapshot
      if (!snapshot?.profileId) throw new Error("invalid snapshot")
      const existing = profiles.find((profile) => profile.id === snapshot.profileId)
      if (!existing) {
        const nextProfile: Profile = {
          id: snapshot.profileId,
          name: snapshot.profileName || t("Perfil compartido"),
          shareCode: code,
          babyName: snapshot.babyName ?? "",
          babyBirthDate: snapshot.babyBirthDate ?? "",
          correctedWeeks: snapshot.correctedWeeks ?? 0,
          updatedAt: new Date().toISOString(),
        }
        const nextProfiles = [...profiles, nextProfile]
        await saveProfiles(nextProfiles)
        setProfiles(nextProfiles)
      } else {
        const nextProfiles = profiles.map((profile) =>
          profile.id === snapshot.profileId
            ? {
                ...profile,
                name: snapshot.profileName || profile.name,
                shareCode: code || profile.shareCode,
                babyName: snapshot.babyName ?? "",
                babyBirthDate: snapshot.babyBirthDate ?? "",
                correctedWeeks: snapshot.correctedWeeks ?? 0,
                updatedAt: new Date().toISOString(),
              }
            : profile
        )
        await saveProfiles(nextProfiles)
        setProfiles(nextProfiles)
      }
      await saveSnapshot(snapshot)
      applySnapshot(snapshot)
      setProfileId(snapshot.profileId)
      setJoinShareCode("")
      clearShareParam()
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("No se pudo unir al perfil.")
      window.alert(message)
    }
  }

  const handleJoinShareCode = async () => {
    await joinWithCode(joinShareCode)
  }

  const handleCreateProfile = async () => {
    const trimmed = newProfileName.trim()
    if (!trimmed) return
    const nextProfile: Profile = {
      id: `profile-${Date.now()}`,
      name: trimmed,
      shareCode: createShareCode(),
      babyName: "",
      babyBirthDate: "",
      correctedWeeks: 0,
      updatedAt: new Date().toISOString(),
    }
    const nextProfiles = [...profiles, nextProfile]
    await saveProfiles(nextProfiles)
    await saveSnapshot(createSnapshot(nextProfile))
    setProfiles(nextProfiles)
    setProfileId(nextProfile.id)
    setNewProfileName(nextProfile.name)
    setShowCreateProfileAction(false)
    setBabyNameInput("")
    setBabyBirthDateInput("")
    setCorrectedWeeksInput("0")
  }

  const handleSaveProfileDetails = async () => {
    if (!profileId) return
    const normalizedProfileName = newProfileName.trim()
    if (!normalizedProfileName) return
    const correctedWeeksValue = Math.max(0, Number.parseInt(correctedWeeksInput, 10) || 0)
    const normalizedBirthDate = babyBirthDateInput.trim()
    setCorrectedWeeksInput(String(correctedWeeksValue))
    const nextProfiles = profiles.map((profile) =>
      profile.id === profileId
        ? {
            ...profile,
            name: normalizedProfileName,
            babyName: babyNameInput.trim(),
            babyBirthDate: normalizedBirthDate,
            correctedWeeks: correctedWeeksValue,
            updatedAt: new Date().toISOString(),
          }
        : profile
    )
    await saveProfiles(nextProfiles)
    setProfiles(nextProfiles)

    const snapshot = await getSnapshot(profileId)
    if (!snapshot) return
    await saveSnapshot({
      ...snapshot,
      profileName: normalizedProfileName,
      babyName: babyNameInput.trim(),
      babyBirthDate: normalizedBirthDate,
      correctedWeeks: correctedWeeksValue,
      updatedAt: new Date().toISOString(),
    })
    setShowCreateProfileAction(false)
  }

  const handleDeleteProfile = async () => {
    if (!profileId) return
    if (profiles.length <= 1) {
      window.alert(t("Debe existir al menos un perfil."))
      return
    }
    const activeProfile = profiles.find((profile) => profile.id === profileId)
    if (!activeProfile) return
    const confirmed = window.confirm(
      t(
        `Eliminar el perfil "${activeProfile.name}"? Esta accion no se puede deshacer.`,
        `Delete profile "${activeProfile.name}"? This action cannot be undone.`
      )
    )
    if (!confirmed) return
    const nextProfiles = profiles.filter((profile) => profile.id !== profileId)
    await saveProfiles(nextProfiles)
    await deleteSnapshot(profileId)
    setProfiles(nextProfiles)
    setProfileId(nextProfiles[0]?.id || "")
    setNewProfileName(nextProfiles[0]?.name || "")
    setBabyNameInput(nextProfiles[0]?.name || "")
    setShowCreateProfileAction(false)
  }

  const visibleIds = useMemo(() => {
    const lowered = search.trim().toLowerCase()
    return order.filter((id) => {
      const food = foodsById[id]
      if (!food) return false
      const state = foodStates[id]
      if (!showHidden && state.isHidden) return false
      if (hideIntroduced && state.exposures.length >= 3) return false
      const suitability = getFoodSuitability(food.recommendedFromMonths, correctedAgeMonths)
      if (!showNotSuitableFoods && suitability.isTooEarly) return false
      if (activeFamily !== "Todos" && food.family !== activeFamily) return false
      if (lowered && !food.name.toLowerCase().includes(lowered)) return false
      return true
    })
  }, [
    order,
    foodsById,
    foodStates,
    showHidden,
    hideIntroduced,
    showNotSuitableFoods,
    correctedAgeMonths,
    activeFamily,
    search,
  ])

  const activeFood = activeFoodId ? foodsById[activeFoodId] : null
  const activeFoodState = activeFoodId ? foodStates[activeFoodId] : null
  const activeFoodSuitability = getFoodSuitability(
    activeFood?.recommendedFromMonths,
    correctedAgeMonths
  )
  const activeFoodAgeWarningHighlighted =
    typeof activeFood?.recommendedFromMonths === "number" &&
    (activeFood.recommendedFromMonths >= 12 || activeFoodSuitability.isTooEarly)

  useEffect(() => {
    if (!activeFoodId || !activeFoodState) return
    const hasAiContent = Boolean(activeFoodState.description || activeFoodState.reactions)
    if (hasAiContent || aiLoading[activeFoodId]) return
    if (aiAutoRequestedRef.current[activeFoodId]) return
    aiAutoRequestedRef.current[activeFoodId] = true
    void handleGenerateAi(activeFoodId)
  }, [activeFoodId, activeFoodState, aiLoading])

  const currentProfileShareCode =
    profiles.find((item) => item.id === profileId)?.shareCode || ""
  const activeListFilterCount = Number(hideIntroduced) + Number(showHidden)

  const handleAcceptCookieNotice = () => {
    localStorage.setItem(cookieNoticeStorageKey, "accepted")
    setCookieNoticeAccepted(true)
  }

  if (!isReady || !isProfileLoaded) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 text-sm text-[var(--muted)]">
          {t("Cargando datos...")}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--header)] text-[var(--header-text)] shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setView(defaultMainView)}
              className="text-2xl font-semibold"
            >
              tribitr
            </button>
            {view === "list" && (
              <span className="sr-only">{activeFamily}</span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {syncError && (
              <span
                aria-live="polite"
                className="inline-flex items-center gap-1 rounded-full border border-[#f2c3c3] bg-[#ffeaea] px-2 py-2 text-xs text-[#9b2b2b] sm:px-3"
                title={syncError}
              >
                <ErrorOutlineIcon />
                <span className="hidden sm:inline">{t("Error sync")}</span>
              </span>
            )}
            <div data-tour="profile-selector">
              <PillMenu
                value={profileId}
                ariaLabel={t("Seleccionar perfil")}
                onChange={(value) => {
                  setProfileId(value)
                  const selectedProfile = profiles.find((profile) => profile.id === value)
                  if (!selectedProfile) return
                  setNewProfileName(selectedProfile.name)
                  setShowCreateProfileAction(false)
                  setBabyNameInput(selectedProfile.name)
                  setBabyBirthDateInput(selectedProfile.babyBirthDate ?? "")
                  setCorrectedWeeksInput(String(selectedProfile.correctedWeeks ?? 0))
                }}
                options={profiles.map((profile) => ({
                  value: profile.id,
                  label: profile.name,
                }))}
                minWidthClass="min-w-[118px] sm:min-w-[160px]"
                buttonClassName="border-white/30 bg-white/10 text-[var(--header-text)]"
              />
            </div>
            <button
              type="button"
              onClick={() => setView("settings")}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white text-[var(--header)] dark:bg-white/10 dark:text-[var(--header-text)]"
              aria-label={t("Ajustes")}
              title={t("Ajustes")}
              data-tour="settings-entry"
            >
              <SettingsIcon />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
        {familyHomeEnabled && view === "home" && (
          <section className="fade-in">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <h1 className="text-3xl font-semibold">{t("Familias de alimentos")}</h1>
              </div>
            </div>
            <div data-tour="home-families" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <button
                type="button"
                aria-label={t("Todos los alimentos")}
                onClick={() => {
                  setActiveFamily("Todos")
                  setView("list")
                }}
                className="card group relative flex flex-col gap-4 p-5 text-left shadow-soft transition hover:-translate-y-1"
              >
                {allFoodsCover && (
                  <img
                    src={getImageSrc(allFoodsCover.imageUrl, t("Todos"))}
                    alt={t("Todos los alimentos")}
                    className="h-32 w-full rounded-2xl border border-[var(--border)] object-cover"
                    loading="lazy"
                  />
                )}
                <div className="text-2xl font-semibold">{t("Todos los alimentos")}</div>
                <div className="text-xs text-[var(--muted)]">
                  {visibleFoodCount} {t("alimentos disponibles")}
                </div>
                {allFoodsCover?.imageAttribution && (
                  <AttributionTooltip
                    label={allFoodsCover.imageAttribution}
                    url={allFoodsCover.imageAttributionUrl}
                    className="absolute bottom-4 right-4"
                  />
                )}
              </button>
              {families.map((family) => (
                <button
                  key={family}
                  type="button"
                  aria-label={formatFamily(family)}
                  onClick={() => {
                    setActiveFamily(family)
                    setView("list")
                  }}
                  className="card group relative flex flex-col gap-4 p-5 text-left shadow-soft transition hover:-translate-y-1"
                >
                  {familyCovers[family] && (
                    <img
                      src={getImageSrc(familyCovers[family].imageUrl, formatFamily(family))}
                      alt={formatFamily(family)}
                      className="h-32 w-full rounded-2xl border border-[var(--border)] object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="text-2xl font-semibold">
                    {formatFamily(family)}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {visibleFoodCountByFamily[family] || 0} {t("alimentos")}
                  </div>
                  {familyCovers[family]?.attribution && (
                    <AttributionTooltip
                      label={familyCovers[family].attribution || ""}
                      url={familyCovers[family].attributionUrl}
                      className="absolute bottom-4 right-4"
                    />
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {view === "list" && (
          <section className="slide-up">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold">
                  {activeFamily === "Todos"
                    ? t("Todos los alimentos")
                    : formatFamily(activeFamily)}
                </h1>
              </div>
              {familyHomeEnabled && (
                <button
                  type="button"
                  onClick={() => setView("home")}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--pill)]"
                  aria-label={t("Volver")}
                  title={t("Volver")}
                >
                  <ArrowBackIcon />
                </button>
              )}
            </div>
            <div
              data-tour="list-controls"
              className="sticky top-[70px] z-10 rounded-3xl border border-[var(--border)] bg-[var(--card)]/90 p-4 shadow-sm backdrop-blur sm:top-[78px]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("Buscar alimento")}
                    className="w-full rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setNewFoodName("")
                      setNewFoodFamily(
                        activeFamily !== "Todos" ? activeFamily : families[0] || ""
                      )
                      setNewFoodAllergens("")
                      setShowAddFood(true)
                    }}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--pill)]"
                    aria-label={t("Anadir alimento")}
                    title={t("Anadir alimento")}
                  >
                    <AddIcon />
                  </button>
                  <div ref={sortMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSortMenu((prev) => !prev)
                        setShowFilterMenu(false)
                      }}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--pill)]"
                      aria-label={t("Ordenar alimentos")}
                      title={t("Ordenar alimentos")}
                      aria-haspopup="menu"
                      aria-expanded={showSortMenu}
                    >
                      <SortIcon />
                    </button>
                    {showSortMenu && (
                      <div className="fixed inset-x-4 top-[132px] z-30 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-soft sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:min-w-[120px]">
                        <button
                          type="button"
                          onClick={() => {
                            handleSortDirectionChange("asc")
                            setShowSortMenu(false)
                          }}
                          className={`block w-full rounded-xl px-3 py-2 text-left text-xs ${
                            sortDirection === "asc" ? "bg-[var(--pill)] font-semibold" : "hover:bg-[var(--pill-muted)]"
                          }`}
                        >
                          A-Z
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleSortDirectionChange("desc")
                            setShowSortMenu(false)
                          }}
                          className={`mt-1 block w-full rounded-xl px-3 py-2 text-left text-xs ${
                            sortDirection === "desc" ? "bg-[var(--pill)] font-semibold" : "hover:bg-[var(--pill-muted)]"
                          }`}
                        >
                          Z-A
                        </button>
                      </div>
                    )}
                  </div>
                  <div ref={filterMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowFilterMenu((prev) => !prev)
                        setShowSortMenu(false)
                      }}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--pill)]"
                      aria-label={t("Filtros")}
                      title={t("Filtros")}
                      aria-haspopup="menu"
                      aria-expanded={showFilterMenu}
                    >
                      <FilterListIcon />
                    </button>
                    {activeListFilterCount > 0 && (
                      <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold text-white">
                        {activeListFilterCount}
                      </span>
                    )}
                    {showFilterMenu && (
                      <div className="fixed inset-x-4 top-[132px] z-30 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-soft sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:min-w-[270px]">
                        <label className="block rounded-xl px-2 py-2 text-xs">
                          <span className="mb-1 block text-[var(--muted)]">{t("Filtrar por familia de alimentos")}</span>
                          <select
                            value={activeFamily}
                            onChange={(event) => setActiveFamily(event.target.value)}
                            className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-xs"
                          >
                            <option value="Todos">{t("Todas las familias")}</option>
                            {families.map((family) => (
                              <option key={family} value={family}>
                                {formatFamily(family)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex items-center gap-2 rounded-xl px-2 py-2 text-xs hover:bg-[var(--pill-muted)]">
                          <input
                            type="checkbox"
                            checked={hideIntroduced}
                            onChange={(event) => setHideIntroduced(event.target.checked)}
                          />
                          {t("Ocultar 3/3")}
                        </label>
                        <label className="mt-1 flex items-center gap-2 rounded-xl px-2 py-2 text-xs hover:bg-[var(--pill-muted)]">
                          <input
                            type="checkbox"
                            checked={showHidden}
                            onChange={(event) => setShowHidden(event.target.checked)}
                          />
                          {t("Mostrar ocultos")}
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-4">
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={visibleIds}
                  strategy={verticalListSortingStrategy}
                >
                  {visibleIds.map((id) => (
                    <SortableFoodRow
                      key={id}
                      food={foodsById[id]}
                      state={foodStates[id]}
                      language={language}
                      ageMonths={correctedAgeMonths}
                      onToggleExposure={toggleExposure}
                      onOpen={(foodId) => setActiveFoodId(foodId)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              {visibleIds.length === 0 && (
                <div className="card p-8 text-center text-sm text-[var(--muted)]">
                  {t("No hay alimentos que coincidan con los filtros actuales.")}
                </div>
              )}
            </div>
          </section>
        )}

        {view === "settings" && (
          <section className="slide-up">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold">{t("Ajustes")}</h1>
              </div>
              <button
                type="button"
                onClick={() => setView(defaultMainView)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--pill)]"
                aria-label={t("Volver")}
                title={t("Volver")}
              >
                <ArrowBackIcon />
              </button>
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              {([
                { id: "profile", label: t("Perfiles") },
                { id: "sync", label: t("Sincronizacion") },
                { id: "appearance", label: t("Configuración") },
                { id: "data", label: t("Exportar / Importar") },
                { id: "legal", label: t("Legal") },
              ] as const).map((section) => (
                <button
                  key={section.id}
                  type="button"
                  aria-pressed={settingsSection === section.id}
                  onClick={() => setSettingsSection(section.id)}
                  className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm ${
                    settingsSection === section.id
                      ? "border-[var(--accent)] bg-[var(--pill)] text-[var(--accent-strong)]"
                      : "border-[var(--border)] bg-transparent"
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {settingsSection === "appearance" && (
                <div data-tour="settings-configuration" className="grid gap-6 lg:grid-cols-2 lg:items-start">
                  <div className="card p-6 shadow-soft">
                    <h2 className="text-xl font-semibold">{t("Tema")}</h2>
                    <p className="mt-2 text-sm text-[var(--muted)]">{t("Ajusta la apariencia de la app.")}</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {([
                        { value: "light", label: t("Claro") },
                        { value: "dark", label: t("Oscuro") },
                        { value: "system", label: t("Sistema") },
                      ] as const).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={theme === option.value}
                          onClick={() => setTheme(option.value)}
                          className={`rounded-2xl border px-4 py-3 text-sm transition ${
                            theme === option.value
                              ? "border-[var(--accent)] bg-[var(--pill)] text-[var(--accent-strong)]"
                              : "border-[var(--border)] bg-transparent text-[var(--text)] hover:bg-[var(--pill-muted)]"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="card p-6 shadow-soft">
                    <h2 className="text-xl font-semibold">{t("Idioma")}</h2>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {t("Elige el idioma de la interfaz.")}
                    </p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {([
                        { value: "es", label: "Español" },
                        { value: "en", label: "English" },
                      ] as const).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={language === option.value}
                          onClick={() => setLanguage(option.value)}
                          className={`rounded-2xl border px-4 py-3 text-sm transition ${
                            language === option.value
                              ? "border-[var(--accent)] bg-[var(--pill)] text-[var(--accent-strong)]"
                              : "border-[var(--border)] bg-transparent text-[var(--text)] hover:bg-[var(--pill-muted)]"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="card p-6 shadow-soft">
                    <h2 className="text-xl font-semibold">{t("Ver visita rapida")}</h2>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {t("En menos de un minuto te enseño las partes clave para empezar.")}
                    </p>
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowOnboardingPrompt(false)
                          startOnboarding()
                        }}
                        className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
                      >
                        {t("Empezar")}
                      </button>
                    </div>
                  </div>

                  <div className="card p-6 shadow-soft">
                    <h2 className="text-xl font-semibold">{t("Familias de alimentos")}</h2>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {t("Edita familias de alimentos, imagenes y orden de la pantalla principal.")}
                    </p>
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => setShowFamilyManager(true)}
                        className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
                      >
                        {t("Editar familias")}
                      </button>
                    </div>
                  </div>

                  <div className="card p-6 shadow-soft">
                    <h2 className="text-xl font-semibold">{t("Alimentos ocultos")}</h2>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {t("Gestiona los alimentos ocultos desde un panel dedicado.")}
                    </p>
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => setShowHiddenManager(true)}
                        className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
                      >
                        {t("Editar alimentos ocultos")}
                      </button>
                    </div>
                  </div>

                  <div className="card p-6 shadow-soft">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold">{t("Alergenos")}</h2>
                      <button
                        type="button"
                        onClick={() => setShowLegend(true)}
                        className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-3 py-1 text-xs"
                      >
                        {t("Ver leyenda")}
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {t("Consulta las abreviaturas usadas en la lista.")}
                    </p>
                  </div>
                </div>
              )}

              {settingsSection === "sync" && (
                <div data-tour="settings-sync" className="card p-6 shadow-soft">
                  <h2 className="text-xl font-semibold">{t("Sincronizacion")}</h2>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {t("Compartir con otro dispositivo.")}
                  </p>
                  <div className="mt-4 flex flex-col gap-3">
                    <div className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                      <div className="flex items-center justify-between gap-3">
                        <span>
                          {t("Última sincronización")}: {lastSyncAt ? formatDateWithTimeSeconds(lastSyncAt, language) : t("pendiente")}
                        </span>
                        <button
                          type="button"
                          onClick={handleSyncNow}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]"
                          aria-label={t("Sincronizar ahora")}
                          title={t("Sincronizar ahora")}
                        >
                          <SyncIcon />
                        </button>
                      </div>
                      {syncError && (
                        <div className="mt-2 text-xs text-[var(--accent-strong)]">
                          {syncError}
                        </div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--pill)] p-4 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-xs text-[var(--muted)]">{t("Código del perfil")}</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopyShareLinkFromSettings}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]"
                            aria-label={t("Copiar enlace")}
                            title={t("Copiar enlace")}
                          >
                            <CopyIcon />
                          </button>
                          <button
                            type="button"
                            onClick={handleShareProfile}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]"
                            aria-label={t("Compartir")}
                            title={t("Compartir")}
                          >
                            <ShareIcon />
                          </button>
                          <button
                            type="button"
                            onClick={handleOpenShareQr}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]"
                            aria-label={t("Generar QR")}
                            title={t("Generar QR")}
                          >
                            <QrIcon />
                          </button>
                        </div>
                      </div>
                      <code className="mt-1 block break-all font-mono text-[13px] text-[var(--text)]">
                        {currentProfileShareCode || "-"}
                      </code>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={joinShareCode}
                        onChange={(event) => setJoinShareCode(event.target.value)}
                        placeholder={t("Pega el codigo o el enlace para cargar un perfil")}
                        className="w-full rounded-full border border-[var(--border)] bg-transparent px-4 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleJoinShareCode}
                        className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
                      >
                        {t("Unirse")}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {settingsSection === "profile" && (
                <div data-tour="settings-profiles" className="card p-6 shadow-soft">
                  <h2 className="text-xl font-semibold">{t("Perfiles")}</h2>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {t("Gestiona perfiles para diferentes cuidadores.")}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {profiles.map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => {
                        setProfileId(profile.id)
                        setNewProfileName(profile.name)
                        setShowCreateProfileAction(false)
                        setBabyNameInput(profile.name)
                        setBabyBirthDateInput(profile.babyBirthDate ?? "")
                        setCorrectedWeeksInput(String(profile.correctedWeeks ?? 0))
                      }}
                        className={`rounded-full border px-4 py-2 text-sm ${
                          profileId === profile.id
                            ? "border-[var(--accent)] bg-[var(--pill)]"
                            : "border-[var(--border)]"
                        }`}
                      >
                        {profile.name}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateProfileAction(true)
                        setProfileId("")
                        setNewProfileName("")
                        setBabyNameInput("")
                        setBabyBirthDateInput("")
                        setCorrectedWeeksInput("0")
                      }}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--pill)]"
                      aria-label={t("Nuevo perfil")}
                      title={t("Nuevo perfil")}
                    >
                      <AddIcon />
                    </button>
                  </div>
                  <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
                    <div className="text-sm font-semibold">{t("Ficha del bebe")}</div>
                    <input
                      value={babyNameInput}
                      onChange={(event) => {
                        const value = event.target.value
                        setBabyNameInput(value)
                        setNewProfileName(value)
                      }}
                      placeholder={t("Nombre")}
                      className="w-full rounded-full border border-[var(--border)] bg-transparent px-4 py-2 text-sm"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
                        <span>{t("Fecha de nacimiento")}</span>
                        <input
                          type="date"
                          value={babyBirthDateInput}
                          onChange={(event) => setBabyBirthDateInput(event.target.value)}
                          className="rounded-full border border-[var(--border)] bg-transparent px-4 py-2 text-sm text-[var(--text)]"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
                        <span>{t("Semanas de correccion")}</span>
                        <input
                          type="number"
                          min={0}
                          value={correctedWeeksInput}
                          onChange={(event) => setCorrectedWeeksInput(event.target.value)}
                          className="rounded-full border border-[var(--border)] bg-transparent px-4 py-2 text-sm text-[var(--text)]"
                        />
                      </label>
                    </div>
                    <label className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--pill)] px-3 py-2 text-xs">
                      <input
                        type="checkbox"
                        checked={showNotSuitableFoods}
                        onChange={(event) => setShowNotSuitableFoods(event.target.checked)}
                      />
                      {t("Mostrar alimentos no aptos todavia")}
                    </label>
                    {correctedAgeMonths !== null && (
                      <div className="text-xs text-[var(--muted)]">
                        {t("Edad corregida actual: {age} meses.").replace(
                          "{age}",
                          String(correctedAgeMonths)
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3 pt-2">
                      {showCreateProfileAction ? (
                        <button
                          type="button"
                          onClick={handleCreateProfile}
                          className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
                        >
                          {t("Crear")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSaveProfileDetails}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--pill)]"
                          aria-label={t("Guardar")}
                          title={t("Guardar")}
                        >
                          <CheckIcon />
                        </button>
                      )}
                      {!showCreateProfileAction && (
                        <button
                          type="button"
                          onClick={handleDeleteProfile}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)]"
                          aria-label={t("Eliminar")}
                          title={t("Eliminar")}
                        >
                          <DeleteIcon />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {settingsSection === "data" && (
                <div data-tour="settings-data" className="card p-6 shadow-soft">
                  <div>
                    <h2 className="text-xl font-semibold">{t("Exportar / Importar")}</h2>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {t("Perfil actual o copia de seguridad completa de la base de datos.")}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleExport}
                        className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
                      >
                        {t("Exportar perfil")}
                      </button>
                      <button
                        type="button"
                        onClick={() => importInputRef.current?.click()}
                        className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
                      >
                        {t("Importar perfil")}
                      </button>
                      <button
                        type="button"
                        onClick={handleExportFullBackup}
                        className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
                      >
                        {t("Exportar backup completo")}
                      </button>
                      <button
                        type="button"
                        onClick={() => fullBackupImportInputRef.current?.click()}
                        className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
                      >
                        {t("Importar backup completo (replace)")}
                      </button>
                      <input
                        ref={importInputRef}
                        type="file"
                        accept="application/json"
                        className="hidden"
                        onChange={handleImport}
                      />
                      <input
                        ref={fullBackupImportInputRef}
                        type="file"
                        accept="application/json"
                        className="hidden"
                        onChange={handleImportFullBackup}
                      />
                    </div>
                  </div>

                </div>
              )}

              {settingsSection === "legal" && (
                <div className="card p-6 shadow-soft">
                  <h2 className="text-xl font-semibold">{t("Legal")}</h2>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {t("Consulta privacidad, descargo medico y licencia AGPLv3.")}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <a
                      href="/legal/privacy.html"
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
                    >
                      {t("Privacidad")}
                    </a>
                    <a
                      href="/legal/disclaimer.html"
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
                    >
                      {t("Disclaimer")}
                    </a>
                    <a
                      href="/legal/license.html"
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
                    >
                      {t("Licencia")}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-[var(--border)] bg-[var(--card)]/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-5 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span>{t("Creado por")}: {AUTHOR_NAME}</span>
            <a className="underline" href={`mailto:${AUTHOR_EMAIL}`}>{AUTHOR_EMAIL}</a>
            <span>·</span>
            <span>{t("Hecho con GPT-Codex")}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={AUTHOR_GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--pill)] px-3 py-1"
              aria-label="GitHub"
              title="GitHub"
            >
              <GitHubIcon />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <a
              href={AUTHOR_LINKEDIN_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--pill)] px-3 py-1"
              aria-label="LinkedIn"
              title="LinkedIn"
            >
              <LinkedInIcon />
              <span className="hidden sm:inline">LinkedIn</span>
            </a>
            <a className="underline" href="/legal/privacy.html" target="_blank" rel="noreferrer">{t("Privacidad")}</a>
            <a className="underline" href="/legal/disclaimer.html" target="_blank" rel="noreferrer">{t("Disclaimer")}</a>
            <a className="underline" href="/legal/license.html" target="_blank" rel="noreferrer">{t("Licencia")}</a>
          </div>
        </div>
      </footer>

      {floatingNotice && (
        <div className="fixed right-4 top-4 z-50">
          <div
            className={`rounded-xl border px-4 py-2 text-sm shadow-soft ${
              floatingNotice.type === "error"
                ? "border-red-300 bg-red-50 text-red-800"
                : "border-[var(--border)] bg-[var(--card)] text-[var(--text)]"
            }`}
          >
            {floatingNotice.text}
          </div>
        </div>
      )}

      {!cookieNoticeAccepted && (
        <div className="fixed bottom-4 left-1/2 z-40 w-[min(94vw,760px)] -translate-x-1/2 rounded-2xl border border-[var(--border)] bg-[var(--card)]/95 p-3 shadow-soft backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--muted)]">
              {t("Usamos almacenamiento local para guardar progreso y sincronizacion.")} {" "}
              <a className="underline" href="/legal/privacy.html" target="_blank" rel="noreferrer">
                {t("Privacidad")}
              </a>
            </p>
            <button
              type="button"
              onClick={handleAcceptCookieNotice}
              className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-xs"
            >
              {t("Entendido")}
            </button>
          </div>
        </div>
      )}

      {showOnboardingPrompt && !onboardingActive && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
          <div className="card w-full max-w-md max-h-[88vh] overflow-y-auto p-6 shadow-soft">
            <h3 className="text-xl font-semibold">{t("¿Quieres una visita rápida?")}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {t("En menos de un minuto te enseño las partes clave para empezar.")}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(onboardingStorageKey, "done")
                  setShowOnboardingPrompt(false)
                }}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm"
              >
                {t("Ahora no")}
              </button>
              <button
                type="button"
                onClick={startOnboarding}
                className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
              >
                {t("Empezar")}
              </button>
            </div>
          </div>
        </div>
      )}

      {onboardingActive && currentOnboardingStep && (
        <div className="pointer-events-none fixed inset-0 z-40 bg-black/40">
          {onboardingTargetRect && (
            <div
              className="absolute rounded-2xl border-2 border-[var(--accent)] shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              style={{
                top: Math.max(onboardingTargetRect.top - 6, 0),
                left: Math.max(onboardingTargetRect.left - 6, 0),
                width: onboardingTargetRect.width + 12,
                height: onboardingTargetRect.height + 12,
              }}
            />
          )}
          {onboardingTargetRect && (
            <div
              className="pointer-events-auto absolute w-[min(92vw,360px)] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-soft"
              style={(() => {
                const viewportWidth = window.innerWidth
                const viewportHeight = window.innerHeight
                const isMobile = viewportWidth < 768
                const tooltipWidth = Math.min(viewportWidth * 0.92, 360)
                const tooltipHeight = 240
                const margin = 12
                const belowTop = onboardingTargetRect.top + onboardingTargetRect.height + 16
                const aboveTop = onboardingTargetRect.top - tooltipHeight - 16
                const forceAbove = currentOnboardingStep.placement === "above"
                const forceBelow = currentOnboardingStep.placement === "below"
                if (isMobile && !forceAbove && !forceBelow) {
                  return {
                    left: margin,
                    right: margin,
                    bottom: margin,
                    width: "auto",
                  }
                }
                const shouldUseAbove = forceAbove
                  ? true
                  : forceBelow
                    ? false
                    : belowTop > viewportHeight - tooltipHeight - margin
                const rawTop = shouldUseAbove ? aboveTop : belowTop
                const top = Math.min(
                  Math.max(rawTop, margin),
                  viewportHeight - tooltipHeight - margin
                )
                const left = Math.min(
                  Math.max(onboardingTargetRect.left, margin),
                  viewportWidth - tooltipWidth - margin
                )
                return { top, left }
              })()}
            >
              <div className="text-xs text-[var(--muted)]">
                {t("Paso")} {onboardingStepIndex + 1} {t("de")} {onboardingSteps.length}
              </div>
              <h4 className="mt-1 text-base font-semibold">{currentOnboardingStep.title}</h4>
              <p className="mt-2 text-sm text-[var(--muted)]">{currentOnboardingStep.description}</p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => completeOnboarding()}
                  className="rounded-full border border-[var(--border)] px-3 py-1 text-xs"
                >
                  {t("Saltar")}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={onboardingStepIndex === 0}
                    onClick={goPrevOnboardingStep}
                    className="rounded-full border border-[var(--border)] px-3 py-1 text-xs disabled:opacity-40"
                  >
                    {t("Atras")}
                  </button>
                  <button
                    type="button"
                    onClick={goNextOnboardingStep}
                    className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-3 py-1 text-xs"
                  >
                    {onboardingStepIndex === onboardingSteps.length - 1
                      ? t("Finalizar")
                      : t("Siguiente")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showFamilyManager && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowFamilyManager(false)}
        >
          <div
            className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">{t("Editar familias")}</h3>
              <button
                type="button"
                onClick={() => setShowFamilyManager(false)}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-sm"
              >
                {t("Cerrar")}
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                value={newFamilyName}
                onChange={(event) => setNewFamilyName(event.target.value)}
                placeholder={t("Nueva familia")}
                className="w-full rounded-2xl border border-[var(--border)] bg-transparent px-4 py-3 text-sm"
              />
              <button
                type="button"
                onClick={handleAddFamily}
                className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
              >
                {t("Anadir")}
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <DndContext sensors={sensors} onDragEnd={handleFamilyDragEnd}>
                <SortableContext items={families} strategy={verticalListSortingStrategy}>
                  {families.map((family) => (
                    <SortableFamilyRow
                      key={family}
                      family={family}
                      language={language}
                      foodCount={visibleFoodCountByFamily[family] || 0}
                      hasCustomImage={Boolean(familyOverrides[family]?.imageUrl)}
                      imageLoading={Boolean(familyImageLoading[family])}
                      imageError={familyImageError[family]}
                      onGenerateImage={handleGenerateFamilyImage}
                      onOpenImagePicker={(selectedFamily) => {
                        setActiveFamilyForImage(selectedFamily)
                        setFamilyImageCandidates([])
                        setFamilyImageUrlInput("")
                        setFamilyManualImageError("")
                        setShowFamilyImagePicker(true)
                      }}
                      onClearImage={handleClearFamilyImage}
                      onRemoveFamily={handleRemoveFamily}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>
      )}

      {activeFood && activeFoodState && (
        <div
          className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10"
          onClick={() => setActiveFoodId(null)}
        >
          <div
            className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-soft"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveFoodId(null)}
                  className="rounded-full border border-[var(--border)] px-3 py-1 text-sm"
                  aria-label={t("Cerrar")}
                >
                  <span className="sm:hidden">X</span>
                  <span className="hidden sm:inline">{t("Cerrar")}</span>
                </button>
              </div>
              <div className="mt-4 card p-3">
                <img
                  src={getImageSrc(
                    activeFoodState.customImageUrl || activeFood.imageUrl,
                    activeFood.name
                  )}
                  alt={activeFood.name}
                  className="h-52 w-full rounded-3xl object-cover"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={imageLoading[activeFood.id]}
                      onClick={() => handleGenerateImage(activeFood.id)}
                      className={`rounded-full border px-4 py-2 text-sm ${
                        imageLoading[activeFood.id]
                          ? "border-[var(--border)] text-[var(--muted)]"
                          : "border-[var(--border)] bg-[var(--pill)]"
                      }`}
                    >
                      {imageLoading[activeFood.id]
                        ? t("Buscando imagenes...")
                        : t("Buscar imagen")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setManualImageError("")
                        setImageUrlInput("")
                        setImageCandidates([])
                        setShowImagePicker(true)
                      }}
                      className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
                    >
                      {t("URL o archivo")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClearCustomImage(activeFood.id)}
                      className="rounded-full border border-[var(--border)] px-4 py-2 text-sm"
                    >
                      {t("Borrar imagen")}
                    </button>
                  </div>
                  <span className="text-xs text-[var(--muted)]">
                    {activeFoodState.imageSource
                      ? `${t("Fuente")}: ${formatImageSourceLabel(activeFoodState.imageSource, language)}`
                      : `${t("Fuente")}: seed`}
                  </span>
                </div>
                {imageError[activeFood.id] && (
                  <p className="mt-2 text-xs text-[var(--accent-strong)]">
                    {imageError[activeFood.id]}
                  </p>
                )}
              </div>
              <div className="mt-4">
                <h2 className="text-2xl font-semibold">{activeFood.name}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="pill pill-strong">
                    {activeFoodState.exposures.length}/3
                  </span>
                  {activeFoodState.exposures.length >= 3 && (
                    <span className="inline-flex items-center justify-center rounded-full border border-[var(--accent)]/40 bg-[var(--pill)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
                      ✓
                    </span>
                  )}
                  <span className="pill">{formatFamily(activeFood.family)}</span>
                  <span className="pill">{renderAllergens(activeFood.allergens, language)}</span>
                  {typeof activeFood.recommendedFromMonths === "number" && (
                    <span
                      className={`pill ${
                        activeFoodAgeWarningHighlighted
                          ? "border !border-red-700 !bg-red-600 !text-white font-semibold"
                          : ""
                      }`}
                    >
                      {activeFoodSuitability.isTooEarly
                        ? `${t("No apto")}: +${activeFood.recommendedFromMonths}m`
                        : `+${activeFood.recommendedFromMonths}m`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {typeof activeFood.recommendedFromMonths === "number" && (
              <div
                className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                  activeFoodAgeWarningHighlighted
                    ? "border-red-300 bg-red-50 text-red-800"
                    : "border-[var(--border)] bg-[var(--pill)] text-[var(--muted)]"
                }`}
              >
                {correctedAgeMonths === null
                  ? t("Recomendado desde {months} meses.").replace(
                      "{months}",
                      String(activeFood.recommendedFromMonths)
                    )
                  : t("Recomendado desde {months} meses. Edad actual: {age} meses.")
                      .replace("{months}", String(activeFood.recommendedFromMonths))
                      .replace("{age}", String(correctedAgeMonths))}
              </div>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{t("Descripcion")}</h3>
                  <button
                    type="button"
                    disabled={aiLoading[activeFood.id]}
                    onClick={() => handleGenerateAi(activeFood.id)}
                    className={`rounded-full border px-4 py-2 text-sm ${
                      aiLoading[activeFood.id]
                        ? "border-[var(--border)] text-[var(--muted)]"
                        : "border-[var(--border)] bg-[var(--pill)]"
                    }`}
                  >
                    {aiLoading[activeFood.id]
                      ? t("Generando...")
                      : activeFoodState.description
                      ? t("Regenerar")
                      : t("Generar")}
                  </button>
                </div>
                <div className="mt-4 space-y-3 text-sm text-[var(--muted)]">
                  {aiError[activeFood.id] && (
                    <p className="text-sm text-[var(--accent-strong)]">{aiError[activeFood.id]}</p>
                  )}
                  <p>
                    {activeFoodState.description ||
                      t("Todavia no hay descripcion generada.")}
                  </p>
                  <p>
                    {activeFoodState.reactions ||
                      t("Las reacciones tipicas se mostraran aqui.")}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {t("Informacion general. No sustituye consejo medico.")}
                  </p>
                </div>
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{t("Historial")}</h3>
                  <button
                    type="button"
                    onClick={() => setShowLegend(true)}
                    className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-3 py-1 text-xs"
                  >
                    {t("Leyenda alergenos")}
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {activeFoodState.exposures.length === 0 && (
                    <div className="text-sm text-[var(--muted)]">
                      {t("Sin exposiciones registradas.")}
                    </div>
                  )}
                  {activeFoodState.exposures.map((exposure, index) => (
                    <div
                      key={`${activeFood.id}-${index}`}
                      className="flex items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3 text-sm"
                    >
                      <span>{t("Exposicion")} {index + 1}</span>
                      <span className="text-[var(--muted)]">
                        {formatDateTime(exposure.checkedAt, language)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="card p-4">
                <h3 className="text-lg font-semibold">{t("Exposiciones")}</h3>
                <div className="mt-4 grid w-full grid-cols-3 gap-4 sm:flex sm:w-auto">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <label
                      key={`detail-${index}`}
                      className={`flex h-16 w-full items-center justify-center rounded-3xl border text-lg font-semibold transition sm:w-16 ${
                        index < activeFoodState.exposures.length
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                          : "border-[var(--border)] text-[var(--muted)]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={index < activeFoodState.exposures.length}
                        onChange={() => toggleExposure(activeFood.id, index)}
                      />
                      {index + 1}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFoodHidden(activeFood.id)}
                  className="mt-4 rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
                >
                    {activeFoodState.isHidden
                    ? t("Mostrar en listas")
                    : t("Ocultar alimento")}
                </button>
              </div>

              <div className="card p-4">
                <h3 className="text-lg font-semibold">{t("Notas")}</h3>
                <textarea
                  value={activeFoodState.notes}
                  onChange={(event) =>
                    updateFoodState(activeFood.id, { notes: event.target.value })
                  }
                  placeholder={t("Escribe observaciones o sensaciones")}
                  className="mt-4 h-40 w-full rounded-2xl border border-[var(--border)] bg-transparent p-3 text-sm"
                />
                {(activeFoodState.customImageAttribution || activeFood.imageAttribution) && (
                  <div className="mt-4 text-xs text-[var(--muted)]">
                    {t("Imagen")}: {" "}
                    {(activeFoodState.customImageAttributionUrl ||
                      activeFood.imageAttributionUrl) ? (
                      <a
                        className="underline"
                        href={
                          activeFoodState.customImageAttributionUrl ||
                          activeFood.imageAttributionUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        {activeFoodState.customImageAttribution ||
                          activeFood.imageAttribution}
                      </a>
                    ) : (
                      activeFoodState.customImageAttribution || activeFood.imageAttribution
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showImagePicker && activeFood && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowImagePicker(false)}
        >
          <div
            className="card w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">{t("Seleccionar imagen")}</h3>
              <button
                type="button"
                onClick={() => setShowImagePicker(false)}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-sm"
              >
                {t("Cerrar")}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {imageCandidates.map((candidate, index) => (
                <button
                  key={`${candidate.imageUrl}-${index}`}
                  type="button"
                  onClick={() => {
                    if (!activeFoodId) return
                    applyCustomImage(activeFoodId, {
                      imageUrl: candidate.imageUrl,
                      imageAttribution: candidate.imageAttribution,
                      imageAttributionUrl: candidate.imageAttributionUrl,
                      source: candidate.source || "ai-search",
                    })
                    setShowImagePicker(false)
                  }}
                  className="card flex flex-col gap-2 p-3 text-left"
                >
                  <img
                    src={candidate.imageUrl}
                     alt={`${t("Candidata")} ${index + 1}`}
                    className="h-36 w-full rounded-2xl object-cover"
                    loading="lazy"
                  />
                  <p className="line-clamp-2 text-xs text-[var(--muted)]">
                    {candidate.imageAttribution || candidate.source || t("Sin atribucion")}
                  </p>
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto]">
              <input
                type="url"
                value={imageUrlInput}
                onChange={(event) => setImageUrlInput(event.target.value)}
                placeholder={t("Pega una URL de imagen (https://...)")}
                className="rounded-2xl border border-[var(--border)] bg-transparent px-4 py-3 text-sm"
              />
              <button
                type="button"
                onClick={handleManualUrlApply}
                className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
              >
                {t("Usar URL")}
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm">
                {t("Subir archivo")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLocalImageUpload}
                />
              </label>
              <span className="text-xs text-[var(--muted)]">
                {t("PNG, JPG o WEBP desde tu dispositivo")}
              </span>
            </div>
            {manualImageError && (
              <p className="mt-2 text-xs text-[var(--accent-strong)]">{manualImageError}</p>
            )}
          </div>
        </div>
      )}

      {showAddFood && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowAddFood(false)}
        >
          <div
            className="card w-full max-w-xl max-h-[90vh] overflow-y-auto p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <h3 className="text-xl font-semibold">{t("Anadir alimento")}</h3>
            </div>
            <div className="mt-4 grid gap-3">
              <input
                value={newFoodName}
                onChange={(event) => setNewFoodName(event.target.value)}
                placeholder={t("Nombre del alimento")}
                className="rounded-2xl border border-[var(--border)] bg-transparent px-4 py-3 text-sm"
              />
              <div>
                <div className="mb-2 text-xs text-[var(--muted)]">{t("Familia de alimentos")}</div>
                <PillMenu
                  icon={<FilterListIcon />}
                  value={newFoodFamily}
                  ariaLabel={t("Seleccionar familia del nuevo alimento")}
                  onChange={(value) => setNewFoodFamily(value)}
                  options={families.map((family) => ({
                    value: family,
                    label: formatFamily(family),
                  }))}
                  minWidthClass="min-w-[220px]"
                />
              </div>
              <input
                value={newFoodAllergens}
                onChange={(event) => setNewFoodAllergens(event.target.value)}
                placeholder={t("Alergenos (coma separada, opcional)")}
                className="rounded-2xl border border-[var(--border)] bg-transparent px-4 py-3 text-sm"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddFood(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)]"
                aria-label={t("Cancelar")}
                title={t("Cancelar")}
              >
                <CloseIcon />
              </button>
              <button
                type="button"
                onClick={handleAddFood}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--pill)]"
                aria-label={t("Guardar")}
                title={t("Guardar")}
              >
                <CheckIcon />
              </button>
            </div>
          </div>
        </div>
      )}

      {showFamilyImagePicker && activeFamilyForImage && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowFamilyImagePicker(false)}
        >
          <div
            className="card w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">
                  {t("Imagen de familia")}: {formatFamily(activeFamilyForImage)}
                </h3>
              <button
                type="button"
                onClick={() => setShowFamilyImagePicker(false)}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-sm"
              >
                {t("Cerrar")}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {familyImageCandidates.map((candidate, index) => (
                <button
                  key={`${candidate.imageUrl}-${index}`}
                  type="button"
                  onClick={() => {
                    applyFamilyImage(activeFamilyForImage, {
                      imageUrl: candidate.imageUrl,
                      imageAttribution: candidate.imageAttribution,
                      imageAttributionUrl: candidate.imageAttributionUrl,
                      source: candidate.source || "ai-search",
                    })
                    setShowFamilyImagePicker(false)
                  }}
                  className="card flex flex-col gap-2 p-3 text-left"
                >
                  <img
                    src={candidate.imageUrl}
                     alt={`${t("Candidata")} ${index + 1}`}
                    className="h-36 w-full rounded-2xl object-cover"
                    loading="lazy"
                  />
                  <p className="line-clamp-2 text-xs text-[var(--muted)]">
                    {candidate.imageAttribution || candidate.source || t("Sin atribucion")}
                  </p>
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto]">
              <input
                type="url"
                value={familyImageUrlInput}
                onChange={(event) => setFamilyImageUrlInput(event.target.value)}
                placeholder={t("Pega una URL de imagen (https://...)")}
                className="rounded-2xl border border-[var(--border)] bg-transparent px-4 py-3 text-sm"
              />
              <button
                type="button"
                onClick={handleFamilyManualUrlApply}
                className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
              >
                {t("Usar URL")}
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm">
                {t("Subir archivo")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFamilyLocalImageUpload}
                />
              </label>
              <span className="text-xs text-[var(--muted)]">
                {t("PNG, JPG o WEBP desde tu dispositivo")}
              </span>
            </div>
            {familyManualImageError && (
              <p className="mt-2 text-xs text-[var(--accent-strong)]">
                {familyManualImageError}
              </p>
            )}
          </div>
        </div>
      )}

      {showLegend && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowLegend(false)}
        >
          <div
            className="card w-full max-w-md p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t("Leyenda de alergenos")}</h3>
              <button
                type="button"
                onClick={() => setShowLegend(false)}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-sm"
              >
                {t("Cerrar")}
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {allergenLegend.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3 text-sm"
                >
                  <span>{allergenLabelByLanguage[language][item.key] || item.key}</span>
                  <span
                    className="pill"
                    role="img"
                    aria-label={allergenLabelByLanguage[language][item.key] || item.key}
                    title={allergenLabelByLanguage[language][item.key] || item.key}
                  >
                    {allergenIcon[item.key] ?? "⚠️"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {undoToast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-[var(--text)]">{undoToast.message}</span>
            <button
              type="button"
              onClick={handleUndoAction}
              className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-3 py-1 text-xs"
            >
              Deshacer
            </button>
          </div>
        </div>
      )}

      {showHiddenManager && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowHiddenManager(false)}
        >
          <div
            className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{t("Alimentos ocultos")}</h2>
              <button
                type="button"
                onClick={() => setShowHiddenManager(false)}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-sm"
              >
                {t("Cerrar")}
              </button>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {t("Marca o desmarca alimentos para ocultarlos en la lista.")}
            </p>
            <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto">
              {order.map((foodId) => {
                const food = foodsById[foodId]
                const state = foodStates[foodId]
                if (!food || !state) return null
                return (
                  <label
                    key={foodId}
                    className="flex items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3 text-sm"
                  >
                    <span>{food.name}</span>
                    <input
                      type="checkbox"
                      checked={state.isHidden}
                      onChange={(event) =>
                        updateFoodState(foodId, { isHidden: event.target.checked })
                      }
                    />
                  </label>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {showShareQr && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowShareQr(false)}
        >
          <div
            className="card w-full max-w-md p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t("Enlace en QR")}</h3>
              <button
                type="button"
                onClick={() => setShowShareQr(false)}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-sm"
              >
                {t("Cerrar")}
              </button>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {t("Escanea con otro movil para unirte al perfil.")}
            </p>
            <div className="mt-4 flex flex-col items-center gap-4">
              {shareQrLoading && (
                <div className="text-sm text-[var(--muted)]">{t("Generando QR...")}</div>
              )}
              {shareQrError && (
                <div className="text-sm text-[var(--accent-strong)]">
                  {shareQrError}
                </div>
              )}
              {!shareQrLoading && !shareQrError && shareQrUrl && (
                <img
                  src={shareQrUrl}
                  alt={t("Codigo QR del enlace")}
                  className="h-64 w-64 rounded-3xl border border-[var(--border)] bg-white p-3"
                />
              )}
              {!shareQrLoading && !shareQrError && shareQrLink && (
                <div className="w-full rounded-2xl border border-[var(--border)] bg-[var(--pill)] px-4 py-3 text-xs text-[var(--muted)]">
                  {shareQrLink}
                </div>
              )}
              {!shareQrLoading && !shareQrError && shareQrLink && (
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="rounded-full border border-[var(--border)] bg-[var(--pill)] px-4 py-2 text-sm"
                >
                  {t("Copiar enlace")}
                </button>
              )}
              {!shareQrLoading && !shareQrError && !shareQrUrl && (
                <div className="text-sm text-[var(--muted)]">{t("No hay QR disponible.")}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
