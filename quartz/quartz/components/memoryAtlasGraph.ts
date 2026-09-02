import * as d3 from "d3"
import type { FullSlug } from "../util/path"
import type { MemoryAtlasData, MemoryAtlasLink, MemoryAtlasNode } from "./memoryAtlasData"
import type { MemoryAtlasSemanticEdge } from "./memoryAtlasSemantics"

export type MemoryAtlasWeightedEdge = {
  source: FullSlug
  target: FullSlug
  wiki: boolean
  tagScore: number
  semanticScore: number
  weight: number
}

export type MemoryAtlasGraphWeights = {
  wikiWeight: number
  tagWeight: number
  semanticWeight: number
}

export type MemoryAtlasWeightedGraphOptions = Partial<MemoryAtlasGraphWeights> & {
  minTagScore?: number
  minSemanticScore?: number
}

export type MemoryAtlasGraphLayoutOptions = {
  width?: number
  height?: number
  ticks?: number
  seed?: number
}

export type MemoryAtlasNodePosition = {
  slug: FullSlug
  x: number
  y: number
}

export type MemoryAtlasLocalNodePosition = MemoryAtlasNodePosition & {
  depth?: number
  selected: boolean
  related: boolean
}

export type MemoryAtlasEntrypointMatch = {
  slugs?: FullSlug[]
  titleIncludes?: string[]
  tags?: string[]
}

export type MemoryAtlasEntrypointDefinition = {
  id: string
  label: string
  match: MemoryAtlasEntrypointMatch
  children?: MemoryAtlasEntrypointDefinition[]
}

export type MemoryAtlasEntrypoint = {
  id: string
  label: string
  enabled: boolean
  representativeSlug?: FullSlug
  children?: MemoryAtlasEntrypoint[]
}

export type MemoryAtlasAutoEntrypointOptions = {
  minCommunitySize?: number
  maxCandidates?: number
  maxIterations?: number
  excludeSlugs?: Iterable<FullSlug>
}

export type MemoryAtlasAutoEntrypoint = {
  id: string
  label: string
  representativeSlug: FullSlug
  memberSlugs: FullSlug[]
  score: number
}

type MutableSimulationNode = {
  slug: FullSlug
  x?: number
  y?: number
}

type MutableSimulationLink = {
  source: FullSlug | MutableSimulationNode
  target: FullSlug | MutableSimulationNode
  weight: number
}

const defaultWeights: MemoryAtlasGraphWeights = {
  wikiWeight: 4,
  tagWeight: 1,
  semanticWeight: 0.5,
}

const defaultLayoutOptions: Required<MemoryAtlasGraphLayoutOptions> = {
  width: 1200,
  height: 800,
  ticks: 180,
  seed: 11,
}

export const FIXED_MEMORY_ATLAS_ENTRYPOINTS: MemoryAtlasEntrypointDefinition[] = [
  {
    id: "career",
    label: "커리어",
    match: {
      slugs: ["topics/career", "concepts/career", "entities/career"] as FullSlug[],
      titleIncludes: ["career", "커리어", "이력", "경력"],
      tags: ["career", "커리어", "work-style"],
    },
  },
  {
    id: "health",
    label: "건강",
    match: {
      slugs: ["topics/health", "concepts/health", "entities/health"] as FullSlug[],
      titleIncludes: ["health", "건강", "수면", "운동"],
      tags: ["health", "건강", "fitness", "sleep"],
    },
  },
  {
    id: "ai",
    label: "AI",
    match: {
      slugs: ["topics/ai", "concepts/ai", "topics/llm", "concepts/llm"] as FullSlug[],
      titleIncludes: ["ai", "llm", "인공지능"],
      tags: ["ai", "llm", "machine-learning"],
    },
    children: [
      {
        id: "rag",
        label: "RAG",
        match: {
          slugs: ["topics/rag", "concepts/rag", "concepts/graph-rag"] as FullSlug[],
          titleIncludes: ["rag", "retrieval", "graphrag"],
          tags: ["rag", "retrieval", "graphrag", "embedding"],
        },
      },
    ],
  },
]

export function assertMemoryAtlasGraphWeights(weights: MemoryAtlasGraphWeights): void {
  const { wikiWeight, tagWeight, semanticWeight } = weights
  if (
    !Number.isFinite(wikiWeight) ||
    !Number.isFinite(tagWeight) ||
    !Number.isFinite(semanticWeight) ||
    !(wikiWeight > tagWeight) ||
    !(tagWeight > semanticWeight) ||
    !(semanticWeight > 0) ||
    !(wikiWeight > tagWeight + semanticWeight)
  ) {
    throw new Error("invalid_memory_atlas_graph_weights")
  }
}

export function buildMemoryAtlasWeightedEdges(
  data: MemoryAtlasData,
  semanticEdges: readonly MemoryAtlasSemanticEdge[] = [],
  options: MemoryAtlasWeightedGraphOptions = {},
): MemoryAtlasWeightedEdge[] {
  const weights = normalizeWeights(options)
  const minTagScore = options.minTagScore ?? 0
  const minSemanticScore = options.minSemanticScore ?? 0
  const nodes = stableNodes(data.nodes)
  const nodeBySlug = new Map(nodes.map((node) => [node.slug, node]))
  const edgeByKey = new Map<string, MemoryAtlasWeightedEdge>()

  for (const link of data.links) {
    const pair = normalizeLinkPair(link)
    if (!pair || !nodeBySlug.has(pair[0]) || !nodeBySlug.has(pair[1])) continue
    const edge = ensureWeightedEdge(edgeByKey, pair[0], pair[1])
    edge.wiki = true
  }

  for (let index = 0; index < nodes.length; index += 1) {
    for (let next = index + 1; next < nodes.length; next += 1) {
      const source = nodes[index]
      const target = nodes[next]
      const tagScore = jaccard(source.tags, target.tags)
      if (tagScore <= minTagScore) continue
      ensureWeightedEdge(edgeByKey, source.slug, target.slug).tagScore = tagScore
    }
  }

  for (const semanticEdge of semanticEdges) {
    if (semanticEdge.source === semanticEdge.target) continue
    if (!nodeBySlug.has(semanticEdge.source) || !nodeBySlug.has(semanticEdge.target)) continue
    if (semanticEdge.score <= minSemanticScore) continue
    const [source, target] = normalizePair(semanticEdge.source, semanticEdge.target)
    const edge = ensureWeightedEdge(edgeByKey, source, target)
    edge.semanticScore = Math.max(edge.semanticScore, semanticEdge.score)
  }

  const edges = [...edgeByKey.values()]
    .map((edge) => ({
      ...edge,
      weight: calculateWeight(edge, weights),
    }))
    .filter((edge) => edge.weight > 0)
    .sort(compareWeightedEdges)

  return edges
}

export function layoutMemoryAtlasGraph(
  data: MemoryAtlasData,
  weightedEdges: readonly MemoryAtlasWeightedEdge[],
  options: MemoryAtlasGraphLayoutOptions = {},
): MemoryAtlasNodePosition[] {
  const layoutOptions = { ...defaultLayoutOptions, ...options }
  const nodes: MutableSimulationNode[] = stableNodes(data.nodes).map((node) => ({
    slug: node.slug,
  }))
  const links: MutableSimulationLink[] = [...weightedEdges]
    .sort(compareWeightedEdges)
    .map((edge) => ({ source: edge.source, target: edge.target, weight: edge.weight }))

  const random = seededRandom(layoutOptions.seed)
  const simulation = d3
    .forceSimulation<MutableSimulationNode>(nodes)
    .randomSource(random)
    .force(
      "link",
      d3
        .forceLink<MutableSimulationNode, MutableSimulationLink>(links)
        .id((node) => node.slug)
        .distance((link) => Math.max(48, 260 / (1 + link.weight)))
        .strength((link) => Math.min(0.95, 0.22 + link.weight / 6)),
    )
    .force("charge", d3.forceManyBody<MutableSimulationNode>().strength(-220))
    .force("center", d3.forceCenter(layoutOptions.width / 2, layoutOptions.height / 2))
    .force("collision", d3.forceCollide<MutableSimulationNode>().radius(34).strength(0.5))
    .stop()

  for (let tick = 0; tick < layoutOptions.ticks; tick += 1) simulation.tick()

  return nodes
    .map((node) => ({
      slug: node.slug,
      x: roundCoordinate(node.x ?? layoutOptions.width / 2),
      y: roundCoordinate(node.y ?? layoutOptions.height / 2),
    }))
    .sort(comparePositions)
}

export function layoutMemoryAtlasLocalGraph(
  data: MemoryAtlasData,
  globalPositions: readonly MemoryAtlasNodePosition[],
  selectedSlug?: FullSlug,
  options: MemoryAtlasGraphLayoutOptions & { maxDepth?: number } = {},
): MemoryAtlasLocalNodePosition[] {
  const layoutOptions = { ...defaultLayoutOptions, ...options }
  const globalBySlug = new Map(globalPositions.map((position) => [position.slug, position]))
  const nodes = stableNodes(data.nodes)

  if (!selectedSlug || !nodes.some((node) => node.slug === selectedSlug)) {
    return nodes.map((node) => ({
      ...positionOrCenter(globalBySlug, node.slug, layoutOptions),
      selected: false,
      related: false,
    }))
  }

  const depthBySlug = calculateWikiHopDepth(data.links, selectedSlug, options.maxDepth ?? 3)
  const byDepth = new Map<number, FullSlug[]>()
  for (const [slug, depth] of depthBySlug) {
    if (depth === 0) continue
    byDepth.set(depth, [...(byDepth.get(depth) ?? []), slug])
  }

  const localBySlug = new Map<FullSlug, MemoryAtlasLocalNodePosition>()
  localBySlug.set(selectedSlug, {
    slug: selectedSlug,
    x: roundCoordinate(layoutOptions.width / 2),
    y: roundCoordinate(layoutOptions.height / 2),
    depth: 0,
    selected: true,
    related: true,
  })

  for (const [depth, slugs] of [...byDepth.entries()].sort(([a], [b]) => a - b)) {
    const radius = 150 * depth
    const sortedSlugs = slugs.sort((a, b) => a.localeCompare(b))
    for (const [index, slug] of sortedSlugs.entries()) {
      const angle = (2 * Math.PI * index) / sortedSlugs.length - Math.PI / 2
      localBySlug.set(slug, {
        slug,
        x: roundCoordinate(layoutOptions.width / 2 + Math.cos(angle) * radius),
        y: roundCoordinate(layoutOptions.height / 2 + Math.sin(angle) * radius),
        depth,
        selected: false,
        related: true,
      })
    }
  }

  return nodes.map((node) => {
    const local = localBySlug.get(node.slug)
    if (local) return local
    return {
      ...positionOrCenter(globalBySlug, node.slug, layoutOptions),
      selected: false,
      related: false,
    }
  })
}

export function resolveFixedMemoryAtlasEntrypoints(
  data: MemoryAtlasData,
  definitions: readonly MemoryAtlasEntrypointDefinition[] = FIXED_MEMORY_ATLAS_ENTRYPOINTS,
): MemoryAtlasEntrypoint[] {
  const nodes = stableNodes(data.nodes)
  return definitions.map((definition) => resolveEntrypointDefinition(definition, nodes))
}

export function deriveAutomaticMemoryAtlasEntrypoints(
  data: MemoryAtlasData,
  weightedEdges: readonly MemoryAtlasWeightedEdge[],
  options: MemoryAtlasAutoEntrypointOptions = {},
): MemoryAtlasAutoEntrypoint[] {
  const minCommunitySize = options.minCommunitySize ?? 3
  const maxCandidates = options.maxCandidates ?? 4
  const maxIterations = options.maxIterations ?? 24
  const excluded = new Set(options.excludeSlugs ?? [])
  const nodes = stableNodes(data.nodes)
  const nodeBySlug = new Map(nodes.map((node) => [node.slug, node]))
  const adjacency = buildWeightedAdjacency(weightedEdges)
  const communities = calculateWeightedCommunities(
    nodes.map((node) => node.slug),
    adjacency,
    excluded,
    maxIterations,
  )
  const candidates: MemoryAtlasAutoEntrypoint[] = []

  for (const community of communities) {
    const memberSlugs = community.filter((slug) => nodeBySlug.has(slug))
    if (memberSlugs.length < minCommunitySize) continue

    const tag = dominantTag(memberSlugs.map((slug) => nodeBySlug.get(slug)!))
    if (!tag) continue

    const representativeSlug = chooseWeightedRepresentative(memberSlugs, nodeBySlug, adjacency)
    const score = memberSlugs.reduce((sum, slug) => sum + weightedDegree(slug, adjacency), 0)
    candidates.push({
      id: `auto-${slugSafe(tag)}`,
      label: tag,
      representativeSlug,
      memberSlugs: memberSlugs.sort((a, b) => a.localeCompare(b)),
      score: roundCoordinate(score),
    })
  }

  return candidates
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.label.localeCompare(b.label) ||
        a.representativeSlug.localeCompare(b.representativeSlug),
    )
    .slice(0, maxCandidates)
}

export function calculateWikiHopDepth(
  links: readonly MemoryAtlasLink[],
  selectedSlug: FullSlug,
  maxDepth = 3,
): Map<FullSlug, number> {
  const adjacency = buildWikiAdjacency(links)
  const depthBySlug = new Map<FullSlug, number>([[selectedSlug, 0]])
  const queue: FullSlug[] = [selectedSlug]

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const slug = queue[cursor]
    const depth = depthBySlug.get(slug) ?? 0
    if (depth >= maxDepth) continue

    for (const next of [...(adjacency.get(slug) ?? [])].sort((a, b) => a.localeCompare(b))) {
      if (depthBySlug.has(next)) continue
      depthBySlug.set(next, depth + 1)
      queue.push(next)
    }
  }

  return depthBySlug
}

function normalizeWeights(options: MemoryAtlasWeightedGraphOptions): MemoryAtlasGraphWeights {
  const weights = {
    wikiWeight: options.wikiWeight ?? defaultWeights.wikiWeight,
    tagWeight: options.tagWeight ?? defaultWeights.tagWeight,
    semanticWeight: options.semanticWeight ?? defaultWeights.semanticWeight,
  }
  assertMemoryAtlasGraphWeights(weights)
  return weights
}

function calculateWeight(
  edge: Omit<MemoryAtlasWeightedEdge, "weight">,
  weights: MemoryAtlasGraphWeights,
): number {
  return (
    (edge.wiki ? weights.wikiWeight : 0) +
    edge.tagScore * weights.tagWeight +
    edge.semanticScore * weights.semanticWeight
  )
}

function ensureWeightedEdge(
  edgeByKey: Map<string, MemoryAtlasWeightedEdge>,
  source: FullSlug,
  target: FullSlug,
): MemoryAtlasWeightedEdge {
  const [normalizedSource, normalizedTarget] = normalizePair(source, target)
  const key = `${normalizedSource}\u0000${normalizedTarget}`
  const existing = edgeByKey.get(key)
  if (existing) return existing

  const edge: MemoryAtlasWeightedEdge = {
    source: normalizedSource,
    target: normalizedTarget,
    wiki: false,
    tagScore: 0,
    semanticScore: 0,
    weight: 0,
  }
  edgeByKey.set(key, edge)
  return edge
}

function normalizeLinkPair(link: MemoryAtlasLink): [FullSlug, FullSlug] | undefined {
  if (link.source === link.target) return undefined
  return normalizePair(link.source, link.target)
}

function normalizePair(source: FullSlug, target: FullSlug): [FullSlug, FullSlug] {
  return source.localeCompare(target) <= 0 ? [source, target] : [target, source]
}

function jaccard(sourceTags: readonly string[], targetTags: readonly string[]): number {
  const sourceSet = new Set(sourceTags.map(normalizeToken).filter(Boolean))
  const targetSet = new Set(targetTags.map(normalizeToken).filter(Boolean))
  if (sourceSet.size === 0 || targetSet.size === 0) return 0

  let intersection = 0
  for (const tag of sourceSet) {
    if (targetSet.has(tag)) intersection += 1
  }
  const union = new Set([...sourceSet, ...targetSet]).size
  return union === 0 ? 0 : intersection / union
}

function stableNodes(nodes: readonly MemoryAtlasNode[]): MemoryAtlasNode[] {
  return [...nodes].sort((a, b) => a.slug.localeCompare(b.slug))
}

function compareWeightedEdges(a: MemoryAtlasWeightedEdge, b: MemoryAtlasWeightedEdge): number {
  return a.source.localeCompare(b.source) || a.target.localeCompare(b.target)
}

function comparePositions(a: MemoryAtlasNodePosition, b: MemoryAtlasNodePosition): number {
  return a.slug.localeCompare(b.slug)
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000
}

function positionOrCenter(
  positions: Map<FullSlug, MemoryAtlasNodePosition>,
  slug: FullSlug,
  options: Required<MemoryAtlasGraphLayoutOptions>,
): MemoryAtlasNodePosition {
  const existing = positions.get(slug)
  if (existing) return { slug, x: existing.x, y: existing.y }
  return { slug, x: roundCoordinate(options.width / 2), y: roundCoordinate(options.height / 2) }
}

function buildWikiAdjacency(links: readonly MemoryAtlasLink[]): Map<FullSlug, Set<FullSlug>> {
  const adjacency = new Map<FullSlug, Set<FullSlug>>()
  for (const link of links) {
    const pair = normalizeLinkPair(link)
    if (!pair) continue
    addAdjacency(adjacency, pair[0], pair[1])
    addAdjacency(adjacency, pair[1], pair[0])
  }
  return adjacency
}

function buildWeightedAdjacency(
  edges: readonly MemoryAtlasWeightedEdge[],
): Map<FullSlug, Map<FullSlug, number>> {
  const adjacency = new Map<FullSlug, Map<FullSlug, number>>()
  for (const edge of edges) {
    addWeightedAdjacency(adjacency, edge.source, edge.target, edge.weight)
    addWeightedAdjacency(adjacency, edge.target, edge.source, edge.weight)
  }
  return adjacency
}

function addAdjacency(adjacency: Map<FullSlug, Set<FullSlug>>, source: FullSlug, target: FullSlug) {
  if (!adjacency.has(source)) adjacency.set(source, new Set())
  adjacency.get(source)!.add(target)
}

function addWeightedAdjacency(
  adjacency: Map<FullSlug, Map<FullSlug, number>>,
  source: FullSlug,
  target: FullSlug,
  weight: number,
) {
  if (!adjacency.has(source)) adjacency.set(source, new Map())
  adjacency.get(source)!.set(target, weight)
}

function calculateWeightedCommunities(
  slugs: readonly FullSlug[],
  adjacency: Map<FullSlug, Map<FullSlug, number>>,
  excluded: Set<FullSlug>,
  maxIterations: number,
): FullSlug[][] {
  const includedSlugs = [...slugs]
    .filter((slug) => !excluded.has(slug))
    .sort((a, b) => a.localeCompare(b))
  const labelBySlug = new Map(includedSlugs.map((slug) => [slug, slug]))

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let changed = false

    for (const slug of includedSlugs) {
      const currentLabel = labelBySlug.get(slug)!
      const labelScores = new Map<FullSlug, number>([[currentLabel, 0]])
      for (const [neighbor, weight] of adjacency.get(slug) ?? []) {
        if (excluded.has(neighbor) || !labelBySlug.has(neighbor)) continue
        const label = labelBySlug.get(neighbor)!
        labelScores.set(label, (labelScores.get(label) ?? 0) + weight)
      }

      const nextLabel = [...labelScores.entries()].sort(
        ([labelA, scoreA], [labelB, scoreB]) =>
          scoreB - scoreA || communityLabelTieBreak(labelA, labelB),
      )[0][0]

      if (nextLabel !== currentLabel) {
        labelBySlug.set(slug, nextLabel)
        changed = true
      }
    }

    if (!changed) break
  }

  const communityByLabel = new Map<FullSlug, FullSlug[]>()
  for (const slug of includedSlugs) {
    const label = resolveCommunityRoot(labelBySlug, slug)
    communityByLabel.set(label, [...(communityByLabel.get(label) ?? []), slug])
  }

  return [...communityByLabel.values()]
    .map((members) => members.sort((a, b) => a.localeCompare(b)))
    .sort((a, b) => a[0].localeCompare(b[0]))
}

function resolveCommunityRoot(labelBySlug: Map<FullSlug, FullSlug>, slug: FullSlug): FullSlug {
  let current = labelBySlug.get(slug) ?? slug
  const seen = new Set<FullSlug>()
  while (!seen.has(current)) {
    seen.add(current)
    const next = labelBySlug.get(current)
    if (!next || next === current) return current
    current = next
  }
  return [...seen].sort((a, b) => a.localeCompare(b))[0]
}

function communityLabelTieBreak(labelA: FullSlug, labelB: FullSlug): number {
  return labelA.localeCompare(labelB)
}

function resolveEntrypointDefinition(
  definition: MemoryAtlasEntrypointDefinition,
  nodes: readonly MemoryAtlasNode[],
): MemoryAtlasEntrypoint {
  const representativeSlug = chooseEntrypointRepresentative(definition.match, nodes)
  return {
    id: definition.id,
    label: definition.label,
    enabled: Boolean(representativeSlug),
    ...(representativeSlug ? { representativeSlug } : {}),
    ...(definition.children
      ? { children: definition.children.map((child) => resolveEntrypointDefinition(child, nodes)) }
      : {}),
  }
}

function chooseEntrypointRepresentative(
  match: MemoryAtlasEntrypointMatch,
  nodes: readonly MemoryAtlasNode[],
): FullSlug | undefined {
  const nodeBySlug = new Map(nodes.map((node) => [node.slug, node]))
  for (const slug of match.slugs ?? []) {
    if (nodeBySlug.has(slug)) return slug
  }

  const requestedSlugs = new Set(match.slugs ?? [])
  const candidates = nodes
    .map((node) => ({ node, score: entrypointMatchScore(node, match, requestedSlugs) }))
    .filter((candidate) => candidate.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.node.degree - a.node.degree ||
        a.node.slug.localeCompare(b.node.slug),
    )

  return candidates[0]?.node.slug
}

function entrypointMatchScore(
  node: MemoryAtlasNode,
  match: MemoryAtlasEntrypointMatch,
  requestedSlugs: Set<FullSlug>,
): number {
  let score = 0
  if (requestedSlugs.has(node.slug)) score += 100
  const title = normalizeToken(node.title)
  for (const candidate of match.titleIncludes ?? []) {
    if (titleMatchesEntrypointToken(title, candidate)) score += 20
  }
  const nodeTags = new Set(node.tags.map(normalizeToken))
  for (const tag of match.tags ?? []) {
    if (nodeTags.has(normalizeToken(tag))) score += 12
  }
  return score
}

function dominantTag(nodes: readonly MemoryAtlasNode[]): string | undefined {
  const tagStats = new Map<string, { count: number; firstIndex: number }>()
  let tagIndex = 0
  for (const node of stableNodes(nodes)) {
    for (const tag of node.tags) {
      const normalized = normalizeToken(tag)
      if (!normalized) continue
      const current = tagStats.get(normalized)
      tagStats.set(normalized, {
        count: (current?.count ?? 0) + 1,
        firstIndex: current?.firstIndex ?? tagIndex,
      })
      tagIndex += 1
    }
  }

  return [...tagStats.entries()]
    .sort(
      ([tagA, statA], [tagB, statB]) =>
        statB.count - statA.count ||
        statA.firstIndex - statB.firstIndex ||
        tagA.localeCompare(tagB),
    )
    .map(([tag]) => tag)[0]
}

function chooseWeightedRepresentative(
  memberSlugs: readonly FullSlug[],
  nodeBySlug: Map<FullSlug, MemoryAtlasNode>,
  adjacency: Map<FullSlug, Map<FullSlug, number>>,
): FullSlug {
  return [...memberSlugs].sort((a, b) => {
    const degreeDiff = weightedDegree(b, adjacency) - weightedDegree(a, adjacency)
    if (degreeDiff !== 0) return degreeDiff
    return (nodeBySlug.get(b)?.degree ?? 0) - (nodeBySlug.get(a)?.degree ?? 0) || a.localeCompare(b)
  })[0]
}

function weightedDegree(slug: FullSlug, adjacency: Map<FullSlug, Map<FullSlug, number>>): number {
  return [...(adjacency.get(slug)?.values() ?? [])].reduce((sum, weight) => sum + weight, 0)
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase()
}

function titleMatchesEntrypointToken(normalizedTitle: string, candidate: string): boolean {
  const normalizedCandidate = normalizeToken(candidate)
  if (!normalizedCandidate) return false
  if (isShortAsciiAbbreviation(normalizedCandidate)) {
    return titleTokens(normalizedTitle).includes(normalizedCandidate)
  }
  return normalizedTitle.includes(normalizedCandidate)
}

function isShortAsciiAbbreviation(value: string): boolean {
  return /^[a-z0-9]{1,3}$/.test(value)
}

function titleTokens(normalizedTitle: string): string[] {
  return normalizedTitle.match(/[a-z0-9]+/g) ?? []
}

function slugSafe(value: string): string {
  return value.replace(/[^a-z0-9가-힣_-]+/gi, "-").replace(/^-|-$/g, "") || "community"
}
