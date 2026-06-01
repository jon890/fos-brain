---
type: topic
created: 2026-06-01
updated: 2026-06-01
---

# 운영 트러블슈팅

운영 중 실제로 터진 인프라·컨테이너 문제와 그 해결을 모은다.
개념 학습이 아니라 "겪고 고친" 실전 incident 가 쌓이는 자리다.

관측성([[observability]])이 "어떻게 탐지·진단하나"의 방법론이라면,
여기는 "탐지한 뒤 무엇이 원인이었고 어떻게 고쳤나"의 사례를 다룬다.

## 공통 교훈

- **성공처럼 보이는 실패가 핵심 함정이다.** 에러가 안 나서 배포는 성공한 듯한데 동작만 옛 상태라, 모르면 한참 헤맨다.
- **증상과 원인의 계층이 다르다.**
  - 배포가 성공해도 동작이 옛 설정 — config 미반영.
  - 루트 디스크는 여유인데 Pod 가 안 뜸 — `/run` tmpfs 포화.
- **진단은 계층을 분리해서 본다.**
  - 컨테이너 StartedAt 으로 옛 상태 여부를 가린다.
  - `/run` 과 `/` 의 사용량을 따로 본다.

## Concepts

- [[docker-compose-config-reload]] — 마운트 config 변경이 `up -d` 로 반영 안 되는 함정, force-recreate 로 해결
- [[k8s-run-tmpfs-containerd]] — 루트 디스크는 여유인데 `/run` tmpfs 포화로 Pod 가 안 뜨는 장애

## 관련 Topics

- [[observability]] — 장애 탐지·진단의 방법론
