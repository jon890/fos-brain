---
type: entity
created: 2026-05-28
updated: 2026-06-01
---

# dooray-cli

NHN Dooray REST API 를 래핑한 CLI(`@bifos/dooray-cli`, npm 공개, MIT). 하네스의 원형.

- **Repo**: https://github.com/jon890/dooray-cli
- **npm**: `@bifos/dooray-cli`

## 도구로서 (사용)

- **무엇** — Dooray REST API 의 얇은 CLI 래퍼. 사람이 터미널에서 쓰고, AI 에이전트가 프로그램적으로 호출하는 두 사용자를 동시에 겨냥한다. dooray-mcp-server 를 CLI 로 포팅하며 시작했다.
- **어떻게** — `dooray setup`(대화형 마법사)으로 endpoint·API 토큰을 설정한 뒤 명령군을 호출한다.
  - `project` — 목록·멤버·워크플로우·태그·템플릿
  - `post` — 업무 get/list/search/create/edit/done 및 댓글
  - `mail` — IMAP 조회와 SMTP 발송
  - `wiki` — 페이지·댓글
  - 인증은 Dooray API 토큰, 설정·캐시는 `~/.dooray/`.
- **어디에** — AI 에이전트의 Dooray 자동화 토대다. weekly-report 스킬이 주간보고 댓글 등록에, dooray-comment-reply 스킬이 댓글 회신에 이 CLI 를 소비한다.
- **설계** — 에이전트 친화 CLI 패턴을 정립했다([[agent-friendly-cli-design]]).

## 개요

- 스택
  - 언어·런타임: TypeScript strict, Node >= 20
  - 라이브러리: commander, ky, tsup, vitest
  - 패키지 매니저: pnpm
- 아키텍처
  - 레이어 순서: `api/ → resolvers/ → commands/ → formatters/`
  - 입력 통합 헬퍼: `<project> <num>`, `--id`, `--url` 흡수
  - 에러 타입: `DoorayCliError(message, exitCode)`
  - 스트림 분리: 데이터 stdout, 에러 stderr (에이전트 친화)
- 하네스
  - 스킬 6개
    - planning
    - plan-and-build
    - build-with-teams
    - docs-check
    - review-fix
    - release
  - 커스텀 에이전트: executor, docs-verifier

## 특이점

- 가장 성숙한 하네스 원형 — nhncloud-cli 가 이를 포팅했다.
- `tasks/` 번호 디렉터리로 작업 추적, PR 리뷰 학습을 스킬에 누적.

## 보여주는 스타일

- [[ai-harness-pattern]]
- [[agent-friendly-cli-design]] — 이 도구가 정립한 에이전트 친화 CLI 패턴
- [[tech-stack-preferences]]
- [[work-style]]

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
- [[../../raw/repos/2026-06-01-dooray-cli-tool-analysis.md]]
