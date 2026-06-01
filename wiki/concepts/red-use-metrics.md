---
type: concept
created: 2026-05-28
updated: 2026-05-28
---

# RED / USE 메트릭 분류

"어떤 메트릭을 봐야 하나"에 대한 두 가지 정석. 둘 다 본다는 것이 핵심이다.

## RED (요청 중심, 보통 API 서비스)

- **Rate** — 초당 요청 수
- **Errors** — 실패한 요청 수 또는 비율
- **Duration** — 지연 분포(p50/p95/p99). [[latency-percentiles]]

## USE (리소스 중심, 보통 인프라·백엔드 리소스)

- **Utilization** — 사용률(예: CPU 70%)
- **Saturation** — 대기·포화(run queue 길이, DB connection pool wait)
- **Errors** — 리소스 레벨 에러(디스크 read error, TCP retransmit)

## 실전 적용

- API 서비스는 RED 로, DB·캐시·큐는 USE 로 본다.
- Utilization 이 60% 로 여유로워 보여도 Saturation(예: pool 이 꽉 차 대기)이 있으면 사용자는 이미 느려진다.

## 관련 개념

- [[latency-percentiles]] — Duration 의 측정 방식
- [[observability-three-pillars]]
- [[observability]]

## Sources

- fos-study: `architecture/observability-basics.md`
