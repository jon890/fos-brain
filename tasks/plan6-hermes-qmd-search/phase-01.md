# Phase 01 Hermes qmd 설치·동기화 자동화

**Execution profile**: standard

---

## 목표

Hermes가 재시작돼도 유지되는 고정 qmd 실행 환경과 세 컬렉션의 증분 갱신 절차를 저장소 스크립트로 구현한다.

**범위 외**: 홈서버 파일 설치, Hermes 컨테이너 재생성, Jenkins 운영 작업 교체는 Phase 02에서 수행한다.

---

## 작업 항목 (4)

### 1. 고정 runtime 설치 스크립트

`deploy/home-server/install-hermes-qmd.sh`를 만든다.
기본값으로 Node.js 24.15.0과 `@tobilu/qmd` 2.8.3을 `/home/bifos/.hermes/qmd` 아래에 설치한다.
Node 배포 파일은 공식 SHA-256 목록으로 검증하고, qmd는 정확한 버전으로 설치한 뒤 `qmd --version`을 확인한다.
완료 전 임시 경로를 사용해 중단된 설치가 기존 runtime을 덮지 않게 한다.

### 2. 권한 저하 wrapper와 컨테이너 마운트

설치 스크립트가 `bin-pinned/qmd` wrapper를 생성하게 한다.
wrapper는 `flock`으로 `sync.lock`을 사용하고, `setpriv --reuid=1000 --regid=1000 --clear-groups`로 권한을 낮춘 뒤 고정 Node와 qmd 진입점을 직접 실행한다.
`XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, `QMD_FORCE_CPU=1`, `QMD_EMBED_PARALLELISM=1`과 `umask 077`을 적용하며 인자를 변형하지 않고 전달한다.
`deploy/home-server/hermes-compose.override.yaml`은 wrapper를 `/root/.local/bin-pinned/qmd`로 읽기 전용 마운트한다.

### 3. 컬렉션 동기화와 Jenkins 단계

`deploy/home-server/sync-qmd.sh`를 만들어 `brain-wiki`, `brain-raw`, `brain-private`가 정해진 public wiki, public raw, private wiki 경로만 가리키게 한다.
컬렉션이 없으면 등록하고 경로가 다르면 실패하며, `qmd update`와 `qmd embed`를 실행한다.
Jenkins 작업에 보호 배포 성공 뒤 `sync-brain-qmd`를 호출하는 단계를 추가하고, 이 단계만 실패하면 build는 불안정 상태로 남기되 활성 Quartz release는 유지한다.

### 4. 회귀 검사와 운영 문서

`deploy/home-server/tests/verify-hermes-qmd.sh`에서 임시 runtime과 가짜 qmd를 사용해 버전 고정, checksum 실패, 원자적 설치, wrapper 인자 보존, UID/GID 저하, 컬렉션 허용 목록, 잠금과 실패 코드를 검사한다.
기존 보호 배포 검사에는 compose override의 읽기 전용 마운트와 Jenkins 후속 단계 계약을 추가한다.
설치, 상태 확인, 재색인, 제거 범위, INDEX와 `rg` 폴백을 `deploy/home-server/README.md`에 기록한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `deploy/home-server/install-hermes-qmd.sh` | 신규 |
| `deploy/home-server/sync-qmd.sh` | 신규 |
| `deploy/home-server/hermes-compose.override.yaml` | 신규 |
| `deploy/home-server/jenkins/sync-brain-job.xml` | 수정 |
| `deploy/home-server/tests/verify-hermes-qmd.sh` | 신규 |
| `deploy/home-server/tests/verify-protected-deploy.sh` | 수정 |
| `deploy/home-server/README.md` | 신규 |

## 검증

```bash
# cwd: <worktree>/
bash -n deploy/home-server/install-hermes-qmd.sh deploy/home-server/sync-qmd.sh deploy/home-server/tests/verify-hermes-qmd.sh
deploy/home-server/tests/verify-hermes-qmd.sh
deploy/home-server/tests/verify-protected-deploy.sh
git diff --check
```

Jenkins XML에는 `sync-brain` 성공 뒤 `sync-brain-qmd`를 호출하는 단계와 `catchError(buildResult: 'UNSTABLE', stageResult: 'FAILURE')`가 있어야 한다.
wrapper와 동기화 스크립트는 검색어, 문서 본문, private 검색 결과를 표준 출력에 쓰지 않아야 한다.

## 의도 메모 (왜)

- Hermes 이미지의 기본 Node.js와 qmd package 상태가 바뀌어도 검색 동작을 재현할 수 있도록 runtime을 데이터 경계에 고정한다.
- 사람용 Quartz 배포와 에이전트용 qmd 색인은 복구 단위가 달라 실패 상태를 분리한다.
- 설치와 운영 변경을 같은 plan에 둬 저장소 자동화가 실제 홈서버 상태와 어긋나지 않게 한다.
