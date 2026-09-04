import type { MemoryAtlasData, MemoryAtlasState } from "../memoryAtlasData"
import type { MemoryAtlasSemanticEdge } from "../memoryAtlasSemantics"
import type { FullSlug } from "../../util/path"

/**
 * 배율 버튼 한 번이 바꾸는 비율. 확대는 이 값을, 축소는 역수를 쓴다.
 * runtime 과 controller 가 함께 쓰므로 2D 번들이 아니라 공용 모듈에 둔다.
 */
export const MEMORY_ATLAS_2D_BUTTON_SCALE_STEP = 1.25

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
  /**
   * 화면 중앙을 기준으로 배율에 `factor` 를 곱한다. 포인터가 없어도 배율을 바꿀 수단이다.
   * 3D 는 카메라 조작을 자체 처리하므로 구현하지 않는다.
   */
  zoomBy?: (factor: number) => void
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
