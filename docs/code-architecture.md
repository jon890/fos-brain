# 코드 아키텍처

## 책임 경계

### 지식 원본과 문서

- `raw/` — public 원본의 변경 불가 저장소다.
- `wiki/` — 에이전트와 Quartz가 함께 읽는 컴파일된 지식이다.
- `private/` — 독립 저장소이며 public 산출물에서 제외한다.
  보호 Quartz 빌드는 컴파일된 `private/wiki/`만 읽고 raw 원본은 원격 산출물에 넣지 않는다.

### 에이전트 검색과 교환

- `.agents/plugin/fos-brain/skills/brain-search/` — 네임스페이스 분리, wiki 우선 검색, 링크 탐색, 근거 작성 절차를 소유한다.
- `.agents/plugin/fos-brain/skills/brain-add/` — 새 문서의 메타데이터 작성과 검색 검증 절차를 소유한다.
- `.agents/plugin/fos-brain/scripts/` — OKF 내보내기와 검색 벤치마크처럼 반복 실행해야 하는 결정적 동작을 소유한다.
- `.agents/plugin/fos-brain/tests/` — 내보내기 계약과 스크립트 회귀를 검증한다.

스킬은 언제 어떤 단계를 실행할지 설명한다.
다섯 줄을 넘는 파싱, 변환, 판정은 스크립트에 둔다.

### 사람용 렌더링

- `quartz/quartz/components/KnowledgeMeta.tsx` — 페이지 frontmatter를 사람이 읽는 설명·신뢰·최신성 표시로 바꾼다.
- `quartz/quartz/plugins/emitters/contentIndex.tsx` — 그래프가 사용할 문서 유형을 콘텐츠 색인에 포함한다.
- `quartz/quartz/components/Graph.tsx` — 유형 범례를 렌더한다.
- `quartz/quartz/components/scripts/graph.inline.ts` — 문서 유형별 노드 색을 선택한다.

표시 컴포넌트는 frontmatter가 일부만 있어도 동작해야 한다.
OKF 내보내기 로직을 Quartz에 넣지 않고 교환 경계를 별도 스크립트로 유지한다.

## 의존성

새 외부 의존성은 추가하지 않는다.
검색은 설치된 qmd를 사용하고, 내보내기 스크립트는 Node.js 표준 라이브러리만 사용한다.
Quartz는 기존 Preact, TypeScript, SCSS, PixiJS를 재사용한다.
qmd 명령은 고정 wrapper만 실행하며, wrapper가 없으면 PATH의 실행 파일을 대신 사용하지 않는다.

내보내기 스크립트는 YAML 객체를 자체 파서로 재구성하지 않는다.
기존 frontmatter 원문을 보존하고 최상위 키의 존재만 감지한 뒤, 누락된 교환 필드를 JSON 호환 YAML 값으로 삽입한다.
기존 `sources`, `generated`, `verified` 구조는 내용 손실 없이 그대로 통과시킨다.
`title`, `description`, `generated` 보완은 concept, topic, entity 문서에만 적용한다.
묶음의 `index.md`와 `log.md`는 예약 문서로 별도 처리한다.
raw Markdown은 내보내기 사본에서만 `type: Reference`를 보완하고 원본 본문을 유지한다.

## 홈서버 배포 경계

- `deploy/home-server/compose.yaml` — public Quartz 정적 서버와 Cloudflare Tunnel 컨테이너를 정의한다.
- `deploy/home-server/build-public.sh` — private 경로를 마운트하지 않고 고정 Node 컨테이너에서 공개 Quartz를 빌드한다.
- `deploy/home-server/build-protected.sh` — public과 private wiki를 별도 release로 빌드하고 검증 뒤 `current`를 원자적으로 전환한다.
- `deploy/home-server/sync-protected.sh` — 두 저장소의 fast-forward 갱신, 중복 실행 잠금, 보호 빌드를 소유한다.
- `deploy/home-server/nginx.conf` — Quartz의 확장자 없는 경로와 정적 자원 응답을 소유한다.
- `deploy/home-server/.env.example` — 저장소에 넣을 수 있는 변수 이름만 설명하며 Tunnel token은 포함하지 않는다.
- `/home/bifos/apps/fos-brain-deploy` — 검증한 배포 스크립트와 Jenkins 작업 정의를 webhook 활성화 전에 설치하는 운영 경로다.
- Cloudflare — DNS 레코드, Tunnel 공개 호스트 이름, Access 애플리케이션과 정책, DNSSEC를 소유한다.
- Nginx Proxy Manager — 호스트 기반 내부 라우팅과 `brain` 정적 서버 프록시를 소유한다.
- Jenkins Generic Webhook Trigger — GitHub webhook HMAC 검증, 허용 저장소와 `main` branch 선택, `sync-brain` 실행을 소유한다.

Tunnel은 기존 `public-net`에만 참여하고 공개 호스트 이름 8개를 NPM의 `https://fos-npm:443` 원본으로 연결한다.
호스트별 `originServerName`과 `httpHostHeader`를 원래 도메인으로 유지해 NPM 인증서와 가상 호스트를 함께 검증한다.
`brain`은 NPM에서 관리하는 호스트 이름 일치 인증서를 사용하며 인증서 검증을 끄지 않는다.
이 경계는 Cloudflare 방문자 요청의 HTTPS 상태를 NPM까지 유지해 Force SSL 리다이렉트 반복을 막는다.

public 검증 빌드는 `quartz/public`에 남고 private 경로를 보거나 복사하지 않는다.
보호 빌드는 gitignore된 `quartz-protected/releases/`에 public·private wiki만 만들고 `quartz-protected/current`로 활성 release를 가리킨다.
빌드 컨테이너에는 release 상위 디렉터리를 마운트하고 Quartz output은 그 아래 staging 경로로 지정해 빌더의 초기화 동작을 허용한다.
정적 서버는 `quartz-protected/` 상위 디렉터리만 읽기 전용으로 마운트해 `current` 전환을 재시작 없이 읽는다.
보호 Nginx는 HTML과 검색 색인에 private cache 정책과 검색 엔진 차단 헤더를 적용한다.
Cloudflare와 Jenkins의 비밀값은 git에 기록하지 않는다.
Jenkins는 저장소 checkout 안의 실행 중 변경에 의존하지 않고 운영 경로에 설치한 검증본을 호출한다.

NPM의 공인 80·81·443 포트는 전환 검증 전까지 유지한다.
전환 뒤에는 세 포트를 모두 loopback 바인딩으로 바꾸되 `public-net`의 컨테이너 포트는 유지해 Tunnel과 SSH 복구 경로를 보존한다.
Cloudflare DNSSEC와 등록기관 DS는 재귀 확인자가 인증된 응답을 만들 수 있는 하나의 검증 사슬로 관리한다.

## 검증 경계

- 검색 벤치마크 — 대표 질문마다 기대 slug의 상위 순위를 검사한다.
- OKF 내보내기 — 임시 fixture를 내보내고 메타데이터, raw Reference, 예약 문서, 링크, private 제외를 검사한다.
- Quartz — SCSS를 불러오지 않는 순수 메타데이터 helper의 단위 검사, TypeScript 검사, 공개 정적 빌드를 실행한다.
- 스킬 — `quick_validate.py`로 수정한 skill 폴더를 검사한다.
- 배포 — Compose 구문, public-only 회귀, 보호 wiki 병합, 원자적 release 전환, 컨테이너 상태와 NPM 내부 연결을 검사한다.
- 보안 — 공개·보호·웹훅 요청을 각각 검사하고 공인 80·81·443 차단, SSH 10022 유지, DNSSEC 인증 응답을 확인한다.
