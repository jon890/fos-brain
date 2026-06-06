---
type: concept
created: 2026-06-02
updated: 2026-06-02
---

# OpenClaw 채널 라우팅과 미러링

채널은 서로 격리되며, 채널 간 자동 미러링은 빌트인으로 없다.

## 채널 격리 원칙

- 라우팅은 deterministic(출처 채널로만 응답).
- 채널 간 메시지는 교차하지 않는다.
- 그룹/서버 채널은 채널별 세션 키로 격리.
- 접근 제어 필드:
  - `requireMention` — 멘션해야 응답할지.
  - `allowFrom` / `groupPolicy` — 허용 발신자·그룹 정책.
- Discord 길드에서 멘션 없이 응답하게 하려면 `channels.discord.guilds.<guildId>.requireMention=false`.
  - 이 값이 true 면 봇이 길드 메시지를 `reason: no-mention` 으로 스킵한다.
  - config hot reload 로 런타임에 반영될 수 있다(restart 불필요한 경우 있음).

## 웹 UI ↔ Discord 미러링의 한계

- "WebChat 에 친 메시지가 그대로 Discord 채널에도 게시"되는 네이티브 기능은 없다.
- Control UI 에서 기존 Discord 채널 세션을 열어 대화를 이어갈 수는 있다(맥락 공유).
  - 하지만 그 메시지의 출처는 WebChat 이라 Discord 채널엔 게시되지 않는다.
- 소스의 `source-reply-mirror.ts` 의 "mirror" 는 cross-channel 송출이 아니다.
  - transcript 기록 보정용(에이전트가 현재 채널로 보낸 걸 세션 히스토리에 남김).
  - `isCurrentSourceConversation` 가드로 target==현재채널일 때만 동작.
- Control UI 가 채널로 내보내는 유일한 빌트인 경로는 cron 작업의 announce(스케줄 결과 전송).

## 실시간 미러링을 원할 때

- 유일한 방법은 에이전트가 [[openclaw-message-tool]] 로 능동 송출하는 것.
- 자동이 아니라 요청 기반. 상시화하려면 워크스페이스 AGENTS.md 룰로 묶는다.
- 자기-범위 한정 트릭: "세션은 Discord 채널인데 입력이 WebChat 으로 들어온 경우에만 미러"로 룰을 짜면 진짜 Discord 인입은 미러하지 않아 중복을 막는다.

## 관련 개념

- [[openclaw-sessions]] — 세션 키·dmScope
- [[openclaw-message-tool]] — 능동 송출 경로
- [[openclaw]] — 상위 주제

## Sources

- [[../../raw/notes/2026-06-02-openclaw-knowledge-session.md]]
- docs.openclaw.ai/channels/channel-routing, docs.openclaw.ai/web/webchat
- github.com/openclaw/openclaw — src/infra/outbound/source-reply-mirror.ts
