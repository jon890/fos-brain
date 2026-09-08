---
type: concept
created: 2026-05-28
updated: 2026-09-02
title: "GitHub Actions AI 코드 리뷰 워크플로 패턴"
description: "PR 자동 리뷰를 새 저장소에 포팅하는 두 구현 방식과 프롬프트 주입, 게시 방식, 저장소마다 갈리는 여덟 축"
tags: [ai-harness, code-review, github-actions, ci]
---

# GitHub Actions AI 코드 리뷰 워크플로우 패턴

PR 에 코드 리뷰를 자동화하는 재사용 패턴이다. 새 repo 마다 이 워크플로우를 포팅해 PR 마다 자동 리뷰가 돌게 한다.

## 두 구현 방식

- **marketplace action** (`anthropics/claude-code-action`) — 설정이 쉽다. 단 action wrapper 가 내부에서 `git add -A` 등을 돌려 임시파일이 PR 에 휩쓸리는 함정이 있다.
- **self-hosted CLI** — runner 에 `claude login` 해두고 워크플로에서 `claude` 바이너리를 직접 호출한다. action 의존이 없고 모델·도구·프롬프트를 완전히 제어한다. 대신 인증·도구 차단을 직접 챙겨야 한다.

엔터프라이즈(GitHub Enterprise Server)·사내망에서는 CLI 방식이 흔하다. marketplace action 을 쓸 수 없는 환경이 있기 때문이다.

**엔터프라이즈 함정을 이 공개 페이지에 두는 이유다.**
이전에는 환경 특화 함정을 work 네임스페이스로 보냈다.
`GH_HOST` 와 `GH_ENTERPRISE_TOKEN` 처럼 엔터프라이즈를 쓰는 누구에게나 같은 값은 일반 패턴이라 여기 둔다.
사내 호스트명, 저장소 이름과 토큰 값은 여기 적지 않는다.

## 신규 레포 구축 순서 (즉시 따라 만들기)

1. **트리거** — `pull_request: [opened]`, `issue_comment: [created]` 둘 다. 전자는 자동 리뷰, 후자는 `/review` 댓글로 수동 재실행.
2. **봇·중복 제어** — `if: !endsWith(github.actor, '[bot]')` 로 모든 봇 트리거 제외(무한 루프·소음 방지). `concurrency` 그룹으로 같은 PR 의 이전 run 취소.
3. **권한** — 최소는 `contents: read`, `pull-requests: write`, `issues: write` 셋이다. marketplace action 을 쓰면 `id-token: write` 가 실제로 더 필요하다. `checks: write` 는 check-run 을 **실제로 만드는** 경우에만 넣는다(아래 함정 참조).
4. **CLI 경로, 모델 smoke** — `which claude` 로 바이너리를 찾고 `claude --model <별칭> --print -p ok` 로 모델 인식을 사전 확인(실패 시 조기 fail).
5. **프롬프트** — 외부 파일로 분리(아래 "프롬프트 설계").
6. **claude 실행** — `--allowedTools Bash`, `--disallowedTools "Agent,Read,Write,Edit,..."` 로 read-only, gh 만 허용. 실측에서 이 값이 네 갈래로 갈렸다. `Bash` 를 통째로 허용하는 곳, `Bash(gh ...)` 로 세분하는 곳, 그리고 `Read,Grep,Glob` 을 허용하고 `Write,Edit` 만 막는 곳이 있다. **마지막 형태도 read-only 다.** 셋 다 읽기 전용 도구라 안전 전제가 깨지지 않고, 오히려 diff 밖 맥락을 볼 수 있어 아래 "구체적 체크리스트의 오탐" 이 줄어든다. 대신 diff 텍스트만으로 라인을 계산할 이유가 없어져 아래 "인라인 라인 계산" 의 부담이 가벼워진다.
7. **게시** — 요약과 인라인을 한 리뷰로 묶어 reviews API 를 한 번 호출한다(아래 "게시 방식"). 매 실행 전에 이전 게시물을 정리해 중복을 막되, 리뷰 본문은 지울 수 없어 접는다.
8. **진행 표시** — `/review` 댓글에 reaction. 시작은 👀(`eyes`), 종료는 job 상태에 따라 👍(`+1`)·👎(`-1`) 다. reaction API 에 ✅ 값이 없다.
9. **job 타임아웃** — `timeout-minutes` 를 15 분쯤으로 건다. 걸지 않으면 기본 360 분이라, 리뷰가 매달렸을 때 한 시간 반 넘게 방치된 사고가 있었다.
10. **action 버전 고정** — marketplace action 을 쓰면 floating `v1` 대신 특정 패치로 고정한다. floating 태그가 교체된 binary 로 조용히 깨진 사고가 있었다.

## 트리거와 실행 제어

- PR 이 열릴 때(opened)와 PR 댓글에 `/review` 가 달릴 때 실행한다.
- 봇 계정은 `!endsWith(github.actor, '[bot]')` 로 일괄 제외한다(개별 나열보다 견고하고 새 봇도 자동 커버).
- **개별 나열은 포팅에서 깨진다.** 실측한 저장소 일곱 중 넷이 `dependabot[bot]` 과 `claude[bot]` 둘만 나열한다. self-hosted 방식은 봇 표기가 `github-actions[bot]` 이라 그 나열에 걸리지 않는다. 나열형을 그대로 옮기면 자기 리뷰에 다시 트리거된다.
- concurrency 그룹으로 같은 PR 의 이전 리뷰 run 을 취소해 중복 댓글을 막는다.

## 프롬프트 설계

- **외부 `.txt` 파일로 분리** — YAML 안 heredoc 50줄+ 은 가독성이 나쁘다. 게다가 `.md` 로 두면 IDE markdown 포맷터가 glob(`*.lock` → `_.lock`)·식별자(`_x` → `\_x`)를 깨뜨린다. 프롬프트는 markdown 문서가 아니라 LLM 입력 plain text 이므로 `.txt` 가 안전하다. 변수 치환은 `envsubst '$PR_NUMBER $REPO' < prompt.txt` 로 필요한 것만 한다.
- **개방형 프레이밍(앵커링 방지)** — "리뷰 관점 (4가지 축)" 처럼 닫힌 번호 목록을 주면 LLM 이 그것만 체크리스트로 보고 일반 버그(로직·보안·엣지·타입)를 놓친다. "먼저 일반 코드 리뷰를 수행하고, 추가로 프로젝트 특화 관점을 우선 점검하되 이에 한정하지 말 것" 으로 연다. 특화 항목의 번호도 빼서 닫힌 인상을 줄인다.
- **심각도 시각 구분** — 리뷰 본문의 섹션 제목에 색 원(🔴 심각 / 🟡 권장 / 🔵 잘 된 점).

## 프롬프트 주입이 방식마다 갈리는 지점

`.txt` 외부 분리·`--model opus` 별칭·`envsubst` 화이트리스트는 두 방식 공통이다. 차이는 **분리한 프롬프트를 어디로 흘려보내느냐**다.

| 구분 | marketplace action | self-hosted CLI |
|------|--------------------|-----------------|
| prompt 전달 | 사전 step 이 `envsubst` 로 `.txt` 치환 → `$GITHUB_OUTPUT` 멀티라인 output → action 의 `prompt:` 입력 | `envsubst ... < prompt.txt \| claude ... -p -` 로 stdin 직접 파이프 |
| 모델 지정 | `claude_args: '--model opus ...'` | `claude --model opus ...` |
| 도구 제한 | `claude_args: '--allowedTools ... --disallowedTools ...'` | 동일 플래그를 CLI 에 직접 |

공통 원칙(둘 다 지킨다):

- prompt 는 `.txt` 외부 파일 — `.md` 금지(포맷터가 glob `*.lock`·식별자 escape 깨뜨림). 파일 위치가 `.github/` 직하와 `.github/workflows/` 두 갈래로 갈리므로 포팅할 때 어느 쪽인지 먼저 본다.
- `--model opus` 별칭 — 고정 태그 금지. 이 권장은 실측 일곱 중 여섯만 따르고 있어, 포팅할 때 원본이 태그를 박아 두었는지 확인한다.
- `envsubst '$PR_NUMBER $REPO'` 화이트리스트 — 파일이 YAML 밖이라 `${{ }}` 가 안 먹으므로 `$VAR` placeholder, 명시 치환. 화이트리스트를 줘야 프롬프트 안 다른 `$` 표현이 안 깨진다.

marketplace action 의 멀티라인 output 패턴:

```yaml
- id: prompt
  env:
    PR_NUMBER: ${{ env.PR_NUMBER }}
    REPO: ${{ github.repository }}
  run: |
    {
      echo 'text<<PROMPT_EOF'
      envsubst '$PR_NUMBER $REPO' < .github/workflows/code-review-prompt.txt
      echo 'PROMPT_EOF'
    } >> "$GITHUB_OUTPUT"
# 이후 action 에 prompt: ${{ steps.prompt.outputs.text }}
```

marketplace 고유 함정이다. `$GITHUB_OUTPUT` heredoc delimiter(`PROMPT_EOF`)가 프롬프트 본문에 우연히 등장하면 output 이 잘린다. delimiter 를 본문에 안 나올 토큰으로 둔다. prompt 파일은 `.github/` 안에 둬 action wrapper 의 `git add -A` 에 휩쓸려도 의도된 추적 파일이게 한다.

## 모델 버전 정책

- 모델을 `claude-opus-4-7` 처럼 고정하면 버전업마다 워크플로를 수정해야 하고, CLI 버전이 그 태그를 모르면 실패한다.
- `--model opus` 별칭을 쓰면 CLI 가 인식하는 최신 Opus 를 자동 추종한다 — 버전업 시 무수정.

## 리뷰어 구성의 트레이드오프

- 단일 opus 리뷰어는 한 에이전트가 타입·컨벤션·보안·아키텍처를 직접 검토한다. 판정이 일관되고 구성이 단순하다.
- 4 병렬 specialist(sonnet/haiku 혼합)는 관점을 나눠 동시에 돌려 속도와 토큰을 아끼지만, 결과를 모으는 orchestration 이 복잡하다.
- **실측 결론 — 단일 opus 가 품질에서 우월하다.** haiku 는 추론 능력이 떨어져 오탐(false positive)이 많고 실제 버그를 놓친다. 다중 에이전트의 관점 분할 이득보다 리뷰 신뢰도 손실이 더 크다.
- 그래서 기본값은 단일 opus 다. 병렬은 리뷰 대상이 너무 커 분할이 불가피하거나, 각 specialist 를 모두 opus 급으로 둘 수 있을 때만 고른다 — specialist 를 토큰 절약 목적으로 haiku 로 낮추면 리뷰 자체가 못 미더워진다.

## 게시 방식

**요약과 인라인을 한 리뷰로 묶어 `pulls/{n}/reviews` POST 를 한 번만 호출한다.**
요약은 `body` 에, 인라인 발견사항은 같은 리뷰의 `comments` 배열에 담는다.

```
POST repos/{owner}/{repo}/pulls/{n}/reviews
  event    = "COMMENT"
  body     = 요약
  comments = 인라인 발견 배열
```

- `event` 는 항상 `"COMMENT"` 로 둔다. `REQUEST_CHANGES` 는 머지를 막아 봇이 사람의 진행을 차단한다.
- **POST 를 두 번 이상 호출하지 않는다고 프롬프트에 못 박는다.** 못 박지 않으면 에이전트가 나눠 올려 다시 흩어진다.
- `gh pr comment` 로 요약을 따로 올리지 않는다. 일반 댓글로 가면 리뷰와 분리되어 Conversation 에 흩어진다.
- 인라인 발견사항이 없으면 `comments` 를 빈 배열로 두고 `body` 만 게시한다.
- 에이전트는 read-only 로 묶는다. Write/Edit 를 비활성화한다.
- 매 실행 전에 이전 게시물을 정리해 중복이 쌓이지 않게 한다. 정리 방식은 아래 절이 정한다.

### 합치면 정리 방식이 강제된다

요약을 리뷰 `body` 로 옮기는 순간 **이전 요약을 지우는 경로가 없어진다.**

| API | 제약 |
| --- | --- |
| `DELETE /pulls/{n}/reviews/{id}` | `PENDING` 리뷰 전용. 제출된 리뷰는 422 |
| dismiss | `APPROVED` 와 `CHANGES_REQUESTED` 에만 된다. `COMMENT` 는 대상이 아니다 |
| GraphQL `minimizeComment` | 된다. `PullRequestReview` 도 `Minimizable` 이다 |

그래서 리뷰 본문은 접는 것만 가능하다. 이것은 합치기의 부수 효과가 아니라 **합치기가 정리 방식의 선택을 강제하는 것**이다.
정리 방식을 삭제로 정해 둔 저장소는 이 지점에서 그 결정을 되짚어야 한다.

**혼합이 실무 답이다.** 리뷰 본문만 접고 일반 댓글과 인라인 댓글은 계속 지운다.

- 접기를 기각하는 흔한 근거는 접힌 블록이 쌓여 PR 스레드가 답답해진다는 것이다.
- 그 근거가 겨누는 것은 인라인까지 접어 실행마다 블록이 여러 개 생기는 형태다.
- 리뷰 본문 하나만 접으면 실행당 한 개다. 누적량이 달라 같은 근거로 기각할 대상이 아니다.

**전부 접는 선택도 있다.** 삭제는 이력이 GitHub event log 에만 남아 나중에 되짚기 번거롭다는 것이 그 근거다.
셋 중 무엇을 고를지는 이력 보존과 스레드 길이 가운데 무엇을 더 치는지에 달렸다.

## read-only 리뷰봇의 인라인 라인 계산

read-only(Read/Grep 차단)는 디스크 사고를 막지만, 인라인 댓글의 라인 번호를 LLM 이 diff 텍스트만으로 계산하게 만든다.
unified diff 의 hunk 헤더 `@@ -a,b +c,d @@` 에서 c 가 RIGHT(NEW) 측 시작 라인이다.
c 부터 추가(`+`)·context 라인을 누적해 라인을 구하되 삭제(`-`) 라인은 세지 않는다.
이 누적 계산은 LLM 이 자주 틀리고, reviews API 는 라인이 hunk 범위 밖이면 422 를 반환한다.

그래서 인라인을 "한 번 시도하고 틀리면 포기" 로 두면 hunk 가 많은 큰 파일에서 사실상 동작하지 않는다.
프롬프트에 다음을 명시해야 인라인 기능이 신뢰성 있게 작동한다.

- 라인 계산법을 직접 적는다(시작점 c, 삭제 라인 제외).
- 라인이 불확실하면 인라인을 포기하고 요약으로 돌린다 — 잘못된 라인에 다는 것보다 낫다.
- 422 는 전체 포기가 아니라 문제된 entry 만 빼고 재구성해 한 번 더 시도한다.
- 403·5xx 까지 포함해, 인라인을 잃더라도 요약은 반드시 남긴다. `comments` 를 통째로 비우고 `body` 만 게시한다.

## 함정 (gotcha)

- action wrapper 가 내부에서 `git add -A` 를 돌리므로, 에이전트가 디스크에 임시파일을 쓰면 그 파일이 PR 브랜치 커밋으로 휩쓸려 들어간다. 어떻게 피하는지는 아래 "요청 본문을 임시 파일로 넘길지" 항목이 소유한다.
- 본문을 명령 인자로 직접 주면 shell 이 `\n` 을 글자 그대로 전달해 줄바꿈이 깨진다. 요약이 리뷰 본문으로 옮겨간 뒤로는 `gh pr comment` 경로 자체를 쓰지 않고 reviews API 의 JSON 으로 넘긴다. 파일이냐 stdin 이냐는 아래 항목이 정한다.
- reply 본문의 `/review` 는 리뷰를 재실행시키고, `@claude` 는 봇 멘션으로 인지되며, `#N` 은 엉뚱한 issue 로 링크된다. 백틱이나 평문으로 감싸 회피한다.
- issue_comment 로 트리거된 run 은 PR 의 Checks 탭에 자동으로 잡히지 않는다. head SHA 에 Check Run 을 수동 생성하면 표시되지만, **Checks API 는 GitHub App 인증 전용**이라 일반 `GITHUB_TOKEN` 으로 `gh api .../check-runs` POST 하면 "You must authenticate via a GitHub App" 403 이 난다. CI 토큰만 쓸 거면 check-run 을 포기하고 reaction(👀 시작, 👍·👎 종료)으로 진행을 표시한다.
- 에이전트가 sanity check 를 무시하고 "test" 같은 더미 댓글을 올리는 사고가 있다. 게시 후 jq 로 길이가 12자 미만이거나 placeholder 이거나 severity 마커가 없는 댓글을 자동 삭제한다.
- **조용한 실패** — `gh ... || true` 로 실패를 완전히 삼키면 인증 오류 등이 job ✓ 뒤에 가려져 디버깅이 막힌다. `|| echo "::warning::..."` 로 Annotations 에 노출하되 부가 작업은 계속하게 한다.
- **엔터프라이즈에서는 `GH_TOKEN` 만으로 부족하다.** `GH_HOST` 와 `GH_ENTERPRISE_TOKEN` 을 함께 줘야 워크플로가 직접 부르는 `gh` 가 인증된다. 주지 않으면 `Must authenticate` 401 이 나는데, 러너에 `gh auth login` 이 되어 있으면 에이전트 쪽 호출은 그것으로 우회돼 성공한다. 그래서 증상이 반만 드러나 원인을 찾기 어렵다.
- **취소 신호가 안 먹어 프로세스가 남는다.** 목록을 파이프로 받아 `while` 루프를 돌리면 서브셸에서 실행되어 run 을 취소해도 살아남는다. 목록을 임시 파일에 받아 현재 셸에서 `while ... done < "$FILE"` 로 돌리고, 개별 호출을 `timeout` 으로 감싸 스스로 끝나게 한다. 러너 CPU 를 계속 점유한 사고가 있었다.
- **token 표기 혼동** — `github.token` = `secrets.GITHUB_TOKEN` (동일 값, 자동 주입). 표기를 바꿔도 인증·권한은 같다. 401/403 은 토큰 표기가 아니라 API·호스트 문제다.
- 모델 태그는 CLI/action 이 아는 값이어야 한다. 고정 태그(`claude-opus-4-7`) 대신 `opus` 별칭을 권장한다(위 "모델 버전 정책").
- **큰 diff 의 false negative** — diff 가 매우 크면 LLM 이 후반부를 누락한 채 "문제 없음" 을 단언할 수 있다. 자동 봇이 통과시켰는데 절반만 읽은 상황이라 신뢰를 가장 크게 무너뜨린다. `gh pr view --json additions,deletions` 로 규모를 판단해, 전수 검토를 못 하면 요약에 "핵심 위주 검토, 전수 아님" 을 명시하게 한다. **수치를 받는 것만으로는 해결되지 않는다.** 실측 일곱 중 다섯이 수치를 수집만 하고 그것으로 무엇을 하라는 지시가 프롬프트에 없다. 수집 명령만 복사하면 이 함정이 그대로 남는다.
- **구체적 체크리스트의 오탐 역효과** — read-only 라 호출부를 못 보는데 "isActive 필터 빠졌나" 같은 구체 항목을 적극 찾게 하면, 상위에서 이미 처리된 것을 🔴 로 단정하는 오탐이 난다. diff 안에서 자족적으로 증명되지 않는 결함은 🔴 대신 🟡 "확인 필요" 로 낮추게 한다. 도메인 특화 체크리스트의 구체성과 오탐은 trade-off 다.
- **빈 배열 API 차단이 자연어 sanity 보다 낫다** — "더미 댓글을 올리지 말라" 는 자연어 점검은 무시된 실측 전력이 있다. "발견 0 개면 reviews API 를 호출하지 말라" 처럼 호출 자체를 막는 편이 효과적이다.

- **게시 뒤 개행을 보정하는 스텝은 판정 기준을 좁혀야 한다.** 본문에 `\n` 두 글자가 보이면 무조건 실제 개행으로 바꾸는 형태가 흔한데, 그러면 `\n` 을 글자 그대로 언급한 정상 리뷰가 망가진다. 본문에 실제 개행이 하나도 없을 때만, 곧 전체가 한 줄로 눌린 경우에만 바꾼다.
- **리뷰 워크플로 파일 자체를 고치는 PR 은 그 PR 에서만 리뷰가 실패한다.** `claude-code-action` 은 워크플로 파일이 기본 브랜치의 것과 같아야 앱 토큰을 내준다. 그래서 그 파일을 고치는 PR 은 `App token exchange failed: 401` 로 떨어진다. 액션이 오류 문구에 "이런 경우는 정상이니 무시하라" 고 적어 둔다. 머지되면 기본 브랜치와 같아져 다음 PR 부터 정상 동작한다. 저장소 다섯 곳에서 동시에 겪었고, 처음에는 우리 변경이 깨뜨린 줄 알고 로그를 파고들었다. self-hosted CLI 방식은 앱 토큰을 쓰지 않아 이 함정이 없다.
- **요약과 인라인을 한 리뷰로 합치면 실패가 원자적이 된다.** `comments[]` 하나가 422 면 `body` 까지 함께 사라진다. 나눠 올릴 때는 인라인만 잃었으므로, 합치기가 만드는 새 실패 방식이다. 게시 성공을 검증하지 않는 워크플로라면 리뷰가 0건인 채로 job 이 성공으로 끝나 조용히 묻힌다. 422 면 문제된 entry 만 빼고 재시도하고, 그래도 실패하면 `comments` 를 비워 요약만 게시하도록 프롬프트에 못 박는다.
- **GraphQL 의 `author.login` 에는 `[bot]` 접미사가 없다.** REST 의 `user.login` 은 `claude[bot]` 으로 내려오는데 GraphQL 은 `claude` 로 내려온다. 실제 PR 로 확인했다. 목록을 GraphQL 로 받으면서 REST 표기로 필터하면 아무것도 걸리지 않아, 정리 스텝이 조용히 아무 일도 하지 않는다. 두 표기를 모두 받는다. 목록은 REST 로 받고 mutation 만 GraphQL 로 쓰면 이 문제가 없다.
- **정리 스텝의 페이지 처리 누락** — REST 의 기본 페이지 크기가 30 이라, 댓글이나 리뷰가 30건을 넘으면 오래된 것이 정리되지 않고 남는다. `--paginate` 와 `per_page=100` 을 함께 쓴다. `--paginate` 만 쓰면 30건씩 여러 번 호출해 느려진다. 이 결함은 눈에 띄지 않는다. 활발한 PR 에서만 드러난다.
- **요청 본문을 임시 파일로 넘길지 stdin 으로 넘길지는 실행 방식이 정한다.** action wrapper 를 쓰면 내부의 `git add -A` 가 임시 파일을 PR 커밋으로 휩쓸어 가므로 `--input -` 에 quoted HEREDOC 으로 stdin 에만 흘린다. self-hosted 러너에서 CLI 를 직접 돌리면 그 wrapper 가 없어 `mktemp` 파일과 `--input` 이 안전하다. 어느 쪽이든 인자로 직접 넘기지 않는 것이 목적이고, 그 목적은 두 방법 모두 달성한다.

## 관련 개념

- [[ai-generated-code-acceptance-criteria]] — 자동 리뷰와 CI가 통과해도 사람이 최종 채택 여부를 판단하는 기준
- [[ai-harness-pattern]] — review-fix 스킬이 이 워크플로우가 단 봇 리뷰를 읽어 코드로 반영한다.
- [[self-improving-harness]] — 리뷰에서 반복되는 지적을 pitfalls 문서에 누적해 다음 리뷰의 부담을 줄인다.

## 추가 (2026-09-01)

저장소 8곳의 실측으로 게시 방식과 정리 방식을 다시 정리했다. 합쳐진 형태가 1곳이고 나머지 7곳이 2회로 나뉜 형태였다.
7곳을 합치는 과정에서 위 「합치면 정리 방식이 강제된다」 와 함정 세 항목이 나왔다.

저장소마다 갈리는 축이 여덟이다. 새 저장소에 포팅할 때 이 축을 먼저 확인한다.

| 축 | 갈리는 값 |
| --- | --- |
| 실행 방식 | self-hosted 러너의 CLI / marketplace action |
| 프롬프트 위치 | 별도 파일 / 워크플로 인라인 |
| 요청 본문 전달 | 임시 파일과 `--input` / stdin |
| 정리 방식의 기존 결정 | 전부 삭제 / 혼합 / 전부 접기 |
| 개행 보정 스텝 | 없음 / 무조건 치환 / 한 줄로 눌린 경우만 치환 |
| 파일 접근 경로 | `Bash` 의 git 명령으로만 / `Bash(gh ...)` 세분 / `Read,Grep,Glob` 도구 허용 |
| 목록 조회 | REST 만 / GraphQL 포함 |
| 봇 로그인 표기 | `claude[bot]` / `github-actions[bot]` / GraphQL 은 접미사 없음 |

## Sources

- [[../../raw/notes/2026-05-28-ai-code-review-github-actions.md]]
- [[../../raw/notes/2026-05-29-claude-code-review-cli-recipe.md]] (self-hosted CLI 방식, 신규 구축 레시피, 함정 보강)
- 2026-09-01 실측: 저장소 8곳의 워크플로를 대조해 게시 방식과 정리 방식을 정리했다. 합쳐진 형태 1곳과 나뉜 형태 7곳이었고 7곳을 합쳤다. 별도 raw 노트 없이 이 페이지가 결과를 담는다.
- 2026-09-02 실측: 저장소 여섯 곳에 합치기를 적용하며 워크플로 파일을 고치는 PR 자체가 `App token exchange failed: 401` 로 실패하는 것을 확인했다. 별도 raw 노트 없이 이 페이지가 결과를 담는다.
- github.com/jon890/nhncloud-cli `.github/workflows/claude-code-review.yml` (2026-06-02: marketplace action 방식으로 prompt 를 `code-review-prompt.txt` 외부 분리, `--model opus` 별칭 적용, 일반 리뷰 우선 개방형 프레이밍 반영)
