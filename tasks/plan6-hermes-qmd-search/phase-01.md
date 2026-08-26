# Phase 01 brain-qmd HTTP 서비스와 검색 client

**Execution profile**: deep

---

## 목표

qmd의 공식 HTTP transport를 내부 전용 container로 실행하고 `brain-search`가 HTTP, 로컬 qmd, 본문 검색 순서로 축소 동작하게 한다.

**범위 외**: 홈서버 운영 파일 설치, container 기동, 초기 모델 다운로드, Jenkins 작업 교체는 Phase 02에서 수행한다.

---

## 작업 항목 (4)

### 1. 고정 brain-qmd image와 실행 mode

`deploy/home-server/brain-qmd/Dockerfile`은 digest로 고정한 Node.js 24.15.0 image에 `@tobilu/qmd` 2.8.3을 정확한 버전으로 설치하고 UID와 GID 1000으로 실행한다.
`entrypoint.sh`는 `serve`, `sync`, `status` mode만 허용한다.
세 mode 모두 `brain-wiki=/brain/public/wiki`, `brain-raw=/brain/public/raw`, `brain-private=/brain/private/wiki` 경로와 mask를 검증하며 다른 collection이나 경로 불일치를 성공으로 숨기지 않는다.
`serve`는 `qmd mcp --http --host 0.0.0.0 --port 8181`, `sync`는 `qmd update`와 collection별 저메모리 `qmd embed`, `status`는 version·collection·index 상태를 실행한다.

### 2. Compose와 갱신 복구 경계

`deploy/home-server/brain-qmd/compose.yaml`은 `/home/bifos/.brain-qmd:/data`만 쓰기 가능하게 하고 public wiki, public raw, private wiki는 읽기 전용으로 마운트한다.
host `ports` 없이 전용 `brain-search-net`만 사용하고 `QMD_ALLOWED_HOSTS=brain-qmd,brain-qmd:8181,localhost,localhost:8181,127.0.0.1,127.0.0.1:8181`을 설정한다.
healthcheck는 `GET /health`의 200 응답을 검사한다.
`hermes-brain-qmd.override.yaml`은 Hermes를 같은 network에 연결하고 `BRAIN_QMD_URL=http://brain-qmd:8181`만 추가한다.

`sync-qmd.sh`는 host에서 전용 lock을 잡고 현재 HTTP container를 중지한다.
중지된 SQLite 색인을 백업한 뒤 compose의 일회성 `sync` mode를 실행하고, 성공과 실패 경로 모두에서 HTTP container를 다시 시작해 health를 기다린다.
실패하면 직전 SQLite 색인을 복원하고 nonzero로 끝낸다.

### 3. brain-search HTTP client와 스킬 계약

skill-creator 절차로 `.agents/plugin/fos-brain/scripts/brain-search-http.cjs`와 검사를 만든다.
client는 `BRAIN_QMD_URL`, 질문, 허용 collection 배열, 1에서 20 사이 limit을 받아 공식 `POST /query`에 같은 질문의 `{ "type": "lex", "query": "..." }`, `{ "type": "vec", "query": "..." }`, 복수형 `collections`, `rerank: false`를 보낸다.
응답의 `qmd://<collection>/<path>`가 요청한 허용 collection 안인지 검증하고 JSON만 출력한다.

`brain-search/SKILL.md`는 HTTP URL이 있으면 client를 먼저 사용하고, 실패하면 `~/.local/bin-pinned/qmd`, INDEX와 `rg` 순서로 검색하게 한다.
회사 지식 라우팅과 public·private 출처 표시는 바꾸지 않는다.
두 plugin manifest와 marketplace의 버전을 `0.2.1`로 맞춘다.
검증 후 Codex와 Claude Code plugin cache를 worktree 소스로 갱신하고 marketplace source를 원래 main 경로로 복원하며, source와 두 cache의 HTTP client hash가 같은지 확인한다.

### 4. 회귀 검사와 운영 문서

container 구성 검사는 host port 부재, private raw mount 부재, 읽기 전용 source, 전용 network, 허용 host, 비root user, healthcheck를 확인한다.
HTTP client 검사는 정상 결과, timeout, non-2xx, 잘못된 JSON, 허용하지 않은 collection, 단수형 `collection` 미사용, 질문 JSON escaping을 확인한다.
sync 검사는 HTTP container 중지·재시작, 성공 경로, SQLite 복원 경로, health timeout과 private 내용 비출력을 가짜 Docker 명령으로 검증한다.
`deploy/home-server/README.md`에 build, serve, health, query, sync, rollback, 제거 범위를 기록한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `deploy/home-server/brain-qmd/Dockerfile` | 신규 |
| `deploy/home-server/brain-qmd/entrypoint.sh` | 신규 |
| `deploy/home-server/brain-qmd/compose.yaml` | 신규 |
| `deploy/home-server/hermes-brain-qmd.override.yaml` | 신규 |
| `deploy/home-server/sync-qmd.sh` | 신규 |
| `deploy/home-server/jenkins/sync-brain-job.xml` | 수정 |
| `deploy/home-server/tests/verify-brain-qmd.sh` | 신규 |
| `.agents/plugin/fos-brain/scripts/brain-search-http.cjs` | 신규 |
| `.agents/plugin/fos-brain/tests/brain-search-http.test.cjs` | 신규 |
| `.agents/plugin/fos-brain/skills/brain-search/SKILL.md` | 수정 |
| `.agents/plugin/fos-brain/plugin.json` | 버전 수정 |
| `.agents/plugin/fos-brain/.claude-plugin/plugin.json` | 버전 수정 |
| `.agents/plugin/fos-brain/.claude-plugin/marketplace.json` | 버전 수정 |
| `CLAUDE.md` | 홈서버 HTTP 검색 경계 추가 |
| `deploy/home-server/README.md` | 신규 |

## 검증

```bash
# cwd: <worktree>/
bash -n deploy/home-server/brain-qmd/entrypoint.sh deploy/home-server/sync-qmd.sh deploy/home-server/tests/verify-brain-qmd.sh
node --test .agents/plugin/fos-brain/tests/brain-search-http.test.cjs
python3 /Users/nhn/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/plugin/fos-brain/skills/brain-search
deploy/home-server/tests/verify-brain-qmd.sh
deploy/home-server/tests/verify-protected-deploy.sh
git diff --check
```

Docker Compose 출력에는 `ports`가 없어야 하고 private raw 경로가 없어야 한다.
Jenkins XML에는 `sync-brain` 성공 뒤 `sync-brain-qmd`를 호출하는 `UNSTABLE` 후속 단계가 있어야 한다.
client와 Jenkins 로그에는 private 문서 본문이나 검색 결과를 출력하지 않아야 한다.

## 의도 메모 (왜)

- qmd가 공식 HTTP endpoint를 제공하므로 별도 proxy를 만들지 않고 runtime과 모델 자원만 Hermes에서 분리한다.
- HTTP 검색이 실패해도 기존 로컬 qmd와 본문 검색 경로를 유지해 단일 서비스 장애가 agent 검색 중단으로 번지지 않게 한다.
- sync 중 server와 embed process를 겹치지 않아 모델 메모리가 두 번 올라가는 조건을 피한다.
