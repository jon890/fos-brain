---
type: concept
created: 2026-06-16
updated: 2026-06-16
---

# 도메인 지식 캡슐 — 프로젝트 전용 subagent

build-with-teams 의 일반 역할(executor·docs-verifier)을 프로젝트 레포에 복제하되,
그 레포의 코딩 규칙·환경 함정·도메인 함정을 agent 프롬프트 안에 통째로 내장한 전용 subagent.
`.claude/agents/<repo>-<role>.md` 로 둬서 그 레포에서만 트리거되게 한다.

## 왜 일반 역할이 아니라 전용 agent 인가

- 일반 executor 는 매 작업마다 CLAUDE.md·ADR·pitfalls 를 다시 읽어야 규칙을 안다.
- 전용 agent 는 그 지식을 프롬프트에 고정해 둬서, 스폰 즉시 규칙 위반을 자체 차단한다.
- description 으로 트리거 범위를 그 레포에 묶어 다른 레포 오염을 막는다 ("다른 repo 적용 금지").

## 파일 구조 (frontmatter + 5블록 프롬프트)

```yaml
---
name: <repo>-executor
description: <한 줄 역할 + 내장 지식 목록>. <호출 스킬> 이 호출.
model: sonnet   # 검증 agent 는 read-only, 실행 agent 는 작업 모델
---
```

본문은 XML 블록으로 역할을 못박는다.

- `<Role>` — 책임 / 비책임을 명시. 비책임(git commit·docs 검증·plan 평가)을 적어 역할 경계를 닫는다.
- `<Domain_Rules>` — 환경 함정 표, 코딩 규칙 N항, 상황별 ADR 참조 표, 빌드 검증 명령.
- `<Self_Check>` — 작업 완료 직전 실행할 카테고리별 grep 을 박아두고 "0건 보장 후 보고".
- `<Verification_Protocol>` — 완료 보고 형식(변경 파일·검증 결과)과 차단 조건(import 실패 등).
- `<Self_Discipline>` — git 금지·작업 디렉터리 격리·외과적 변경·단일 소스 존중.

## executor 의 phase 분리

전용 executor 는 plan 의 phase 파일을 받아 실행만 하고, 커밋하지 않는다.

- 책임은 코드 작성, 로컬 검증, SendMessage 보고까지다.
- git add / commit 은 team-lead 가 phase 완료마다 atomic 으로 수행 (작성과 커밋 분리).
- phase 본문 범위 밖 작업은 PHASE_BLOCKED 로 보고하고 지시 대기 — 자율 확장 금지.
- 한 turn 안에 phase 완료와 회신을 끝낸다 (idle 대기 시 라우팅 누락).

이 분리가 [[build-with-teams-rules]] 의 "executor 는 commit 하지 않는다" 규칙을 agent 안에 내장한 형태다.

## 검증 agent 의 변형

같은 구조를 read-only 검증 agent(docs-verifier)에도 적용한다.

- frontmatter `tools` 를 Write/Edit 제외로 좁혀 검증 전용으로 강제한다.
- 도메인 지식(핵심 docs 목록·ADR 범위·영향 표)을 내장해 외부 참조 없이 부패를 잡는다.
- 작성 agent 와 다른 lane 이라 self-approval 금지 원칙([[self-improving-harness]])을 구조로 보장한다.

## self-check grep 을 프롬프트에 박는 이유

규칙을 글로만 적으면 형식적으로 넘긴다([[claude-code-memory-rules]] 의 "규칙 vs 강제").
완료 직전 실행할 검출 grep 을 카테고리별로 박아두면, agent 가 보고 전에 스스로 0건을 확인한다.
검출 명령이 곧 self-check 라 다음 작업의 사전 점검으로 재사용된다.

## 관련 개념

- [[ai-harness-pattern]] — 이 전용 agent 가 실행하는 베이스 파이프라인
- [[build-with-teams-rules]] — 일반 역할 운영 규칙 (이 agent 가 레포별로 특화하는 원본)
- [[pitfalls-file-per-pattern]] — Self_Check 가 참조하는 회피 패턴 단일 소스
- [[claude-code-memory-rules]] — 규칙을 글이 아니라 grep·hook 으로 강제하는 한계
- [[self-improving-harness]] — 작성과 검증 분리를 agent 구조로 제도화

## Sources

- [[../../raw/notes/2026-06-12-docu-parser-harness-evolution.md]] — 섹션 5 커스텀 도메인 에이전트 = 도메인 지식 단일 소스
- `.claude/agents/<repo>-executor.md`, `.claude/agents/<repo>-docs-verifier.md` (docu-parser 실측)
