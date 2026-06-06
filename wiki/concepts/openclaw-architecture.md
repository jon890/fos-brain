---
type: concept
created: 2026-06-02
updated: 2026-06-02
---

# OpenClaw 아키텍처

Gateway 를 중심으로 에이전트·채널·세션·UI·플러그인이 붙는 구조.

## 구성요소

- **Gateway** — 시스템의 중심.
  - 세션 상태를 소유한다(session store, transcripts).
  - 기본 포트 18789.
  - 모든 UI 가 세션 목록·토큰 수를 이 Gateway 에 질의한다.
- **Agent** — persona 단위 스코프.
  - workspace 파일, auth 프로필, 모델, 라우팅을 가진다.
  - 기본 에이전트 id 는 `main`.
  - 여러 채널 계정을 한 Gateway 에서 운영하며 bindings 로 인바운드를 적절한 에이전트에 연결.
- **Channel** — 메시지 입출력 surface.
  - 인바운드 메시지를 bindings 규칙으로 에이전트에 라우팅.
- **Session** — 대화 버킷. 세션 키로 식별(라우팅과 격리).
- **Control UI / WebChat** — 브라우저 admin surface(chat, config, exec approvals). Gateway 가 `/` 에 서빙.
- **Plugin** — 채널·확장 기능. bundled 와 외부 모두.

## 핵심 관계

- Gateway 가 단일 진실 출처(세션 상태). UI 들은 모두 Gateway 를 본다.
- 에이전트는 두뇌, 채널은 입출력, 세션은 대화 격리 단위.

## 관련 개념

- [[openclaw-overview]] — 정체성
- [[openclaw-sessions]] — 세션 키·격리
- [[openclaw-gateway-ops]] — Gateway 운영
- [[openclaw-tool-policy]] — 에이전트가 쓸 수 있는 도구 범위
- [[openclaw]] — 상위 주제

## Sources

- [[../../raw/notes/2026-06-02-openclaw-knowledge-session.md]]
- docs.openclaw.ai/concepts/multi-agent, docs.openclaw.ai/web/control-ui
