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
wrapper는 컨테이너의 `/opt/data/qmd/sync.lock`을 잠그고, `setpriv --reuid=1000 --regid=1000 --clear-groups`로 권한을 낮춘 뒤 `/opt/data/qmd/runtime/`의 고정 Node와 qmd 진입점을 직접 실행한다.
`XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, `QMD_FORCE_CPU=1`, `QMD_EMBED_PARALLELISM=1`과 `umask 077`을 적용하며 인자를 변형하지 않고 전달한다.
`deploy/home-server/hermes-compose.override.yaml`은 host의 `/home/bifos/.hermes/qmd/bin-pinned`를 컨테이너의 `/root/.local/bin-pinned`로 읽기 전용 마운트한다.
기존 `/home/bifos/.hermes:/opt/data`와 `/home/bifos/personal/fos-brain:/home/bifos/personal/fos-brain` mount는 그대로 사용한다.

경로 계약은 다음과 같다.

| host | container | 용도 |
| --- | --- | --- |
| `/home/bifos/.hermes/qmd` | `/opt/data/qmd` | runtime, config, cache, lock |
| `/home/bifos/.hermes/qmd/bin-pinned` | `/root/.local/bin-pinned` | `brain-search` wrapper, 읽기 전용 |
| `/home/bifos/personal/fos-brain` | `/home/bifos/personal/fos-brain` | 세 qmd 컬렉션의 입력 |

### 3. 컬렉션 동기화와 Jenkins 단계

`deploy/home-server/sync-qmd.sh`를 만들어 `brain-wiki`, `brain-raw`, `brain-private`가 정해진 public wiki, public raw, private wiki 경로만 가리키게 한다.
이 스크립트는 host에서 실행하는 orchestration 경계이며, qmd는 항상 `docker exec hermes /root/.local/bin-pinned/qmd ...`로 호출한다.
컬렉션이 없으면 등록하고 경로가 다르면 실패하며, `qmd update`와 `qmd embed`를 실행한다.
host 스크립트가 `/home/bifos/.hermes/qmd/sync.lock`을 갱신 전체 구간에서 독점하고 wrapper에는 `QMD_LOCK_HELD=1`을 전달해 같은 inode를 중복 획득하지 않게 한다.
일반 `brain-search` 호출은 이 변수를 전달하지 않으므로 wrapper 잠금을 기다린다.
Jenkins 작업에 보호 배포 성공 뒤 `sync-brain-qmd`를 호출하는 단계를 추가하고, 이 단계만 실패하면 build는 불안정 상태로 남기되 활성 Quartz release는 유지한다.

### 4. 회귀 검사와 운영 문서

`deploy/home-server/tests/verify-hermes-qmd.sh`에서 임시 runtime과 가짜 qmd를 사용해 버전 고정, checksum 실패, 원자적 설치, wrapper 인자 보존, UID/GID 저하, 컬렉션 허용 목록, 잠금과 실패 코드를 검사한다.
기존 보호 배포 검사에는 compose override의 읽기 전용 마운트와 Jenkins 후속 단계 계약을 추가한다.
forced-command 검증은 `SSH_ORIGINAL_COMMAND`의 정확한 `sync-brain-qmd`만 허용하고 빈 값, 인자 추가 값, 다른 명령을 거부하며 `eval`과 stdin 명령 해석이 없는지 확인한다.
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
잠금 회귀 검사는 host orchestration이 lock을 잡은 상태에서 `QMD_LOCK_HELD=1` wrapper 호출이 완료되고, 같은 시간의 일반 wrapper 호출은 기다리는지 확인해야 한다.

## 의도 메모 (왜)

- Hermes 이미지의 기본 Node.js와 qmd package 상태가 바뀌어도 검색 동작을 재현할 수 있도록 runtime을 데이터 경계에 고정한다.
- 사람용 Quartz 배포와 에이전트용 qmd 색인은 복구 단위가 달라 실패 상태를 분리한다.
- 설치와 운영 변경을 같은 plan에 둬 저장소 자동화가 실제 홈서버 상태와 어긋나지 않게 한다.
