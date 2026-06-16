---
source: https://www.youtube.com/watch?v=uhMhv8yGAyM
collected: 2026-06-16
type: youtube
channel: 코딩하는기술사 (@codingpe)
upload_date: 2026-06-15
membership: true
auto_caption: true
---

# DB 커넥션 풀 사이징 (코딩하는기술사, 핵심 요약)

> **멤버십(유료) 영상**이라 자막 전문은 저장하지 않고 핵심 개념만 요약한다(저작권 보호).
> 자동자막 기반이라 일부 용어가 오인식됐을 수 있다.

채널 코딩하는기술사(`@codingpe`) · 2026-06-15 · 37:33.

## 핵심 요약

- 풀 사이즈 공식 — `물리 코어 × 2 + 스핀들 수`(SSD·NVMe 면 스핀들 0). PostgreSQL 위키 경험칙이며 시작점일 뿐, 부하 테스트로 조정한다.
- USL(보편적 확장성 법칙) — 커넥션이 많을수록 처리량이 평탄화·하락한다(컨텍스트 스위칭·락 경쟁·캐시 효율 저하).
- Little's Law — `TPS = 활성 커넥션 / 쿼리 실행 시간`. 풀 부족과 쿼리 부족을 구별하는 진단 도구다.
- WAS 다중 인스턴스 — WAS별 풀을 곱하지 말고 `코어 × 2 / WAS 수` 로 분배한다. DB 보호 vs 가용성 트레이드오프.
- max_connections — 전체 풀 합이 `maxconn × 0.8` 미만이어야 한다. 초과 시 PgBouncer 외부 풀러.
- 4대 함정 — 롱 트랜잭션, maxLifetime vs DB idle timeout 미스매치, CM>1 데드락, 커넥션 누수.

## 컴파일된 wiki

- [[connection-pool-sizing]]
- [[connection-pool-pitfalls]]
- [[coding-engineer-tv]]
