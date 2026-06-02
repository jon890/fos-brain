---
type: concept
created: 2026-05-28
updated: 2026-06-02
---

# GitHub Actions AI 코드 리뷰 워크플로우 패턴

PR 에 코드 리뷰를 자동화하는 재사용 패턴이다. 새 repo 마다 이 워크플로우를 포팅해 PR 마다 자동 리뷰가 돌게 한다.

## 두 구현 방식

- **marketplace action** (`anthropics/claude-code-action`) — 설정이 쉽다. 단 action wrapper 가 내부에서 `git add -A` 등을 돌려 임시파일이 PR 에 휩쓸리는 함정이 있다.
- **self-hosted CLI** — runner 에 `claude login` 해두고 워크플로에서 `claude` 바이너리를 직접 호출한다. action 의존이 없고 모델·도구·프롬프트를 완전히 제어한다. 대신 인증·도구 차단을 직접 챙겨야 한다.

엔터프라이즈(GitHub Enterprise Server)·사내망에서는 CLI 방식이 흔하다. 그 환경 특화 함정은 [[../work 네임스페이스]] 의 GHE 운영 노트를 참조(공개 네임스페이스에는 일반 패턴만 둔다).

## 신규 레포 구축 순서 (즉시 따라 만들기)

1. **트리거** — `pull_request: [opened]` + `issue_comment: [created]` 둘 다. 전자는 자동 리뷰, 후자는 `/review` 댓글로 수동 재실행.
2. **봇·중복 제어** — `if: !endsWith(github.actor, '[bot]')` 로 모든 봇 트리거 제외(무한 루프·소음 방지). `concurrency` 그룹으로 같은 PR 의 이전 run 취소.
3. **권한** — `contents: read`, `pull-requests: write`, `issues: write` 만. `checks: write` 는 check-run 을 쓸 때만(아래 함정 참조).
4. **CLI 경로 + 모델 smoke** — `which claude` 로 바이너리를 찾고 `claude --model <별칭> --print -p ok` 로 모델 인식을 사전 확인(실패 시 조기 fail).
5. **프롬프트** — 외부 파일로 분리(아래 "프롬프트 설계").
6. **claude 실행** — `--allowedTools Bash` + `--disallowedTools "Agent,Read,Write,Edit,..."` 로 read-only + gh 만 허용.
7. **게시** — 인라인 리뷰(reviews API) + 요약 댓글 1개(`gh pr comment --body-file -`). 매 실행 전 이전 봇 댓글을 DELETE 해 중복을 막는다.
8. **진행 표시** — `/review` 댓글에 👀(시작)/✅(종료) reaction.

## 트리거와 실행 제어

- PR 이 열릴 때(opened)와 PR 댓글에 `/review` 가 달릴 때 실행한다.
- 봇 계정은 `!endsWith(github.actor, '[bot]')` 로 일괄 제외한다(개별 나열보다 견고하고 새 봇도 자동 커버).
- concurrency 그룹으로 같은 PR 의 이전 리뷰 run 을 취소해 중복 댓글을 막는다.

## 프롬프트 설계

- **외부 `.txt` 파일로 분리** — YAML 안 heredoc 50줄+ 은 가독성이 나쁘다. 게다가 `.md` 로 두면 IDE markdown 포맷터가 glob(`*.lock` → `_.lock`)·식별자(`_x` → `\_x`)를 깨뜨린다. 프롬프트는 markdown 문서가 아니라 LLM 입력 plain text 이므로 `.txt` 가 안전하다. 변수 치환은 `envsubst '$PR_NUMBER $REPO' < prompt.txt` 로 필요한 것만 한다.
- **개방형 프레이밍(앵커링 방지)** — "리뷰 관점 (4가지 축)" 처럼 닫힌 번호 목록을 주면 LLM 이 그것만 체크리스트로 보고 일반 버그(로직·보안·엣지·타입)를 놓친다. "먼저 일반 코드 리뷰를 수행하고, 추가로 프로젝트 특화 관점을 우선 점검하되 이에 한정하지 말 것" 으로 연다. 특화 항목의 번호도 빼서 닫힌 인상을 줄인다.
- **심각도 시각 구분** — 요약 댓글 섹션 제목에 색 원(🔴 심각 / 🟡 권장 / 🔵 잘 된 점).

## 모델 버전 정책

- 모델을 `claude-opus-4-7` 처럼 고정하면 버전업마다 워크플로를 수정해야 하고, CLI 버전이 그 태그를 모르면 실패한다.
- `--model opus` 별칭을 쓰면 CLI 가 인식하는 최신 Opus 를 자동 추종한다 — 버전업 시 무수정.

## 리뷰어 구성 — 두 방식의 트레이드오프

- 단일 opus 리뷰어는 한 에이전트가 타입·컨벤션·보안·아키텍처를 직접 검토한다. 판정이 일관되고 구성이 단순하다.
- 4 병렬 specialist(sonnet/haiku 혼합)는 관점을 나눠 동시에 돌려 속도와 토큰을 아끼지만, 결과를 모으는 orchestration 이 복잡하다.
- **실측 결론 — 단일 opus 가 품질에서 우월하다.** haiku 는 추론 능력이 떨어져 오탐(false positive)이 많고 실제 버그를 놓친다. 다중 에이전트의 관점 분할 이득보다 리뷰 신뢰도 손실이 더 크다.
- 그래서 기본값은 단일 opus 다. 병렬은 리뷰 대상이 너무 커 분할이 불가피하거나, 각 specialist 를 모두 opus 급으로 둘 수 있을 때만 고른다 — specialist 를 토큰 절약 목적으로 haiku 로 낮추면 리뷰 자체가 못 미더워진다.

## 게시 방식

- 인라인 리뷰 API 로 변경된 file/line 에 댓글을 달고, 전체 요약은 일반 댓글 1 개로 분리해 게시한다.
- 매 실행 전에 이전 봇 댓글을 먼저 삭제해 중복이 쌓이지 않게 한다.
- 에이전트는 read-only 로 묶는다. Write/Edit 를 비활성화하고 디스크 임시파일도 만들지 않는다.

## 함정 (gotcha)

- action wrapper 가 내부에서 `git add -A` 를 돌리므로, 에이전트가 디스크에 임시파일을 쓰면 그 파일이 PR 브랜치 커밋으로 휩쓸려 들어간다. 그래서 임시파일을 만들지 않고 요약 댓글은 HEREDOC 으로 stdin 에만 흘린다.
- `--body "...\n..."` 로 주면 shell 이 `\n` 을 글자 그대로 전달해 댓글 줄바꿈이 깨진다. `--body-file -` 에 quoted HEREDOC(실제 개행)으로 넘겨야 한다.
- reply 본문의 `/review` 는 리뷰를 재실행시키고, `@claude` 는 봇 멘션으로 인지되며, `#N` 은 엉뚱한 issue 로 링크된다. 백틱이나 평문으로 감싸 회피한다.
- issue_comment 로 트리거된 run 은 PR 의 Checks 탭에 자동으로 잡히지 않는다. head SHA 에 Check Run 을 수동 생성하면 표시되지만, **Checks API 는 GitHub App 인증 전용**이라 일반 `GITHUB_TOKEN` 으로 `gh api .../check-runs` POST 하면 "You must authenticate via a GitHub App" 403 이 난다. CI 토큰만 쓸 거면 check-run 을 포기하고 reaction(👀/✅)으로 진행을 표시한다.
- 에이전트가 sanity check 를 무시하고 "test" 같은 더미 댓글을 올리는 사고가 있다. 게시 후 jq 로 길이가 12자 미만이거나 placeholder 이거나 severity 마커가 없는 댓글을 자동 삭제한다.
- **조용한 실패** — `gh ... || true` 로 실패를 완전히 삼키면 인증 오류 등이 job ✓ 뒤에 가려져 디버깅이 막힌다. `|| echo "::warning::..."` 로 Annotations 에 노출하되 부가 작업은 계속하게 한다.
- **token 표기 혼동** — `github.token` = `secrets.GITHUB_TOKEN` (동일 값, 자동 주입). 표기를 바꿔도 인증·권한은 같다. 401/403 은 토큰 표기가 아니라 API·호스트 문제다.
- 모델 태그는 CLI/action 이 아는 값이어야 한다. 고정 태그(`claude-opus-4-7`) 대신 `opus` 별칭을 권장한다(위 "모델 버전 정책").

## 관련 개념

- [[ai-harness-pattern]] — review-fix 스킬이 이 워크플로우가 단 봇 리뷰를 읽어 코드로 반영한다.
- [[self-improving-harness]] — 리뷰에서 반복되는 지적을 pitfalls 문서에 누적해 다음 리뷰의 부담을 줄인다.
- [[commit-convention-style]] — 리뷰가 점검하는 커밋·PR 메시지 규약.

## Sources

- [[../../raw/notes/2026-05-28-ai-code-review-github-actions.md]]
- [[../../raw/notes/2026-05-29-claude-code-review-cli-recipe.md]] (self-hosted CLI 방식 + 신규 구축 레시피 + 함정 보강)
- github.com/jon890/nhncloud-cli `.github/workflows/claude-code-review.yml`
