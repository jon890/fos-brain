# Phase 01 커스텀 코드 디렉터리 분리와 재수출 제거

**Execution profile**: deep

---

## 목표

이 저장소가 만든 Quartz 컴포넌트, 렌더러, emitter 와 스타일을 `quartz/quartz/**` 밖으로 옮기고, 업스트림 재수출 목록에서 뺀다.

`quartz/` 는 최초 커밋에 업스트림을 복사해 넣은 것이라 공통 조상이 없다.
업스트림 파일 안에 자체 코드가 섞여 있으면 갱신할 때마다 같은 파일에서 두 변경이 만난다.
판정 근거와 기각한 대안은 ADR-012에 있다.

**범위 외**: `renderPage.tsx` 와 `contentIndex.tsx` 수정 제거는 Phase 02, 문서별 그래프 원복과 remote 연결은 Phase 03이 담당한다.
plan11 과 plan12 가 이 파일들을 함께 고치므로 두 plan 이 main 에 머지된 뒤 시작한다.

**선행 조건**: 이 phase 는 plan11 과 plan12 가 main 에 머지된 상태를 전제한다.
시작 전에 `git fetch origin` 후 `git log origin/main --oneline | head -20` 으로 두 plan 의 커밋이 있는지 확인한다.
없으면 `PHASE_BLOCKED: plan11 또는 plan12 미머지` 를 출력하고 끝낸다.

---

## 작업 항목 (4)

### 1. `quartz/custom/` 디렉터리를 만들고 자체 파일을 옮긴다

아래 파일을 `git mv` 로 옮긴다. 내용은 바꾸지 않고 import 경로만 맞춘다.

- `quartz/quartz/components/` 의 `MemoryAtlas.tsx`, `KnowledgeMeta.tsx`, `memoryAtlasView.tsx`, `memoryAtlasData.ts`, `memoryAtlasGraph.ts`, `memoryAtlasSemantics.ts`, `knowledgeMetaData.ts` 와 각각의 `.test.ts`
- `quartz/quartz/components/scripts/` 의 `memoryAtlas.inline.ts`, `memoryAtlasController.ts`, `memoryAtlasRuntimeTypes.ts`, `memoryAtlas2dRuntime.ts`, `memoryAtlas3dRuntime.ts` 와 각각의 `.test.ts`
- `quartz/quartz/components/styles/` 의 `memoryAtlas.scss`, `knowledgeMeta.scss`
- `quartz/quartz/plugins/emitters/memoryAtlasAssets.ts`

옮긴 뒤 디렉터리 구조는 `quartz/custom/components/`, `quartz/custom/components/scripts/`, `quartz/custom/components/styles/`, `quartz/custom/emitters/` 로 둔다.
업스트림의 구조를 그대로 따라야 상대 경로 import 수정이 최소가 된다.

`memoryAtlasAssets.ts` 의 esbuild `entryPoints` 가 `process.cwd()` 기준 절대 경로를 만들고 있다. 새 경로로 함께 고친다.

### 2. 업스트림 재수출 목록에서 뺀다

`quartz/quartz/components/index.ts` 에서 `KnowledgeMeta`, `MemoryAtlas` 의 import 와 export 를 지운다.
`quartz/quartz/plugins/emitters/index.ts` 에서 `MemoryAtlasAssets` export 를 지운다.

두 파일이 업스트림과 정확히 같아져야 한다. Phase 03 에서 이것을 검사한다.

### 3. 설정 파일이 경로로 직접 불러온다

`quartz.layout.ts` 가 `Component.MemoryAtlas`, `Component.KnowledgeMeta` 대신 `quartz/custom/components/` 에서 직접 import 한다.
`quartz.config.ts` 가 `Plugin.MemoryAtlasAssets` 대신 `quartz/custom/emitters/memoryAtlasAssets` 에서 직접 import 한다.

두 파일은 업스트림이 사용자 편집을 전제한 설정 파일이라 수정해도 된다.

### 4. 업스트림에서 커스텀 코드로 들어오는 참조를 끊는다

`quartz/quartz/components/scripts/graph.inline.ts` 가 `knowledgeMetaData` 의 타입을 import 하고 있다.
이 파일은 Phase 03 에서 업스트림으로 되돌릴 대상이므로, 여기서는 import 만 지우고 해당 코드가 쓰던 타입을 지역 정의로 바꾼다.
Phase 03 에서 파일 전체를 원복하면 이 지역 정의도 함께 사라진다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `quartz/custom/**` | 신규 (이동) |
| `quartz/quartz/components/index.ts` | 수정 (업스트림 복원) |
| `quartz/quartz/plugins/emitters/index.ts` | 수정 (업스트림 복원) |
| `quartz.layout.ts` | 수정 |
| `quartz.config.ts` | 수정 |
| `quartz/quartz/components/scripts/graph.inline.ts` | 수정 (임시) |

## 검증

```bash
# cwd: <worktree>/quartz
pnpm exec tsc --noEmit
pnpm test
pnpm quartz build
```

빌드가 성공하고 `public/static/memory-atlas-2d.js`, `public/static/memory-atlas-3d.js` 두 파일이 생성돼야 한다.

```bash
# cwd: <worktree>/quartz
grep -rn "memoryAtlas\|knowledgeMeta\|MemoryAtlas\|KnowledgeMeta" quartz/components/index.ts quartz/plugins/emitters/index.ts | wc -l
```

기대값은 `0` 이다.

```bash
# cwd: <worktree>/
git diff --check
```

## 의도 메모 (왜)

- 업스트림 디렉터리 구조를 그대로 따라 옮기는 이유는 상대 경로 import 수정을 최소로 줄이기 위해서다.
- 설정 파일 둘을 예외로 둔 이유는 업스트림이 이 파일들을 사용자 편집 대상으로 만들었기 때문이다. 병합 때 충돌해도 그것이 정상 동작이다.
- `graph.inline.ts` 를 임시로 고치고 Phase 03 에서 원복하는 이유는, 지금 원복하면 이 phase 의 빌드가 깨지기 때문이다.
