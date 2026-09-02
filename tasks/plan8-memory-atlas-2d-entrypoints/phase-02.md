# Phase 02 혼합 graph 배치와 시작점 계산

**Execution profile**: deep

---

## 목표

실제 wiki link, 공통 tag와 qmd 의미 관계를 혼합해 결정적 2D 전체 좌표, 선택 중심 hop 관계와 고정·자동 시작점을 DOM 없이 계산한다.

**범위 외**: Preact 화면, 2D renderer, 3D runtime 분리, browser event와 시각 회귀는 plan9가 구현한다.

---

## 작업 항목 (4)

### 1. 혼합 관계 계약

`quartz/quartz/components/memoryAtlasGraph.ts`에 정규화된 undirected `MemoryAtlasWeightedEdge`와 계산 option을 정의한다.
wiki link는 방향이 하나라도 있으면 `wiki: true`, 공통 tag는 Jaccard `tagScore`, 의미 edge는 `semanticScore`로 기록한다.
혼합 계수는 `wikiWeight > tagWeight > semanticWeight > 0` 순서를 지키고 `wikiWeight > tagWeight + semanticWeight`가 되도록 invariant를 코드와 검사로 고정한다.
같은 endpoint 쌍은 하나로 합치되 화면이 실제 link와 계산 관계를 구분할 수 있도록 신호별 값을 보존한다.

### 2. 결정적 전체·지역 배치

D3 force 계산은 입력을 복제하고 고정 seed, 고정 tick과 stable slug 정렬을 사용해 같은 입력에서 같은 좌표를 반환한다.
전체 배치는 혼합 weight가 큰 문서가 무관한 문서보다 가까워지도록 link distance와 force를 계산한다.
선택 중심 배치는 실제 wiki link만으로 최단 hop depth를 구한다.
선택 노드를 중앙에 두고 depth별 영역에 관계 노드를 배치하며, 선택 관계 밖 노드는 기존 전체 좌표를 그대로 반환한다.
다른 slug를 선택하면 해당 slug를 중심으로 depth와 좌표를 새로 계산하고 선택 해제 시 전체 좌표를 복원한다.

### 3. 고정·자동 시작점 분석

고정 최상위 시작점은 `career`, `health`, `ai`이며 AI의 자식 focus는 `rag`다.
각 정의는 사용자 label과 slug, 제목, tag match 조건을 가지며 현재 노드에서 대표 slug를 결정적으로 고른다.
일치하는 문서가 없으면 disabled 결과를 반환하고 다른 namespace의 노드를 추정하지 않는다.

자동 시작점은 혼합 graph의 결정적 weighted community 분석으로 후보를 만들고, dominant tag와 weighted degree가 가장 높은 대표 노드로 label과 진입 slug를 정한다.
최소 community 크기, 최대 후보 수와 고정 시작점 중복 제거 option을 제공한다.
후보는 메모리에서만 반환하고 콘텐츠 색인이나 의미 산출물에 쓰지 않는다.

### 4. 품질·결정성·공개 범위 단위 검사

RAG 검색 파이프라인, GraphRAG와 임베딩 색인 fixture가 무관한 건강·커리어 fixture보다 가깝게 배치되는지 검사한다.
wiki link가 의미 유사성보다 강한지, 입력 순서를 바꿔도 edge, 좌표와 시작점 순서가 같은지 검사한다.
1-hop, 2-hop 이상, 연결되지 않은 노드의 depth와 좌표를 검사하고 중심 slug 변경과 선택 해제를 반복한다.
public fixture는 public 노드만으로 시작점을 계산하며 private fixture의 slug, 제목과 tag가 결과 label에 남지 않는지 검사한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `quartz/quartz/components/memoryAtlasGraph.ts` | 혼합 graph, 배치, hop과 시작점 계산 추가 |
| `quartz/quartz/components/memoryAtlasGraph.test.ts` | 품질·결정성·privacy fixture 추가 |
| `quartz/quartz/components/memoryAtlasData.ts` | `mode: 2d\|3d` 최소 상태와 의미 관계 연결 타입 추가 |
| `quartz/quartz/components/memoryAtlasData.test.ts` | 기본 2D 상태와 파생값 비저장 회귀 추가 |
| `tasks/plan8-memory-atlas-2d-entrypoints/index.json` | 완료 상태 수정 |

## 검증

```bash
# cwd: <worktree>/quartz
pnpm test
pnpm exec tsc --noEmit
pnpm exec prettier --check quartz/components/memoryAtlasGraph.ts quartz/components/memoryAtlasGraph.test.ts quartz/components/memoryAtlasData.ts quartz/components/memoryAtlasData.test.ts
```

```bash
# cwd: <worktree>/
node --test quartz/scripts/generate-memory-atlas-semantics.test.mjs
scripts/verify-public-infra-boundary.sh
~/.claude/scripts/korean-style-check.sh docs/prd.md docs/flow.md docs/code-architecture.md docs/data-schema.md docs/memory-atlas-design.md docs/adr/002-memory-atlas-3d-home.md docs/adr/008-memory-atlas-2d-semantic-navigation.md docs/adr/INDEX.md
python3 ~/.claude/scripts/check-readability.py docs/prd.md docs/flow.md docs/code-architecture.md docs/data-schema.md docs/memory-atlas-design.md docs/adr/002-memory-atlas-3d-home.md docs/adr/008-memory-atlas-2d-semantic-navigation.md docs/adr/INDEX.md
git diff --check
```

검증이 모두 성공하면 `tasks/plan8-memory-atlas-2d-entrypoints/index.json`의 `status`를 `completed`, `current_phases`를 `2`로 바꾼다.

## 의도 메모 (왜)

- graph 품질과 화면 표현을 분리해 좌표와 시작점 오류를 browser 없이 재현한다.
- 원래 wiki link를 계산한 유사성보다 강하게 유지해 시각적 근접이 실제 지식 관계를 왜곡하지 않게 한다.
- 결정적 결과를 사용해 지식 변경이 없는데 매번 지도가 달라지는 문제를 막는다.
