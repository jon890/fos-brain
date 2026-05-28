---
type: concept
created: 2026-05-28
updated: 2026-05-28
---

# 멀티 워크스페이스 모노레포

여러 자동화 워크스페이스를 한 저장소에 두되 서로 격리하는 구조(ai-nodes).

## 핵심 포인트

- 최상위 디렉터리 각각이 독립 워크스페이스 — 자체 skills·data·logs·config 를 가진다.
- 워크스페이스 간 자산 교차 참조를 금지한다.
- 공용은 두 곳만 둔다.
  - `_shared/` — bin(shell·Python), lib(Bun TS), types
  - 루트 `skills/` — 전역 Claude Code 스킬(agent-browser, planning, plan-and-build, workspace-audit, docs-check)
- `_shared/lib` 에는 **워크스페이스 무관 헬퍼만** 둔다(특정 config·data 의존 금지, ADR-001).
- 워크스페이스 한정 헬퍼는 `<workspace>/scripts/<skill>/` 내부에 둔다.
- 새 워크스페이스는 `docs/workspace-structure.md` 청사진을 진입점으로 만든다.

## 관련 개념

- [[script-skill-separation]] — 워크스페이스 내부 구조
- [[task-run-tracking]] — 공통 실행 래퍼
- [[ai-harness-pattern]] — 개발 하네스의 자동화 버전
- [[../entities/ai-nodes]]

## Sources

- github.com/jon890/fos-claw — `AGENTS.md`
