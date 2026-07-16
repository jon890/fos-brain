---
type: concept
created: 2026-06-12
updated: 2026-06-12
---

# 컨테이너 PID 1 좀비 reaping 과 tini 도입

LibreOffice 런처가 soffice.bin 을 띄운 뒤 먼저 종료해 고아가 PID 1(uvicorn)에 입양되지만, uvicorn 이 reaper 가 아니라 좀비가 누적되는 문제를 Dockerfile ENTRYPOINT 를 tini 로 감싸 이미지 레벨 단일 지점에서 reap 한다.

## 메커니즘

- libreoffice 런처가 작업 프로세스 soffice.bin 을 spawn 한 뒤 먼저 종료한다.
- soffice.bin 이 고아가 되어 PID 1(uvicorn)에 입양된다.
- uvicorn 은 init 이 아니라 `wait()` 로 거두지 않아 좀비가 누적된다(운영에서 약 1주에 420개 실측).
- 좀비는 PID 슬롯을 점유하므로 누적 시 PID 고갈로 fork 가 실패할 위험이 있다.

## 해결책

- `docker run --init`(실행 경로마다 누락 위험)·코드 내 `wait()`(불완전) 대신 Dockerfile ENTRYPOINT 를 tini 로 래핑한다.
- 이미지 레벨 단일 지점이라 MPS on/off 분기와 무관하게 최상위 tini 가 모든 고아를 reap 한다.
- tini 가 SIGTERM 을 자식에 forward 하므로 기존 graceful shutdown 동작이 유지된다.

## Sources

- 원본: work 네임스페이스에서 이관 (일반화)
