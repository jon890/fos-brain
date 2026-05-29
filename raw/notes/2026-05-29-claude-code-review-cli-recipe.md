---
source: 세션 분석 (docu-parser claude-review.yml 디버깅·정비)
collected: 2026-05-29
type: session-note
---

# claude code review 워크플로 — self-hosted CLI 방식 신규 구축 레시피 + 함정

기존 brain 페이지(ai-code-review-github-actions)는 marketplace `anthropics/claude-code-action`
방식 중심. 본 노트는 **self-hosted runner + claude CLI 직접 호출** 방식과, 새 레포에
즉시 붙일 수 있는 구축 순서 + 운영에서 겪은 함정을 더한다.

## 두 구현 방식

- **marketplace action** (`anthropics/claude-code-action`) — 설정 쉬움. action wrapper 가
  내부에서 `git add -A` 등을 해 임시파일이 PR 에 휩쓸리는 함정.
- **self-hosted CLI** — runner 에 `claude login` 해두고 워크플로에서 `claude` 바이너리 직접
  호출. action 의존 없음, 모델·도구·프롬프트 완전 제어. 단 인증·도구 차단을 직접 챙겨야 함.

## 신규 레포 구축 순서 (즉시 따라 만들기)

1. **트리거** — `pull_request: [opened]` + `issue_comment: [created]` 둘 다.
   - opened: PR 열릴 때 자동 리뷰. issue_comment: `/review` 댓글로 수동 재실행.
2. **봇·중복 제어**:
   - `if: !endsWith(github.actor, '[bot]')` 로 모든 봇 트리거 제외 (무한 루프·소음 방지).
   - `concurrency` 그룹으로 같은 PR 의 이전 run 취소.
3. **권한** — `contents: read`, `pull-requests: write`, `issues: write` 만.
   `checks: write` 는 check-run 안 쓰면 불필요 (아래 함정 참조).
4. **CLI 경로 resolve + 모델 smoke** — `which claude` 로 바이너리 찾고,
   `claude --model <별칭> --print -p ok` 로 모델 인식 사전 확인 (실패 시 조기 fail).
5. **프롬프트** — 외부 파일로 분리 (아래 "프롬프트 설계").
6. **claude 실행** — `--print -p "$PROMPT" --model <별칭> --allowedTools Bash
   --disallowedTools "Agent,Read,Write,Edit,..."` 로 read-only + gh 만 허용.
7. **게시** — 인라인 리뷰(reviews API) + 요약 댓글 1개(`gh pr comment --body-file -`).
   매 실행 전 이전 봇 댓글 DELETE 로 중복 방지.
8. **진행 표시** — `/review` 댓글에 👀(시작)/✅(종료) reaction.

## 프롬프트 설계 원칙

- **외부 `.txt` 파일로 분리** — YAML 안 heredoc 50줄+ 은 가독성 나쁘고, `.md` 로 두면
  IDE markdown 포맷터가 glob(`*.lock` → `_.lock`)·식별자(`_x` → `\_x`)를 깨뜨린다.
  프롬프트는 markdown 문서가 아니라 LLM 입력 plain text → **`.txt` 가 안전**.
  변수 치환은 `envsubst '$PR_NUMBER $REPO' < prompt.txt` 로 필요한 것만.
- **개방형 프레이밍 (앵커링 방지)** — "리뷰 관점 (4가지 축)" 처럼 닫힌 번호 목록을 주면
  LLM 이 그것만 체크리스트로 보고 일반 버그(로직·보안·엣지·타입)를 놓친다.
  "**먼저 일반 코드 리뷰**(로직 정확성·보안·엣지·타입·동시성·가독성)를 수행하고,
  **추가로** 프로젝트 특화 관점을 우선 점검하되 **이에 한정하지 말 것**" 으로 연다.
  특화 항목의 `### 1./2.` 번호도 제거해 닫힌 목록 인상을 줄인다.
- **심각도 시각 구분** — 요약 댓글 섹션에 색 원 (🔴 심각 / 🟡 권장 / 🔵 잘 된 점).
- **출력 사고 방어** — `--body "...\n..."` 는 shell 이 `\n` 을 literal 2글자로 전달해
  줄바꿈이 깨짐 → `--body-file -` 에 실제 개행 HEREDOC. 더미("test") 댓글 게시 금지 명시.

## 모델 버전 정책

- 모델을 `claude-opus-4-7` 처럼 **고정하면 버전업마다 워크플로 수정** 필요 + CLI 버전이
  그 태그를 모르면 실패.
- `--model opus` **별칭**을 쓰면 CLI 가 인식하는 최신 Opus 를 자동 추종 → 버전업 시 무수정.

## 자주 실패하는 곳 (gotcha)

- **조용한 실패** — `gh ... || true` 로 실패를 완전히 삼키면, 인증 오류 등이 job ✓ 뒤에
  가려져 디버깅 불가. `|| echo "::warning::..."` 로 Annotations 에 노출하되 부가 작업은
  계속하게 한다.
- **issue_comment 트리거의 PR 미연동** — `/review` 댓글로 트리거된 run 은 PR 의 Checks 탭에
  자동 등록되지 않는다(GitHub Actions 제약). reaction(👀/✅)으로 진행을 표시하거나,
  요약 댓글에 run URL 을 넣는다. (Check Run 수동 생성은 GitHub App 인증이 필요 — 아래)
- **Checks API 는 GitHub App 전용** — check-run 을 만들어 Checks 탭에 표시하려면 GitHub App
  설치 인증이 필요하다. 일반 `GITHUB_TOKEN` 으로 `gh api .../check-runs` POST 하면
  "You must authenticate via a GitHub App" 403. CI 토큰만 쓸 거면 check-run 을 포기하고
  reaction 으로 대체한다.
- **token 표기 혼동** — `github.token` = `secrets.GITHUB_TOKEN` (동일 값, 자동 주입).
  표기를 바꿔도 권한·인증은 동일하다. 401/403 은 토큰 표기가 아니라 API·호스트 문제다.

## 일반화 교훈

- LLM 리뷰 프롬프트는 "무엇을 보라"보다 "**무엇에 한정하지 말라**"를 명시해야 일반 버그를 안 놓친다.
- LLM 에 먹일 프롬프트·glob·식별자가 든 파일은 markdown 포맷터를 타지 않게 `.txt` 로 둔다.
- 부가 작업의 `|| true` 는 "조용한 실패" 부채 — 최소한 warning 으로 가시화한다.
