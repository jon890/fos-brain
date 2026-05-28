---
type: concept
created: 2026-05-28
updated: 2026-05-28
---

# 기술 스택 선호

레포 전반에서 반복되는 고정된 기술 취향.

## 핵심 포인트

### TypeScript / 프론트·CLI

- TypeScript `strict: true` 항상, path alias `@/*`, 미사용 변수 `_` prefix.
- 프레임워크: Next.js(App Router) + React 19, Tailwind v4 + shadcn/ui + Radix.
- HTTP 는 **`ky` 전용, axios 금지**(ADR 로 못 박음).
- CLI 는 Commander + tsup(esbuild 단일 번들) + vitest.
- 패키지 매니저는 **pnpm** 고정, Node 20~22.
- 폼은 React Hook Form + Zod, 토스트는 sonner(alert/confirm 금지).

### Java / 백엔드

- Java 21 + Spring Boot 4, Gradle Kotlin DSL + Version Catalog.
- JPA + QueryDSL, Flyway 마이그레이션, MySQL(prod) / H2(test).
- Checkstyle(Google Style, maxWarnings=0), Lombok, SpringDoc.

### 공통

- 로깅 구조화(pino `logger.child` / p6spy), `console.log` 금지.
- 색은 OKLCH 토큰 강제(hex/rgb 금지), 다크모드는 `[data-theme="dark"]`.

## 관련 개념

- [[testing-philosophy]] — 스택별 테스트 도구
- [[ai-harness-pattern]] — best-practices 스킬로 스택 규약 강제

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
