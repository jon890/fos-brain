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
  cameraPosition(): { x: number; y: number; z: number }
  cameraPosition(
    position: { x: number; y: number; z: number },
    lookAt?: GraphNode,
    ms?: number,
  ): void
  controls(): { target: { x: number; y: number; z: number } }
  zoomToFit(ms?: number, padding?: number): void
  pauseAnimation(): void
  _destructor?: () => void
}

type StoredView = {
  camera: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  viewport: { width: number; height: number }
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
  concept: "#b6eee0",
  topic: "#ff9866",
  entity: "#fff4d6",
  unknown: "#86b8c6",
  current: "#b6eee0",
  stale: "#ff9866",
  invalid: "#f1c97a",
  public: "#b6eee0",
  private: "#c8a6ff",
  dim: "rgba(120, 153, 149, 0.22)",
  link: "rgba(154, 201, 186, 0.34)",
  active: "#ece3cf",
  evidence: "#5cc8b2",
}
const VIEW_STORAGE_KEY = "memoryAtlasView"

function restoreStoredView(): StoredView | undefined {
  try {
    const raw = window.sessionStorage.getItem(VIEW_STORAGE_KEY)
    if (!raw) return undefined
    const stored = JSON.parse(raw) as StoredView
    const values = [
      stored.camera?.x,
      stored.camera?.y,
      stored.camera?.z,
      stored.target?.x,
      stored.target?.y,
      stored.target?.z,
      stored.viewport?.width,
      stored.viewport?.height,
    ]
    if (!values.every((value) => Number.isFinite(value))) return undefined
    const storedAspect = stored.viewport.width / stored.viewport.height
    const currentAspect = window.innerWidth / window.innerHeight
    return Math.abs(storedAspect - currentAspect) <= 0.18 ? stored : undefined
  } catch {
    return undefined
  }
}

function storeView(graph: GraphInstance) {
  try {
    const camera = graph.cameraPosition()
    const target = graph.controls().target
    window.sessionStorage.setItem(
      VIEW_STORAGE_KEY,
      JSON.stringify({
        camera: { x: camera.x, y: camera.y, z: camera.z },
        target: { x: target.x, y: target.y, z: target.z },
        viewport: { width: window.innerWidth, height: window.innerHeight },
      } satisfies StoredView),
    )
  } catch {
    // The atlas still works when session storage or controls are unavailable.
  }
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

function linkIsEvidence(link: GraphLink, evidenceSlugs: ReadonlySet<FullSlug>): boolean {
  return (
    evidenceSlugs.has(linkEndpointSlug(link.source)) ||
    evidenceSlugs.has(linkEndpointSlug(link.target))
  )
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
  if (spacing === "compact") return 145
  if (spacing === "wide") return 360
  return 245
}

function stableUnit(value: string, salt: number): number {
  let hash = 2166136261 ^ salt
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 0xffffffff
}

function layoutNodes(nodes: GraphNode[], layout: MemoryAtlasLayout, spacing: MemoryAtlasSpacing) {
  const radius = spacingRadius(spacing)
  const constellationCenters = [
    { x: -0.64, y: -0.58 },
    { x: -0.18, y: 0.18 },
    { x: 0.38, y: 0.62 },
    { x: 0.62, y: -0.36 },
  ]
  const tagBuckets = new Map<string, GraphNode[]>()
  const typeBuckets = new Map<string, GraphNode[]>()
  nodes.forEach((node) => {
    node.fx = undefined
    node.fy = undefined
    node.fz = undefined
    const angle = stableUnit(node.slug, 17) * Math.PI * 2
    if (layout === "constellation") {
      const cluster =
        constellationCenters[
          Math.floor(stableUnit(node.tags[0] ?? node.slug, 43) * constellationCenters.length)
        ]
      const distance = Math.sqrt(stableUnit(node.slug, 73)) * radius * 0.5
      const drift = (stableUnit(node.slug, 131) - 0.5) * radius * 0.22
      node.fx = cluster.x * radius + Math.cos(angle) * distance * 1.18 + drift
      node.fy = cluster.y * radius + Math.sin(angle) * distance - drift * 0.22
      node.fz = (stableUnit(node.slug, 211) - 0.5) * radius * 0.56
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
  context.font = "500 18px IBM Plex Sans KR, sans-serif"
  context.fillStyle = "rgba(3, 11, 17, 0.38)"
  context.fillRect(0, 0, size, 64)
  context.fillStyle = color
  context.fillText(text.slice(0, 18), 12, 38)
  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(42, 10.5, 1)
  sprite.position.set(0, 9, 0)
  return sprite
}

function createGlow(color: string, scale: number, opacity: number) {
  const canvas = document.createElement("canvas")
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext("2d")!
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 31)
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.98)")
  gradient.addColorStop(0.13, color)
  gradient.addColorStop(0.42, `${color}55`)
  gradient.addColorStop(1, `${color}00`)
  context.fillStyle = gradient
  context.fillRect(0, 0, 64, 64)
  const texture = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, opacity, depthWrite: false }),
  )
  sprite.scale.set(scale, scale, 1)
  return sprite
}

function createEchoes(node: GraphNode, color: string, isDimmed: boolean) {
  const echoCount = 3
  const positions = new Float32Array(echoCount * 3)
  for (let index = 0; index < echoCount; index += 1) {
    const angle = stableUnit(node.slug, 307 + index) * Math.PI * 2
    const distance = 5 + stableUnit(node.slug, 401 + index) * 9
    positions[index * 3] = Math.cos(angle) * distance
    positions[index * 3 + 1] = Math.sin(angle) * distance
    positions[index * 3 + 2] = (stableUnit(node.slug, 503 + index) - 0.5) * 5
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color,
      opacity: isDimmed ? 0.025 : 0.2,
      size: 0.72,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
    }),
  )
}

function createNodeObject(
  node: GraphNode,
  state: MemoryAtlasState,
  activeSlugs: Set<FullSlug> | undefined,
  evidenceSlugs: ReadonlySet<FullSlug>,
) {
  const group = new THREE.Group()
  const radius = Math.max(
    0.52,
    Math.min(2.2, 0.52 + Math.sqrt(Math.max(node.degree, 0)) * 0.23 + node.sourceCount * 0.035),
  )
  const isDimmed = Boolean(activeSlugs && !activeSlugs.has(node.slug))
  const color = colorFor(node, state.colorBy)
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: isDimmed ? 0.16 : 0.96,
  })
  group.add(createGlow(color, Math.max(5.4, radius * 7.8), isDimmed ? 0.04 : 0.48))
  group.add(createEchoes(node, color, isDimmed))
  group.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 18), material))
  if (state.selectedSlug === node.slug) {
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 2.4, 0.32, 8, 64),
      new THREE.MeshBasicMaterial({ color: COLORS.active, transparent: true, opacity: 0.72 }),
    )
    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 5.2, 0.24, 8, 72),
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
  if (evidenceSlugs.has(node.slug)) {
    const evidenceRing = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 3.7, 0.22, 8, 72),
      new THREE.MeshBasicMaterial({ color: COLORS.evidence, transparent: true, opacity: 0.82 }),
    )
    evidenceRing.rotation.x = Math.PI / 2
    group.add(evidenceRing)
    group.add(createGlow(COLORS.evidence, Math.max(7.2, radius * 9.2), isDimmed ? 0.12 : 0.62))
  }
  const shouldLabel =
    state.labels &&
    !isDimmed &&
    (state.selectedSlug === node.slug || node.degree >= 28 || node.sourceCount >= 10)
  if (shouldLabel) group.add(createLabel(node.title, colorFor(node, state.colorBy)))
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
  let evidenceSlugs = new Set<FullSlug>()
  let destroyed = false
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
  let nodeObjects = new Map<FullSlug, DisposableObject>()
  let initialRecenterDone = false
  let initialRecenterTimer: number | undefined
  let initialRecenterFrame: number | undefined
  let resizeTimer: number | undefined
  let previousAspect = window.innerWidth / window.innerHeight
  const storedView = restoreStoredView()
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
  const zoomToImmersiveFit = (ms: number) => {
    graph.zoomToFit(ms, window.innerWidth <= 800 ? 6 : 0)
    const tighten = () => {
      if (destroyed) return
      const camera = graph.cameraPosition()
      const target = graph.controls().target
      const factor = window.innerWidth <= 800 ? 0.44 : 0.58
      graph.cameraPosition(
        {
          x: target.x + (camera.x - target.x) * factor,
          y: target.y + (camera.y - target.y) * factor,
          z: target.z + (camera.z - target.z) * factor,
        },
        target as GraphNode,
        motionQuery.matches ? 0 : 180,
      )
    }
    if (ms > 0) window.setTimeout(tighten, ms + 24)
    else requestAnimationFrame(tighten)
  }
  const runInitialRecenter = () => {
    if (destroyed || initialRecenterDone || currentState.selectedSlug) return
    initialRecenterDone = true
    cancelInitialRecenter()
    zoomToImmersiveFit(motionQuery.matches ? 0 : 420)
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
        evidenceSlugs,
      )
      nodeObjects.set(node.slug, object)
      return object
    })
    .linkOpacity(0.3)
    .linkWidth((link) =>
      linkIsEvidence(link, evidenceSlugs)
        ? 0.62
        : linkIsActive(link, currentState.selectedSlug)
          ? 0.36
          : 0.07,
    )
    .linkColor((link) =>
      linkIsEvidence(link, evidenceSlugs)
        ? COLORS.evidence
        : linkIsActive(link, currentState.selectedSlug)
          ? COLORS.active
          : COLORS.link,
    )
    .onNodeClick((node) => onSelect(node.slug))
    .onEngineStop(runInitialRecenter)

  const resize = () => {
    const rect = container.getBoundingClientRect()
    graph.width(Math.max(320, Math.floor(rect.width)))
    graph.height(Math.max(320, Math.floor(rect.height)))
    const nextAspect = rect.width / Math.max(rect.height, 1)
    if (Math.abs(nextAspect - previousAspect) > 0.18 && !currentState.selectedSlug) {
      if (resizeTimer !== undefined) window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => zoomToImmersiveFit(motionQuery.matches ? 0 : 260), 90)
    }
    previousAspect = nextAspect
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
    if (destroyed) return
    if (storedView) {
      initialRecenterDone = true
      graph.cameraPosition(
        storedView.camera,
        storedView.target as GraphNode,
        motionQuery.matches ? 0 : 320,
      )
      return
    }
    zoomToImmersiveFit(motionQuery.matches ? 0 : 420)
  })
  initialRecenterTimer = window.setTimeout(() => {
    initialRecenterFrame = requestAnimationFrame(runInitialRecenter)
  }, 900)
  const orbitFrame = () => {
    if (destroyed) return
    if (!motionQuery.matches && currentState.selectedSlug) {
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
        const distance = 95
        const selectedX = selected.x ?? selected.fx ?? 0
        const selectedY = selected.y ?? selected.fy ?? 0
        const selectedZ = selected.z ?? selected.fz ?? 0
        const ratio = 1 + distance / Math.hypot(selectedX || 1, selectedY || 1, selectedZ || 1)
        graph.cameraPosition(
          {
            x: selectedX * ratio,
            y: selectedY * ratio,
            z: selectedZ * ratio + distance,
          },
          selected,
          motionQuery.matches ? 0 : 650,
        )
      }
    },
    recenter() {
      if (destroyed) return
      zoomToImmersiveFit(motionQuery.matches ? 0 : 420)
    },
    setEvidenceSlugs(slugs: ReadonlySet<FullSlug>) {
      if (destroyed) return
      evidenceSlugs = new Set(slugs)
      container.dataset.evidenceCount = String(evidenceSlugs.size)
      renderGraphData(currentData)
    },
    destroy() {
      if (destroyed) return
      storeView(graph)
      destroyed = true
      cancelAnimationFrame(initialFrame)
      cancelInitialRecenter()
      cancelAnimationFrame(orbitAnimation)
      if (resizeTimer !== undefined) window.clearTimeout(resizeTimer)
      observer.disconnect()
      delete container.dataset.evidenceCount
      graph.pauseAnimation()
      graph._destructor?.()
      for (const object of nodeObjects.values()) disposeObject(object)
      nodeObjects.clear()
      container.replaceChildren()
    },
  }
}
