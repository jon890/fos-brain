---
type: concept
created: 2026-05-28
updated: 2026-05-28
---

# Observability 세 기둥 (Logs / Metrics / Traces)

관측성의 표준 모델은 세 가지 신호다. 서로 보완하며, 하나만 빠져도 안 된다.

## 세 신호

- **Logs** — 이산적 이벤트의 시간순 기록.
  - 강점: 개별 요청의 맥락이 풍부하다.
  - 약점: 집계 비용이 크고 cardinality 가 폭발하기 쉽다.
- **Metrics** — 시계열 수치 집계(요청 수, 에러율, 지연 분포).
  - 강점: 저장·질의가 싸고 알림 걸기 쉽다.
  - 약점: 개별 이벤트 맥락을 잃는다.
- **Traces** — 한 요청이 분산 시스템을 가로지르는 경로(span 트리).
  - 강점: 서비스 경계를 넘는 병목을 찾는다.
  - 약점: 전량 수집 비용이 커서 sampling 이 필수다.

## 상호 보완

- Metric 으로 이상 감지 → Trace 로 느린 요청 경로 특정 → 해당 span 의 Log 로 근본 원인 확정.

## 각 신호의 한계

- Logs — cardinality 지옥(사용자 ID·요청 ID 를 라벨로 인덱싱하면 저장비 폭증).
- Metrics — 평균의 함정([[latency-percentiles]] 참조).
- Traces — sampling bias(1% 샘플링이면 드문 장애를 놓침).

## 관련 개념

- [[latency-percentiles]]
- [[prometheus-histogram-vs-summary]]
- [[../topics/observability]]

## Sources

- fos-study: `architecture/observability-basics.md`
