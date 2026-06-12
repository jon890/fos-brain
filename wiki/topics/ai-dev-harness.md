---
type: topic
created: 2026-06-01
updated: 2026-06-12
---

# AI 개발 하네스

기획부터 릴리스까지 개발 전 주기를 AI 에이전트로 자동화하는 방식을 묶는다.
"코드를 잘 짜는 것"이 아니라 "에이전트가 자율 실행할 환경(하네스)을 갖추는 것"이 핵심이다.

상위 개발 스타일([[work-style]])의 한 축이며, 그 안에서 AI 자동화에 특화된 주제다.

## 구성

- **핵심 패턴** — [[ai-harness-pattern]] 이 전체 파이프라인(planning→build→review→docs→release)을 정의한다.
- **단계별 방법론** — 각 단계가 독립 concept 로 깊어진다.
- **도구 설계** — 하네스가 다루는 CLI 를 에이전트가 안정적으로 쓰게 만든다.
- **자동 검증** — PR 리뷰를 CI 로 붙여 루프를 닫는다.

## Concepts

- [[ai-harness-pattern]] — 전 주기 스킬 파이프라인과 MVP 구축 워크플로 (핵심 허브)
- [[planning-eight-step-design]] — 구현 전 8단계 설계 방법론
- [[build-with-teams-rules]] — Agent Teams 파이프라인 운영 규칙
- [[pr-review-fix-workflow]] — PR 리뷰 사후 반영 방법론
- [[docs-six-axis-audit]] — 문서 6축 점검 방법론
- [[agent-friendly-cli-design]] — 에이전트 친화 CLI 설계 패턴
- [[self-improving-harness]] — 리뷰 학습을 스킬에 누적하는 메타 루프
- [[ai-code-review-github-actions]] — PR 자동 리뷰를 GitHub Actions 로

## 관련 Topics

- [[work-style]] — 이 하네스를 포함하는 상위 개발 스타일
