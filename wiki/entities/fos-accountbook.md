---
type: entity
created: 2026-05-28
updated: 2026-06-01
---

# fos-accountbook

가족이 함께 쓰는 가계부 앱의 프론트엔드("우리집 가계부"). 백엔드는 [[fos-accountbook-backend]] 별도 레포.

- **Repo**: https://github.com/jon890/fos-accountbook-frontend

## 개요

- 스택
  - 프레임워크: Next.js 16, React 19, TypeScript 6
  - UI: Tailwind v4, shadcn/ui (new-york), Radix, CVA
  - 인증: NextAuth v5 (Google/Naver)
  - 데이터·폼: ky, React Hook Form + Zod, recharts
  - 테스트: Jest 30, Testing Library, MSW
  - 패키지 매니저: pnpm 10
- 아키텍처
  - 4계층 단방향: `Page → Action("use server") → Service → lib/server/api`
  - 도메인별 평행 구조
  - Server Component 기본, `(authenticated)` 라우트 그룹
- 하네스
  - 스킬 12개
  - 목록
    - planning
    - plan-and-build
    - build-with-teams
    - self-healing-teams
    - commit-convention
    - review-fix
    - docs-check
    - integrate-ux
    - web-design-guidelines
    - next/vercel-react-best-practices

## 특이점

- ADR을 "변경-상황 매핑 표"로 운영(작업별 필독 ADR 강제). "phase 작업 5개 이하" 규칙. OKLCH 색 토큰 강제.

## 보여주는 스타일

- [[ai-harness-pattern]]
- [[self-improving-harness]]
- [[docs-first-adr]]
- [[tech-stack-preferences]]
- [[work-style]]

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
