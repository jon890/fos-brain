# Phase 03: 두 저장소 동기화와 Jenkins 웹훅

**Execution profile**: deep

---

## 목표

public·private 저장소의 `main` push가 같은 Jenkins 작업을 호출하고 홈서버의 두 checkout을 손실 없이 갱신하게 한다.

**범위 외**: Cloudflare Access 정책 변경, DNS 변경, qmd 임베딩 갱신은 수행하지 않는다.

---

## 작업 항목 (5)

### 1. public·private checkout 보존과 정리

홈서버 public checkout의 detached HEAD와 수정 파일을 시각이 포함된 mode 700 백업과 local backup branch로 보존한다.
수정 파일이 이미 원격 plan commit에 포함된 내용인지 hash로 확인한 뒤 public checkout을 clean `main`과 `origin/main`의 같은 commit으로 만든다.
private checkout과 `origin/main`도 내용 출력 없이 비교한다.
서버 전용 commit이 있으면 날짜가 포함된 원격 backup branch를 먼저 만들고 최신 `origin/main` 위에 보존해 private 저장소로 push한다.
데이터를 삭제하거나 강제 push하지 않고 홈서버 checkout을 clean fast-forward 상태로 만든다.

### 2. 검증한 배포 도구 선설치

Phase02의 빌드·동기화 스크립트, Nginx 설정, Compose와 Jenkins 작업 정의를 `/home/bifos/apps/fos-brain-deploy`에 exact hash로 설치한다.
운영 경로와 기존 Compose 설정을 먼저 백업하고 mode 700 디렉터리와 mode 600 환경 파일을 유지한다.
Jenkins 작업이나 webhook을 활성화하기 전에 운영 경로에서 구문 검사와 fixture 보호 빌드를 통과시킨다.

### 3. Jenkins 작업 정의

`deploy/home-server/jenkins/sync-brain-job.xml`에 `sync-brain` Pipeline 작업을 정의한다.
Generic Webhook Trigger가 `repository.full_name`과 `ref`를 읽고 허용한 두 저장소의 `refs/heads/main`만 선택하게 한다.
기존 전역 HMAC 검증과 Access의 Jenkins 웹훅 Bypass를 재사용하고 작업 token만으로 인증을 대신하지 않는다.

### 4. Jenkins 설치와 실행 경계 검증

Jenkins 설정, 작업 목록, build 번호를 시각이 포함된 mode 700 디렉터리에 먼저 백업한다.
공식 Jenkins API로 작업을 생성하고 reload 뒤 설정을 다시 읽어 허용 저장소, branch, 실행 스크립트를 대조한다.
누락·잘못된 HMAC 요청은 기존처럼 403이며 다른 Jenkins 작업 설정과 build 번호는 바뀌지 않아야 한다.

### 5. GitHub 웹훅 두 개 연결

public·private GitHub 저장소에 같은 Jenkins Generic Webhook Trigger URL과 기존 HMAC secret을 사용한 push 웹훅을 만든다.
저장소 가시성, 다른 webhook, branch 보호 설정을 바꾸지 않는다.
테스트 delivery는 HMAC 검증을 통과하고 `sync-brain` 한 작업만 선택해야 한다.

## Critical Files

| 파일 또는 객체 | 변경 |
| --- | --- |
| `deploy/home-server/jenkins/sync-brain-job.xml` | 신규 |
| `/home/bifos/apps/fos-brain-deploy` | 검증한 배포 도구 선설치 |
| `/home/bifos/personal/fos-brain` | clean public `main` checkout으로 정리 |
| `/home/bifos/personal/fos-brain/private` | fast-forward 가능한 private checkout으로 정리 |
| Jenkins `sync-brain` | 신규 |
| GitHub `jon890/fos-brain` push webhook | 신규 |
| GitHub `jon890/fos-brain-private` push webhook | 신규 |

## 검증

```bash
# cwd: <worktree>/
xmllint --noout deploy/home-server/jenkins/sync-brain-job.xml
git diff --check
```

운영 검증에서는 두 저장소의 hook이 active이고 secret이 설정됐으며, 올바른 서명은 `sync-brain`만 선택하고 누락·잘못된 서명은 403이어야 한다.
두 checkout은 clean `main`이고 원격과 같은 commit이어야 한다.
Jenkins 작업과 webhook을 활성화하기 전에 운영 경로의 스크립트 hash와 검증 결과가 저장소 검증본과 같아야 한다.

## 의도 메모 (왜)

- public과 private push를 하나의 직렬화된 작업으로 모아 서로 다른 시점의 지식을 섞은 산출물을 줄인다.
- private의 서버 전용 commit은 backup branch와 정상 history에 모두 보존해 동기화 자동화 전에 데이터 손실 가능성을 닫는다.
- 실행 파일을 checkout 밖에 먼저 설치해 저장소 전환 중에도 Jenkins가 사라진 경로를 호출하지 않게 한다.

## Blocked 조건

- private GitHub 저장소의 visibility가 PRIVATE가 아니면 외부 변경 없이 `PHASE_BLOCKED`로 종료한다.
- HMAC secret을 비노출 방식으로 재사용할 수 없으면 새 값을 추측하거나 출력하지 않고 `PHASE_BLOCKED`로 종료한다.
