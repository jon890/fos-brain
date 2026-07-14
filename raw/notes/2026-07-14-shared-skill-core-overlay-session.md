---
source: 세션 대화 요약
collected: 2026-07-14
type: note
---

# 공용 스킬 코어 + 오버레이 이관 세션 (2026-07-14)

`planning` 스킬이 개인 레포 6곳에 복제돼 개선할 때마다 수동 포팅하던 문제를, 단일 코어 + 레포 오버레이 구조로 전환한 작업 기록.

## 한 일

- grill-me(mattpocock `grilling`, JuliusBrussee 확장)·superpowers(brainstorming·writing-plans) 와 내 planning 을 비교해 질문 규율·0단계 보정·self-review 를 planning 에 흡수.
- planning 스킬을 공용 코어로 추출: 전용 repo `fos-skills`(public) 에 코어를 두고 글로벌 `~/.claude/skills/planning` 로 symlink. 레포 특화는 각 레포 `.claude/planning-overlay.md`.
- personal 6개 레포(fos-blog·fos-agents·fos-accountbook(-backend)·dooray-cli·nhncloud-cli) 를 코어+오버레이로 이관.
- 미사용 `plan-and-build` 스킬을 6개 레포에서 제거하고 build-with-teams 로 일원화.

## 핵심 학습

1. **코어 + 오버레이 배포** — 개선 1회 = 코어 1곳 수정 → 전 레포 반영. 수동 포팅 소멸.
2. **전역 override 함정** — Claude Code 는 personal(`~/.claude/skills`) > project 우선. 개인 전역 스킬이 자체 in-repo 동명 스킬을 가진 다른 레포를 그 머신에서 가린다(팀원 무영향). `skillOverrides:off` 는 이름을 숨길 뿐 프로젝트 쪽을 못 띄운다.
3. **이관 결합점** — 의존 스킬의 하드코딩 경로, 삭제 대상 하위의 공유 자원(common-pitfalls) 이 통째 삭제 시 깨진다. 삭제 전 참조 전수 grep + 공유 자원 `_shared` 이동. 과거 기록(ADR·튜토리얼·완료 task) 언급은 보존.

## 함께 정리한 planning 원칙 (제거·완화)

- "속도와 안정성 트레이드오프 — 빠른 MVP 출시" 원칙 제거 (매 작업을 빠른 MVP 관점으로 몰아서).
- "불필요한 복잡도 추가 금지" → "근거 있으면 도입, 근거 없이 늘리지 않기" 균형으로.
- 규모별 단계 스킵 고정 표 제거 → "규모에 맞춰 판단, 7단계만 항상" 유연 문구.
- "ADR 자명성 게이트" → "ADR 자명성 점검" (외래어 순화).
