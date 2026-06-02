---
source_type: session
date: 2026-06-02
topic: .claude/rules 자동로드 메커니즘 + PR/Dooray/한국어 컨벤션 재사용
---

# .claude/rules 와 컨벤션 재사용 (2026-06-02 세션 실측)

## .claude/rules 자동로드 (Claude Code 공식 문서 확인)

- `.claude/rules/*.md` 는 Claude Code 가 인식하는 특별 폴더. 자동 로드된다 (그냥 만든 폴더가 아님).
- frontmatter 없는 규칙 → 모든 세션 시작 시 자동 로드 (`.claude/CLAUDE.md` 와 동일 우선순위).
- `paths:` YAML frontmatter 있는 규칙 → 그 glob 에 맞는 파일을 읽을 때만 조건부 로드 (노이즈·토큰 절약).
- `~/.claude/rules/*.md` (개인) → 모든 프로젝트 자동 적용, 프로젝트 규칙보다 먼저 로드(우선순위 낮음).
- `CLAUDE.md @path` import → CLAUDE.md 로드 시 그 파일도 함께 펼쳐 로드 (최대 4홉). 단 가져온 파일도 시작 시 컨텍스트 소모 → 토큰 절약은 안 됨.
- rules·CLAUDE.md 는 "컨텍스트" 지 "강제" 아님. 특정 시점 강제는 PreToolUse hook 으로 (Claude 결정 무관 강제). 공식 문서 명시.
- 실측 교훈: 자가 점검 체크리스트를 rules 에 적어도 형식적으로 넘기면 안 지켜짐 (이번에 깨진 Dooray 링크가 그 증거). 강제하려면 hook.

## 컨벤션 위치 분리 원칙 (이번에 정립)

- 팀 공유 규칙(PR 본문·Dooray) → 레포 `.claude/rules/` 에 실파일. 팀원 clone 시 함께 옴.
- 개인 취향 룰(한국어 표현·마크다운 가독성) → 개인 `~/.claude/` 전담. 레포가 개인 경로(`~/.claude/...`)를 참조하면 팀원에게 깨지므로 금지.
- 레포 문서가 개인 글로벌 경로를 참조하지 않게 한다 (외과적 분리).

## PR 본문 공통 양식

- 구조: `## Summary`(한 문장 + bullet) → `## Changes`(영역/단계별) → `## Verification`(검증 명령 + 실행 결과).
- 포함: 검증 결과(명령+실측), 이슈 트래커 딥링크(웹 URL).
- 제외: Commits 섹션(PR Commits 탭 중복), 내부 프로세스 이력(critic/code-reviewer 판정 노이즈).
- 자가 점검: 딥링크 웹 URL인가 / Commits 섹션 없나 / 프로세스 이력 없나 / 인라인 연결 없나 / 검증에 명령+결과 있나.

## 이슈 트래커 연동 (Dooray — 일반 사용법)

내부 프로젝트 고유 규칙(프로젝트명·도메인 코드)은 work 네임스페이스에 둔다. 여기엔 외부 사용자도 아는 Dooray 일반 사용법만.

- PR 제목에 `#<프로젝트>/<업무번호>` 를 넣으면 Dooray·GitHub 양쪽에서 딥링크로 잡힌다.
- Dooray CLI: `dooray post create --title --body-file --to --cc/--cc-group`. 태그 prefix 누락 시 `USER_INVALID_TAG_MANDATORY_PREFIX`.
- Dooray 댓글: `dooray post comment add <project> <번호> --body-file` (서브커맨드가 `add`).
- **Dooray 딥링크 함정 (실측)**: `dooray post get ... --json` 응답에서 최상위 `projectId` 는 None. projectId 는 `d['project']['id']` 에 있다. 웹 URL = `https://nhn.dooray.com/task/{project.id}/{id}`. `dooray://` 프로토콜은 GitHub PR 에서 파싱 안 됨.
