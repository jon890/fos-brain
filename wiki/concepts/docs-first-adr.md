---
type: concept
created: 2026-05-28
updated: 2026-05-28
---

# docs-first + ADR 운영

의사결정을 코드 변경보다 먼저 문서에 남기고, ADR(Architecture Decision Record)로 누적·관리하는 규율.

## 핵심 포인트

- **docs = source of truth**: 백엔드 레포는 CLAUDE.md 와 docs 가 충돌하면 docs 를 우선한다.
- **표준 docs 세트**: `prd.md`, `flow.md`, `adr.md`, `code-architecture.md`, `data-schema.md`, `testing-strategy.md`.
- **ADR 원칙**: "기술 의사결정만 / 최종 상태만 / 코드로 자명하지 않은 것만". 주기적으로 slim·retire.
- **번호 체계**: 레포별 prefix(예: 가계부 F=프론트 / B=백엔드, `ADR-B16`).
- **변경-상황 매핑 표**: 작업 종류별 필독 ADR 을 표로 강제해 라이브러리 함정 재발을 막는다.
- **docs 는 AI 컨텍스트용**: 간결·중복 제거·"왜"만 기록, 코드 스니펫은 넣지 않는다(구현 세부는 코드가 자명).
- **task 생성 전 docs commit**: 설계 결정이 먼저 커밋된 뒤 구현 task 가 만들어진다.

## 관련 개념

- [[ai-harness-pattern]] — planning 스킬이 docs 를 산출하는 단계
- [[korean-readability-policy]] — docs 문체·가독성 규칙

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
