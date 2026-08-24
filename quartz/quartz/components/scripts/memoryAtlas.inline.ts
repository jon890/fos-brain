import {
  buildMemoryAtlasData,
  createDefaultMemoryAtlasState,
  deriveMemoryAtlasFacets,
  filterMemoryAtlas,
  type MemoryAtlasData,
  type MemoryAtlasState,
} from "../memoryAtlasData"
import type { FullSlug } from "../../util/path"

type RuntimeModule = {
  mountMemoryAtlas: (options: {
    container: HTMLElement
    data: MemoryAtlasData
    state: MemoryAtlasState
    onSelect: (slug: FullSlug) => void
  }) => {
    update: (data: MemoryAtlasData, state: MemoryAtlasState) => void
    select: (slug?: FullSlug) => void
    recenter: () => void
    destroy: () => void
  }
}

type RuntimeHandle = ReturnType<RuntimeModule["mountMemoryAtlas"]>

const memoryAtlasState = {
  cleanup: undefined as (() => void) | undefined,
}
const BODY_CLASS = "memory-atlas-page"

const TYPE_OPTIONS = ["concept", "topic", "entity"] as const
const FRESHNESS_OPTIONS = ["current", "stale", "invalid"] as const
const NAMESPACE_OPTIONS = ["public", "private"] as const
const DEFAULT_TAGS: string[] = []

function selectedValues(root: ParentNode, name: string): string[] {
  return [...root.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)].map(
    (input) => input.value,
  )
}

function optionValues(root: ParentNode, name: string): string[] {
  return [...root.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)].map(
    (input) => input.value,
  )
}

function allSelectedAsUnrestricted<T extends string>(selected: string[], allValues: readonly T[]) {
  return selected.length === allValues.length ? [] : (selected as T[])
}

function availableNamespaces(root: HTMLElement): readonly (typeof NAMESPACE_OPTIONS)[number][] {
  const fromDom = optionValues(root, "memory-atlas-namespace").filter((value) =>
    NAMESPACE_OPTIONS.includes(value as (typeof NAMESPACE_OPTIONS)[number]),
  )
  if (fromDom.length > 0) return fromDom as (typeof NAMESPACE_OPTIONS)[number][]

  const fromDataset = root.dataset.availableNamespaces
    ?.split(",")
    .filter((value) => NAMESPACE_OPTIONS.includes(value as (typeof NAMESPACE_OPTIONS)[number]))
  return fromDataset?.length
    ? (fromDataset as (typeof NAMESPACE_OPTIONS)[number][])
    : NAMESPACE_OPTIONS
}

function selectedOptions(select: HTMLSelectElement | null): string[] {
  return select ? [...select.selectedOptions].map((option) => option.value) : []
}

function setHidden(element: HTMLElement | null, hidden: boolean) {
  if (element) element.hidden = hidden
}

function setFiltersOpen(root: HTMLElement, open: boolean) {
  root.classList.toggle("memory-atlas--filters-open", open)
  const button = root.querySelector<HTMLButtonElement>('[data-testid="memory-atlas-filter-toggle"]')
  const backdrop = root.querySelector<HTMLButtonElement>('[data-testid="memory-atlas-backdrop"]')
  button?.setAttribute("aria-expanded", String(open))
  button?.setAttribute("aria-label", open ? "탐색 필터 닫기" : "탐색 필터 열기")
  setHidden(backdrop, !open)
}

function setRuntimeState(root: HTMLElement, state: "loading" | "ready" | "error") {
  root.dataset.runtimeState = state
  root.classList.toggle("memory-atlas--ready", state === "ready")
  setHidden(
    root.querySelector<HTMLElement>('[data-testid="memory-atlas-error"]'),
    state !== "error",
  )
}

function formatDate(value?: string): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString().slice(0, 10)
}

function slugUrl(slug: FullSlug): URL {
  const base = new URL(window.location.toString())
  const prefix = base.pathname.endsWith("/") ? base.pathname : base.pathname.replace(/[^/]*$/, "")
  return new URL(`${prefix}${slug}`, base)
}

function navigateToSlug(slug: FullSlug) {
  const url = slugUrl(slug)
  window.spaNavigate(url, false)
}

function updateDetail(root: HTMLElement, data: MemoryAtlasData, slug?: FullSlug) {
  const node = data.nodes.find((candidate) => candidate.slug === slug)
  root.classList.toggle("memory-atlas--detail-open", Boolean(node))

  const setText = (testid: string, text: string) => {
    const element = root.querySelector<HTMLElement>(`[data-testid="${testid}"]`)
    if (element) element.textContent = text
  }

  if (!node) {
    setText("memory-atlas-detail-type", "선택한 기억")
    setText("memory-atlas-detail-title", "노드를 선택하세요")
    setText(
      "memory-atlas-detail-description",
      "그래프나 목록에서 문서를 선택하면 상세 정보가 여기에 표시됩니다.",
    )
    setText("memory-atlas-detail-status", "-")
    setText("memory-atlas-detail-updated", "-")
    setText("memory-atlas-detail-tags", "-")
    setText("memory-atlas-detail-degree", "0 in / 0 out")
    root
      .querySelector<HTMLAnchorElement>('[data-testid="memory-atlas-detail-link"]')
      ?.setAttribute("href", "#")
    return
  }

  const incoming = data.links.filter((link) => link.target === node.slug).length
  const outgoing = data.links.filter((link) => link.source === node.slug).length
  setText("memory-atlas-detail-type", `${node.type ?? "unknown"} · ${node.namespace}`)
  setText("memory-atlas-detail-title", node.title)
  setText("memory-atlas-detail-description", node.description ?? "설명이 없는 문서입니다.")
  setText("memory-atlas-detail-status", node.status ?? node.freshness?.state ?? "-")
  setText("memory-atlas-detail-updated", formatDate(node.updated))
  setText("memory-atlas-detail-tags", node.tags.length ? node.tags.join(", ") : "-")
  setText("memory-atlas-detail-degree", `${incoming} in / ${outgoing} out`)

  const link = root.querySelector<HTMLAnchorElement>('[data-testid="memory-atlas-detail-link"]')
  if (link) {
    link.href = slugUrl(node.slug).toString()
    link.onclick = (event) => {
      event.preventDefault()
      navigateToSlug(node.slug)
    }
  }
}

function updateResults(
  root: HTMLElement,
  data: MemoryAtlasData,
  onSelect: (slug: FullSlug) => void,
) {
  const list = root.querySelector<HTMLOListElement>('[data-testid="memory-atlas-results"]')
  if (!list) return

  list.replaceChildren(
    ...data.nodes.map((node) => {
      const item = document.createElement("li")
      item.dataset.slug = node.slug
      const button = document.createElement("button")
      button.type = "button"
      button.textContent = node.title
      button.dataset.slug = node.slug
      button.addEventListener("click", () => onSelect(node.slug))
      const meta = document.createElement("span")
      meta.textContent = [node.type, node.namespace, node.tags.slice(0, 2).join(", ")]
        .filter(Boolean)
        .join(" · ")
      item.append(button, meta)
      return item
    }),
  )
}

function updateStats(root: HTMLElement, data: MemoryAtlasData) {
  const facets = deriveMemoryAtlasFacets(data)
  const nodeCount = root.querySelector<HTMLElement>('[data-testid="memory-atlas-node-count"]')
  const linkCount = root.querySelector<HTMLElement>('[data-testid="memory-atlas-link-count"]')
  if (nodeCount) nodeCount.textContent = String(facets.total)
  if (linkCount) linkCount.textContent = String(facets.links.total)
  setHidden(root.querySelector<HTMLElement>('[data-testid="memory-atlas-empty"]'), facets.total > 0)
}

function updateTagOptions(root: HTMLElement, data: MemoryAtlasData) {
  const select = root.querySelector<HTMLSelectElement>('[data-testid="memory-atlas-tag-filter"]')
  if (!select) return

  const selected = new Set(selectedOptions(select))
  const tags = [...new Set(data.nodes.flatMap((node) => node.tags))].sort((a, b) =>
    a.localeCompare(b),
  )
  select.replaceChildren(
    ...tags.map((tag) => {
      const option = document.createElement("option")
      option.value = tag
      option.textContent = tag
      option.selected = selected.has(tag)
      return option
    }),
  )
}

function readState(root: HTMLElement, current: MemoryAtlasState): MemoryAtlasState {
  const namespaces = selectedValues(root, "memory-atlas-namespace")
  const types = selectedValues(root, "memory-atlas-type")
  const freshness = selectedValues(root, "memory-atlas-freshness")

  return {
    ...current,
    query: root.querySelector<HTMLInputElement>('[data-testid="memory-atlas-search"]')?.value ?? "",
    namespaces: allSelectedAsUnrestricted(namespaces, availableNamespaces(root)),
    types: allSelectedAsUnrestricted(types, TYPE_OPTIONS),
    freshness: allSelectedAsUnrestricted(freshness, FRESHNESS_OPTIONS),
    tags: selectedOptions(root.querySelector('[data-testid="memory-atlas-tag-filter"]')),
    layout:
      (root.querySelector<HTMLSelectElement>('[data-testid="memory-atlas-layout"]')?.value as
        | MemoryAtlasState["layout"]
        | undefined) ?? current.layout,
    colorBy:
      (root.querySelector<HTMLSelectElement>('[data-testid="memory-atlas-color"]')?.value as
        | MemoryAtlasState["colorBy"]
        | undefined) ?? current.colorBy,
    spacing:
      (root.querySelector<HTMLSelectElement>('[data-testid="memory-atlas-spacing"]')?.value as
        | MemoryAtlasState["spacing"]
        | undefined) ?? current.spacing,
    labels:
      root.querySelector<HTMLInputElement>('[data-testid="memory-atlas-labels"]')?.checked ?? true,
  }
}

function syncControls(root: HTMLElement, state: MemoryAtlasState) {
  root
    .querySelectorAll<HTMLInputElement>('input[name="memory-atlas-namespace"]')
    .forEach((input) => {
      input.checked = state.namespaces?.length
        ? (state.namespaces as readonly string[]).includes(input.value)
        : true
    })
  root.querySelectorAll<HTMLInputElement>('input[name="memory-atlas-type"]').forEach((input) => {
    input.checked = state.types?.length
      ? (state.types as readonly string[]).includes(input.value)
      : true
  })
  root
    .querySelectorAll<HTMLInputElement>('input[name="memory-atlas-freshness"]')
    .forEach((input) => {
      input.checked = state.freshness?.length
        ? (state.freshness as readonly string[]).includes(input.value)
        : true
    })
  const layout = root.querySelector<HTMLSelectElement>('[data-testid="memory-atlas-layout"]')
  const color = root.querySelector<HTMLSelectElement>('[data-testid="memory-atlas-color"]')
  const spacing = root.querySelector<HTMLSelectElement>('[data-testid="memory-atlas-spacing"]')
  const labels = root.querySelector<HTMLInputElement>('[data-testid="memory-atlas-labels"]')
  const tags = root.querySelector<HTMLSelectElement>('[data-testid="memory-atlas-tag-filter"]')
  if (layout) layout.value = state.layout
  if (color) color.value = state.colorBy
  if (spacing) spacing.value = state.spacing
  if (labels) labels.checked = state.labels
  if (tags) {
    const selectedTags = new Set(state.tags ?? DEFAULT_TAGS)
    for (const option of tags.options) {
      option.selected = selectedTags.has(option.value)
    }
  }
}

function resetMemoryAtlasState(root: HTMLElement, data: MemoryAtlasData): MemoryAtlasState {
  const input = root.querySelector<HTMLInputElement>('[data-testid="memory-atlas-search"]')
  if (input) input.value = ""
  const nextState = {
    ...createDefaultMemoryAtlasState(data),
    tags: [],
    query: "",
    selectedSlug: undefined,
  }
  syncControls(root, nextState)
  return nextState
}

async function initMemoryAtlas() {
  memoryAtlasState.cleanup?.()
  memoryAtlasState.cleanup = undefined

  const root = document.querySelector<HTMLElement>('[data-testid="memory-atlas"]')
  if (!root) return

  document.body.classList.add(BODY_CLASS)
  const canvas = root.querySelector<HTMLElement>('[data-testid="memory-atlas-canvas"]')
  const status = root.querySelector<HTMLElement>('[data-testid="memory-atlas-status"]')
  const runtimeSrc = root.dataset.runtimeSrc
  if (!canvas || !runtimeSrc) return

  setRuntimeState(root, "loading")
  root.classList.remove("memory-atlas--filters-open", "memory-atlas--detail-open")
  updateDetail(root, { nodes: [], links: [] })

  let destroyed = false
  let renderHandle: RuntimeHandle | undefined
  let state = createDefaultMemoryAtlasState()
  let fullData: MemoryAtlasData = { nodes: [], links: [] }
  let visibleData: MemoryAtlasData = fullData
  const cleanups: (() => void)[] = []
  const setStatus = (message: string) => {
    if (status) status.textContent = message
  }

  const cleanup = () => {
    if (destroyed) return
    destroyed = true
    if (memoryAtlasState.cleanup === cleanup) {
      memoryAtlasState.cleanup = undefined
    }
    setRuntimeState(root, "loading")
    root.classList.remove("memory-atlas--detail-open")
    setFiltersOpen(root, false)
    document.body.classList.remove(BODY_CLASS)
    renderHandle?.destroy()
    renderHandle = undefined
    for (const fn of cleanups.splice(0)) fn()
  }
  memoryAtlasState.cleanup = cleanup
  window.addCleanup(cleanup)

  const selectNode = (slug?: FullSlug) => {
    state = { ...state, selectedSlug: slug }
    renderHandle?.select(slug)
    updateDetail(root, visibleData, slug)
  }

  const refresh = () => {
    state = readState(root, state)
    visibleData = filterMemoryAtlas(fullData, state)
    updateStats(root, visibleData)
    updateResults(root, visibleData, selectNode)
    renderHandle?.update(visibleData, state)
    if (state.selectedSlug && !visibleData.nodes.some((node) => node.slug === state.selectedSlug)) {
      selectNode(undefined)
    }
    setStatus(`${visibleData.nodes.length}개 문서를 표시하고 있습니다.`)
  }

  try {
    setStatus("콘텐츠 색인을 읽는 중입니다.")
    fullData = buildMemoryAtlasData(await fetchData)
    if (destroyed) return
    state = createDefaultMemoryAtlasState(fullData)
    syncControls(root, state)
    visibleData = filterMemoryAtlas(fullData, state)
    updateTagOptions(root, fullData)
    updateStats(root, visibleData)
    updateResults(root, visibleData, selectNode)

    setStatus("3D 탐색 엔진을 불러오는 중입니다.")
    const runtimeUrl = runtimeSrc
    const runtime = (await import(runtimeUrl)) as RuntimeModule
    if (destroyed) return

    renderHandle = runtime.mountMemoryAtlas({
      container: canvas,
      data: visibleData,
      state,
      onSelect: selectNode,
    })
    setRuntimeState(root, "ready")
    setStatus(`${visibleData.nodes.length}개 문서를 표시하고 있습니다.`)
  } catch (error) {
    if (destroyed) return
    console.error(error)
    setStatus("3D 그래프 초기화에 실패했습니다.")
    const message = root.querySelector<HTMLElement>('[data-testid="memory-atlas-error-message"]')
    if (message) message.textContent = error instanceof Error ? error.message : String(error)
    setRuntimeState(root, "error")
  }

  const bind = <T extends Event>(
    element: EventTarget | null,
    event: string,
    handler: (event: T) => void,
  ) => {
    if (!element) return
    element.addEventListener(event, handler as EventListener)
    cleanups.push(() => element.removeEventListener(event, handler as EventListener))
  }

  bind(root.querySelector('[data-testid="memory-atlas-search"]'), "input", refresh)
  bind(root.querySelector('[data-testid="memory-atlas-tag-filter"]'), "change", refresh)
  for (const selector of [
    'input[name="memory-atlas-type"]',
    'input[name="memory-atlas-freshness"]',
    'input[name="memory-atlas-namespace"]',
    '[data-testid="memory-atlas-layout"]',
    '[data-testid="memory-atlas-color"]',
    '[data-testid="memory-atlas-spacing"]',
    '[data-testid="memory-atlas-labels"]',
  ]) {
    root.querySelectorAll(selector).forEach((element) => bind(element, "change", refresh))
  }

  bind(root.querySelector('[data-testid="memory-atlas-recenter"]'), "click", () =>
    renderHandle?.recenter(),
  )
  bind(root.querySelector('[data-testid="memory-atlas-reset"]'), "click", () => {
    state = resetMemoryAtlasState(root, fullData)
    refresh()
  })
  bind(root.querySelector('[data-testid="memory-atlas-retry"]'), "click", () => {
    void initMemoryAtlas()
  })
  bind(root.querySelector('[data-testid="memory-atlas-detail-close"]'), "click", () =>
    selectNode(undefined),
  )
  bind(root.querySelector('[data-testid="memory-atlas-filter-toggle"]'), "click", (event) => {
    const button = event.currentTarget as HTMLButtonElement
    setFiltersOpen(root, button.getAttribute("aria-expanded") !== "true")
  })
  bind(root.querySelector('[data-testid="memory-atlas-backdrop"]'), "click", () =>
    setFiltersOpen(root, false),
  )
  bind(document as unknown as EventTarget, "keydown", (event: KeyboardEvent) => {
    if (event.key !== "Escape") return
    setFiltersOpen(root, false)
    selectNode(undefined)
  })
}

document.addEventListener("nav", () => {
  void initMemoryAtlas()
})
