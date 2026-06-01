---
type: entity
created: 2026-05-28
updated: 2026-05-28
---

# fos-accountbook-backend

가계부 앱의 Java 백엔드 REST API. 프론트는 [[fos-accountbook]].

## 개요

- 스택
  - 언어·프레임워크: Java 21, Spring Boot 4
  - 빌드: Gradle 9 Kotlin DSL, Version Catalog
  - DB: MySQL 9 (prod), H2 (test), Flyway
  - ORM·쿼리: JPA, QueryDSL 5.1
  - 보안·문서: Spring Security + jjwt, SpringDoc
  - 캐시·모니터링: Caffeine, p6spy
- 아키텍처
  - 패키지 구조: 도메인 기반 패키지 (ADR-B16)
  - 도메인 내부 단방향: `presentation → application → domain → infra`
  - 주요 패턴
    - UUID 이중키
    - status Enum soft-delete
    - `@ValidateFamilyAccess` AOP
    - `@TransactionalEventListener(AFTER_COMMIT)` 이벤트
    - domain 인터페이스 + infra 구현 분리
- 하네스
  - 스킬 6개
    - planning
    - plan-and-build
    - build-with-teams
    - docs-check
    - integrate-api-contract
    - review-fix

## 특이점

- 프론트↔백 협의를 GitHub Issues로만 강제. `@Transactional` 테스트 금지·모킹 최소화. NextAuth 테이블 camelCase / 비즈니스 snake_case.

## 보여주는 스타일

- [[ai-harness-pattern]]
- [[docs-first-adr]]
- [[testing-philosophy]]
- [[tech-stack-preferences]]
- [[work-style]]

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
