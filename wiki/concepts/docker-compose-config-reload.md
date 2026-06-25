---
type: concept
created: 2026-05-29
updated: 2026-05-29
---

# docker compose 설정 변경이 반영 안 되는 함정 (마운트 config + up -d)

마운트한 설정 파일을 고치고 `docker compose up -d` 를 해도 변경이 반영 안 되는 경우가 있다.
컨테이너는 옛 설정으로 계속 돈다.
에러가 안 나서 배포는 성공한 것처럼 보이는데 동작만 그대로라, 모르면 한참 헤맨다.

## 원인 — up -d 의 recreate 트리거

`docker compose up -d` 는 컨테이너를 무조건 다시 만들지 않는다.
desired spec 과 현재 컨테이너를 비교해 **spec 이 바뀐 경우에만** recreate 한다.

recreate 를 트리거하는 spec:

- 이미지 digest (`pull` 로 새 이미지를 받으면 자동 recreate)
- environment, command, ports, 볼륨 **정의**(마운트 경로)

트리거하지 않는 것:

- **볼륨으로 마운트된 파일의 내용** — 마운트 정의(경로)는 그대로라 compose 는 spec 변화로 보지 않는다.

그래서 `./config/app.yaml:/etc/app.yaml:ro` 로 마운트한 설정 파일의 내용만 바꾸면, `up -d` 는 "변화 없음" 으로 판단하고 옛 컨테이너를 그대로 둔다.

## 해결 — force-recreate

```bash
docker compose up -d --force-recreate
```

spec 변화 여부와 무관하게 컨테이너를 다시 만들어 마운트를 새로 적용한다.
이미지 변경이든 마운트 config 변경이든 항상 반영된다.

배포 스크립트에서 `up -d` 만 쓰면 config-only 변경이 조용히 누락되므로, config 를 마운트하는 서비스는 `--force-recreate` 를 명시한다.

### restart 와의 차이

- `docker compose restart` 는 프로세스만 재시작한다. 프로세스가 시작 시 마운트된 현재 파일을 읽으면 config 는 반영되지만, `pull` 로 받은 새 이미지는 반영되지 않는다.
- 이미지와 config 를 모두 반영하려면 `--force-recreate`(또는 `down` 후 `up -d`) 를 쓴다.

## 진단

설정을 바꿨는데 동작이 그대로면 컨테이너 시작 시각부터 본다.

```bash
docker inspect <container> --format '{{.State.StartedAt}}'
```

StartedAt 이 설정 변경 시각보다 이전이면, 컨테이너가 옛 설정으로 돌고 있는 것이다.

## k8s 비교 (참고, 미실측)

k8s 도 ConfigMap 을 마운트한 Pod 는 ConfigMap 변경만으로 자동 재시작되지 않는다.
`kubectl rollout restart deployment/<name>` 로 Pod 를 새로 띄워야 반영되는 유사 패턴이다.

## 관련 개념

- [[operations-troubleshooting]] — 이 함정이 속한 운영 트러블슈팅 주제
- [[k8s-run-tmpfs-containerd]] — 같은 컨테이너 운영 영역의 함정

## Sources

- wiki log: 2026-05-29 ingest, docu-parser Vector 사이드카 로그 유실 디버깅 세션에서 범용 Docker Compose 패턴만 추출
