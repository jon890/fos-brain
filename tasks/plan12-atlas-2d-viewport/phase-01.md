# Phase 01 viewport 상태와 드래그·휠 조작

**Execution profile**: deep

---

## 목표

2D 관계 지도에 이동과 배율 상태를 도입하고, 빈 곳을 끌면 지도가 따라 움직이고 휠로 확대·축소가 되게 한다.

현재 `memoryAtlas2dRuntime.ts` 에는 `pointerdown`, `wheel`, 드래그 관련 handler 가 하나도 없다.
SVG 는 `viewBox="0 0 width height"` 를 컨테이너 크기에 맞춰 고정하고 노드는 `left`, `top` 을 퍼센트로 준 HTML `button` 이다.
`ResizeObserver` 가 크기 변화마다 좌표를 다시 계산해 전체를 새로 그린다. 카메라라는 개념이 없어 옮길 대상이 없다.

**범위 외**: `전체 보기` 버튼과 브라우저 회귀는 Phase 02가 담당한다.
3D 조망의 조작은 이미 `3d-force-graph` 가 제공하므로 건드리지 않는다.
목차 문서 제외는 plan11, Quartz fork 경계는 plan13이 담당한다.

---

## 작업 항목 (4)

### 1. 좌표 계산과 표시를 분리한다

`buildMemoryAtlas2dScene` 은 고치지 않는다. 장면 좌표는 지금 그대로 두고 표시 단계에만 변환을 얹는다.

`renderScene` 이 만드는 `root` 안에 새 래퍼 요소를 하나 넣고 그 안에 SVG 와 노드 레이어를 담는다.
클래스 이름은 `memory-atlas-2d__viewport` 로 한다.
이 래퍼에만 `transform: translate(<x>px, <y>px) scale(<k>)` 을 적용한다.
`transform-origin` 은 `0 0` 으로 두어 계산을 단순하게 유지한다.

### 2. viewport 상태를 mount 범위에 둔다

`mountMemoryAtlas` 안에 `let viewport = { x: 0, y: 0, k: 1 }` 을 둔다.
`renderScene` 호출 뒤 현재 `viewport` 값을 래퍼에 적용하는 `applyViewport(root)` 를 호출한다.

`ResizeObserver` 재렌더와 `update`, `select`, `setEvidenceSlugs` 로 다시 그릴 때 이 값이 유지돼야 한다.
`renderScene` 이 `container.replaceChildren(root)` 로 DOM 을 통째로 바꾸므로 상태를 DOM 에 저장하면 사라진다. 반드시 mount 범위 변수에 둔다.

배율은 `0.4` 이상 `4` 이하로 제한한다. 이 범위를 벗어나는 입력은 경계값으로 맞춘다.

### 3. 드래그와 휠 handler

handler 는 `container` 에 한 번만 등록하고 `destroy` 에서 모두 제거한다.
매 렌더마다 등록하면 DOM 이 바뀔 때 handler 가 쌓인다.

- `pointerdown`: 대상이 노드 `button` 안이면 무시한다. 그 밖이면 드래그를 시작하고 시작 좌표를 기록한다. `setPointerCapture` 를 사용한다.
- `pointermove`: 드래그 중이면 이동량을 `viewport.x`, `viewport.y` 에 더하고 래퍼 transform 만 갱신한다. 장면을 다시 만들지 않는다.
- `pointerup`, `pointercancel`: 드래그를 끝내고 capture 를 푼다.
- `wheel`: `preventDefault` 를 호출하고 포인터 위치를 기준으로 배율을 바꾼다. 포인터 아래에 있던 지점이 그대로 그 자리에 남아야 한다. 배율 변화량은 `Math.exp(-event.deltaY * 0.0015)` 를 곱하는 방식으로 한다.

`wheel` 은 `preventDefault` 를 쓰므로 `{ passive: false }` 로 등록한다.

### 4. 드래그와 클릭을 구분한다

노드는 `button` 이고 `click` 으로 선택된다. 지도를 끌다가 손을 뗀 자리가 노드 위이면 원하지 않은 선택이 일어난다.

`pointerdown` 부터 `pointerup` 까지의 이동 거리가 `4` px 이상이면 드래그로 본다.
드래그로 판정된 동작의 직후 `click` 이벤트는 캡처 단계에서 `stopPropagation` 으로 막는다.
`4` px 미만이면 아무것도 막지 않아 기존 선택 동작이 그대로 유지된다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `quartz/quartz/components/scripts/memoryAtlas2dRuntime.ts` | 수정 |
| `quartz/quartz/components/styles/memoryAtlas.scss` | 수정 |
| `quartz/quartz/components/memoryAtlas2dRuntime.test.ts` | 수정 |

## 검증

```bash
# cwd: <worktree>/quartz
pnpm test
pnpm exec tsc --noEmit
pnpm exec prettier --check quartz/components/scripts/memoryAtlas2dRuntime.ts quartz/components/styles/memoryAtlas.scss quartz/components/memoryAtlas2dRuntime.test.ts
```

단위 검사에 다음 넷을 추가한다.

- 이동량을 준 뒤 래퍼의 `transform` 문자열에 그 값이 반영된다.
- 배율 입력이 `0.4` 아래이거나 `4` 위이면 경계값으로 맞춰진다.
- `update` 로 다시 그린 뒤에도 이동과 배율 값이 유지된다.
- `destroy` 뒤에는 등록한 handler 가 남아 있지 않다.

```bash
# cwd: <worktree>/
git diff --check
```

## 의도 메모 (왜)

- `buildMemoryAtlas2dScene` 을 건드리지 않는 이유는 장면 계산이 순수 함수로 검사 가능한 상태이기 때문이다. 표시 변환만 얹으면 그 검사가 그대로 유효하다.
- `d3-zoom` 을 쓰지 않은 이유는 2D 런타임 번들이 현재 `d3` 를 전혀 불러오지 않기 때문이다. 직접 구현이 60줄 안쪽이라 번들을 키울 이유가 없다.
- 이동 거리 4px 기준을 둔 이유는 노드가 `button` 이라 드래그 끝에서 원하지 않은 선택이 일어나기 때문이다.
