---
source: https://github.com/jon890/dooray-cli
collected: 2026-06-01
type: github-repo
note: 도구로서의 dooray-cli 분석 (사용·설계 패턴·AI MVP 방법론). 기존 work-style 분석과 별개 각도.
---

# dooray-cli 도구 분석 (2026-06-01)

`@bifos/dooray-cli` — NHN Dooray REST API 를 래핑한 CLI. npm 공개, MIT, 공개 GitHub.
터미널과 AI 에이전트 환경 양쪽에서 Dooray 업무(프로젝트·업무·댓글·위키·메일)를 관리한다.

## 1. 무엇인가

- Dooray REST API 의 얇은 CLI 래퍼. 사람이 터미널에서 쓰고, AI 에이전트가 프로그램적으로 호출하는 두 사용자를 동시에 겨냥.
- dooray-mcp-server 를 CLI 로 포팅하며 시작 — MCP 서버보다 CLI 가 에이전트 하네스에 끼우기 쉬웠다.

## 2. 어떻게 쓰나 (명령 체계)

- 설정: `dooray setup`(대화형 마법사 — endpoint·API key·연결테스트·메일), `dooray config set`, `dooray doctor`(진단).
- 인증: Dooray API 토큰(`https://{tenant}.dooray.com/setting/api/token`). `~/.dooray/config.json`.
- 명령군:
  - `project` — list/members/workflows/groups/tags/templates
  - `post`(업무) — get/list/search/create/edit/done/workflow + comment
  - `mail` — get/reply/send (IMAP 조회 + SMTP 발송)
  - `wiki` — pages/page get·create·edit + comment
  - `cache` — clear (resolve 캐시 갱신)
- 캐시: `~/.dooray/cache/` 에 member·project·wiki·tag·template resolve 결과를 TTL 로 저장.

## 3. 어디에·언제 쓰나

- AI 에이전트가 Dooray 를 자동 조작하는 토대. 실제 소비처:
  - `weekly-report` 스킬 — git 커밋 수집 후 주간보고 댓글 등록.
  - `dooray-comment-reply` 스킬 — 업무 댓글 회신 워크플로우.
  - `grm-registration` 등 — 주간보고 댓글을 근거로 공수 배분.
- 사람은 터미널에서 빠른 업무 조회·생성에 사용.

## 4. 좋은 패턴 — 에이전트 친화 CLI 설계

레이어: `api/ → resolvers/ → commands/ → formatters/`.

- **resolver 입력 자동 분기** — 같은 대상을 여러 형태로 받아 하나의 ID 로 흡수.
  - project: code / 15+자리 numeric id / URL 자동 분기 (ADR-030).
  - member: 15자리 id / 이메일 / 이름 (ADR-021).
  - post: `--id` / `--url` / `code/number` positional / Dooray URL 단일 헬퍼 (ADR-020).
  - 매칭 공통 규칙: 정확일치 → 부분일치 → 모호 시 에러 (ADR-028).
  - 권한 검증은 미리 하지 않고 후속 API 4xx 에 위임.
- **스트림 분리** — 데이터는 stdout, 에러·로그는 stderr. 에이전트가 stdout 만 파싱.
- **구조화 출력 모드** — `--json`(기계 파싱) / `--quiet`(값만) / 기본(사람용 테이블).
- **Dooray deeplink** — 업무 참조를 `dooray://{orgId}/tasks/{postId}` 표준 양식으로 출력해 앱 내 이동 + task 자동 인식.
- **에러 타입** — `DoorayCliError(message, exitCode)` 로 종료코드 일관.
- nhncloud-cli 가 이 설계를 포팅 — 서비스별 인증·엔드포인트·응답봉투를 단일 profile 추상화 뒤로 숨기는 같은 결.

## 5. AI 에이전트로 MVP 만들기 방법론 (guide-mvp-with-ai-agent)

핵심 명제: 에이전트가 동작하는 이유는 코드를 잘 짜서가 아니라 **실행 전에 문서가 충분히 정제돼 있기 때문**이다.

- 하네스 정의: `하네스 = 실행 계획 + 완료 조건 + 컨텍스트 참조`.
  - 실행 계획 — 무엇을 어떤 순서로(Phase 분리).
  - 완료 조건 — 각 Phase 가 언제 끝나나(빌드 성공·CLI 실행 등 기계적 판단).
  - 컨텍스트 참조 — 에이전트가 어떤 문서를 읽고 실행하나.
- 3단계 워크플로우:
  1. 양질의 컨텍스트 — 대화로 기술적 결정을 깊이 쌓는다.
  2. 하네스 엔지니어링 — 문서 기반으로 Phase 분리, 에이전트 자율 구현.
  3. 기능 추가·문서화 — 추가 구현마다 문서를 누적·정제해 판단력을 높이는 루프.
- 각 단계는 이전 산출물에 의존 — 1이 부실하면 2에서 방향을 잃는다.

## Sources (레포 내 문서)

- README.md, docs/code-architecture.md, docs/adr.md, docs/guide-mvp-with-ai-agent.md
