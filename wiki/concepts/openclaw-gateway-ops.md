---
type: concept
created: 2026-06-02
updated: 2026-06-02
---

# OpenClaw Gateway 운영

Gateway 는 systemd user 서비스로 상주하며, 기본 loopback 포트와 토큰 인증 대시보드를 가진다.

## 서비스

- systemd user unit: `openclaw-gateway.service`.
- 명령: `openclaw gateway status` / `restart` / `install`.
- 바인딩: 기본 loopback(127.0.0.1:18789) — 로컬 클라이언트만 접속 가능.
- status 가 보여주는 것: Runtime(running/pid), Connectivity probe, Capability.

## 대시보드 인증

- `gateway.auth.mode` 가 인증 방식을 정한다.
- `token` 모드면 브라우저가 토큰을 요구한다(정상 동작, 버그 아님).
- 토큰 얻기:
  - `openclaw dashboard --no-open` — 토큰 포함 URL 출력.
  - headless 환경에선 자동 전달이 안 되니 raw 파일(`gateway.auth.token`)에서 직접 확인.
- URL fragment 로도 인증: `http://127.0.0.1:18789/#token=<TOKEN>`.

## doctor

- `openclaw doctor` — config/gateway/plugin/channel 종합 진단.
- `openclaw doctor --fix` — 일부 자동 수정(orphan transcript 정리 등).
- tool 정책 변경 검증에 유용: "tool policy removed ... via tools.allow/profile" 줄을 읽는다.

## 관련 개념

- [[openclaw-config]] — 설정 변경·secret
- [[openclaw-architecture]] — Gateway 의 역할
- [[openclaw-cli-reference]] — 명령 모음
- [[openclaw]] — 상위 주제

## Sources

- [[../../raw/notes/2026-06-02-openclaw-knowledge-session.md]]
- docs.openclaw.ai/gateway, docs.openclaw.ai/web/dashboard
