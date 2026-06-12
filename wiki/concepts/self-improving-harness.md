---
type: concept
created: 2026-05-28
updated: 2026-06-12
---

# 자기개선 하네스 (메타 피드백 루프)

하네스가 작업하면서 발견한 함정·리뷰 학습을 스킬·문서에 영구 기록해 다음 작업의 품질을 높이는 루프.

## 핵심 포인트

- **리뷰 학습 누적** — PR 리뷰 댓글을 필수/권장으로 분류해 자동 반영하고, 일반화 가능한 교훈을 `_shared/common-pitfalls.md` 에 번호로 적재한다(fos-blog `BLG1~26`).
- **스킬 자기수정**: 스킬 실행 중 발견한 안티패턴을 해당 `SKILL.md`·`CLAUDE.md` 에 즉시 반영한다(fos-blog/fos-study 의 "함정 N 강화" 커밋 다수).
- **self-healing-teams** — build-with-teams 위에 메타 오케스트레이터를 두어 4가지 자가치유를 수행한다. 실행 후 회고는 스킬 파일에 기록한다.
- **작성↔검증 분리 제도화**: critic·docs-verifier 가 "자기 면제" 문구를 쓰지 못하도록 명시 금지한다.
- **docs-audit Quality Loop** — 문서를 5단계로 분류해 주기적으로 흡수·폐기한다.
  - keep
  - refresh
  - merge
  - archive
  - delete
- **SkillOpt 로 형식화** — 이 수동 루프를 머신러닝 학습 루프로 자동화한 외부 방법론이 SkillOpt 다. 편집 예산·검증 점검이라는 규율을 빌려올 수 있다.

## 역할별 회고 분리 (거울 구조)

회고를 평가자 역할별로 분리하면 학습이 올바른 위치에 쌓인다.
누적 대상이 역할마다 다르기 때문이다.

- critic 의 REVISE — plan 설계 패턴으로 환원한다(회피 패턴 wiki 의 plan 카테고리).
- code-reviewer 의 FIX — 코드 패턴으로 환원한다(code-review 카테고리).
- docs-verifier 의 UPDATE — docs 영향 표의 한 행으로 환원한다([[planning-eight-step-design]] 의 변경 영향 표).

핵심은 거울 구조다 — 회고 결과를 **별도 회고 문서로 신설하지 않고 기존 단일 소스에 직접 누적**한다.
회고 산출물이 또 다른 문서가 되면 그것이 새로운 rot 소스가 된다.

각 역할의 회고 파일은 같은 골격을 갖는다.

- 트리거 — 해당 평가자가 1회 이상 지적하면 의무 실행, 1-shot 통과면 skip, 0건이라도 자문.
- 반복 가능성 판정 — 아래 축적 점검 4조건.
- 갱신 위치 — 역할별로 다른 단일 소스.
- 작성 형식 + 커밋 규약 — 회고 commit 은 작업 브랜치에서 PR 에 포함, main 직접 commit 금지.

## 회피 패턴 wiki 의 운영 (파일 per 패턴 + 라우터)

리뷰 학습을 한 큰 파일이 아니라 카테고리 디렉터리 + 라우터(INDEX)로 운영하면 누적이 컨텍스트를 잠식하지 않는다.
구조 패턴 자체는 [[merge-conflict-free-append]] 이고, 자기개선 루프 관점의 운영 규율은 다음이다.

- **소비 3단계** — (1) 라우터 표에서 이번 작업의 변경 유형 행을 찾고, (2) 가리키는 파일만 self-check, (3) 애매하면 카테고리 디렉터리 통째로(과소선택보다 안전). 전부 읽지 않는 progressive disclosure 다.
- **triggers 매칭** — 각 패턴 파일 frontmatter 의 `triggers` 키워드로 라우터가 매칭한다. 변경 유형 키워드로 grep 해 좁힌다.
- **축적 점검 4조건** — 모두 통과할 때만 새 파일로 추가한다. 1회성은 PR 답글로 끝낸다.
  - 재발성 — 2회 이상 재발했거나 다른 코드에서도 날 구조적 가능성.
  - 심각도 — 데이터 손상·문서 전체 실패·보안 등 영향이 크다.
  - 도구로 못 잡음 — 린터·타입체커·테스트가 이미 잡는 건 추가하지 않는다(도구가 단일 소스).
  - 추상화 가능 — 특정 인시던트를 넘어 일반화된다.
- **prune·automate 패스** — 회고가 ADD 로만 기울지 않게, 회고 10회마다 또는 분기 1회 의무 수행한다.
  - prune — 가리키는 코드가 사라진 stale 파일 삭제, 같은 커널 중복 파일 병합.
  - automate — 도구로 승격 가능한 패턴은 린터 규칙·ast-grep·테스트로 옮기고 파일 삭제.

## 관련 개념

- [[ai-harness-pattern]] — 이 루프가 붙는 베이스 하네스
- [[build-with-teams-rules]] — 회고 학습이 누적되는 build-with-teams 규칙 모음
- [[pr-review-fix-workflow]] — 리뷰 학습 누적을 수행하는 사후 단계 (이 루프의 입력원)
- [[docs-six-axis-audit]] — docs 품질 분류·흡수가 누적되는 점검 단계
- [[korean-readability-policy]] — 문체 위반도 누적 점검 대상
- [[skillopt-trainable-skill-document]] — 이 수동 루프를 자동화·형식화한 외부 방법론(SkillOpt)
- [[merge-conflict-free-append]] — 회피 패턴 wiki 의 파일 per 패턴 + INDEX 구조 (이 루프가 운영 규율을 더한다)

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
- [[../../raw/notes/2026-06-12-docu-parser-harness-evolution.md]] — 역할별 회고 거울 구조·회피 패턴 wiki 운영 규율 보강
