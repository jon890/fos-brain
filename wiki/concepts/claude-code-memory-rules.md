---
type: concept
created: 2026-06-02
updated: 2026-06-02
---

# Claude Code 메모리: CLAUDE.md 와 .claude/rules

Claude Code 가 세션 간 지식을 전달하는 두 축은 **CLAUDE.md**(사람이 쓰는 지침)와 **자동 메모리**(Claude 가 쓰는 노트)다.
이 페이지는 그중 사람이 관리하는 쪽 — CLAUDE.md 와 `.claude/rules/` 의 로딩 규칙과, 그걸로 규칙을 여러 레포에 재사용하는 법을 다룬다.

## 무엇이 언제 로드되나

| 위치 | 로드 시점 |
| --- | --- |
| `CLAUDE.md` (프로젝트 루트, 상위 디렉터리, `~/.claude/CLAUDE.md`) | 모든 세션 시작 시 항상 |
| CLAUDE.md 안 `@경로` import | CLAUDE.md 로드 시 그 파일도 펼쳐서 함께 (최대 4홉) |
| `.claude/rules/*.md` — frontmatter 없음 | 모든 세션 시작 시 자동 (`.claude/CLAUDE.md` 와 동일 우선순위) |
| `.claude/rules/*.md` — `paths:` frontmatter 있음 | 그 glob 에 맞는 파일을 읽을 때만 조건부 |
| `~/.claude/rules/*.md` (개인) | 모든 프로젝트 자동, 프로젝트 규칙보다 먼저(우선순위 낮음) |

`.claude/rules/` 는 Claude Code 가 인식하는 **특별 폴더**다 — 그냥 만든 디렉터리가 아니라 자동 로드 대상이다.
하위 디렉터리(`rules/frontend/`)도 재귀 발견된다. 심볼릭 링크로 레포 간 공유도 된다.

## paths 범위 지정 (조건부 로드)

규칙이 특정 파일에만 필요하면 YAML frontmatter 로 범위를 좁혀 평소 토큰을 아낀다.

```markdown
---
paths:
  - "src/api/**/*.ts"
---
# API 규칙 — Claude 가 src/api 의 .ts 를 읽을 때만 로드된다
```

`paths` 없으면 무조건 로드. 트리거는 "그 패턴 파일을 읽을 때" 지 "모든 도구 호출" 이 아니다.

## 규칙 vs 강제 (중요한 한계)

CLAUDE.md·rules 는 **시스템 프롬프트가 아니라 컨텍스트**다 — Claude 가 읽고 따르려 하지만 엄격 보장은 없다.
"커밋 전 항상 X", "PR 만들 때 체크리스트 수행" 처럼 **특정 시점 강제**가 필요하면 문서가 아니라 **PreToolUse hook** 으로 한다 (Claude 결정과 무관하게 셸로 강제).

실측 교훈: 자가 점검 체크리스트를 rules 에 적어둬도 형식적으로 넘기면 안 지켜진다 (실제로 PR 본문의 깨진 링크를 못 걸렀다). 진짜 강제는 hook.

## 추가 (2026-07-30): 실행되는 검사가 있어야 진짜 강제된다는 재확인

fos-skills(공용 스킬 코어 저장소)에서 같은 원칙을 다른 사례로 다시 확인했다.
한국어 표기 규칙을 rules 문서에만 적어 두고 실행되는 검사가 없던 동안, 금지어 "게이트" 41회·인라인 `+` 연결 87회가 쌓였다.
반대로 실행되는 검사가 있는 항목(예: 코드 스타일 lint)은 같은 규모로 누적되지 않았다.
이후 규칙을 공용 검사기(`~/.claude/scripts/korean-style-check.sh`) 호출로 static-check 에 넣어 prose 규칙을 "실패하는 검사"로 바꾸자 더는 쌓이지 않았다.
규칙 문서와 검사기가 같은 금지어 목록을 공유해야 갈라지지 않는다 — 검사기가 자체 하드코딩 목록을 갖지 않고 규칙 파일을 파싱해야 한다.

## 다른 레포에 규칙 재사용하는 법

1. **팀 공유 규칙** (PR 양식·커밋 컨벤션 등) → 그 레포 `.claude/rules/<주제>.md` 에 실파일로 둔다. 커밋하면 팀원도 clone 시 자동 로드.
2. **개인 취향 규칙** (글쓰기 스타일 등) → `~/.claude/rules/<주제>.md` 에 두면 내 모든 레포에 자동 적용. 레포엔 안 넣는다.
3. **레포 문서가 개인 글로벌 경로(`~/.claude/...`)를 참조하지 않게 한다** — 팀원에겐 그 파일이 없어 깨진다. 개인 룰은 개인 글로벌에서만 살아야 한다.
4. 여러 레포 공유 규칙은 `~/shared-rules/` 에 두고 각 레포 `.claude/rules/` 에서 심볼릭 링크.

## 디버깅

- `/memory` — 현재 세션에 로드된 CLAUDE.md·rules 파일 목록 확인. 안 보이면 Claude 가 못 본 것.
- `InstructionsLoaded` hook — 어떤 지침이 언제·왜 로드됐는지 기록 (paths 규칙 디버깅).
- 200줄 넘는 CLAUDE.md 는 준수 저하 → paths 규칙으로 쪼개거나 정리.

## 관련 개념

- [[ai-harness-pattern]] — 스킬·규칙으로 작업 전 주기를 자동화하는 재사용 하네스
- [[commit-convention-style]] — 레포 rules 로 둘 수 있는 팀 공유 규칙의 예

## Sources

- [[../../raw/notes/2026-06-02-claude-rules-and-conventions.md]] — 세션 실측, Claude Code 공식 문서(code.claude.com/docs/ko/memory) 확인
