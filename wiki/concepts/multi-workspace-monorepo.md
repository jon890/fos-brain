---
type: concept
created: 2026-05-28
updated: 2026-08-24
title: "멀티 워크스페이스 모노레포"
description: "여러 자동화 워크스페이스를 한 저장소에서 운영하면서 책임과 자산을 서로 격리하는 구조"
tags: [monorepo, workspace, automation, architecture]
---

# 멀티 워크스페이스 모노레포

여러 자동화 워크스페이스를 한 저장소에 두되 서로 격리하는 `fos-agents`의 구조다.

## 핵심 포인트

- 최상위 디렉터리 각각이 독립 워크스페이스이며 자체 `AGENTS.md`와 책임 문서를 가진다.
- 워크스페이스 간 자산 교차 참조를 금지한다.
- 워크스페이스 한정 helper와 실행 코드는 `<workspace>/scripts/` 안에 둔다.
- 여러 워크스페이스가 함께 사용하는 실제 공통 책임만 루트 자산으로 둔다.
- `AGENTS.md`를 정식 가이드로 사용하고 `CLAUDE.md`는 이를 가리키는 심볼릭 링크로 둔다.
- 새 워크스페이스는 `docs/code-architecture.md`의 표준 트리를 따른다.

## 관련 개념

- [[script-skill-separation]] — 워크스페이스 내부 구조 (native skill 직접 호출)
- [[ai-harness-pattern]] — 개발 하네스의 자동화 버전
- [[ai-nodes]]

## Sources

- [[../../raw/notes/2026-08-24-fos-agents-and-document-evaluation.md]]
- github.com/jon890/fos-agents — `AGENTS.md`, `docs/code-architecture.md`
