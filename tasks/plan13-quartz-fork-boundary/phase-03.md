# Phase 03 업스트림 원복과 remote 연결

**Execution profile**: standard

---

## 목표

문서별 그래프 수정을 업스트림 상태로 되돌리고, 업스트림을 remote 로 연결해 앞으로의 갱신을 병합으로 처리할 수 있게 한다.
그리고 업스트림 파일 수정이 실제로 남아 있지 않은지 검사로 확인한다.

**범위 외**: 커스텀 코드 분리는 Phase 01, 렌더 함수와 색인 수정 제거는 Phase 02가 담당한다.
업스트림 v5 로의 이전은 이 plan 의 범위가 아니다.

**선행 조건**: 이 phase 는 Phase 01 과 Phase 02 가 만든 `quartz/custom/` 구조를 전제한다. 없으면 `PHASE_BLOCKED: 앞 phase 미완료` 로 끝낸다.

---

## 작업 항목 (6)

### 1. 업스트림을 remote 로 연결한다

```bash
# cwd: <worktree>/
git remote add quartz-upstream https://github.com/jackyzha0/quartz.git
git fetch quartz-upstream
```

복사 시점 커밋은 `d25a6eabf96751ffca56f8a8139272def7a65041` 이다.
이 커밋은 업스트림의 `fix(citations): correct URL for CSL locales` 이며 2026-04-20 이다.

이 사실을 `quartz/UPSTREAM.md` 에 기록한다.
담을 내용은 remote 이름, 복사 시점 커밋 해시와 날짜, 갱신할 때 확인할 파일 목록이다.
갱신 절차를 산문으로 길게 적지 않는다. 어느 커밋이 기준인지와 어느 파일이 예외인지만 적는다.

### 2. 문서별 그래프 수정을 되돌린다

아래 셋을 업스트림 `d25a6ea` 상태로 되돌린다.

- `quartz/quartz/components/Graph.tsx`
- `quartz/quartz/components/scripts/graph.inline.ts`
- `quartz/quartz/components/styles/graph.scss`

```bash
# cwd: <worktree>/
git checkout quartz-upstream/v4 -- <경로>
```

로 되돌리지 않는다. 브랜치 tip 이 아니라 복사 시점 커밋 기준이어야 한다.
`git show d25a6eab:quartz/components/Graph.tsx` 처럼 해당 커밋의 내용을 꺼내 덮어쓴다.
업스트림 저장소의 경로에는 `quartz/` 접두사가 한 번만 붙는다.

이 셋은 본문 페이지 layout 이 `left: []`, `right: []` 라 현재 사용되지 않는다. 화면이 달라지지 않아야 한다.

### 3. 업스트림 수정 없음을 검사로 확인한다

`quartz/scripts/verify-upstream-untouched.sh` 를 새로 만든다.

경로는 두 가지로 표기된다. 스크립트 안에서 둘을 섞지 않는다.

| 기준 | 예 |
| --- | --- |
| 업스트림 기준 | `quartz/components/Graph.tsx`, `quartz.config.ts` |
| 이 저장소 기준 | `quartz/quartz/components/Graph.tsx`, `quartz/quartz.config.ts` |

업스트림 기준 경로 `P` 는 이 저장소의 `quartz/P` 에 대응한다.

비교 대상은 둘이다.

- 복사 시점 커밋의 `quartz/` 트리에 있는 모든 파일. 이 저장소에서 내용이 다르거나 없으면 잡는다.
- 복사 시점 커밋의 루트 파일 중 이 저장소의 `quartz/` 에 있는 것. 같은 방식으로 잡는다.
  업스트림에만 있고 이 저장소에 없는 루트 파일(`.github/` 등)은 처음부터 복사하지 않았으므로 세지 않는다.

여기에 더해 **이 저장소가 `quartz/quartz/` 아래 새로 만든 파일**도 잡는다.
경계가 무너지는 방향은 기존 파일을 고치는 것만이 아니라 업스트림 디렉터리에 파일을 새로 넣는 것도 있다.

아래 여섯을 예외로 둔다. 앞 셋은 업스트림이 사용자 편집을 전제한 파일이고, 뒤 셋은 이 저장소의 도구 설정이다.
경로는 업스트림 기준으로 적는다.

- `quartz.config.ts`
- `quartz.layout.ts`
- `quartz/styles/custom.scss`
- `.npmrc`
- `.prettierignore`
- `package.json`

예외를 뺀 차이가 하나라도 있으면 종료 코드 `1` 로 끝내고 파일 목록을 출력한다.
차이마다 `수정`, `삭제`, `추가` 중 무엇인지 함께 적는다.
차이가 없으면 종료 코드 `0` 이고 출력은 0 줄이다.

기준 커밋 해시는 스크립트 안에 한 번만 적고, 없으면 `quartz-upstream` 을 fetch 하라는 안내와 함께 종료 코드 `2` 로 끝낸다.

### 4. ADR-012 를 이전이 끝난 상태로 다시 쓴다

`docs/adr/012-quartz-fork-boundary.md` 는 수정 줄 수를 실측값으로 적고 있다.
plan11 이 콘텐츠 색인에 `role` 을 더해 그 값이 달라졌다.

원복과 이동을 마친 뒤 남은 수정을 다시 세어 그 문서의 숫자를 현재 값으로 고친다.
경계가 성립하면 남는 것은 설정 파일뿐이므로, 그 사실을 반영해 문장을 다시 쓴다.

`현재 상태` 절 전체가 이전 전 시점에 쓰였다.
`quartz/custom/` 이 없고 remote 도 붙어 있지 않으며 수정이 그대로 남아 있다고 적혀 있는데 셋 다 더는 사실이 아니다.
이 절을 이전이 끝난 상태로 다시 쓴다. 담을 것은 셋이다.

- 이전을 마쳤고 어느 plan 이 했는지
- 남은 예외 파일이 무엇인지
- 경계를 무엇이 지키는지 (`verify-upstream-untouched.sh`)

### 5. 원복으로 읽는 곳이 없어진 변수를 지운다

`quartz/quartz/styles/custom.scss` 의 `--graph-current-ring` 은 `graph.scss` 를 원복하면 읽는 곳이 없어진다.
`custom.scss` 는 예외 파일이라 검사에 걸리지 않지만, 쓰이지 않는 정의를 남길 이유가 없다.
지우기 전에 `grep -rn "graph-current-ring" quartz/` 로 다른 참조가 없는지 확인한다.

### 6. 검증 문서에 이 검사를 등록한다

`docs/code-architecture.md` 의 `검증 경계` 절에 이 스크립트를 한 줄 더한다.
스크립트가 무엇을 막는지 한 문장으로 적는다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `quartz/quartz/components/Graph.tsx` | 수정 (업스트림 복원) |
| `quartz/quartz/components/scripts/graph.inline.ts` | 수정 (업스트림 복원) |
| `quartz/quartz/components/styles/graph.scss` | 수정 (업스트림 복원) |
| `quartz/quartz/styles/custom.scss` | 수정 |
| `quartz/UPSTREAM.md` | 신규 |
| `quartz/scripts/verify-upstream-untouched.sh` | 신규 |
| `docs/code-architecture.md` | 수정 |
| `docs/adr/012-quartz-fork-boundary.md` | 수정 |
| `tasks/plan13-quartz-fork-boundary/index.json` | 수정 |

## 검증

```bash
# cwd: <worktree>/quartz
bash scripts/verify-upstream-untouched.sh
```

종료 코드가 `0` 이고 출력이 0 줄이어야 한다. 이것이 이 plan 의 최종 성공 기준이다.

```bash
# cwd: <worktree>/quartz
pnpm exec tsc --noEmit
pnpm test
pnpm quartz build
```

```bash
# cwd: <worktree>/quartz
MEMORY_ATLAS_VERIFY_PORT=8116 MEMORY_ATLAS_VERIFY_WS_PORT=3116 bash scripts/verify-memory-atlas.sh
```

종료 코드가 `0` 이어야 한다.

```bash
# cwd: <worktree>/
git diff --check
python3 ~/.claude/scripts/check-readability.py docs/code-architecture.md quartz/UPSTREAM.md
~/.claude/scripts/korean-style-check.sh docs/code-architecture.md quartz/UPSTREAM.md
```

마지막으로 `tasks/plan13-quartz-fork-boundary/index.json` 의 `status` 를 `completed`, `current_phases` 를 `3` 으로 바꾼다.

## 의도 메모 (왜)

- 브랜치 tip 이 아니라 복사 시점 커밋에서 파일을 꺼내는 이유는, tip 에는 복사 이후의 업스트림 변경이 섞여 있어 이번 원복과 업스트림 갱신이 한 커밋에 뭉치기 때문이다.
- 검사 스크립트를 만드는 이유는 경계가 사람의 기억으로만 유지되면 다음 작업에서 다시 무너지기 때문이다. 이 검사가 있어야 경계가 계약이 된다.
- 그래프 수정을 되돌리는 판단 근거는 ADR-012에 있다. 본문 페이지에서 사용하지 않아 화면이 달라지지 않는다.

## Blocked 조건

- 업스트림 저장소를 받을 수 없으면 `PHASE_BLOCKED: quartz-upstream fetch 실패` 를 출력하고 끝낸다.
