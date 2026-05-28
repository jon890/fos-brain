---
type: entity
created: 2026-05-28
updated: 2026-05-28
---

# fos-blog

`jon890/fos-study` 마크다운을 MySQL 캐싱 후 렌더하는 개인 블로그(blog.fosworld.co.kr). 홈서버 Docker 배포.

## 개요

- 스택
  - 프레임워크: TypeScript 5.7, Next.js 16 (App Router, Turbopack), React 19
  - UI: Tailwind v4, shadcn/ui
  - DB: MySQL 8.4, Drizzle ORM
  - 렌더링: unified, shiki, KaTeX, mermaid
  - 기타: pino, pnpm, Vitest 4
- 아키텍처
  - 레이어 순서: `app/ → services/ → infra/(db, github)`
  - app 은 infra 직접 import 금지
  - `posts.path` canonical, `isActive` soft-delete
- 하네스
  - 토큰 라우팅: opus/sonnet/haiku
  - 스킬: planning, build-with-teams, plan-and-build, docs-check, review-fix
  - `_shared` pitfalls BLG1~26 누적

## 특이점

- plan{N} task → tasks/ PR → feat/ PR 3단 분리. 작성↔검증 분리 제도화(자기면제 금지).

## 보여주는 스타일

- [[../concepts/ai-harness-pattern]]
- [[../concepts/self-improving-harness]]
- [[../concepts/tech-stack-preferences]]
- [[../concepts/commit-convention-style]]
- [[../topics/work-style]]

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
