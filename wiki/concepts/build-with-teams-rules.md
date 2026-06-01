---
type: concept
created: 2026-05-28
updated: 2026-05-28
---

# build-with-teams 하네스 일반 규칙

Claude Agent Teams 로 task 의 phase 를 실행하는 build-with-teams 파이프라인의
repo 무관한 운영 규칙과 자주 실패하는 패턴.
새 프로젝트 하네스를 깔 때 seed 로 꺼내 쓰는 canonical 참조다.

## 팀 운영

- 정식 팀원 스폰 — critic·executor·code-reviewer·docs-verifier 를 TeamCreate 멤버로 만든다. 일회성 Agent 호출은 금지(반복 협업 불가).
- 스폰 직후 team config.json 으로 멤버 등록을 검증한다(name 누락 시 silent 실패).
- SendMessage 회신 강제 — sub-agent 가 화면 출력만 하고 끝내면 main session 까지 라우팅되지 않는다.
- 검증 에이전트(code-reviewer·docs-verifier)는 self-shutdown 경향이 있어 검사 시점에 다시 스폰한다.
- 메시지 한 박자 지연이 관측되므로 다음 단계 신호를 재전송해 진행한다.
- 파일 참조는 worktree 절대경로로 전달한다(sub-agent 가 구버전을 읽는 사고 방지).

## 실행 통과 조건

- 3중 사전검증 — main index.json status + 원격 feat 브랜치 + 오픈 PR 을 모두 확인한다.
- critic 승인 단계 — 승인 없이 실행 불가. REVISE 면 수정 후 재평가(한도 3회).
- phase 별 atomic commit — executor 는 commit 하지 않고 team-lead 가 phase 완료마다 수행한다.
- 작성과 검증을 분리하고 자기-면제를 금지한다 — FIX·UPDATE 후 재검사·재검증을 강제한다.
- 재시도 한도(critic 3 / code-reviewer 2 / docs-verifier 2) 초과 시 사람 판단에 위임한다.
- index.json 완료 마킹은 PR 브랜치에만 둔다(main 워킹 디렉터리는 건드리지 않는다).

## 자주 실패하는 패턴

- plan-and-build 표준 task 를 build-with-teams 로 실행하면 마지막 phase 의 commit/push 책임이 team-lead 와 충돌한다. critic 평가에서 마지막 phase 를 "마킹만" 으로 축소하고 cwd 를 worktree 로 보정한다.
- 신규 기능 phase 가 docs 영향 표의 필수 docs(README 사용 예 등)를 "PoC 범위 외" 로 빼면 docs-verifier 가 UPDATE_NEEDED 로 잡는다. 영향 표가 단일 소스다.

## 모델 라우팅 (규모 기반)

- 소(phase 1개): 전원 sonnet.
- 중(phase 2~3): critic 만 opus.
- 대(phase 4+): team-lead·critic·docs-verifier 는 opus, executor·code-reviewer 는 sonnet 고정.

## 관련 개념

- [[ai-harness-pattern]] — 이 파이프라인이 속한 베이스 하네스
- [[planning-eight-step-design]] — 이 파이프라인이 실행하는 task 를 산출하는 설계 단계
- [[pr-review-fix-workflow]] — PR 생성 후 외부 리뷰를 반영하는 짝 단계 (사전/사후 분리)
- [[self-improving-harness]] — 회고 학습이 이 규칙을 누적하는 루프
- [[korean-readability-policy]] — 본 문서도 외래어 금지(예: 게이트→점검) 대상
- [[../entities/dooray-cli]] — 이 하네스의 원형
- [[../entities/nhncloud-cli]] — 이 하네스를 포팅한 프로젝트

## Sources

- [[../../raw/notes/2026-05-28-build-with-teams-harness-rules.md]]
