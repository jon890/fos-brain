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
import {
  applyMemoryAtlas2dViewport,
  attachMemoryAtlas2dViewportControls,
  buildMemoryAtlas2dScene,
  clampMemoryAtlas2dScale,
  MEMORY_ATLAS_2D_INITIAL_VIEWPORT,
  memoryAtlas2dViewportTransform,
  zoomMemoryAtlas2dViewport,
  type MemoryAtlas2dViewport,
} from "./scripts/memoryAtlas2dRuntime"

type RecordedListener = {
  type: string
  handler: unknown
  options?: unknown
}

function fakeViewportWrapper() {
  return { style: {} as { transform?: string } }
}

/**
 * `tsx --test` 에는 DOM 이 없다.
 * 컨테이너가 실제로 받는 호출만 기록하는 fake 로 배선과 해제를 검사한다.
 */
function fakeViewportContainer(wrapper = fakeViewportWrapper()) {
  const added: RecordedListener[] = []
  const removed: RecordedListener[] = []
  const captures: number[] = []
  const container = {
    added,
    removed,
    captures,
    wrapper,
    querySelector(selector: string) {
      return selector === ".memory-atlas-2d__viewport" ? wrapper : null
    },
    addEventListener(type: string, handler: unknown, options?: unknown) {
      added.push({ type, handler, options })
    },
    removeEventListener(type: string, handler: unknown, options?: unknown) {
      removed.push({ type, handler, options })
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 900, height: 600 }
    },
    setPointerCapture(pointerId: number) {
      captures.push(pointerId)
    },
    releasePointerCapture() {},
  }
  return container
}

function pointerEvent(overrides: Record<string, unknown> = {}) {
  return {
    pointerId: 1,
    button: 0,
    clientX: 0,
    clientY: 0,
    ...overrides,
  } as unknown as PointerEvent
}

function attachToFakeContainer(initial: MemoryAtlas2dViewport = MEMORY_ATLAS_2D_INITIAL_VIEWPORT) {
  const container = fakeViewportContainer()
  let viewport: MemoryAtlas2dViewport = { ...initial }
  const host = container as unknown as HTMLElement
  const detach = attachMemoryAtlas2dViewportControls({
    container: host,
    getViewport: () => viewport,
    setViewport: (next) => {
      viewport = next
      applyMemoryAtlas2dViewport(host, viewport)
    },
    moveTarget: host as unknown as EventTarget,
  })
  const dispatch = (type: string, event: unknown) => {
    for (const listener of container.added.filter((entry) => entry.type === type)) {
      ;(listener.handler as (value: unknown) => void)(event)
    }
  }
  return { container, detach, dispatch, viewport: () => viewport }
}

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

  test("writes the dragged offset into the viewport wrapper style", () => {
    const dragged = attachToFakeContainer()

    dragged.dispatch("pointerdown", pointerEvent({ clientX: 100, clientY: 100 }))
    dragged.dispatch("pointermove", pointerEvent({ clientX: 130, clientY: 118 }))

    assert.deepStrictEqual(dragged.viewport(), { x: 30, y: 18, k: 1 })
    assert.strictEqual(dragged.container.wrapper.style.transform, "translate(30px, 18px) scale(1)")
  })

  test("ignores pointer movement below the 4px drag threshold", () => {
    const tapped = attachToFakeContainer()

    tapped.dispatch("pointerdown", pointerEvent({ clientX: 100, clientY: 100 }))
    tapped.dispatch("pointermove", pointerEvent({ clientX: 102, clientY: 101 }))

    assert.deepStrictEqual(tapped.viewport(), MEMORY_ATLAS_2D_INITIAL_VIEWPORT)
    assert.strictEqual(tapped.container.wrapper.style.transform, undefined)
    assert.deepStrictEqual(tapped.container.captures, [])
  })

  test("clamps the scale to the 0.4 and 4 boundaries", () => {
    assert.strictEqual(clampMemoryAtlas2dScale(0.1), 0.4)
    assert.strictEqual(clampMemoryAtlas2dScale(9), 4)
    assert.strictEqual(clampMemoryAtlas2dScale(1.5), 1.5)
    assert.strictEqual(clampMemoryAtlas2dScale(Number.NaN), 1)
    assert.strictEqual(zoomMemoryAtlas2dViewport({ x: 0, y: 0, k: 1 }, 5000, 0, 0).k, 0.4)
    assert.strictEqual(zoomMemoryAtlas2dViewport({ x: 0, y: 0, k: 1 }, -5000, 0, 0).k, 4)
  })

  test("keeps the point under the pointer fixed while zooming", () => {
    const before = { x: 40, y: -20, k: 1.25 }
    const after = zoomMemoryAtlas2dViewport(before, -120, 300, 200)
    const sceneX = (300 - before.x) / before.k
    const sceneY = (200 - before.y) / before.k

    assert.ok(after.k > before.k)
    assert.ok(Math.abs(after.x + sceneX * after.k - 300) < 1e-9)
    assert.ok(Math.abs(after.y + sceneY * after.k - 200) < 1e-9)
  })

  test("reapplies the current viewport to the wrapper each render", () => {
    const container = fakeViewportContainer()
    const viewport = { x: 12, y: -8, k: 1.5 }

    applyMemoryAtlas2dViewport(container as unknown as HTMLElement, viewport)
    const rerendered = fakeViewportContainer()
    applyMemoryAtlas2dViewport(rerendered as unknown as HTMLElement, viewport)

    assert.strictEqual(container.wrapper.style.transform, "translate(12px, -8px) scale(1.5)")
    assert.strictEqual(rerendered.wrapper.style.transform, "translate(12px, -8px) scale(1.5)")
    assert.strictEqual(memoryAtlas2dViewportTransform(viewport), "translate(12px, -8px) scale(1.5)")
  })

  test("removes every registered viewport handler on detach", () => {
    const attached = attachToFakeContainer()

    attached.detach()

    const wheel = attached.container.added.find((entry) => entry.type === "wheel")
    assert.deepStrictEqual(wheel?.options, { passive: false })
    assert.deepStrictEqual(attached.container.added.map((entry) => entry.type).sort(), [
      "click",
      "pointercancel",
      "pointerdown",
      "pointermove",
      "pointerup",
      "wheel",
    ])
    assert.deepStrictEqual(
      attached.container.added,
      attached.container.added.map(
        (entry) =>
          attached.container.removed.find(
            (candidate) =>
              candidate.type === entry.type &&
              candidate.handler === entry.handler &&
              JSON.stringify(candidate.options ?? null) === JSON.stringify(entry.options ?? null),
          )!,
      ),
    )
  })

  test("suppresses only the click that ends a confirmed drag", () => {
    const dragged = attachToFakeContainer()
    let stopped = 0
    const click = { stopPropagation: () => (stopped += 1) }

    dragged.dispatch("pointerdown", pointerEvent({ clientX: 10, clientY: 10 }))
    dragged.dispatch("pointermove", pointerEvent({ clientX: 60, clientY: 10 }))
    dragged.dispatch("pointerup", pointerEvent({ clientX: 60, clientY: 10 }))
    dragged.dispatch("click", click)
    dragged.dispatch("click", click)

    assert.strictEqual(stopped, 1)
    assert.deepStrictEqual(dragged.container.captures, [1])
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
