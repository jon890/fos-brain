---
type: concept
created: 2026-05-28
updated: 2026-05-28
---

# Latency 백분위수 (p50 / p95 / p99)

운영에서 latency 는 평균이 아니라 백분위수로 본다.
"이 값보다 작거나 같은 요청이 전체의 N%" 라는 표현이다.

## 정의

- p50 — 중앙값. 요청의 절반이 이보다 빠르다.
- p95 — 95% 가 이보다 빠르다. 5% 사용자는 더 느린 경험을 한다.
- p99 — 1% 사용자가 이 값 이상 기다린다.
- p99.9 — 1,000 명 중 1 명이 이 값 이상 기다린다.

## 평균의 함정

- 평균 200ms 라도 분포가 완전히 다를 수 있다.
  - A: 거의 모든 요청 200ms (일관되게 빠름)
  - B: 대부분 50ms + 일부 5s 튐 (p99 = 5,000ms)
- 평균은 outlier 에 둔감해서, p99 가 5초여도 평균은 200ms 로 평온해 보인다.
- 사용자 경험은 평균이 아니라 꼬리(tail)에서 결정된다.

## 어디서 어느 분위수를 보나

- p50 — 대시보드 기본 추세선
- p95 — SLO 알람 기본값 (덜 튀어 알람에 적합)
- p99 — 장애 감지·회고 (꼬리 사용자 1%)
- p99.9 — 결제·인증처럼 실패 비용이 큰 경로
- 규모와 함께 본다 — p99 가 분당 100만 요청이면 매분 1만 건이 그 이상을 기다린다.

## 계산 주의

- 여러 인스턴스의 p99 를 산술 평균하면 틀린다. bucket 을 합산한 뒤 추정해야 한다. [[prometheus-histogram-vs-summary]]
- window 가 짧으면 흔들린다(트래픽 적을 때 단일 요청에 좌우).
- Prometheus: `histogram_quantile(0.99, sum by (le) (rate(..._bucket[1m])))`

## 관련 개념

- [[red-use-metrics]] — Duration 이 곧 백분위수
- [[prometheus-histogram-vs-summary]]
- [[../topics/observability]]

## Sources

- fos-study: `architecture/observability-basics.md`
