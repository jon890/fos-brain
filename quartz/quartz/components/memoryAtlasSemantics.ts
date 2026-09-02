import type { FullSlug } from "../util/path"
import { isFullSlug } from "../util/path"

export const MEMORY_ATLAS_SEMANTICS_SCHEMA_VERSION = 1
export const MEMORY_ATLAS_SEMANTICS_SOURCE = "qmd-vector"

export type MemoryAtlasSemanticsScope = "public" | "protected"

export type MemoryAtlasSemanticEdge = {
  source: FullSlug
  target: FullSlug
  score: number
}

export type MemoryAtlasSemanticsArtifact = {
  schemaVersion: 1
  generatedAt: string
  scope: MemoryAtlasSemanticsScope
  source: "qmd-vector"
  edges: MemoryAtlasSemanticEdge[]
}

export type PublishedMemoryAtlasSemantics = {
  schemaVersion: 1
  generatedAt: string
  source: "qmd-vector"
  edges: MemoryAtlasSemanticEdge[]
}

export type MemoryAtlasSemanticsParseError = {
  code:
    | "not_object"
    | "invalid_schema_version"
    | "invalid_generated_at"
    | "invalid_scope"
    | "invalid_source"
    | "invalid_edges"
    | "invalid_edge"
  index?: number
}

export type MemoryAtlasSemanticsParseResult =
  | { ok: true; artifact: MemoryAtlasSemanticsArtifact }
  | { ok: false; errors: MemoryAtlasSemanticsParseError[] }

type UnknownRecord = Record<string, unknown>

const emptyGeneratedAt = "1970-01-01T00:00:00.000Z"

export function createEmptyPublishedMemoryAtlasSemantics(): PublishedMemoryAtlasSemantics {
  return {
    schemaVersion: MEMORY_ATLAS_SEMANTICS_SCHEMA_VERSION,
    generatedAt: emptyGeneratedAt,
    source: MEMORY_ATLAS_SEMANTICS_SOURCE,
    edges: [],
  }
}

export function parseMemoryAtlasSemantics(input: unknown): MemoryAtlasSemanticsParseResult {
  const errors: MemoryAtlasSemanticsParseError[] = []

  if (!isRecord(input)) {
    return { ok: false, errors: [{ code: "not_object" }] }
  }

  if (input.schemaVersion !== MEMORY_ATLAS_SEMANTICS_SCHEMA_VERSION) {
    errors.push({ code: "invalid_schema_version" })
  }

  if (typeof input.generatedAt !== "string" || !isValidIsoDate(input.generatedAt)) {
    errors.push({ code: "invalid_generated_at" })
  }

  if (input.scope !== "public" && input.scope !== "protected") {
    errors.push({ code: "invalid_scope" })
  }

  if (input.source !== MEMORY_ATLAS_SEMANTICS_SOURCE) {
    errors.push({ code: "invalid_source" })
  }

  if (!Array.isArray(input.edges)) {
    errors.push({ code: "invalid_edges" })
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const normalized = new Map<string, MemoryAtlasSemanticEdge>()
  for (const [index, edge] of (input.edges as unknown[]).entries()) {
    const parsed = parseSemanticEdge(edge)
    if (!parsed) {
      errors.push({ code: "invalid_edge", index })
      continue
    }

    const key = `${parsed.source}\u0000${parsed.target}`
    const existing = normalized.get(key)
    if (!existing || parsed.score > existing.score) {
      normalized.set(key, parsed)
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    artifact: {
      schemaVersion: MEMORY_ATLAS_SEMANTICS_SCHEMA_VERSION,
      generatedAt: input.generatedAt as string,
      scope: input.scope as MemoryAtlasSemanticsScope,
      source: MEMORY_ATLAS_SEMANTICS_SOURCE,
      edges: [...normalized.values()].sort(compareSemanticEdges),
    },
  }
}

export function restrictMemoryAtlasSemanticsToSlugs(
  artifact: MemoryAtlasSemanticsArtifact,
  currentSlugs: Iterable<FullSlug>,
  options: { allowPrivate?: boolean } = {},
): PublishedMemoryAtlasSemantics {
  const slugSet = new Set(currentSlugs)
  const allowPrivate = options.allowPrivate === true
  const edgeByKey = new Map<string, MemoryAtlasSemanticEdge>()
  for (const edge of artifact.edges) {
    const [source, target] = normalizeEdgeEndpoints(edge.source, edge.target)
    if (!slugSet.has(source) || !slugSet.has(target)) continue
    if (!allowPrivate && (isPrivateSlug(source) || isPrivateSlug(target))) continue

    const key = `${source}\u0000${target}`
    const existing = edgeByKey.get(key)
    if (!existing || edge.score > existing.score) {
      edgeByKey.set(key, { source, target, score: edge.score })
    }
  }

  return {
    schemaVersion: MEMORY_ATLAS_SEMANTICS_SCHEMA_VERSION,
    generatedAt: artifact.generatedAt,
    source: MEMORY_ATLAS_SEMANTICS_SOURCE,
    edges: [...edgeByKey.values()].sort(compareSemanticEdges),
  }
}

function parseSemanticEdge(input: unknown): MemoryAtlasSemanticEdge | undefined {
  if (!isRecord(input)) return undefined
  if (typeof input.source !== "string" || typeof input.target !== "string") return undefined
  if (!isFullSlug(input.source) || !isFullSlug(input.target)) return undefined
  if (input.source === input.target) return undefined
  if (typeof input.score !== "number" || !Number.isFinite(input.score)) return undefined
  if (input.score < 0 || input.score > 1) return undefined

  const [source, target] = normalizeEdgeEndpoints(input.source, input.target)
  return { source, target, score: input.score }
}

function normalizeEdgeEndpoints(source: FullSlug, target: FullSlug): [FullSlug, FullSlug] {
  return source.localeCompare(target) <= 0 ? [source, target] : [target, source]
}

function compareSemanticEdges(a: MemoryAtlasSemanticEdge, b: MemoryAtlasSemanticEdge): number {
  return a.source.localeCompare(b.source) || a.target.localeCompare(b.target)
}

function isPrivateSlug(slug: FullSlug): boolean {
  return slug.startsWith("_private/")
}

function isRecord(input: unknown): input is UnknownRecord {
  return typeof input === "object" && input !== null && !Array.isArray(input)
}

function isValidIsoDate(value: string): boolean {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
}
