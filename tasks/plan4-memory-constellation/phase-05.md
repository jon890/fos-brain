# Phase 05: 홈서버 배포와 실제 URL 검증

**Execution profile**: deep

---

## 목표

검증이 끝난 Memory Atlas의 정확한 원격 커밋을 홈서버 보호 Brain에 배포하고 실제 URL에서 공개·비공개 경계를 확인한다.

**범위 외**: Cloudflare DNS, Access 정책, Tunnel, NPM 설정은 변경하지 않는다.

---

## 작업 항목 (4)

### 1. 배포 전 불변식과 rollback 기준 고정

로컬 작업 브랜치가 깨끗하고 `origin/plan4-memory-constellation`과 같은 SHA인지 확인한다.
운영 public·private checkout, 기존 `current` release, 컨테이너 ID·restart, Cloudflare Access 응답을 읽기 전용으로 기록한다.
원격 보호 빌드 스크립트의 SHA-256이 아래 고정 값과 다르면 배포를 중단한다.

### 2. 격리 checkout과 원자 release 배포

홈서버에서 작업 브랜치를 fetch하고 `/home/bifos/apps/fos-brain-previews/plan4-memory-constellation`에 같은 SHA의 detached worktree를 만든다.
기존 private checkout은 깨끗한 `main == origin/main`일 때만 읽기 전용 입력으로 사용한다.
고정된 보호 빌드 스크립트로 새 release를 만들고 내부 검증이 끝난 뒤 `current`를 원자적으로 전환한다.

release에는 `/raw`, `/work`, `/private`, `.git`, `.env`, PEM·key 파일, symlink가 없어야 한다.
HTML과 JavaScript에는 `/home/bifos`, `TUNNEL_TOKEN`, `CLOUDFLARE_API_TOKEN`, `PRIVATE-SENTINEL` 문자열이 없어야 한다.
`/_private/`만 비공개 문서 경로로 허용한다.

### 3. 실제 URL과 rollback 검증

인증 없는 새 브라우저에서는 홈과 `/_private/`가 Access 로그인으로 이동하거나 보호 응답을 반환해야 한다.
인증된 브라우저에서는 `brain.fosworld.co.kr`, `/_private/`, 대표 일반 문서가 200이어야 한다.
홈에서는 3D runtime이 한 번만 요청되고 일반 문서에서는 요청되지 않아야 한다.

실패하면 같은 `quartz-protected` 디렉터리 안에서 임시 상대 symlink를 만들고 `mv -Tf`로 배포 전 release를 다시 가리킨다.
rollback 뒤 기존 홈과 문서가 다시 200인지 확인한다.
운영 public checkout과 Cloudflare·NPM 설정은 변경하지 않는다.

### 4. task 완료 상태 기록

모든 검사가 성공하면 `tasks/plan4-memory-constellation/index.json`의 `status`를 `completed`, `current_phases`를 `5`로 바꾼다.
어느 검사라도 실패하면 완료 상태를 기록하지 않고 배포 전 release를 유지한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `tasks/plan4-memory-constellation/index.json` | 배포 성공 시 완료 상태 수정 |

## 운영 배포 의존성

| 항목 | 고정 값 |
| --- | --- |
| SSH | `bifos@61.80.30.85:10022`, `/Users/nhn/.ssh/id_ed25519_bifos` |
| 보호 빌드 스크립트 | `/home/bifos/apps/fos-brain-deploy/build-protected.sh` |
| 스크립트 SHA-256 | `4900ba8bbe87eb46a0396c80e14aab4e96b67ae36e8f7ad61e3a03f4b8ecb645` |
| private checkout | `/home/bifos/personal/fos-brain/private` |
| release 루트 | `/home/bifos/personal/fos-brain/quartz-protected/releases` |
| current 링크 | `/home/bifos/personal/fos-brain/quartz-protected/current` |

운영 public checkout `/home/bifos/personal/fos-brain`의 branch, SHA, 작업 트리는 변경 전후에 같아야 한다.

## 검증

```bash
# cwd: <worktree>/
test -z "$(git status --porcelain)"
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/plan4-memory-constellation)"
ssh -i /Users/nhn/.ssh/id_ed25519_bifos -p 10022 bifos@61.80.30.85 \
  'sha256sum /home/bifos/apps/fos-brain-deploy/build-protected.sh'
```

원격에서는 대상 SHA로 detached worktree를 만든 뒤 다음 환경으로 고정 스크립트를 한 번 호출한다.

```bash
# cwd: /home/bifos/apps/fos-brain-deploy (home server)
BRAIN_REPO=/home/bifos/apps/fos-brain-previews/plan4-memory-constellation \
PRIVATE_BRAIN_REPO=/home/bifos/personal/fos-brain/private \
PROTECTED_OUTPUT_ROOT=/home/bifos/personal/fos-brain/quartz-protected \
PROTECTED_RELEASE_ID=<public-12자-SHA>-<private-12자-SHA>-<UTC> \
  /home/bifos/apps/fos-brain-deploy/build-protected.sh
```

새 release ID의 public SHA와 작업 브랜치 SHA 앞 12자가 같아야 한다.
배포 보고에는 배포 전후 release ID, 실행한 커밋, rollback 대상, 실제 URL 응답과 runtime 요청 검증을 남긴다.

## 의도 메모 (왜)

- 브라우저 검증 변경을 먼저 커밋·push해 배포 대상 SHA를 닫는다.
- 작업 브랜치용 detached checkout을 사용해 운영 public checkout을 바꾸지 않는다.
