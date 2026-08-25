---
type: topic
created: 2026-06-01
updated: 2026-08-25
title: "AI 개발 하네스"
description: "에이전트가 목표, 권한과 검증 경계 안에서 개발 작업을 완료하게 하는 지식 묶음"
tags: [ai-agent, harness, verification, development]
status: stable
---

# AI 개발 하네스

에이전트가 목표, 권한과 검증 경계 안에서 개발 작업을 끝내게 하는 개인 방법을 묶는다.
반복 명령과 세부 단계는 각 skill이 관리하고, 이 주제에는 도구가 바뀌어도 남는 설계 원칙만 둔다.

## 구성

- **실행 경계**: 목표, 성공 기준, 권한과 중단 조건을 먼저 닫는다. [[ai-harness-pattern]]
- **독립 검증**: 작성과 검토를 분리하고 실제 결과를 근거로 완료를 판단한다. [[ai-verification-layer]]
- **도구 인터페이스**: 사람과 에이전트가 같은 CLI를 예측 가능하게 호출한다. [[agent-friendly-cli-design]]
- **결정 기록**: 되돌리기 어렵거나 대안이 갈리는 이유를 코드 밖에 남긴다. [[docs-first-adr]]
- **학습 환원**: 반복 결함은 테스트, skill과 AGENTS.md의 올바른 위치로 옮긴다. [[self-improving-harness]]

## Concepts

- [[ai-harness-pattern]] — 전체 실행과 권한·검증 경계
- [[ai-verification-layer]] — 비결정적 결과를 통과 기준으로 관리하는 구조
- [[testing-philosophy]] — 실제 경로와 실패 불변을 확인하는 테스트 방식
- [[agent-friendly-cli-design]] — 에이전트 친화적인 입력, 출력과 오류 계약
- [[docs-first-adr]] — 기술 결정과 트레이드오프를 남기는 방식
- [[self-improving-harness]] — 반복 학습을 올바른 단일 원본으로 환원하는 루프
- [[ai-generated-code-acceptance-criteria]] — 사람이 최종 채택을 설명하는 기준
- [[ai-code-review-github-actions]] — 자동 리뷰를 실행 경계에 연결한 사례

## 관련 Topics

- [[work-style]] — 이 하네스를 포함하는 상위 개인 작업 방식
- [[ai-era-professionalism]] — 생산보다 판단과 운영 책임이 중요해지는 관점

## Sources

- [[../../raw/notes/2026-08-25-personal-knowledge-refresh.md]]
