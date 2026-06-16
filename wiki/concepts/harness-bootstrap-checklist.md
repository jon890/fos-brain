---
type: concept
created: 2026-06-16
updated: 2026-06-16
---

# 하네스 부트스트랩 체크리스트

"새 레포에 내 하네스 깔아줘" 한 번에 실행할 조립 순서.
각 단계의 방법론은 별도 concept 에 있고, 이 페이지는 그걸 어떤 순서로 까는지의 조립 지도다.

## 0. 사전 — 무엇을 포팅하나

하네스 = `실행 계획 + 완료 조건 + 컨텍스트 참조`([[ai-harness-pattern]]).
코드 0줄 상태에서도 하네스부터 깐다 — "도구를 만들기 전에 도구 만드는 공정을 표준화".

## 조립 순서

1. **메모리 골격** — CLAUDE.md 와 `.claude/rules/` 배치([[claude-code-memory-rules]]).
   - 개인 취향(문체·가독성)은 `~/.claude/rules/`, 팀 공유(PR·커밋·Dooray)는 레포 `.claude/rules/`.
   - 레포 문서가 개인 글로벌 경로(`~/.claude/...`)를 참조하지 않게 한다 (팀원에겐 깨진다).
2. **5단계 스킬 파이프라인** — planning → build-with-teams → review-fix → docs-check → release.
   - 각 스킬은 대응 concept 를 seed 로 재구성한다.
   - planning 은 8단계 설계다([[planning-eight-step-design]]).
   - build-with-teams 는 팀 4역할 운영 규칙이다([[build-with-teams-rules]]).
   - docs-check 는 6축 점검이다([[docs-six-axis-audit]]).
3. **전용 agent** — `.claude/agents/<repo>-{executor,docs-verifier}.md` 에 도메인 지식을 캡슐화한다([[custom-domain-agent]]).
   - 코딩 규칙·환경 함정·ADR 범위를 프롬프트에 내장한다.
   - 검증 agent 는 tools 를 read-only 로 좁힌다.
4. **회피 패턴 wiki** — `_shared/pitfalls/` 에 파일-per-패턴 + INDEX 라우터를 둔다([[pitfalls-file-per-pattern]]).
   - 초기엔 비어 있어도 된다. 회고가 게이트 통과분만 누적한다.
5. **docs 골격** — ADR 과 표준 docs 세트, docs-first 규율([[docs-first-adr]]).
   - ADR 은 자명성 게이트를 통과한 결정만 담는다. 가독성 6원칙을 적용한다.
6. **CI 자동 리뷰** — PR 자동 코드 리뷰를 CI 에 붙여 루프를 닫는다([[ai-code-review-github-actions]]).
7. **자기개선 루프** — 리뷰 학습을 pitfalls·스킬에 환원한다([[self-improving-harness]]).

## 무엇이 레포 고유 / 무엇이 재사용

- 재사용(통째 포팅) — 5단계 파이프라인 골격, 8단계 설계, 6축 점검, pitfalls 구조, agent 5블록 틀.
- 레포 고유(매번 새로) — 도메인 함정, ADR 내용, 환경 검증 명령, 영향 표, 전용 agent 의 description.

## 규모별 적용

- 작은 도구 — 메모리 골격, planning, 커밋 규약이면 충분하다. 팀·전용 agent 는 생략한다.
- 본격 서비스 — 전체 7단계를 깐다. 전용 agent·pitfalls·CI 리뷰까지 포함한다.

## 관련 개념

- [[ai-harness-pattern]] — 이 체크리스트가 까는 전체 파이프라인의 정의 (허브)
- [[claude-code-memory-rules]] — 1단계 메모리 골격의 로딩·재사용 메커니즘
- [[custom-domain-agent]] — 3단계 전용 agent 패턴
- [[pitfalls-file-per-pattern]] — 4단계 회피 패턴 구조
- [[self-improving-harness]] — 7단계 메타 루프

## Sources

- [[../../raw/notes/2026-06-12-docu-parser-harness-evolution.md]] — 하네스 발전분 종합 (pitfalls·전용 agent·평가자 파이프라인)
- [[ai-harness-pattern]] 외 하위 concept 들의 조립 관점 재구성
- docu-parser `.claude/` 실측 (agents·skills·pitfalls 구조)
