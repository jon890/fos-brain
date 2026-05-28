---
type: concept
created: 2026-05-28
updated: 2026-05-28
---

# 실행·토큰 트래킹 (track_task.sh)

모든 워크스페이스 실행을 단일 래퍼로 감싸 자동 로깅하는 ai-nodes 패턴.

## 핵심 포인트

- `_shared/bin/track_task.sh` 가 모든 러너를 래핑한다(우회 금지).
- 실행별 로그를 남긴다.
  - `<workspace>/logs/task-runs.jsonl`
  - `<workspace>/logs/token-usage.jsonl`
- 실행 전후 `openclaw status` 를 캡처해 모델·토큰·캐시 변화량을 기록한다.
- Claude CLI usage JSON 을 env(`TRACK_TASK_CLAUDE_USAGE_FILE`)로 수집한다.
- **load-bearing 의존성** — 이 스크립트가 없으면 모든 워크스페이스 러너가 실패한다.

## 관련 개념

- [[multi-workspace-monorepo]]
- [[../entities/ai-nodes]]

## Sources

- github.com/jon890/fos-claw — `AGENTS.md`
