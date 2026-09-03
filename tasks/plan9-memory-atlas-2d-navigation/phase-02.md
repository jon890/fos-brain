# Phase 02 2D 전체·지역 관계와 시작점 UI

**Execution profile**: deep

---

## 목표

의미가 가까운 지식을 전체 2D 해역에 모으고, 선택한 노드의 실제 wiki 관계를 중앙에서 여러 hop으로 읽을 수 있는 탐색 화면을 완성한다.

**범위 외**: 의미 edge 생성과 graph 계산 알고리즘은 plan8, 반복 browser 실행기는 Phase 03이 담당한다.

---

## 작업 항목 (4)

### 1. 2D renderer와 접근 가능한 노드

Phase 01의 최소 `memoryAtlas2dRuntime.ts`를 plan8의 전체·지역 좌표를 쓰는 renderer로 확장한다.
SVG에는 실제 wiki 연결선과 계산한 의미 관계선을 그린다.
wiki link는 단단한 항로, 의미 관계는 가늘고 옅은 해류로 구분한다.
노드는 SVG 안의 text가 아니라 절대 배치한 HTML button으로 만들고 모든 제목을 표시한다.
button은 click, `Enter`와 `Space`로 선택하며 현재 선택, hop depth와 namespace를 `aria-label`과 data attribute로 제공한다.

ResizeObserver와 움직임 줄이기 media query를 처리한다.
`destroy`는 observer, event, animation frame과 생성한 DOM을 정리하며 이후 호출을 무시한다.

Phase 01에서 분리한 2D bundle은 `three`와 `3d-force-graph`를 import하지 않는다.
controller는 `3D 조망`을 처음 선택할 때만 3D bundle을 동적으로 불러온다.

### 2. 전체 지도와 선택 중심 지역 관계

처음에는 결정적 전체 좌표를 사용한다.
노드를 선택하면 선택 노드를 중앙에 두고 실제 wiki link의 hop depth별 좌표로 전환한다.
1-hop을 가장 밝게 표시하고 다음 depth마다 노드, 제목과 연결선 opacity를 낮춘다.
선택 관계 밖의 노드는 전체 좌표에 낮은 opacity로 남긴다.
연결 노드를 선택하면 해당 노드를 새 중심으로 재계산하고 `전체 지도로`나 `Escape`로 선택을 해제하면 전체 좌표를 복원한다.

움직임 줄이기 환경에서는 중간 animation 없이 최종 좌표를 즉시 적용한다.
일반 환경의 전환은 사용자 동작 하나에 대한 단일 위치 전환만 사용하고 노드마다 별도 등장 animation을 넣지 않는다.

### 3. 고정·자동 시작점과 mode 문맥

왼쪽 탐색 메뉴에서 filter보다 먼저 `시작점`을 표시한다.
커리어, 건강과 AI를 같은 위계로 두고 RAG를 AI 아래 `현재 집중`으로 들여쓴다.
현재 빌드에 대표 노드가 없으면 항목을 disabled 상태와 짧은 설명으로 표시한다.
자동 후보는 `발견한 영역`으로 분리하고 고정 항목과 같은 시각 위계로 보이지 않게 한다.

시작점을 선택하면 2D mode로 전환하고 대표 slug를 중심으로 지역 관계를 연다.
그래프 위 문맥 bar는 `전체 지도로`, 현재 중심 제목과 depth 범례를 제공한다.
상단의 `2D 관계`와 `3D 조망` 전환은 현재 filter와 선택을 유지한다.

### 4. 반응형·상태 스타일과 순수 계산 회귀

`memoryAtlas.scss`는 기존 심해 항해도 token을 재사용하고 새 SaaS card나 별도 색상 체계를 추가하지 않는다.
1440px에서는 시작점 rail, 문맥 bar와 상세 panel이 graph를 가리지 않게 배치한다.
390px에서는 mode 전환과 작은 filter 동작만 topbar에 남기고 시작점은 왼쪽 drawer, 상세는 아래 sheet에서 보여준다.
긴 제목, 자동 영역 label과 depth 범례가 viewport 가로 넘침을 만들지 않게 한다.

Node 단위 검사는 2D scene model의 모든 노드 제목, 선택과 depth attribute, disabled 시작점, public 입력의 private label 부재를 확인한다.
renderer 생명 주기는 주입한 최소 container·observer fake로 검사하며 새 DOM test runtime 의존성은 추가하지 않는다.
실제 HTML button, SVG, 2D·3D 전환 후 남은 renderer DOM과 반응형 배치는 Phase 03의 browser-driver 회귀가 확인한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `quartz/quartz/components/scripts/memoryAtlas2dRuntime.ts` | 2D SVG·HTML renderer 추가 |
| `quartz/quartz/components/memoryAtlasView.tsx` | 시작점과 관계 문맥 구조 연결 |
| `quartz/quartz/components/scripts/memoryAtlasController.ts` | mode·시작점·지역 관계 event 연결 |
| `quartz/quartz/components/styles/memoryAtlas.scss` | 2D 전체·지역·반응형 상태 추가 |
| `quartz/quartz/components/memoryAtlas2dRuntime.test.ts` | scene model, 접근성 속성과 cleanup 회귀 추가 |

## 검증

```bash
# cwd: <worktree>/quartz
pnpm test
pnpm exec tsc --noEmit
pnpm exec prettier --check quartz/components/memoryAtlasView.tsx quartz/components/scripts/memoryAtlas2dRuntime.ts quartz/components/scripts/memoryAtlasController.ts quartz/components/styles/memoryAtlas.scss quartz/components/memoryAtlas2dRuntime.test.ts
```

```bash
# cwd: <worktree>/
scripts/verify-public-infra-boundary.sh
git diff --check
```

fixture에서 RAG 대표 노드를 선택한 뒤 GraphRAG 노드를 다시 선택하면 `selectedSlug`, 중앙 좌표와 hop depth가 GraphRAG 기준으로 바뀌어야 한다.
선택 해제 뒤 모든 노드 좌표는 처음의 전체 좌표와 같아야 한다.

## 의도 메모 (왜)

- 화면에 보이는 관계선과 키보드가 선택하는 노드를 분리해 2D 시각 품질과 접근성을 함께 유지한다.
- 전체 좌표를 배경으로 남겨 지역 관계를 읽는 동안 전체 지식 안의 위치를 잃지 않게 한다.
- 고정 시작점과 계산한 후보를 다른 이름과 위계로 보여 사용자 설정과 분석 결과를 혼동하지 않게 한다.
