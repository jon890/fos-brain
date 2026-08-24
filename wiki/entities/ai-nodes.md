---
type: entity
created: 2026-05-28
updated: 2026-08-24
title: "fos-agents"
description: "커리어, 투자, 건강, 생활과 콘텐츠 자동화를 독립 워크스페이스로 운영하는 개인 에이전트 모노레포"
tags: [fos-agents, agent, monorepo, automation]
status: stable
stale_after: 2027-02-24
---

# fos-agents

개인 분석과 자동화 에이전트를 여러 독립 워크스페이스로 운영하는 모노레포다.
이전 `fos-claw`과 `ai-nodes` 명칭은 더 이상 현재 환경 이름으로 사용하지 않는다.
기존 wikilink를 깨지 않기 위해 이 페이지의 slug만 `ai-nodes`로 유지한다.

GitHub 저장소는 `jon890/fos-agents`다.

## 워크스페이스

- `apartment`: 아파트 시세와 인테리어 리포트
- `accountbook`: 금융 스크린샷 기반 가계부 입력
- `career-os`: 커리어, 면접과 지원 준비
- `stock-investment`: 주식과 이슈 모니터링
- `travel`: 여행 일정과 결정 로그
- `health-care`: 건강 기록과 재활 체크인
- `ji-yoon-blog`: 지융로그 콘텐츠 운영
- `side-projects`: 사이드 프로젝트와 외주 기회 운영

## 현재 구조

- 루트 `AGENTS.md`는 공통 행동 규칙과 문서 진입점을 관리한다.
- 각 워크스페이스는 자체 `AGENTS.md`, 설정, 상태, 스크립트와 skill을 가진다.
- 워크스페이스 간 자산을 직접 교차 참조하지 않는다.
- 워크스페이스에 한정된 helper는 해당 워크스페이스 안에 둔다.
- 여러 워크스페이스가 함께 사용하는 리포트 게시처럼 실제 공통 책임만 루트 자산으로 둔다.
- 사용자에게 전달하는 분석·추천 리포트는 HTML로 만들고, 외부 공유가 승인되면 Cloudflare Pages에서 검증한다.

## 핵심 패턴

- [[multi-workspace-monorepo]]
- [[script-skill-separation]]
- [[ai-harness-pattern]]
- [[self-improving-harness]]
- [[docs-first-adr]]
- [[agent-friendly-cli-design]]

## Sources

- [[../../raw/notes/2026-08-24-fos-agents-and-document-evaluation.md]]
- github.com/jon890/fos-agents — `AGENTS.md`, `README.md`, `docs/code-architecture.md`
