---
type: entity
created: 2026-05-28
updated: 2026-05-28
---

# dooray-cli

NHN Dooray REST API 를 래핑한 CLI(`@bifos/dooray-cli`, npm 공개, MIT). 하네스의 원형.

## 개요

- 스택: TypeScript strict, Node>=20, commander, ky, tsup, vitest, pnpm.
- 아키텍처: `api/ → resolvers/ → commands/ → formatters/`. 입력 통합 헬퍼로 `<project> <num>`·`--id`·`--url` 흡수. `DoorayCliError(message, exitCode)`. 데이터 stdout / 에러 stderr 분리(에이전트 친화).
- 하네스: planning·plan-and-build·build-with-teams·docs-check·review-fix·release 6스킬. 커스텀 에이전트(executor·docs-verifier) 정의.

## 특이점

- 가장 성숙한 하네스 원형 — nhncloud-cli 가 이를 포팅했다.
- `tasks/` 번호 디렉터리로 작업 추적, PR 리뷰 학습을 스킬에 누적.

## 보여주는 스타일

- [[../concepts/ai-harness-pattern]]
- [[../concepts/commit-convention-style]]
- [[../concepts/tech-stack-preferences]]
- [[../topics/work-style]]

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
