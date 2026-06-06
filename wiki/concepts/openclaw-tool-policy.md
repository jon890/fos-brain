---
type: concept
created: 2026-06-02
updated: 2026-06-02
---

# OpenClaw Tool 정책

에이전트가 쓸 수 있는 도구를 profile 과 allow/deny 로 정한다. allow 는 추가가 아니라 교집합 제한이다.

## Profile (base allowlist)

`tools.profile` 이 기본 허용 집합을 정한다.

- `minimal` — `session_status` 만.
- `coding` — 코딩 작업용 기본값(로컬 onboarding 기본).
  - 그룹: group:fs, group:runtime, group:web, group:sessions, group:memory.
  - 개별: cron, image, image_generate, video_generate.
- `messaging` — 메시징용.
  - group:messaging 및 세션 도구(sessions_list, sessions_history, sessions_send, session_status).
- `full` — 제한 없음(전체 도구).

## Tool 그룹

소스 `extensions/policy/src/tool-policy-conformance.ts` 의 매핑.

- group:fs
  - read, write, edit, apply_patch
- group:runtime
  - exec, process, code_execution
- group:web
  - web_search, web_fetch, x_search
- group:memory
  - memory_search, memory_get
- group:messaging
  - message
- group:ui
  - browser, canvas
- group:automation
  - heartbeat_respond, cron, gateway
- group:media
  - image, image_generate, music_generate, video_generate, tts

## 핵심 함정 — allow 는 교집합

- `tools.allow` 는 profile 에 도구를 더하는 게 아니라 profile 과 **교집합**으로 제한한다.
- 실패 사례: `profile=coding` 에 `allow=["message"]` 를 준 경우.
  - profile 이 message 제거(coding base 에 message 없음).
  - allow 가 코딩 도구를 제거(allow 목록에 없음).
  - 교집합이 거의 공집합 → 에이전트가 read/write/exec 조차 못 씀.
- 따라서 `profile=coding` 인 채로는 allow 로 message 를 절대 못 살린다.

## 올바른 해법 (coding 도구 + message)

- `profile=full` 로 두고, allow 로 원하는 coding 그룹들과 message 를 지정.
- effective = full ∩ allow = 딱 그 목록.
- 적용 예 (allow):
  - 그룹: group:fs, group:runtime, group:web, group:sessions, group:memory.
  - 개별: cron, image, image_generate, video_generate, message.
- 검증: doctor 의 "removed via tools.allow" 목록에서 read/write/exec 가 사라지고 message 가 살아남는지 본다.
- 주의: 이 조합에서 allow 를 비우면 profile=full 이 전체 권한을 그대로 노출한다.

## 그 밖의 규칙

- `deny` 가 우선이다(deny wins). `*` 와일드카드 지원, 대소문자 무시.
- `allow:["write"]` 는 호환 모델에서 apply_patch 도 켜지지만, `deny:["write"]` 는 apply_patch 를 막지 않는다.
- 정밀 순서: base profile → provider profile(byProvider) → allow/deny.
- byProvider·발신자(sender) 스코프엔 `alsoAllow`(추가)가 있다. 전역 top-level 에는 없다.

## 관련 개념

- [[openclaw-message-tool]] — message 도구 활성화의 동기
- [[openclaw-config]] — 설정 변경 방법
- [[openclaw]] — 상위 주제

## Sources

- [[../../raw/notes/2026-06-02-openclaw-knowledge-session.md]]
- docs.openclaw.ai/gateway/config-tools
- github.com/openclaw/openclaw — extensions/policy/src/tool-policy-conformance.ts
