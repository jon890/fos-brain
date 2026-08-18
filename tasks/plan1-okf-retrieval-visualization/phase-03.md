# Phase 03 — Quartz 지식 메타데이터와 유형 그래프

**Execution profile**: standard

---

## 목표

사람이 페이지의 의미와 신뢰 상태를 먼저 읽고, 그래프에서 지식 유형을 구분해 탐색하게 한다.

**범위 외**: qmd 순위와 wiki 본문 작성 규칙은 앞 phase의 책임이다.

---

## 작업 항목 (4)

### 1. 지식 메타데이터 컴포넌트 추가

`quartz/quartz/components/KnowledgeMeta.tsx`와 전용 SCSS를 추가한다.
설명, type, status, stale_after, generated, verified, sources를 안전하게 정규화해 표시한다.
누락 필드는 숨기고 잘못된 선택 필드 때문에 페이지 렌더를 중단하지 않는다.

### 2. 페이지 레이아웃 연결

`quartz/quartz/components/index.ts`에서 컴포넌트를 내보낸다.
`quartz/quartz.layout.ts`의 문서 제목 아래에 지식 메타데이터를 배치한다.
목록 페이지에는 추가하지 않는다.

### 3. 콘텐츠 색인에 문서 유형 전달

`quartz/quartz/plugins/emitters/contentIndex.tsx`의 `ContentDetails`에 선택 `type`을 추가한다.
frontmatter type을 정규화해 그래프 데이터에 포함한다.

### 4. 유형별 그래프와 범례 구현

`quartz/quartz/components/Graph.tsx`에 concept, topic, entity, 기타 범례를 추가한다.
`quartz/quartz/components/scripts/graph.inline.ts`는 type을 노드 데이터에 전달하고 유형별 색을 사용한다.
현재 문서 강조, 방문 표시, 태그 노드의 기존 의미는 유지한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `quartz/quartz/components/KnowledgeMeta.tsx` | 신규 |
| `quartz/quartz/components/styles/knowledgeMeta.scss` | 신규 |
| `quartz/quartz/components/KnowledgeMeta.test.tsx` | 신규 |
| `quartz/quartz/components/index.ts` | 수정 |
| `quartz/quartz.layout.ts` | 수정 |
| `quartz/quartz/plugins/emitters/contentIndex.tsx` | 수정 |
| `quartz/quartz/components/Graph.tsx` | 수정 |
| `quartz/quartz/components/scripts/graph.inline.ts` | 수정 |
| `quartz/quartz/components/styles/graph.scss` | 수정 |

## 검증

```bash
# cwd: <worktree>/quartz
pnpm test
pnpm check
pnpm quartz build
```

메타데이터 단위 검사, 형 검사, 공개 정적 빌드가 성공해야 한다.

## 의도 메모 (왜)

- 본문을 읽기 전에 의미와 신뢰 신호를 보여줘 탐색 비용을 줄인다.
- 기존 Graph 구현을 확장해 별도 시각화 라이브러리를 도입하지 않는다.
