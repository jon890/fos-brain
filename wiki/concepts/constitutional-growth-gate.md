---
type: concept
created: 2026-06-25
updated: 2026-06-25
---

# Constitutional growth gate

Constitutional growth gate는 AI 에이전트가 학습 업데이트를 적용하기 전에, 그 업데이트가 핵심 가치와 안전 시나리오를 위반하지 않는지 검사하는 hard gate다.

GNOSIS 발표에서는 이를 CIB 또는 constitutional invariant barrier로 설명한다.
업데이트가 constitution space 안에 있을 때만 적용하고, 벗어나면 업데이트를 0으로 만든다는 아이디어다.

## 왜 필요한가

자기 학습 시스템은 세 가지 실패를 반복해 왔다.

- 자기 평가만 믿다가 잘못된 규칙을 강화한다.
- 가치 기준이 오염되어 시스템 정체성이 무너진다.
- 여러 자동 시스템이 서로를 증폭해 위험한 속도로 발산한다.

따라서 성장형 에이전트에는 "무엇이 좋아졌는가"를 평가하는 함수와 별도로, "무엇은 절대 넘으면 안 되는가"를 차단하는 장치가 필요하다.

## soft signal 과 hard gate 를 분리한다

영상은 두 종류의 안전 장치를 분리한다.

- **coherence monitor** — 행동 일관성을 0-1 점수로 측정하는 보조 진단이다.
- **constitutional gate** — constitution 시나리오를 검사하고 pass/block 중 하나를 반환하는 절대 차단이다.

둘을 합치지 않는 이유는 역할이 다르기 때문이다.
soft signal은 누적 표류와 미세한 흔들림을 감지하고, hard gate는 명백한 위반을 즉시 차단한다.

## 델타 크기는 원칙이 아니라 프록시다

발표에서 중요한 정정은 `delta max` 같은 변경 크기 제한이 안전의 본질이 아니라는 점이다.
작은 변경도 방향이 틀리면 위험하고, 큰 변경도 constitution 안에서 정렬되어 있으면 성장일 수 있다.
따라서 진짜 원칙은 변경 크기가 아니라 constitution 위반 여부다.

## brain 적용

AI 하네스에서 이 패턴은 다음 질문으로 바꿔 쓸 수 있다.

- 자동으로 스킬이나 규칙을 바꾸기 전에 어떤 invariant를 검사할 것인가?
- 리뷰 학습을 누적할 때 어떤 규칙은 절대 자동 변경하지 않을 것인가?
- score가 좋아져도 차단해야 하는 failure mode는 무엇인가?

## 관련 개념

- [[gnosis-agent-autonomous-growth]] — constitutional gate를 포함하는 전체 프레임워크
- [[self-improving-harness]] — 리뷰 학습을 누적할 때 gate가 필요한 기존 루프
- [[reward-detector-false-positive]] — 잘못된 reward가 잘못된 학습 방향을 만드는 문제
- [[two-tier-reward-static-llm-judge]] — 정적 바닥과 LLM judge 천장을 나누는 평가 구조

## Sources

- [[../../raw/videos/2026-06-17-naver-d2-gnosis-agent-autonomous-growth.md]]
