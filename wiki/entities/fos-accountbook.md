---
type: entity
created: 2026-05-28
updated: 2026-05-28
---

# fos-accountbook

가족이 함께 쓰는 가계부 앱의 프론트엔드("우리집 가계부"). 백엔드는 [[fos-accountbook-backend]] 별도 레포.

## 개요

- 스택: Next.js16 + React19 + TS6, Tailwind v4 + shadcn/ui(new-york) + Radix + CVA, NextAuth v5(Google/Naver), ky, RHF+Zod, recharts, pnpm10, Jest30 + Testing Library + MSW.
- 아키텍처: 4계층 단방향 `Page → Action("use server") → Service → lib/server/api`. 도메인별 평행 구조. Server Component 기본, `(authenticated)` 라우트 그룹.
- 하네스: 스킬 12개 — planning·plan-and-build·build-with-teams·self-healing-teams·commit-convention·review-fix·docs-check·integrate-ux·web-design-guidelines·next/vercel-react-best-practices.

## 특이점

- ADR을 "변경-상황 매핑 표"로 운영(작업별 필독 ADR 강제). "phase 작업 5개 이하" 규칙. OKLCH 색 토큰 강제.

## 보여주는 스타일

- [[../concepts/ai-harness-pattern]]
- [[../concepts/self-improving-harness]]
- [[../concepts/docs-first-adr]]
- [[../concepts/tech-stack-preferences]]
- [[../topics/work-style]]

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
