---
type: concept
created: 2026-06-12
updated: 2026-06-12
---

# reward detector 의 false positive 를 먼저 잡아야 한다

위반 수를 reward 로 쓸 때 detector 의 오탐을 먼저 제거하지 않으면, 가짜 위반을 "개선"하는 잘못된 방향으로 학습이 흐른다.

## 핵심 포인트

- reward 신호로 쓰는 정적 검사는 오탐 검증(spot-check)을 통과한 뒤에만 신뢰한다.
  - 안 그러면 잘못된 그래디언트로 최적화해 멀쩡한 부분을 망가뜨린다.
- 한 세션에서 두 번 재현했다.
  - bold 안 markdown 링크의 `(url)` 을 bold+괄호 위반으로 오탐(17건 중 5건 가짜).
  - brain 의 entities·topics 를 Sources 누락으로 과다 집계(21 → 10건).
- detector 를 고칠 때마다 "이건 위반 아님"을 코드에 누적하는 것이 SkillOpt 의 거부 편집 버퍼와 같은 메커니즘이다 — 같은 오탐을 다시 잡지 않게 만든다.
- 면제 판단 예
  - 자기 경험이 출처인 entity·narrative 성 topic 은 Sources 면제.
  - 의도적 범위 표기(`1~2`)는 escape 로만 처리.

## 관련 개념

- [[two-tier-reward-static-llm-judge]] — 정적 detector 가 1계층 reward 일 때의 신뢰성 문제
- [[skill-auto-optimization-prerequisites]] — reward 품질이 자동화 성패를 가른다

## Sources

- [[../../raw/notes/2026-06-12-skillopt-sessions.md]]
