# ADR 004: qmd를 내부 HTTP 검색 컨테이너로 분리한다

## 상태

채택

## 맥락

홈서버의 Hermes에는 qmd가 없어 `brain-search`가 INDEX와 `rg` 폴백만 사용한다.
qmd를 Hermes 안에 직접 설치하면 Node.js와 native ABI, 모델 cache, 임베딩 메모리, 컨테이너 재배포 수명이 서로 묶인다.

qmd 2.8.3은 `qmd mcp --http`로 `/health`, `/query`, `/search`, `/mcp`를 제공한다.
HTTP endpoint에는 인증이 없으며 wildcard bind에서는 허용 host를 별도로 제한해야 한다.
홈서버는 GPU가 없고 Hermes는 이미 별도 4GiB·2 CPU 제한으로 운영한다.

## 결정

- Node.js 24.15.0과 qmd 2.8.3을 고정한 `brain-qmd` image를 만든다.
- qmd의 공식 HTTP transport를 사용하고 별도 Node proxy는 만들지 않는다.
- `brain-qmd`와 Hermes만 전용 Docker network에 연결하고 host port, Tunnel, NPM에는 노출하지 않는다.
- public wiki, public raw, private wiki만 qmd에 읽기 전용으로 마운트하고 private raw는 제외한다.
- 설정, SQLite 색인, 임베딩과 모델 cache는 `/home/bifos/.brain-qmd`에 영속화한다.
- Hermes의 `brain-search`는 `BRAIN_QMD_URL`이 있으면 HTTP를 우선하고, 실패하면 로컬 고정 qmd와 INDEX·`rg` 순서로 축소한다.
- 초기 HTTP 검색은 같은 질문의 lex와 vec를 결합하고 `rerank: false`를 사용한다. rerank는 메모리와 검색 벤치마크를 확인한 뒤 별도로 활성화한다.
- Jenkins는 보호 Quartz 배포 성공 뒤 HTTP container를 중지하고 일회성 sync container에서 `update`, `embed`를 실행한다.
- 갱신 전에 SQLite 색인을 백업하며 실패하면 복원하고 HTTP service를 다시 시작한다. qmd 실패는 성공한 Quartz release를 되돌리지 않는다.

## 대안

### Hermes에 qmd 직접 설치

Hermes image와 Node 변경에 qmd ABI가 따라가고 모델 자원이 에이전트 프로세스와 경쟁하므로 제외했다.

### 별도 Node HTTP proxy

현재 필요한 health와 구조화 검색은 qmd가 직접 제공한다.
인증, rate limit, 응답 변환 요구가 생길 때만 얇은 proxy를 추가한다.

### host에 qmd 설치

Hermes가 host 실행 파일을 직접 사용할 수 없고 다른 에이전트가 같은 검색 서비스를 공유하기 어려워 제외했다.

### qmd HTTP를 Cloudflare Access로 게시

private 색인을 외부 요청 경계에 둘 이유가 없고 endpoint 자체 인증도 없어 제외했다.

## 결과

- Hermes와 qmd의 runtime, 메모리, 재시작, 모델 cache 수명이 분리된다.
- 다른 로컬 agent container도 전용 network에 명시적으로 연결하면 같은 검색 endpoint를 재사용할 수 있다.
- HTTP service 중단이나 갱신 중에도 Hermes는 같은 brain mount에서 INDEX와 `rg`로 축소 검색할 수 있다.
- qmd container와 sync container를 동시에 실행하지 않아 모델이 두 번 올라가는 메모리 급증을 피한다.
- Docker network에 참여할 수 있는 container와 영구 색인 경로가 새로운 보안·운영 경계가 된다.
