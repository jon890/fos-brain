---
type: concept
created: 2026-05-28
updated: 2026-06-12
---

# build-with-teams 하네스 일반 규칙

Claude Agent Teams 로 task 의 phase 를 실행하는 build-with-teams 파이프라인의
repo 무관한 운영 규칙과 자주 실패하는 패턴.
새 프로젝트 하네스를 깔 때 seed 로 꺼내 쓰는 canonical 참조다.

## 팀원 스폰 안전 규칙

스폰 단계에서 라우팅 누락·silent 실패가 가장 자주 난다. 다섯 가지를 지킨다.

- 정식 팀원 스폰 — critic·executor·code-reviewer·docs-verifier 를 TeamCreate 멤버로 만든다. team_name + name 을 반드시 지정한다. 일회성 Agent 호출(name 없이)은 반복 협업이 불가능해 금지.
- 스폰 직후 검증 — team config.json 으로 멤버 등록을 직접 확인한다. name 을 빠뜨려도 호출은 silent 하게 성공하고 응답이 정식 멤버와 거의 같아 시각으로 구분이 안 된다. config 에 멤버가 안 보이면 즉시 재스폰.
- SendMessage 회신 강제 — sub-agent 가 결론을 화면에만 출력하고 끝내면 main session 까지 라우팅되지 않는다. 스폰 프롬프트와 작업 지시 양쪽에 "결론은 반드시 SendMessage 로, 화면 출력만으로 종료 금지" 를 박는다. idle 알림만 2회 연속이면 통신 누락을 의심해 재요청한다.
- 검증 에이전트 self-shutdown 대응 — code-reviewer·docs-verifier 는 idle 직후 자체 종료하는 경향이 있다. idle 대기에 의존하지 말고, 검사 대상이 준비된 시점에 새로 스폰 + 검사 지시를 한 묶음으로 보낸다.
- worktree 절대경로 전달 — 파일 참조를 상대경로나 task 경로 형태로 주면 sub-agent 가 main 의 구버전 파일을 읽어 오판한다. 항상 worktree 절대경로.

## 실행 통과 조건

- 3중 사전검증 — main 의 task status + 원격 작업 브랜치 + 오픈 PR 을 모두 확인한다. 하나라도 걸리면 차단. PR 머지 전이면 main 의 status 가 여전히 미완이라 첫 번째만 보면 재실행 사고를 놓친다. 나머지 둘이 그걸 막는다.
- 마킹 사고 역방향 검증 — status 가 완료인데 머지 commit 이 원격 main 에 없으면 마킹만 잘못된 사고다. commit 만 되고 PR 머지 전인데 완료로 갱신된 경우라, status 를 되돌리거나 이어쓰기로 전환한다.
- critic 승인 단계 — 승인 없이 실행 불가. REVISE 면 수정 후 재평가(한도 3회).
- phase 별 atomic commit — executor 는 commit 하지 않고 team-lead 가 phase 완료마다 수행한다. commit 메시지는 phase 작성자가 의도한 단일 책임 메시지를 그대로 쓴다(team-lead 자체 작성 금지).
- 작성과 검증을 분리하고 자기-면제를 금지한다 — 평가자가 "재검사 불필요"·"단순 변경이라 생략 가능" 을 회신해도 수용하지 않는다. 모든 FIX·UPDATE 후 재검사·재검증을 강제한다. 한 번 면제가 통과되면 다음엔 더 큰 수정도 면제 요청이 들어와 자기승인 회피 원칙이 무너진다.
- 재시도 한도(critic 3 / code-reviewer 2 / docs-verifier 2) 초과 시 PHASE_BLOCKED 로 사람 판단에 위임한다. 카운터는 상태 파일에 영속해 재실행해도 유지한다.
- index.json 완료 마킹은 PR 브랜치에만 둔다(main 워킹 디렉터리는 건드리지 않는다).

## phase 별 spawn-shutdown 사이클

규모가 크면(4 phase 이상) 매 phase 마다 새 executor 를 스폰한다.

- 컨텍스트 격리 — phase 마다 새 컨텍스트라 토큰 누적을 끊는다. phase 별 모델 정책도 적용 가능.
- 즉시 shutdown — team-lead 가 phase commit 을 마치면 그 executor 에게 곧장 shutdown_request 를 보낸다. idle 잔존이 컨텍스트·세션 리소스를 점유하는 것을 막는다.
- 직전 phase 학습 인계 — 새 executor 에게 직전 phase 의 도메인 발견(이동한 경로·갱신한 import 등)을 1~2줄로 넘긴다.
- 3 phase 이하 소규모는 단일 executor 한 명이 처리하는 예외를 둔다(스폰 오버헤드 회피).

## 특이사항 4종 집계

각 executor 는 phase 보고에 특이사항을 함께 적고, team-lead 는 종료 시 누적해 사용자에게 명시 보고한다.

- pre-existing — 이번 변경과 무관하게 원래 있던 문제.
- 신규 deprecation — 이번 변경이 유발한 라이브러리 경고·예정 폐기.
- 미검증 — 로컬에서 확인 불가해 운영·검증 단계로 넘긴 영역.
- 범위 외 발견 — plan 범위 밖이지만 후속이 필요한 발견.

특이사항이 없으면 "없음" 으로 명시한다 — 침묵으로 갈음하지 않는다. 사용자가 인지 못한 채 종료되면 후속 누락으로 이어진다.

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
- [[dooray-cli]] — 이 하네스의 원형
- [[nhncloud-cli]] — 이 하네스를 포팅한 프로젝트

## Sources

- [[../../raw/notes/2026-05-28-build-with-teams-harness-rules.md]]
- [[../../raw/notes/2026-06-12-docu-parser-harness-evolution.md]] — 스폰 안전 규칙·재시도 한도·spawn-shutdown·특이사항 4종 보강
