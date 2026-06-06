---
type: concept
created: 2026-06-02
updated: 2026-06-02
---

# OpenClaw 설정 (config)

설정은 `~/.openclaw/openclaw.json`(JSON5)에 있고, `openclaw config` CLI 로 다룬다.

## 설정 파일

- 경로: `~/.openclaw/openclaw.json`. 포맷은 JSON5.
- 활성 config 경로는 일반 파일이어야 한다(심볼릭 링크 주의).

## config CLI

- `openclaw config get <path>` — 값 조회.
- `openclaw config set <path> <value> [--strict-json]` — 값 설정.
  - JSON 값(배열·객체)은 `--strict-json`.
  - `--merge` 는 객체/맵 병합용. 배열 값엔 안 맞아 적용이 안 된다.
  - `--dry-run` 은 쓰기 없이 검증만(부작용 없이 명령을 미리 검사). 단 value 모드는 검증을 스킵하고 `--strict-json` 일 때 검증한다.
- `openclaw config unset <path>` — 값 제거.
- `openclaw config validate` — config 형태 점검.
- 설정 변경 후 대부분 `openclaw gateway restart` 로 반영해야 한다.

## Secret 취급

- `config get` 은 secret 류를 redact 한다(`__OPENCLAW_REDACTED__` 로 표시).
  - 실제 토큰 값이 필요하면 raw 파일에서 읽어야 한다.
- 평문 secret(토큰)은 SecretRef 로 외부화 권장.
  - `openclaw secrets configure` / `apply` / `audit --check`.

## 관련 개념

- [[openclaw-tool-policy]] — tools.* 설정
- [[openclaw-gateway-ops]] — 변경 반영(restart)·doctor
- [[openclaw]] — 상위 주제

## Sources

- [[../../raw/notes/2026-06-02-openclaw-knowledge-session.md]]
- docs.openclaw.ai/gateway/configuration
