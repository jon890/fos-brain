---
type: concept
created: 2026-05-28
updated: 2026-05-28
---

# 테스트 철학

"실제 동작을 검증한다"는 원칙. 모킹을 최소화하고 통합 동작을 우선한다.

## 핵심 포인트

- **실제 커밋 검증**: 백엔드는 `@Transactional` 테스트를 금지한다 — 롤백되는 테스트는 실제 커밋 동작을 숨기기 때문이다.
- **모킹 최소화** — 외부 API 만 모킹하고, Service·Repository 는 모킹하지 않는다. 통합 경로를 실제로 태운다.
- **실DB 우선** — 환경별로 다른 방식을 사용한다.
  - 백엔드: testcontainers 대신 H2 in-memory 로 통합 테스트
  - 프론트: jest.mock 방식 채택(MSW 대신, ADR-F09)
- **co-located 테스트** — 저장소별로 위치와 구조가 다르다.
  - TS 레포: 소스 옆 `*.test.ts` (vitest)
  - 백엔드: `AbstractControllerTest` + `TestFixturesSupport` 상속, fixture 빌더
- **테스트 격리 directive**: DOM 테스트는 파일 상단에 `// @vitest-environment jsdom` 을 선언한다.
- **타입 안전성도 테스트의 일부** — 두 가지를 함께 적용한다.
  - `tsc --noEmit` 점검 운용
  - `as unknown as` 이중 캐스트를 union 타입으로 제거

## 관련 개념

- [[tech-stack-preferences]] — vitest / Jest / JUnit5 선택
- [[ai-harness-pattern]] — build-with-teams 의 검증 단계

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
