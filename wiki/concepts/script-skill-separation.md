---
type: concept
created: 2026-05-28
updated: 2026-05-28
---

# 실행/컨텍스트 분리 표준 (ADR-006)

자동화 스킬을 실행 파일과 컨텍스트 자산 두 부분으로 나누는 ai-nodes 표준.

## 핵심 포인트

- 실행 파일 — `<workspace>/scripts/<name>/`
- 컨텍스트 자산 — `<workspace>/.claude/skills/<name>/{SKILL.md, references/}`
- career-os 의 ADR-019 비대칭이 ADR-006 표준으로 격상됐다(2026-05-19). apartment 가 첫 적용.
- 라우터·디스패처는 폐기하고 Claude **native skill 직접 호출**로 전환했다(ADR-031, ADR-002).

## 왜

- 실행(언제·어떻게 돌리나)과 지식(무엇을·왜)을 분리해 스킬을 재사용·감사하기 쉽게 만든다.
- native skill 직접 호출은 dispatcher 중간층의 깨짐·디버깅 비용을 없앤다.

## 관련 개념

- [[multi-workspace-monorepo]]
- [[ai-harness-pattern]] — 스킬 기반 워크플로우
- [[../entities/ai-nodes]]

## Sources

- github.com/jon890/fos-claw — `AGENTS.md`, `docs/workspace-structure.md`
