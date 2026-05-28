---
source_type: session-note
collected: 2026-05-28
origin: dooray-cli / nhncloud-cli build-with-teams 스킬 + plan001 실행 회고
---

# build-with-teams 하네스 일반 규칙 (repo 무관)

nhncloud-cli plan001 (`logncrash search` 구현) 을 build-with-teams 파이프라인으로 실행하며 정리한,
프로젝트와 무관하게 재사용되는 하네스 레벨 규칙·자주 실패하는 패턴.
프로젝트별 코딩 규칙 (ky / exit code / resolver 정책 등) 은 제외.

## 팀 구성·운영 규칙

- **정식 팀원 스폰** — critic / executor / code-reviewer / docs-verifier 는 TeamCreate 로 만든 팀의 정식 멤버로 스폰한다.
  일회성 Agent 호출 (team_name 없이) 은 금지 — SendMessage 반복 협업이 불가능하다.
- **스폰 직후 멤버 등록 검증** — `name` 파라미터를 빠뜨려도 Agent 호출은 silent 하게 성공한다.
  team config.json 의 members 를 직접 확인해 정식 멤버 등록 여부를 검증한다.
- **SendMessage 회신 강제** — sub-agent 가 평가/검사 결론을 자기 화면에만 출력하고 종료하는 사고가 잦다.
  결과적으로 main session 까지 라우팅이 안 돼 team-lead 가 다음 단계로 못 간다.
  스폰 프롬프트와 작업 지시 메시지 양쪽에 "회신은 반드시 SendMessage 로" 를 명시한다.
- **검증 에이전트 self-shutdown 대응** — code-reviewer / docs-verifier 는 idle 대기 직후 자체 shutdown 하는 경향이 있다.
  idle 대기에 의존하지 말고 검사 대상이 준비된 시점에 즉시 새로 스폰한다.
- **메시지 1-lag 관찰** — sub-agent 가 직전 메시지에 응답하는 한 박자 지연이 관측된다.
  다음 단계 신호를 재전송하면 진행된다. idle 알림 2회 연속 + 결과 없음이면 통신 누락 의심.
- **worktree 절대경로 전달** — sub-agent 는 main 워킹 디렉터리에서 실행될 수 있다.
  파일 참조는 worktree 절대경로로 줘야 구버전·미존재 파일을 읽는 오판을 막는다.

## 실행 통과 조건

- **3중 사전검증** — 실행 전 (1) main index.json status, (2) 원격 feat 브랜치 존재, (3) 오픈 PR 을 모두 확인한다.
  PR 머지 전이면 main 의 status 가 여전히 pending 이므로 1번만 보면 재실행 사고를 놓친다 — 2·3번이 커버.
- **critic 승인 단계** — critic 승인 없이 실행 불가. REVISE 면 계획 수정 후 재평가 (한도 3회).
- **phase 별 atomic commit** — executor 는 commit 하지 않는다.
  team-lead 가 phase 완료 보고마다 그 phase 의 변경 파일만 commit 하고 다음 phase 를 지시한다.
  commit 메시지는 phase 파일의 의도를 보존한다.
- **작성↔검증 분리 + 자기-면제 금지** — code-reviewer / docs-verifier 가 "재검사 불필요" 같은 자기-면제 문구를 써도 수용하지 않는다.
  trivial 수정이라도 FIX 후 재검사/재검증을 강제한다. 빌드·테스트 통과가 정적 검사를 대신하지 못한다.
- **재시도 한도** — critic REVISE 3회 / code-reviewer FIX 2회 / docs-verifier UPDATE·VIOLATION 2회.
  초과 시 PHASE_BLOCKED 로 사람 판단에 위임 (무한 루프 방지).
- **worktree 격리** — `.claude/worktrees/` 하위에 origin/main 기반으로 생성한다.
  로컬 main 이 origin 보다 앞서면 먼저 push 해야 worktree 에 반영된다.
- **index.json completed 마킹은 PR 브랜치에만** — main 워킹 디렉터리에서 별도 commit 하지 않는다.
  마지막 phase commit 에 마킹이 포함되고 PR 머지로 반영된다. 재실행 방지는 3중 사전검증이 담당.

## 자주 실패하는 패턴 (plan001 회고)

- **plan-and-build 표준 task 를 build-with-teams 로 실행 시 마지막 phase commit/push 책임 충돌** —
  task-create 가 만든 마지막 phase 는 "commit + push + 마킹" 을 한 묶음으로 담는다 (plan-and-build 표준).
  build-with-teams 에서는 commit/push/PR 이 team-lead 책임이라 충돌한다.
  critic 평가 단계에서 마지막 phase 를 "마킹만" 으로 축소하고, 모든 phase 의 cwd 를 worktree 로 보정한다.
- **신규 기능 phase 가 docs 영향 표의 필수 docs 를 "PoC 범위 외" 로 스킵** —
  신규 CLI 명령은 README 사용 예 + 명령 카운트 등이 docs 영향 표상 필수인데,
  phase 작성자가 PoC 라며 빼면 docs-verifier 가 UPDATE_NEEDED 로 잡는다. 표가 단일 소스.

## 모델 라우팅 (규모 기반)

- 소 규모 (phase 1개): 전원 sonnet.
- 중 규모 (phase 2~3): critic 만 opus.
- 대 규모 (phase 4+): team-lead / critic / docs-verifier opus, executor·code-reviewer 는 sonnet 고정.
