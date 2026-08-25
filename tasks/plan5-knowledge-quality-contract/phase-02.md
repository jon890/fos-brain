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

### 2. 이전 스킬과 새 스킬 행동 비교

변경 전 스킬을 임시 위치에 보존하고 같은 평가 프롬프트를 이전 스킬과 새 스킬에 각각 실행한다.
독립 subagent가 결과를 판정하며, 회사 자료의 개인 brain 저장이나 승인 없는 저장은 즉시 실패로 처리한다.
새 스킬이 모든 보안 필수 항목을 통과하지 못하면 정책이나 스킬을 고친 뒤 다시 평가한다.

### 3. 플러그인 버전과 설치본 갱신

Codex와 Claude Code 플러그인 manifest 버전을 `0.2.0`으로 맞춘다.
소스 검사와 평가가 통과한 뒤 로컬 마켓플레이스에서 fos-brain 플러그인을 다시 설치하거나 갱신한다.
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
| `.agents/plugin/fos-brain/plugin.json` | 버전 수정 |
| `.agents/plugin/fos-brain/.claude-plugin/plugin.json` | 버전 수정 |
| `tasks/plan5-knowledge-quality-contract/index.json` | 완료 상태 수정 |

## 검증

```bash
# cwd: <worktree>/
node --test .agents/plugin/fos-brain/tests/knowledge-admission.test.cjs .agents/plugin/fos-brain/tests/okf-export.test.cjs
node .agents/plugin/fos-brain/scripts/retrieval-benchmark.cjs .agents/plugin/fos-brain/tests/fixtures/retrieval-public.json
for skill in brain-add brain-curate brain-search brain-lint brain-delete; do python3 /Users/nhn/.codex/skills/.system/skill-creator/scripts/quick_validate.py ".agents/plugin/fos-brain/skills/$skill"; done
git diff --check
```

두 manifest 버전이 같고, 소스와 설치 캐시의 `knowledge-admission-policy.md` SHA-256 값이 같아야 한다.
평가 결과에서 회사 자료가 personal brain으로 향하거나 승인 없는 저장이 한 건이라도 있으면 실패다.

## 의도 메모 (왜)

- 문서 존재 검사만으로는 실제 에이전트 행동을 보장할 수 없어 대표 프롬프트를 반복 평가한다.
- 소스 저장소만 고치면 플러그인 캐시를 쓰는 다음 세션에는 반영되지 않으므로 재설치와 hash 검증을 같은 phase에서 닫는다.
