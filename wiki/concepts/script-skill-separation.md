---
type: concept
created: 2026-05-28
updated: 2026-08-25
title: "실행 코드와 판단 문맥 분리"
description: "반복 실행은 script에, 목적과 판단 기준은 skill과 문서에 두는 자동화 구조"
tags: [automation, skill, script, architecture]
status: stable
---

# 실행 코드와 판단 문맥 분리

자동화에서 반복 가능한 동작과 에이전트가 읽을 판단 문맥을 서로 다른 자산으로 관리한다.

## 책임

- `scripts/`는 수집, 변환, 검증과 게시처럼 결정적으로 반복할 실행을 맡는다.
- `SKILL.md`는 언제 script를 사용하고 어떤 근거로 분기할지 설명한다.
- `AGENTS.md`는 워크스페이스 전체의 행동 경계와 문서 진입점을 맡는다.
- 데이터 구조와 되돌리기 어려운 결정은 docs와 ADR이 맡는다.

## 효과

- 에이전트가 긴 코드를 매번 다시 만들지 않고 같은 실행을 재사용한다.
- 명령 구현을 바꿔도 판단 기준과 사용자 흐름을 독립적으로 검토할 수 있다.
- 같은 지시를 여러 skill에 복제해 생기는 drift를 줄인다.
- script의 종료 코드와 산출물을 테스트해 자연어 지시보다 강한 검증 경계를 만든다.

## 관련 개념

- [[multi-workspace-monorepo]] — 이 분리를 관심사별로 격리하는 상위 구조
- [[ai-harness-pattern]] — 실행과 검증 경계를 설계하는 방식
- [[fos-agents]] — 이 구조를 사용하는 개인 자동화 시스템

## Sources

- [[../../raw/notes/2026-08-25-personal-knowledge-refresh.md]]
- https://github.com/jon890/fos-agents
