import type { ContentDetails } from "../plugins/emitters/contentIndex"
import type { KnowledgeFreshness, KnowledgeStatus, KnowledgeType } from "./knowledgeMetaData"
import type { FullSlug } from "../util/path"

export type MemoryAtlasNamespace = "public" | "private"
export type MemoryAtlasLens = "all" | "topic" | "type" | "freshness" | "namespace"
export type MemoryAtlasLayout = "constellation" | "cluster" | "orbit"
export type MemoryAtlasColorBy = "type" | "freshness" | "namespace"
export type MemoryAtlasSpacing = "compact" | "normal" | "wide"

export type MemoryAtlasNode = {
  id: FullSlug
  slug: FullSlug
  title: string
  tags: string[]
  namespace: MemoryAtlasNamespace
  degree: number
  sourceCount: number
  description?: string
  type?: KnowledgeType
  status?: KnowledgeStatus
  freshness?: KnowledgeFreshness
  updated?: string
}

export type MemoryAtlasLink = {
  source: FullSlug
  target: FullSlug
}

export type MemoryAtlasData = {
  nodes: MemoryAtlasNode[]
  links: MemoryAtlasLink[]
}

export type MemoryAtlasState = {
  query: string
  lens: MemoryAtlasLens
  namespaces?: MemoryAtlasNamespace[]
  types?: KnowledgeType[]
  freshness?: KnowledgeFreshness["state"][]
  tags?: string[]
  layout: MemoryAtlasLayout
  colorBy: MemoryAtlasColorBy
  spacing: MemoryAtlasSpacing
  labels: boolean
  selectedSlug?: FullSlug
}

export type MemoryAtlasFacets = {
  total: number
  namespaces: Record<MemoryAtlasNamespace, number>
  types: Partial<Record<KnowledgeType, number>>
  statuses: Partial<Record<KnowledgeStatus, number>>
  freshness: Partial<Record<KnowledgeFreshness["state"], number>>
  tags: Record<string, number>
  sourceCount: {
    total: number
    max: number
  }
  links: {
    total: number
    maxDegree: number
  }
}

type ContentIndexRecord = Record<string, ContentDetails> | Map<FullSlug, ContentDetails>

export const DEFAULT_MEMORY_ATLAS_STATE: MemoryAtlasState = {
  query: "",
  lens: "all",
  namespaces: [],
  types: [],
  freshness: [],
  tags: [],
  layout: "constellation",
  colorBy: "type",
  spacing: "normal",
  labels: true,
}

export function createDefaultMemoryAtlasState(data?: MemoryAtlasData): MemoryAtlasState {
  const namespaces = data
    ? (["public", "private"].filter((namespace) =>
        data.nodes.some((node) => node.namespace === namespace),
      ) as MemoryAtlasNamespace[])
    : DEFAULT_MEMORY_ATLAS_STATE.namespaces

  return {
    ...DEFAULT_MEMORY_ATLAS_STATE,
    namespaces: namespaces ? [...namespaces] : [],
    types: [...(DEFAULT_MEMORY_ATLAS_STATE.types ?? [])],
    freshness: [...(DEFAULT_MEMORY_ATLAS_STATE.freshness ?? [])],
    tags: [...(DEFAULT_MEMORY_ATLAS_STATE.tags ?? [])],
  }
}

export function clearMemoryAtlasQuery(state: MemoryAtlasState): MemoryAtlasState {
  return { ...state, query: "" }
}

export function selectMemoryAtlasNode(
  state: MemoryAtlasState,
  selectedSlug?: FullSlug,
): MemoryAtlasState {
  return {
    ...state,
    query: selectedSlug ? "" : state.query,
    selectedSlug,
  }
}

export function shouldShowMemoryAtlasResults(state: MemoryAtlasState): boolean {
  return Boolean(state.query.trim() || state.tags?.length)
}

export function inferMemoryNamespace(slug: string): MemoryAtlasNamespace {
  return slug.startsWith("_private/") ? "private" : "public"
}

function entriesFromIndex(index: ContentIndexRecord): [FullSlug, ContentDetails][] {
  return index instanceof Map
    ? [...index.entries()]
    : (Object.entries(index) as [FullSlug, ContentDetails][])
}

function hasAny<T extends string>(
  values: readonly T[] | undefined,
  allowed: readonly T[] | undefined,
) {
  if (!allowed || allowed.length === 0) return true
  if (!values || values.length === 0) return false
  const allowedSet = new Set(allowed)
  return values.some((value) => allowedSet.has(value))
}

function matchesText(node: MemoryAtlasNode, query: string | undefined): boolean {
  const normalized = query?.trim().toLowerCase()
  if (!normalized) return true
  return (
    node.title.toLowerCase().includes(normalized) ||
    node.tags.some((tag) => tag.toLowerCase().includes(normalized))
  )
}

export function buildMemoryAtlasData(index: ContentIndexRecord): MemoryAtlasData {
  const entries = entriesFromIndex(index).sort(([a], [b]) => a.localeCompare(b))
  const validSlugs = new Set(entries.map(([slug]) => slug))
  const degreeBySlug = new Map<FullSlug, number>()
  const linkKeys = new Set<string>()
  const links: MemoryAtlasLink[] = []

  for (const [source, details] of entries) {
    for (const target of details.links ?? []) {
      const targetSlug = target as unknown as FullSlug
      if (!validSlugs.has(targetSlug) || source === targetSlug) continue

      const linkKey = `${source}\u0000${targetSlug}`
      if (linkKeys.has(linkKey)) continue

      linkKeys.add(linkKey)
      links.push({ source, target: targetSlug })
      degreeBySlug.set(source, (degreeBySlug.get(source) ?? 0) + 1)
      degreeBySlug.set(targetSlug, (degreeBySlug.get(targetSlug) ?? 0) + 1)
    }
  }

  links.sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target))

  const nodes = entries.map(([slug, details]) => ({
    id: slug,
    slug,
    title: details.title,
    tags: [...(details.tags ?? [])],
    namespace: inferMemoryNamespace(slug),
    degree: degreeBySlug.get(slug) ?? 0,
    sourceCount: details.sourceCount ?? 0,
    ...(details.description ? { description: details.description } : {}),
    ...(details.type ? { type: details.type } : {}),
    ...(details.status ? { status: details.status } : {}),
    ...(details.freshness ? { freshness: details.freshness } : {}),
    ...(details.updated ? { updated: details.updated } : {}),
  }))

  return { nodes, links }
}

export function filterMemoryAtlas(data: MemoryAtlasData, state: MemoryAtlasState): MemoryAtlasData {
  const nodes = data.nodes.filter((node) => {
    if (!matchesText(node, state.query)) return false
    if (!hasAny([node.namespace], state.namespaces)) return false
    if (!hasAny(node.type ? [node.type] : [], state.types)) return false
    if (!hasAny(node.freshness ? [node.freshness.state] : [], state.freshness)) return false
    if (!hasAny(node.tags, state.tags)) return false
    return true
  })
  const remaining = new Set(nodes.map((node) => node.slug))
  const links = data.links.filter(
    (link) => remaining.has(link.source) && remaining.has(link.target),
  )
  const degreeBySlug = new Map<FullSlug, number>()
  for (const link of links) {
    degreeBySlug.set(link.source, (degreeBySlug.get(link.source) ?? 0) + 1)
    degreeBySlug.set(link.target, (degreeBySlug.get(link.target) ?? 0) + 1)
  }

  return {
    nodes: nodes.map((node) => ({ ...node, degree: degreeBySlug.get(node.slug) ?? 0 })),
    links,
  }
}

export function deriveMemoryAtlasFacets(data: MemoryAtlasData): MemoryAtlasFacets {
  const facets: MemoryAtlasFacets = {
    total: data.nodes.length,
    namespaces: { public: 0, private: 0 },
    types: {},
    statuses: {},
    freshness: {},
    tags: {},
    sourceCount: { total: 0, max: 0 },
    links: { total: data.links.length, maxDegree: 0 },
  }

  for (const node of data.nodes) {
    facets.namespaces[node.namespace] += 1
    if (node.type) facets.types[node.type] = (facets.types[node.type] ?? 0) + 1
    if (node.status) facets.statuses[node.status] = (facets.statuses[node.status] ?? 0) + 1
    if (node.freshness) {
      facets.freshness[node.freshness.state] = (facets.freshness[node.freshness.state] ?? 0) + 1
    }
    for (const tag of node.tags) {
      facets.tags[tag] = (facets.tags[tag] ?? 0) + 1
    }
    facets.sourceCount.total += node.sourceCount
    facets.sourceCount.max = Math.max(facets.sourceCount.max, node.sourceCount)
    facets.links.maxDegree = Math.max(facets.links.maxDegree, node.degree)
  }

  return facets
}
