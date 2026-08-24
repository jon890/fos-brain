import ForceGraph3D from "3d-force-graph"
// @ts-ignore three ships without package-level declarations in this pinned install.
import * as THREE from "three"
import type {
  MemoryAtlasColorBy,
  MemoryAtlasData,
  MemoryAtlasLayout,
  MemoryAtlasNode,
  MemoryAtlasSpacing,
  MemoryAtlasState,
} from "../memoryAtlasData"
import type { FullSlug } from "../../util/path"

type GraphNode = MemoryAtlasNode & {
  x?: number
  y?: number
  z?: number
  fx?: number
  fy?: number
  fz?: number
  __threeObj?: unknown
}

type GraphLink = {
  source: GraphNode | FullSlug
  target: GraphNode | FullSlug
}

type GraphInstance = {
  (container: HTMLElement): GraphInstance
  graphData(data: { nodes: GraphNode[]; links: GraphLink[] }): GraphInstance
  nodeThreeObject(fn: (node: GraphNode) => unknown): GraphInstance
  nodeThreeObjectExtend(value: boolean): GraphInstance
  linkColor(fn: (link: GraphLink) => string): GraphInstance
  linkOpacity(value: number): GraphInstance
  linkWidth(fn: (link: GraphLink) => number): GraphInstance
  nodeColor(fn: (node: GraphNode) => string): GraphInstance
  nodeRelSize(value: number): GraphInstance
  nodeVal(fn: (node: GraphNode) => number): GraphInstance
  backgroundColor(value: string): GraphInstance
  width(value: number): GraphInstance
  height(value: number): GraphInstance
  onNodeClick(fn: (node: GraphNode) => void): GraphInstance
  onEngineStop(fn: () => void): GraphInstance
  cameraPosition(
    position: { x: number; y: number; z: number },
    lookAt?: GraphNode,
    ms?: number,
  ): void
  zoomToFit(ms?: number, padding?: number): void
  pauseAnimation(): void
  _destructor?: () => void
}

type DisposableObject = {
  userData?: Record<string, unknown>
  traverse?: (visitor: (child: DisposableObject) => void) => void
  geometry?: { dispose?: () => void }
  material?:
    | {
        dispose?: () => void
        map?: { dispose?: () => void }
      }
    | Array<{
        dispose?: () => void
        map?: { dispose?: () => void }
      }>
}

const COLORS = {
  concept: "#9ac9ba",
  topic: "#d4875e",
  entity: "#ece3cf",
  unknown: "#7f9693",
  current: "#9ac9ba",
  stale: "#d4875e",
  invalid: "#e8bf68",
  public: "#9ac9ba",
  private: "#b0a2d8",
  dim: "rgba(120, 153, 149, 0.22)",
  link: "rgba(154, 201, 186, 0.34)",
  active: "#ece3cf",
}

function colorFor(node: MemoryAtlasNode, colorBy: MemoryAtlasColorBy): string {
  if (colorBy === "freshness") return COLORS[node.freshness?.state ?? "unknown"]
  if (colorBy === "namespace") return COLORS[node.namespace]
  return COLORS[node.type ?? "unknown"]
}

function linkEndpointSlug(endpoint: GraphLink["source"]): FullSlug {
  return typeof endpoint === "string" ? endpoint : endpoint.slug
}

function linkIsActive(link: GraphLink, selected?: FullSlug): boolean {
  if (!selected) return true
  return linkEndpointSlug(link.source) === selected || linkEndpointSlug(link.target) === selected
}

function activeSlugSet(links: GraphLink[], selected?: FullSlug): Set<FullSlug> | undefined {
  if (!selected) return undefined
  const active = new Set<FullSlug>([selected])
  for (const link of links) {
    const source = linkEndpointSlug(link.source)
    const target = linkEndpointSlug(link.target)
    if (source === selected) active.add(target)
    if (target === selected) active.add(source)
  }
  return active
}

function spacingRadius(spacing: MemoryAtlasSpacing): number {
  if (spacing === "compact") return 72
  if (spacing === "wide") return 190
  return 125
}

function layoutNodes(nodes: GraphNode[], layout: MemoryAtlasLayout, spacing: MemoryAtlasSpacing) {
  const radius = spacingRadius(spacing)
  const tagBuckets = new Map<string, GraphNode[]>()
  const typeBuckets = new Map<string, GraphNode[]>()
  nodes.forEach((node, index) => {
    node.fx = undefined
    node.fy = undefined
    node.fz = undefined
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2
    if (layout === "constellation") {
      node.x = Math.cos(angle) * radius * (0.7 + (index % 5) * 0.11)
      node.y = Math.sin(angle) * radius * (0.7 + (index % 3) * 0.13)
      node.z = ((index % 9) - 4) * 18
    }
    const tag = node.tags[0] ?? "untagged"
    tagBuckets.set(tag, [...(tagBuckets.get(tag) ?? []), node])
    const type = node.type ?? "unknown"
    typeBuckets.set(type, [...(typeBuckets.get(type) ?? []), node])
  })

  if (layout === "cluster") {
    const buckets = [...tagBuckets.values()]
    buckets.forEach((bucket, bucketIndex) => {
      const centerAngle = (bucketIndex / Math.max(buckets.length, 1)) * Math.PI * 2
      const centerX = Math.cos(centerAngle) * radius
      const centerY = Math.sin(centerAngle) * radius
      bucket.forEach((node, index) => {
        const angle = (index / Math.max(bucket.length, 1)) * Math.PI * 2
        node.fx = centerX + Math.cos(angle) * radius * 0.28
        node.fy = centerY + Math.sin(angle) * radius * 0.28
        node.fz = ((index % 5) - 2) * 18
      })
    })
  }

  if (layout === "orbit") {
    const order = ["topic", "concept", "entity", "unknown"]
    nodes.forEach((node, index) => {
      const ring = Math.max(order.indexOf(node.type ?? "unknown"), 0)
      const peers = typeBuckets.get(node.type ?? "unknown") ?? nodes
      const peerIndex = peers.findIndex((peer) => peer.slug === node.slug)
      const angle = (peerIndex / Math.max(peers.length, 1)) * Math.PI * 2 + ring * 0.42
      const orbitRadius = radius * (0.55 + ring * 0.38)
      node.fx = Math.cos(angle) * orbitRadius
      node.fy = Math.sin(angle) * orbitRadius
      node.fz = (ring - 1) * 42 + ((index % 3) - 1) * 10
    })
  }
}

function createLabel(text: string, color: string) {
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")!
  const size = 256
  canvas.width = size
  canvas.height = 64
  context.font = "600 24px IBM Plex Sans KR, sans-serif"
  context.fillStyle = "rgba(7, 25, 27, 0.72)"
  context.fillRect(0, 0, size, 64)
  context.fillStyle = color
  context.fillText(text.slice(0, 18), 14, 40)
  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(56, 14, 1)
  sprite.position.set(0, 12, 0)
  return sprite
}

function createNodeObject(
  node: GraphNode,
  state: MemoryAtlasState,
  activeSlugs: Set<FullSlug> | undefined,
) {
  const group = new THREE.Group()
  const radius = Math.max(4, Math.min(11, 4 + node.degree * 1.4 + node.sourceCount * 0.45))
  const isDimmed = Boolean(activeSlugs && !activeSlugs.has(node.slug))
  const material = new THREE.MeshBasicMaterial({
    color: colorFor(node, state.colorBy),
    transparent: true,
    opacity: isDimmed ? 0.16 : 0.96,
  })
  group.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 18), material))
  if (state.selectedSlug === node.slug) {
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 3, 0.45, 8, 64),
      new THREE.MeshBasicMaterial({ color: COLORS.active, transparent: true, opacity: 0.72 }),
    )
    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 7, 0.32, 8, 72),
      new THREE.MeshBasicMaterial({
        color: COLORS.topic,
        transparent: true,
        opacity: 0.58,
      }),
    )
    innerRing.rotation.x = Math.PI / 2
    outerRing.rotation.y = Math.PI / 2
    innerRing.userData = { orbitRing: true, orbitSpeed: 0.012 }
    outerRing.userData = { orbitRing: true, orbitSpeed: -0.008 }
    group.add(innerRing, outerRing)
  }
  if (state.labels) group.add(createLabel(node.title, colorFor(node, state.colorBy)))
  return group
}

function disposeObject(object: DisposableObject) {
  object.traverse?.((child) => {
    child.geometry?.dispose?.()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materials) {
      material?.map?.dispose?.()
      material?.dispose?.()
    }
  })
}

function cloneData(data: MemoryAtlasData, state: MemoryAtlasState) {
  const nodes = data.nodes.map((node) => ({ ...node })) as GraphNode[]
  layoutNodes(nodes, state.layout, state.spacing)
  return {
    nodes,
    links: data.links.map((link) => ({ ...link })),
  }
}

export function mountMemoryAtlas({
  container,
  data,
  state,
  onSelect,
}: {
  container: HTMLElement
  data: MemoryAtlasData
  state: MemoryAtlasState
  onSelect: (slug: FullSlug) => void
}) {
  container.replaceChildren()
  let currentState = state
  let currentData = cloneData(data, currentState)
  let destroyed = false
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
  let nodeObjects = new Map<FullSlug, DisposableObject>()
  let initialRecenterDone = false
  let initialRecenterTimer: number | undefined
  let initialRecenterFrame: number | undefined
  const createGraph = ForceGraph3D as unknown as () => GraphInstance
  const cancelInitialRecenter = () => {
    if (initialRecenterTimer !== undefined) {
      window.clearTimeout(initialRecenterTimer)
      initialRecenterTimer = undefined
    }
    if (initialRecenterFrame !== undefined) {
      cancelAnimationFrame(initialRecenterFrame)
      initialRecenterFrame = undefined
    }
  }
  const runInitialRecenter = () => {
    if (destroyed || initialRecenterDone || currentState.selectedSlug) return
    initialRecenterDone = true
    cancelInitialRecenter()
    graph.zoomToFit(motionQuery.matches ? 0 : 500, 48)
  }
  const graph = createGraph()(container)
    .backgroundColor("#07191b")
    .nodeRelSize(4)
    .nodeVal((node) => Math.max(1, 1 + node.degree + node.sourceCount * 0.5))
    .nodeColor((node) => colorFor(node, currentState.colorBy))
    .nodeThreeObjectExtend(false)
    .nodeThreeObject((node) => {
      const object = createNodeObject(
        node,
        currentState,
        activeSlugSet(currentData.links, currentState.selectedSlug),
      )
      nodeObjects.set(node.slug, object)
      return object
    })
    .linkOpacity(0.55)
    .linkWidth((link) => (linkIsActive(link, currentState.selectedSlug) ? 2.2 : 0.8))
    .linkColor((link) =>
      linkIsActive(link, currentState.selectedSlug) ? COLORS.active : COLORS.link,
    )
    .onNodeClick((node) => onSelect(node.slug))
    .onEngineStop(runInitialRecenter)

  const resize = () => {
    const rect = container.getBoundingClientRect()
    graph.width(Math.max(320, Math.floor(rect.width)))
    graph.height(Math.max(320, Math.floor(rect.height)))
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()
  const renderGraphData = (nextData: typeof currentData) => {
    const staleObjects = nodeObjects
    nodeObjects = new Map()
    graph.graphData(nextData)
    for (const object of staleObjects.values()) disposeObject(object)
  }
  renderGraphData(currentData)
  const initialFrame = requestAnimationFrame(() => {
    if (!destroyed) graph.zoomToFit(motionQuery.matches ? 0 : 500, 42)
  })
  initialRecenterTimer = window.setTimeout(() => {
    initialRecenterFrame = requestAnimationFrame(runInitialRecenter)
  }, 900)
  const orbitFrame = () => {
    if (destroyed) return
    if (!motionQuery.matches) {
      for (const object of nodeObjects.values()) {
        object.traverse?.((child) => {
          if (!child.userData?.orbitRing) return
          const speed = Number(child.userData.orbitSpeed ?? 0)
          const rotationTarget = child as DisposableObject & { rotation?: { z: number } }
          if (rotationTarget.rotation) rotationTarget.rotation.z += speed
        })
      }
    }
    requestAnimationFrame(orbitFrame)
  }
  const orbitAnimation = requestAnimationFrame(orbitFrame)

  const apply = (nextData: MemoryAtlasData, nextState: MemoryAtlasState) => {
    if (destroyed) return
    currentState = nextState
    currentData = cloneData(nextData, currentState)
    renderGraphData(currentData)
  }

  return {
    update(nextData: MemoryAtlasData, nextState: MemoryAtlasState) {
      apply(nextData, nextState)
    },
    select(slug?: FullSlug) {
      if (destroyed) return
      if (slug) cancelInitialRecenter()
      currentState = { ...currentState, selectedSlug: slug }
      renderGraphData(currentData)
      const selected = currentData.nodes.find((node) => node.slug === slug)
      if (selected) {
        const distance = 145
        const ratio = 1 + distance / Math.hypot(selected.x ?? 1, selected.y ?? 1, selected.z ?? 1)
        graph.cameraPosition(
          {
            x: (selected.x ?? 0) * ratio,
            y: (selected.y ?? 0) * ratio,
            z: (selected.z ?? 0) * ratio + distance,
          },
          selected,
          motionQuery.matches ? 0 : 650,
        )
      }
    },
    recenter() {
      if (destroyed) return
      graph.zoomToFit(motionQuery.matches ? 0 : 500, 48)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      cancelAnimationFrame(initialFrame)
      cancelInitialRecenter()
      cancelAnimationFrame(orbitAnimation)
      observer.disconnect()
      graph.pauseAnimation()
      graph._destructor?.()
      for (const object of nodeObjects.values()) disposeObject(object)
      nodeObjects.clear()
      container.replaceChildren()
    },
  }
}
