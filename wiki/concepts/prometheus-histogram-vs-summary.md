---
type: concept
created: 2026-05-28
updated: 2026-05-28
---

# Prometheus Histogram vs Summary (+ cardinality 함정)

분위수를 어디서 계산하느냐가 둘을 가른다. 대부분 Histogram 이 정답이다.

## Histogram vs Summary

| 항목 | Histogram | Summary |
| --- | --- | --- |
| 분위수 계산 | 서버(Prometheus) | 클라이언트 |
| 여러 인스턴스 합산 | 가능 | **불가능** |
| 정확도 | bucket 경계에 의존 | 정확 |
| 런타임 비용 | 낮음 | 높음(sliding window) |
| 권장 | 대부분 ✅ | 특수한 경우만 |

- 여러 파드의 전체 서비스 p99 는 **각 파드 p99 를 평균 내면 수학적으로 틀린다**.
- Histogram 은 각 파드 bucket 을 `sum by (le)` 로 더한 뒤 `histogram_quantile` 로 전역 분위수를 낸다.
- bucket 해상도가 거칠면 분위수 추정도 거칠어진다.

## Cardinality 함정

- 라벨에 high-cardinality 값(userId, 원본 path, IP)을 넣으면 타임시리즈가 수조 개로 폭발해 OOM·저장비 폭증.
- 라벨에는 low-cardinality 만 넣는다.
  - method, 정규화된 route(`/users/{id}/orders`), status_class(`2xx`)
- userId·원본 path 는 메트릭이 아니라 **로그·trace** 에 둔다(신호 분리).

## 네 가지 메트릭 타입

- Counter — 단조 증가(`rate()` 로 증가율)
- Gauge — 오르내리는 값(스레드 수, 큐 길이)
- Histogram — 서버 쪽 bucket 카운트
- Summary — 클라 쪽 사전 계산 분위수

## 관련 개념

- [[latency-percentiles]] — 다인스턴스 분위수 계산의 근거
- [[observability-three-pillars]] — 신호 분리(메트릭 vs 로그)
- [[observability]]

## Sources

- fos-study: `architecture/observability-basics.md`
