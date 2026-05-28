---
type: entity
created: 2026-05-28
updated: 2026-05-28
---

# fos-accountbook-backend

가계부 앱의 Java 백엔드 REST API. 프론트는 [[fos-accountbook]].

## 개요

- 스택: Java21 + Spring Boot4, Gradle9 Kotlin DSL + Version Catalog, MySQL9/H2(test), Flyway, JPA + QueryDSL5.1, Security+jjwt, SpringDoc, Caffeine, p6spy.
- 아키텍처: 도메인 기반 패키지(ADR-B16) + 도메인 내부 `presentation→application→domain→infra` 단방향. UUID 이중키, status Enum soft-delete, `@ValidateFamilyAccess` AOP, `@TransactionalEventListener(AFTER_COMMIT)` 이벤트, domain 인터페이스 + infra 구현 분리.
- 하네스: 스킬 6 — planning·plan-and-build·build-with-teams·docs-check·integrate-api-contract·review-fix.

## 특이점

- 프론트↔백 협의를 GitHub Issues로만 강제. `@Transactional` 테스트 금지·모킹 최소화. NextAuth 테이블 camelCase / 비즈니스 snake_case.

## 보여주는 스타일

- [[../concepts/ai-harness-pattern]]
- [[../concepts/docs-first-adr]]
- [[../concepts/testing-philosophy]]
- [[../concepts/tech-stack-preferences]]
- [[../topics/work-style]]

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
