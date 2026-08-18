export type KnowledgeType = "concept" | "topic" | "entity"
export type KnowledgeStatus = "draft" | "stable" | "deprecated"

export type KnowledgeSource = {
  id: string
  resource: string
  title?: string
}

export type KnowledgeAttribution = {
  by: string
  at: string
}

export type KnowledgeFreshness = {
  date?: string
  state: "current" | "stale" | "invalid"
}

export type KnowledgeMetaData = {
  description?: string
  type?: KnowledgeType
  status?: KnowledgeStatus
  staleAfter?: KnowledgeFreshness
  sources: KnowledgeSource[]
  generated?: KnowledgeAttribution
  verified: KnowledgeAttribution[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

export function normalizeKnowledgeType(value: unknown): KnowledgeType | undefined {
  const normalized = normalizeText(value)?.toLowerCase()
  return normalized === "concept" || normalized === "topic" || normalized === "entity"
    ? normalized
    : undefined
}

function normalizeKnowledgeStatus(value: unknown): KnowledgeStatus | undefined {
  const normalized = normalizeText(value)?.toLowerCase()
  return normalized === "draft" || normalized === "stable" || normalized === "deprecated"
    ? normalized
    : undefined
}

function normalizeDateOnly(value: unknown): string | undefined {
  const normalized = normalizeText(value)
  const match = normalized?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return undefined

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return undefined
  }

  return normalized
}

function normalizeTimestamp(value: unknown): string | undefined {
  const normalized = normalizeText(value)
  if (!normalized) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalizeDateOnly(normalized)
  return Number.isNaN(Date.parse(normalized)) ? undefined : normalized
}

function localDateKey(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return `${year}-${month}-${day}`
}

function normalizeFreshness(value: unknown, today: Date): KnowledgeFreshness | undefined {
  if (value === undefined || value === null) return undefined
  const date = normalizeDateOnly(value)
  if (!date) return { state: "invalid" }
  return { date, state: date < localDateKey(today) ? "stale" : "current" }
}

function normalizeSource(value: unknown): KnowledgeSource | undefined {
  if (!isRecord(value)) return undefined
  const id = normalizeText(value.id)
  const resource = normalizeText(value.resource)
  if (!id || !resource) return undefined
  const title = normalizeText(value.title)
  return title ? { id, resource, title } : { id, resource }
}

function normalizeAttribution(value: unknown): KnowledgeAttribution | undefined {
  if (!isRecord(value)) return undefined
  const by = normalizeText(value.by)
  const at = normalizeTimestamp(value.at)
  return by && at ? { by, at } : undefined
}

export function normalizeKnowledgeMetaData(
  value: unknown,
  today: Date = new Date(),
): KnowledgeMetaData {
  const data = isRecord(value) ? value : {}
  const sources = Array.isArray(data.sources)
    ? data.sources.flatMap((source) => {
        const normalized = normalizeSource(source)
        return normalized ? [normalized] : []
      })
    : []
  const verified = Array.isArray(data.verified)
    ? data.verified.flatMap((entry) => {
        const normalized = normalizeAttribution(entry)
        return normalized ? [normalized] : []
      })
    : []

  return {
    description: normalizeText(data.description),
    type: normalizeKnowledgeType(data.type),
    status: normalizeKnowledgeStatus(data.status),
    staleAfter: normalizeFreshness(data.stale_after, today),
    sources,
    generated: normalizeAttribution(data.generated),
    verified,
  }
}
