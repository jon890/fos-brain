---
type: entity
created: 2026-05-28
updated: 2026-05-28
---

# fos-blog

`jon890/fos-study` 마크다운을 MySQL 캐싱 후 렌더하는 개인 블로그(blog.fosworld.co.kr). 홈서버 Docker 배포.

## 개요

- 스택: TS5.7 + Next.js16(App Router, Turbopack) + React19, Tailwind v4 + shadcn/ui, MySQL8.4 + Drizzle, unified/shiki/KaTeX/mermaid, pino, pnpm, Vitest4.
- 아키텍처: `app/ → services/ → infra/(db,github)`. app 은 infra 직접 import 금지. `posts.path` canonical, `isActive` soft-delete.
- 하네스: 토큰 라우팅(opus/sonnet/haiku), planning·build-with-teams·plan-and-build·docs-check·review-fix, `_shared` pitfalls BLG1~26.

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
