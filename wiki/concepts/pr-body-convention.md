---
type: concept
created: 2026-06-02
updated: 2026-06-02
---

# PR 본문 작성 컨벤션

GitHub PR 본문을 리뷰어가 빠르게 읽고 판단하도록 쓰는 공통 양식.
회사·프로젝트 무관한 일반 작성법이며, 제목·이슈 트래커 형식 같은 프로젝트 고유부는 각 레포가 더한다.

## 본문 구조

```markdown
## Summary
한 문장 요약.
- 핵심 변경 1
- 핵심 변경 2

(이슈 트래커 딥링크 — 웹 URL)

## Changes
### 영역(또는 단계) 1 — 제목
- 변경 bullet

## Verification
- 검증 명령 + 실행 결과
```

## 포함할 것

- **검증 결과** — 빌드/테스트 명령과 그 실행 결과를 함께. 명령만 적고 결과를 빼지 않는다.
- **변경 사항** — 영역/단계별 bullet.
- **이슈 트래커 딥링크** — 클릭되는 웹 URL.

## 포함하지 않을 것

- **Commits 섹션** — PR 의 Commits 탭에 이미 있다. 본문에 커밋 목록 나열 금지.
- **내부 프로세스 이력** — 리뷰·검증 에이전트(critic/code-reviewer 등) 판정 이력은 리뷰어에게 노이즈. Verification 엔 빌드/테스트 결과만.

## 자가 점검 (PR 생성 직전)

1. 이슈 트래커 링크가 클릭되는 웹 URL 인가?
2. Commits 섹션이 없는가?
3. 내부 프로세스 이력이 없는가?
4. Summary 에 인라인 연결(`+`/`·`)로 항목을 묶은 곳이 없는가?
5. Verification 에 명령과 실행 결과가 함께 있는가?

이 점검은 "문서로 적어두면 지켜진다" 가 아니다 — 실제로 PR 생성 직후 본문을 grep·눈으로 확인해야 한다. 강제하려면 PreToolUse hook 으로 (`gh pr create` 시점). [[claude-code-memory-rules]] 의 "규칙 vs 강제" 참조.

## 다른 레포에 적용하는 법

- 이 양식을 그 레포 `.claude/rules/pr-conventions.md` 에 실파일로 두면 매 세션 자동 로드된다 ([[claude-code-memory-rules]]).
- 제목 형식·브랜치명·이슈 트래커(웹 URL 조회법)는 레포마다 다르니 같은 파일에 "프로젝트 전용" 으로 더한다.
- 개인 글로벌(`~/.claude/`)이 아니라 레포에 둔다 — 팀원도 공유해야 하므로.

## 관련 개념

- [[claude-code-memory-rules]] — 이 컨벤션을 .claude/rules 로 자동 로드시키는 법
- [[commit-convention-style]] — 같은 레포 rules 로 둘 커밋 규칙
- [[pr-review-fix-workflow]] — PR 리뷰가 달린 뒤 반영하는 방법론

## Sources

- [[../../raw/notes/2026-06-02-claude-rules-and-conventions.md]] — 세션 실측 (docu-parser PR 운영)
