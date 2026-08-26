# Phase 01: 3D 의존성과 그래프 데이터 계약

**Execution profile**: standard

---

## 목표

Memory Atlas가 정적 콘텐츠 색인만으로 검색, 필터, 집계, 노드 상세를 결정적으로 계산하게 한다.

**범위 외**: 3D canvas와 홈 화면 배치는 다음 phase가 담당한다.

---

## 작업 항목 (4)

### 1. 3D 의존성 추가

`quartz/package.json`에 `3d-force-graph@1.80.0`과 `three@0.185.1`을 정확한 버전으로 추가하고 `quartz/pnpm-lock.yaml`을 갱신한다.
브라우저 전역을 참조하는 모듈은 이 phase의 순수 데이터 파일에서 import하지 않는다.
이 저장소의 package manager는 pnpm이므로 기존 `quartz/package-lock.json`은 수정하지 않는다.

### 2. 콘텐츠 색인 메타데이터 확장

`quartz/quartz/plugins/emitters/contentIndex.tsx`의 `ContentDetails`에 선택 `description`, `status`, `freshness`, `updated`, `sourceCount`를 추가한다.
`normalizeKnowledgeMetaData`의 결과와 Quartz `getDate`를 사용하며 잘못된 선택 필드는 생략한다.
기존 `slug`, `filePath`, `title`, `links`, `tags`, `content`, `type` 계약과 RSS 출력은 유지한다.

### 3. Memory Atlas 순수 데이터 모듈 구현

`quartz/quartz/components/memoryAtlasData.ts`에 `MemoryAtlasNode`, `MemoryAtlasLink`, `MemoryAtlasData`, `MemoryAtlasState`, `MemoryAtlasFacets` 타입을 정의한다.
`buildMemoryAtlasData`, `filterMemoryAtlas`, `deriveMemoryAtlasFacets`, `inferMemoryNamespace`를 export한다.
유효하지 않은 링크, self-link, 중복 source-target 쌍은 제외하고 `_private/` slug만 private로 분류한다.
검색은 제목과 태그의 대소문자를 구분하지 않는 부분 일치이며 필터 묶음 사이는 AND, 같은 묶음 안에서는 OR로 결합한다.

### 4. 순수 함수 회귀 검사

`quartz/quartz/components/memoryAtlasData.test.ts`에 sparse metadata, 중복 연결, public/private 분류, 검색, 복합 필터, 빈 결과, 집계 사례를 추가한다.
private 제목과 설명을 검사 실패 출력에 직접 포함하지 않고 slug와 개수로 판정한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `quartz/package.json` | 의존성 추가 |
| `quartz/pnpm-lock.yaml` | lockfile 갱신 |
| `quartz/quartz/plugins/emitters/contentIndex.tsx` | 색인 필드 확장 |
| `quartz/quartz/components/memoryAtlasData.ts` | 신규 |
| `quartz/quartz/components/memoryAtlasData.test.ts` | 신규 |

## 검증

```bash
# cwd: <worktree>/quartz
pnpm install --frozen-lockfile
pnpm test
pnpm exec tsc --noEmit
```

테스트는 공개 색인에 `_private/` 항목이 없으면 private facet도 생성되지 않는다는 계약을 포함해야 한다.

## 의도 메모 (왜)

- 3D 렌더러와 필터 계산을 분리해 canvas 없이 핵심 결과를 검사한다.
- frontmatter를 일괄 보강하지 않고 현재 있는 신호만 선택 필드로 전달한다.
