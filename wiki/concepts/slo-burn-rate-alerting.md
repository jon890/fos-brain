---
type: concept
created: 2026-05-28
updated: 2026-05-28
---

# SLO burn-rate 알림 (symptom vs cause)

좋은 알림은 "사람이 깨서 무언가 해야 한다"의 요청이다. 관찰만 하는 알림은 대시보드로 내린다.

## Symptom 우선

- **Symptom** — 사용자에게 보이는 현상으로 알린다(예: 결제 API error rate > 2% for 5min).
- **Cause** — 원인 지표(예: DB CPU > 80%)는 꼭 사용자 영향을 뜻하지 않으므로 대시보드로만 본다.
- symptom 을 1차 페이지로, cause 는 보조로 둔다.

## 액션 가능성

- 알림은 액션 가능한 것만 보낸다. 아무 액션 없는 알림은 알림이 아니다.
- payload 에 `runbook_url` 과 dashboard 링크를 넣어 새벽 3시에도 5분 안에 대응하게 한다.

## Multi-window, multi-burn-rate

- SLO budget 소진 속도로 긴급도를 가른다.
- "1시간 14.4배 burn" + "6시간 6배 burn" 을 동시에 만족하면 긴급 페이지(fast burn).
- 한쪽만이면 덜 긴급한 티켓.

## Flapping 억제

- 최소 지속 시간(`for: 5m`), hysteresis, alert grouping 으로 떨림을 줄인다.

## 관련 개념

- [[latency-percentiles]] — p95/p99 가 SLO 지표
- [[red-use-metrics]] — error rate·latency 가 symptom
- [[../topics/observability]]

## Sources

- fos-study: `architecture/observability-basics.md`
