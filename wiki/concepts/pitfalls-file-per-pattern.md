---
type: concept
created: 2026-06-16
updated: 2026-06-16
---

# 회피 패턴 wiki — 파일-per-패턴 + INDEX 라우터

하네스가 누적하는 회피 패턴(pitfalls)을 모놀리식 문서가 아니라
패턴 1개 = 파일 1개로 쪼개고, INDEX 의 라우터 표로 작업 유형에 맞는 파일만 골라 읽는 구조.

## 왜 파일을 쪼개나

- 모놀리식 문서는 작업마다 무관한 패턴까지 컨텍스트에 올려 토큰을 낭비하고 핵심을 묻는다.
- 파일 per 패턴이면 INDEX 라우터로 이 작업의 변경 유형 행만 골라 해당 파일만 읽는다.
- 끝에 append 하지 않으니 두 PR 이 동시에 패턴을 추가해도 머지 충돌이 없다([[merge-conflict-free-append]]).

## 소비 방식 (전부 읽지 않는다)

1. INDEX 라우터 표에서 지금 작업의 변경 유형 행을 찾는다.
2. 그 행이 가리키는 패턴 파일만 읽고 self-check 한다.
3. 애매하면 카테고리 디렉터리(plan / team / code-review)를 통째로 읽는다 (과소선택보다 안전).

## 카테고리 = 소비 시점

| 카테고리 | 호출 시점 | 사용 스킬 |
|---|---|---|
| plan | task 파일 작성 직후 self-check | planning, build-with-teams |
| team | 팀원 스폰·메시지 작성 시 | build-with-teams |
| code-review | 코드 작성·리뷰 시 (diff 대상) | build-with-teams, review-fix |

## 축적 점검 (무분별한 성장 방지)

새 패턴은 4조건을 모두 통과할 때만 파일로 추가한다. 1회성 지적은 PR reply 로 끝낸다.

1. 재발성 — 2회 이상 재발했거나 다른 코드에서도 날 구조적 가능성이 있다.
2. 심각도 — 데이터 손상·문서 전체 실패·보안 등 영향이 크다.
3. 도구로 못 잡음 — 린터·타입체커·테스트가 이미 잡는 건 추가하지 않는다 (도구가 단일 소스).
4. 추상화 가능 — 특정 인시던트 너머로 일반화된다. 인시던트 예시는 재사용 코드 예시로 교체한다.

## prune·automate 패스 (ADD 편향 방지)

회고가 추가로만 기울지 않도록 회고 10회마다 또는 분기마다 1회 정리한다.

- prune — 가리키는 코드가 사라진 stale 파일을 삭제하고, 같은 커널의 중복 파일을 합친다.
- automate — 도구로 승격 가능한 패턴은 린터 커스텀·ast-grep·테스트로 옮기고 파일을 삭제한다.

## 파일 형식

frontmatter(id·category·triggers·tool_catchable·source·related) 와 본문(증상 / Good / 검출 / Self-check / Why).

- 사고 사례는 1개로 충분하다. 복수 나열은 하지 않는다.
- "왜 이 가드가 필요한지" 1줄 단서가 필수다 — 없으면 미래 agent 가 가드를 우회한다.
- 검출 grep 을 함께 적어 다음 작업의 사전 self-check 로 쓴다.
- 라우터가 frontmatter `triggers:` 를 grep 해 매칭하므로 변경 유형 키워드를 적는다.

## 링크 규칙 (선택적 로드 보존)

- 패턴 간 cross-ref 는 본문 끝 `관련: [[slug]]` 로 적는다 — 자동 로드 안 하는 grep 토큰이다.
- `@경로` import 는 쓰지 않는다 — 내용을 통째로 자동 포함시켜 선택적 로드를 깨뜨린다.
- INDEX 의 카테고리 목록만 마크다운 링크로 둬 클릭 네비게이션 허브로 쓴다.

## 관련 개념

- [[self-improving-harness]] — 이 wiki 에 패턴을 누적하는 메타 루프
- [[merge-conflict-free-append]] — 파일 per 항목, INDEX 의 충돌 제거 구조 (이 패턴의 일반형)
- [[custom-domain-agent]] — Self_Check 에서 이 wiki 를 단일 소스로 참조하는 전용 agent

## Sources

- [[../../raw/notes/2026-06-12-docu-parser-harness-evolution.md]] — 섹션 1 pitfalls 파일-per-패턴, INDEX 라우터 구조
- `.claude/skills/_shared/pitfalls/INDEX.md` (docu-parser 실측 — code-review/plan/team 3카테고리)
