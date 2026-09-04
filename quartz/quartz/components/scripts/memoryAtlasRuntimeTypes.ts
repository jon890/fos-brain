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
  /**
   * 지도의 이동과 배율만 처음 상태로 되돌린다. 선택 상태는 바꾸지 않는다.
   * 3D 는 카메라 복원을 자체 처리하므로 구현하지 않는다.
   */
  resetViewport?: () => void
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
