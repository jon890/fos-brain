# Phase 03 홈서버 전환 배포와 career-api 폐기

**Execution profile**: deep

---

## 목표

전용 `brain-api`, `brain-ask`와 질문 UI를 보호 홈서버에 원자적으로 배포하고 실제 URL 검증 뒤 폐기한 `career-api`를 제거한다.

**범위 외**: Cloudflare DNS, Access 정책, Tunnel, Nginx Proxy Manager, qmd 모델과 public 서비스의 설정은 바꾸지 않는다.

---

## 작업 항목 (5)

### 1. 운영 상태와 복구 기준 확보

SSH `bifos@61.80.30.85:10022`에서 현재 Hermes image와 profile 목록, gateway 수신 포트, Compose·override, `brain-qmd` health, Memory Atlas 활성 release와 Jenkins 배포 구성을 읽는다.
Hermes 설정과 Compose를 checkout 밖 timestamp 경로에 복사하고 파일 hash를 기록한다.
비밀값은 화면과 로그에 출력하지 않는다.
SSH 인증, 읽기, backup이나 현재 정적 사이트 health가 실패하면 운영 파일을 바꾸지 않는다.

### 2. `brain-api`와 내부 질문 경로 선배포

mode 600 key 파일을 만든 뒤 `configure-brain-api.sh install`과 `check`를 실행한다.
프로필은 `/home/bifos/.hermes/profiles/brain-api`, model 이름은 `brain`, API 내부 포트는 8644로 고정한다.
`/v1/models`가 `brain`을 제공하고 `/v1/toolsets`에 enabled toolset이 없으며 `/v1/skills`에 외부 skill이 없고 비저장 `/v1/responses`가 도구 호출 없이 끝나는지 확인한다.

검증한 `brain-ask` image와 Compose·Nginx 설정을 운영 배포 경로에 설치한다.
`brain-ask`와 `brain-web`만 재생성하고 health를 기다린다.
세 내부 network, host port 부재, public·private wiki 읽기 전용 mount와 key 파일 권한을 `docker inspect`로 확인한다.

### 3. 정적 release와 실제 질문 검증

Phase 02를 포함한 commit으로 기존 보호 배포 스크립트를 실행해 새 release를 원자 전환한다.
전환 전에 로컬 Memory Atlas suite와 배포 회귀가 통과해야 한다.
실제 `https://brain.fosworld.co.kr`에서 Cloudflare Access 경계, 질문 버튼, public 근거 질문, private 근거 질문, 빈 근거, 출처 이동과 패널 닫기 뒤 강조 해제를 자동 브라우저 검사로 확인한다.

API는 내부 `brain-web` 경로에서도 200, 400, 429와 upstream 장애 변환을 검사한다.
질문 수행 전후 qmd와 Hermes의 OOM kill, container restart, CPU·memory peak를 기록한다.
실패하면 직전 정적 release와 기존 Nginx·Compose 파일로 되돌리고 `brain-api`와 `brain-ask`를 중지한다.

### 4. `career-api` 폐기와 잔재 검사

새 경로의 API·브라우저·자원 검사가 모두 통과한 뒤에만 `configure-brain-api.sh remove-career --confirmed-new-path`를 실행한다.
`hermes profile list`에서 `career-api`가 사라지고 `/home/bifos/.hermes/profiles/career-api`와 command alias가 없으며 8643 listener와 host port mapping이 없는지 확인한다.
`/home/bifos/apps/hermes-agent`의 Compose와 README에서 `career-api`, `career`, 8643 참조를 제거하되 이미 폐기한 다른 career 소스 삭제로 범위를 넓히지 않는다.

`brain-api`와 `brain-ask`를 다시 시작해 container 재기동 뒤에도 model, 무도구 상태와 질문 API가 유지되는지 재검사한다.

### 5. 완료 기록과 원격 상태 정리

실측한 release 식별자, API 상태, public·private 대표 출처 slug, container health, peak memory, OOM 수, 제거한 profile과 listener를 `docs/retrospectives/RUNS.md`의 실행 한 줄과 PR 검증 기록에 남긴다.
질문·답변·발췌문과 비밀값은 기록하지 않는다.
검증이 성공하면 `tasks/plan7-brain-grounded-qa/index.json`의 `status`를 `completed`, `current_phases`를 `3`으로 바꾼다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `/home/bifos/.hermes/profiles/brain-api/` | 전용 프로필 생성 |
| `/home/bifos/.hermes/profiles/career-api/` | 검증 뒤 삭제 |
| `/home/bifos/apps/hermes-agent/docker-compose.yml` | 8643 제거와 brain API 실행 기준 반영 |
| `/home/bifos/apps/hermes-agent/README.md` | 폐기 profile 참조 제거 |
| `/home/bifos/apps/fos-brain-deploy/` | 검증한 BFF·Nginx·Hermes 관리 원본 설치 |
| `/home/bifos/.secrets/fos-brain/hermes-api-key` | mode 600 key 생성·회전 |
| `quartz-protected/current` | 새 보호 release로 원자 전환 |
| `tasks/plan7-brain-grounded-qa/index.json` | 완료 상태 수정 |
| `docs/retrospectives/RUNS.md` | 실행 결과 추가 |

## 검증

```bash
# cwd: <worktree>/
node --test deploy/home-server/brain-ask/brainAsk.test.mjs
deploy/home-server/tests/verify-brain-ask.sh
deploy/home-server/tests/verify-brain-qmd.sh
deploy/home-server/tests/verify-protected-deploy.sh
```

```bash
# cwd: <worktree>/quartz
scripts/verify-memory-atlas.sh
```

```bash
# cwd: <worktree>/
ssh -p 10022 bifos@61.80.30.85 '/home/bifos/apps/fos-brain-deploy/hermes/configure-brain-api.sh check'
ssh -p 10022 bifos@61.80.30.85 'docker inspect brain-ask --format "{{json .NetworkSettings.Ports}} {{.State.Health.Status}} {{.State.OOMKilled}}"'
ssh -p 10022 bifos@61.80.30.85 'docker inspect brain-qmd --format "{{.State.Health.Status}} {{.State.OOMKilled}}"'
ssh -p 10022 bifos@61.80.30.85 'if hermes profile list | grep -F career-api; then exit 1; fi; if ss -ltn | grep -E "[:.]8643[[:space:]]"; then exit 1; fi'
git diff --check
```

`brain-ask`의 host port map은 비어 있고 health는 `healthy`, OOM kill은 `false`여야 한다.
`brain-api`의 활성 toolset은 0개여야 하며 질문 API 응답은 근거 문서와 같은 네임스페이스를 표시해야 한다.
실제 보호 URL은 public과 private 질문, 빈 근거, 출처 이동과 강조 해제 검사를 통과해야 한다.

## Blocked 조건

- SSH 인증, 운영 backup, 현재 보호 사이트 health 중 하나가 실패하면 `PHASE_BLOCKED: 홈서버 사전 확인 또는 복구 기준 확보 실패`를 출력하고 변경 없이 종료한다.
- `brain-api`에서 활성 도구를 제거할 수 없거나 비저장 응답을 증명할 수 없으면 `PHASE_BLOCKED: 전용 Hermes 최소 권한 검증 실패`를 출력하고 `career-api`를 삭제하지 않는다.
- 실제 URL 질문이나 rollback 검사가 실패하면 `PHASE_BLOCKED: 보호 질문 경로 검증 실패`를 출력하고 `career-api`를 유지한다.

## 의도 메모 (왜)

- `career-api` 삭제는 되돌리기 어려우므로 새 전용 경로와 rollback을 먼저 증명한다.
- 정적 release, BFF, qmd와 Hermes를 한 번에 교체하지 않고 단계별 health를 확인해 장애 범위를 좁힌다.
- 질문 내용은 개인 정보일 수 있으므로 기능 증거는 상태와 출처 slug만 남긴다.
