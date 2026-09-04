# Phase 01 viewport 상태와 드래그·휠 조작

**Execution profile**: deep

---

## 목표

2D 관계 지도에 이동과 배율 상태를 도입하고, 지도를 끌면 따라 움직이고 휠로 확대·축소가 되게 한다.

현재 `memoryAtlas2dRuntime.ts` 에는 `pointerdown`, `wheel`, 드래그 관련 handler 가 하나도 없다.
SVG 는 `viewBox="0 0 width height"` 를 컨테이너 크기에 맞춰 고정하고 노드는 `left`, `top` 을 퍼센트로 준 HTML `button` 이다.
`ResizeObserver` 가 크기 변화마다 좌표를 다시 계산해 전체를 새로 그린다. 카메라라는 개념이 없어 옮길 대상이 없다.

**범위 외**: `전체 보기` 버튼과 브라우저 회귀는 Phase 02가 담당한다.
3D 조망의 조작은 이미 `3d-force-graph` 가 제공하므로 건드리지 않는다.
목차 문서 제외는 plan11, Quartz fork 경계는 plan13이 담당한다.
docs 갱신도 범위 외다. 이 기능의 `docs/prd.md`, `docs/flow.md`, `docs/code-architecture.md`, `docs/memory-atlas-design.md` 갱신은 plan11 브랜치에 이미 들어 있다.

---

## 작업 항목 (5)

### 1. 좌표 계산과 표시를 분리한다

`buildMemoryAtlas2dScene` 은 고치지 않는다. 장면 좌표는 지금 그대로 두고 표시 단계에만 변환을 얹는다.

`renderScene` 이 만드는 `root` 안에 새 래퍼 요소를 하나 넣고 그 안에 SVG 와 노드 레이어를 담는다.
클래스 이름은 `memory-atlas-2d__viewport` 로 한다.
이 래퍼에만 `transform: translate(<x>px, <y>px) scale(<k>)` 을 적용한다.
`transform-origin` 은 `0 0` 으로 두어 계산을 단순하게 유지한다.

`.memory-atlas-2d__svg` 와 `.memory-atlas-2d__nodes` 는 `position: absolute; inset: 0` 이다.
transform 을 가진 래퍼가 이 절대 배치 자손의 containing block 이 되므로 래퍼 자신이 크기를 가져야 한다.
`.memory-atlas-2d__viewport` 에 `position: absolute; inset: 0; transform-origin: 0 0;` 을 준다.
래퍼에 크기가 없으면 SVG 와 노드가 0 크기 상자를 기준으로 배치돼 지도가 사라진다.

`.memory-atlas-2d` 에 `touch-action: none` 을 준다.
지정하지 않으면 모바일에서 브라우저가 스크롤 동작을 가져가 `pointermove` 가 중간에 끊긴다.

### 2. viewport 상태를 mount 범위에 둔다

`mountMemoryAtlas` 안에 `let viewport = { x: 0, y: 0, k: 1 }` 을 둔다.
`renderScene` 호출 뒤 현재 `viewport` 값을 래퍼에 적용하는 `applyViewport(container)` 를 호출한다.

`applyViewport` 는 매 호출마다 `container.querySelector(".memory-atlas-2d__viewport")` 로 래퍼를 다시 찾는다.
mount 시점에 래퍼 참조를 캐시하면 첫 재렌더에서 그 참조가 DOM 에서 떨어져 나가 이동값이 화면에 반영되지 않는다.

래퍼가 없을 때는 아무 일도 하지 않는다.
3D 로 바꾼 뒤와 첫 렌더 전에는 `.memory-atlas-2d__viewport` 가 없다.

`ResizeObserver` 재렌더와 `update`, `select`, `setEvidenceSlugs` 로 다시 그릴 때 이 값이 유지돼야 한다.
`renderScene` 이 `container.replaceChildren(root)` 로 DOM 을 통째로 바꾸므로 상태를 DOM 에 저장하면 사라진다. 반드시 mount 범위 변수에 둔다.

배율은 `0.4` 이상 `4` 이하로 제한한다. 이 범위를 벗어나는 입력은 경계값으로 맞춘다.

### 3. 드래그와 휠 handler

handler 는 `container` 에 한 번만 등록하고 `destroy` 에서 모두 제거한다.
매 렌더마다 등록하면 DOM 이 바뀔 때 handler 가 쌓여 한 번의 드래그가 배수로 움직인다.

- `pointerdown`: 대상을 가리지 않고 드래그 후보로 받는다. 시작 좌표와 `pointerId` 를 기록한다.
  노드 `button` 위에서 시작한 드래그도 지도를 움직인다.
- `pointermove`: 드래그 후보이면 이동량을 `viewport.x`, `viewport.y` 에 더하고 래퍼 transform 만 갱신한다. 장면을 다시 만들지 않는다.
- `pointerup`, `pointercancel`: 드래그를 끝내고 capture 를 푼다.
- `wheel`: `preventDefault` 를 호출하고 포인터 위치를 기준으로 배율을 바꾼다. 포인터 아래에 있던 지점이 그대로 그 자리에 남아야 한다. 배율 변화량은 `Math.exp(-event.deltaY * 0.0015)` 를 곱하는 방식으로 한다.

`wheel` 은 `preventDefault` 를 쓰므로 `{ passive: false }` 로 등록한다.
해제할 때도 같은 options 로 `removeEventListener` 를 부른다.

**`setPointerCapture` 는 드래그로 확정된 뒤에 건다.**
`pointerdown` 즉시 capture 를 걸면 4px 미만의 짧은 탭에서도 호환 `click` 이 `container` 로 재지정돼
노드 `button` 의 `click` handler 가 실행되지 않는다. 포인터로 노드를 고르는 경로가 사라진다.
`pointermove` 와 `pointerup` 은 capture 성공 여부와 무관하게 끝까지 `window` 에서 받는다.
확정 뒤에 대상을 `container` 로 옮기면 `window` 로 보낸 이벤트가 아래로 전파되지 않아 드래그가 멈춘다.

`setPointerCapture` 는 `try`/`catch` 로 감싼다.
합성한 `PointerEvent` 의 `pointerId` 는 활성 포인터가 아니라 capture 가 예외를 던진다.
실패하면 `window` 의 `pointermove`·`pointerup` 만으로 드래그를 끝까지 처리한다.
`releasePointerCapture` 도 같은 방식으로 감싼다.

### 4. 드래그와 클릭을 구분한다

노드는 `button` 이고 `click` 으로 선택된다. 지도를 끌다가 손을 뗀 자리가 노드 위이면 원하지 않은 선택이 일어난다.

`pointerdown` 부터 `pointerup` 까지의 이동 거리가 `4` px 이상이면 드래그로 본다.
드래그로 판정된 동작의 직후 `click` 이벤트는 캡처 단계에서 `stopPropagation` 으로 막는다.
`4` px 미만이면 아무것도 막지 않아 기존 선택 동작이 그대로 유지된다.

### 5. 검사 가능한 형태로 나눈다

`pnpm test` 는 `tsx --test` 이고 `document`, `ResizeObserver`, `requestAnimationFrame` 이 없다.
`mountMemoryAtlas` 를 그대로 부르는 검사는 이 환경에서 실행되지 않는다.
아래 둘을 export 해 손으로 만든 fake 객체로 검사할 수 있게 한다.

- 이동과 배율 계산: 순수 함수. 배율 경계 제한, 포인터 기준 확대, transform 문자열 생성이 여기 들어간다.
- handler 배선: `container` 와 transform 적용 함수를 받아 `detach()` 를 돌려주는 함수.
  `mountMemoryAtlas` 는 이 함수를 부르고 `destroy` 에서 `detach()` 를 부른다.

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

단위 검사에 다음 다섯을 추가한다.

- 이동량을 준 뒤 fake 래퍼의 `style.transform` 에 그 값이 기록된다. 문자열만 만드는 순수 함수가 아니라 실제 대입 경로를 지난다.
- 배율 입력이 `0.4` 아래이거나 `4` 위이면 경계값으로 맞춰진다.
- 포인터 위치를 기준으로 확대하면 그 지점의 장면 좌표가 확대 전후로 같다.
- 여러 번 다시 그려도 이동과 배율 값이 유지된다.
- `detach` 뒤에는 등록한 handler 가 남아 있지 않다. 등록·해제한 event type, 함수 참조, options 가 짝을 이룬다. `wheel` 이 `{ passive: false }` 로 등록되고 같은 options 로 해제되는지 함께 본다.

단위 검사로 덮지 못하는 둘은 Phase 02의 브라우저 회귀가 맡는다.

- 재렌더마다 handler 가 쌓이지 않는지. 쌓이면 한 번의 드래그가 배수로 움직인다.
- 재렌더 뒤 래퍼를 다시 찾아 transform 을 다시 얹는지.

```bash
# cwd: <worktree>/
git diff --check
```

## 의도 메모 (왜)

- `buildMemoryAtlas2dScene` 을 건드리지 않는 이유는 장면 계산이 순수 함수로 검사 가능한 상태이기 때문이다. 표시 변환만 얹으면 그 검사가 그대로 유효하다.
- `d3-zoom` 을 쓰지 않은 이유는 2D 런타임 번들이 현재 `d3` 를 전혀 불러오지 않기 때문이다. 직접 구현이 60줄 안쪽이라 번들을 키울 이유가 없다.
- 이동 거리 4px 기준을 둔 이유는 노드가 `button` 이라 드래그 끝에서 원하지 않은 선택이 일어나기 때문이다.
- 노드 위에서 시작한 드래그도 이동으로 처리하는 이유는 노드가 촘촘한 지역 관계에서 빈 곳을 찾기 어렵기 때문이다. 4px 판정이 선택을 지켜 준다.
- `wheel` 에서 `preventDefault` 를 부르면 지도 위에서 페이지가 스크롤되지 않는다. 지도가 홈 화면 대부분을 차지하므로 이 자리에서는 확대·축소가 스크롤보다 필요한 동작이라고 판단했다.
- 래퍼 하나에 `scale` 을 걸면 노드 `button` 의 글자 크기와 `max-width` 도 함께 커진다. 지도를 확대하는 동작이므로 라벨이 같이 커지는 것이 의도한 결과다. 배율 상한 `4` 에서 라벨 상자가 화면 폭을 넘을 수 있고, 이때는 `.memory-atlas-2d` 의 `overflow: hidden` 이 잘라낸다. 라벨 크기를 배율과 무관하게 유지하려면 노드 레이어와 SVG 에 서로 다른 변환을 걸어야 해 장면 좌표 계산이 둘로 갈린다. 그 비용을 지불하지 않는다.
