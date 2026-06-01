---
type: concept
created: 2026-05-28
updated: 2026-05-28
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

## 관련 개념

- [[ai-harness-pattern]] — 이 루프가 붙는 베이스 하네스
- [[build-with-teams-rules]] — 회고 학습이 누적되는 build-with-teams 규칙 모음
- [[pr-review-fix-workflow]] — 리뷰 학습 누적을 수행하는 사후 단계 (이 루프의 입력원)
- [[docs-six-axis-audit]] — docs 품질 분류·흡수가 누적되는 점검 단계
- [[korean-readability-policy]] — 문체 위반도 누적 점검 대상

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
