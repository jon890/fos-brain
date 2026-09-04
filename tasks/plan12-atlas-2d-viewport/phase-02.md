# Phase 02 전체 보기 동작과 화면 회귀

**Execution profile**: standard

---

## 목표

이동과 배율을 처음 상태로 되돌리는 `전체 보기` 동작을 붙이고, 2D 지도의 조작이 실제 브라우저에서 동작하는 것을 확인한다.

**범위 외**: 드래그와 휠 handler 자체는 Phase 01이 만든다.

**선행 조건**: 이 phase는 Phase 01이 만드는 `memoryAtlas2dRuntime.ts` 의 viewport 상태와 `memory-atlas-2d__viewport` 래퍼를 전제한다. 둘이 없으면 `PHASE_BLOCKED: Phase 01 미완료`로 끝낸다.

---

## 작업 항목 (3)

### 1. runtime 에 초기화 동작을 노출한다

`memoryAtlasRuntimeTypes.ts` 의 공통 handle 에 `resetViewport(): void` 를 선택 메서드로 더한다.
3D runtime 은 이미 카메라 복원을 자체 처리하므로 구현하지 않아도 되는 선택 메서드로 둔다.

2D runtime 은 `resetViewport` 에서 `viewport` 를 `{ x: 0, y: 0, k: 1 }` 로 되돌리고 래퍼 transform 만 갱신한다. 장면을 다시 만들지 않는다.

`select` 로 중심 노드가 바뀔 때도 같은 초기화를 함께 수행한다.
선택으로 배치가 다시 계산되는데 이전 이동값이 남아 있으면 새 중심이 화면 밖에 있을 수 있다.

### 2. `전체 보기` 버튼

`memoryAtlasView.tsx` 의 2D 조작 영역에 버튼을 하나 더한다.
라벨은 `전체 보기`, `type="button"` 이며 접근 가능한 이름을 가진다.
`data-memory-atlas-reset-viewport` 속성으로 controller 가 찾을 수 있게 한다.

`memoryAtlasController.ts` 가 이 버튼의 `click` 에서 현재 runtime handle 의 `resetViewport` 를 호출한다.
handle 에 그 메서드가 없으면 아무 일도 하지 않는다.
선택 상태는 바꾸지 않는다. 이동과 배율만 되돌린다.

기존 `전체 지도로` 는 선택을 해제하는 별개 동작이다. 두 버튼을 합치지 않는다.

### 3. 브라우저 회귀

`quartz/scripts/memory-atlas-browser-assertions.mjs` 와 `verify-memory-atlas-browser.mjs` 에 2D 조작 판정을 더한다.

- 지도의 빈 곳을 끌면 `memory-atlas-2d__viewport` 의 `transform` 이 바뀐다.
- 노드 위에서 끌어도 지도가 움직인다. 손을 뗀 뒤 선택 노드가 바뀌지 않는다.
- `전체 보기` 를 누르면 `transform` 이 처음 값으로 돌아가고 선택은 유지된다.

브라우저 조작은 `~/.claude/scripts/browser-driver` 만 사용한다. 첫 명령 전에 `browser-driver help` 를 읽는다.
숨은 요소나 겹친 화면은 드라이버의 `js` 명령으로 다룬다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `quartz/quartz/components/scripts/memoryAtlasRuntimeTypes.ts` | 수정 |
| `quartz/quartz/components/scripts/memoryAtlas2dRuntime.ts` | 수정 |
| `quartz/quartz/components/memoryAtlasView.tsx` | 수정 |
| `quartz/quartz/components/scripts/memoryAtlasController.ts` | 수정 |
| `quartz/scripts/memory-atlas-browser-assertions.mjs` | 수정 |
| `tasks/plan12-atlas-2d-viewport/index.json` | 수정 |

## 검증

```bash
# cwd: <worktree>/quartz
pnpm test
pnpm exec tsc --noEmit
pnpm exec prettier --check quartz/components/scripts/memoryAtlasRuntimeTypes.ts quartz/components/scripts/memoryAtlas2dRuntime.ts quartz/components/memoryAtlasView.tsx quartz/components/scripts/memoryAtlasController.ts
```

단위 검사에 다음 셋을 추가한다.

- `resetViewport` 호출 뒤 래퍼 `transform` 이 처음 값과 같다.
- `select` 로 중심을 바꾸면 이동과 배율이 초기화된다.
- `resetViewport` 를 구현하지 않은 handle 에 controller 가 호출해도 예외가 나지 않는다.

```bash
# cwd: <worktree>/quartz
node scripts/verify-memory-atlas-browser.mjs
```

종료 코드가 `0` 이어야 한다.

```bash
# cwd: <worktree>/
git diff --check
```

마지막으로 `tasks/plan12-atlas-2d-viewport/index.json` 의 `status` 를 `completed`, `current_phases` 를 `2` 로 바꾼다.

## 의도 메모 (왜)

- `전체 보기` 와 `전체 지도로` 를 나눈 이유는 두 동작이 되돌리는 대상이 다르기 때문이다. 하나는 시야, 하나는 선택이다. 합치면 확대해서 보던 중 선택만 풀 방법이 없어진다.
- `resetViewport` 를 선택 메서드로 둔 이유는 3D 가 카메라 복원을 이미 자체 처리하기 때문이다. 필수로 만들면 3D 에 빈 구현이 생긴다.

## Blocked 조건

- `browser-driver` 가 없으면 `PHASE_BLOCKED: browser-driver 미설치` 를 출력하고 끝낸다.
