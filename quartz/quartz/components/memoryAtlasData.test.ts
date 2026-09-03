import assert from "node:assert"
import test, { describe } from "node:test"
import type { ContentDetails } from "../plugins/emitters/contentIndex"
import type { FilePath, FullSlug, SimpleSlug } from "../util/path"
import {
  buildMemoryAtlasData,
  clearMemoryAtlasQuery,
  createDefaultMemoryAtlasState,
  deriveMemoryAtlasFacets,
  filterMemoryAtlas,
  inferMemoryNamespace,
  restrictMemoryAtlasDataToNamespaces,
  selectMemoryAtlasNode,
  shouldShowMemoryAtlasResults,
  type MemoryAtlasState,
} from "./memoryAtlasData"

function slug(value: string): FullSlug {
  return value as FullSlug
}

function simpleSlug(value: string): SimpleSlug {
  return value as SimpleSlug
}

function content(id: string, overrides: Partial<ContentDetails> = {}): ContentDetails {
  return {
    slug: slug(id),
    filePath: `${id}.md` as FilePath,
    title: `Title ${id}`,
    links: [],
    tags: [],
    content: "",
    ...overrides,
  }
}

function state(overrides: Partial<MemoryAtlasState> = {}): MemoryAtlasState {
  return { ...createDefaultMemoryAtlasState(), ...overrides }
}

describe("memory atlas data", () => {
  test("defaults to 2D mode without storing graph-derived values", () => {
    const current = createDefaultMemoryAtlasState()

    assert.deepStrictEqual(current, {
      mode: "2d",
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
    })
    assert.strictEqual("selectedNode" in current, false)
    assert.strictEqual("positions" in current, false)
    assert.strictEqual("entrypoints" in current, false)
  })

  test("clears only the search query when search is dismissed", () => {
    const current = state({
      query: "RAG",
      tags: ["retrieval"],
      selectedSlug: slug("concepts/current"),
    })

    assert.deepStrictEqual(clearMemoryAtlasQuery(current), {
      ...current,
      query: "",
    })
  })

  test("clears the search query when a graph node is selected", () => {
    const current = state({ query: "RAG", tags: ["retrieval"] })

    assert.deepStrictEqual(selectMemoryAtlasNode(current, slug("concepts/rag")), {
      ...current,
      query: "",
      selectedSlug: slug("concepts/rag"),
    })
    assert.deepStrictEqual(selectMemoryAtlasNode(current), {
      ...current,
      selectedSlug: undefined,
    })
  })

  test("closes search results after selecting a node without active filters", () => {
    assert.strictEqual(
      shouldShowMemoryAtlasResults(state({ selectedSlug: slug("concepts/rag") })),
      false,
    )
    assert.strictEqual(shouldShowMemoryAtlasResults(state({ query: "RAG" })), true)
    assert.strictEqual(shouldShowMemoryAtlasResults(state({ tags: ["retrieval"] })), true)
  })

  test("keeps sparse metadata renderable", () => {
    const data = buildMemoryAtlasData({
      "concepts/sparse": content("concepts/sparse"),
    })

    assert.strictEqual(data.nodes.length, 1)
    const node = data.nodes[0]
    assert.strictEqual(node.slug, slug("concepts/sparse"))
    assert.strictEqual(node.namespace, "public")
    assert.strictEqual(node.sourceCount, 0)
    assert.strictEqual(node.description, undefined)
    assert.strictEqual(node.type, undefined)
    assert.deepStrictEqual(data.links, [])
  })

  test("removes invalid, self, and duplicate links", () => {
    const data = buildMemoryAtlasData({
      "concepts/a": content("concepts/a", {
        links: [
          simpleSlug("concepts/b"),
          simpleSlug("concepts/b"),
          simpleSlug("concepts/a"),
          simpleSlug("concepts/missing"),
        ],
      }),
      "concepts/b": content("concepts/b", {
        links: [simpleSlug("concepts/a")],
      }),
    })

    assert.deepStrictEqual(data.links, [
      { source: slug("concepts/a"), target: slug("concepts/b") },
      { source: slug("concepts/b"), target: slug("concepts/a") },
    ])
    assert.deepStrictEqual(
      data.nodes.map((node) => [node.slug, node.degree]),
      [
        [slug("concepts/a"), 2],
        [slug("concepts/b"), 2],
      ],
    )
  })

  test("classifies only _private slugs as private", () => {
    const data = buildMemoryAtlasData({
      "_private/concepts/session": content("_private/concepts/session", {
        title: "Redacted",
        description: "Redacted",
      }),
      "private/concepts/public-note": content("private/concepts/public-note"),
    })

    assert.strictEqual(inferMemoryNamespace("_private/concepts/session"), "private")
    assert.strictEqual(inferMemoryNamespace("private/concepts/public-note"), "public")
    assert.deepStrictEqual(
      data.nodes.map((node) => [node.slug, node.namespace]),
      [
        [slug("_private/concepts/session"), "private"],
        [slug("private/concepts/public-note"), "public"],
      ],
    )
  })

  test("matches search text against titles and tags case-insensitively", () => {
    const data = buildMemoryAtlasData({
      "concepts/java": content("concepts/java", {
        title: "Backend Patterns",
        tags: ["Java", "Architecture"],
      }),
      "concepts/python": content("concepts/python", {
        title: "Notebook habits",
        tags: ["analysis"],
      }),
    })

    assert.deepStrictEqual(
      filterMemoryAtlas(data, state({ query: "back" })).nodes.map((node) => node.slug),
      [slug("concepts/java")],
    )
    assert.deepStrictEqual(
      filterMemoryAtlas(data, state({ query: "ARCH" })).nodes.map((node) => node.slug),
      [slug("concepts/java")],
    )
  })

  test("combines filter groups with AND and values inside a group with OR", () => {
    const data = buildMemoryAtlasData({
      "concepts/a": content("concepts/a", {
        tags: ["ops"],
        type: "concept",
        status: "stable",
        freshness: { state: "current", date: "2027-01-01" },
      }),
      "concepts/b": content("concepts/b", {
        tags: ["ops", "ml"],
        type: "topic",
        status: "draft",
        freshness: { state: "stale", date: "2026-01-01" },
      }),
      "entities/c": content("entities/c", {
        tags: ["people"],
        type: "entity",
        status: "stable",
      }),
    })

    assert.deepStrictEqual(
      filterMemoryAtlas(
        data,
        state({
          tags: ["ops", "people"],
          types: ["concept", "topic"],
          namespaces: ["public"],
        }),
      ).nodes.map((node) => node.slug),
      [slug("concepts/a"), slug("concepts/b")],
    )
  })

  test("returns an empty graph when no nodes match", () => {
    const data = buildMemoryAtlasData({
      "concepts/a": content("concepts/a", { links: [simpleSlug("concepts/b")] }),
      "concepts/b": content("concepts/b"),
    })

    const filtered = filterMemoryAtlas(data, state({ query: "missing" }))
    assert.strictEqual(filtered.nodes.length, 0)
    assert.strictEqual(filtered.links.length, 0)
  })

  test("creates a schema-aligned default state for the current graph", () => {
    const data = buildMemoryAtlasData({
      "concepts/public": content("concepts/public"),
      "_private/concepts/session": content("_private/concepts/session"),
    })

    assert.deepStrictEqual(createDefaultMemoryAtlasState(data), {
      mode: "2d",
      query: "",
      lens: "all",
      namespaces: ["public", "private"],
      types: [],
      freshness: [],
      tags: [],
      layout: "constellation",
      colorBy: "type",
      spacing: "normal",
      labels: true,
    })
  })

  test("preserves invalid freshness so the UI can flag dates requiring review", () => {
    const data = buildMemoryAtlasData({
      "concepts/invalid-date": content("concepts/invalid-date", {
        freshness: { state: "invalid" },
      }),
      "concepts/current": content("concepts/current", {
        freshness: { state: "current", date: "2027-01-01" },
      }),
    })

    assert.deepStrictEqual(
      filterMemoryAtlas(data, state({ freshness: ["invalid"] })).nodes.map((node) => node.slug),
      [slug("concepts/invalid-date")],
    )
    assert.deepStrictEqual(deriveMemoryAtlasFacets(data).freshness, { invalid: 1, current: 1 })
  })

  test("derives aggregate facets from visible nodes", () => {
    const data = buildMemoryAtlasData({
      "concepts/a": content("concepts/a", {
        links: [simpleSlug("concepts/b")],
        tags: ["ops"],
        type: "concept",
        status: "stable",
        freshness: { state: "current", date: "2027-01-01" },
        sourceCount: 2,
      }),
      "concepts/b": content("concepts/b", {
        tags: ["ops", "ml"],
        type: "topic",
        status: "draft",
        freshness: { state: "stale", date: "2026-01-01" },
        sourceCount: 1,
      }),
    })

    assert.deepStrictEqual(deriveMemoryAtlasFacets(data), {
      total: 2,
      namespaces: { public: 2, private: 0 },
      types: { concept: 1, topic: 1 },
      statuses: { stable: 1, draft: 1 },
      freshness: { current: 1, stale: 1 },
      tags: { ops: 2, ml: 1 },
      sourceCount: { total: 3, max: 2 },
      links: { total: 1, maxDegree: 1 },
    })
  })

  test("does not create a private facet when the index has no _private slug", () => {
    const data = buildMemoryAtlasData({
      "concepts/public": content("concepts/public"),
    })

    const facets = deriveMemoryAtlasFacets(data)
    assert.strictEqual(facets.namespaces.private, 0)
    assert.strictEqual(facets.total, 1)
  })

  test("removes private nodes and links at the public data boundary", () => {
    const data = buildMemoryAtlasData({
      "concepts/public": content("concepts/public", {
        links: [simpleSlug("_private/concepts/private")],
      }),
      "_private/concepts/private": content("_private/concepts/private"),
    })

    const publicData = restrictMemoryAtlasDataToNamespaces(data, ["public"])

    assert.deepStrictEqual(
      publicData.nodes.map((node) => node.slug),
      [slug("concepts/public")],
    )
    assert.deepStrictEqual(publicData.links, [])
    assert.strictEqual(publicData.nodes[0].degree, 0)
  })
})
