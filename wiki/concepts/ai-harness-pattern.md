---
type: concept
created: 2026-05-28
updated: 2026-05-28
---

# AI 하네스 패턴

기획부터 릴리스까지 개발 전 주기를 Claude Code 스킬로 자동화한 재사용 워크플로우.
새 프로젝트를 시작하면 이 하네스를 통째로 포팅한다.

## 핵심 포인트

- **표준 파이프라인** — 5단계 순서로 실행한다.
  - `planning` — 8단계 설계
  - `plan-and-build` / `build-with-teams` — 구현
  - `review-fix` — PR 리뷰 자동 반영
  - `docs-check` — 문서 검증
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

## 관련 개념

- [[self-improving-harness]] — 하네스가 리뷰 학습을 스스로 누적
- [[docs-first-adr]] — planning 단계가 의사결정을 docs 로 산출
- [[commit-convention-style]] — review-fix·release 가 강제하는 커밋 규약

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
