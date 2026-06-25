---
type: concept
created: 2026-05-28
updated: 2026-06-25
---

# AI 하네스 패턴

기획부터 릴리스까지 개발 전 주기를 Claude Code 스킬로 자동화한 재사용 워크플로우.
새 프로젝트를 시작하면 이 하네스를 통째로 포팅한다.

## 핵심 포인트

- **표준 파이프라인** — 5단계 순서로 실행한다.
  - `planning` — 8단계 설계 ([[planning-eight-step-design]])
  - `plan-and-build` / `build-with-teams` — 구현 ([[build-with-teams-rules]])
  - `review-fix` — PR 리뷰 자동 반영 ([[pr-review-fix-workflow]])
  - `docs-check` — 문서 검증 ([[docs-six-axis-audit]])
  - `release`
- **Agent Teams 협업** — `build-with-teams` 가 4역할로 작성과 검증을 분리한다.
  - 역할: team-lead, critic, executor, docs-verifier
  - 같은 컨텍스트에서 자기승인 금지
- **task / phase 분해** — 작업을 번호 task 로 쪼개고, phase 당 항목을 5개 이하로 제한한다(초과 시 후반부 누락 실증).
- **토큰 라우팅** — 목적별로 모델을 다르게 쓴다.
  - 계획 — opus
  - task 실행 — sonnet
  - 검증·커밋 — haiku
- **내부/공개 스킬 분리**
  - `.claude/skills/` — 개발 워크플로우
  - `skills/` — 공개 사용법
- **하네스 우선**: nhncloud-cli 는 코드 0줄 상태에서 하네스부터 포팅 — "도구를 만들기 전에 도구 만드는 공정을 표준화".
- **커스텀 도메인 에이전트 = 도메인 지식 단일 소스** — executor·docs-verifier 를 프로젝트 전용 agent 정의로 만들고, 코딩 규칙·환경 함정·검증 축을 모은다.
  스킬의 스폰 프롬프트는 "호출 인자와 직전 phase 학습 인계" 만 담아 가벼워지고, 도메인 규칙을 스킬마다 반복하지 않아 drift 가 안 생긴다.
  - agent 프롬프트 골격:
    - Role
    - Domain_Rules
    - Self_Check(완료 직전 grep)
    - Verification_Protocol(보고·차단 조건)
    - Self_Discipline(git 금지·격리·꼭 필요한 변경만)
  - 검증 전용 agent 는 쓰기 도구를 막아 읽기 전용을 강제하고, 자기-면제 금지를 정의에 직접 박는다.
  - 거울 구조 — docs-verifier 의 검증 항목은 planning 영향 표의 거울이라 별도 체크리스트를 신설하지 않는다.
- **운영 단계까지 닫는 루프** — 파이프라인은 구현·릴리스에서 끝나지 않고 운영 신호를 다시 입력으로 환원한다.
  - 운영 반영 전 격리 인스턴스로 통합 회귀를 검증한다.
  - 운영 반영은 카나리 한 대를 먼저 검증한 뒤 나머지를 rolling 한다.
  - 운영 에러를 분류해 다음 planning 입력으로 되돌린다.

## 하네스란 + MVP 구축 워크플로우

하네스를 한 줄로 정의하면 `실행 계획 + 완료 조건 + 컨텍스트 참조` 다.

- **실행 계획** — 무엇을 어떤 순서로 만드나(Phase 분리).
- **완료 조건** — 각 Phase 가 언제 끝나나(빌드 성공·CLI 실행 등 기계적으로 판단 가능한 조건).
- **컨텍스트 참조** — 에이전트가 어떤 문서를 읽고 실행하나.

AI 에이전트로 MVP 를 처음부터 만들 때의 3단계 워크플로우다(dooray-cli 사례).

1. **양질의 컨텍스트** — 대화로 기술적 결정을 깊이 쌓는다.
2. **하네스 엔지니어링** — 문서를 기반으로 Phase 를 분리하고 에이전트가 자율 구현한다.
3. **기능 추가·문서화** — 추가 구현마다 문서를 누적·정제해 에이전트의 판단력을 높이는 루프.

각 단계는 이전 산출물에 의존한다 — 1이 부실하면 2에서 에이전트가 방향을 잃는다.

> 핵심 통찰: 에이전트가 잘 동작하는 이유는 코드를 잘 짜서가 아니라 **실행 전에 문서가 충분히 정제돼 있기 때문**이다.

## 추가 (2026-06-25) — GNOSIS 관점에서 본 하네스의 성장 단계

NAVER D2의 GNOSIS 발표는 AI 시스템을 도구형과 성장형 에이전트로 구분한다.
이 관점에서 기존 AI 하네스는 단순 L2 계획 자동화가 아니라 제한된 L3 세션 간 학습 구조를 가진다.

그 이유는 작업 후 학습이 다음 실행 표면으로 환원되기 때문이다.

- PR 리뷰 학습은 [[self-improving-harness]]로 누적된다.
- 회피 패턴은 [[pitfalls-file-per-pattern]]로 분리된다.
- 프로젝트 전용 지식은 [[custom-domain-agent]]에 모인다.
- 자동 리뷰와 점검은 [[ai-code-review-github-actions]], [[docs-six-axis-audit]]로 닫힌다.

다만 GNOSIS식 완전한 성장형 에이전트와는 차이가 있다.
현재 하네스는 LLM 가중치를 바꾸지 않는다는 점은 같지만, constitution gate와 fitness auditor가 형식화되어 있지는 않다.
따라서 다음 개선 방향은 "무엇을 자동 학습해도 되는가"와 "무엇은 사람이 승인해야 하는가"를 [[constitutional-growth-gate]]처럼 gate로 분리하는 것이다.

## 관련 개념

- [[ai-dev-harness]] — 이 패턴과 단계별 방법론을 묶는 상위 주제
- [[planning-eight-step-design]] — 1단계 planning 의 8단계 설계 방법론 (seed)
- [[pr-review-fix-workflow]] — 3단계 review-fix 의 PR 리뷰 사후 반영 방법론 (seed)
- [[docs-six-axis-audit]] — 4단계 docs-check 의 6축 점검 방법론 (seed)
- [[self-improving-harness]] — 하네스가 리뷰 학습을 스스로 누적
- [[build-with-teams-rules]] — build-with-teams 파이프라인의 repo 무관 운영 규칙
- [[docs-first-adr]] — planning 단계가 의사결정을 docs 로 산출
- [[commit-convention-style]] — review-fix·release 가 강제하는 커밋 규약
- [[ai-code-review-github-actions]] — PR 자동 리뷰를 GitHub Actions 로 붙이는 워크플로우 (review-fix 의 입력원)
- [[agent-friendly-cli-design]] — 하네스가 다루는 도구(CLI)를 에이전트가 안정적으로 호출하도록 만드는 설계
- [[merge-conflict-free-append]] — 하네스가 쌓는 누적 docs(ADR·pitfalls)의 머지 충돌을 파일 per 항목과 INDEX 로 없애는 구조 패턴
- [[custom-domain-agent]] — 일반 역할 agent 를 레포 도메인 지식으로 특화한 전용 subagent (executor/docs-verifier)
- [[pitfalls-file-per-pattern]] — 회피 패턴을 파일-per-패턴과 INDEX 라우터로 운영하는 구조
- [[harness-bootstrap-checklist]] — 이 파이프라인을 새 레포에 까는 조립 순서 체크리스트
- [[gnosis-agent-autonomous-growth]] — 외부 기억·스킬·가치 레이어를 갱신하는 성장형 에이전트 프레임워크

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
- [[../../raw/repos/2026-06-01-dooray-cli-tool-analysis.md]]
- [[../../raw/notes/2026-06-12-docu-parser-harness-evolution.md]] — 커스텀 도메인 에이전트 단일 소스 보강
- [[../../raw/videos/2026-06-17-naver-d2-gnosis-agent-autonomous-growth.md]] — GNOSIS의 도구형 AI vs 성장형 에이전트 구분을 기존 하네스에 매핑
