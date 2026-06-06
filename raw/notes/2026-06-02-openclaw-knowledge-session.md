---
source_type: session
collected: 2026-06-02
origin: Claude Code 세션 (OpenClaw 대시보드 인증 → 채널 미러링 → tool 정책 디버깅)
verification: 공식 docs(docs.openclaw.ai), GitHub 소스(openclaw/openclaw), 로컬 doctor/CLI 실측
---

# OpenClaw 지식 정리 (2026-06-02 세션)

OpenClaw 버전 2026.5.28 기준. 로컬 게이트웨이 직접 운영 환경에서 확인한 사실 모음.
docs 요약(WebFetch)은 부정확한 경우가 있어, 결정적 사실은 `gh api` raw 소스와 doctor/CLI 실측으로 교차검증했다.

## 1. OpenClaw 정체성

- 자가호스팅(self-hosted) 게이트웨이. 여러 채팅 채널을 AI 에이전트에 연결한다.
- 단일 Gateway 프로세스가 메신저 앱과 항상 켜진 AI 어시스턴트 사이의 브리지 역할.
- local-first: Gateway·config·routing·tool 이 사용자 머신에서 돈다. 모델 추론만 외부 provider 로.
- 지원 채널:
  - Discord, Telegram, Slack
  - WhatsApp, Matrix, Signal
  - iMessage, Google Chat, Microsoft Teams, Zalo 등

## 2. 아키텍처 구성요소

- Gateway — 세션 상태를 소유. 기본 포트 18789. systemd user 서비스로 상주 가능.
- Agent — persona 단위 스코프. workspace 파일, auth 프로필, 모델, 라우팅을 가진다. 기본 에이전트 id 는 `main`.
- Channels — 인바운드 메시지를 bindings 로 적절한 에이전트에 라우팅.
- Sessions — 대화 버킷. 세션 키로 라우팅과 격리를 식별.
- Control UI / WebChat — 브라우저 기반 admin surface(chat, config, exec approvals). Gateway 가 `/` 에 서빙.
- Plugins — 채널·확장 기능. bundled 및 외부 플러그인.

## 3. 세션 키와 라우팅

- 세션 키 패턴:
  - DM/메인: `agent:<agentId>:main` (기본 mainKey `main`)
  - 그룹: `agent:<agentId>:<channel>:group:<id>`
  - 채널(서버): `agent:<agentId>:<channel>:channel:<id>`
- `session.dmScope`:
  - `per-channel-peer` — DM 도 채널·상대별로 분리(완전 격리).
  - `main` — DM 들이 `agent:<id>:main` 세션으로 합쳐짐(맥락 공유).
- 라우팅은 deterministic. 모델이 채널을 고르지 않는다. 응답은 항상 메시지가 들어온 출처 채널로만 돌아간다.
- 채널 간 메시지는 교차하지 않는다. Discord 메시지는 Discord 에, WhatsApp 은 WhatsApp 에 머문다.
- WebChat 은 선택한 에이전트의 main 세션에 붙는다.
- 서버(길드) 채널 세션은 구조적으로 격리 — 어떤 설정으로도 WebChat 의 main 세션과 합쳐지지 않는다.

## 4. 웹 UI ↔ Discord 미러링 (이번 핵심 질문)

- 빌트인 자동 미러링 없음. "WebChat 에 친 메시지가 그대로 Discord 채널에도 게시"되는 네이티브 기능은 없다.
- Control UI 에서 기존 Discord 채널 세션을 열어 대화를 이어갈 수는 있다(맥락 공유). 하지만 그 메시지는 WebChat 출처라 Discord 채널엔 게시되지 않는다.
- 소스의 `src/infra/outbound/source-reply-mirror.ts` 의 "mirror" 는 cross-channel 송출이 아니라 transcript 기록 보정용(에이전트가 현재 채널로 보낸 걸 세션 히스토리에 남김). `isCurrentSourceConversation` 가드로 target==현재채널일 때만 동작.
- Control UI 가 채널로 내보낼 수 있는 유일한 빌트인 경로는 cron 작업의 announce(스케줄 결과 전송).
- 실시간 미러링의 유일한 방법: 에이전트가 `message` 도구로 능동 송출. 자동이 아니라 요청 기반(또는 AGENTS.md 상시 룰).

## 5. Tool 정책 (profile / allow / deny) — 가장 중요한 함정

- `tools.profile` 이 base allowlist 를 정한다. profiles:
  - `minimal` — `session_status` 만.
  - `coding` — 로컬 onboarding 기본값.
    - group:fs, group:runtime, group:web
    - group:sessions, group:memory
    - cron, image, image_generate, video_generate
  - `messaging` — group:messaging, sessions_list, sessions_history, sessions_send, session_status.
  - `full` — 제한 없음(전체).
- tool 그룹 (소스 `extensions/policy/src/tool-policy-conformance.ts`):
  - group:fs = read, write, edit, apply_patch
  - group:runtime = exec, process, code_execution
  - group:web = web_search, web_fetch, x_search
  - group:memory = memory_search, memory_get
  - group:messaging = message
  - group:ui = browser, canvas
  - group:automation = heartbeat_respond, cron, gateway
  - group:media = image, image_generate, music_generate, video_generate, tts
- 핵심 함정: `tools.allow` 는 추가(additive)가 아니라 profile 과 **교집합(intersection)** 으로 제한한다.
  - `profile=coding` 과 `allow=["message"]` 를 같이 쓰면 교집합이 거의 공집합이 된다.
    - profile 이 message 를 제거한다(coding base 에 없음).
    - allow 가 코딩 도구 19개를 제거한다(allow 에 없음).
    - 결과적으로 에이전트가 read/write/exec 조차 못 쓴다.
  - 즉 `profile=coding` 인 채로는 allow 로 message 를 절대 못 살린다(message 가 coding base 에 없으므로).
- 올바른 해법(coding 도구와 message 둘 다):
  - `profile=full` 과 `allow=[원하는 coding 그룹들, message]` 를 같이 쓴다.
  - effective 는 full 과 allow 의 교집합이며, 딱 allow 목록만 남는다.
  - 실제 적용한 allow: `["group:fs","group:runtime","group:web","group:sessions","group:memory","cron","image","image_generate","video_generate","message"]`
  - 검증: doctor 의 "removed via tools.allow" 목록에서 read/write/exec 사라지고 message 살아남음.
- `deny` 가 우선(deny wins). `*` 와일드카드, 대소문자 무시.
- `allow:["write"]` 는 호환 모델에서 apply_patch 도 켜지지만, `deny:["write"]` 는 apply_patch 를 막지 않는다.
- 정밀 순서: base profile → provider profile(byProvider) → allow/deny.
- byProvider / 발신자(sender) 스코프에는 `alsoAllow`(추가) 가 있다. 전역 top-level 에는 alsoAllow 없음.
- 주의: `profile=full` 과 allow 화이트리스트 조합에서 allow 를 비우면 full(전체 권한)이 그대로 노출된다.

## 6. 설정 (config)

- 설정 파일: `~/.openclaw/openclaw.json` (JSON5).
- CLI: `openclaw config get/set/unset/validate`.
  - `set <path> <value> [--strict-json]` — JSON 값은 --strict-json.
  - `--merge` — 객체/맵 병합용(배열 값엔 안 맞음 → 적용 안 됨).
  - `--dry-run` — 스키마 검증만, 쓰기 없음(부작용 없이 명령 검증 가능). 단 value 모드는 검증 스킵, --strict-json 일 때 검증.
- `config get` 은 secret 류를 redact(`__OPENCLAW_REDACTED__`). 실제 토큰은 raw 파일에서 읽어야 함.
- secret 은 SecretRef 로 외부화 권장(`openclaw secrets configure/apply/audit`).

## 7. Gateway 운영

- 서비스: systemd user unit(`openclaw-gateway.service`). `gateway status/restart/install`.
- 바인딩: 기본 loopback(127.0.0.1:18789) — 로컬 클라이언트만 접속.
- 대시보드 인증: `gateway.auth.mode`.
  - `token` 모드면 브라우저가 토큰을 요구(정상 동작, 버그 아님).
  - 토큰 받기: `openclaw dashboard --no-open` (headless 환경에선 자동전달 안 되니 raw 파일에서 토큰 확인).
  - URL fragment 로도 인증: `http://127.0.0.1:18789/#token=<TOKEN>`.
- `openclaw doctor` — config/gateway/plugin/channel 진단. `--fix` 로 일부 자동 수정(orphan transcript 정리 등).

## 8. 주요 CLI

- `doctor` — 진단. `gateway status|restart|install` — 서비스. `dashboard` — Control UI 토큰 열기.
- `channels list|add|status` — 채널 관리.
- `directory groups list --channel discord` — 채널/그룹 ID·이름 조회. `directory peers|self`.
- `message send --channel discord --target channel:<id> -m "..."` — 채널로 전송. read/edit/delete/pin/react/poll/broadcast 등 서브커맨드.
- `agent --agent <id> --message "..."` — 에이전트 턴 1회 실행(세션 지정 필수: --agent/--session-key/--session-id/--to).
- `sessions list` — 세션 목록(키·모델·토큰·age). `cron`, `logs`, `docs`(라이브 문서 검색).

## 9. message 도구 / 전송

- CLI: `openclaw message send --channel discord --target channel:<id> -m "텍스트"`. target 형식 `channel:<id>` 또는 `user:<id>`(숫자만 쓰면 채널로 해석).
- 옵션:
  - `--reply-to <msgId>`, `--thread-id`
  - `--pin`, `--media`, `--silent`
  - `--presentation`(text/context/divider/buttons/select 블록)
- 두 가지 전송 경로(둘 다 이번에 성공 검증):
  - CLI 직접 전송 — Gateway 액션. tool 정책과 무관하게 동작.
  - 에이전트가 message 도구 호출 — tool 정책(group:messaging) 필요. WebChat 미러링과 동일 경로.

## 10. 메타 교훈

- OpenClaw / GitHub 자료는 WebFetch 요약을 신뢰하지 말 것. AI 요약이 거짓을 만든다(예: "tools.allow 는 추가다" 오해, 존재하지 않는 `--merge` 권장).
- 결정적 사실은 `gh api -H 'Accept: application/vnd.github.raw'` 로 raw 소스를 확인하고 doctor/CLI 실측으로 교차검증.

## orphan transcript mining (2026-06-02 추가)

`~/.openclaw/agents/main/sessions/` 의 orphan transcript 442개(338MB)를 정리 전 분석.
실질 단물은 web_search 1건과 무릎 예후 소량이었다.
나머지는 cron 자동화·trajectory·checkpoint 노이즈였다.

- 출처 transcript: `35285f5d-2fd6-476e-8ad0-51dceb7db951.jsonl` (2026-04-13, web_search provider 조사)
  - → [[../../wiki/concepts/openclaw-web-search]] 로 컴파일.
- 출처 transcript: `3bdc1a11-21f0-4333-af49-60b5310f2e7f.jsonl` (2026-05-29, 무릎 건강)
  - 핵심 수술 이력은 그 세션 당시 이미 private 으로 저장됨. 이번엔 예후·합병증 맥락만 private health-status 에 append.
