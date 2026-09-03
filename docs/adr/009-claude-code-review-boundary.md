# ADR-009: Claude 코드 리뷰는 GitHub Actions의 읽기 전용 단일 리뷰로 실행한다

- 상태: 채택
- 날짜: 2026-09-03

## 맥락

fos-brain은 TypeScript 화면, shell script, 플러그인과 공개 지식 문서를 함께 관리한다.
변경 영역이 넓어지면 일반 코드 품질뿐 아니라 public과 private 경계, Quartz SPA 생명주기와 지식 구조 계약을 함께 검토해야 한다.

개인 저장소의 기존 Claude 리뷰는 GitHub App과 Check Run, 일반 댓글과 인라인 댓글을 따로 관리했다.
이 구성은 리뷰 자체보다 인증과 댓글 정리 절차가 커졌고, GitHub 기본 토큰으로 만들 수 없는 Check Run 때문에 실패 경로도 늘었다.

## 결정

- `pull_request`가 열릴 때 자동으로 실행하고 정확히 `/review`인 PR 댓글로 수동 재실행한다.
- fork에서 연 PR은 자동 리뷰하지 않는다.
  저장소 쓰기 권한이 있는 사용자가 `/review`를 남겼을 때만 수동 실행한다.
- GitHub-hosted runner에서 `anthropics/claude-code-action`의 고정 patch 버전을 사용한다.
- GitHub 인증은 workflow의 `GITHUB_TOKEN`을 action에 직접 넘긴다.
  별도 GitHub App, OIDC 권한과 Check Run을 만들지 않는다.
- Claude 인증은 개인 구독에서 만든 `CLAUDE_CODE_OAUTH_TOKEN` repository secret으로만 주입한다.
- 단일 Opus 리뷰어가 일반 리뷰 뒤에 fos-brain 특화 계약을 확인한다.
  여러 저가 모델에 관점을 나누지 않는다.
- 파일은 읽을 수 있지만 변경할 수 없게 `Write`, `Edit`와 하위 에이전트를 차단한다.
- 요약과 인라인 지적은 `COMMENT` review 하나로 게시한다.
  봇이 `REQUEST_CHANGES`로 머지를 자동 차단하지 않는다.
- 재실행 전 이전 review body는 접고 이전 인라인 댓글은 삭제한다.
  정리 대상은 workflow가 만든 표식을 가진 댓글로 제한한다.
- 15분 timeout과 PR별 concurrency를 적용한다.

## 검토한 대안

- 홈서버 self-hosted runner에서 Claude CLI를 직접 실행하면 인증과 prompt를 완전히 제어할 수 있다.
  다만 개인 서버 가용성이 public 저장소 리뷰의 전제가 되고 운영 구성이 이 저장소로 들어오므로 채택하지 않았다.
- Claude GitHub App은 공식 기본 경로지만 이 workflow는 코드 변경이 아니라 review 작성만 필요하다.
  `GITHUB_TOKEN`으로 필요한 권한을 제한할 수 있어 별도 App과 OIDC 설정을 추가하지 않았다.
- 여러 specialist를 병렬로 실행하면 관점을 나눌 수 있다.
  리뷰 일관성과 오탐 억제를 우선해 단일 Opus 리뷰어를 선택했다.
- 요약을 일반 PR 댓글로 따로 게시하면 인라인 지적과 읽는 위치가 갈린다.
  리뷰 한 건에서 전체 판단과 근거를 보도록 합쳤다.

## 운영 조건

- 기본 브랜치에 workflow가 있어야 `issue_comment` 이벤트를 처리할 수 있다.
- repository secret이 없으면 workflow를 실행하지 못한다.
- workflow 자체를 추가하는 bootstrap PR은 기존 자동 리뷰 대상이 아니다.
  머지한 뒤 기존 PR에 `/review`를 남겨 첫 실행을 확인한다.

## 근거

- [Claude Code Action 설정](https://github.com/anthropics/claude-code-action/blob/main/docs/setup.md)
- [Claude Code Action 보안](https://github.com/anthropics/claude-code-action/blob/main/docs/security.md)
- [GitHub Actions AI 코드 리뷰 워크플로우 패턴](../../wiki/concepts/ai-code-review-github-actions.md)
