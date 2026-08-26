---
type: concept
created: 2026-05-28
updated: 2026-08-25
title: "멀티 워크스페이스 모노레포"
description: "개인 자동화의 공통 규칙은 공유하되 실행 데이터와 책임은 관심사별로 격리하는 구조"
tags: [personal-system, monorepo, isolation, automation]
status: stable
---

# 멀티 워크스페이스 모노레포

여러 개인 자동화를 한 저장소에 두되 규칙, 실행 데이터와 책임은 워크스페이스별로 격리하는 구조다.

## 핵심 포인트

- 최상위 디렉터리 하나가 하나의 관심사와 운영 책임을 맡는다.
- 작업은 루트 규칙을 읽은 뒤 해당 워크스페이스의 AGENTS.md에서 시작한다.
- 워크스페이스 한정 helper, 설정과 데이터는 다른 워크스페이스에서 직접 참조하지 않는다.
- 여러 영역이 같은 기능을 요구할 때만 공용 자산 승격을 검토하고 결정 이유를 남긴다.
- 건강, 금융, 커리어와 예약 데이터는 해당 워크스페이스의 private 경계 밖으로 복제하지 않는다.
- 문서 중심 영역은 자동화 디렉터리를 억지로 갖추지 않고 필요한 책임만 가진다.

## 관련 개념

- [[script-skill-separation]] — 실행 코드와 판단 문맥을 분리하는 워크스페이스 내부 구조
- [[ai-harness-pattern]] — 외부 상태 변경과 검증 경계를 설계하는 방식
- [[fos-agents]] — 이 구조를 사용하는 개인 자동화 시스템

## Sources

- [[../../raw/notes/2026-08-25-personal-knowledge-refresh.md]]
- https://github.com/jon890/fos-agents
