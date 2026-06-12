---
type: concept
created: 2026-06-12
updated: 2026-06-12
---

# 2계층 reward — 정적 정규식 바닥 + LLM judge 천장

품질 평가를 결정적 정적 검사(1계층 바닥)와 LLM judge(2계층 천장)로 나누고, 검출 대상을 false positive 위험으로 갈라 배치하는 설계다.

## 핵심 포인트

- 1계층(정적·정규식) — 알려진 명백한 패턴의 회귀 방지 바닥
  - 무료·결정적이며 반복 패턴을 확실히 차단한다.
- 2계층(LLM judge) — 정규식이 못 보는 의미 품질과 사전 밖 새 표현을 유연하게 커버
  - 의미 품질 예 — 인사이트 유무, AI 티, 서사 흐름
  - 1계층 통과분만 올려 비용을 줄인다.
- 검출 대상 분배 기준
  - false positive 가 적은 명백한 항목만 정적 사전에 좁게 넣는다.
  - 맥락 의존(정당한 용례가 있는) 항목은 judge 에 맡긴다.
- LLM judge 함정 방어 두 장치
  - N회 호출 median — 다수결로 이상치 제거.
  - adversarial — 매 호출이 약점 3개를 먼저 찾고 채점해 grade inflation 을 막는다.

## 관련 개념

- [[reward-detector-false-positive]] — 1계층 정적 검출의 오탐 관리
- [[korean-readability-policy]] — 직역어·가독성 위반이 실제 1·2계층 검출 대상
- [[skill-auto-optimization-prerequisites]] — B 계층 스킬에서 규칙과 judge 를 함께 쓰는 근거

## Sources

- [[../../raw/notes/2026-06-12-skillopt-sessions.md]]
