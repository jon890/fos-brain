import assert from "node:assert"
import test, { describe } from "node:test"
import type { FullSlug } from "../util/path"
import type { MemoryAtlasSemanticEdge } from "./memoryAtlasSemantics"
import type { MemoryAtlasData, MemoryAtlasNode } from "./memoryAtlasData"
import {
  assertMemoryAtlasGraphWeights,
  buildMemoryAtlasWeightedEdges,
  calculateWikiHopDepth,
  deriveAutomaticMemoryAtlasEntrypoints,
  layoutMemoryAtlasGraph,
  layoutMemoryAtlasLocalGraph,
  resolveFixedMemoryAtlasEntrypoints,
} from "./memoryAtlasGraph"

function slug(value: string): FullSlug {
  return value as FullSlug
}

function node(value: string, overrides: Partial<MemoryAtlasNode> = {}): MemoryAtlasNode {
  return {
    id: slug(value),
    slug: slug(value),
    title: value,
    tags: [],
    namespace: value.startsWith("_private/") ? "private" : "public",
    degree: 0,
    sourceCount: 0,
    ...overrides,
  }
}

function sampleData(): MemoryAtlasData {
  return {
    nodes: [
      node("concepts/rag", { title: "RAG", tags: ["ai", "rag", "retrieval"], degree: 2 }),
      node("concepts/graph-rag", { title: "GraphRAG", tags: ["ai", "rag"], degree: 1 }),
      node("concepts/embedding-index", {
        title: "Embedding Index",
        tags: ["ai", "retrieval", "embedding"],
        degree: 1,
      }),
      node("topics/health", { title: "건강", tags: ["health"], degree: 1 }),
      node("topics/career", { title: "커리어", tags: ["career"], degree: 1 }),
      node("concepts/sleep", { title: "수면", tags: ["health", "sleep"], degree: 0 }),
    ],
    links: [
      { source: slug("concepts/rag"), target: slug("concepts/graph-rag") },
      { source: slug("concepts/graph-rag"), target: slug("concepts/embedding-index") },
      { source: slug("topics/health"), target: slug("concepts/sleep") },
    ],
  }
}

const semanticEdges: MemoryAtlasSemanticEdge[] = [
  { source: slug("concepts/rag"), target: slug("concepts/embedding-index"), score: 0.92 },
  { source: slug("concepts/rag"), target: slug("topics/career"), score: 0.3 },
]

describe("memory atlas graph", () => {
  test("enforces weight invariants so wiki links dominate tag and semantic signals", () => {
    assert.doesNotThrow(() =>
      assertMemoryAtlasGraphWeights({ wikiWeight: 4, tagWeight: 1, semanticWeight: 0.5 }),
    )
    assert.throws(
      () => assertMemoryAtlasGraphWeights({ wikiWeight: 1.2, tagWeight: 1, semanticWeight: 0.5 }),
      /invalid_memory_atlas_graph_weights/,
    )
  })

  test("merges wiki, tag, and semantic signals into stable undirected edges", () => {
    const edges = buildMemoryAtlasWeightedEdges(sampleData(), semanticEdges)
    const ragGraphRag = edges.find(
      (edge) => edge.source === slug("concepts/graph-rag") && edge.target === slug("concepts/rag"),
    )
    const ragEmbedding = edges.find(
      (edge) =>
        edge.source === slug("concepts/embedding-index") && edge.target === slug("concepts/rag"),
    )

    assert.strictEqual(ragGraphRag?.wiki, true)
    assert.strictEqual(ragGraphRag?.semanticScore, 0)
    assert.ok((ragGraphRag?.weight ?? 0) > 4)
    assert.strictEqual(ragEmbedding?.wiki, false)
    assert.strictEqual(ragEmbedding?.semanticScore, 0.92)
    assert.ok((ragGraphRag?.weight ?? 0) > (ragEmbedding?.weight ?? 0))
    assert.deepStrictEqual(
      edges.map((edge) => `${edge.source}->${edge.target}`),
      [...edges.map((edge) => `${edge.source}->${edge.target}`)].sort(),
    )
  })

  test("does not create a weighted edge from semantic self-links", () => {
    const data = sampleData()
    const edges = buildMemoryAtlasWeightedEdges(data, [
      { source: slug("concepts/rag"), target: slug("concepts/rag"), score: 0.99 },
    ])

    assert.strictEqual(
      edges.some((edge) => edge.source === edge.target),
      false,
    )
    assert.strictEqual(
      edges.some(
        (edge) =>
          edge.source === slug("concepts/rag") &&
          edge.target === slug("concepts/rag") &&
          edge.semanticScore > 0,
      ),
      false,
    )
  })

  test("keeps RAG, GraphRAG, and embedding closer than unrelated health and career nodes", () => {
    const data = sampleData()
    const edges = buildMemoryAtlasWeightedEdges(data, semanticEdges)
    const positions = layoutMemoryAtlasGraph(data, edges)
    const bySlug = new Map(positions.map((position) => [position.slug, position]))

    assert.ok(
      distance(bySlug, "concepts/rag", "concepts/graph-rag") <
        distance(bySlug, "concepts/rag", "topics/health"),
    )
    assert.ok(
      distance(bySlug, "concepts/rag", "concepts/embedding-index") <
        distance(bySlug, "concepts/rag", "topics/career"),
    )
  })

  test("is deterministic across input node, link, and semantic edge order", () => {
    const data = sampleData()
    const reversedData = {
      nodes: [...data.nodes].reverse(),
      links: [...data.links].reverse(),
    }
    const firstEdges = buildMemoryAtlasWeightedEdges(data, semanticEdges)
    const secondEdges = buildMemoryAtlasWeightedEdges(reversedData, [...semanticEdges].reverse())

    assert.deepStrictEqual(secondEdges, firstEdges)
    assert.deepStrictEqual(
      layoutMemoryAtlasGraph(data, firstEdges),
      layoutMemoryAtlasGraph(data, firstEdges),
    )
    assert.deepStrictEqual(
      layoutMemoryAtlasGraph(reversedData, secondEdges),
      layoutMemoryAtlasGraph(data, firstEdges),
    )
  })

  test("computes local layout from real wiki hop depth only and preserves unrelated positions", () => {
    const data = sampleData()
    const edges = buildMemoryAtlasWeightedEdges(data, semanticEdges)
    const global = layoutMemoryAtlasGraph(data, edges, { width: 900, height: 600 })
    const local = layoutMemoryAtlasLocalGraph(data, global, slug("concepts/rag"), {
      width: 900,
      height: 600,
      maxDepth: 2,
    })
    const bySlug = new Map(local.map((position) => [position.slug, position]))
    const globalBySlug = new Map(global.map((position) => [position.slug, position]))

    assert.deepStrictEqual(
      [...calculateWikiHopDepth(data.links, slug("concepts/rag"), 2)],
      [
        [slug("concepts/rag"), 0],
        [slug("concepts/graph-rag"), 1],
        [slug("concepts/embedding-index"), 2],
      ],
    )
    assert.deepStrictEqual(bySlug.get(slug("concepts/rag")), {
      slug: slug("concepts/rag"),
      x: 450,
      y: 300,
      depth: 0,
      selected: true,
      related: true,
    })
    assert.strictEqual(bySlug.get(slug("concepts/graph-rag"))?.depth, 1)
    assert.strictEqual(bySlug.get(slug("concepts/embedding-index"))?.depth, 2)
    assert.strictEqual(bySlug.get(slug("topics/health"))?.related, false)
    assert.deepStrictEqual(
      stripLocalFlags(bySlug.get(slug("topics/health"))!),
      globalBySlug.get(slug("topics/health")),
    )
  })

  test("recenters when another slug is selected and restores global positions when cleared", () => {
    const data = sampleData()
    const edges = buildMemoryAtlasWeightedEdges(data, semanticEdges)
    const global = layoutMemoryAtlasGraph(data, edges, { width: 900, height: 600 })
    const healthLocal = layoutMemoryAtlasLocalGraph(data, global, slug("topics/health"), {
      width: 900,
      height: 600,
    })
    const cleared = layoutMemoryAtlasLocalGraph(data, global, undefined, {
      width: 900,
      height: 600,
    })

    assert.strictEqual(
      healthLocal.find((position) => position.slug === slug("topics/health"))?.selected,
      true,
    )
    assert.deepStrictEqual(
      cleared.map(stripLocalFlags).sort((a, b) => a.slug.localeCompare(b.slug)),
      global,
    )
  })

  test("resolves fixed career, health, AI, and RAG entrypoints with disabled misses", () => {
    const data = sampleData()
    const entrypoints = resolveFixedMemoryAtlasEntrypoints(data)

    assert.deepStrictEqual(
      entrypoints.map((entrypoint) => [
        entrypoint.id,
        entrypoint.enabled,
        entrypoint.representativeSlug,
      ]),
      [
        ["career", true, slug("topics/career")],
        ["health", true, slug("topics/health")],
        ["ai", true, slug("concepts/rag")],
      ],
    )
    assert.deepStrictEqual(entrypoints[2].children?.[0], {
      id: "rag",
      label: "RAG",
      enabled: true,
      representativeSlug: slug("concepts/rag"),
    })

    const noHealth = {
      ...data,
      nodes: data.nodes.filter((current) => !current.tags.includes("health")),
    }
    assert.strictEqual(resolveFixedMemoryAtlasEntrypoints(noHealth)[1].enabled, false)
  })

  test("does not match short AI abbreviations inside unrelated title words", () => {
    const data: MemoryAtlasData = {
      nodes: [node("topics/brain-map", { title: "Brain Map", tags: ["knowledge"] })],
      links: [],
    }
    const entrypoints = resolveFixedMemoryAtlasEntrypoints(data)

    assert.strictEqual(entrypoints.find((entrypoint) => entrypoint.id === "ai")?.enabled, false)
  })

  test("does not classify general work-style documents as career entrypoints", () => {
    const data: MemoryAtlasData = {
      nodes: [node("concepts/ai-harness", { title: "AI Harness", tags: ["work-style"] })],
      links: [],
    }
    const entrypoints = resolveFixedMemoryAtlasEntrypoints(data)

    assert.strictEqual(entrypoints.find((entrypoint) => entrypoint.id === "career")?.enabled, false)
  })

  test("selects direct career signals for the career entrypoint", () => {
    const data: MemoryAtlasData = {
      nodes: [
        node("concepts/ai-era-expertise", { title: "AI 시대 전문성", tags: ["career"] }),
        node("concepts/ai-harness", { title: "AI Harness", tags: ["work-style"] }),
      ],
      links: [],
    }
    const entrypoints = resolveFixedMemoryAtlasEntrypoints(data)

    assert.strictEqual(
      entrypoints.find((entrypoint) => entrypoint.id === "career")?.representativeSlug,
      slug("concepts/ai-era-expertise"),
    )
  })

  test("keeps GraphRAG matching the RAG focus through a long title token", () => {
    const data: MemoryAtlasData = {
      nodes: [node("concepts/graph-retrieval", { title: "GraphRAG", tags: ["graph"] })],
      links: [],
    }
    const ragFocus = resolveFixedMemoryAtlasEntrypoints(data).find(
      (entrypoint) => entrypoint.id === "ai",
    )?.children?.[0]

    assert.deepStrictEqual(ragFocus, {
      id: "rag",
      label: "RAG",
      enabled: true,
      representativeSlug: slug("concepts/graph-retrieval"),
    })
  })

  test("derives automatic entrypoints without persisting or leaking private values in public input", () => {
    const publicData = sampleData()
    const edges = buildMemoryAtlasWeightedEdges(publicData, semanticEdges)
    const fixed = resolveFixedMemoryAtlasEntrypoints(publicData)
      .flatMap((entrypoint) => [
        entrypoint.representativeSlug,
        ...(entrypoint.children ?? []).map((child) => child.representativeSlug),
      ])
      .filter((value): value is FullSlug => Boolean(value))

    const candidates = deriveAutomaticMemoryAtlasEntrypoints(publicData, edges, {
      minCommunitySize: 2,
      maxCandidates: 3,
      excludeSlugs: fixed,
    })

    const serialized = JSON.stringify(candidates)
    assert.strictEqual(serialized.includes("_private/"), false)
    assert.strictEqual(serialized.includes("Secret"), false)
    assert.ok(candidates.length <= 3)
  })

  test("keeps two strong clusters separate when a weak bridge exists", () => {
    const data = bridgedClusterData()
    const edges = buildMemoryAtlasWeightedEdges(
      data,
      [
        {
          source: slug("concepts/rag-retriever"),
          target: slug("concepts/sleep-recovery"),
          score: 0.1,
        },
      ],
      { minTagScore: 0.2 },
    )

    const candidates = deriveAutomaticMemoryAtlasEntrypoints(data, edges, {
      minCommunitySize: 3,
      maxCandidates: 4,
    })

    assert.deepStrictEqual(
      candidates.map((candidate) => [candidate.label, candidate.memberSlugs]),
      [
        [
          "health",
          [
            slug("concepts/exercise-load"),
            slug("concepts/sleep-recovery"),
            slug("topics/health-habits"),
          ],
        ],
        [
          "rag",
          [
            slug("concepts/graph-retrieval"),
            slug("concepts/rag-retriever"),
            slug("topics/rag-systems"),
          ],
        ],
      ],
    )
  })

  test("derives the same automatic candidates when input order is reversed", () => {
    const data = bridgedClusterData()
    const reversedData = {
      nodes: [...data.nodes].reverse(),
      links: [...data.links].reverse(),
    }
    const semantic = [
      {
        source: slug("concepts/rag-retriever"),
        target: slug("concepts/sleep-recovery"),
        score: 0.1,
      },
    ]
    const first = deriveAutomaticMemoryAtlasEntrypoints(
      data,
      buildMemoryAtlasWeightedEdges(data, semantic, { minTagScore: 0.2 }),
      { minCommunitySize: 3, maxCandidates: 4 },
    )
    const second = deriveAutomaticMemoryAtlasEntrypoints(
      reversedData,
      buildMemoryAtlasWeightedEdges(reversedData, [...semantic].reverse(), { minTagScore: 0.2 }),
      { minCommunitySize: 3, maxCandidates: 4 },
    )

    assert.deepStrictEqual(second, first)
  })
})

function distance(
  positions: Map<FullSlug, { x: number; y: number }>,
  source: string,
  target: string,
): number {
  const sourcePosition = positions.get(slug(source))
  const targetPosition = positions.get(slug(target))
  assert.ok(sourcePosition)
  assert.ok(targetPosition)
  return Math.hypot(sourcePosition.x - targetPosition.x, sourcePosition.y - targetPosition.y)
}

function stripLocalFlags(position: { slug: FullSlug; x: number; y: number }) {
  return { slug: position.slug, x: position.x, y: position.y }
}

function bridgedClusterData(): MemoryAtlasData {
  return {
    nodes: [
      node("topics/rag-systems", { title: "RAG Systems", tags: ["rag", "ai"], degree: 2 }),
      node("concepts/rag-retriever", { title: "Retriever", tags: ["rag", "ai"], degree: 2 }),
      node("concepts/graph-retrieval", {
        title: "Graph Retrieval",
        tags: ["rag", "ai"],
        degree: 1,
      }),
      node("topics/health-habits", {
        title: "Health Habits",
        tags: ["health", "routine"],
        degree: 2,
      }),
      node("concepts/sleep-recovery", {
        title: "Sleep Recovery",
        tags: ["health", "routine"],
        degree: 2,
      }),
      node("concepts/exercise-load", {
        title: "Exercise Load",
        tags: ["health", "routine"],
        degree: 1,
      }),
    ],
    links: [
      { source: slug("topics/rag-systems"), target: slug("concepts/rag-retriever") },
      { source: slug("concepts/rag-retriever"), target: slug("concepts/graph-retrieval") },
      { source: slug("topics/health-habits"), target: slug("concepts/sleep-recovery") },
      { source: slug("concepts/sleep-recovery"), target: slug("concepts/exercise-load") },
    ],
  }
}
