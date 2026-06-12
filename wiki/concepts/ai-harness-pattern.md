---
type: concept
created: 2026-05-28
updated: 2026-06-01
---

# AI 하네스 패턴

기획부터 릴리스까지 개발 전 주기를 Claude Code 스킬로 자동화한 재사용 워크플로우.
새 프로젝트를 시작하면 이 하네스를 통째로 포팅한다.

## 핵심 포인트

- **표준 파이프라인** — 5단계 순서로 실행한다.
  - `planning` — 8단계 설계 ([[planning-eight-step-design]])
  - `plan-and-build` / `build-with-teams` — 구현 ([[build-with-teams-rules]])
  - `review-fix` — PR 리뷰 자동 반영 ([[pr-review-fix-workflow]])
  - `docs-check` — 문서 검증 ([[docs-six-axis-audit]])
  - `release`
- **Agent Teams 협업** — `build-with-teams` 가 4역할로 작성과 검증을 분리한다.
  - 역할: team-lead, critic, executor, docs-verifier
  - 같은 컨텍스트에서 자기승인 금지
- **task / phase 분해** — 작업을 번호 task 로 쪼개고, phase 당 항목을 5개 이하로 제한한다(초과 시 후반부 누락 실증).
- **토큰 라우팅** — 목적별로 모델을 다르게 쓴다.
  - 계획 — opus
  - task 실행 — sonnet
  - 검증·커밋 — haiku
- **내부/공개 스킬 분리**
  - `.claude/skills/` — 개발 워크플로우
  - `skills/` — 공개 사용법
- **하네스 우선**: nhncloud-cli 는 코드 0줄 상태에서 하네스부터 포팅 — "도구를 만들기 전에 도구 만드는 공정을 표준화".

## 하네스란 + MVP 구축 워크플로우

하네스를 한 줄로 정의하면 `실행 계획 + 완료 조건 + 컨텍스트 참조` 다.

- **실행 계획** — 무엇을 어떤 순서로 만드나(Phase 분리).
- **완료 조건** — 각 Phase 가 언제 끝나나(빌드 성공·CLI 실행 등 기계적으로 판단 가능한 조건).
- **컨텍스트 참조** — 에이전트가 어떤 문서를 읽고 실행하나.

AI 에이전트로 MVP 를 처음부터 만들 때의 3단계 워크플로우다(dooray-cli 사례).

1. **양질의 컨텍스트** — 대화로 기술적 결정을 깊이 쌓는다.
2. **하네스 엔지니어링** — 문서를 기반으로 Phase 를 분리하고 에이전트가 자율 구현한다.
3. **기능 추가·문서화** — 추가 구현마다 문서를 누적·정제해 에이전트의 판단력을 높이는 루프.

각 단계는 이전 산출물에 의존한다 — 1이 부실하면 2에서 에이전트가 방향을 잃는다.

> 핵심 통찰: 에이전트가 잘 동작하는 이유는 코드를 잘 짜서가 아니라 **실행 전에 문서가 충분히 정제돼 있기 때문**이다.

## 관련 개념

- [[ai-dev-harness]] — 이 패턴과 단계별 방법론을 묶는 상위 주제
- [[planning-eight-step-design]] — 1단계 planning 의 8단계 설계 방법론 (seed)
- [[pr-review-fix-workflow]] — 3단계 review-fix 의 PR 리뷰 사후 반영 방법론 (seed)
- [[docs-six-axis-audit]] — 4단계 docs-check 의 6축 점검 방법론 (seed)
- [[self-improving-harness]] — 하네스가 리뷰 학습을 스스로 누적
- [[build-with-teams-rules]] — build-with-teams 파이프라인의 repo 무관 운영 규칙
- [[docs-first-adr]] — planning 단계가 의사결정을 docs 로 산출
- [[commit-convention-style]] — review-fix·release 가 강제하는 커밋 규약
- [[ai-code-review-github-actions]] — PR 자동 리뷰를 GitHub Actions 로 붙이는 워크플로우 (review-fix 의 입력원)
- [[agent-friendly-cli-design]] — 하네스가 다루는 도구(CLI)를 에이전트가 안정적으로 호출하도록 만드는 설계
- [[merge-conflict-free-append]] — 하네스가 쌓는 누적 docs(ADR·pitfalls)의 머지 충돌을 파일 per 항목 + INDEX 로 없애는 구조 패턴

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
- [[../../raw/repos/2026-06-01-dooray-cli-tool-analysis.md]]
