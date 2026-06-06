---
type: concept
created: 2026-06-02
updated: 2026-06-02
---

# OpenClaw CLI 레퍼런스

자주 쓰는 openclaw 명령 모음. 작업별 진입점.

## 진단·서비스

- `openclaw doctor` — 종합 진단. `--fix` 로 일부 자동 수정.
- `openclaw gateway status | restart | install` — Gateway 서비스 제어.
- `openclaw dashboard --no-open` — Control UI 토큰 URL 출력.
- `openclaw logs` — Gateway 로그 tail.

## 채널·디렉터리

- `openclaw channels list | add | status` — 채널 관리.
- `openclaw directory groups list --channel discord` — 채널/그룹 ID·이름 조회.
- `openclaw directory peers | self` — 연락처·본인 계정 조회.

## 메시지

- `openclaw message send --channel discord --target channel:<id> -m "텍스트"` — 채널 전송.
- 서브커맨드 다수.
  - 조회: read, search.
  - 변경: edit, delete, pin.
  - 상호작용: react, poll, broadcast, thread.
- 자세히는 [[openclaw-message-tool]].

## 에이전트·세션

- `openclaw agent --agent <id> --message "..."` — 에이전트 턴 1회 실행.
  - 세션 지정 필수: `--agent` / `--session-key` / `--session-id` / `--to` 중 하나.
- `openclaw sessions list` — 세션 목록(키·모델·토큰·age).

## 기타

- `openclaw cron` — 백그라운드 스케줄 작업.
- `openclaw docs "<질의>"` — 라이브 문서 검색.
- `openclaw config get | set | unset | validate` — 설정. 자세히는 [[openclaw-config]].

## 관련 개념

- [[openclaw-gateway-ops]] — 서비스·대시보드
- [[openclaw-message-tool]] — 전송 상세
- [[openclaw]] — 상위 주제

## Sources

- [[../../raw/notes/2026-06-02-openclaw-knowledge-session.md]]
- openclaw CLI `--help` (2026.5.28)
