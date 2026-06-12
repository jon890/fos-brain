# docu-parser 하네스 발전분 분석 (2026-06-01 이후)

분석 일자: 2026-06-12.
대상: 한 프로젝트의 AI 코딩 하네스(.claude/skills, .claude/agents, CLAUDE.md)가 2026-06-01 기준 노트 작성 이후 plan 43개를 진행하며 발전한 부분.
목표: repo 무관 재사용 가능한 방법론·결정 원칙 중 **기존 하네스 concept 보강분**만 추출해 brain 에 환원.

2026-06-01 노트는 `planning` / `review-fix` / `docs-check` 3개 스킬만 담았다.
그 후 하네스는 (1) 자기개선 인프라, (2) 평가자 다단 실행 파이프라인 측면에서 크게 발전했고, 운영 단계(격리 검증·카나리 배포·에러 분류)도 확장됐다.

아래 6개 발전 요소는 그 발전분 중 기존 concept 을 보강하는 부분으로, 프로젝트 구체(인스턴스명·GPU/문서파싱 도메인·사내 도메인·이미지명·사내 이슈번호)를 제거하고 일반 패턴만 남긴 것이다.
운영 단계 발전분은 분석에는 있으나 brain 신규 concept 신설을 보류해 본 노트에서는 보강 요소만 다룬다.

---

## 1. pitfalls 디렉터리 구조 — 단일 파일에서 카테고리별 파일 per 패턴 wiki 로

회피 패턴을 하나의 큰 파일이 아니라 카테고리 디렉터리(`plan/` · `code-review/` · `team/`) + `INDEX.md` 라우터로 운영.
패턴 1개 = 파일 1개. 관측 시점 규모는 plan 44 / code-review 40 / team 16.

재사용 가치:

- 단일 파일은 누적될수록 매번 통째로 컨텍스트에 로드돼 토큰을 잡아먹고 관련 없는 패턴까지 읽힌다.
- 파일 per 패턴 + INDEX 라우터는 "지금 작업의 변경 유형" 에 해당하는 파일만 grep 으로 골라 읽는 progressive disclosure 를 가능하게 한다.
- kebab-slug 파일명이라 번호 재부여 문제가 없고 stale 패턴을 깔끔히 제거할 수 있다.

일반화한 방법론:

- 패턴 파일 frontmatter 에 `id / category / triggers[] / tool_catchable / source[] / related[]`. `triggers` 가 라우터 매칭 키.
- 소비 3단계: (1) INDEX 라우터 표에서 변경 유형 행 찾기 → (2) 가리키는 파일만 self-check → (3) 애매하면 카테고리 디렉터리 통째로(과소선택보다 안전).
- 1차 선택은 `triggers:` grep, 큐레이션 표는 보조.
- 소비자별 카테고리: plan 작성(planning·build-with-teams), team 운영(build-with-teams), code-review(build-with-teams·review-fix).
- 축적 게이트 4조건(모두 통과해야 파일 추가): 재발성(2회+) · 심각도(데이터손상/보안급) · 도구로 못 잡음(린터/타입체커/테스트가 이미 잡는 건 제외) · 인시던트 너머 추상화. 1회성은 PR reply 로 끝낸다.
- prune·automate 패스: 회고 10회마다 또는 분기 1회 — 가리키는 코드가 사라진 stale 파일 삭제, 도구로 승격 가능한 패턴은 린터 룰/ast-grep 으로 옮기고 파일 삭제. ADD 로만 기우는 것을 막는 의무 단계.
- 링크 규칙: 패턴 간 cross-ref 는 본문 끝 `[[slug]]`(자동 로드 안 되는 grep 토큰), `@경로` import 금지(선택적 로드 목적 파괴), INDEX 카테고리 목록만 마크다운 링크.

## 2. retros 디렉터리 — 역할별 회고 분리(거울 구조)

회고 절차를 평가자 역할별로 분리한 파일. critic 회고(→ pitfalls/plan) · code-reviewer 회고(→ pitfalls/code-review) · docs-verifier 회고(→ planning 영향 표). 각 파일이 해당 회고 절차의 단일 소스.

재사용 가치:

- 회고 주체마다 누적 대상이 다르다 — critic 지적은 plan 설계 패턴, reviewer 지적은 코드 패턴, docs-verifier 지적은 docs 영향 표로 환원돼야 한다. 하나로 합치면 누적 위치가 섞인다.
- 거울 구조 — 회고 결과를 별도 회고 docs 로 신설하지 않고 기존 단일 소스에 직접 누적. 회고 산출물이 또 다른 rot 소스가 되는 것을 막는다.

일반화한 방법론:

- 평가자 역할마다 retro 파일 1개. 각 파일은 트리거 조건(R 이 1회 이상 지적 시 의무 실행, 1-shot 통과 시 skip, 0건이라도 자문) + 반복 가능성 판정(축적 게이트 4조건) + 갱신 위치(역할별로 다른 단일 소스) + 작성 형식 + 커밋 규약.
- 커밋은 worktree 브랜치에서 → PR 에 자동 포함, main 직접 commit 금지.
- 핵심: 회고는 항상 기존 단일 소스에 환원, 새 회고 문서 신설 금지.

## 3. build-with-teams — 평가자 다단 파이프라인으로 발전

team-lead·critic·executor·code-reviewer·docs-verifier 5역할이 가시적으로 협업하는 Agent Teams 파이프라인. 백그라운드 스크립트 실행을 대체.

일반화한 방법론:

- 3중 사전 검증(재실행 사고 방지): main 의 task status + 원격 작업 브랜치 존재 + 오픈 PR. 하나라도 걸리면 차단. "status=completed 인데 머지 commit 부재" 는 마킹 사고로 역방향 검증.
- 규모 기반 모델 라우팅: total_phases 로 소/중/대 판정 → 역할별 모델 동적 조정(대규모는 team-lead·critic·docs-verifier 를 opus). executor·code-reviewer 는 전 규모 sonnet 고정.
- 재시도 한도(무한 루프 방지): critic REVISE 3회 / reviewer FIX 2회 / docs-verifier 2회 → 초과 시 PHASE_BLOCKED 로 사람에게 위임. 카운터는 상태 파일에 영속.
- phase 별 spawn-shutdown 사이클(4 phase 이상 default): 매 phase 새 executor spawn → 컨텍스트 격리 + phase model 정책. commit 직후 즉시 shutdown_request 로 idle 잔존 방지. 3 phase 이하만 단일 executor 예외.
- worktree 격리: 동시 병렬 plan 실행이 간섭 안 함. base 신선도 점검(원격 main 대비 뒤처짐 + 신규 CI 도입 시 merge 로 최신화, rebase/force-push 금지).
- 자기-면제 금지: 평가자가 "재검사 불필요" 자기-면제 문구를 회신해도 수용 금지 — 모든 FIX/UPDATE 후 재검사 강제. "한 번 면제 통과되면 다음엔 더 큰 수정도 면제 요청이 들어온다" 는 일관성 논리.
- 특이사항 4종 집계: 각 executor 가 pre-existing / 신규 deprecation / 미검증 / 범위 외 발견을 보고 → team-lead 가 누적해 종료 시 사용자에게 명시 보고(침묵 갈음 금지) + PR 본문 "특이사항 및 후속" 섹션.

## 4. 팀원 스폰 안전 규칙

Agent Teams 멤버 스폰 시 라우팅 누락·silent 실패를 막는 절차.

- 정식 멤버는 team_name + name 필수. 스폰 직후 team config.json 을 직접 확인(응답만으로는 정식/일회성 구분 불가).
- SendMessage 회신 강제: 스폰 프롬프트와 작업 지시 양쪽에 "결론은 반드시 SendMessage 로, 화면 텍스트 출력만으로 종료 금지" 문구. idle 알림만 2회 연속이면 통신 누락 의심 → 재요청.
- 검증 에이전트 self-shutdown 대응: idle 대기 의존 금지. 검사 대상이 준비된 시점에 즉시 새로 spawn + 검사 지시를 묶음으로.
- worktree 절대경로 전달 필수: 상대경로/task 경로 형태로 지시하면 sub-agent 가 main 의 구버전 파일을 읽어 오판.

## 5. 커스텀 도메인 에이전트 = 도메인 지식 단일 소스

프로젝트 도메인 지식을 담은 custom agent 정의. executor 는 코딩 규칙·환경 함정·self-check grep, docs-verifier 는 6축 검증·도메인 docs 단일 소스 표를 보유.

재사용 가치:

- agent 정의가 도메인 지식의 단일 소스가 되면 SKILL 의 spawn prompt 는 "호출 인자 + 직전 phase 학습 인계" 만 담아 가벼워진다. 도메인 규칙을 SKILL 마다 반복하지 않아 drift 가 안 생긴다.

일반화한 방법론:

- agent 프롬프트 구조: Role(책임/비책임/대기 규칙) → Domain_Rules(환경 함정 표 · 코딩 규칙 · 도메인 결정 참조) → Self_Check(완료 직전 카테고리별 grep, 0건 보장) → Verification_Protocol(완료 보고 형식 · 차단 조건) → Self_Discipline(git 금지 · 작업 디렉터리 격리 · 꼭 필요한 변경만 · 단일 소스 존중).
- 거울 구조 명시: docs-verifier 정의에 "검증 항목은 planning 영향 표의 거울 — 별도 체크리스트 신설 금지" 못박음.
- 자기-면제 금지를 agent 정의에 직접 내장.
- 검증 전용 agent 는 disallowedTools 로 읽기 전용 강제.

## 6. planning — docs 영향 표 + ADR 자명성 게이트 발전

planning 이 8단계로 정착하고 변경 유형별 docs 영향 표 + ADR 자명성 3-NO 게이트 + 회고 누적 노트가 추가됨.

- 변경 유형 → 영향 docs 표: 행=변경 유형, 열=각 docs. "(해당 시)" 같은 모호 어휘 금지, 표시되면 무조건 변경. 회고로 새 행이 누적된다.
- ADR 자명성 3-NO 게이트: (1) 설정 파일/디렉터리 트리/기존 docs 보면 같은 정보? (2) "왜" 를 1~2문장 이상 설명하기 어려운가? (3) 다른 프로젝트도 일반적으로 하는 선택? — 하나라도 YES 면 ADR 아님.
- ADR 본문 self-check 6항(적격성과 분리): 정량 작업량 없음 / 파일 경로 3+ 나열 없음 / 라이브러리 자명 설명 없음 / 3축 완비 / 3중 반복 없음 / 적용범위 경로나열 없음.
- 갱신 시점 분리: planning 결정 docs 는 planning 단계에서 즉시 반영+commit, phase 안에서 변경 금지(코드↔docs mismatch 회피).
- docs↔코드 정합 사전 점검: 같은 식별자(메트릭 이름·env 변수·응답 필드·에러 코드)가 양쪽에 정의되면 plan 단계에서 양쪽 표기를 한 번에 결정.
- 번호 충돌 방지: plan/ADR 번호 부여 전 로컬 main + 열린 PR(미머지 브랜치)까지 점검 — 로컬 디렉터리 목록만 보면 미머지 PR 번호를 놓친다.

---

## brain 환원 분류

아래 6개 보강 요소만 기존 concept 에 반영했다.
운영 단계 발전분(격리 인스턴스 검증·카나리 rolling 배포·운영 에러 다축 분류)도 분석에 있었으나, brain 신규 concept 신설은 사용자 결정으로 보류한다.

| 요소 | 반영 방식 | 대상 |
|---|---|---|
| 1 pitfalls 카테고리 디렉터리 | 기존 보강 | self-improving-harness |
| 2 retros 역할별 회고 + 거울 구조 | 기존 보강 | self-improving-harness |
| 3 build-with-teams 다단 파이프라인 | 기존 보강 | build-with-teams-rules |
| 4 팀원 스폰 안전 규칙 | 기존 보강 | build-with-teams-rules |
| 5 커스텀 도메인 에이전트 | 기존 보강 | ai-harness-pattern |
| 6 planning 영향 표 + 자명성 게이트 | 기존 보강 | planning-eight-step-design |
