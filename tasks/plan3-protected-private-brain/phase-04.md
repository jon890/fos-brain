# Phase 04: 홈서버 전환과 보안 검증

**Execution profile**: deep

---

## 목표

검증된 보호 release를 `brain.fosworld.co.kr` 원점에 연결하고 Access 안에서 public·private 전체 그래프를 제공한다.

**범위 외**: 다른 공개·보호 호스트, Cloudflare DNS·DNSSEC, NPM 인증서, public 저장소 가시성은 변경하지 않는다.

---

## 작업 항목 (5)

### 1. 운영 상태와 rollback 백업

Cloudflare Access·Tunnel, NPM brain proxy, Compose, 실행 컨테이너, 기존 public 산출물의 상태를 비밀값 없이 대조한다.
서버 Compose와 활성 산출물 포인터를 시각이 포함된 mode 700 디렉터리에 백업한다.

### 2. 첫 보호 release 생성

두 checkout이 clean이고 원격 `main`과 같은 commit인지 확인한 뒤 운영 경로의 `sync-protected.sh`를 실행한다.
`BRAIN_SYNC_LOCK`은 checkout을 스스로 dirty하게 만들지 않도록 `BRAIN_DEPLOY_ROOT` 아래에 둔다.
새 release에 public 기존 문서와 private 문서가 있고 raw·work·회사 경로가 없음을 확인한다.

### 3. brain-web 전환

`brain-web`만 고정 이미지와 수정한 mount로 재생성한다.
다른 컨테이너 ID와 restart 횟수, NPM HTTPS 원점, Tunnel ingress, Access Allow와 ACME Bypass는 바꾸지 않는다.

### 4. 실제 접근과 실패 rollback 검증

무인증 요청은 Access 302이고 기존 PIN 세션은 public 기존 경로와 `/_private/` 문서를 200으로 읽어야 한다.
원점에는 호스트 포트가 없고 private raw와 금지 경로는 404여야 한다.
고의로 실패하는 fixture 실행 뒤 활성 `current`와 서비스 응답이 그대로인지 확인한다.

### 5. 웹훅 갱신과 작업 완료 기록

두 GitHub webhook delivery가 HMAC을 통과하고 중복 실행 시 하나의 최종 release로 수렴하는지 확인한다.
보호 빌드가 Quartz 웹 검색 색인을 갱신하며 qmd 상태나 collection을 바꾸지 않았음을 확인한다.
모든 검증 성공 뒤 `tasks/plan3-protected-private-brain/index.json`의 `status`를 `completed`, `current_phases`를 `4`로 기록한다.

## Critical Files

| 파일 또는 객체 | 변경 |
| --- | --- |
| `/home/bifos/personal/fos-brain` | 최신 public checkout과 보호 release 배치 |
| `/home/bifos/apps/fos-brain-deploy` | 검증한 운영 배포 설정 사용 |
| `/home/bifos/personal/fos-brain/quartz-protected/current` | 검증된 release로 원자적 전환 |
| `home-server-brain-web-1` | 보호 산출물 mount로 재생성 |
| `tasks/plan3-protected-private-brain/index.json` | 완료 상태 수정 |

## 검증

```bash
# cwd: <worktree>/
bash deploy/home-server/tests/verify-public-deploy.sh
bash deploy/home-server/tests/verify-protected-deploy.sh
git diff --check
```

운영 검증에서는 public 기존 URL과 private URL이 PIN 세션에서 200이고, 무인증 보호 경계와 raw·work 차단이 유지돼야 한다.
실패 주입 전후의 활성 release와 기존 공개 서비스 응답이 같아야 한다.

## 의도 메모 (왜)

- Access 인증 성공만으로 배포 성공을 판단하지 않고 실제 private route와 누출 금지 경계를 함께 검사한다.
- 마지막 phase에서만 완료 상태를 기록해 운영 전환이나 검증이 실패한 plan을 완료로 오인하지 않게 한다.

## Blocked 조건

- private 내용이나 비밀값을 로그에 출력하지 않고 검증할 방법이 없으면 `PHASE_BLOCKED`로 종료한다.
- Access 정책, Tunnel ingress, NPM 인증서 중 하나가 기존 검증 상태와 다르면 brain-web을 재생성하지 않고 `PHASE_BLOCKED`로 종료한다.
