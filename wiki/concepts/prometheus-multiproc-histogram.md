---
type: concept
created: 2026-06-12
updated: 2026-06-25
---

# Prometheus 멀티프로세스 모드 Histogram 은 메인 프로세스에서 lazy create 안 됨

`prometheus_client` 멀티프로세스 모드에서 Histogram 의 `.db` 파일은 메인 프로세스에서 lazy create 되지 않아, 워커 프로세스가 직접 observe 해야 `histogram_<wpid>.db` 가 생성되어 통합 노출된다.

## 핵심 포인트

- 메인 프로세스에서 Histogram 을 observe 해도 `histogram_<pid>.db` 가 안 만들어지는 함정이 운영 8/8 host 실측으로 확인됐다.
- 회피책: 처리시간 observe 를 워커 프로세스의 finally 블록에서 수행한다 — 워커 PID 의 `histogram_<wpid>.db` 가 생성되어 multiproc 통합 시 정상 노출된다.
- 워커 측 finally observe 는 정상·에러 경로 모두 기록한다.
  - success·fail 양쪽 처리시간이 커버된다.
  - 단 status 라벨이 없어 분포는 합산되고, 성공·실패 카운트 분리는 Counter 가 담당한다.
- 메트릭 객체 모듈은 `PROMETHEUS_MULTIPROC_DIR` 환경변수 설정 이후에 import 해야 한다 — top-level import 시 단일 프로세스 모드로 고정된다.
- 새 Counter 를 추가할 때도 import 시점 규칙은 같다. worker/runtime 코드에서는 계측 지점 내부에서 metrics 모듈을 lazy import 해 multiprocess 환경 설정 이후 등록되도록 한다.
- Counter 에는 Gauge 의 `multiprocess_mode` 설정이 필요하지 않지만, 라벨은 저카디널리티로 유지한다.

## Sources

- 원본: work 네임스페이스에서 이관 (일반화)
