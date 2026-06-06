---
type: concept
created: 2026-06-02
updated: 2026-06-02
---

# OpenClaw 개요

자가호스팅 게이트웨이로 여러 채팅 채널을 AI 에이전트에 연결하는 시스템.

## 핵심 포인트

- 단일 Gateway 프로세스가 메신저 앱과 항상 켜진 AI 어시스턴트 사이의 브리지다.
- local-first 설계.
  - Gateway·config·routing·tool 은 사용자 머신에서 돈다.
  - 모델 추론만 외부 provider 로 나간다.
- 하나의 에이전트를 여러 채널에서 동시에 쓸 수 있다.
- 지원 채널이 넓다.
  - 메신저: Discord, Telegram, Slack.
  - 모바일 메신저: WhatsApp, Signal, iMessage.
  - 협업: Google Chat, Microsoft Teams, Matrix, Zalo 등.
- 버전 표기 예: 2026.5.28.

## 멘탈 모델

- "채팅으로 접근하는 개인 어시스턴트"가 핵심. 채널은 입출력 surface 일 뿐이고 두뇌(에이전트)는 하나다.
- 신뢰 모델은 단일 운영자(single-user personal-assistant) 가정. 적대적 멀티테넌트가 아니다.

## 관련 개념

- [[openclaw-architecture]] — 내부 구성요소
- [[openclaw-channels-routing]] — 채널이 에이전트로 어떻게 연결되나
- [[openclaw]] — 상위 주제

## Sources

- [[../../raw/notes/2026-06-02-openclaw-knowledge-session.md]]
- docs.openclaw.ai/start, docs.openclaw.ai/gateway
