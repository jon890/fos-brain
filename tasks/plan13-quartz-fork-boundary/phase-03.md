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

## 작업 항목 (4)

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

복사 시점 커밋의 `quartz/` 트리와 이 저장소의 `quartz/quartz/` 를 비교해 차이가 있는 파일을 출력한다.
아래 셋은 업스트림이 사용자 편집을 전제한 파일이라 예외로 둔다.

- `quartz.config.ts`
- `quartz.layout.ts`
- `quartz/styles/custom.scss`

예외를 뺀 차이가 하나라도 있으면 종료 코드 `1` 로 끝내고 파일 목록을 출력한다.
차이가 없으면 종료 코드 `0` 이다.

`.npmrc`, `.prettierignore`, `package.json` 은 이 저장소의 도구 설정이라 예외 목록에 함께 넣는다.

### 4. 검증 문서에 이 검사를 등록한다

`docs/code-architecture.md` 의 `검증 경계` 절에 이 스크립트를 한 줄 더한다.
스크립트가 무엇을 막는지 한 문장으로 적는다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `quartz/quartz/components/Graph.tsx` | 수정 (업스트림 복원) |
| `quartz/quartz/components/scripts/graph.inline.ts` | 수정 (업스트림 복원) |
| `quartz/quartz/components/styles/graph.scss` | 수정 (업스트림 복원) |
| `quartz/UPSTREAM.md` | 신규 |
| `quartz/scripts/verify-upstream-untouched.sh` | 신규 |
| `docs/code-architecture.md` | 수정 |
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
node scripts/verify-memory-atlas-browser.mjs
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
