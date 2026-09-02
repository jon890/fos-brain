import type { MemoryAtlasData, MemoryAtlasState } from "../memoryAtlasData"
import type { FullSlug } from "../../util/path"

export type MemoryAtlasRuntimeHandle = {
  update: (data: MemoryAtlasData, state: MemoryAtlasState) => void
  select: (slug?: FullSlug) => void
  recenter: () => void
  setEvidenceSlugs: (slugs: ReadonlySet<FullSlug>) => void
  destroy: () => void
}

export type MemoryAtlasRuntimeMountOptions = {
  container: HTMLElement
  data: MemoryAtlasData
  state: MemoryAtlasState
  onSelect: (slug: FullSlug) => void
}

export type MemoryAtlasRuntimeModule = {
  mountMemoryAtlas: (options: MemoryAtlasRuntimeMountOptions) => MemoryAtlasRuntimeHandle
}
