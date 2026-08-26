# Phase 02 홈서버 적용과 웹훅 검색 검증

**Execution profile**: standard

---

## 목표

Phase 01의 검증된 스크립트를 홈서버와 Hermes, Jenkins에 적용하고 공개·비공개 지식 검색과 push 후 증분 갱신을 실측한다.

**범위 외**: Cloudflare Access, DNS, Tunnel, Nginx Proxy Manager, qmd 임베딩 모델은 변경하지 않는다.

---

## 작업 항목 (4)

### 1. 설치 전 상태와 복구본 확보

SSH `bifos@61.80.30.85:10022`에서 Hermes compose, Jenkins 강제 명령 스크립트, Jenkins 작업 XML을 timestamp 경로에 복사한다.
현재 Hermes 이미지, mount, 메모리·CPU 제한, 활성 Quartz release, qmd 부재 상태를 기록한다.
복구는 저장한 compose와 Jenkins 파일을 되돌린 뒤 Hermes만 재생성하는 범위로 제한한다.

### 2. qmd 설치와 Hermes 연결

검증된 배포 파일을 `/home/bifos/apps/fos-brain-deploy`에 설치한다.
`install-hermes-qmd.sh`로 영구 데이터 경계에 runtime을 설치하고 기존 Hermes compose에 override의 읽기 전용 wrapper mount를 적용한다.
Hermes를 재생성한 뒤 `/root/.local/bin-pinned/qmd --version`이 2.8.3이고 프로세스가 UID와 GID 1000으로 실행되는지 확인한다.

### 3. 초기 색인과 Jenkins 연동

`sync-qmd.sh`로 세 컬렉션을 등록하고 초기 `update`, `embed`를 완료한다.
홈서버의 Jenkins 강제 명령 허용 목록에 정확한 `sync-brain-qmd` 명령을 추가하고 저장소의 Jenkins 작업 XML을 설치한다.
Cloudflare webhook secret과 Access 정책은 바꾸지 않는다.

### 4. 검색·증분 갱신·자원 검증과 완료 기록

Hermes 컨테이너에서 public 대표 질문과 private 대표 질문을 `brain-search`가 사용하는 qmd 명령으로 검색해 기대 slug와 네임스페이스가 나오는지 확인한다.
테스트용 public 문서를 만들지 않고 현재 `main`의 파일 mtime과 qmd status를 기준으로 동기화 명령 재실행 전후를 비교해 증분 경로를 검증한다.
Jenkins의 고정 명령을 직접 호출해 보호 release가 유지되는 동안 qmd 단계가 성공하는지 확인한다.
초기 임베딩과 검색 중 컨테이너 peak memory, OOM kill 수, 실행 시간을 기록한다.
검증이 성공하면 `tasks/plan6-hermes-qmd-search/index.json`의 `status`를 `completed`, `current_phases`를 `2`로 바꾼다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `/home/bifos/apps/fos-brain-deploy/` | 검증된 배포 파일 설치 |
| `/home/bifos/apps/hermes-agent/docker-compose.yml` | wrapper mount 추가 |
| `/home/bifos/.hermes/qmd/` | runtime, 설정, 색인 생성 |
| `/home/bifos/bin/jenkins-deploy.sh` | `sync-brain-qmd` 허용 명령 추가 |
| Jenkins `sync-brain` 작업 | 후속 qmd 단계 적용 |
| `tasks/plan6-hermes-qmd-search/index.json` | 완료 상태 수정 |

## 검증

```bash
# cwd: <worktree>/
ssh -p 10022 bifos@61.80.30.85 '/home/bifos/apps/fos-brain-deploy/install-hermes-qmd.sh --verify'
ssh -p 10022 bifos@61.80.30.85 'docker exec hermes /root/.local/bin-pinned/qmd --version'
ssh -p 10022 bifos@61.80.30.85 '/home/bifos/apps/fos-brain-deploy/sync-qmd.sh --status'
ssh -p 10022 bifos@61.80.30.85 'printf %s sync-brain-qmd | /home/bifos/bin/jenkins-deploy.sh'
deploy/home-server/tests/verify-hermes-qmd.sh
deploy/home-server/tests/verify-protected-deploy.sh
git diff --check
```

세 컬렉션이 각 허용 경로만 가리키고 public과 private 대표 검색이 기대 slug를 반환해야 한다.
`docker inspect hermes`의 OOM kill 수가 늘지 않고 container가 healthy 상태를 유지해야 한다.
Cloudflare 보호 URL과 활성 Quartz release 식별자는 적용 전후에 같거나 정상적인 새 release여야 한다.

## 의도 메모 (왜)

- 설치 성공만으로 검색 가능 상태를 증명할 수 없어 실제 컬렉션, 대표 검색, 자원 사용까지 같은 phase에서 닫는다.
- webhook 외부 설정은 이미 동작하고 있으므로 Jenkins 내부의 후속 명령만 바꿔 변경 범위를 줄인다.
- 운영 파일을 먼저 백업해 qmd 도입 실패가 Hermes와 기존 Quartz 게시로 번지지 않게 한다.
