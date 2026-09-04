# Phase 02 항해 문서 frontmatter 부여와 회귀 확인

**Execution profile**: standard

---

## 목표

목차와 활동 기록 문서 넷에 `role: navigation` frontmatter를 넣고, Memory Atlas 화면에서 이 문서들이 노드로 나타나지 않는 것을 확인한다.

**범위 외**: `role` 정규화와 제외 로직은 Phase 01이 만든다. 이 phase는 실제 문서와 화면만 다룬다.

**선행 조건**: 이 phase는 Phase 01이 만드는 `knowledgeMetaData.ts`의 `normalizeKnowledgeRole`과 `memoryAtlasData.ts`의 제외 로직을 전제한다. 두 곳이 없으면 `PHASE_BLOCKED: Phase 01 미완료`로 끝낸다.

---

## 작업 항목 (3)

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

### 3. 화면 회귀 확인

`quartz/scripts/verify-memory-atlas-browser.mjs`가 이미 있다. 이 스크립트를 실행해 기존 회귀가 깨지지 않았는지 확인한다.
브라우저 조작은 `~/.claude/scripts/browser-driver`만 사용한다. 첫 명령 전에 `browser-driver help`를 읽는다.
2D 지도에서 `INDEX`와 `log` 라벨을 가진 노드 버튼이 없어야 한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `wiki/INDEX.md` | 수정 |
| `wiki/log.md` | 수정 |
| `private/wiki/INDEX.md` | 수정 (gitignore 대상) |
| `private/wiki/log.md` | 수정 (gitignore 대상) |
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
node scripts/verify-memory-atlas-browser.mjs
```

종료 코드가 `0` 이어야 한다.

```bash
# cwd: <worktree>/
git diff --check
git status --short wiki/
```

`wiki/INDEX.md`와 `wiki/log.md` 두 파일만 수정으로 나와야 한다.

마지막으로 `tasks/plan11-atlas-navigation-nodes/index.json` 의 `status` 를 `completed`, `current_phases` 를 `2` 로 바꾼다.

## 의도 메모 (왜)

- `type`을 넣지 않는 이유는 이 문서들이 지식 문서가 아니기 때문이다. 유형이 비어 있어야 할 문서에 유형을 만들어 주면 그래프 필터가 잘못된 후보를 얻는다.
- 페이지 렌더를 유지하는 이유는 목차와 활동 기록이 사람에게는 계속 필요하기 때문이다. 빠지는 것은 관계 계산뿐이다.

## Blocked 조건

- `private/wiki/` 가 없는 환경이면 public 둘만 고치고 그 사실을 결과에 적는다. 이것은 blocked 가 아니다.
- `browser-driver` 가 없으면 `PHASE_BLOCKED: browser-driver 미설치` 를 출력하고 끝낸다.
