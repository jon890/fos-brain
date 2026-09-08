import assert from "node:assert"
import test, { describe } from "node:test"
import type { FullSlug } from "../../quartz/util/path"
import {
  createEmptyPublishedMemoryAtlasSemantics,
  parseMemoryAtlasSemantics,
  parsePublishedMemoryAtlasSemantics,
  restrictMemoryAtlasSemanticsToSlugs,
  restrictPublishedMemoryAtlasSemanticsToSlugs,
  type MemoryAtlasSemanticsArtifact,
} from "./memoryAtlasSemantics"

function slug(value: string): FullSlug {
  return value as FullSlug
}

const validArtifact: MemoryAtlasSemanticsArtifact = {
  schemaVersion: 1,
  generatedAt: "2026-09-02T00:00:00.000Z",
  scope: "protected",
  source: "qmd-vector",
  edges: [
    { source: slug("concepts/rag"), target: slug("concepts/graph-rag"), score: 0.82 },
    { source: slug("concepts/rag"), target: slug("_private/entities/work"), score: 0.64 },
  ],
}

describe("memory atlas semantics", () => {
  test("normalizes undirected pairs and keeps the highest duplicate score", () => {
    const result = parseMemoryAtlasSemantics({
      ...validArtifact,
      edges: [
        { source: "concepts/b", target: "concepts/a", score: 0.4 },
        { source: "concepts/a", target: "concepts/b", score: 0.9 },
      ],
    })

    assert.strictEqual(result.ok, true)
    assert.deepStrictEqual(result.ok ? result.artifact.edges : [], [
      { source: slug("concepts/a"), target: slug("concepts/b"), score: 0.9 },
    ])
  })

  test("rejects invalid schema, dates, source, scopes, slugs, scores, and self-links", () => {
    const result = parseMemoryAtlasSemantics({
      schemaVersion: 2,
      generatedAt: "not-a-date",
      scope: "private",
      source: "model-cache",
      edges: [
        { source: "concepts/a", target: "concepts/a", score: 0.5 },
        { source: "/absolute", target: "concepts/b", score: 0.5 },
        { source: "concepts/a", target: "concepts/b", score: 1.2 },
      ],
    })

    assert.strictEqual(result.ok, false)
    assert.deepStrictEqual(result.ok ? [] : result.errors.map((error) => error.code), [
      "invalid_schema_version",
      "invalid_generated_at",
      "invalid_scope",
      "invalid_source",
    ])

    const edgeResult = parseMemoryAtlasSemantics({
      ...validArtifact,
      edges: [
        { source: "concepts/a", target: "concepts/a", score: 0.5 },
        { source: "/absolute", target: "concepts/b", score: 0.5 },
        { source: "concepts/a", target: "concepts/b", score: 1.2 },
      ],
    })

    assert.strictEqual(edgeResult.ok, false)
    assert.deepStrictEqual(
      edgeResult.ok ? [] : edgeResult.errors.map((error) => error.index),
      [0, 1, 2],
    )
  })

  test("distinguishes an empty fallback artifact from parser rejection", () => {
    assert.deepStrictEqual(createEmptyPublishedMemoryAtlasSemantics(), {
      schemaVersion: 1,
      generatedAt: "1970-01-01T00:00:00.000Z",
      source: "qmd-vector",
      edges: [],
    })
  })

  test("accepts scope-less published semantics for the browser runtime", () => {
    const result = parsePublishedMemoryAtlasSemantics({
      schemaVersion: 1,
      generatedAt: "2026-09-02T00:00:00.000Z",
      source: "qmd-vector",
      edges: [
        { source: "concepts/b", target: "concepts/a", score: 0.4 },
        { source: "concepts/a", target: "concepts/b", score: 0.9 },
      ],
    })

    assert.strictEqual(result.ok, true)
    assert.deepStrictEqual(result.ok ? result.artifact.edges : [], [
      { source: slug("concepts/a"), target: slug("concepts/b"), score: 0.9 },
    ])
  })

  test("keeps published semantics scoped to currently rendered slugs", () => {
    const parsed = parsePublishedMemoryAtlasSemantics({
      schemaVersion: 1,
      generatedAt: "2026-09-02T00:00:00.000Z",
      source: "qmd-vector",
      edges: [
        { source: "concepts/rag", target: "concepts/graph-rag", score: 0.82 },
        { source: "concepts/rag", target: "_private/entities/work", score: 0.64 },
      ],
    })

    assert.strictEqual(parsed.ok, true)
    const result = parsed.ok
      ? restrictPublishedMemoryAtlasSemanticsToSlugs(parsed.artifact, [
          slug("concepts/rag"),
          slug("concepts/graph-rag"),
          slug("_private/entities/work"),
        ])
      : createEmptyPublishedMemoryAtlasSemantics()

    assert.strictEqual(JSON.stringify(result).includes("_private/"), false)
    assert.deepStrictEqual(result.edges, [
      { source: slug("concepts/graph-rag"), target: slug("concepts/rag"), score: 0.82 },
    ])
  })

  test("keeps only edges whose endpoints are in the current content set", () => {
    const result = restrictMemoryAtlasSemanticsToSlugs(validArtifact, [
      slug("concepts/rag"),
      slug("concepts/graph-rag"),
      slug("concepts/unrelated"),
    ])

    assert.deepStrictEqual(result, {
      schemaVersion: 1,
      generatedAt: validArtifact.generatedAt,
      source: "qmd-vector",
      edges: [{ source: slug("concepts/graph-rag"), target: slug("concepts/rag"), score: 0.82 }],
    })
  })

  test("does not leak protected private endpoints into public output", () => {
    const result = restrictMemoryAtlasSemanticsToSlugs(validArtifact, [
      slug("concepts/rag"),
      slug("concepts/graph-rag"),
      slug("_private/entities/work"),
    ])

    assert.strictEqual(JSON.stringify(result).includes("_private/"), false)
    assert.deepStrictEqual(result.edges, [
      { source: slug("concepts/graph-rag"), target: slug("concepts/rag"), score: 0.82 },
    ])
  })

  test("allows private endpoints only when the current protected build requests it", () => {
    const result = restrictMemoryAtlasSemanticsToSlugs(
      validArtifact,
      [slug("concepts/rag"), slug("_private/entities/work")],
      { allowPrivate: true },
    )

    assert.deepStrictEqual(result.edges, [
      { source: slug("_private/entities/work"), target: slug("concepts/rag"), score: 0.64 },
    ])
  })
})
