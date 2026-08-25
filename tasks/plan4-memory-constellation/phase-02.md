# Phase 02: Memory Atlas 3D 탐색 엔진

**Execution profile**: deep

---

## 목표

Quartz 루트 홈에서 실제 3D 그래프를 회전·확대·검색하고 노드 상세와 원문으로 이동하게 한다.

**범위 외**: 최종 색상과 반응형 세부 표현은 다음 phase가 담당한다.

---

## 작업 항목 (4)

### 1. 홈 전용 컴포넌트 구조

`quartz/quartz/components/MemoryAtlas.tsx`에 필터 레일, 검색 입력, 3D canvas 컨테이너, 결과 목록, 노드 상세, 모바일 열기 버튼, 로딩·빈 상태·오류 상태를 실제 HTML 요소로 만든다.
`allFiles`의 제목과 slug로 기본 결과 목록을 server-render해 콘텐츠 색인이나 WebGL 초기화가 실패해도 원문 이동 경로를 남긴다.
`quartz/quartz/components/index.ts`에서 export하고 `quartz/quartz.layout.ts`의 `beforeBody`에서 slug를 소문자로 바꾼 값이 `index`일 때만 렌더한다.
브라우저 검증이 안정된 selector를 사용하도록 주요 상태와 조작에 `data-testid`를 부여한다.
일반 문서는 Memory Atlas의 어두운 읽기 셸을 사용하고, 별도의 기존 `Graph`를 중복 초기화하지 않는다.

### 2. 별도 3D runtime asset

`quartz/quartz/components/scripts/memoryAtlasRuntime.ts`는 `3d-force-graph`와 `three`를 정적 import하고 렌더러 mount API를 export한다.
`quartz/quartz/plugins/emitters/memoryAtlasAssets.ts`는 esbuild로 runtime과 의존성을 하나의 ESM `/static/memory-atlas.js`로 묶어 내보낸다.
emitters index와 `quartz/quartz.config.ts`에 이 emitter를 등록한다.

`quartz/quartz/components/scripts/memoryAtlas.inline.ts`는 3D package를 직접 import하지 않는다.
Memory Atlas 요소의 `data-runtime-src` URL을 변수 기반 native `import()`로 불러와 Quartz inline loader의 정적 묶음에서 제외한다.
Memory Atlas가 없는 일반 문서에서는 runtime asset을 요청하지 않는다.
렌더 인스턴스, ResizeObserver, 이벤트, 애니메이션을 cleanup 함수 하나로 정리한 뒤 SPA 재진입을 처리한다.
렌더 실패 시 오류 상태와 결과 목록을 남기고 다시 시도 버튼으로 같은 초기화 흐름을 호출한다.

### 3. 탐색과 선택 동작

검색, 유형, 태그, 최신성, 네임스페이스 조건을 `filterMemoryAtlas`에 전달하고 그래프, 집계, 결과 목록을 함께 갱신한다.
노드 선택은 선택 노드와 직접 연결을 강조하고 카메라를 이동한 뒤 상세 패널을 연다.
상세에는 제목, 설명, 유형, 상태, 수정일, 태그, 들어오고 나가는 연결 수, 원문 열기 링크를 표시한다.
`Escape`는 상세와 모바일 필터를 닫으며 원문 링크는 Quartz `spaNavigate` 경로를 사용한다.

### 4. 배치와 표시 설정

별자리 `constellation`, 태그 중심 군집 `cluster`, 유형별 반지름을 쓰는 궤도 `orbit` 배치를 제공한다.
유형, 최신성, 네임스페이스 색상 기준과 compact, normal, wide 간격, 라벨 표시, 화면 중앙 정렬을 제공한다.
라벨은 Three.js sprite로 만들고 외부 라벨 패키지는 추가하지 않는다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `quartz/quartz/components/MemoryAtlas.tsx` | 신규 |
| `quartz/quartz/components/index.ts` | export 추가 |
| `quartz/quartz.layout.ts` | 루트 조건부 연결 |
| `quartz/quartz/components/scripts/memoryAtlas.inline.ts` | 신규 |
| `quartz/quartz/components/scripts/memoryAtlasRuntime.ts` | 신규 |
| `quartz/quartz/components/styles/memoryAtlas.scss` | 구조 스타일 신규 |
| `quartz/quartz/plugins/emitters/memoryAtlasAssets.ts` | 신규 |
| `quartz/quartz/plugins/emitters/index.ts` | emitter export 추가 |
| `quartz/quartz.config.ts` | runtime emitter 등록 |

## 검증

```bash
# cwd: <worktree>/quartz
pnpm test
pnpm exec tsc --noEmit
pnpm quartz build
rg -n 'memory-atlas|기억의 항해도' public/INDEX.html
test -s public/static/memory-atlas.js
test "$(wc -c < public/static/memory-atlas.js)" -gt 100000
! rg -q 'three.module|3d-force-graph' public/postscript.js
```

일반 문서 HTML에는 Memory Atlas 본문과 runtime 요청이 없어야 하며, 읽기 셸과 KnowledgeMeta는 남아 있어야 한다.
실제 browser network에서 runtime asset의 홈 전용 요청 여부는 Phase 04가 검증한다.

## 의도 메모 (왜)

- 참고 화면의 핵심인 3D 카메라와 필터 중심 정보 구조를 홈에만 적용한다.
- canvas 밖의 실제 HTML 결과 목록과 상세 패널을 유지해 WebGL이 유일한 탐색 경로가 되지 않게 한다.
