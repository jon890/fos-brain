# Phase 01 근거 질문 BFF와 공개 저장 경계 정리

**Execution profile**: deep

---

## 목표

브라우저에 qmd와 모델 API를 노출하지 않고 public·private wiki 근거만으로 단일 답변을 만드는 `brain-ask` 애플리케이션을 구현한다.
공개 저장소에는 환경에 독립적인 코드와 계약만 남기고 운영 구성은 private 인프라 저장소로 분리한다.

**범위 외**: Memory Atlas 질문 화면은 Phase 02에서 구현한다. 실제 Compose, 프록시, 모델 profile, Jenkins, 호스트 경로와 배포는 private 인프라 계획이 담당한다.

**선행 조건**: private `fos-home-infra`의 `plan1-home-infra-bootstrap` Phase 01이 기존 운영 구성 이관과 정적 검사를 완료해야 한다. 이후 순서는 public Phase 01 → public Phase 02 → private Phase 02 → private Phase 03으로 고정한다.

---

## 작업 항목 (4)

### 1. 질문 계약과 근거 선택

`services/brain-ask/brainAsk.mjs`에 질문 길이 검증, qmd URI 경로 검증, 최대 6개·문서별 8 KiB·합계 32 KiB 근거 선택과 Responses API 평문 추출을 구현한다.
`brain-wiki`와 `brain-private`만 허용하고 절대 경로, `..`, 심볼릭 링크와 root 이탈을 거부한다.
출처의 제목, slug, namespace, score, excerpt와 href는 모델 출력이 아니라 검색 결과에서 결정적으로 만든다.

### 2. 단일 질문 HTTP 서버와 검색 client

`services/brain-ask/server.mjs`는 Node.js 표준 라이브러리만 사용해 `POST /ask`와 `GET /health`를 제공한다.
동시 요청은 한 건으로 제한하고 qmd 10초, 모델 API 90초 timeout을 적용한다.
검색 결과가 없으면 모델을 호출하지 않으며 질문, 답변, 본문과 비밀값은 로그에 남기지 않는다.

`.agents/plugin/fos-brain/scripts/brain-search-http.cjs`는 기존 CLI 동작을 유지하면서 재사용 가능한 `queryQmd`를 export한다.
허용 collection과 qmd 응답 계약을 같은 모듈에서 검증한다.

### 3. 공개 애플리케이션 패키지

`services/brain-ask/Dockerfile`은 build 입력과 runtime 변수 계약만 정의하고 호스트 경로, 실제 주소, network 이름과 secret 경로를 포함하지 않는다.
애플리케이션 단위 검사는 정상·빈 검색, 입력 오류, 동시 요청, timeout, upstream 오류, 경로 이탈, 크기 제한과 로그 비노출을 다룬다.

현재 worktree의 미커밋 파일은 다음처럼 분류한다.

| 현재 파일 | 처리 |
| --- | --- |
| `deploy/home-server/brain-ask/Dockerfile` | 환경별 값 제거 후 `services/brain-ask/Dockerfile`로 이동 |
| `deploy/home-server/brain-ask/brainAsk.mjs` | `services/brain-ask/brainAsk.mjs`로 이동해 재사용 |
| `deploy/home-server/brain-ask/brainAsk.test.mjs` | `services/brain-ask/brainAsk.test.mjs`로 이동해 재사용 |
| `deploy/home-server/brain-ask/server.mjs` | `services/brain-ask/server.mjs`로 이동해 재사용 |
| `.agents/plugin/fos-brain/scripts/brain-search-http.cjs`와 test | public 검색 client 변경으로 유지 |
| `deploy/home-server/.env.example`, `compose.yaml`, `nginx.conf` | private 인프라 Phase 02 입력으로 넘기고 public에서는 제거 |
| `deploy/home-server/hermes/`, `tests/verify-brain-ask.sh` | private 인프라 Phase 02 입력으로 넘기고 public에서는 제거 |

미커밋 구현을 폐기하거나 새로 작성하지 않고, 위 분류대로 이동·이관한 뒤 기존 unit test를 기준으로 동작을 보존한다.

### 4. 공개 저장 경계 정리

기존 `deploy/` 전체와 운영 전용 ADR `002-cloudflare-tunnel-access-boundary`, `003-protected-private-quartz-release`를 공개 현재 트리에서 제거한다.
과거 운영 task `plan2-cloudflare-access-home-server`, `plan3-protected-private-brain`, `plan6-hermes-qmd-search`를 제거한다.
`plan4-memory-constellation`에서는 운영 배포만 다룬 Phase 05를 제거하고 index를 4개 phase로 맞춘다.
운영 회고 `0005`부터 `0013`까지와 해당 INDEX·RUNS 항목을 제거한다.
제품·앱 설계를 다루는 ADR, `plan1`, `plan4` Phase 01부터 04까지, `plan5`, `plan7`, 회고 `0001`부터 `0004`까지와 `0014`는 보존한다.
프로젝트 지침과 제품 문서에는 일반 API·검색 계약과 private 인프라 저장소의 책임 경계만 남긴다.
금지 경로와 운영 식별자가 다시 들어오지 않도록 `scripts/verify-public-infra-boundary.sh`를 추가한다.
정리는 private 저장소에서 해당 운영 구성을 먼저 가져와 정적 검사를 통과한 뒤 수행한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `services/brain-ask/` | 환경에 독립적인 질문 BFF와 검사 추가 |
| `.agents/plugin/fos-brain/scripts/brain-search-http.cjs` | 재사용 가능한 qmd client 경계 추가 |
| `.agents/plugin/fos-brain/tests/brain-search-http.test.cjs` | CLI와 module 회귀 추가 |
| `scripts/verify-public-infra-boundary.sh` | 공개 저장소 운영 정보 유입 방지 |
| `CLAUDE.md`, `docs/` | 공개·private 책임 경계 정리 |
| `deploy/`, 운영 전용 `tasks/`·회고 | 공개 현재 트리에서 제거 |

## 검증

```bash
# cwd: <worktree>/
node --test services/brain-ask/brainAsk.test.mjs
node --test .agents/plugin/fos-brain/tests/brain-search-http.test.cjs
python3 /Users/nhn/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/plugin/fos-brain/skills/brain-search
scripts/verify-public-infra-boundary.sh
git diff --check
```

## Blocked 조건

- private 인프라 저장소에서 기존 운영 파일을 가져오고 정적 검사를 통과하지 못하면 `PHASE_BLOCKED: 운영 구성 이관 검증 실패`로 끝내고 공개 `deploy/`를 제거하지 않는다.
