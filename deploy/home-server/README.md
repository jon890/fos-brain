# 홈서버 배포 운영

이 디렉터리는 보호 Quartz와 내부 `brain-qmd` 검색 서비스를 홈서버에서 실행하는 파일을 담는다.
운영 서버 설치와 systemd 등록은 별도 단계에서 수행한다.

## brain-qmd build

`brain-qmd` image는 Node.js 24.15.0과 `@tobilu/qmd` 2.8.3을 고정한다.
image는 root가 아니라 UID와 GID 1000으로 실행한다.
서비스 자원은 CPU 2개와 메모리 4GiB로 제한한다.
설정과 색인은 각각 `/home/bifos/.brain-qmd/config`, `/home/bifos/.brain-qmd/cache`에 두고 상위 디렉터리는 UID와 GID 1000, mode 700을 유지한다.

```bash
cd /home/bifos/apps/fos-brain-deploy/brain-qmd
docker compose --env-file ../.env build brain-qmd
```

## serve

서비스는 host port를 열지 않고 `brain-search-net` Docker network에만 붙는다.
Hermes는 `hermes-brain-qmd.override.yaml`로 같은 network에 연결하고 `BRAIN_QMD_URL=http://brain-qmd:8181`을 받는다.
Hermes 검색 어댑터에는 canonical `brain-search-http.cjs`와 내용이 같은 client를 함께 배포한다.
검증 스크립트가 두 파일의 일치를 확인해 복사본의 드리프트를 막는다.

```bash
cd /home/bifos/apps/fos-brain-deploy/brain-qmd
docker compose --env-file ../.env up -d brain-qmd
```

마운트 범위는 public wiki, public raw, private wiki, `/home/bifos/.brain-qmd`이다.
private raw는 container에 마운트하지 않는다.

## health

`brain-qmd`의 healthcheck는 내부에서 `GET /health`가 200을 반환하는지 확인한다.

```bash
docker compose --env-file /home/bifos/apps/fos-brain-deploy/.env \
  -f /home/bifos/apps/fos-brain-deploy/brain-qmd/compose.yaml ps brain-qmd
docker exec "$(docker compose --env-file /home/bifos/apps/fos-brain-deploy/.env \
  -f /home/bifos/apps/fos-brain-deploy/brain-qmd/compose.yaml ps -q brain-qmd)" \
  node -e "fetch('http://127.0.0.1:8181/health').then(async r => { console.log(r.status); process.exit(r.status === 200 ? 0 : 1) })"
```

## query

Hermes 안에서는 `BRAIN_QMD_URL`로 HTTP 검색을 우선 사용한다.
직접 확인할 때는 같은 질문을 `lex`와 `vec`로 보내고 `rerank`는 끈다.

```bash
curl -sS http://brain-qmd:8181/query \
  -H 'content-type: application/json' \
  --data '{"searches":[{"type":"lex","query":"agent workflow"},{"type":"vec","query":"agent workflow"}],"collections":["brain-wiki","brain-private"],"limit":5,"rerank":false}'
```

## sync

`sync-qmd.sh`는 host에서 전용 lock을 잡고 HTTP container를 멈춘다.
그 뒤 SQLite 색인을 백업하고 일회성 `sync` mode로 `qmd update`와 collection별 `qmd embed`를 실행한다.
성공과 실패 모두에서 HTTP container를 다시 시작하고 health를 기다린다.

```bash
BRAIN_QMD_COMPOSE=/home/bifos/apps/fos-brain-deploy/brain-qmd/compose.yaml \
BRAIN_QMD_DATA=/home/bifos/.brain-qmd \
  /home/bifos/apps/fos-brain-deploy/sync-qmd.sh
```

색인과 collection 상태만 읽을 때는 `/home/bifos/apps/fos-brain-deploy/sync-qmd.sh --status`를 사용한다.

## Jenkins 연결

`jenkins/jenkins-deploy.sh`는 Jenkins SSH key에 연결된 forced-command의 관리 원본이다.
기존 파일을 백업하고 셸 검사를 통과한 뒤 아래처럼 설치한다.

```bash
install -m 700 \
  /home/bifos/apps/fos-brain-deploy/jenkins/jenkins-deploy.sh \
  /home/bifos/bin/jenkins-deploy.sh
```

`jenkins/sync-brain-job.xml`은 보호 Quartz 동기화가 성공한 뒤 `sync-brain-qmd`를 후속 실행한다.
qmd 단계 실패는 작업을 불안정, 해당 단계를 실패로 표시하되 이미 전환한 Quartz release는 되돌리지 않는다.

## rollback

`sync`가 실패하면 스크립트가 직전 SQLite 색인을 복원하고 nonzero로 끝난다.
성공한 보호 Quartz release는 되돌리지 않는다.
검색 품질만 이전 색인 상태로 남고, Hermes는 HTTP 실패 시 로컬 qmd와 INDEX, `rg` 순서로 축소한다.

실제 색인 복구는 명시적인 안전장치를 켠 아래 검사로 재검증할 수 있다.

```bash
BRAIN_QMD_RECOVERY_TEST=1 \
  /home/bifos/apps/fos-brain-deploy/tests/verify-live-qmd-recovery.sh
```

## 제거 범위

검색 서비스만 제거할 때는 `brain-qmd` container와 image, `brain-search-net` 연결만 정리한다.
`/home/bifos/.brain-qmd`는 색인과 모델 cache를 담으므로, 재생성 비용을 감수할 때만 별도로 삭제한다.
public wiki, public raw, private wiki 원본은 읽기 전용 마운트라 제거 대상이 아니다.
