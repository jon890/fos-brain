---
type: topic
created: 2026-05-28
updated: 2026-05-28
---

# Observability (관측가능성)

분산 시스템의 외부 출력(logs, metrics, traces)만으로 내부 상태를 추론하는 성질.
Monitoring 이 "미리 정의한 질문에 답"이라면, Observability 는 "예상 못 한 질문도 할 수 있게" 만든다.

## 핵심 개념

- [[../concepts/observability-three-pillars]] — Logs / Metrics / Traces
- [[../concepts/latency-percentiles]] — p50 / p95 / p99, 평균의 함정
- [[../concepts/red-use-metrics]] — RED(API) / USE(리소스)
- [[../concepts/prometheus-histogram-vs-summary]] — 분위수 집계, cardinality 함정
- [[../concepts/slo-burn-rate-alerting]] — symptom 우선 알림

## 운영 원칙

- Metric 으로 이상을 감지하고, Trace 로 느린 경로를 특정하고, Log 로 근본 원인을 확정한다.
- 장애 초기 10분 안에 "어느 서비스·엔드포인트·상태코드인지" 답하는 것을 목표로 한다.
- 세 신호는 trace ID 하나로 묶인다(로그 MDC ↔ trace span).

## Sources

- fos-study: `architecture/observability-basics.md` (외부 repo `~/personal/fos-study`)
