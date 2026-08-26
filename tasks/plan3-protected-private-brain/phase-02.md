# Phase 02: 보호 Quartz 원자적 release

**Execution profile**: deep

---

## 목표

public 전용 빌드를 그대로 보존하면서 public과 private wiki만 합친 보호 Quartz release를 검증 후 원자적으로 활성화한다.

**범위 외**: GitHub 웹훅 생성, Jenkins 작업 설치, 홈서버의 운영 산출물 전환은 다음 phase가 담당한다.

---

## 작업 항목 (5)

### 1. 보호 입력과 빌드 작성

`deploy/home-server/build-protected.sh`는 public wiki를 기존 루트에 두고 private wiki를 `/_private/` 아래에 배치한 임시 입력을 만든다.
두 네임스페이스의 raw와 `work/`는 마운트하거나 복사하지 않는다.
고정 Node 24.15.0 컨테이너와 기존 Quartz lockfile을 사용한다.

### 2. release 검증과 원자적 전환

새 산출물은 `quartz-protected/releases/<release-id>/`의 임시 디렉터리에 만든다.
public 기존 경로, private INDEX와 문서 수, 금지 경로, 소문자 `index.html`을 검사한 뒤 같은 파일 시스템의 `current` 상대 링크를 원자적으로 교체한다.
검사 실패 시 기존 `current`와 release를 유지한다.

### 3. 동기화 실행기 작성

`deploy/home-server/sync-protected.sh`는 `flock`으로 실행을 직렬화한다.
public과 private 저장소가 clean이고 각각 원격 `main`으로 fast-forward 가능한 경우에만 pull과 보호 빌드를 실행한다.
허용하지 않은 branch, 분기, 누락 저장소에서는 현재 release를 바꾸지 않고 실패한다.
스크립트는 checkout 밖의 `BRAIN_DEPLOY_ROOT`에 설치돼도 `BRAIN_REPO`와 `PRIVATE_BRAIN_REPO`만으로 동작해야 한다.

### 4. 정적 서버 mount와 보호 헤더 변경

Compose는 `quartz-protected/` 상위 디렉터리를 읽기 전용으로 마운트하고 Nginx root를 `current`로 둔다.
Nginx는 private를 포함한 HTML과 검색 색인에 `noindex`와 비공개 cache 정책을 적용한다.
호스트 포트가 없는 기존 `public-net` 경계를 유지한다.

### 5. 회귀 검증 추가

fixture public·private wiki로 성공 전환, 금지 입력 차단, 실패 시 `current` 불변, 동시 실행 잠금을 검사한다.
pinned Node의 실제 Quartz smoke로 output 디렉터리 초기화와 release 상위 mount 계약을 검사한다.
기존 public-only 검증도 실행해 private URL과 파일이 `quartz/public`에 생기지 않음을 보존한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `.gitignore` | 수정 |
| `deploy/home-server/build-protected.sh` | 신규 |
| `deploy/home-server/sync-protected.sh` | 신규 |
| `deploy/home-server/nginx.conf` | 수정 |
| `deploy/home-server/compose.yaml` | 수정 |
| `deploy/home-server/.env.example` | 수정 |
| `deploy/home-server/tests/verify-protected-deploy.sh` | 신규 |

## 검증

```bash
# cwd: <worktree>/
bash -n deploy/home-server/build-protected.sh deploy/home-server/sync-protected.sh deploy/home-server/tests/verify-protected-deploy.sh
shellcheck deploy/home-server/build-protected.sh deploy/home-server/sync-protected.sh deploy/home-server/tests/verify-protected-deploy.sh
docker compose --env-file deploy/home-server/.env.example -f deploy/home-server/compose.yaml config --quiet
bash deploy/home-server/tests/verify-public-deploy.sh
bash deploy/home-server/tests/verify-protected-deploy.sh
```

보호 검증이 성공하고 기존 public-only 산출물에는 private 경로와 내용이 없어야 한다.

## 의도 메모 (왜)

- public 전용 산출물과 보호 산출물을 물리적으로 나눠 한쪽 설정 실수가 다른 쪽의 비밀 경계를 무너뜨리지 않게 한다.
- 컨테이너 재시작보다 같은 파일 시스템의 상대 심볼릭 링크 전환을 사용해 실패와 전환 시간을 줄인다.
