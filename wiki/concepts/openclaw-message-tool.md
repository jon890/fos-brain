---
type: concept
created: 2026-06-02
updated: 2026-06-02
---

# OpenClaw message 도구

채널에 메시지를 보내는 경로. CLI 직접 전송과 에이전트 도구 호출 두 가지가 있다.

## CLI 전송

- 기본형: `openclaw message send --channel discord --target channel:<id> -m "텍스트"`.
- target 형식:
  - `channel:<id>` — 채널.
  - `user:<id>` — 사용자.
  - 숫자만 쓰면 채널로 해석.
- 주요 옵션:
  - `--reply-to <msgId>` — 답글.
  - `--thread-id <id>` — 스레드.
  - `--pin` — 고정 요청.
  - `--media <file>` — 첨부.
  - `--silent` — 무알림 전송.
  - `--presentation <json>` — 리치 블록(text, context, divider, buttons, select).

## 두 전송 경로

- **CLI 직접 전송** — Gateway 액션이라 tool 정책과 무관하게 동작.
- **에이전트가 message 도구 호출** — tool 정책(group:messaging)이 필요.
  - WebChat 미러링과 동일한 경로.
  - profile=coding 기본에선 막혀 있어 [[openclaw-tool-policy]] 조정이 필요하다.
- 2026-06-02 세션에서 두 경로 모두 Discord 채널 전송 성공 검증.

## 미러링 용도

- 웹 UI 대화를 Discord 채널에 띄우려면 에이전트가 이 도구로 능동 송출해야 한다.
- 자세한 한계와 상시 룰 설계는 [[openclaw-channels-routing]].

## 관련 개념

- [[openclaw-tool-policy]] — 도구 활성화
- [[openclaw-channels-routing]] — 미러링 한계
- [[openclaw-cli-reference]] — 명령 모음
- [[openclaw]] — 상위 주제

## Sources

- [[../../raw/notes/2026-06-02-openclaw-knowledge-session.md]]
- docs.openclaw.ai/cli/message, openclaw message send --help (2026.5.28)
