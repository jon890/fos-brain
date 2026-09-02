import type { MemoryAtlasData, MemoryAtlasState } from "../memoryAtlasData"
import type { FullSlug } from "../../util/path"
import type {
  MemoryAtlasRuntimeHandle,
  MemoryAtlasRuntimeMountOptions,
} from "./memoryAtlasRuntimeTypes"

function renderList(
  container: HTMLElement,
  data: MemoryAtlasData,
  state: MemoryAtlasState,
  evidenceSlugs: ReadonlySet<FullSlug>,
  onSelect: (slug: FullSlug) => void,
) {
  const list = document.createElement("ol")
  list.className = "memory-atlas-2d__list"
  list.setAttribute("aria-label", "2D 지식 관계 목록")

  for (const node of data.nodes) {
    const item = document.createElement("li")
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = node.title
    button.dataset.slug = node.slug
    button.setAttribute("aria-pressed", String(state.selectedSlug === node.slug))
    item.dataset.slug = node.slug
    item.dataset.selected = String(state.selectedSlug === node.slug)
    item.dataset.evidence = String(evidenceSlugs.has(node.slug))
    item.append(button)
    button.addEventListener("click", () => onSelect(node.slug))
    list.append(item)
  }

  container.replaceChildren(list)
  container.dataset.runtimeMode = "2d"
  container.dataset.nodeCount = String(data.nodes.length)
  container.dataset.evidenceCount = String(evidenceSlugs.size)
}

export function mountMemoryAtlas({
  container,
  data,
  state,
  onSelect,
}: MemoryAtlasRuntimeMountOptions): MemoryAtlasRuntimeHandle {
  let currentData = data
  let currentState = state
  let evidenceSlugs = new Set<FullSlug>()
  let destroyed = false

  const render = () => {
    if (destroyed) return
    renderList(container, currentData, currentState, evidenceSlugs, onSelect)
  }

  render()

  return {
    update(nextData: MemoryAtlasData, nextState: MemoryAtlasState) {
      currentData = nextData
      currentState = nextState
      render()
    },
    select(slug?: FullSlug) {
      currentState = { ...currentState, selectedSlug: slug }
      render()
    },
    recenter() {
      if (!destroyed) container.querySelector<HTMLElement>("[data-selected='true'] button")?.focus()
    },
    setEvidenceSlugs(slugs: ReadonlySet<FullSlug>) {
      evidenceSlugs = new Set(slugs)
      render()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      delete container.dataset.runtimeMode
      delete container.dataset.nodeCount
      delete container.dataset.evidenceCount
      container.replaceChildren()
    },
  }
}
