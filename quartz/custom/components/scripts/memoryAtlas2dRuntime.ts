import {
  buildMemoryAtlasWeightedEdges,
  calculateWikiHopDepth,
  layoutMemoryAtlasGraph,
  layoutMemoryAtlasLocalGraph,
  type MemoryAtlasNodePosition,
  type MemoryAtlasWeightedEdge,
} from "../memoryAtlasGraph"
import type {
  MemoryAtlasData,
  MemoryAtlasLink,
  MemoryAtlasNode,
  MemoryAtlasState,
} from "../memoryAtlasData"
import type { MemoryAtlasSemanticEdge } from "../memoryAtlasSemantics"
import type { FullSlug } from "../../../quartz/util/path"
import type {
  MemoryAtlasRuntimeContext,
  MemoryAtlasRuntimeHandle,
  MemoryAtlasRuntimeMountOptions,
} from "./memoryAtlasRuntimeTypes"

export type MemoryAtlas2dSceneNode = {
  slug: FullSlug
  title: string
  x: number
  y: number
  globalX: number
  globalY: number
  depth?: number
  selected: boolean
  related: boolean
  namespace: MemoryAtlasNode["namespace"]
  opacity: number
  labelOpacity: number
}

export type MemoryAtlas2dSceneLink = {
  source: FullSlug
  target: FullSlug
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  kind: "wiki" | "semantic"
  opacity: number
}

export type MemoryAtlas2dScene = {
  nodes: MemoryAtlas2dSceneNode[]
  links: MemoryAtlas2dSceneLink[]
  selectedTitle?: string
  mode: "global" | "local"
  width: number
  height: number
}

type RenderMetrics = {
  width: number
  height: number
}

type MemoryAtlas2dGlobalLayout = {
  weightedEdges: MemoryAtlasWeightedEdge[]
  positions: MemoryAtlasNodePosition[]
}

const SVG_NS = "http://www.w3.org/2000/svg"
const DEFAULT_WIDTH = 1200
const DEFAULT_HEIGHT = 800
const VIEWPORT_SELECTOR = ".memory-atlas-2d__viewport"
const MIN_SCALE = 0.4
const MAX_SCALE = 4
const DRAG_THRESHOLD_PX = 4
const WHEEL_SCALE_STEP = 0.0015
const WHEEL_LINE_HEIGHT_PX = 16

export type MemoryAtlas2dViewport = {
  x: number
  y: number
  k: number
}

export const MEMORY_ATLAS_2D_INITIAL_VIEWPORT: Readonly<MemoryAtlas2dViewport> = Object.freeze({
  x: 0,
  y: 0,
  k: 1,
})

export function clampMemoryAtlas2dScale(scale: number): number {
  if (Number.isNaN(scale)) return MEMORY_ATLAS_2D_INITIAL_VIEWPORT.k
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

/**
 * Firefox 는 줄 단위(`deltaMode` 1)로 한 칸에 3 전후를 준다.
 * 픽셀 단위(`deltaMode` 0)의 100 전후를 전제로 계산하면 그 브라우저에서 배율이 거의 움직이지 않는다.
 */
export function normalizeWheelDelta(
  deltaY: number,
  deltaMode: number,
  containerHeight: number,
): number {
  if (deltaMode === 1) return deltaY * WHEEL_LINE_HEIGHT_PX
  if (deltaMode === 2) return deltaY * containerHeight
  return deltaY
}

export function memoryAtlas2dViewportTransform(viewport: MemoryAtlas2dViewport): string {
  return `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.k})`
}

export function panMemoryAtlas2dViewport(
  viewport: MemoryAtlas2dViewport,
  deltaX: number,
  deltaY: number,
): MemoryAtlas2dViewport {
  return { x: viewport.x + deltaX, y: viewport.y + deltaY, k: viewport.k }
}

/**
 * 포인터 아래의 장면 좌표를 그 자리에 고정한 채 배율만 바꾼다.
 * `pointerX`, `pointerY` 는 컨테이너 왼쪽 위를 기준으로 한 좌표다.
 */
export function zoomMemoryAtlas2dViewport(
  viewport: MemoryAtlas2dViewport,
  deltaY: number,
  pointerX: number,
  pointerY: number,
): MemoryAtlas2dViewport {
  return scaleMemoryAtlas2dViewport(
    viewport,
    Math.exp(-deltaY * WHEEL_SCALE_STEP),
    pointerX,
    pointerY,
  )
}

/**
 * 기준점의 장면 좌표를 그 자리에 고정한 채 배율에 `factor` 를 곱한다.
 * 휠과 배율 버튼이 같은 계산을 쓰도록 떼어낸 함수다.
 */
export function scaleMemoryAtlas2dViewport(
  viewport: MemoryAtlas2dViewport,
  factor: number,
  anchorX: number,
  anchorY: number,
): MemoryAtlas2dViewport {
  const scale = clampMemoryAtlas2dScale(viewport.k * factor)
  const ratio = scale / viewport.k
  return {
    x: anchorX - (anchorX - viewport.x) * ratio,
    y: anchorY - (anchorY - viewport.y) * ratio,
    k: scale,
  }
}

/**
 * 배율은 그대로 두고 장면 중심이 화면 중앙에 오도록 이동만 맞춘다.
 * 배치가 다시 계산되는 경로는 선택 노드를 장면 중앙에 두므로 이 계산이 선택 노드를 화면 중앙에 놓는다.
 */
export function centerMemoryAtlas2dViewport(
  viewport: MemoryAtlas2dViewport,
  width: number,
  height: number,
): MemoryAtlas2dViewport {
  return {
    x: (width - width * viewport.k) / 2,
    y: (height - height * viewport.k) / 2,
    k: viewport.k,
  }
}

/**
 * 래퍼는 매 렌더마다 새로 만들어지므로 호출할 때마다 다시 찾는다.
 * mount 시점에 참조를 캐시하면 첫 재렌더에서 이동값이 화면에 반영되지 않는다.
 */
export function applyMemoryAtlas2dViewport(
  container: HTMLElement,
  viewport: MemoryAtlas2dViewport,
): HTMLElement | null {
  const wrapper = container.querySelector<HTMLElement>(VIEWPORT_SELECTOR)
  if (wrapper) wrapper.style.transform = memoryAtlas2dViewportTransform(viewport)
  return wrapper
}

export type MemoryAtlas2dLayoutInputs = {
  data: MemoryAtlasData
  state: MemoryAtlasState
  semanticEdges?: readonly MemoryAtlasSemanticEdge[]
}

/**
 * 노드 좌표를 정하는 입력만 모아 문자열 하나로 만든다.
 * controller 의 `refresh` 는 filter 결과를 매번 새 객체로 만들어, 참조 비교로는 라벨 토글도 배치 변경으로 읽힌다.
 */
export function memoryAtlas2dLayoutSignature({
  data,
  state,
  semanticEdges = [],
}: MemoryAtlas2dLayoutInputs): string {
  return [
    state.layout,
    state.spacing,
    state.selectedSlug ?? "",
    data.nodes.map((node) => node.slug).join(","),
    data.links.map((link) => `${link.source}>${link.target}`).join(","),
    semanticEdges.map((edge) => `${edge.source}>${edge.target}:${edge.score}`).join(","),
  ].join("|")
}

/**
 * 노드 좌표를 다시 계산하게 만드는 입력이 바뀌었는지 본다.
 * 여기가 참이면 이전 이동값이 가리키던 자리가 사라지므로 이동을 다시 맞춘다.
 */
export function affectsMemoryAtlas2dLayout(
  previous: MemoryAtlas2dLayoutInputs,
  next: MemoryAtlas2dLayoutInputs,
): boolean {
  return memoryAtlas2dLayoutSignature(previous) !== memoryAtlas2dLayoutSignature(next)
}

export type MemoryAtlas2dViewportControlsOptions = {
  container: HTMLElement
  getViewport: () => MemoryAtlas2dViewport
  setViewport: (viewport: MemoryAtlas2dViewport) => void
  /** 드래그 중의 pointer event 를 받을 대상. 기본은 컨테이너가 속한 window 다. */
  moveTarget?: EventTarget
}

/**
 * 이동과 배율 조작을 컨테이너에 한 번만 배선하고 해제 함수를 돌려준다.
 * 렌더마다 등록하면 handler 가 쌓여 한 번의 드래그가 배수로 움직인다.
 */
export function attachMemoryAtlas2dViewportControls({
  container,
  getViewport,
  setViewport,
  moveTarget,
}: MemoryAtlas2dViewportControlsOptions): () => void {
  const moveHost = moveTarget ?? container.ownerDocument?.defaultView ?? container
  const wheelOptions: AddEventListenerOptions = { passive: false }
  const clickOptions: AddEventListenerOptions = { capture: true }
  let activePointerId: number | undefined
  let captured = false
  let dragging = false
  let suppressNextClick = false
  let startX = 0
  let startY = 0
  let lastX = 0
  let lastY = 0

  const releaseCapture = () => {
    if (!captured || activePointerId === undefined) return
    captured = false
    try {
      container.releasePointerCapture?.(activePointerId)
    } catch {
      // 합성 pointer event 는 활성 포인터가 아니라 해제가 실패할 수 있다.
    }
  }

  const endDrag = (suppressClick: boolean) => {
    releaseCapture()
    suppressNextClick = suppressClick
    activePointerId = undefined
    dragging = false
    // 호환 click 은 pointerup 직후 같은 작업에서 오므로 억제가 유효하다.
    // 다음 작업에서 풀지 않으면 키보드로 노드를 고르는 click 을 한 번 삼킨다.
    if (suppressClick) {
      setTimeout(() => {
        suppressNextClick = false
      }, 0)
    }
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button > 0) return
    // 진행 중인 드래그를 두 번째 포인터가 가로채면 capture 대상과 억제 상태가 어긋난다.
    if (activePointerId !== undefined) return
    suppressNextClick = false
    activePointerId = event.pointerId
    dragging = false
    startX = event.clientX
    startY = event.clientY
    lastX = event.clientX
    lastY = event.clientY
  }

  const onPointerMove = (event: PointerEvent) => {
    if (activePointerId === undefined || event.pointerId !== activePointerId) return
    // 확정 전에는 capture 가 없어 창 밖에서 손을 떼면 pointerup 이 도착하지 않는다.
    // 마우스의 pointerId 는 세션 내내 같아, 버튼을 놓은 뒤의 이동이 드래그로 이어질 수 있다.
    if (event.pointerType !== "touch" && event.buttons === 0) {
      endDrag(false)
      return
    }
    if (!dragging) {
      const distance = Math.hypot(event.clientX - startX, event.clientY - startY)
      if (distance < DRAG_THRESHOLD_PX) return
      dragging = true
      // capture 는 드래그로 확정된 뒤에만 건다.
      // pointerdown 즉시 걸면 짧은 탭의 호환 click 이 컨테이너로 재지정돼 노드 선택이 죽는다.
      try {
        container.setPointerCapture?.(event.pointerId)
        captured = true
      } catch {
        // 합성 pointer event 에서는 capture 없이 moveTarget 의 event 로만 처리한다.
      }
    }
    setViewport(
      panMemoryAtlas2dViewport(getViewport(), event.clientX - lastX, event.clientY - lastY),
    )
    lastX = event.clientX
    lastY = event.clientY
  }

  const onPointerUp = (event: PointerEvent) => {
    if (activePointerId === undefined || event.pointerId !== activePointerId) return
    endDrag(dragging)
  }

  const onPointerCancel = (event: PointerEvent) => {
    if (activePointerId === undefined || event.pointerId !== activePointerId) return
    endDrag(false)
  }

  const onClickCapture = (event: Event) => {
    if (!suppressNextClick) return
    suppressNextClick = false
    event.stopPropagation()
  }

  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    const rect = container.getBoundingClientRect()
    setViewport(
      zoomMemoryAtlas2dViewport(
        getViewport(),
        normalizeWheelDelta(event.deltaY, event.deltaMode, rect.height),
        event.clientX - rect.left,
        event.clientY - rect.top,
      ),
    )
  }

  container.addEventListener("pointerdown", onPointerDown)
  container.addEventListener("wheel", onWheel, wheelOptions)
  container.addEventListener("click", onClickCapture, clickOptions)
  moveHost.addEventListener("pointermove", onPointerMove as EventListener)
  moveHost.addEventListener("pointerup", onPointerUp as EventListener)
  moveHost.addEventListener("pointercancel", onPointerCancel as EventListener)

  return () => {
    releaseCapture()
    container.removeEventListener("pointerdown", onPointerDown)
    container.removeEventListener("wheel", onWheel, wheelOptions)
    container.removeEventListener("click", onClickCapture, clickOptions)
    moveHost.removeEventListener("pointermove", onPointerMove as EventListener)
    moveHost.removeEventListener("pointerup", onPointerUp as EventListener)
    moveHost.removeEventListener("pointercancel", onPointerCancel as EventListener)
  }
}

function opacityForDepth(depth: number | undefined, selected: boolean, related: boolean): number {
  if (selected) return 1
  if (depth === 1) return 0.9
  if (depth === 2) return 0.56
  if (typeof depth === "number") return 0.32
  return related ? 0.44 : 0.13
}

function labelOpacityForDepth(depth: number | undefined, selected: boolean, related: boolean) {
  if (selected) return 1
  if (depth === 1) return 0.86
  if (depth === 2) return 0.46
  if (typeof depth === "number") return 0.24
  return related ? 0.34 : 0.16
}

function linkKey(link: Pick<MemoryAtlasLink, "source" | "target">): string {
  return link.source.localeCompare(link.target) <= 0
    ? `${link.source}\u0000${link.target}`
    : `${link.target}\u0000${link.source}`
}

function projectedEdgeOpacity(
  source: MemoryAtlas2dSceneNode | undefined,
  target: MemoryAtlas2dSceneNode | undefined,
  selectedSlug?: FullSlug,
) {
  if (!source || !target) return 0
  if (!selectedSlug) return 0.34
  if (source.selected || target.selected) return 0.78
  if (source.related && target.related) {
    const depth = Math.max(source.depth ?? 3, target.depth ?? 3)
    return depth === 1 ? 0.62 : Math.max(0.18, 0.42 / depth)
  }
  return 0.08
}

export function buildMemoryAtlas2dScene(
  data: MemoryAtlasData,
  state: MemoryAtlasState,
  semanticEdges: readonly MemoryAtlasSemanticEdge[] = [],
  metrics: Partial<RenderMetrics> = {},
  preparedLayout?: MemoryAtlas2dGlobalLayout,
): MemoryAtlas2dScene {
  const width = Math.max(320, Math.floor(metrics.width ?? DEFAULT_WIDTH))
  const height = Math.max(320, Math.floor(metrics.height ?? DEFAULT_HEIGHT))
  const weightedEdges =
    preparedLayout?.weightedEdges ?? buildMemoryAtlasWeightedEdges(data, semanticEdges)
  const globalPositions =
    preparedLayout?.positions ?? layoutMemoryAtlasGraph(data, weightedEdges, { width, height })
  const localPositions = layoutMemoryAtlasLocalGraph(data, globalPositions, state.selectedSlug, {
    width,
    height,
    maxDepth: 3,
  })
  const nodeBySlug = new Map(data.nodes.map((node) => [node.slug, node]))
  const selectedNode = state.selectedSlug ? nodeBySlug.get(state.selectedSlug) : undefined
  const depthBySlug =
    state.selectedSlug && selectedNode
      ? calculateWikiHopDepth(data.links, state.selectedSlug, 3)
      : new Map<FullSlug, number>()
  const globalBySlug = new Map(globalPositions.map((position) => [position.slug, position]))
  const positionBySlug = new Map(localPositions.map((position) => [position.slug, position]))
  const horizontalInset = Math.min(120, width * (width <= 800 ? 0.22 : 0.12))
  const verticalInset = 20

  const nodes = data.nodes
    .map((node) => {
      const position = positionBySlug.get(node.slug)
      const global = globalBySlug.get(node.slug)
      const depth = depthBySlug.get(node.slug)
      const selected = state.selectedSlug === node.slug
      const related = typeof depth === "number"
      return {
        slug: node.slug,
        title: node.title,
        x: Math.min(
          width - horizontalInset,
          Math.max(horizontalInset, position?.x ?? global?.x ?? width / 2),
        ),
        y: Math.min(
          height - verticalInset,
          Math.max(verticalInset, position?.y ?? global?.y ?? height / 2),
        ),
        globalX: global?.x ?? width / 2,
        globalY: global?.y ?? height / 2,
        ...(typeof depth === "number" ? { depth } : {}),
        selected,
        related,
        namespace: node.namespace,
        opacity: opacityForDepth(depth, selected, related),
        labelOpacity: state.labels ? labelOpacityForDepth(depth, selected, related) : 0,
      } satisfies MemoryAtlas2dSceneNode
    })
    .sort((a, b) => a.slug.localeCompare(b.slug))

  const sceneNodeBySlug = new Map(nodes.map((node) => [node.slug, node]))
  const wikiKeys = new Set(data.links.map(linkKey))
  const wikiLinks: MemoryAtlas2dSceneLink[] = data.links
    .map((link) =>
      createSceneLink(link.source, link.target, "wiki", sceneNodeBySlug, state.selectedSlug),
    )
    .filter((link): link is MemoryAtlas2dSceneLink => Boolean(link))
  const semanticLinks: MemoryAtlas2dSceneLink[] = weightedEdges
    .filter((edge) => edge.semanticScore > 0 && !wikiKeys.has(linkKey(edge)))
    .map((edge) =>
      createSceneLink(edge.source, edge.target, "semantic", sceneNodeBySlug, state.selectedSlug),
    )
    .filter((link): link is MemoryAtlas2dSceneLink => Boolean(link))

  return {
    nodes,
    links: [...semanticLinks, ...wikiLinks],
    selectedTitle: selectedNode?.title,
    mode: selectedNode ? "local" : "global",
    width,
    height,
  }
}

function createSceneLink(
  sourceSlug: FullSlug,
  targetSlug: FullSlug,
  kind: "wiki" | "semantic",
  nodeBySlug: ReadonlyMap<FullSlug, MemoryAtlas2dSceneNode>,
  selectedSlug?: FullSlug,
): MemoryAtlas2dSceneLink | undefined {
  const source = nodeBySlug.get(sourceSlug)
  const target = nodeBySlug.get(targetSlug)
  if (!source || !target) return undefined
  return {
    source: sourceSlug,
    target: targetSlug,
    sourceX: source.x,
    sourceY: source.y,
    targetX: target.x,
    targetY: target.y,
    kind,
    opacity:
      kind === "semantic"
        ? Math.min(0.28, projectedEdgeOpacity(source, target, selectedSlug))
        : projectedEdgeOpacity(source, target, selectedSlug),
  }
}

function renderSvg(scene: MemoryAtlas2dScene) {
  const svg = document.createElementNS(SVG_NS, "svg")
  svg.classList.add("memory-atlas-2d__svg")
  svg.setAttribute("viewBox", `0 0 ${scene.width} ${scene.height}`)
  svg.setAttribute("aria-hidden", "true")

  for (const link of scene.links) {
    const line = document.createElementNS(SVG_NS, "line")
    line.classList.add("memory-atlas-2d__link", `memory-atlas-2d__link--${link.kind}`)
    line.setAttribute("x1", String(link.sourceX))
    line.setAttribute("y1", String(link.sourceY))
    line.setAttribute("x2", String(link.targetX))
    line.setAttribute("y2", String(link.targetY))
    line.setAttribute("opacity", String(link.opacity))
    line.dataset.kind = link.kind
    line.dataset.source = link.source
    line.dataset.target = link.target
    svg.append(line)
  }

  return svg
}

function renderNodeLayer(scene: MemoryAtlas2dScene, onSelect: (slug: FullSlug) => void) {
  const layer = document.createElement("div")
  layer.className = "memory-atlas-2d__nodes"

  for (const node of scene.nodes) {
    const button = document.createElement("button")
    const label = document.createElement("span")
    button.type = "button"
    label.className = "memory-atlas-2d__label"
    label.textContent = node.title
    label.style.opacity = String(node.labelOpacity)
    button.append(label)
    button.dataset.slug = node.slug
    button.dataset.selected = String(node.selected)
    button.dataset.related = String(node.related)
    button.dataset.depth = typeof node.depth === "number" ? String(node.depth) : "unrelated"
    button.dataset.namespace = node.namespace
    button.style.left = `${(node.x / scene.width) * 100}%`
    button.style.top = `${(node.y / scene.height) * 100}%`
    button.style.opacity = String(node.opacity)
    button.setAttribute("aria-pressed", String(node.selected))
    button.setAttribute(
      "aria-label",
      `${node.title} · ${node.namespace} · ${
        node.selected ? "현재 중심" : node.related ? `${node.depth} hop 연결` : "선택 관계 밖"
      }`,
    )
    button.addEventListener("click", () => onSelect(node.slug))
    layer.append(button)
  }

  return layer
}

function renderScene(
  container: HTMLElement,
  scene: MemoryAtlas2dScene,
  evidenceSlugs: ReadonlySet<FullSlug>,
  onSelect: (slug: FullSlug) => void,
) {
  const activeSlug =
    document.activeElement instanceof HTMLButtonElement &&
    container.contains(document.activeElement)
      ? document.activeElement.dataset.slug
      : undefined
  const root = document.createElement("div")
  root.className = "memory-atlas-2d"
  root.dataset.mode = scene.mode

  const svg = renderSvg(scene)
  const nodes = renderNodeLayer(scene, onSelect)
  for (const button of nodes.querySelectorAll<HTMLButtonElement>("button")) {
    button.dataset.evidence = String(evidenceSlugs.has(button.dataset.slug as FullSlug))
  }

  const viewport = document.createElement("div")
  viewport.className = "memory-atlas-2d__viewport"
  viewport.append(svg, nodes)
  root.append(viewport)
  container.replaceChildren(root)
  container.dataset.runtimeMode = "2d"
  container.dataset.nodeCount = String(scene.nodes.length)
  container.dataset.linkCount = String(scene.links.length)
  container.dataset.evidenceCount = String(evidenceSlugs.size)
  container.dataset.selectedTitle = scene.selectedTitle ?? ""
  if (activeSlug) {
    const activeButton = [...nodes.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.dataset.slug === activeSlug,
    )
    activeButton?.focus({ preventScroll: true })
  }
}

function measure(container: HTMLElement): RenderMetrics {
  const rect = container.getBoundingClientRect()
  return {
    width: Math.max(320, Math.floor(rect.width || DEFAULT_WIDTH)),
    height: Math.max(320, Math.floor(rect.height || DEFAULT_HEIGHT)),
  }
}

export function mountMemoryAtlas({
  container,
  data,
  state,
  context,
  onSelect,
}: MemoryAtlasRuntimeMountOptions): MemoryAtlasRuntimeHandle {
  let currentData = data
  let currentState = state
  let currentContext: MemoryAtlasRuntimeContext = context ?? {}
  let evidenceSlugs = new Set<FullSlug>()
  let destroyed = false
  let frame: number | undefined
  let viewport: MemoryAtlas2dViewport = { ...MEMORY_ATLAS_2D_INITIAL_VIEWPORT }
  let cachedLayout:
    | (MemoryAtlas2dGlobalLayout & {
        data: MemoryAtlasData
        semanticEdges: readonly MemoryAtlasSemanticEdge[]
        width: number
        height: number
      })
    | undefined
  const observer = new ResizeObserver(() => render())
  const applyViewport = () => applyMemoryAtlas2dViewport(container, viewport)
  const detachViewportControls = attachMemoryAtlas2dViewportControls({
    container,
    getViewport: () => viewport,
    setViewport: (next) => {
      viewport = next
      applyViewport()
    },
  })
  const resetViewport = () => {
    viewport = { ...MEMORY_ATLAS_2D_INITIAL_VIEWPORT }
    applyViewport()
  }
  /**
   * 배치가 다시 계산되는 경로에서 배율을 유지한 채 이동만 새 중심에 맞춘다.
   * 렌더는 rAF 로 미뤄지므로, 여기서 바로 적용해야 호출 직후에 읽는 쪽이 옛 값을 보지 않는다.
   */
  const centerViewport = () => {
    const metrics = measure(container)
    viewport = centerMemoryAtlas2dViewport(viewport, metrics.width, metrics.height)
    applyViewport()
  }

  const prepareLayout = (metrics: RenderMetrics): MemoryAtlas2dGlobalLayout => {
    const semanticEdges = currentContext.semanticEdges ?? []
    if (
      cachedLayout?.data === currentData &&
      cachedLayout.semanticEdges === semanticEdges &&
      cachedLayout.width === metrics.width &&
      cachedLayout.height === metrics.height
    ) {
      return cachedLayout
    }
    const weightedEdges = buildMemoryAtlasWeightedEdges(currentData, semanticEdges)
    cachedLayout = {
      data: currentData,
      semanticEdges,
      width: metrics.width,
      height: metrics.height,
      weightedEdges,
      positions: layoutMemoryAtlasGraph(currentData, weightedEdges, metrics),
    }
    return cachedLayout
  }

  const renderNow = () => {
    if (destroyed) return
    const metrics = measure(container)
    const scene = buildMemoryAtlas2dScene(
      currentData,
      currentState,
      currentContext.semanticEdges ?? [],
      metrics,
      prepareLayout(metrics),
    )
    renderScene(container, scene, evidenceSlugs, onSelect)
    applyViewport()
  }

  const render = () => {
    if (destroyed) return
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      frame = undefined
      renderNow()
    })
  }

  observer.observe(container)
  renderNow()

  return {
    update(
      nextData: MemoryAtlasData,
      nextState: MemoryAtlasState,
      nextContext?: MemoryAtlasRuntimeContext,
    ) {
      const nextSemanticEdges = nextContext?.semanticEdges ?? currentContext.semanticEdges
      const layoutChanged = affectsMemoryAtlas2dLayout(
        { data: currentData, state: currentState, semanticEdges: currentContext.semanticEdges },
        { data: nextData, state: nextState, semanticEdges: nextSemanticEdges },
      )
      currentData = nextData
      currentState = nextState
      currentContext = nextContext ?? currentContext
      if (layoutChanged) centerViewport()
      render()
    },
    select(slug?: FullSlug) {
      currentState = { ...currentState, selectedSlug: slug }
      // 배치가 다시 계산되므로 이전 이동값을 남기면 새 중심이 화면 밖에 있을 수 있다.
      // 배율은 유지하고 이동만 맞춰, 확대한 채 노드를 옮겨 다니는 흐름을 끊지 않는다.
      centerViewport()
      render()
    },
    recenter() {
      if (destroyed) return
      // preventScroll 이 없으면 브라우저가 컨테이너의 scrollLeft, scrollTop 을 바꿔
      // viewport 가 추적하지 않는 오프셋이 생기고 「전체 보기」 로도 돌아오지 않는다.
      container.querySelector<HTMLElement>("[data-selected='true']")?.focus({ preventScroll: true })
    },
    resetViewport() {
      if (!destroyed) resetViewport()
    },
    zoomBy(factor: number) {
      if (destroyed) return
      const rect = container.getBoundingClientRect()
      viewport = scaleMemoryAtlas2dViewport(viewport, factor, rect.width / 2, rect.height / 2)
      applyViewport()
    },
    setEvidenceSlugs(slugs: ReadonlySet<FullSlug>) {
      evidenceSlugs = new Set(slugs)
      render()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      if (frame !== undefined) cancelAnimationFrame(frame)
      observer.disconnect()
      detachViewportControls()
      delete container.dataset.runtimeMode
      delete container.dataset.nodeCount
      delete container.dataset.linkCount
      delete container.dataset.evidenceCount
      delete container.dataset.selectedTitle
      container.replaceChildren()
    },
  }
}
