# Phase 02 전체 보기 동작과 화면 회귀

**Execution profile**: standard

---

## 목표

이동과 배율을 처음 상태로 되돌리는 `전체 보기` 동작을 붙이고, 2D 지도의 조작이 실제 브라우저에서 동작하는 것을 확인한다.

**범위 외**: 드래그와 휠 handler 자체는 Phase 01이 만든다.
docs 갱신은 plan11 브랜치가 이미 담고 있어 이 phase 에서 하지 않는다.

**선행 조건**: 이 phase는 Phase 01이 만드는 `memoryAtlas2dRuntime.ts` 의 viewport 상태와 `memory-atlas-2d__viewport` 래퍼를 전제한다. 둘이 없으면 `PHASE_BLOCKED: Phase 01 미완료`로 끝낸다.

---

## 작업 항목 (3)

### 1. runtime 에 초기화 동작을 노출한다

`memoryAtlasRuntimeTypes.ts` 의 공통 handle 에 `resetViewport?(): void` 를 선택 메서드로 더한다.
3D runtime 은 이미 카메라 복원을 자체 처리하므로 구현하지 않아도 되는 선택 메서드로 둔다.

2D runtime 은 `resetViewport` 에서 `viewport` 를 `{ x: 0, y: 0, k: 1 }` 로 되돌리고 래퍼 transform 만 갱신한다. 장면을 다시 만들지 않는다.

`select` 가 불릴 때마다 같은 초기화를 함께 수행한다. slug 가 있을 때와 `undefined` 일 때를 가리지 않는다.
선택으로 배치가 다시 계산되는데 이전 이동값이 남아 있으면 새 중심이 화면 밖에 있을 수 있다.
선택 해제도 전체 좌표로 배치를 되돌리므로 이전 이동값을 남길 이유가 없다.
`memoryAtlasController.ts` 의 `selectNode` 는 slug 유무와 무관하게 `runtimeLifecycle.select(slug)` 를 부르므로 두 경로가 같은 동작을 받는다.

### 2. `전체 보기` 버튼

`memoryAtlasView.tsx` 의 `.memory-atlas__actions` 에 `중앙 정렬` 옆으로 버튼을 하나 더한다.
라벨은 `전체 보기`, `type="button"` 이며 접근 가능한 이름을 가진다.
`data-testid="memory-atlas-reset-viewport"` 로 controller 가 찾을 수 있게 한다.
이 저장소는 단일 컨트롤을 `data-testid="memory-atlas-*"` 로 찾고 `data-memory-atlas-*` 는 반복 요소에 쓴다.

`createMemoryAtlasRuntimeLifecycle` 에 `resetViewport()` passthrough 를 더한다.
이 함수는 `handle` 을 밖으로 내보내지 않으므로 `update`, `select`, `recenter` 와 같은 형태로 하나 더 만든다.
`destroyed` 검사와 `handle?.resetViewport?.()` 옵셔널 호출이 여기 들어간다.

`memoryAtlasController.ts` 가 이 버튼의 `click` 에서 그 passthrough 를 호출한다.
handle 에 그 메서드가 없으면 아무 일도 하지 않는다.
선택 상태는 바꾸지 않는다. 이동과 배율만 되돌린다.

3D 모드에서는 이 버튼을 숨긴다. `syncControls` 가 `state.mode` 를 볼 때 함께 처리한다.
3D 는 `resetViewport` 를 구현하지 않으므로 버튼을 남기면 눌러도 반응이 없는 컨트롤이 된다.

기존 `전체 지도로` 는 선택을 해제하는 별개 동작이다. 두 버튼을 합치지 않는다.

### 3. 브라우저 회귀

`quartz/scripts/memory-atlas-browser-assertions.mjs` 와 `verify-memory-atlas-browser.mjs` 에 2D 조작 판정을 더한다.

assertions 파일에는 `pointerdown`, `pointermove`, `pointerup` 을 합성하는 helper 를 새로 넣는다.
현재 이 파일은 `element.click()` 과 `KeyboardEvent` 만 쓰고 pointer 합성 수단이 없다.

helper 계약을 셋으로 못박는다.

- `pointerdown` 은 대상 요소에 보내고 `pointermove`, `pointerup` 도 같은 요소에 `bubbles: true` 로 보낸다.
  runtime 은 이동과 종료를 `window` 에서 받으므로 요소에서 올라온 이벤트가 거기 닿는다.
  `window` 에 직접 보내면 아래로 전파되지 않아 요소의 handler 가 받지 못한다.
- `pointerup` 뒤에 `click` 을 함께 보낸다.
  `dispatchEvent` 로 만든 `PointerEvent` 는 브라우저의 호환 `click` 을 만들지 않는다.
  노드 선택은 `renderNodeLayer` 가 `button` 에 붙인 `click` handler 에서만 일어나므로,
  `click` 을 보내지 않으면 짧은 탭 판정은 선택이 없어 실패하고 드래그 판정은 막을 click 이 없어 그냥 통과한다.
- 각 조작 판정은 끝에서 `전체 보기` 를 눌러 이동과 배율을 되돌린다.
  같은 harness frame 을 뒤의 판정들이 이어 쓴다. 지도를 옮긴 채로 끝내면
  `noHorizontalOverflow` 의 `.memory-atlas-2d__nodes button` 검사가 노드 위치만으로 실패한다.
  `.memory-atlas-2d` 의 `overflow: hidden` 은 화면에서 잘라낼 뿐 `getBoundingClientRect()` 값을 바꾸지 않는다.

- 지도의 빈 곳을 끌면 `memory-atlas-2d__viewport` 의 `transform` 이 바뀐다.
- 노드 위에서 끌어도 지도가 움직인다. 손을 뗀 뒤 선택 노드가 바뀌지 않는다.
- 노드 위에서 4px 미만으로 짧게 누르면 그 노드가 선택된다. 드래그 판정이 선택을 삼키지 않는다.
- 라벨 표시를 여러 번 토글해 다시 그린 뒤 한 번 끌면 이동량이 한 배다. handler 가 렌더마다 쌓이면 배수로 움직인다.
- 다시 그린 뒤에도 직전 이동값이 `transform` 에 남아 있다.
- `전체 보기` 를 누르면 `transform` 이 처음 값으로 돌아가고 선택은 유지된다.
- 3D 모드로 바꾸면 `전체 보기` 버튼이 숨는다.

브라우저 조작은 `~/.claude/scripts/browser-driver` 만 사용한다. 첫 명령 전에 `browser-driver help` 를 읽는다.
숨은 요소나 겹친 화면은 드라이버의 `js` 명령으로 다룬다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `quartz/quartz/components/scripts/memoryAtlasRuntimeTypes.ts` | 수정 |
| `quartz/quartz/components/scripts/memoryAtlas2dRuntime.ts` | 수정 |
| `quartz/quartz/components/memoryAtlasView.tsx` | 수정 |
| `quartz/quartz/components/memoryAtlasView.test.tsx` | 수정 |
| `quartz/quartz/components/scripts/memoryAtlasController.ts` | 수정 |
| `quartz/quartz/components/scripts/memoryAtlasController.test.ts` | 수정 |
| `quartz/scripts/memory-atlas-browser-assertions.mjs` | 수정 |
| `quartz/scripts/verify-memory-atlas-browser.mjs` | 수정 |
| `tasks/plan12-atlas-2d-viewport/index.json` | 수정 |

## 검증

```bash
# cwd: <worktree>/quartz
pnpm test
pnpm exec tsc --noEmit
pnpm exec prettier --check quartz/components/scripts/memoryAtlasRuntimeTypes.ts quartz/components/scripts/memoryAtlas2dRuntime.ts quartz/components/memoryAtlasView.tsx quartz/components/scripts/memoryAtlasController.ts
```

단위 검사에 다음 넷을 추가한다.

- 초기값을 다시 적용하면 fake 래퍼 `transform` 이 `translate(0px, 0px) scale(1)` 이 된다.
- 래퍼가 없으면 `transform` 을 건드리지 않는다.
- `createMemoryAtlasRuntimeLifecycle` 의 `resetViewport` passthrough 가 `resetViewport` 를 가진 handle 에만 닿고, 없는 handle 과 `destroy` 뒤에는 예외 없이 아무 일도 하지 않는다.
- SSR 마크업에 `data-testid="memory-atlas-reset-viewport"` 버튼이 `type="button"` 과 접근 가능한 이름을 갖고 나오며 `전체 지도로` 와 별개로 남는다.

`select` 와 `select(undefined)` 가 이동과 배율을 초기화하는지는 단위 검사로 확인하지 않는다.
그 경로는 `mountMemoryAtlas` 를 거치는데 `tsx --test` 에는 `document` 와 `ResizeObserver` 가 없어 mount 를 부를 수 없다.
브라우저 회귀가 이 둘을 판정한다.

브라우저 회귀는 상위 진입점으로 실행한다.

```bash
# cwd: <worktree>/quartz
bash scripts/verify-memory-atlas.sh
```

이 스크립트가 prettier, `tsc --noEmit`, `pnpm test`, Quartz 빌드와 임시 server 기동까지 하고 마지막에 브라우저 회귀를 부른다.
`verify-memory-atlas-browser.mjs` 를 직접 부르면 정적 server 주소 인자가 없어 `exit 2` 로 끝나고, 빌드 산출물이 없으면 harness 파일을 쓸 자리가 없다.
포트가 이미 쓰이고 있으면 `MEMORY_ATLAS_VERIFY_PORT` 와 `MEMORY_ATLAS_VERIFY_WS_PORT` 로 옮긴다.

종료 코드가 `0` 이어야 한다.

```bash
# cwd: <worktree>/
git diff --check
```

마지막으로 `tasks/plan12-atlas-2d-viewport/index.json` 의 `status` 를 `completed`, `current_phases` 를 `2` 로 바꾼다.

## 의도 메모 (왜)

- `전체 보기` 와 `전체 지도로` 를 나눈 이유는 두 동작이 되돌리는 대상이 다르기 때문이다. 하나는 시야, 하나는 선택이다. 합치면 확대해서 보던 중 선택만 풀 방법이 없어진다.
- `resetViewport` 를 선택 메서드로 둔 이유는 3D 가 카메라 복원을 이미 자체 처리하기 때문이다. 필수로 만들면 3D 에 빈 구현이 생긴다.
- 3D 에서 버튼을 숨기는 이유는 선택 메서드가 없는 handle 에서 버튼이 아무 일도 하지 않기 때문이다. 보이는데 반응하지 않는 컨트롤보다 감추는 쪽이 낫다.

## Blocked 조건

- `browser-driver` 가 없으면 `PHASE_BLOCKED: browser-driver 미설치` 를 출력하고 끝낸다.
