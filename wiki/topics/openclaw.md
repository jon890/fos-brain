---
type: topic
created: 2026-06-02
updated: 2026-06-02
---

# OpenClaw

자가호스팅 게이트웨이로 여러 채팅 채널을 AI 에이전트에 연결하는 시스템. 그 운영·설정 지식 묶음.

OpenClaw 관련 작업을 받으면 이 페이지에서 해당 개념으로 들어간다.
"무엇인가 → 어떻게 쓰나 → 설정·운영" 순으로 배치했다.

## 기초 개념

- [[openclaw-overview]] — 정체성, 멘탈 모델, local-first
- [[openclaw-architecture]] — Gateway / Agent / Channel / Session / Control UI / Plugin 관계
- [[openclaw-sessions]] — 세션 키 패턴, dmScope, deterministic routing
- [[openclaw-channels-routing]] — 채널 격리 원칙, 웹 UI ↔ Discord 미러링의 한계

## 운영·설정

- [[openclaw-tool-policy]] — profile / allow / deny, 교집합 함정
- [[openclaw-config]] — openclaw.json, config CLI, secret redaction
- [[openclaw-gateway-ops]] — 서비스, 포트, 대시보드 인증, doctor
- [[openclaw-cli-reference]] — 주요 명령 요약
- [[openclaw-message-tool]] — 채널 송출, CLI vs 에이전트 도구 호출
- [[openclaw-web-search]] — web_search provider, autodetect 우선순위, key-free 옵션

## 관련 개체

- [[ai-nodes]] — 영속 워크플로 로직은 ai-nodes, `~/.openclaw` 는 thin glue

## Sources

- [[../../raw/notes/2026-06-02-openclaw-knowledge-session.md]]
- docs.openclaw.ai (공식 문서)
