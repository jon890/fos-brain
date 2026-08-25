# Phase 01 지식 유입 정책과 스킬 계약

**Execution profile**: deep

---

## 목표

fos-brain에 저장할 가치가 있는 개인 지식과 다른 시스템이 관리할 정보를 하나의 정책으로 구분하고 모든 관련 스킬이 같은 판정을 사용하게 한다.

**범위 외**: 기존 public·private wiki의 일괄 분류와 삭제, 실제 지식 큐레이션, 홈서버 배포는 이 phase에서 수행하지 않는다.

---

## 작업 항목 (4)

### 1. 단일 지식 유입 정책 작성

`.agents/plugin/fos-brain/references/knowledge-admission-policy.md`를 만든다.
정책은 업무 방식과 하네스, 취향, 결정과 근거, 개인 서비스와 환경, 이력과 경험, 장기 적용되는 도메인 지식을 저장 가치 축으로 정의한다.
모든 저장 후보는 미래 질문, 6개월 지속성, 개인적 특수성이나 결정 연결, 올바른 단일 소스, 출처, 공개 범위를 통과해야 한다.
단순 설명, 일회성 작업, 코드와 git으로 자명한 사실, 실행 절차, 행동 규칙, 좁은 장애 우회법, 일시 상태를 각각 제외하거나 skill, AGENTS.md, 저장소 문서로 보낸다.
회사 내부 지식은 public과 private 어느 쪽에도 저장하지 않고 nbrain으로 보낸다.

### 2. 판정 기록 검사와 대표 fixture 추가

`.agents/plugin/fos-brain/scripts/knowledge-admission-check.cjs`를 만든다.
입력 JSON의 각 후보가 `candidate`, `decision`, `value_axes`, `future_question`, `durability_reason`, `destination`, `source_of_truth`, `sensitivity`, `freshness`, `evidence`, `reason` 계약을 만족하는지 검사한다.
의미 적합성을 자동 점수로 결정하지 않고 허용값과 조합만 검사한다.
`.agents/plugin/fos-brain/tests/fixtures/knowledge-admission.json`에는 개인 하네스 근거, 개인 서비스 경계, 이력, 개인 취향, 회사 내부 자료, 일반 설명, 일회성 PR, 실행 절차 사례를 넣는다.
`.agents/plugin/fos-brain/tests/knowledge-admission.test.cjs`는 유효 fixture 통과, 잘못된 회사 목적지, 근거 없는 저장, 알 수 없는 값의 실패, 단일 정책 참조를 검사한다.

### 3. 관련 스킬을 정책에 연결

brain-add는 source를 임시 위치에서 읽고 판정과 승인 뒤에만 raw와 wiki에 저장한다.
승인할 후보가 없으면 raw, wiki, INDEX, log, qmd 상태를 바꾸지 않는다.
brain-curate는 추출 기준보다 먼저 공용 정책을 읽고 같은 판정 스키마로 후보를 합친다.
brain-search는 환원 후보를 공용 정책으로 다시 판정한다.
brain-lint는 품질 점검에서 정책 위반을 유지, 갱신, 병합, 보관, 삭제 후보로 분류한다.
brain-delete는 정책 점검 결과를 삭제 사유로 받을 수 있게 하되 사용자 승인과 raw 보존 원칙을 유지한다.
`brain-curate/references/extraction-criteria.md`는 중복 기준을 복사하지 않고 공용 정책을 참조한다.

### 4. 프로젝트 지침과 네임스페이스 정합성 수정

`AGENTS.md`와 `CLAUDE.md`에는 정책의 짧은 요약과 공용 정책 경로만 남긴다.
상세 판정표를 두 파일에 복사하지 않는다.
brain-lint와 brain-delete에 남은 `work` 네임스페이스 계약을 제거하고 개인 brain은 public·private 둘뿐임을 맞춘다.
회사 자료는 nbrain 대상이라는 기존 보안 경계를 유지한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `.agents/plugin/fos-brain/references/knowledge-admission-policy.md` | 신규 |
| `.agents/plugin/fos-brain/scripts/knowledge-admission-check.cjs` | 신규 |
| `.agents/plugin/fos-brain/tests/fixtures/knowledge-admission.json` | 신규 |
| `.agents/plugin/fos-brain/tests/knowledge-admission.test.cjs` | 신규 |
| `.agents/plugin/fos-brain/skills/brain-add/SKILL.md` | 수정 |
| `.agents/plugin/fos-brain/skills/brain-curate/SKILL.md` | 수정 |
| `.agents/plugin/fos-brain/skills/brain-curate/references/extraction-criteria.md` | 수정 |
| `.agents/plugin/fos-brain/skills/brain-search/SKILL.md` | 수정 |
| `.agents/plugin/fos-brain/skills/brain-lint/SKILL.md` | 수정 |
| `.agents/plugin/fos-brain/skills/brain-delete/SKILL.md` | 수정 |
| `AGENTS.md` | 수정 |
| `CLAUDE.md` | 수정 |

## 검증

```bash
# cwd: <worktree>/
node --test .agents/plugin/fos-brain/tests/knowledge-admission.test.cjs
node .agents/plugin/fos-brain/scripts/knowledge-admission-check.cjs .agents/plugin/fos-brain/tests/fixtures/knowledge-admission.json
for skill in brain-add brain-curate brain-search brain-lint brain-delete; do python3 /Users/nhn/.codex/skills/.system/skill-creator/scripts/quick_validate.py ".agents/plugin/fos-brain/skills/$skill"; done
~/.claude/scripts/korean-style-check.sh AGENTS.md CLAUDE.md .agents/plugin/fos-brain/references/knowledge-admission-policy.md .agents/plugin/fos-brain/skills/brain-add/SKILL.md .agents/plugin/fos-brain/skills/brain-curate/SKILL.md .agents/plugin/fos-brain/skills/brain-curate/references/extraction-criteria.md .agents/plugin/fos-brain/skills/brain-search/SKILL.md .agents/plugin/fos-brain/skills/brain-lint/SKILL.md .agents/plugin/fos-brain/skills/brain-delete/SKILL.md
python3 ~/.claude/scripts/check-readability.py AGENTS.md CLAUDE.md .agents/plugin/fos-brain/references/knowledge-admission-policy.md .agents/plugin/fos-brain/skills/brain-add/SKILL.md .agents/plugin/fos-brain/skills/brain-curate/SKILL.md .agents/plugin/fos-brain/skills/brain-curate/references/extraction-criteria.md .agents/plugin/fos-brain/skills/brain-search/SKILL.md .agents/plugin/fos-brain/skills/brain-lint/SKILL.md .agents/plugin/fos-brain/skills/brain-delete/SKILL.md
```

모든 명령이 성공하고 `rg -n 'public.*private.*work|private.*work|work/<회사>' .agents/plugin/fos-brain/skills`가 결과를 내지 않아야 한다.

## 의도 메모 (왜)

- 상세 기준을 한 파일에 두어 다음 세션과 여러 스킬의 판정 차이를 막는다.
- 의미 판단과 기계 검사를 분리해 정적 점수가 개인적 가치를 대신하지 않게 한다.
- 저장 전에 판정해 제외할 소스가 raw부터 쌓이는 문제를 막는다.
