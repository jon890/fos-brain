# Phase 02 항해 문서 frontmatter 부여와 회귀 확인

**Execution profile**: standard

---

## 목표

목차와 활동 기록 문서 넷에 `role: navigation` frontmatter를 넣고, Memory Atlas 화면에서 이 문서들이 노드로 나타나지 않는 것을 확인한다.

**범위 외**: `role` 정규화와 제외 로직은 Phase 01이 만든다. 이 phase는 실제 문서와 화면만 다룬다.

**선행 조건**: 이 phase는 Phase 01이 만드는 `knowledgeMetaData.ts`의 `normalizeKnowledgeRole`과 `memoryAtlasData.ts`의 제외 로직을 전제한다. 두 곳이 없으면 `PHASE_BLOCKED: Phase 01 미완료`로 끝낸다.

---

## 작업 항목 (5)

### 1. 항해 문서 넷에 frontmatter 추가

아래 넷은 현재 frontmatter 블록 자체가 없다. 파일 맨 앞에 새로 만든다.

- `wiki/INDEX.md`
- `wiki/log.md`
- `private/wiki/INDEX.md`
- `private/wiki/log.md`

각 파일의 frontmatter는 `role: navigation` 한 필드만 넣는다.
`type`은 넣지 않는다. 이 문서들은 `concept`, `topic`, `entity` 중 어느 것도 아니다.
본문은 한 글자도 바꾸지 않는다. 특히 `wiki/log.md`는 append-only 계약이 있어 기존 항목을 건드리면 안 된다.

`private/` 는 gitignore 대상이라 commit 에 포함되지 않는다. 파일은 고치되 commit 대상에 올라오지 않는 것이 정상이다.

### 2. 공개 빌드로 제외 확인

빌드 산출물의 콘텐츠 색인에서 `INDEX`와 `log` 항목이 `role: "navigation"` 을 가지는지 확인한다.
빌드가 성공하고 두 문서의 HTML 페이지가 그대로 생성되는지도 함께 확인한다. 제외되는 것은 그래프 계산뿐이고 페이지는 계속 렌더돼야 한다.

### 3. 브라우저 단언에 제외 검사 추가

`quartz/scripts/memory-atlas-browser-assertions.mjs`에 2D 지도의 노드 버튼 부재를 단언하는 줄을 넣는다.
`.memory-atlas-2d__nodes button[data-slug="INDEX"]`와 `[data-slug="log"]`가 모두 없어야 한다.

넣을 자리는 `globalNodeCount`를 세는 전체 지도 시나리오다.
이 구간은 스텁된 `fetch`가 들어오기 전이라 실제 빌드의 `/static/contentIndex.json`으로 돈다.
스텁 구간에 넣으면 단언이 검사하는 것이 없어진다.

이 파일은 브라우저에서 돌 코드를 template literal에 담고 있다. 백틱과 `${}`의 이스케이프 규칙을 그대로 지킨다.
`verify-memory-atlas.sh`의 prettier 검사 목록에 이 파일이 들어 있어, 형식이 어긋나면 회귀가 `[1/5]` 단계에서 멈춘다. 자기 변경과 무관한 실패로 오해하지 않는다.

육안 확인만으로 두면 이 plan의 핵심 동작이 회귀 검사에서 빠진다.
`memoryAtlas2dRuntime.ts`와 `memoryAtlasView.tsx`는 다른 plan이 동시에 고치고 있어 건드리지 않는다. 단언 파일은 그 제약 대상이 아니다.

### 4. 화면 회귀 확인

`quartz/scripts/verify-memory-atlas.sh`가 전체 진입점이다.
`verify-memory-atlas-browser.mjs`를 직접 부르면 base URL 인자가 없어 종료 코드 2로 끝나므로 쓰지 않는다.
이 스크립트가 prettier, `tsc`, `pnpm test`, `quartz build --serve`, 브라우저 검증을 순서대로 돌린다.
브라우저 조작은 `~/.claude/scripts/browser-driver`만 사용한다. 첫 명령 전에 `browser-driver help`를 읽는다.

### 5. `CLAUDE.md` 페이지 스키마에 `role` 추가

루트 `CLAUDE.md`의 「페이지 스키마」 절이 `type`, `status`, `stale_after`, `sources`, `generated`, `verified`만 열거한다.
`role`을 더한다. brain-add와 brain-lint가 읽는 계약이라 여기 없으면 다음 문서에 `role`이 붙지 않는다.
목차와 활동 기록에만 `role: navigation`을 쓰고 일반 지식 문서에는 쓰지 않는다는 것을 함께 적는다.

`wiki/log.md`의 append-only 규칙도 한 줄 손본다.
현재 규칙은 기존 항목을 고치거나 지우지 않는다는 것만 말하고 파일 맨 앞 frontmatter 블록을 다루지 않는다.
frontmatter 추가는 그 규칙에 걸리지 않는다는 것을 명시한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `wiki/INDEX.md` | 수정 |
| `wiki/log.md` | 수정 |
| `private/wiki/INDEX.md` | 수정 (gitignore 대상) |
| `private/wiki/log.md` | 수정 (gitignore 대상) |
| `quartz/scripts/memory-atlas-browser-assertions.mjs` | 수정 |
| `CLAUDE.md` | 수정 |
| `tasks/plan11-atlas-navigation-nodes/index.json` | 수정 |

## 검증

```bash
# cwd: <worktree>/
head -4 wiki/INDEX.md wiki/log.md | grep -c 'role: navigation'
```

기대값은 `2` 다.

```bash
# cwd: <worktree>/quartz
pnpm quartz build
grep -o '"role":"navigation"' public/static/contentIndex.json | wc -l
```

기대값은 `2` 다. public 빌드에는 private 문서가 없다.

```bash
# cwd: <worktree>/quartz
bash scripts/verify-memory-atlas.sh
```

종료 코드가 `0` 이어야 하고 출력에 `Memory Atlas verification passed.` 가 나와야 한다.
그 줄 뒤에 로그 경로 두 줄이 더 찍히므로 마지막 줄로 찾지 않는다.

```bash
# cwd: <worktree>/
git diff --check
git status --short wiki/
git status --short CLAUDE.md quartz/scripts/memory-atlas-browser-assertions.mjs
```

`wiki/` 아래에서는 `INDEX.md`와 `log.md` 두 파일만 수정으로 나와야 한다.
`CLAUDE.md`와 `quartz/scripts/memory-atlas-browser-assertions.mjs`도 각각 수정으로 나와야 한다. 작업 항목 3과 5의 완료를 이것으로 확인한다.

마지막으로 `tasks/plan11-atlas-navigation-nodes/index.json` 의 `status` 를 `completed`, `current_phases` 를 `2` 로 바꾼다.

## 의도 메모 (왜)

- `type`을 넣지 않는 이유는 이 문서들이 지식 문서가 아니기 때문이다. 유형이 비어 있어야 할 문서에 유형을 만들어 주면 그래프 필터가 잘못된 후보를 얻는다.
- 페이지 렌더를 유지하는 이유는 목차와 활동 기록이 사람에게는 계속 필요하기 때문이다. 빠지는 것은 관계 계산뿐이다.
- **JS 없이 렌더된 목록은 이번 PR 에서 해결했다.** `memoryAtlasView.tsx` 의 `fallbackFiles` 에 frontmatter `role` 조건을 넣어, 색인 로딩이 실패했을 때 쓰는 목록에서도 항해 문서가 빠진다.

## 이 plan 범위 밖으로 남기는 것

아래 둘은 이번에 고치지 않는다. 다음 사람이 다시 찾지 않도록 여기 적어 둔다.

- **비공개 색인 재생성**: 관리자 로그인 후 그래프는 `services/brain-ask`가 `BRAIN_PRIVATE_CONTENT_INDEX_FILE` 경로에서 읽는 미리 만들어진 산출물을 쓴다. `private/wiki/`에 frontmatter를 넣어도 그 산출물을 quartz-local 빌드로 다시 만들기 전에는 관리자 화면에서 두 노드가 남는다. 이 worktree에는 `private/`이 없어 이번에는 공개 둘만 고친다.
- **의미 연결 생성기**: `quartz/scripts/generate-memory-atlas-semantics.mjs`는 콘텐츠 색인이 아니라 markdown 파일을 직접 읽으므로 목차와 활동 기록에 대해서도 계속 연결을 만든다. 런타임이 노드 slug로 걸러내 화면에는 나오지 않지만 산출물 안에는 쓰이지 않을 연결이 남는다.

## Blocked 조건

- `private/wiki/` 가 없는 환경이면 public 둘만 고치고 그 사실을 결과에 적는다. 이것은 blocked 가 아니다.
- `browser-driver` 가 없으면 `PHASE_BLOCKED: browser-driver 미설치` 를 출력하고 끝낸다.
- `verify-memory-atlas.sh` 가 포트 8096 이나 3096 이 이미 쓰인다고 끝내면 `MEMORY_ATLAS_VERIFY_PORT` 와 `MEMORY_ATLAS_VERIFY_WS_PORT` 를 빈 포트로 바꿔 다시 돌린다. 이것은 blocked 가 아니다.
