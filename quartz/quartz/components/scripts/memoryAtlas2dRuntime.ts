import {
  buildMemoryAtlasWeightedEdges,
  calculateWikiHopDepth,
  layoutMemoryAtlasGraph,
  layoutMemoryAtlasLocalGraph,
} from "../memoryAtlasGraph"
import type {
  MemoryAtlasData,
  MemoryAtlasLink,
  MemoryAtlasNode,
  MemoryAtlasState,
} from "../memoryAtlasData"
import type { MemoryAtlasSemanticEdge } from "../memoryAtlasSemantics"
import type { FullSlug } from "../../util/path"
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

const SVG_NS = "http://www.w3.org/2000/svg"
const DEFAULT_WIDTH = 1200
const DEFAULT_HEIGHT = 800

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
): MemoryAtlas2dScene {
  const width = Math.max(320, Math.floor(metrics.width ?? DEFAULT_WIDTH))
  const height = Math.max(320, Math.floor(metrics.height ?? DEFAULT_HEIGHT))
  const weightedEdges = buildMemoryAtlasWeightedEdges(data, semanticEdges)
  const globalPositions = layoutMemoryAtlasGraph(data, weightedEdges, { width, height })
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
        x: position?.x ?? global?.x ?? width / 2,
        y: position?.y ?? global?.y ?? height / 2,
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
    button.type = "button"
    button.textContent = node.title
    button.dataset.slug = node.slug
    button.dataset.selected = String(node.selected)
    button.dataset.related = String(node.related)
    button.dataset.depth = typeof node.depth === "number" ? String(node.depth) : "unrelated"
    button.dataset.namespace = node.namespace
    button.style.left = `${(node.x / scene.width) * 100}%`
    button.style.top = `${(node.y / scene.height) * 100}%`
    button.style.opacity = String(node.labelOpacity)
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
  const root = document.createElement("div")
  root.className = "memory-atlas-2d"
  root.dataset.mode = scene.mode

  const svg = renderSvg(scene)
  const nodes = renderNodeLayer(scene, onSelect)
  for (const button of nodes.querySelectorAll<HTMLButtonElement>("button")) {
    button.dataset.evidence = String(evidenceSlugs.has(button.dataset.slug as FullSlug))
  }

  root.append(svg, nodes)
  container.replaceChildren(root)
  container.dataset.runtimeMode = "2d"
  container.dataset.nodeCount = String(scene.nodes.length)
  container.dataset.linkCount = String(scene.links.length)
  container.dataset.evidenceCount = String(evidenceSlugs.size)
  container.dataset.selectedTitle = scene.selectedTitle ?? ""
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
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
  const observer = new ResizeObserver(() => render())

  const renderNow = () => {
    if (destroyed) return
    const scene = buildMemoryAtlas2dScene(
      currentData,
      currentState,
      currentContext.semanticEdges ?? [],
      measure(container),
    )
    renderScene(container, scene, evidenceSlugs, onSelect)
  }

  const render = () => {
    if (destroyed) return
    if (motionQuery.matches) {
      renderNow()
      return
    }
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
      currentData = nextData
      currentState = nextState
      currentContext = nextContext ?? currentContext
      render()
    },
    select(slug?: FullSlug) {
      currentState = { ...currentState, selectedSlug: slug }
      render()
    },
    recenter() {
      if (!destroyed) container.querySelector<HTMLElement>("[data-selected='true']")?.focus()
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
      delete container.dataset.runtimeMode
      delete container.dataset.nodeCount
      delete container.dataset.linkCount
      delete container.dataset.evidenceCount
      delete container.dataset.selectedTitle
      container.replaceChildren()
    },
  }
}
