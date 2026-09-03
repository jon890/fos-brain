import type { MemoryAtlasData, MemoryAtlasState } from "../memoryAtlasData"
import type { MemoryAtlasSemanticEdge } from "../memoryAtlasSemantics"
import type { FullSlug } from "../../util/path"

export type MemoryAtlasRuntimeContext = {
  semanticEdges?: readonly MemoryAtlasSemanticEdge[]
}

export type MemoryAtlasRuntimeHandle = {
  update: (
    data: MemoryAtlasData,
    state: MemoryAtlasState,
    context?: MemoryAtlasRuntimeContext,
  ) => void
  select: (slug?: FullSlug) => void
  recenter: () => void
  setEvidenceSlugs: (slugs: ReadonlySet<FullSlug>) => void
  destroy: () => void
}

export type MemoryAtlasRuntimeMountOptions = {
  container: HTMLElement
  data: MemoryAtlasData
  state: MemoryAtlasState
  context?: MemoryAtlasRuntimeContext
  onSelect: (slug: FullSlug) => void
}

export type MemoryAtlasRuntimeModule = {
  mountMemoryAtlas: (options: MemoryAtlasRuntimeMountOptions) => MemoryAtlasRuntimeHandle
}
