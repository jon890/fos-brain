# Phase 02 홈서버 배포와 webhook 색인 검증

**Execution profile**: deep

---

## 목표

검증한 `brain-qmd` image와 내부 network를 홈서버에 배포하고 Hermes 검색, 초기 색인, Jenkins 후속 갱신과 복구를 실측한다.

**범위 외**: Cloudflare Access, DNS, Tunnel, Nginx Proxy Manager, host 공개 포트, qmd 모델 종류와 rerank 기본값은 변경하지 않는다.

---

## 작업 항목 (4)

### 1. 운영 상태 확인과 복구본 확보

SSH `bifos@61.80.30.85:10022`에서 Hermes compose, Jenkins forced-command, Jenkins 작업 XML, 활성 Quartz release를 timestamp backup에 복사한다.
Hermes의 `/home/bifos/.hermes:/opt/data`, brain 동일 절대경로 mount, 4GiB·2 CPU 제한과 OOM 상태를 기록한다.
SSH 읽기, backup, 현재 파일 hash 확인 중 하나라도 실패하면 운영 파일을 바꾸지 않고 `PHASE_BLOCKED`로 끝낸다.

### 2. brain-qmd와 Hermes 내부 연결 배포

검증된 배포 디렉터리를 `/home/bifos/apps/fos-brain-deploy`에 설치하고 `/home/bifos/.brain-qmd`를 UID와 GID 1000, mode 700으로 만든다.
`brain-qmd` image를 build하고 host port가 없음을 compose와 `docker inspect`로 확인한 뒤 service를 시작한다.
Hermes app에는 검증한 파일을 `/home/bifos/apps/hermes-agent/docker-compose.override.yml`로 설치하고 기존 compose 본문은 고치지 않는다.
Hermes를 재생성한 뒤 두 container가 `brain-search-net`에만 함께 연결되고 Hermes의 `BRAIN_QMD_URL`이 내부 주소인지 확인한다.

### 3. 초기 색인과 Jenkins 연결

`sync-qmd.sh`로 초기 `update`, `embed`를 완료하고 `brain-qmd`가 healthy로 복귀하는지 확인한다.
Jenkins forced-command에 exact `sync-brain-qmd` case만 추가하고 `eval`, stdin 명령 해석, 추가 인자를 허용하지 않는다.
저장소 Jenkins XML을 설치한 뒤 Jenkins를 재시작하고 기존 webhook credential과 trigger가 유지되는지 확인한다.
실제 SSH 경로에서 `sync-brain-qmd`는 성공하고 `sync-brain-qmd extra`, 빈 명령, 임의 명령은 거부돼야 한다.

### 4. 검색·복구·자원 검증과 완료 기록

Hermes에서 `brain-search-http.cjs`로 public 대표 질문과 private 대표 질문을 각각 검색해 기대 slug, collection, 네임스페이스를 확인한다.
HTTP service를 중지한 조건에서 `brain-search`가 로컬 qmd 또는 INDEX·`rg`로 축소 동작하는지 확인한 뒤 service를 복구한다.
가짜 실패가 아니라 backup SQLite hash를 기록한 상태에서 검증용 잘못된 sync mode를 사용해 복원 경로를 확인하고 정상 sync를 다시 실행한다.
초기 embed와 두 검색 mode의 실행 시간, `brain-qmd` peak memory, host available memory, OOM kill 수를 기록한다.
검증이 성공하면 `tasks/plan6-hermes-qmd-search/index.json`의 `status`를 `completed`, `current_phases`를 `2`로 바꾼다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `/home/bifos/apps/fos-brain-deploy/brain-qmd/` | image와 compose 설치 |
| `/home/bifos/apps/hermes-agent/docker-compose.override.yml` | 내부 network와 URL 추가 |
| `/home/bifos/.brain-qmd/` | 설정, 색인, 모델 cache 생성 |
| `/home/bifos/bin/jenkins-deploy.sh` | `sync-brain-qmd` exact case 추가 |
| Jenkins `sync-brain` 작업 | 후속 qmd 단계 적용 |
| `tasks/plan6-hermes-qmd-search/index.json` | 완료 상태 수정 |
| `docs/retrospectives/RUNS.md` | 실행 결과 추가 |

## 검증

```bash
# cwd: <worktree>/
ssh -p 10022 bifos@61.80.30.85 'docker inspect brain-qmd --format "{{json .NetworkSettings.Ports}} {{.State.Health.Status}} {{.State.OOMKilled}}"'
ssh -p 10022 bifos@61.80.30.85 'docker network inspect brain-search-net --format "{{range .Containers}}{{println .Name}}{{end}}"'
ssh -p 10022 bifos@61.80.30.85 'docker exec hermes node -e "fetch(process.env.BRAIN_QMD_URL.replace(/\/$/, \"\") + \"/health\").then(r => { if (!r.ok) process.exit(1) })"'
ssh -p 10022 bifos@61.80.30.85 '/home/bifos/apps/fos-brain-deploy/sync-qmd.sh --status'
ssh -p 10022 bifos@61.80.30.85 sync-brain-qmd
if ssh -p 10022 bifos@61.80.30.85 'sync-brain-qmd extra'; then exit 1; fi
node --test .agents/plugin/fos-brain/tests/brain-search-http.test.cjs
deploy/home-server/tests/verify-brain-qmd.sh
deploy/home-server/tests/verify-protected-deploy.sh
git diff --check
```

`docker inspect brain-qmd`의 host port map은 비어 있고 health는 `healthy`, OOM kill은 `false`여야 한다.
세 collection은 container의 허용 경로만 가리키고 public과 private 대표 검색이 기대 slug를 반환해야 한다.
Cloudflare 보호 URL과 활성 Quartz release는 qmd 실패·복구 전후에 정상 응답을 유지해야 한다.

## Blocked 조건

- SSH 읽기, 운영 파일 backup, 기존 mount 확인 실패 → `PHASE_BLOCKED: 홈서버 사전 확인 또는 복구본 확보 실패`를 출력하고 변경 없이 종료한다.
- qmd image가 4GiB 제한 안에서 초기 embed나 query를 완료하지 못하고 OOM이 반복되면 resource limit을 추측해 올리지 않고 측정값과 함께 중단한다.

## 의도 메모 (왜)

- 저장소 검증만으로 container network와 모델 메모리 경계를 증명할 수 없어 실제 홈서버 검색과 복구를 같은 phase에서 닫는다.
- qmd HTTP는 인증이 없으므로 host·Cloudflare 노출 부재를 기능 성공과 같은 수준으로 검증한다.
- 배포 전 backup과 실패 후 service 재기동을 필수로 해 검색 개선이 기존 Hermes와 Quartz 운영을 중단시키지 않게 한다.
