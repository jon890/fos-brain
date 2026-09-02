import assert from "node:assert"
import test, { describe } from "node:test"
import { createDefaultMemoryAtlasState } from "../memoryAtlasData"
import type { FullSlug } from "../../util/path"
import {
  createMemoryAtlasRuntimeLifecycle,
  loadMemoryAtlasDataWithFallback,
  restoreStoredMemoryAtlasState,
} from "./memoryAtlasController"

function slug(value: string): FullSlug {
  return value as FullSlug
}

function fakeFallbackRoot() {
  return {
    querySelectorAll(selector: string) {
      assert.strictEqual(selector, '[data-testid="memory-atlas-results"] li[data-slug]')
      return [
        {
          dataset: { slug: "concepts/rag" },
          querySelector(query: string) {
            assert.strictEqual(query, "button, a")
            return { textContent: "RAG" }
          },
        },
      ]
    },
  } as unknown as HTMLElement
}

describe("memory atlas controller", () => {
  test("restores old stored state with 2D as the default mode", () => {
    const fallback = createDefaultMemoryAtlasState()

    const restored = restoreStoredMemoryAtlasState(fallback, {
      getItem: () => JSON.stringify({ query: "rag", layout: "cluster" }),
    })

    assert.strictEqual(restored.mode, "2d")
    assert.strictEqual(restored.query, "rag")
    assert.strictEqual(restored.layout, "cluster")
  })

  test("keeps explicit 3D mode in stored state", () => {
    const fallback = createDefaultMemoryAtlasState()

    const restored = restoreStoredMemoryAtlasState(fallback, {
      getItem: () => JSON.stringify({ mode: "3d" }),
    })

    assert.strictEqual(restored.mode, "3d")
  })

  test("uses SSR document list when the content index loader fails", async () => {
    const result = await loadMemoryAtlasDataWithFallback(fakeFallbackRoot(), async () => {
      throw new Error("index failed")
    })

    assert.strictEqual(result.fallback, true)
    assert.deepStrictEqual(
      result.data.nodes.map((node) => [node.slug, node.title]),
      [[slug("concepts/rag"), "RAG"]],
    )
    assert.deepStrictEqual(result.data.links, [])
  })

  test("destroys the previous renderer on mode switch and ignores updates after destroy", async () => {
    const events: string[] = []
    const lifecycle = createMemoryAtlasRuntimeLifecycle(async (mode) => ({
      mountMemoryAtlas() {
        events.push(`mount:${mode}`)
        return {
          update: () => events.push(`update:${mode}`),
          select: () => events.push(`select:${mode}`),
          recenter: () => events.push(`recenter:${mode}`),
          setEvidenceSlugs: () => events.push(`evidence:${mode}`),
          destroy: () => events.push(`destroy:${mode}`),
        }
      },
    }))
    const mountOptions = {
      container: {} as HTMLElement,
      data: { nodes: [], links: [] },
      state: createDefaultMemoryAtlasState(),
      onSelect: () => undefined,
    }

    await lifecycle.mount("2d", mountOptions)
    lifecycle.update(mountOptions.data, mountOptions.state)
    await lifecycle.mount("3d", mountOptions)
    lifecycle.destroy()
    lifecycle.update(mountOptions.data, mountOptions.state)

    assert.deepStrictEqual(events, [
      "mount:2d",
      "update:2d",
      "destroy:2d",
      "mount:3d",
      "destroy:3d",
    ])
  })
})
