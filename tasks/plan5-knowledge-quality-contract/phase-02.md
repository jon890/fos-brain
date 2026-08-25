# Phase 02 행동 평가와 플러그인 영속화

**Execution profile**: standard

---

## 목표

대표 요청에서 지식 유입 정책이 실제로 같은 행동을 만들도록 평가하고, 갱신한 플러그인을 Claude Code와 Codex CLI의 다음 세션에도 적용한다.

**범위 외**: 기존 wiki 내용의 수정과 홈서버 배포는 수행하지 않는다.

---

## 작업 항목 (4)

### 1. 재실행 가능한 skill 평가 작성

skill-creator 절차에 따라 brain-add와 brain-curate의 `evals/evals.json`을 만든다.
일반 기술 설명, 개인 홈서버 경계, 회사 내부 장애 기록, 일회성 코드 우회법, 개인 이력과 취향 요청을 포함한다.
각 평가에는 저장 여부, 목적지, 필요한 근거, 사용자 미리보기에서 보여야 할 제외 이유를 기대값으로 적는다.
같은 사례를 `.agents/plugin/fos-brain/evals/knowledge-admission/` 아래 Claude Code plugin eval 형식의 `prompt.md`와 `graders/`로 만든다.
`claude plugin eval`이 worktree 플러그인을 대상으로 실제 실행하고 1.0 통과선을 적용할 수 있어야 한다.

### 2. 이전 스킬과 새 스킬 행동 비교

Phase 01 commit 직후와 Phase 02 수정 전 `BASELINE_COMMIT=$(git rev-parse HEAD^)`로 planning commit을 고정한다.
`git archive "$BASELINE_COMMIT" .agents/plugin/fos-brain`으로 변경 전 플러그인을 임시 디렉터리에 복원하고 새 eval 묶음만 복사한다.
같은 `claude plugin eval` 명령을 기준 버전과 worktree 플러그인에 각각 실행하고 JSON 결과와 HTML 보고서는 저장소 밖 임시 디렉터리에 둔다.
새 플러그인은 모든 필수 기대값을 통과해야 하며 기준 버전과 새 결과의 점수와 실패 항목을 phase 보고에 남긴다.
별도 native subagent가 새 스킬 결과를 판정하며, 회사 자료의 개인 brain 저장이나 승인 없는 저장은 즉시 실패로 처리한다.
새 스킬이 모든 보안 필수 항목을 통과하지 못하면 정책이나 스킬을 고친 뒤 다시 평가한다.

### 3. 플러그인 버전과 설치본 갱신

Codex와 Claude Code 플러그인 manifest 버전을 `0.2.0`으로 맞춘다.
소스 검사와 평가가 통과한 뒤 `WORKTREE=/Users/nhn/personal/fos-brain/.claude/worktrees/plan5-knowledge-quality-contract`를 사용해 설치한다.
현재 두 CLI의 `fos-brain` marketplace가 가리키는 main 경로를 먼저 기록한다.
marketplace를 worktree의 `.agents/plugin/fos-brain`으로 임시 교체하고 Codex는 `codex plugin add fos-brain@fos-brain`, Claude Code는 `claude plugin update fos-brain@fos-brain -y`로 갱신한다.
성공과 실패 경로 모두에서 marketplace source를 원래 main 경로로 복원하고 두 CLI의 marketplace 목록으로 복원을 확인한다.
플러그인 설치 캐시만 `0.2.0`으로 유지하며 marketplace source를 worktree에 남기지 않는다.
설치된 Codex와 Claude Code 캐시의 정책 파일 hash가 소스와 같고 다섯 스킬이 공용 정책을 참조하는지 확인한다.

### 4. 통합 검증과 task 완료 기록

지식 유입 계약 검사, 기존 OKF 내보내기 검사, 검색 벤치마크, 수정한 모든 skill 검사, 문서 검사를 실행한다.
검증이 성공하면 `tasks/plan5-knowledge-quality-contract/index.json`의 `status`를 `completed`, `current_phases`를 `2`로 바꾼다.
검증이 실패하면 완료 상태를 기록하지 않는다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `.agents/plugin/fos-brain/skills/brain-add/evals/evals.json` | 신규 |
| `.agents/plugin/fos-brain/skills/brain-curate/evals/evals.json` | 신규 |
| `.agents/plugin/fos-brain/evals/knowledge-admission/` | 실행 가능한 plugin eval 사례 신규 |
| `.agents/plugin/fos-brain/plugin.json` | 버전 수정 |
| `.agents/plugin/fos-brain/.claude-plugin/plugin.json` | 버전 수정 |
| `tasks/plan5-knowledge-quality-contract/index.json` | 완료 상태 수정 |

## 검증

```bash
# cwd: <worktree>/
node --test .agents/plugin/fos-brain/tests/knowledge-admission.test.cjs .agents/plugin/fos-brain/tests/okf-export.test.cjs
node .agents/plugin/fos-brain/scripts/retrieval-benchmark.cjs .agents/plugin/fos-brain/tests/fixtures/retrieval-public.json
for skill in brain-add brain-curate brain-search brain-lint brain-delete; do python3 /Users/nhn/.codex/skills/.system/skill-creator/scripts/quick_validate.py ".agents/plugin/fos-brain/skills/$skill"; done
eval_root=$(mktemp -d)
claude plugin eval .agents/plugin/fos-brain --eval-dir evals/knowledge-admission --ablation with-without --runs 1 --threshold 1 --no-publish --output-dir "$eval_root/new" --json "$eval_root/new.json" --report "$eval_root/new.html"
git diff --check
```

두 manifest 버전이 같고, 소스와 설치 캐시의 `knowledge-admission-policy.md` SHA-256 값이 같아야 한다.
기준 버전과 새 플러그인 평가 JSON이 모두 존재하고 새 플러그인 점수가 모든 사례에서 1.0이어야 한다.
평가 결과에서 회사 자료가 personal brain으로 향하거나 승인 없는 저장이 한 건이라도 있으면 실패다.

## 의도 메모 (왜)

- 문서 존재 검사만으로는 실제 에이전트 행동을 보장할 수 없어 대표 프롬프트를 반복 평가한다.
- 소스 저장소만 고치면 플러그인 캐시를 쓰는 다음 세션에는 반영되지 않으므로 재설치와 hash 검증을 같은 phase에서 닫는다.
