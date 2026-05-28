---
type: concept
created: 2026-05-28
updated: 2026-05-28
---

# GitHub Actions AI 코드 리뷰 워크플로우 패턴

PR 에 anthropics/claude-code-action 을 붙여 코드 리뷰를 자동화하는 재사용 패턴이다.
새 repo 마다 이 워크플로우를 포팅해 PR 마다 자동 리뷰가 돌게 한다.

## 트리거와 실행 제어

- PR 이 열릴 때(opened)와 PR 댓글에 `/review` 가 달릴 때 실행한다.
- 봇 계정과 dependabot 이 만든 이벤트는 제외한다.
- concurrency 그룹으로 같은 PR 의 이전 리뷰 run 을 취소해 중복 댓글을 막는다.

## 리뷰어 구성 — 두 방식의 트레이드오프

- 단일 opus 리뷰어는 한 에이전트가 타입·컨벤션·보안·아키텍처를 직접 검토한다. 판정이 일관되고 구성이 단순하다.
- 4 병렬 specialist(sonnet/haiku 혼합)는 관점을 나눠 동시에 돌려 속도와 토큰을 아끼지만, 결과를 모으는 orchestration 이 복잡하다.
- 일관성과 단순함을 원하면 단일 opus 를, 속도와 비용 최적화를 원하면 병렬을 고른다.

## 게시 방식

- 인라인 리뷰 API 로 변경된 file/line 에 댓글을 달고, 전체 요약은 일반 댓글 1 개로 분리해 게시한다.
- 매 실행 전에 이전 봇 댓글을 먼저 삭제해 중복이 쌓이지 않게 한다.
- 에이전트는 read-only 로 묶는다. Write/Edit 를 비활성화하고 디스크 임시파일도 만들지 않는다.

## 함정 (gotcha)

- action wrapper 가 내부에서 `git add -A` 를 돌리므로, 에이전트가 디스크에 임시파일을 쓰면 그 파일이 PR 브랜치 커밋으로 휩쓸려 들어간다. 그래서 임시파일을 만들지 않고 요약 댓글은 HEREDOC 으로 stdin 에만 흘린다.
- `--body "...\n..."` 로 주면 shell 이 `\n` 을 글자 그대로 전달해 댓글 줄바꿈이 깨진다. `--body-file -` 에 quoted HEREDOC(실제 개행)으로 넘겨야 한다.
- reply 본문의 `/review` 는 리뷰를 재실행시키고, `@claude` 는 봇 멘션으로 인지되며, `#N` 은 엉뚱한 issue 로 링크된다. 백틱이나 평문으로 감싸 회피한다.
- issue_comment 로 트리거된 run 은 PR 의 Checks 탭에 자동으로 잡히지 않는다. head SHA 에 Check Run 을 수동으로 만들고, 작업이 끝나면 conclusion 을 PATCH 해 결과를 표시한다.
- 에이전트가 sanity check 를 무시하고 "test" 같은 더미 댓글을 올리는 사고가 있다. 게시 후 jq 로 길이가 12자 미만이거나 placeholder 이거나 severity 마커가 없는 댓글을 자동 삭제한다.
- claude_args 의 모델 태그는 action 버전이 아는 값이어야 한다(예: claude-opus-4-7). 모르는 태그면 실행이 실패한다.

## 관련 개념

- [[ai-harness-pattern]] — review-fix 스킬이 이 워크플로우가 단 봇 리뷰를 읽어 코드로 반영한다.
- [[self-improving-harness]] — 리뷰에서 반복되는 지적을 pitfalls 문서에 누적해 다음 리뷰의 부담을 줄인다.
- [[commit-convention-style]] — 리뷰가 점검하는 커밋·PR 메시지 규약.

## Sources

- [[../../raw/notes/2026-05-28-ai-code-review-github-actions.md]]
- github.com/jon890/nhncloud-cli `.github/workflows/claude-code-review.yml`
