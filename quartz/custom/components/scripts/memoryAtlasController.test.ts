import assert from "node:assert"
import test, { describe } from "node:test"
import { createDefaultMemoryAtlasState } from "../memoryAtlasData"
import type { FullSlug } from "../../../quartz/util/path"
import {
  createMemoryAtlasRuntimeLifecycle,
  loadMemoryAtlasDataWithFallback,
  memoryAtlasRuntimeSrcForMode,
  removePrivateMemoryAtlasState,
  restoreStoredMemoryAtlasState,
  updateViewportControlsVisibility,
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

  test("reads numeric runtime data attributes without relying on dataset camel casing", () => {
    const root = {
      getAttribute(name: string) {
        return {
          "data-runtime-2d-src": "/static/memory-atlas-2d.js",
          "data-runtime-3d-src": "/static/memory-atlas-3d.js",
        }[name]
      },
    } as Pick<HTMLElement, "getAttribute">

    assert.strictEqual(memoryAtlasRuntimeSrcForMode(root, "2d"), "/static/memory-atlas-2d.js")
    assert.strictEqual(memoryAtlasRuntimeSrcForMode(root, "3d"), "/static/memory-atlas-3d.js")
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

  test("removes private selections, tags and detail state when returning to public data", () => {
    const fallback = createDefaultMemoryAtlasState()
    const current = {
      ...fallback,
      namespaces: ["private" as const],
      tags: ["private-only", "shared"],
      selectedSlug: slug("_private/concepts/work"),
    }
    const publicData = {
      nodes: [
        {
          id: slug("concepts/rag"),
          slug: slug("concepts/rag"),
          title: "RAG",
          tags: ["shared"],
          namespace: "public" as const,
          degree: 0,
          sourceCount: 0,
        },
      ],
      links: [],
    }

    assert.deepStrictEqual(removePrivateMemoryAtlasState(current, publicData), {
      ...current,
      namespaces: [],
      tags: ["shared"],
      selectedSlug: undefined,
    })
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

  test("keeps the latest renderer when an older runtime load finishes late", async () => {
    const events: string[] = []
    let release3d: (() => void) | undefined
    const lifecycle = createMemoryAtlasRuntimeLifecycle(
      (mode) =>
        new Promise((resolve) => {
          const finish = () =>
            resolve({
              mountMemoryAtlas() {
                events.push(`mount:${mode}`)
                return {
                  update: () => events.push(`update:${mode}`),
                  select: () => undefined,
                  recenter: () => undefined,
                  setEvidenceSlugs: () => undefined,
                  destroy: () => events.push(`destroy:${mode}`),
                }
              },
            })
          if (mode === "3d") release3d = finish
          else finish()
        }),
    )
    const mountOptions = {
      container: {} as HTMLElement,
      data: { nodes: [], links: [] },
      state: createDefaultMemoryAtlasState(),
      onSelect: () => undefined,
    }

    const staleMount = lifecycle.mount("3d", mountOptions)
    await lifecycle.mount("2d", mountOptions)
    release3d?.()
    await staleMount
    lifecycle.update(mountOptions.data, mountOptions.state)

    assert.deepStrictEqual(events, ["mount:2d", "update:2d"])
  })

  test("hides the viewport controls only while 3D is active", () => {
    const controls = { hidden: false }
    const root = {
      querySelector(selector: string) {
        assert.strictEqual(selector, '[data-testid="memory-atlas-viewport-controls"]')
        return controls
      },
    } as unknown as HTMLElement

    updateViewportControlsVisibility(root, "3d")
    assert.strictEqual(controls.hidden, true)
    updateViewportControlsVisibility(root, "2d")
    assert.strictEqual(controls.hidden, false)
  })

  test("passes the viewport reset and zoom to the runtime and tolerates handles without them", async () => {
    const events: string[] = []
    const mountOptions = {
      container: {} as HTMLElement,
      data: { nodes: [], links: [] },
      state: createDefaultMemoryAtlasState(),
      onSelect: () => undefined,
    }
    const handleFor = (mode: string) => ({
      update: () => undefined,
      select: () => undefined,
      recenter: () => undefined,
      setEvidenceSlugs: () => undefined,
      destroy: () => undefined,
      ...(mode === "2d"
        ? {
            resetViewport: () => events.push("reset:2d"),
            zoomBy: (factor: number) => events.push(`zoom:${factor}`),
          }
        : {}),
    })
    const lifecycle = createMemoryAtlasRuntimeLifecycle(async (mode) => ({
      mountMemoryAtlas: () => handleFor(mode),
    }))

    await lifecycle.mount("2d", mountOptions)
    lifecycle.resetViewport()
    lifecycle.zoomBy(2)
    await lifecycle.mount("3d", mountOptions)
    lifecycle.resetViewport()
    lifecycle.zoomBy(2)
    lifecycle.destroy()
    lifecycle.resetViewport()
    lifecycle.zoomBy(2)

    assert.deepStrictEqual(events, ["reset:2d", "zoom:2"])
  })
})
