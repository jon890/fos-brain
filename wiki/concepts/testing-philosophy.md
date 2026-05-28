---
type: concept
created: 2026-05-28
updated: 2026-05-28
---

# 테스트 철학

"실제 동작을 검증한다"는 원칙. 모킹을 최소화하고 통합 동작을 우선한다.

## 핵심 포인트

- **실제 커밋 검증**: 백엔드는 `@Transactional` 테스트를 금지한다 — 롤백되는 테스트는 실제 커밋 동작을 숨기므로.
- **모킹 최소화**: Service·Repository 는 모킹하지 않고 외부 API 만 모킹. 통합 경로를 실제로 태운다.
- **실DB 우선**: testcontainers 대신 H2 in-memory 로 통합 테스트(백엔드). 프론트는 jest.mock 방식 채택(MSW 대신, ADR-F09).
- **co-located 테스트**: TS 레포는 소스 옆 `*.test.ts`(vitest). 백엔드는 `AbstractControllerTest` + `TestFixturesSupport` 상속, fixture 빌더.
- **테스트 격리 directive**: DOM 테스트는 파일 상단 `// @vitest-environment jsdom`.
- **타입 안전성도 테스트의 일부**: `tsc --noEmit` 게이트, `as unknown as` 이중 캐스트를 union 타입으로 제거.

## 관련 개념

- [[tech-stack-preferences]] — vitest / Jest / JUnit5 선택
- [[ai-harness-pattern]] — build-with-teams 의 검증 단계

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
