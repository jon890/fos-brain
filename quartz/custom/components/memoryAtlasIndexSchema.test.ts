import assert from "node:assert"
import test, { describe } from "node:test"
import {
  MEMORY_ATLAS_INDEX_SCHEMA,
  MEMORY_ATLAS_INDEX_SCHEMA_KEY,
  memoryAtlasIndexSchemaMarker,
  parseMemoryAtlasIndex,
} from "./memoryAtlasIndexSchema"

describe("memory atlas index schema", () => {
  test("removes the marker and keeps every entry", () => {
    const parsed = parseMemoryAtlasIndex<{ title: string }>(
      {
        ...memoryAtlasIndexSchemaMarker(),
        "concepts/rag": { title: "RAG" },
      },
      "test index",
    )

    assert.deepStrictEqual(parsed, { "concepts/rag": { title: "RAG" } })
  })

  test("rejects an index without the marker", () => {
    assert.throws(
      () => parseMemoryAtlasIndex({ "concepts/rag": { title: "RAG" } }, "test index"),
      /schema marker/,
    )
  })

  test("rejects an index whose marker is another version", () => {
    assert.throws(
      () =>
        parseMemoryAtlasIndex(
          { [MEMORY_ATLAS_INDEX_SCHEMA_KEY]: `${MEMORY_ATLAS_INDEX_SCHEMA}0` },
          "test index",
        ),
      /schema marker/,
    )
  })

  test("rejects values that are not index objects", () => {
    assert.throws(() => parseMemoryAtlasIndex([], "test index"), /not a Memory Atlas index object/)
    assert.throws(
      () => parseMemoryAtlasIndex(null, "test index"),
      /not a Memory Atlas index object/,
    )
  })
})
