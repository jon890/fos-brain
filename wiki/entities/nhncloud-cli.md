---
type: entity
created: 2026-05-28
updated: 2026-05-28
---

# nhncloud-cli

NHN Cloud 통합 CLI(`@bifos/nhncloud-cli` v0.1.0). 서비스별 인증·엔드포인트·응답 봉투를 단일 profile 추상화 뒤로 숨긴다.

## 개요

- 스택
  - 언어·런타임: TypeScript, Node >= 20
  - 라이브러리: Commander v14, ky (axios 금지 ADR-002), tsup, vitest
  - 패키지 매니저: pnpm
- 아키텍처
  - 레이어 순서: `config/ → api/ → services/<svc>/ → formatters/ → commands/<svc>/`
  - 자격증명: `~/.nhncloud/credentials.json` (0600)
  - profile 우선순위: `--profile` > env > config > default
- 하네스
  - dooray-cli 하네스를 포팅한 7스킬
  - 스킬 목록
    - planning
    - plan-and-build (run-phases.py)
    - build-with-teams
    - review-fix
    - docs-check
    - release
    - _shared

## 특이점

- 하네스가 코드보다 먼저 완비(커밋2 = 하네스 포팅, 코드 0줄). "도구를 만들기 전 공정을 표준화".

## 보여주는 스타일

- [[../concepts/ai-harness-pattern]]
- [[../concepts/docs-first-adr]]
- [[../concepts/tech-stack-preferences]]
- [[../topics/work-style]]

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
