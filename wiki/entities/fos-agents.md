---
type: entity
created: 2026-05-28
updated: 2026-08-25
title: "fos-agents"
description: "개인 업무와 생활의 반복 작업을 독립 워크스페이스로 관리하는 자동화 모노레포"
tags: [personal-system, automation, agents, monorepo]
status: stable
---

# fos-agents

개인 업무와 생활의 반복 작업을 독립된 에이전트 워크스페이스로 관리하는 모노레포다.
과거 `ai-nodes`와 `fos-claw`로 불리던 시스템의 현재 이름이다.

## 책임 경계

- 루트는 공통 행동 규칙, 문서와 공유 skill만 관리한다.
- 구체적인 작업은 각 워크스페이스의 AGENTS.md와 데이터 경계 안에서 시작한다.
- 건강, 커리어, 금융과 예약 정보처럼 민감한 데이터는 해당 워크스페이스 밖으로 복제하지 않는다.
- 외부 게시, 지원서 제출, 예약과 투자 판단은 워크스페이스별 승인 규칙을 따른다.
- 홈서버는 예약 작업과 반복 자동화의 실행 환경이지만, 비밀 값과 운영 주소는 이 공개 페이지에 기록하지 않는다.

## 현재 워크스페이스 범위

- 주거와 인테리어 의사결정
- 금융 화면 기반 가계부 입력
- 커리어 성장과 지원 준비
- 건강 기록과 진료 준비
- 콘텐츠 운영과 사이드 프로젝트
- 투자 학습과 여행 계획

## 구조적 특징

- [[multi-workspace-monorepo]] — 관심사와 민감 데이터를 워크스페이스별로 격리한다.
- [[script-skill-separation]] — 반복 실행 코드는 script, 판단 문맥은 skill과 문서가 담당한다.
- [[ai-harness-pattern]] — 외부 상태 변경 전 승인과 실측 검증 경계를 둔다.
- [[fos-accountbook]] — 결정적 안전 정책을 적용한 가계부 자동화와 연결된다.

## Sources

- [[../../raw/notes/2026-08-25-personal-knowledge-refresh.md]]
- https://github.com/jon890/fos-agents
