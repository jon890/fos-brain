# Phase 01 role 필드 정규화와 그래프 제외

**Execution profile**: standard

---

## 목표

문서 frontmatter의 `role` 필드를 읽어 콘텐츠 색인에 담고, `role`이 `navigation`인 문서를 Memory Atlas 그래프의 노드와 연결 계산에서 제외한다.

목차와 활동 기록은 거의 모든 문서를 가리킨다. 실측으로 `wiki/INDEX.md`가 65개, `private/wiki/INDEX.md`가 15개 링크를 가진다.
private 문서가 모두 15개라 private 목차는 사실상 전체와 연결돼 있다.
이 문서들이 노드로 남으면 무관한 두 문서가 목차를 거쳐 2 hop이 되고, 힘 기반 배치에서 목차가 모든 노드를 끌어당긴다.

**범위 외**: 실제 문서에 frontmatter를 넣는 일과 화면 회귀 확인은 Phase 02가 담당한다.
2D 지도의 이동과 배율은 plan12, Quartz fork 경계 정리는 plan13이 담당한다.

---

## 작업 항목 (4)

### 1. `quartz/quartz/components/knowledgeMetaData.ts` — `role` 정규화 추가

`KnowledgeRole` 타입을 `"navigation"` 단일 값으로 선언하고 `KnowledgeMetaData`에 선택 필드 `role?: KnowledgeRole`을 더한다.
`normalizeKnowledgeRole(value: unknown): KnowledgeRole | undefined`를 만든다.
기존 `normalizeKnowledgeStatus`와 같은 방식으로 문자열을 `trim` 하고 소문자로 바꾼 뒤 `navigation`일 때만 값을 돌려주고 나머지는 `undefined`를 돌려준다.
`normalizeKnowledgeMetaData`가 이 결과를 `role`로 담는다.

### 2. `quartz/quartz/plugins/emitters/contentIndex.tsx` — 색인에 `role` 전달

`ContentDetails`에 선택 필드 `role?: KnowledgeRole`을 더하고 `knowledgeMetaData`에서 타입을 import 한다.
`linkIndex.set` 호출에서 `role: metadata.role`을 함께 담는다.
`simplifiedIndex`를 만들 때 `role`을 삭제하지 않는다. 브라우저가 읽어야 하는 값이다.

### 3. `quartz/quartz/components/memoryAtlasData.ts` — 노드와 연결에서 제외

`MemoryAtlasNode`에는 `role`을 담지 않는다. 제외된 문서는 노드 자체가 만들어지지 않으므로 담을 곳이 없다.
`buildMemoryAtlasData`에서 `entries`를 정렬한 직후, `role`이 `"navigation"`인 항목을 걸러낸 배열로 이후 계산을 진행한다.
`validSlugs`, 링크 수집, 차수 계산과 노드 생성이 모두 걸러낸 배열을 기준으로 동작해야 한다.
제외된 문서를 가리키는 다른 문서의 링크는 대상 slug가 `validSlugs`에 없으므로 기존 조건에서 자연히 빠진다.

### 4. `quartz/quartz/components/memoryAtlasData.test.ts` — 단위 검사 추가

세 가지를 검사한다.

- `role: "navigation"`인 항목이 `nodes`에 없다.
- 그 항목이 source이거나 target인 링크가 `links`에 없다.
- 그 항목만 가리키던 문서의 `degree`가 그만큼 줄어든다.
- `role`이 `"NAVIGATION"`처럼 대소문자가 다르면 같게 제외되고, `role: "hub"`처럼 모르는 값이면 노드가 유지된다.

기존 검사가 노드 수나 링크 수를 단언하고 있으면 fixture에 `role` 항목을 넣지 않는 한 값이 달라지지 않는다. 값이 달라지면 fixture를 고치지 말고 원인을 먼저 확인한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `quartz/quartz/components/knowledgeMetaData.ts` | 수정 |
| `quartz/quartz/plugins/emitters/contentIndex.tsx` | 수정 |
| `quartz/quartz/components/memoryAtlasData.ts` | 수정 |
| `quartz/quartz/components/memoryAtlasData.test.ts` | 수정 |

## 검증

```bash
# cwd: <worktree>/quartz
pnpm test
pnpm exec tsc --noEmit
pnpm exec prettier --check quartz/components/knowledgeMetaData.ts quartz/plugins/emitters/contentIndex.tsx quartz/components/memoryAtlasData.ts quartz/components/memoryAtlasData.test.ts
```

```bash
# cwd: <worktree>/
git diff --check
```

`pnpm test` 출력에 이 phase에서 추가한 네 검사가 모두 통과로 나와야 한다.

## 의도 메모 (왜)

- 제외 대상을 코드에 slug로 적지 않은 이유는 ADR-011에 있다. 네임스페이스가 늘거나 항해 문서가 추가될 때 코드를 고치지 않기 위해서다.
- `type`의 값을 늘리지 않은 이유도 같다. `type`은 지식의 유형이고 `role`은 문서의 성격이라 축이 다르며, `type`을 읽는 그래프 색상과 필터가 함께 흔들린다.
- 노드에 `role`을 담지 않는 이유는 제외된 문서가 노드로 만들어지지 않기 때문이다. 값을 담아 두면 읽는 쪽이 없는 필드가 생긴다.
