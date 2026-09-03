import {
  buildMemoryAtlasData,
  clearMemoryAtlasQuery,
  createDefaultMemoryAtlasState,
  deriveMemoryAtlasFacets,
  filterMemoryAtlas,
  restrictMemoryAtlasDataToNamespaces,
  selectMemoryAtlasNode,
  shouldShowMemoryAtlasResults,
  type MemoryAtlasData,
  type MemoryAtlasMode,
  type MemoryAtlasNamespace,
  type MemoryAtlasState,
} from "../memoryAtlasData"
import {
  buildMemoryAtlasWeightedEdges,
  deriveAutomaticMemoryAtlasEntrypoints,
  resolveFixedMemoryAtlasEntrypoints,
  type MemoryAtlasEntrypoint,
} from "../memoryAtlasGraph"
import {
  createEmptyPublishedMemoryAtlasSemantics,
  parsePublishedMemoryAtlasSemantics,
  restrictPublishedMemoryAtlasSemanticsToSlugs,
  type MemoryAtlasSemanticEdge,
} from "../memoryAtlasSemantics"
import type { ContentDetails } from "../../plugins/emitters/contentIndex"
import type { FullSlug } from "../../util/path"
import type {
  MemoryAtlasRuntimeContext,
  MemoryAtlasRuntimeHandle,
  MemoryAtlasRuntimeModule,
  MemoryAtlasRuntimeMountOptions,
} from "./memoryAtlasRuntimeTypes"
import {
  getMemoryAtlasAuthSession,
  isMemoryAtlasUnauthorized,
  loadProtectedMemoryAtlasData,
  loginMemoryAtlasAdmin,
  logoutMemoryAtlasAdmin,
  MemoryAtlasAuthError,
  type MemoryAtlasAuthRole,
  type MemoryAtlasAuthSession,
  type ProtectedMemoryAtlasData,
} from "./memoryAtlasAuth"

type ContentIndexRecord = Record<string, ContentDetails>
type ContentIndexLoader = () => Promise<ContentIndexRecord>
type RuntimeLoader = (mode: MemoryAtlasMode) => Promise<MemoryAtlasRuntimeModule>
type SemanticsLoader = () => Promise<unknown>
type AuthSessionLoader = () => Promise<MemoryAtlasAuthSession>
type AdminLogin = (password: string) => Promise<MemoryAtlasAuthSession>
type AdminLogout = () => Promise<void>
type ProtectedDataLoader = () => Promise<ProtectedMemoryAtlasData>
type InitMemoryAtlasOptions = {
  root?: HTMLElement | null
  loadContentIndex?: ContentIndexLoader
  loadRuntime?: RuntimeLoader
  loadSemantics?: SemanticsLoader
  loadAuthSession?: AuthSessionLoader
  loginAdmin?: AdminLogin
  logoutAdmin?: AdminLogout
  loadProtectedData?: ProtectedDataLoader
}
type AskState = "idle" | "retrieving" | "generating" | "success" | "empty" | "error"
type BrainSource = {
  title: string
  slug: string
  namespace: "public" | "private"
  score: number | null
  excerpt: string
  href: string
}
type BrainAnswer = {
  requestId: string
  answer: string
  sources: BrainSource[]
}
type BrainError = {
  error?: {
    code?: string
    message?: string
    retryable?: boolean
  }
}

const memoryAtlasState = {
  cleanup: undefined as (() => void) | undefined,
}
const BODY_CLASS = "memory-atlas-page"

const TYPE_OPTIONS = ["concept", "topic", "entity"] as const
const FRESHNESS_OPTIONS = ["current", "stale", "invalid"] as const
const NAMESPACE_OPTIONS = ["public", "private"] as const
const DEFAULT_TAGS: string[] = []
const STATE_STORAGE_KEY = "memoryAtlasState"
const LOGIN_RATE_LIMIT_MINUTES = 15

declare const fetchData: Promise<ContentIndexRecord>

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
  return fromDataset?.length ? (fromDataset as (typeof NAMESPACE_OPTIONS)[number][]) : ["public"]
}

function setAvailableNamespaces(root: HTMLElement, namespaces: readonly MemoryAtlasNamespace[]) {
  root.dataset.availableNamespaces = namespaces.join(",")
  const fieldset = root.querySelector<HTMLFieldSetElement>(
    '[data-testid="memory-atlas-namespace-filter"]',
  )
  if (!fieldset) return
  const legend = fieldset.querySelector("legend")
  const labels = namespaces.map((namespace) => {
    const label = document.createElement("label")
    const input = document.createElement("input")
    const text = document.createElement("span")
    input.type = "checkbox"
    input.name = "memory-atlas-namespace"
    input.value = namespace
    input.checked = true
    text.textContent = namespace === "private" ? "비공개" : "공개"
    label.append(input, text)
    return label
  })
  fieldset.replaceChildren(...(legend ? [legend] : []), ...labels)
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

function normalizeSourceSlug(source: BrainSource): FullSlug {
  const slug = source.slug.replace(/^\/+/, "")
  return (
    source.namespace === "private" && !slug.startsWith("_private/") ? `_private/${slug}` : slug
  ) as FullSlug
}

export function sourceHref(
  source: BrainSource,
  slug = normalizeSourceSlug(source),
): string | undefined {
  try {
    const url = new URL(source.href, window.location.origin)
    if (url.origin !== window.location.origin) return undefined
    if (source.namespace === "private") {
      if (!slug.startsWith("_private/")) return undefined
      if (!url.pathname.startsWith("/_private/")) return undefined
      if (decodeURIComponent(url.pathname) !== `/${slug}`) return undefined
    }
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return undefined
  }
}

export function removePrivateMemoryAtlasState(
  state: MemoryAtlasState,
  publicData: MemoryAtlasData,
): MemoryAtlasState {
  const publicSlugs = new Set(publicData.nodes.map((node) => node.slug))
  const publicTags = new Set(publicData.nodes.flatMap((node) => node.tags))
  return {
    ...state,
    namespaces: state.namespaces?.filter((namespace) => namespace !== "private"),
    tags: state.tags?.filter((tag) => publicTags.has(tag)),
    selectedSlug:
      state.selectedSlug && publicSlugs.has(state.selectedSlug) ? state.selectedSlug : undefined,
  }
}

export async function askBrain(question: string, signal: AbortSignal): Promise<BrainAnswer> {
  const response = await fetch("/api/brain/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
    signal,
  })
  const payload = (await response.json().catch(() => ({}))) as BrainAnswer & BrainError
  if (!response.ok) {
    if (response.status === 401) {
      throw new MemoryAtlasAuthError(
        response.status,
        payload.error?.code || "authentication_required",
      )
    }
    const error = new Error(
      payload.error?.message || `Brain question failed with HTTP ${response.status}`,
    )
    Object.assign(error, {
      code: payload.error?.code || "request_failed",
      retryable: payload.error?.retryable ?? response.status !== 400,
    })
    throw error
  }
  return {
    requestId: typeof payload.requestId === "string" ? payload.requestId : "",
    answer: typeof payload.answer === "string" ? payload.answer : "",
    sources: Array.isArray(payload.sources) ? payload.sources : [],
  }
}

function syncSearchInputs(root: HTMLElement, value: string, source?: HTMLInputElement | null) {
  root
    .querySelectorAll<HTMLInputElement>(
      '[data-testid="memory-atlas-search"], [data-testid="memory-atlas-mobile-search"]',
    )
    .forEach((input) => {
      if (input !== source) input.value = value
    })
  root.querySelectorAll<HTMLButtonElement>("[data-memory-atlas-search-clear]").forEach((button) => {
    button.hidden = value.trim().length === 0
  })
}

export function restoreStoredMemoryAtlasState(
  fallback: MemoryAtlasState,
  storage: Pick<Storage, "getItem"> = window.sessionStorage,
): MemoryAtlasState {
  try {
    const raw = storage.getItem(STATE_STORAGE_KEY)
    if (!raw) return fallback
    const stored = JSON.parse(raw) as Partial<MemoryAtlasState>
    return {
      ...fallback,
      ...stored,
      mode: stored.mode === "3d" ? "3d" : fallback.mode,
      namespaces: Array.isArray(stored.namespaces) ? stored.namespaces : fallback.namespaces,
      types: Array.isArray(stored.types) ? stored.types : fallback.types,
      freshness: Array.isArray(stored.freshness) ? stored.freshness : fallback.freshness,
      tags: Array.isArray(stored.tags) ? stored.tags : fallback.tags,
    }
  } catch {
    return fallback
  }
}

function loadContentIndex(): Promise<ContentIndexRecord> {
  return fetchData
}

export function memoryAtlasRuntimeSrcForMode(
  root: Pick<HTMLElement, "getAttribute">,
  mode: MemoryAtlasMode,
): string | undefined {
  return root.getAttribute(`data-runtime-${mode}-src`) ?? undefined
}

function loadRuntimeFromDom(root: HTMLElement): RuntimeLoader {
  return async (mode) => {
    const runtimeUrl = memoryAtlasRuntimeSrcForMode(root, mode)
    if (!runtimeUrl) throw new Error(`${mode} Memory Atlas runtime source is missing`)
    return (await import(runtimeUrl)) as MemoryAtlasRuntimeModule
  }
}

function loadPublishedSemantics(): Promise<unknown> {
  return fetch("/static/memory-atlas-semantics.json").then((response) => {
    if (!response.ok) throw new Error(`Memory Atlas semantics failed with HTTP ${response.status}`)
    return response.json()
  })
}

function buildFallbackMemoryAtlasData(root: HTMLElement): MemoryAtlasData {
  const nodes = [
    ...root.querySelectorAll<HTMLElement>('[data-testid="memory-atlas-results"] li[data-slug]'),
  ].map((item) => {
    const slug = item.dataset.slug as FullSlug
    const title =
      item.querySelector<HTMLElement>("button, a")?.textContent?.trim() ||
      item.querySelector<HTMLElement>("span")?.textContent?.trim() ||
      slug
    return {
      id: slug,
      slug,
      title,
      tags: [],
      namespace: slug.startsWith("_private/") ? ("private" as const) : ("public" as const),
      degree: 0,
      sourceCount: 0,
    }
  })

  return { nodes, links: [] }
}

export async function loadMemoryAtlasDataWithFallback(
  root: HTMLElement,
  loadIndex: ContentIndexLoader,
): Promise<{ data: MemoryAtlasData; fallback: boolean; error?: unknown }> {
  try {
    return { data: buildMemoryAtlasData(await loadIndex()), fallback: false }
  } catch (error) {
    return { data: buildFallbackMemoryAtlasData(root), fallback: true, error }
  }
}

export function createMemoryAtlasRuntimeLifecycle(loadRuntime: RuntimeLoader) {
  let handle: MemoryAtlasRuntimeHandle | undefined
  let destroyed = false
  let mountGeneration = 0

  return {
    async mount(mode: MemoryAtlasMode, mountOptions: MemoryAtlasRuntimeMountOptions) {
      const generation = ++mountGeneration
      handle?.destroy()
      handle = undefined
      const runtime = await loadRuntime(mode)
      if (destroyed || generation !== mountGeneration) return undefined
      handle = runtime.mountMemoryAtlas(mountOptions)
      return handle
    },
    update(data: MemoryAtlasData, state: MemoryAtlasState, context?: MemoryAtlasRuntimeContext) {
      if (destroyed) return
      handle?.update(data, state, context)
    },
    select(slug?: FullSlug) {
      if (destroyed) return
      handle?.select(slug)
    },
    recenter() {
      if (destroyed) return
      handle?.recenter()
    },
    setEvidenceSlugs(slugs: ReadonlySet<FullSlug>) {
      if (destroyed) return
      handle?.setEvidenceSlugs(slugs)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      mountGeneration += 1
      handle?.destroy()
      handle = undefined
    },
  }
}

function storeState(state: MemoryAtlasState) {
  try {
    window.sessionStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Navigation remains functional when storage is unavailable.
  }
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
    const link = root.querySelector<HTMLAnchorElement>('[data-testid="memory-atlas-detail-link"]')
    if (link) link.onclick = null
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
  state: MemoryAtlasState,
  onSelect: (slug: FullSlug) => void,
) {
  const list = root.querySelector<HTMLOListElement>('[data-testid="memory-atlas-results"]')
  if (!list) return
  root.classList.toggle("memory-atlas--results-open", shouldShowMemoryAtlasResults(state))

  list.replaceChildren(
    ...data.nodes.map((node) => {
      const item = document.createElement("li")
      item.dataset.slug = node.slug
      item.dataset.degree = String(node.degree)
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

function updateContextBar(root: HTMLElement, data: MemoryAtlasData, state: MemoryAtlasState) {
  const node = data.nodes.find((candidate) => candidate.slug === state.selectedSlug)
  const title = root.querySelector<HTMLElement>('[data-testid="memory-atlas-context-title"]')
  const clear = root.querySelector<HTMLButtonElement>(
    '[data-testid="memory-atlas-clear-selection"]',
  )
  if (title) title.textContent = node?.title ?? "전체 지도"
  if (clear) clear.hidden = !node
}

function updateFixedEntrypointButton(
  root: HTMLElement,
  entrypoint: MemoryAtlasEntrypoint,
  onSelect: (slug: FullSlug) => void,
) {
  const button = root.querySelector<HTMLButtonElement>(
    `[data-memory-atlas-entrypoint="${entrypoint.id}"]`,
  )
  if (!button) return
  const hint = button.querySelector("small")
  button.disabled = !entrypoint.enabled || !entrypoint.representativeSlug
  button.dataset.slug = entrypoint.representativeSlug ?? ""
  if (hint) {
    hint.textContent = entrypoint.representativeSlug
      ? entrypoint.id === "rag"
        ? `현재 집중 · ${entrypoint.representativeSlug}`
        : entrypoint.representativeSlug
      : "대표 노드 없음"
  }
  button.onclick = () => {
    if (entrypoint.representativeSlug) onSelect(entrypoint.representativeSlug)
  }
  for (const child of entrypoint.children ?? []) {
    updateFixedEntrypointButton(root, child, onSelect)
  }
}

function updateEntrypoints(
  root: HTMLElement,
  data: MemoryAtlasData,
  semanticEdges: readonly MemoryAtlasSemanticEdge[],
  onSelect: (slug: FullSlug) => void,
) {
  const fixed = resolveFixedMemoryAtlasEntrypoints(data)
  for (const entrypoint of fixed) updateFixedEntrypointButton(root, entrypoint, onSelect)

  const fixedSlugs = fixed.flatMap((entrypoint) => [
    ...(entrypoint.representativeSlug ? [entrypoint.representativeSlug] : []),
    ...((entrypoint.children ?? []).flatMap((child) =>
      child.representativeSlug ? [child.representativeSlug] : [],
    ) as FullSlug[]),
  ])
  const weightedEdges = buildMemoryAtlasWeightedEdges(data, semanticEdges)
  const automatic = deriveAutomaticMemoryAtlasEntrypoints(data, weightedEdges, {
    excludeSlugs: fixedSlugs,
  })
  const list = root.querySelector<HTMLOListElement>('[data-testid="memory-atlas-entrypoints-auto"]')
  if (!list) return
  list.replaceChildren(
    ...automatic.map((entrypoint) => {
      const item = document.createElement("li")
      const button = document.createElement("button")
      const meta = document.createElement("small")
      button.type = "button"
      button.textContent = entrypoint.label
      button.dataset.slug = entrypoint.representativeSlug
      button.addEventListener("click", () => onSelect(entrypoint.representativeSlug))
      meta.textContent = `${entrypoint.memberSlugs.length}개 노드 · score ${entrypoint.score}`
      item.append(button, meta)
      return item
    }),
  )
}

function setAskHidden(root: HTMLElement, hidden: boolean) {
  const panel = root.querySelector<HTMLElement>('[data-testid="memory-atlas-ask-panel"]')
  const toggle = root.querySelector<HTMLButtonElement>('[data-testid="memory-atlas-ask-toggle"]')
  if (panel) panel.hidden = hidden
  toggle?.setAttribute("aria-expanded", String(!hidden))
  root.classList.toggle("memory-atlas--ask-open", !hidden)
}

function setQuestionAvailable(root: HTMLElement, available: boolean) {
  const toggle = root.querySelector<HTMLButtonElement>('[data-testid="memory-atlas-ask-toggle"]')
  if (toggle) toggle.hidden = !available
  if (!available) setAskHidden(root, true)
}

function setAuthControls(
  root: HTMLElement,
  state: "checking" | "public" | "loading" | "admin" | "error",
  message: string,
) {
  root.dataset.authState = state
  const status = root.querySelector<HTMLElement>('[data-testid="memory-atlas-auth-status"]')
  const login = root.querySelector<HTMLButtonElement>('[data-testid="memory-atlas-login-open"]')
  const logout = root.querySelector<HTMLButtonElement>('[data-testid="memory-atlas-logout"]')
  if (status) status.textContent = message
  if (login) login.hidden = state === "admin" || state === "loading" || state === "checking"
  if (logout) logout.hidden = state !== "admin"
}

function loginDialog(root: HTMLElement): HTMLDialogElement | null {
  return root.querySelector<HTMLDialogElement>('[data-testid="memory-atlas-login-dialog"]')
}

function openLoginDialog(root: HTMLElement) {
  const dialog = loginDialog(root)
  const input = root.querySelector<HTMLInputElement>('[data-testid="memory-atlas-login-password"]')
  const status = root.querySelector<HTMLElement>('[data-testid="memory-atlas-login-status"]')
  if (!dialog) return
  if (status) status.textContent = "관리자 비밀번호를 입력하세요."
  if (typeof dialog.showModal === "function") dialog.showModal()
  else dialog.setAttribute("open", "")
  input?.focus()
}

function closeLoginDialog(root: HTMLElement) {
  const dialog = loginDialog(root)
  const input = root.querySelector<HTMLInputElement>('[data-testid="memory-atlas-login-password"]')
  if (input) input.value = ""
  if (!dialog) return
  if (typeof dialog.close === "function") dialog.close()
  else dialog.removeAttribute("open")
}

function setLoginStatus(root: HTMLElement, message: string, submitting = false) {
  const status = root.querySelector<HTMLElement>('[data-testid="memory-atlas-login-status"]')
  const submit = root.querySelector<HTMLButtonElement>('[data-testid="memory-atlas-login-submit"]')
  if (status) status.textContent = message
  if (submit) submit.disabled = submitting
}

function loginErrorMessage(error: unknown): string {
  if (error instanceof MemoryAtlasAuthError && error.code === "login_rate_limited") {
    if (error.retryAt) {
      return `로그인 시도가 제한되었습니다. ${error.retryAt.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      })} 이후 다시 시도하세요.`
    }
    return `로그인 시도가 제한되었습니다. ${LOGIN_RATE_LIMIT_MINUTES}분 뒤 다시 시도하세요.`
  }
  if (
    error instanceof MemoryAtlasAuthError &&
    (error.code === "invalid_credentials" || error.code === "invalid_login")
  ) {
    return "로그인 정보를 확인할 수 없습니다. 다시 입력하세요."
  }
  return "로그인 요청을 처리하지 못했습니다. 잠시 뒤 다시 시도하세요."
}

function focusFirstInAskPanel(root: HTMLElement) {
  root.querySelector<HTMLTextAreaElement>('[data-testid="memory-atlas-ask-question"]')?.focus()
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
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
  const query =
    root.querySelector<HTMLInputElement>('[data-testid="memory-atlas-search"]')?.value ??
    root.querySelector<HTMLInputElement>('[data-testid="memory-atlas-mobile-search"]')?.value ??
    ""

  return {
    ...current,
    query,
    namespaces: allSelectedAsUnrestricted(namespaces, availableNamespaces(root)),
    types: allSelectedAsUnrestricted(types, TYPE_OPTIONS),
    freshness: allSelectedAsUnrestricted(freshness, FRESHNESS_OPTIONS),
    tags: selectedOptions(root.querySelector('[data-testid="memory-atlas-tag-filter"]')),
    mode:
      root.querySelector<HTMLSelectElement>('[data-testid="memory-atlas-mode"]')?.value === "3d"
        ? "3d"
        : "2d",
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
  syncSearchInputs(root, state.query)
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
  const mode = root.querySelector<HTMLSelectElement>('[data-testid="memory-atlas-mode"]')
  const color = root.querySelector<HTMLSelectElement>('[data-testid="memory-atlas-color"]')
  const spacing = root.querySelector<HTMLSelectElement>('[data-testid="memory-atlas-spacing"]')
  const labels = root.querySelector<HTMLInputElement>('[data-testid="memory-atlas-labels"]')
  const tags = root.querySelector<HTMLSelectElement>('[data-testid="memory-atlas-tag-filter"]')
  if (mode) mode.value = state.mode
  root.querySelectorAll<HTMLButtonElement>("[data-memory-atlas-mode-button]").forEach((button) => {
    const active = button.dataset.memoryAtlasModeButton === state.mode
    button.setAttribute("aria-pressed", String(active))
  })
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

function setModeControlValue(root: HTMLElement, mode: MemoryAtlasMode) {
  const select = root.querySelector<HTMLSelectElement>('[data-testid="memory-atlas-mode"]')
  if (select) select.value = mode
}

function resetMemoryAtlasState(root: HTMLElement, data: MemoryAtlasData): MemoryAtlasState {
  syncSearchInputs(root, "")
  const nextState = {
    ...createDefaultMemoryAtlasState(data),
    tags: [],
    query: "",
    selectedSlug: undefined,
  }
  syncControls(root, nextState)
  return nextState
}

export async function initMemoryAtlas(options: InitMemoryAtlasOptions = {}) {
  memoryAtlasState.cleanup?.()
  memoryAtlasState.cleanup = undefined

  const root = options.root ?? document.querySelector<HTMLElement>('[data-testid="memory-atlas"]')
  if (!root) {
    document.body.classList.remove(BODY_CLASS)
    return
  }

  document.body.classList.add(BODY_CLASS)
  const canvas = root.querySelector<HTMLElement>('[data-testid="memory-atlas-canvas"]')
  const status = root.querySelector<HTMLElement>('[data-testid="memory-atlas-status"]')
  if (!canvas) return
  const runtimeLoader = options.loadRuntime ?? loadRuntimeFromDom(root)
  const contentIndexLoader = options.loadContentIndex ?? loadContentIndex
  const semanticsLoader = options.loadSemantics ?? loadPublishedSemantics
  const authSessionLoader = options.loadAuthSession ?? getMemoryAtlasAuthSession
  const adminLogin = options.loginAdmin ?? loginMemoryAtlasAdmin
  const adminLogout = options.logoutAdmin ?? logoutMemoryAtlasAdmin
  const protectedDataLoader = options.loadProtectedData ?? loadProtectedMemoryAtlasData

  setRuntimeState(root, "loading")
  root.classList.remove("memory-atlas--filters-open", "memory-atlas--detail-open")
  updateDetail(root, { nodes: [], links: [] })
  setAvailableNamespaces(root, ["public"])
  setQuestionAvailable(root, false)
  setAuthControls(root, "checking", "로그인 상태 확인 중")

  let destroyed = false
  const runtimeLifecycle = createMemoryAtlasRuntimeLifecycle(runtimeLoader)
  let state = createDefaultMemoryAtlasState()
  let askState: AskState = "idle"
  let fullData: MemoryAtlasData = { nodes: [], links: [] }
  let visibleData: MemoryAtlasData = fullData
  let semanticEdges: MemoryAtlasSemanticEdge[] = []
  let publicData: MemoryAtlasData = fullData
  let publicSemanticEdges: MemoryAtlasSemanticEdge[] = []
  let dataScope: MemoryAtlasAuthRole = "public"
  const cleanups: (() => void)[] = []
  let askController: AbortController | undefined
  let lastQuestion = ""
  let authGeneration = 0
  let sessionExpiryTimer: number | undefined
  const setStatus = (message: string) => {
    if (status) status.textContent = message
  }

  const mountRuntime = async () => {
    setRuntimeState(root, "loading")
    setStatus(`${state.mode === "3d" ? "3D" : "2D"} 탐색 엔진을 불러오는 중입니다.`)
    await runtimeLifecycle.mount(state.mode, {
      container: canvas,
      data: visibleData,
      state,
      context: { semanticEdges },
      onSelect: selectNode,
    })
    if (destroyed) return
    setRuntimeState(root, "ready")
    setStatus(`${visibleData.nodes.length}개 문서를 표시하고 있습니다.`)
  }

  const openEntrypoint = (slug: FullSlug) => {
    const previousMode = state.mode
    state = { ...selectMemoryAtlasNode(state, slug), mode: "2d" }
    syncControls(root, state)
    visibleData = filterMemoryAtlas(fullData, state)
    updateStats(root, visibleData)
    updateResults(root, visibleData, state, selectNode)
    updateDetail(root, visibleData, state.selectedSlug)
    updateContextBar(root, visibleData, state)
    storeState(state)
    runtimeLifecycle.setEvidenceSlugs(new Set())
    if (previousMode === "2d") {
      runtimeLifecycle.update(visibleData, state, { semanticEdges })
      runtimeLifecycle.select(slug)
    } else {
      void mountRuntime().catch((error) => {
        if (destroyed) return
        console.error(error)
        setRuntimeState(root, "error")
      })
    }
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
    runtimeLifecycle.destroy()
    askController?.abort()
    askController = undefined
    lastQuestion = ""
    authGeneration += 1
    if (sessionExpiryTimer !== undefined) window.clearTimeout(sessionExpiryTimer)
    sessionExpiryTimer = undefined
    closeLoginDialog(root)
    for (const fn of cleanups.splice(0)) fn()
  }
  memoryAtlasState.cleanup = cleanup
  window.addCleanup(cleanup)

  const selectNode = (slug?: FullSlug) => {
    runtimeLifecycle.setEvidenceSlugs(new Set())
    const hadQuery = Boolean(state.query.trim())
    state = selectMemoryAtlasNode(state, slug)
    if (slug && hadQuery) {
      syncSearchInputs(root, "")
      visibleData = filterMemoryAtlas(fullData, state)
      updateStats(root, visibleData)
      runtimeLifecycle.update(visibleData, state, { semanticEdges })
      setStatus(`${visibleData.nodes.length}개 문서를 표시하고 있습니다.`)
    }
    storeState(state)
    runtimeLifecycle.select(slug)
    updateDetail(root, visibleData, slug)
    updateResults(root, visibleData, state, selectNode)
    updateContextBar(root, visibleData, state)
  }

  const setAskState = (nextState: AskState, message: string, retryable = false) => {
    askState = nextState
    root.dataset.askState = nextState
    const statusElement = root.querySelector<HTMLElement>('[data-testid="memory-atlas-ask-status"]')
    const submit = root.querySelector<HTMLButtonElement>('[data-testid="memory-atlas-ask-submit"]')
    const retry = root.querySelector<HTMLButtonElement>('[data-testid="memory-atlas-ask-retry"]')
    if (statusElement) statusElement.textContent = message
    if (submit) submit.disabled = nextState === "retrieving" || nextState === "generating"
    if (retry) retry.hidden = !retryable
  }

  const clearAskResult = () => {
    runtimeLifecycle.setEvidenceSlugs(new Set())
    const answer = root.querySelector<HTMLElement>('[data-testid="memory-atlas-ask-answer"]')
    const answerText = root.querySelector<HTMLElement>(
      '[data-testid="memory-atlas-ask-answer-text"]',
    )
    const sources = root.querySelector<HTMLElement>('[data-testid="memory-atlas-ask-sources"]')
    const sourceList = root.querySelector<HTMLOListElement>(
      '[data-testid="memory-atlas-ask-source-list"]',
    )
    if (answer) answer.hidden = true
    if (answerText) answerText.textContent = ""
    if (sources) sources.hidden = true
    sourceList?.replaceChildren()
  }

  const closeAskPanel = () => {
    askController?.abort()
    askController = undefined
    lastQuestion = ""
    clearAskResult()
    setAskState("idle", "질문을 입력하세요.")
    setAskHidden(root, true)
    const textarea = root.querySelector<HTMLTextAreaElement>(
      '[data-testid="memory-atlas-ask-question"]',
    )
    if (textarea) textarea.value = ""
    const count = root.querySelector<HTMLElement>('[data-testid="memory-atlas-ask-count"]')
    if (count) count.textContent = "0 / 500"
  }

  const validSources = (sources: BrainSource[]) => {
    const known = new Map(fullData.nodes.map((node) => [node.slug, node]))
    return sources
      .map((source) => {
        const slug = normalizeSourceSlug(source)
        return { source, slug, href: sourceHref(source, slug) }
      })
      .filter(({ source, slug, href }) => {
        const node = known.get(slug)
        return Boolean(node && href && node.namespace === source.namespace)
      })
  }

  const renderAskAnswer = (answer: BrainAnswer) => {
    clearAskResult()
    const answerPanel = root.querySelector<HTMLElement>('[data-testid="memory-atlas-ask-answer"]')
    const answerText = root.querySelector<HTMLElement>(
      '[data-testid="memory-atlas-ask-answer-text"]',
    )
    const sourcesPanel = root.querySelector<HTMLElement>('[data-testid="memory-atlas-ask-sources"]')
    const sourceList = root.querySelector<HTMLOListElement>(
      '[data-testid="memory-atlas-ask-source-list"]',
    )
    if (answerPanel && answerText) {
      answerPanel.hidden = false
      answerText.textContent = answer.answer
    }
    const sources = validSources(answer.sources)
    if (sourcesPanel && sourceList) {
      sourcesPanel.hidden = sources.length === 0
      sourceList.replaceChildren(
        ...sources.map(({ source, slug, href }) => {
          const item = document.createElement("li")
          const link = document.createElement("a")
          const meta = document.createElement("span")
          const excerpt = document.createElement("p")
          link.href = href!
          link.textContent = source.title || slug
          link.dataset.slug = slug
          link.addEventListener("click", (event) => {
            event.preventDefault()
            navigateToSlug(slug)
          })
          meta.textContent = `${source.namespace}${typeof source.score === "number" ? ` · ${source.score.toFixed(3)}` : ""}`
          excerpt.textContent = source.excerpt || href || ""
          item.append(link, meta, excerpt)
          return item
        }),
      )
    }
    runtimeLifecycle.setEvidenceSlugs(new Set(sources.map(({ slug }) => slug)))
  }

  const submitQuestion = async () => {
    const textarea = root.querySelector<HTMLTextAreaElement>(
      '[data-testid="memory-atlas-ask-question"]',
    )
    const question = textarea?.value.trim() ?? ""
    if (!question || askState === "retrieving" || askState === "generating") return
    lastQuestion = question
    askController?.abort()
    const controller = new AbortController()
    askController = controller
    clearAskResult()
    setAskState("retrieving", "근거를 찾고 있습니다.")
    try {
      const request = askBrain(question, controller.signal).then(
        (answer) => ({ ok: true as const, answer }),
        (error: unknown) => ({ ok: false as const, error }),
      )
      await nextFrame()
      if (controller.signal.aborted) return
      setAskState("generating", "답변을 만들고 있습니다.")
      const result = await request
      if (!result.ok) throw result.error
      const answer = result.answer
      if (controller.signal.aborted) return
      if (!answer.sources.length) {
        clearAskResult()
        setAskState("empty", "관련 brain 근거가 없습니다.", false)
        return
      }
      renderAskAnswer(answer)
      setAskState("success", `${answer.sources.length}개 근거로 답했습니다.`, false)
    } catch (error) {
      if (controller.signal.aborted) return
      if (isMemoryAtlasUnauthorized(error)) {
        returnToPublic("관리자 session이 만료되었습니다. 다시 로그인하세요.")
        return
      }
      clearAskResult()
      const retryable = Boolean((error as Error & { retryable?: boolean }).retryable)
      setAskState(
        "error",
        error instanceof Error ? error.message : "질문 처리에 실패했습니다.",
        retryable,
      )
    } finally {
      if (askController === controller) askController = undefined
    }
  }

  const refresh = (source?: HTMLInputElement | null) => {
    const previousMode = state.mode
    if (source) syncSearchInputs(root, source.value, source)
    state = readState(root, state)
    storeState(state)
    visibleData = filterMemoryAtlas(fullData, state)
    updateStats(root, visibleData)
    updateResults(root, visibleData, state, selectNode)
    if (state.mode !== previousMode) {
      void mountRuntime().catch((error) => {
        if (destroyed) return
        console.error(error)
        setStatus(`${state.mode === "3d" ? "3D" : "2D"} 그래프 초기화에 실패했습니다.`)
        const message = root.querySelector<HTMLElement>(
          '[data-testid="memory-atlas-error-message"]',
        )
        if (message) message.textContent = error instanceof Error ? error.message : String(error)
        setRuntimeState(root, "error")
      })
    } else {
      runtimeLifecycle.update(visibleData, state, { semanticEdges })
    }
    if (state.selectedSlug && !visibleData.nodes.some((node) => node.slug === state.selectedSlug)) {
      selectNode(undefined)
    }
    runtimeLifecycle.setEvidenceSlugs(new Set())
    updateContextBar(root, visibleData, state)
    setStatus(`${visibleData.nodes.length}개 문서를 표시하고 있습니다.`)
  }

  const renderDataScope = () => {
    syncControls(root, state)
    visibleData = filterMemoryAtlas(fullData, state)
    updateTagOptions(root, fullData)
    updateStats(root, visibleData)
    updateResults(root, visibleData, state, selectNode)
    updateDetail(root, visibleData, state.selectedSlug)
    updateContextBar(root, visibleData, state)
    updateEntrypoints(root, fullData, semanticEdges, openEntrypoint)
    runtimeLifecycle.setEvidenceSlugs(new Set())
    runtimeLifecycle.update(visibleData, state, { semanticEdges })
    storeState(state)
    setStatus(`${visibleData.nodes.length}개 문서를 표시하고 있습니다.`)
  }

  const returnToPublic = (message: string, authState: "public" | "error" = "public") => {
    authGeneration += 1
    if (sessionExpiryTimer !== undefined) window.clearTimeout(sessionExpiryTimer)
    sessionExpiryTimer = undefined
    dataScope = "public"
    root.dataset.dataScope = dataScope
    fullData = publicData
    semanticEdges = publicSemanticEdges
    state = removePrivateMemoryAtlasState(state, publicData)
    closeAskPanel()
    setQuestionAvailable(root, false)
    setAvailableNamespaces(root, ["public"])
    renderDataScope()
    setAuthControls(root, authState, message)
  }

  const enterAdminScope = async (session: MemoryAtlasAuthSession) => {
    const generation = ++authGeneration
    setAuthControls(root, "loading", "관리자 데이터를 불러오는 중")
    const protectedData = await protectedDataLoader()
    if (destroyed || generation !== authGeneration) return
    const parsedSemantics = parsePublishedMemoryAtlasSemantics(protectedData.semantics)
    if (!parsedSemantics.ok) throw new Error("invalid_private_semantics")
    const adminData = buildMemoryAtlasData(protectedData.contentIndex)
    if (
      !adminData.nodes.some((node) => node.namespace === "public") ||
      !adminData.nodes.some((node) => node.namespace === "private")
    ) {
      throw new Error("invalid_private_content_index")
    }
    const adminSemantics = restrictPublishedMemoryAtlasSemanticsToSlugs(
      parsedSemantics.artifact,
      adminData.nodes.map((node) => node.slug),
      { allowPrivate: true },
    )

    dataScope = "admin"
    root.dataset.dataScope = dataScope
    fullData = adminData
    semanticEdges = adminSemantics.edges
    state = {
      ...state,
      tags: state.tags?.filter((tag) => adminData.nodes.some((node) => node.tags.includes(tag))),
      selectedSlug:
        state.selectedSlug && adminData.nodes.some((node) => node.slug === state.selectedSlug)
          ? state.selectedSlug
          : undefined,
    }
    setAvailableNamespaces(root, ["public", "private"])
    setQuestionAvailable(root, true)
    renderDataScope()
    setAuthControls(root, "admin", "관리자")

    if (sessionExpiryTimer !== undefined) window.clearTimeout(sessionExpiryTimer)
    const expiresAt = session.expiresAt ? Date.parse(session.expiresAt) : Number.NaN
    if (Number.isFinite(expiresAt)) {
      sessionExpiryTimer = window.setTimeout(
        () => {
          if (generation !== authGeneration) return
          returnToPublic("관리자 session이 만료되었습니다. 다시 로그인하세요.")
        },
        Math.max(0, expiresAt - Date.now()),
      )
    }
  }

  try {
    setStatus("콘텐츠 색인을 읽는 중입니다.")
    const loaded = await loadMemoryAtlasDataWithFallback(root, contentIndexLoader)
    publicData = restrictMemoryAtlasDataToNamespaces(loaded.data, ["public"])
    fullData = publicData
    dataScope = "public"
    root.dataset.dataScope = dataScope
    if (destroyed) return
    if (loaded.fallback) {
      root.dataset.contentIndexState = "fallback"
      console.error(loaded.error)
    } else {
      root.dataset.contentIndexState = "ready"
    }
    state = removePrivateMemoryAtlasState(
      restoreStoredMemoryAtlasState(createDefaultMemoryAtlasState(fullData)),
      publicData,
    )
    const urlSelectedSlug = new URL(window.location.toString()).searchParams.get(
      "node",
    ) as FullSlug | null
    const selectedSlug = urlSelectedSlug ?? state.selectedSlug
    if (selectedSlug && fullData.nodes.some((node) => node.slug === selectedSlug)) {
      state = { ...state, selectedSlug }
    } else {
      state = { ...state, selectedSlug: undefined }
    }
    storeState(state)
    syncControls(root, state)
    visibleData = filterMemoryAtlas(fullData, state)
    updateTagOptions(root, fullData)
    updateStats(root, visibleData)
    updateResults(root, visibleData, state, selectNode)
    updateDetail(root, visibleData, state.selectedSlug)
    updateContextBar(root, visibleData, state)
    updateEntrypoints(root, fullData, semanticEdges, openEntrypoint)

    void semanticsLoader()
      .then((semanticsJson) => {
        const parsed = parsePublishedMemoryAtlasSemantics(semanticsJson)
        if (!parsed.ok) {
          root.dataset.semanticsState = "fallback"
          return createEmptyPublishedMemoryAtlasSemantics()
        }
        root.dataset.semanticsState = "ready"
        return restrictPublishedMemoryAtlasSemanticsToSlugs(
          parsed.artifact,
          publicData.nodes.map((node) => node.slug),
          { allowPrivate: false },
        )
      })
      .catch(() => {
        root.dataset.semanticsState = "fallback"
        return createEmptyPublishedMemoryAtlasSemantics()
      })
      .then((semantics) => {
        publicSemanticEdges = semantics.edges
        if (dataScope !== "public") return
        semanticEdges = publicSemanticEdges
        updateEntrypoints(root, publicData, semanticEdges, openEntrypoint)
        runtimeLifecycle.update(visibleData, state, { semanticEdges })
      })

    await mountRuntime()
  } catch (error) {
    if (destroyed) return
    console.error(error)
    setStatus("지식 관계 지도 초기화에 실패했습니다.")
    const message = root.querySelector<HTMLElement>('[data-testid="memory-atlas-error-message"]')
    if (message) message.textContent = error instanceof Error ? error.message : String(error)
    setRuntimeState(root, "error")
  }

  if (destroyed) return

  const bind = <T extends Event>(
    element: EventTarget | null,
    event: string,
    handler: (event: T) => void,
  ) => {
    if (!element) return
    element.addEventListener(event, handler as EventListener)
    cleanups.push(() => element.removeEventListener(event, handler as EventListener))
  }

  root
    .querySelectorAll<HTMLInputElement>(
      '[data-testid="memory-atlas-search"], [data-testid="memory-atlas-mobile-search"]',
    )
    .forEach((input) => bind(input, "input", () => refresh(input)))
  root.querySelectorAll<HTMLButtonElement>("[data-memory-atlas-search-clear]").forEach((button) =>
    bind(button, "click", () => {
      state = clearMemoryAtlasQuery(readState(root, state))
      syncSearchInputs(root, "")
      refresh()
      const target = button.dataset.searchTarget
      if (target) root.querySelector<HTMLInputElement>(`[data-testid="${target}"]`)?.focus()
    }),
  )
  bind(root.querySelector('[data-testid="memory-atlas-tag-filter"]'), "change", () => refresh())
  for (const selector of [
    'input[name="memory-atlas-type"]',
    'input[name="memory-atlas-freshness"]',
    '[data-testid="memory-atlas-mode"]',
    '[data-testid="memory-atlas-layout"]',
    '[data-testid="memory-atlas-color"]',
    '[data-testid="memory-atlas-spacing"]',
    '[data-testid="memory-atlas-labels"]',
  ]) {
    root.querySelectorAll(selector).forEach((element) => bind(element, "change", () => refresh()))
  }
  bind(root.querySelector('[data-testid="memory-atlas-namespace-filter"]'), "change", () =>
    refresh(),
  )
  root.querySelectorAll<HTMLButtonElement>("[data-memory-atlas-mode-button]").forEach((button) =>
    bind(button, "click", () => {
      const mode = button.dataset.memoryAtlasModeButton === "3d" ? "3d" : "2d"
      setModeControlValue(root, mode)
      refresh()
    }),
  )

  bind(root.querySelector('[data-testid="memory-atlas-recenter"]'), "click", () =>
    runtimeLifecycle.recenter(),
  )
  bind(root.querySelector('[data-testid="memory-atlas-clear-selection"]'), "click", () =>
    selectNode(undefined),
  )
  bind(root.querySelector('[data-testid="memory-atlas-ask-toggle"]'), "click", () => {
    setAskHidden(root, false)
    focusFirstInAskPanel(root)
  })
  bind(root.querySelector('[data-testid="memory-atlas-ask-close"]'), "click", () => {
    closeAskPanel()
    root.querySelector<HTMLButtonElement>('[data-testid="memory-atlas-ask-toggle"]')?.focus()
  })
  bind(root.querySelector('[data-testid="memory-atlas-ask-form"]'), "submit", (event) => {
    event.preventDefault()
    void submitQuestion()
  })
  bind(root.querySelector('[data-testid="memory-atlas-ask-retry"]'), "click", () => {
    const textarea = root.querySelector<HTMLTextAreaElement>(
      '[data-testid="memory-atlas-ask-question"]',
    )
    if (textarea && !textarea.value.trim()) textarea.value = lastQuestion
    void submitQuestion()
  })
  bind(root.querySelector('[data-testid="memory-atlas-ask-question"]'), "input", (event) => {
    const textarea = event.currentTarget as HTMLTextAreaElement
    const count = root.querySelector<HTMLElement>('[data-testid="memory-atlas-ask-count"]')
    if (count) count.textContent = `${textarea.value.length} / 500`
  })
  bind(root.querySelector('[data-testid="memory-atlas-reset"]'), "click", () => {
    state = resetMemoryAtlasState(root, fullData)
    clearAskResult()
    refresh()
  })
  bind(root.querySelector('[data-testid="memory-atlas-retry"]'), "click", () => {
    void initMemoryAtlas()
  })
  bind(root.querySelector('[data-testid="memory-atlas-detail-close"]'), "click", () =>
    selectNode(undefined),
  )
  bind(root.querySelector('[data-testid="memory-atlas-login-open"]'), "click", () =>
    openLoginDialog(root),
  )
  for (const testid of ["memory-atlas-login-close", "memory-atlas-login-cancel"]) {
    bind(root.querySelector(`[data-testid="${testid}"]`), "click", () => {
      closeLoginDialog(root)
      root.querySelector<HTMLButtonElement>('[data-testid="memory-atlas-login-open"]')?.focus()
    })
  }
  bind(root.querySelector('[data-testid="memory-atlas-login-dialog"]'), "cancel", (event) => {
    event.preventDefault()
    closeLoginDialog(root)
    root.querySelector<HTMLButtonElement>('[data-testid="memory-atlas-login-open"]')?.focus()
  })
  bind(root.querySelector('[data-testid="memory-atlas-login-form"]'), "submit", (event) => {
    event.preventDefault()
    const input = root.querySelector<HTMLInputElement>(
      '[data-testid="memory-atlas-login-password"]',
    )
    const password = input?.value ?? ""
    if (input) input.value = ""
    if (!password) {
      setLoginStatus(root, "관리자 비밀번호를 입력하세요.")
      return
    }
    setLoginStatus(root, "로그인 정보를 확인하고 있습니다.", true)
    setAuthControls(root, "loading", "로그인 중")
    void (async () => {
      let authenticated = false
      try {
        const session = await adminLogin(password)
        authenticated = true
        if (destroyed) return
        await enterAdminScope(session)
        if (destroyed || root.dataset.authState !== "admin") return
        setLoginStatus(root, "로그인했습니다.")
        closeLoginDialog(root)
      } catch (error) {
        if (destroyed) return
        if (authenticated) {
          const message = isMemoryAtlasUnauthorized(error)
            ? "관리자 session이 만료되었습니다. 다시 로그인하세요."
            : "관리자 데이터를 불러오지 못했습니다. 다시 로그인하세요."
          returnToPublic(message, "error")
          setLoginStatus(root, message)
        } else {
          setAuthControls(root, "public", "비로그인")
          setLoginStatus(root, loginErrorMessage(error))
        }
      } finally {
        setLoginStatus(
          root,
          root.querySelector<HTMLElement>('[data-testid="memory-atlas-login-status"]')
            ?.textContent || "관리자 비밀번호를 입력하세요.",
          false,
        )
      }
    })()
  })
  bind(root.querySelector('[data-testid="memory-atlas-logout"]'), "click", () => {
    returnToPublic("비로그인")
    void adminLogout().catch(() => {
      if (destroyed) return
      setAuthControls(root, "error", "서버 로그아웃을 확인하지 못했습니다. 다시 로그인하세요.")
    })
  })
  bind(root.querySelector('[data-testid="memory-atlas-filter-toggle"]'), "click", (event) => {
    const button = event.currentTarget as HTMLButtonElement
    setFiltersOpen(root, button.getAttribute("aria-expanded") !== "true")
  })
  bind(root.querySelector('[data-testid="memory-atlas-backdrop"]'), "click", () =>
    setFiltersOpen(root, false),
  )
  bind(document as unknown as EventTarget, "keydown", (event: KeyboardEvent) => {
    if (event.key !== "Escape") return
    const dialog = loginDialog(root)
    if (dialog?.hasAttribute("open")) {
      event.preventDefault()
      closeLoginDialog(root)
      root.querySelector<HTMLButtonElement>('[data-testid="memory-atlas-login-open"]')?.focus()
      return
    }
    const askPanel = root.querySelector<HTMLElement>('[data-testid="memory-atlas-ask-panel"]')
    if (askPanel && !askPanel.hidden) {
      closeAskPanel()
      root.querySelector<HTMLButtonElement>('[data-testid="memory-atlas-ask-toggle"]')?.focus()
      return
    }
    if (state.query.trim()) {
      state = clearMemoryAtlasQuery(readState(root, state))
      syncSearchInputs(root, "")
      refresh()
      return
    }
    setFiltersOpen(root, false)
    selectNode(undefined)
  })
  bind(root.querySelector('[data-testid="memory-atlas-ask-panel"]'), "keydown", (event) => {
    const keyboardEvent = event as KeyboardEvent
    if (keyboardEvent.key !== "Tab") return
    const panel = keyboardEvent.currentTarget as HTMLElement
    if (panel.hidden) return
    const focusables = [
      ...panel.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]):not([hidden]), textarea:not([disabled])",
      ),
    ].filter((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
    if (!focusables.length) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (keyboardEvent.shiftKey && document.activeElement === first) {
      keyboardEvent.preventDefault()
      last.focus()
    } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
      keyboardEvent.preventDefault()
      first.focus()
    }
  })

  void authSessionLoader()
    .then(async (session) => {
      if (destroyed) return
      if (session.role !== "admin") {
        setAuthControls(root, "public", "비로그인")
        return
      }
      try {
        await enterAdminScope(session)
      } catch (error) {
        if (destroyed) return
        returnToPublic(
          isMemoryAtlasUnauthorized(error)
            ? "관리자 session이 만료되었습니다. 다시 로그인하세요."
            : "관리자 데이터를 불러오지 못했습니다. 다시 로그인하세요.",
          "error",
        )
      }
    })
    .catch(() => {
      if (destroyed) return
      setAuthControls(root, "public", "비로그인")
    })
}
