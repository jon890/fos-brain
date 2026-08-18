# Phase 02 — 홈서버 Tunnel 사전 배치

**Execution profile**: deep

---

## 목표

현재 공개 경로를 바꾸지 않은 채 public brain과 Cloudflare Tunnel을 홈서버에 배치하고 내부 경로를 검증한다.

**범위 외**: 권한 네임서버 변경과 공인 80·443 차단은 Phase 04가 담당한다.

---

## 작업 항목 (4)

### 1. 홈서버 상태와 복구 자료 고정

SSH `bifos@61.80.30.85:10022`에서 실행 중인 컨테이너, NPM 프록시 호스트, 포트 바인딩, DNS 레코드를 다시 조회한다.
NPM 설정과 배포 전 Compose 파일을 날짜가 붙은 `/home/bifos/apps/backups/` 하위 디렉터리에 복사한다.
Cloudflare에 `fosworld.co.kr` 영역을 추가하고 자동 가져온 레코드를 hosting.kr 스냅샷과 대조하되 권한 네임서버는 유지한다.
폐기된 `career` 레코드·프록시·컨테이너·예약 실행이 남아 있으면 백업 뒤 제거하며 DB·소스·사용자 데이터는 보존한다.
`career`를 다시 만들지 않는다.

### 2. 저장소와 public Quartz 배치

홈서버의 `/home/bifos/personal/fos-brain` checkout을 계획 브랜치의 검증된 커밋으로 맞춘다.
Phase 01 빌더로 public Quartz를 만들고 `brain-web`만 먼저 기동한다.
NPM에 `brain.fosworld.co.kr`에서 `brain-web:80`으로 가는 프록시 호스트를 추가한다.

### 3. Cloudflare Tunnel 컨테이너 배치

Cloudflare에서 발급한 Tunnel token은 홈서버의 untracked `deploy/home-server/.env`에 권한 600으로 기록한다.
token을 명령 출력, 셸 기록, git diff에 노출하지 않는다.
`cloudflared`를 `public-net`에 기동하되 DNS는 아직 바꾸지 않는다.

### 4. 내부 원본 경로 검증

Tunnel의 각 공개 호스트 이름이 `https://fos-npm:443`으로 향하고 원래 도메인을 `httpHostHeader`로 전달하는지 확인한다.
같은 Docker 네트워크의 NPM 연결에만 `noTLSVerify`를 적용한다.
apex, blog, accountbook, accountbook-api, brain, Grafana, Jenkins, NPM, nreview의 내부 응답을 전환 전 기준과 비교한다.
Cloudflare dashboard나 API에서 Tunnel connector가 정상 상태인지 확인한다.

## Critical Files

| 대상 | 변경 |
| --- | --- |
| `/home/bifos/personal/fos-brain` | 계획 브랜치 배치 |
| `/home/bifos/personal/fos-brain/deploy/home-server/.env` | 신규, untracked, 권한 600 |
| NPM proxy host | `brain.fosworld.co.kr` 추가 |
| Cloudflare Tunnel | 공개 호스트 이름과 원본 규칙 추가 |

## 검증

```bash
# cwd: /home/bifos/personal/fos-brain
docker compose --env-file deploy/home-server/.env -f deploy/home-server/compose.yaml config --quiet
docker compose --env-file deploy/home-server/.env -f deploy/home-server/compose.yaml ps
docker inspect brain-web cloudflared
```

`brain-web`과 `cloudflared`가 정상 상태이고 NPM 내부 요청과 Tunnel connector 상태가 기대값을 내야 한다.
기존 DNS 응답과 공인 80·443 바인딩은 이 phase에서 바뀌면 안 된다.

## 중단 조건과 되돌리기

- Tunnel token 또는 Cloudflare 영역을 만들 권한이 없으면 `PHASE_BLOCKED`로 끝내고 DNS는 건드리지 않는다.
- 내부 원본 응답이 기존 기준과 다르면 Tunnel과 `brain` 프록시만 중지하고 백업한 NPM 설정으로 되돌린다.
