# Phase 01 — 재현 가능한 public Quartz 배포물

**Execution profile**: standard

---

## 목표

private 자료를 읽거나 마운트하지 않는 public Quartz 빌드와 정적 웹 컨테이너를 저장소에 정의한다.

**범위 외**: 홈서버 실행, Cloudflare 설정, DNS 변경은 다음 phase가 담당한다.

---

## 작업 항목 (4)

### 1. public 전용 빌더 작성

`deploy/home-server/build-public.sh`를 추가한다.
고정된 Node 24.15.0 컨테이너로 `quartz/`와 public `wiki/`만 마운트해 `quartz/public`을 만든다.
빌드 컨테이너는 호스트 UID·GID로 실행하며 `private/`와 `quartz-local/`은 마운트하지 않는다.

### 2. 정적 서버 구성 작성

`deploy/home-server/nginx.conf`에 Quartz의 확장자 없는 경로, 정적 자원, 404 응답을 정의한다.
`brain-web`은 `quartz/public`을 읽기 전용으로 마운트하며 호스트 포트를 열지 않는다.

### 3. 홈서버 Compose와 변수 계약 작성

`deploy/home-server/compose.yaml`에 `brain-web`과 `cloudflared`를 정의한다.
두 컨테이너는 외부 `public-net`에 참여하고 `cloudflared`는 untracked `.env`의 `TUNNEL_TOKEN`만 읽는다.
Nginx와 cloudflared 이미지는 다중 아키텍처 digest로 고정한다.
`.env.example`에는 비밀값이 아닌 변수 이름과 안전한 예시만 둔다.

### 4. 정적 검증 추가

Compose 해석, shell 구문, private 경로 미참조, public Quartz 빌드를 검사한다.
산출물에서 private sentinel과 `private/` 경로가 발견되면 실패하게 한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `deploy/home-server/build-public.sh` | 신규 |
| `deploy/home-server/nginx.conf` | 신규 |
| `deploy/home-server/compose.yaml` | 신규 |
| `deploy/home-server/.env.example` | 신규 |
| `deploy/home-server/.gitignore` | 신규 |
| `deploy/home-server/tests/verify-public-deploy.sh` | 신규 |

## 검증

```bash
# cwd: <worktree>/
bash -n deploy/home-server/build-public.sh
docker compose --env-file deploy/home-server/.env.example -f deploy/home-server/compose.yaml config --quiet
bash deploy/home-server/tests/verify-public-deploy.sh
```

세 검사가 성공하고 `quartz/public`에 private 자료가 없어야 한다.

## 의도 메모 (왜)

- 공개 빌드 입력을 파일 시스템 경계에서 제한해 설정 실수만으로 private 자료가 섞이지 않게 한다.
- 호스트 포트를 열지 않고 기존 NPM과 Docker 네트워크를 재사용한다.
