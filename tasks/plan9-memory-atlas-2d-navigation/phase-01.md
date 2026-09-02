# Phase 01 Preact 화면 조각과 renderer 생명주기 분리

**Execution profile**: deep

---

## 목표

기존 Memory Atlas를 기본 2D와 선택형 3D runtime으로 전환할 수 있는 최소 상태 controller와 작은 Preact SSR 컴포넌트 구조로 나눈다.

**범위 외**: 2D 노드·연결선 렌더링과 시작점의 최종 시각 표현은 Phase 02, browser-driver 회귀는 Phase 03이 담당한다.

**선행 조건**: 이 phase는 plan8이 만드는 `memoryAtlasSemantics.ts`, `memoryAtlasGraph.ts`와 `/static/memory-atlas-semantics.json`을 전제한다. plan8이 main에 머지되지 않았으면 이 브랜치를 최신 `origin/main`으로 rebase한 뒤 해당 파일을 확인하고, 없으면 `PHASE_BLOCKED: plan8 의미 관계 기반 미머지`로 끝낸다.

---

## 작업 항목 (4)

### 1. Preact SSR 화면 조각 분리

`MemoryAtlas.tsx`는 전체 shell 조합과 Quartz resource 연결만 담당한다.
`memoryAtlasView.tsx`에 모드 전환, 시작점 영역, 현재 중심·depth 문맥과 전체 지도 복귀 동작을 typed props 컴포넌트로 나눈다.
서버 렌더 단계의 문서 목록 fallback과 기존 질문·filter·상세의 접근 가능한 HTML을 유지한다.
React 의존성, `preact/compat`와 별도 client hydration을 추가하지 않는다.

### 2. 최소 상태 controller

`memoryAtlas.inline.ts`는 `nav` event에서 controller를 시작하는 얇은 진입점으로 줄인다.
`memoryAtlasController.ts`는 `mode`, `selectedSlug`, 검색과 filter만 canonical 상태로 저장한다.
선택 노드 객체, visible graph, hop depth, 좌표, 강조 집합과 시작점은 plan8 순수 함수에서 계산하고 controller 상태에 복제하지 않는다.
상태 변경은 사용자 event handler에서 처리하며 선택 slug가 filter 결과에서 사라지면 선택을 해제한다.

기존 Brain 질문의 질문·답변 비저장, abort, 근거 강조 해제와 검색 초기화 동작을 보존한다.
기존 sessionStorage를 사용할 때 mode를 추가하고 예전 저장값에는 `2d` 기본값을 적용한다.

### 3. 공통 renderer 계약과 runtime 분리

`memoryAtlasRuntimeTypes.ts`에 `update`, `select`, `recenter`, `setEvidenceSlugs`, `destroy`를 가진 공통 handle과 mount 입력을 정의한다.
현재 `memoryAtlasRuntime.ts`의 3D 구현을 `memoryAtlas3dRuntime.ts`로 옮기되 camera 복원, 질문 근거 강조와 자원 정리를 유지한다.
controller는 mode가 바뀔 때 이전 handle의 `destroy`를 먼저 호출하고 선택한 runtime만 동적으로 불러온다.

`memoryAtlasAssets.ts`는 2D와 3D 진입점을 별도 ESM 파일로 bundle한다.
기본 2D에서 `three`와 `3d-force-graph` bundle을 요청하지 않고 `3D 조망`을 처음 선택할 때만 내려받는다.

### 4. 상태와 생명주기 단위 검사

기본 mode, 예전 저장 상태 복원, mode 전환 시 filter·selection 유지와 선택 노드 filter 제외를 검사한다.
mock renderer로 `destroy` 뒤 update가 호출되지 않고 mode 전환과 SPA 재초기화마다 handle 하나만 살아 있는지 검사한다.
질문 패널 닫기와 SPA cleanup 뒤 질문 closure, fetch, renderer와 listener가 정리되는 기존 회귀를 유지한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `quartz/quartz/components/MemoryAtlas.tsx` | shell 조합과 resource 경계로 축소 |
| `quartz/quartz/components/memoryAtlasView.tsx` | typed Preact SSR 조각 추가 |
| `quartz/quartz/components/scripts/memoryAtlas.inline.ts` | SPA 진입점으로 축소 |
| `quartz/quartz/components/scripts/memoryAtlasController.ts` | 최소 상태와 event controller 추가 |
| `quartz/quartz/components/scripts/memoryAtlasRuntimeTypes.ts` | 공통 renderer 생명주기 계약 추가 |
| `quartz/quartz/components/scripts/memoryAtlas3dRuntime.ts` | 기존 3D runtime 이동 |
| `quartz/quartz/plugins/emitters/memoryAtlasAssets.ts` | 2D·3D bundle 분리 |
| `quartz/quartz/components/memoryAtlasController.test.ts` | 상태와 renderer cleanup 회귀 추가 |

## 검증

```bash
# cwd: <worktree>/quartz
pnpm test
pnpm exec tsc --noEmit
pnpm exec prettier --check quartz/components/MemoryAtlas.tsx quartz/components/memoryAtlasView.tsx quartz/components/scripts/memoryAtlas.inline.ts quartz/components/scripts/memoryAtlasController.ts quartz/components/scripts/memoryAtlasRuntimeTypes.ts quartz/components/scripts/memoryAtlas3dRuntime.ts quartz/plugins/emitters/memoryAtlasAssets.ts
node -e 'const p=require("./package.json"); if (p.dependencies?.react || p.devDependencies?.react) process.exit(1)'
```

```bash
# cwd: <worktree>/
scripts/verify-public-infra-boundary.sh
git diff --check
```

3D mode를 선택하기 전 local server의 network 기록에는 3D runtime 요청이 없어야 한다.

## 의도 메모 (왜)

- Quartz의 Preact 서버 렌더와 fallback을 유지하면서 화면 책임만 나눠 새 hydration 상태 계층을 만들지 않는다.
- 파생값을 상태로 복제하지 않아 filter, 선택과 renderer 사이의 불일치를 막는다.
- 2D와 3D의 제거 계약을 같게 만들어 SPA 재탐색과 모드 전환의 자원 누수를 한 경계에서 검사한다.
