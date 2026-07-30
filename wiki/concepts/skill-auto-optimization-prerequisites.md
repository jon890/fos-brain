---
type: concept
created: 2026-06-12
updated: 2026-06-12
---

# 스킬 자동 최적화의 전제 — reward·held-out 이 선행 조건

SkillOpt 류 자동 최적화는 채점 가능한 reward 함수와 held-out 검증셋이 없으면 아무 편집도 만들지 못한다 — 채점 신호 정의가 자동화의 선행 조건이다.

## 핵심 포인트

- reward 부재가 곧 자동화 불가의 벽이다.
  - SkillOpt-Sleep 을 mock(reference 없음)으로 1회 돌리니 held-out 0.000 → 0.000, edits 0 으로 빈손 종료했다.
  - 직접 만든 `docs_score`·`brain_score`(위반 수 가중 감점)처럼 reward 가 있으면 검증 점검이 작동한다.
- 스킬을 채점 가능성으로 분류하는 A/B/C 틀
  - A 계층 — lint 통과·실패 같은 객관 신호가 이미 있다(예: docs-audit, brain-lint). 본체 학습 루프를 바로 돌릴 수 있다.
  - B 계층 — 규칙 체크리스트를 위반 수로 환산하면 reward 가 된다. 단 "AI 티·재미" 같은 핵심 품질은 규칙으로 못 잡아 LLM judge 를 섞는다.
  - C 계층 — 정답이 없어 본체 학습이 불가능하다(브라우저 자동화·외부 API 래퍼).
    - 정답이 없는 이유 — 부수효과, 승인 흐름, 외부 상태 변동
- 대화형·사람 확인(미리보기 → confirm) 중심 워크플로우는 자동 채점 루프와 근본적으로 안 맞으므로, 도구가 아니라 규율(편집 예산·검증 점검)만 빌린다.

## 관련 개념

- [[skillopt-trainable-skill-document]] — 이 전제가 충족돼야 작동하는 본체
- [[two-tier-reward-static-llm-judge]] — B 계층에서 규칙과 judge 를 함께 쓰는 방법

## Sources

- [[../../raw/notes/2026-06-12-skillopt-sessions.md]]
