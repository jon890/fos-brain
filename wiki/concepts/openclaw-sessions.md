---
type: concept
created: 2026-06-02
updated: 2026-06-02
---

# OpenClaw 세션과 라우팅

세션은 대화 버킷이고, 응답은 들어온 출처 채널로만 결정적으로 돌아간다.

## 세션 키 패턴

- DM/메인: `agent:<agentId>:main` (기본 mainKey `main`)
- 그룹: `agent:<agentId>:<channel>:group:<id>`
- 채널(서버): `agent:<agentId>:<channel>:channel:<id>`
- 세션 키는 "어느 대화 버킷인가"를 정한다(라우팅과 격리).

## dmScope

- `session.dmScope` 가 DM 의 세션 합류 여부를 정한다.
  - `per-channel-peer` — DM 도 채널·상대별로 분리(완전 격리).
  - `main` — DM 들이 `agent:<id>:main` 으로 합쳐져 맥락을 공유.
- WebChat 은 선택한 에이전트의 main 세션에 붙는다.
  - 따라서 `dmScope=main` 이면 DM 과 WebChat 이 같은 main 세션을 공유할 수 있다.
  - 단 이건 DM 한정. 서버(길드) 채널 세션은 별도 키라 합쳐지지 않는다.

## Deterministic routing

- 모델이 채널을 고르지 않는다. 라우팅은 host 설정이 결정한다.
- 응답은 항상 메시지가 들어온 출처 채널로 돌아간다.
- 채널 간 메시지는 교차하지 않는다(Discord 는 Discord 에 머문다).
- 서버 채널 세션은 구조적으로 격리되어 WebChat main 세션과 절대 합쳐지지 않는다.

## 관련 개념

- [[openclaw-channels-routing]] — 채널 격리와 미러링 한계
- [[openclaw-architecture]] — Gateway 가 세션 상태 소유
- [[openclaw]] — 상위 주제

## Sources

- [[../../raw/notes/2026-06-02-openclaw-knowledge-session.md]]
- docs.openclaw.ai/channels/channel-routing, docs.openclaw.ai/reference/session-management-compaction
