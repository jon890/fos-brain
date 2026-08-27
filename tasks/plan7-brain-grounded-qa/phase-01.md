# Phase 01 근거 질문 BFF와 전용 Hermes 프로필 구성

**Execution profile**: deep

---

## 목표

브라우저에 qmd와 Hermes를 노출하지 않고 public·private wiki 근거만으로 단일 답변을 만드는 `brain-ask` 서비스를 구현한다.
전용 Hermes `brain-api` 프로필을 반복해서 설치·검사할 수 있는 운영 구성을 함께 만든다.

**범위 외**: Memory Atlas의 질문 화면은 Phase 02, 홈서버 프로필 생성과 기존 `career-api` 삭제는 Phase 03에서 수행한다.

---

## 작업 항목 (5)

### 1. 질문 계약과 경로 검증 모듈

`deploy/home-server/brain-ask/brainAsk.mjs`에 다음 경계를 순수 함수와 의존성 주입 함수로 구현한다.

- `validateQuestion(body): string` — JSON 객체의 `question`을 trim하고 1자에서 500자만 허용한다.
- `parseQmdUri(file, roots): { namespace, relativePath, slug, href, absolutePath }` — `brain-wiki`와 `brain-private`만 허용하고 절대 경로, `..`, 심볼릭 링크와 mount 이탈을 거부한다.
- `selectEvidence(results, readFile): Promise<{ context, sources }>` — qmd 순서대로 최대 6개, 문서별 8 KiB, 합계 32 KiB를 읽는다.
- `extractOutputText(response): string` — Hermes Responses API의 완료된 `output_text`만 평문으로 합친다.

출처는 모델 출력이 아니라 qmd 결과에서 `title`, `slug`, `namespace`, `score`, `excerpt`, `href`를 결정적으로 만든다.
private `href`는 `/_private/` 아래, public `href`는 기존 Quartz slug 경로를 사용한다.

### 2. 단일 질문 HTTP 서버

`deploy/home-server/brain-ask/server.mjs`는 Node.js 24의 `http`, `fetch`, `fs`만 사용한다.
`POST /ask`와 `GET /health`만 제공하고 `POST /ask`는 동시에 한 건만 처리한다.
`.agents/plugin/fos-brain/scripts/brain-search-http.cjs`는 기존 CLI를 유지하면서 `queryQmd({ baseUrl, query, collections, limit, rerank, signal })`을 export하도록 작은 경계로 정리한다.
`brain-ask`는 이 함수를 불러 두 collection의 lex·vec 검색 계약을 재사용하되 `brain-raw`를 넣지 않는다.
기존 brain-search CLI 출력과 종료 코드는 바꾸지 않는다.

qmd timeout은 10초, Hermes timeout은 90초다.
검색 결과가 없으면 Hermes를 호출하지 않고 빈 `answer`와 빈 `sources`를 반환한다.
Hermes에는 `model: "brain"`, `store: false`, 질문과 경계표시된 근거, 근거 밖에서 답하지 말라는 instructions만 보내며 `previous_response_id`, `conversation`, tool 입력은 보내지 않는다.
오류는 문서의 `invalid_question`, `busy`, `retrieval_unavailable`, `model_unavailable`, `model_timeout` 계약으로 바꾼다.

로그에는 `requestId`, HTTP 상태, qmd·Hermes 소요 시간, 근거 개수만 남긴다.
질문, 답변, 발췌문, 문서 본문, API key와 사용자 식별자는 출력하지 않는다.

### 3. Container와 같은 출처 라우팅

`deploy/home-server/brain-ask/Dockerfile`은 기존 고정 Node.js 24.15.0 계열 image를 재사용하고 nonroot로 실행한다.
build context는 `${BRAIN_REPO}`로 두어 공용 `brain-search-http.cjs`를 image에 복사하고 추적되는 client 사본을 새로 만들지 않는다.

`deploy/home-server/compose.yaml`에 host port가 없는 `brain-ask`를 추가한다.
public·private wiki와 mode 600 Hermes key 파일은 읽기 전용으로 mount한다.
서비스는 `public-net`, 외부 `brain-search-net`, 외부 `hermes-agent_hermes-net`에만 참여한다.
`deploy/home-server/nginx.conf`는 `/api/brain/ask`를 `brain-ask:8787/ask`로 전달하며 정적 경로와 cache 정책은 유지한다.
요청 body 상한과 읽기·연결 timeout을 API 계약에 맞춰 설정한다.

### 4. 전용 Hermes 프로필 관리 원본

`deploy/home-server/hermes/brain-api-config.yaml`은 API server를 내부 주소와 8644 포트로 실행하고 `model_name: brain`, `max_concurrent_runs: 1`을 설정한다.
API platform과 agent 설정에서 알려진 toolset을 모두 비활성화하고 외부 skill 경로, memory provider, browser 제어와 예약 작업을 넣지 않는다.
`brain-api-SOUL.md`는 제공된 wiki 근거에서만 한국어 평문으로 답하고 근거가 부족하면 모른다고 답하게 한다.

`configure-brain-api.sh`는 `install`, `check`, `remove-career` 하위 명령을 갖는다.
`install`은 blank `brain-api` 프로필을 만들거나 기존 프로필을 같은 설정으로 맞추고, 프로필 `.env`의 기존 모델 provider credential은 값이 없을 때 성공으로 숨기지 않는다.
API key는 인자로 받지 않고 `HERMES_BRAIN_API_KEY_FILE`에서 읽어 profile `.env`와 BFF key 파일을 mode 600으로 원자 교체한다.
`check`는 인증된 `/health/detailed`, `/v1/models`, `/v1/toolsets`, `/v1/skills`, 비저장 `/v1/responses`를 검사하며 활성 도구나 외부 skill이 있으면 실패한다.
`remove-career`는 명시적인 `--confirmed-new-path`가 있을 때만 `hermes profile delete career-api --yes`와 8643 운영 참조 제거를 수행한다.

### 5. 자동 회귀 검사와 운영 문서

Node 검사는 정상 답변, 빈 검색의 Hermes 미호출, 500자 경계, JSON 오류, 동시 요청 429, 두 timeout과 upstream 오류, qmd URI traversal·symlink·collection 거부, 8 KiB·32 KiB 제한, Responses 출력 파싱, 로그 비노출을 검증한다.
배포 shell 검사는 host port 부재, private raw 부재, 세 network, 읽기 전용 mount, secret file, Nginx route와 static 회귀, Hermes 무도구 설정과 `remove-career` 보호 조건을 검사한다.
`deploy/home-server/README.md`와 `.env.example`에 build, secret 생성·회전, health, API smoke, rollback과 폐기 순서를 기록한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `deploy/home-server/brain-ask/brainAsk.mjs` | 신규 |
| `deploy/home-server/brain-ask/server.mjs` | 신규 |
| `deploy/home-server/brain-ask/Dockerfile` | 신규 |
| `deploy/home-server/brain-ask/brainAsk.test.mjs` | 신규 |
| `.agents/plugin/fos-brain/scripts/brain-search-http.cjs` | 재사용 가능한 query 함수 export |
| `.agents/plugin/fos-brain/tests/brain-search-http.test.cjs` | 기존 CLI와 module 회귀 추가 |
| `deploy/home-server/hermes/brain-api-config.yaml` | 신규 |
| `deploy/home-server/hermes/brain-api-SOUL.md` | 신규 |
| `deploy/home-server/hermes/configure-brain-api.sh` | 신규 |
| `deploy/home-server/compose.yaml` | `brain-ask`와 외부 network 추가 |
| `deploy/home-server/nginx.conf` | 질문 API proxy 추가 |
| `deploy/home-server/tests/verify-brain-ask.sh` | 신규 |
| `deploy/home-server/.env.example` | 비밀값 파일 경로 추가 |
| `deploy/home-server/README.md` | 운영 절차 추가 |

## 검증

```bash
# cwd: <worktree>/
bash -n deploy/home-server/hermes/configure-brain-api.sh deploy/home-server/tests/verify-brain-ask.sh
node --test deploy/home-server/brain-ask/brainAsk.test.mjs
node --test .agents/plugin/fos-brain/tests/brain-search-http.test.cjs
python3 /Users/nhn/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/plugin/fos-brain/skills/brain-search
deploy/home-server/tests/verify-brain-ask.sh
deploy/home-server/tests/verify-brain-qmd.sh
deploy/home-server/tests/verify-protected-deploy.sh
git diff --check
```

검사 결과에는 Compose host port, private raw mount, 활성 Hermes toolset, 질문·답변·발췌문과 API key가 없어야 한다.
기존 Quartz 정적 경로와 `brain-qmd` 계약은 같은 회귀 명령에서 계속 통과해야 한다.

## 의도 메모 (왜)

- qmd는 발췌문만 반환하므로 BFF가 검증한 wiki 파일을 제한된 크기로 읽어 답변 근거를 만든다.
- 전용 프로필은 상태 분리일 뿐 파일 sandbox가 아니므로 도구 비활성화를 실행 결과로 검사한다.
- 기존 `career-api`는 새 경로가 동작하기 전까지 rollback 입력으로 남긴다.

## Blocked 조건

- Hermes의 설치된 버전이 toolset 비활성화나 비저장 Responses API를 제공하지 않으면 `PHASE_BLOCKED: Hermes 최소 권한 또는 비저장 계약을 구성할 수 없음`을 출력하고 임의의 강한 권한으로 대체하지 않는다.
