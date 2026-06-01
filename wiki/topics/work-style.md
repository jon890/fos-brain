---
type: topic
created: 2026-05-28
updated: 2026-05-28
---

# 업무 스타일

`~/personal` 의 개인 프로젝트 6개에서 일관되게 나타나는 개발·문서·AI 협업 방식.

한 사람의 작업 방식이 레포마다 복제·진화하며 굳어진 시그니처 패턴이다.
새 프로젝트를 시작하면 동일한 하네스를 포팅하고, 같은 커밋·문서·테스트 규율을 적용한다.

## 핵심 요약

- **AI 하네스 주도 개발** — 기획부터 릴리스까지 전 주기를 스킬로 자동화한다. [[ai-harness-pattern]]
- **docs-first + ADR** — 의사결정을 코드보다 먼저 문서에 남긴다. [[docs-first-adr]]
- **Conventional Commits(한국어 본문)** — 영문 type/scope + 한국어 설명, atomic. [[commit-convention-style]]
- **한국어 표현 정책 + 마크다운 가독성** — 외래어 금지·문체 규칙을 리뷰 점검으로 강제. [[korean-readability-policy]]
- **테스트 철학** — 실제 동작 검증 우선(모킹 최소·실DB). [[testing-philosophy]]
- **기술 스택 선호** — TS/Next.js·Java/Spring, ky·pnpm 등 고정 취향. [[tech-stack-preferences]]
- **자기개선 루프** — PR 리뷰 학습을 스킬 문서에 누적한다. [[self-improving-harness]]

## 이 스타일을 보여주는 레포 (entities)

- [[dooray-cli]] — 하네스 원형(planning→release 6스킬), 입력 통합 CLI
- [[nhncloud-cli]] — dooray-cli 하네스 포팅, 코드보다 하네스가 먼저
- [[fos-blog]] — Next.js 블로그, 토큰 라우팅·BLG 누적
- [[fos-accountbook]] — 4계층 단방향, self-healing-teams, 12 스킬
- [[fos-accountbook-backend]] — Java/Spring 도메인 패키지, 테스트 규율
- [[fos-study]] — 글쓰기 하네스, docs-audit Quality Loop

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
