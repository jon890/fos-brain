# Phase 03 — Cloudflare Access와 Jenkins 웹훅 보호

**Execution profile**: deep

---

## 목표

공개 서비스는 그대로 열어 두고 관리 서비스와 public brain만 허용 계정으로 보호한다.
Jenkins 웹훅은 Access를 우회하되 GitHub HMAC-SHA256 검증을 필수로 한다.

**범위 외**: 네임서버 전환과 원본 포트 차단은 Phase 04가 담당한다.

---

## 작업 항목 (4)

### 1. Access 로그인 수단과 보호 애플리케이션 구성

Cloudflare Zero Trust에서 이메일 일회용 PIN 로그인을 활성화한다.
사용자가 비밀 채널로 제공한 허용 계정만 포함하는 정책을 만든다.
실제 이메일 주소는 저장소, task, 로그에 기록하지 않는다.
`brain`, Grafana, Jenkins 전체, NPM에 self-hosted 애플리케이션을 만들고 Allow 정책을 연결한다.

### 2. 공개 호스트 경계 확인

apex, blog, accountbook, accountbook-api에는 Access 애플리케이션을 만들지 않는다.
계정 전체의 Access 보호 강제가 켜져 있으면 이 공개 호스트를 명시적으로 제외한다.
`nreview`는 Access 없이 기존 404가 유지되게 하고 `career`는 만들지 않는다.

### 3. GitHub 웹훅 secret을 먼저 배치

Jenkins Generic Webhook Trigger를 사용하는 작업과 대응 GitHub webhook을 열거한다.
암호학적으로 안전한 secret 하나를 비밀 채널에서 생성하고 GitHub의 모든 해당 webhook에 먼저 저장한다.
Secret을 화면 캡처, 셸 출력, URL, 저장소에 남기지 않는다.
GitHub webhook 관리 권한이 없거나 대상 매핑이 불명확하면 Jenkins HMAC를 켜지 않고 `PHASE_BLOCKED`로 끝낸다.

### 4. Jenkins HMAC와 경로 Bypass 구성

같은 secret을 Jenkins Secret Text credential에 저장한다.
Generic Webhook Trigger 전역 허용 목록에 host 없는 HMAC 항목을 추가하고 `X-Hub-Signature-256`, HMAC-SHA256을 선택한다.
그 뒤 `jenkins.fosworld.co.kr/generic-webhook-trigger/*`에 전체 Jenkins 앱보다 구체적인 Bypass 애플리케이션을 만든다.
정상 서명은 통과하고 누락·오류 서명은 거부되는지 실제 전달로 확인한다.

## Critical Files

| 대상 | 변경 |
| --- | --- |
| Cloudflare Access login method | 이메일 일회용 PIN 활성화 |
| Cloudflare Access applications | 보호 호스트 Allow, Jenkins 웹훅 Bypass |
| GitHub webhook settings | HMAC secret 설정 |
| Jenkins credentials | Secret Text credential 추가 |
| Jenkins Generic Webhook Trigger | HMAC-SHA256 검증 추가 |

## 검증

```text
인증하지 않은 brain·grafana·jenkins·npm 요청 → Access 로그인
허용 계정의 일회용 PIN 로그인 → 보호 서비스 접근
인증하지 않은 공개 호스트 요청 → 기존 응답 유지
정상 GitHub HMAC 웹훅 → Jenkins 수신
누락·오류 HMAC 웹훅 → Jenkins 거부
```

브라우저 기록과 Jenkins 로그에는 secret 또는 허용 이메일 원문을 남기지 않는다.

## 중단 조건과 되돌리기

- GitHub 쪽 secret 배치와 정상 전달이 확인되기 전에는 Jenkins HMAC를 필수화하지 않는다.
- 보호 애플리케이션이 공개 호스트에 영향을 주면 해당 Access 정책을 비활성화하고 원인을 고친 뒤 재검증한다.
