---
type: concept
created: 2026-05-28
updated: 2026-08-24
title: "실행 코드와 skill 컨텍스트 분리"
description: "반복 가능한 실행 코드는 scripts에, 에이전트 workflow 계약은 skill 디렉터리에 두는 구조"
tags: [skill, script, agent, architecture]
---

# 실행 코드와 skill 컨텍스트 분리

자동화 skill을 반복 가능한 실행 코드와 에이전트가 읽는 workflow 계약으로 나누는 `fos-agents` 표준이다.

## 핵심 포인트

- 실행 파일은 `<workspace>/scripts/<name>/`에 둔다.
- workflow 계약과 참조는 `<workspace>/.claude/skills/<name>/{SKILL.md, references/}`에 둔다.
- Codex에 같은 skill을 노출해야 하는 워크스페이스는 `.codex/skills/` 링크를 둘 수 있다.
- 저장소 전역 Codex skill은 루트 `.agents/skills/`에 둔다.

## 왜

- 수집, 파싱, 상태 전이, 렌더링과 검증은 코드로 반복 가능하게 만든다.
- skill은 언제 어떤 코드를 실행하고 결과를 어떻게 판단할지 설명한다.
- 실행 코드와 컨텍스트의 변경 이유를 분리해 검토와 재사용을 쉽게 만든다.

## 관련 개념

- [[multi-workspace-monorepo]]
- [[ai-harness-pattern]] — 스킬 기반 워크플로우
- [[ai-nodes]]

## Sources

- [[../../raw/notes/2026-08-24-fos-agents-and-document-evaluation.md]]
- github.com/jon890/fos-agents — `docs/code-architecture.md`
