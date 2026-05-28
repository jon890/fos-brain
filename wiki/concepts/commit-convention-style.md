---
type: concept
created: 2026-05-28
updated: 2026-05-28
---

# 커밋 컨벤션 스타일

전 레포에서 일관된 Conventional Commits 변형.

## 핵심 포인트

- **형식**: `type(scope): 설명` — 영문 type/scope + **한국어 본문 설명**.
- **type 분포** — chore 가 가장 많고, 이하 순서로 사용한다.
  - chore, docs, feat, fix, refactor
  - 문서·잡무 커밋 비중이 크다(정원 가꾸기형).
- **scope 의미** — 세 가지 방식 중 하나로 표기한다.
  - 도메인명: `feat(expense)`
  - 모듈: `fix(resolvers)`
  - task 식별자: `docs(plan024)`
  - 경로(OCR-docs 한정): `docs(ko/api-guide-v2.1)`
- **atomic 커밋**: 한 커밋 = 하나의 논리 변경. 기능·문서·스킬 변경을 분리한다.
- **추적성** — 제목에 식별자를 부착한다.
  - PR 번호: `(#171)`
  - 이슈: `(closes #NN)`
  - plan 식별자: `plan{N}`
- **AI 협업 명시**: `Co-Authored-By: Claude Opus 4.7 (1M context)` / `Sonnet 4.6`.
- **gitmoji**: 기본은 안 쓰지만 리뷰 반영 커밋에 🩹, OCR-docs 는 과거 이모지 prefix(📝🔗)에서 Conventional 로 마이그레이션 중.
- **브랜치 분리** — 목적별로 브랜치를 나눈다.
  - 계획·docs: `plan/{N}` 또는 `tasks/`
  - 구현: `feat/plan{N}`
  - main 직접 push 금지

## 관련 개념

- [[ai-harness-pattern]] — review-fix·release 스킬이 이 규약을 강제
- [[docs-first-adr]] — docs 커밋이 task 보다 선행

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
