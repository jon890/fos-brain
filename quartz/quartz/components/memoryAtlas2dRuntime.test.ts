import assert from "node:assert"
import { readFileSync } from "node:fs"
import test, { describe } from "node:test"
import type { FullSlug } from "../util/path"
import {
  createDefaultMemoryAtlasState,
  type MemoryAtlasData,
  type MemoryAtlasNode,
} from "./memoryAtlasData"
import type { MemoryAtlasSemanticEdge } from "./memoryAtlasSemantics"
import { buildMemoryAtlas2dScene } from "./scripts/memoryAtlas2dRuntime"

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
      node("concepts/rag", { title: "RAG", tags: ["ai", "rag"], degree: 2 }),
      node("concepts/graph-rag", { title: "GraphRAG", tags: ["ai", "rag"], degree: 2 }),
      node("concepts/embedding-index", {
        title: "Embedding Index",
        tags: ["ai", "retrieval"],
        degree: 1,
      }),
      node("topics/health", { title: "건강", tags: ["health"], degree: 1 }),
      node("concepts/sleep", { title: "수면", tags: ["health"], degree: 1 }),
    ],
    links: [
      { source: slug("concepts/rag"), target: slug("concepts/graph-rag") },
      { source: slug("concepts/graph-rag"), target: slug("concepts/embedding-index") },
      { source: slug("topics/health"), target: slug("concepts/sleep") },
    ],
  }
}

const semanticEdges: MemoryAtlasSemanticEdge[] = [
  { source: slug("concepts/rag"), target: slug("concepts/embedding-index"), score: 0.91 },
]

describe("memory atlas 2D runtime scene", () => {
  test("shows every title while dimming nodes outside the selected 1-hop relation", () => {
    const state = { ...createDefaultMemoryAtlasState(), selectedSlug: slug("concepts/rag") }
    const scene = buildMemoryAtlas2dScene(sampleData(), state, semanticEdges, {
      width: 900,
      height: 600,
    })
    const bySlug = new Map(scene.nodes.map((node) => [node.slug, node]))

    assert.deepStrictEqual(
      scene.nodes.map((node) => node.title).sort(),
      ["Embedding Index", "GraphRAG", "RAG", "건강", "수면"].sort(),
    )
    assert.strictEqual(bySlug.get(slug("concepts/rag"))?.selected, true)
    assert.strictEqual(bySlug.get(slug("concepts/rag"))?.x, 450)
    assert.strictEqual(bySlug.get(slug("concepts/rag"))?.y, 300)
    assert.strictEqual(bySlug.get(slug("concepts/graph-rag"))?.depth, 1)
    assert.strictEqual(bySlug.get(slug("concepts/embedding-index"))?.depth, 2)
    assert.ok(
      (bySlug.get(slug("concepts/graph-rag"))?.labelOpacity ?? 0) >
        (bySlug.get(slug("concepts/embedding-index"))?.labelOpacity ?? 0),
    )
    assert.ok(
      (bySlug.get(slug("concepts/embedding-index"))?.labelOpacity ?? 0) >
        (bySlug.get(slug("topics/health"))?.labelOpacity ?? 0),
    )
  })

  test("recenters around the newly selected node and restores global coordinates when cleared", () => {
    const data = sampleData()
    const graphRagScene = buildMemoryAtlas2dScene(
      data,
      { ...createDefaultMemoryAtlasState(), selectedSlug: slug("concepts/graph-rag") },
      semanticEdges,
      { width: 900, height: 600 },
    )
    const clearedScene = buildMemoryAtlas2dScene(
      data,
      createDefaultMemoryAtlasState(),
      semanticEdges,
      {
        width: 900,
        height: 600,
      },
    )
    const selected = graphRagScene.nodes.find((node) => node.slug === slug("concepts/graph-rag"))

    assert.strictEqual(selected?.x, 450)
    assert.strictEqual(selected?.y, 300)
    assert.strictEqual(
      graphRagScene.nodes.find((node) => node.slug === slug("concepts/rag"))?.depth,
      1,
    )
    assert.deepStrictEqual(
      clearedScene.nodes.map((node) => [node.slug, node.x, node.y]),
      clearedScene.nodes.map((node) => [node.slug, node.globalX, node.globalY]),
    )
  })

  test("does not expose private labels for public-only input", () => {
    const scene = buildMemoryAtlas2dScene(sampleData(), createDefaultMemoryAtlasState())

    assert.strictEqual(
      scene.nodes.some((node) => node.namespace === "private"),
      false,
    )
    assert.strictEqual(JSON.stringify(scene).includes("_private/"), false)
  })

  test("keeps mobile node centers inside the label-safe horizontal inset", () => {
    const scene = buildMemoryAtlas2dScene(sampleData(), createDefaultMemoryAtlasState(), [], {
      width: 390,
      height: 844,
    })

    assert.ok(scene.nodes.every((node) => node.x >= 390 * 0.22))
    assert.ok(scene.nodes.every((node) => node.x <= 390 - 390 * 0.22))
  })

  test("hides labels without hiding the graph nodes", () => {
    const scene = buildMemoryAtlas2dScene(sampleData(), {
      ...createDefaultMemoryAtlasState(),
      labels: false,
      selectedSlug: slug("concepts/rag"),
    })

    assert.ok(scene.nodes.every((node) => node.labelOpacity === 0))
    assert.ok(scene.nodes.every((node) => node.opacity > 0))
  })

  test("keeps the 2D bundle free from 3D runtime imports", () => {
    const source = readFileSync(
      new URL("./scripts/memoryAtlas2dRuntime.ts", import.meta.url),
      "utf8",
    )

    assert.strictEqual(source.includes("3d-force-graph"), false)
    assert.strictEqual(source.includes('"three"'), false)
    assert.strictEqual(source.includes("'three'"), false)
  })
})
