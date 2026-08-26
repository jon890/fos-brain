# Phase 03 — Cloudflare Access와 Jenkins 웹훅 보호

**Execution profile**: deep

---

## 목표

공개 서비스는 그대로 열어 두고 관리 서비스와 public brain을 보호할 로그인 수단과 정책을 준비한다.
Jenkins 웹훅은 Access를 우회하되 GitHub HMAC-SHA256 검증을 필수로 한다.
Pending 영역에서는 self-hosted Access 애플리케이션 생성이 거부되므로 애플리케이션과 Bypass는 Phase 04에서 영역이 Active가 된 직후 만든다.
이 phase에서는 로그인 수단·허용 정책과 Jenkins HMAC를 사전 검증한다.

**범위 외**: 네임서버 전환과 원본 포트 차단은 Phase 04가 담당한다.

---

## 작업 항목 (4)

### 1. Access 로그인 수단과 허용 정책 구성

Cloudflare Zero Trust에서 이메일 일회용 PIN 로그인을 활성화한다.
사용자가 비밀 채널로 제공한 허용 계정만 포함하는 정책을 만든다.
실제 이메일 주소는 저장소, task, 로그에 기록하지 않는다.
로그인 수단과 정책의 허용 계정 조건은 API의 저장 상태로 확인한다.
Cloudflare가 Pending 영역의 self-hosted 애플리케이션 생성을 오류 12130으로 거부하면 재시도하지 않고 Phase 04로 이관한다.

### 2. 공개 호스트 경계 확인

apex, blog, accountbook, accountbook-api에는 Access 애플리케이션이 없어야 한다.
`brain`, Grafana, Jenkins, NPM의 애플리케이션도 영역이 Active가 되기 전에는 없어야 한다.
`career`와 `nreview`에는 Access 애플리케이션과 공개 호스트 이름이 없어야 한다.

### 3. GitHub 웹훅 secret을 먼저 배치

Jenkins Generic Webhook Trigger를 사용하는 작업과 대응 GitHub webhook을 열거한다.
암호학적으로 안전한 secret 하나를 비밀 채널에서 생성하고 GitHub의 모든 해당 webhook에 먼저 저장한다.
Secret을 화면 캡처, 셸 출력, URL, 저장소에 남기지 않는다.
GitHub webhook 관리 권한이 없거나 대상 매핑이 불명확하면 Jenkins HMAC를 켜지 않고 `PHASE_BLOCKED`로 끝낸다.

### 4. Jenkins HMAC 구성

같은 secret을 Jenkins Secret Text credential에 저장한다.
Generic Webhook Trigger 전역 허용 목록에 host 없는 HMAC 항목을 추가하고 `X-Hub-Signature-256`, HMAC-SHA256을 선택한다.
기존 원본 경로에서 정상 서명은 통과하고 누락·오류 서명은 거부되는지 확인한다.
검사는 `gwt-dry-run`으로 수행하고 기존 작업의 build 번호가 바뀌지 않는지 확인한다.
더 구체적인 Jenkins Bypass 애플리케이션 생성과 Cloudflare 경유 전달 검사는 Phase 04가 담당한다.

## Critical Files

| 대상 | 변경 |
| --- | --- |
| Cloudflare Access login method | 이메일 일회용 PIN |
| Cloudflare Access reusable policy | 허용 계정 Allow |
| GitHub webhook settings | HMAC secret 설정 |
| Jenkins credentials | Secret Text credential 추가 |
| Jenkins Generic Webhook Trigger | HMAC-SHA256 검증 추가 |

## 검증

```text
Access 로그인 수단·Allow 조건 → Cloudflare 저장 상태와 일치
Pending 영역의 Access 애플리케이션 수 → 0
기존 원본의 정상 GitHub HMAC dry-run → HTTP 200이며 대상 작업만 식별
기존 원본의 누락·오류 HMAC dry-run → HTTP 403
Jenkins 작업 build 번호 → 검사 전후 불변
```

브라우저 기록과 Jenkins 로그에는 secret 또는 허용 이메일 원문을 남기지 않는다.

## 중단 조건과 되돌리기

- GitHub 쪽 secret 배치와 정상 전달이 확인되기 전에는 Jenkins HMAC를 필수화하지 않는다.
- Pending 영역에서 오류 12130이 발생하면 Access 애플리케이션을 만들지 않고 Phase 04의 격리 절차로 이관한다.
