import en from "./en"
import es from "./es"

type LanguageCode = "es" | "en"

const dictionaries = { es, en } as const

export const createTranslator = (language: LanguageCode) => {
  return (key: string, fallback?: string) => {
    const current = dictionaries[language] as Record<string, string>
    if (current[key]) return current[key]
    if (language === "en" && fallback) return fallback
    if (language === "es" && fallback) return key
    return key
  }
}
