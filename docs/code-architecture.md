# 코드 아키텍처

## 책임 경계

### 지식 원본과 문서

- `raw/` — public 원본의 변경 불가 저장소다.
- `wiki/` — 에이전트와 Quartz가 함께 읽는 컴파일된 지식이다.
- `private/` — 독립 저장소이며 public 산출물에서 제외한다.
  보호 Quartz 빌드는 컴파일된 `private/wiki/`만 읽고 raw 원본은 원격 산출물에 넣지 않는다.

### 에이전트 검색과 교환

- `.agents/plugin/fos-brain/references/knowledge-admission-policy.md` — 저장할 개인 지식과 다른 시스템으로 보낼 정보를 구분하는 단일 정책이다.
- `.agents/plugin/fos-brain/skills/brain-search/` — 네임스페이스 분리, wiki 우선 검색, 링크 탐색, 근거 작성 절차를 소유한다.
- `.agents/plugin/fos-brain/skills/brain-add/` — 정책 판정, 새 문서의 메타데이터 작성, 검색 검증 절차를 소유한다.
- `.agents/plugin/fos-brain/skills/brain-curate/` — 여러 세션에서 후보를 찾되 같은 정책으로 저장 가치와 목적지를 판정한다.
- `.agents/plugin/fos-brain/skills/brain-lint/` — 기존 문서가 정책에 맞는지 품질 점검에서 분류한다.
- `.agents/plugin/fos-brain/scripts/` — OKF 내보내기, 검색 벤치마크, 격리된 지식 유입 행동 평가처럼 반복 실행해야 하는 동작을 소유한다.
- `.agents/plugin/fos-brain/tests/` — 지식 유입 정책, 행동 평가의 원문과 채점 근거, 내보내기 계약, 스크립트 회귀를 검증한다.

스킬은 언제 어떤 단계를 실행할지 설명한다.
다섯 줄을 넘는 파싱, 변환, 판정은 스크립트에 둔다.
의미 적합성은 에이전트와 사용자가 판단하고, 스크립트는 판정 기록의 필드와 허용값만 검사한다.
행동 평가는 기준 commit과 현재 commit을 임시 복사본에서 읽기 전용으로 실행한다.
평가 원문, 별도 채점, 전후 파일 hash, 결과 JSON을 함께 보존해 결과만 임의로 작성하는 검사를 막는다.

### 사람용 렌더링

- `quartz/quartz/components/KnowledgeMeta.tsx` — 페이지 frontmatter를 사람이 읽는 설명·신뢰·최신성 표시로 바꾼다.
- `quartz/quartz/plugins/emitters/contentIndex.tsx` — 그래프가 사용할 문서 유형, 설명, 상태, 최신성, 수정일을 콘텐츠 색인에 포함한다.
- `quartz/quartz/components/Graph.tsx` — 유형 범례를 렌더한다.
- `quartz/quartz/components/scripts/graph.inline.ts` — 문서 유형별 노드 색을 선택한다.
- `quartz/quartz/components/MemoryAtlas.tsx` — 홈의 검색, 필터, 표시 설정, 상세 패널에 필요한 HTML 구조를 소유한다.
- `quartz/quartz/components/memoryAtlasData.ts` — 콘텐츠 색인을 그래프 노드와 연결, 집계, 필터 결과로 바꾸는 순수 함수를 소유한다.
- `quartz/quartz/components/scripts/memoryAtlas.inline.ts` — 홈을 감지하고 별도 3D 모듈을 요청하며 사용자 입력과 SPA 정리를 소유한다.
- `quartz/quartz/components/scripts/memoryAtlasRuntime.ts` — Three.js 렌더러와 카메라, 3D 배치, 선택 경로 강조를 소유한다.
- `quartz/quartz/components/styles/memoryAtlas.scss` — 홈 전용 전체 화면 배치와 Memory Atlas 시각 정체성, 반응형 상태를 소유한다.
- `quartz/quartz/plugins/emitters/memoryAtlasAssets.ts` — 3D runtime과 의존성을 별도 ESM 정적 파일로 묶어 내보낸다.

표시 컴포넌트는 frontmatter가 일부만 있어도 동작해야 한다.
OKF 내보내기 로직을 Quartz에 넣지 않고 교환 경계를 별도 스크립트로 유지한다.
Memory Atlas는 루트 `INDEX` 문서에서만 기존 페이지 그리드를 대체하며, 일반 문서 레이아웃과 로컬 PixiJS 그래프를 변경하지 않는다.

### Brain 근거 질문

- `services/brain-ask/server.mjs` — 질문 검증, 동시 실행 제한, qmd 검색, wiki 본문 읽기, 모델 호출과 응답 변환을 소유한다.
- `services/brain-ask/Dockerfile` — Node.js 24 실행 환경과 공용 qmd HTTP client를 묶는다.
- `.agents/plugin/fos-brain/scripts/brain-search-http.cjs` — 기존 qmd 요청·응답 계약을 서버에서도 재사용한다.
- `quartz/quartz/components/MemoryAtlas.tsx` — 질문 버튼, 패널과 접근 가능한 상태 문구를 렌더한다.
- `quartz/quartz/components/scripts/memoryAtlas.inline.ts` — 단일 요청 상태와 닫기·취소·출처 이동을 소유한다.
- `quartz/quartz/components/scripts/memoryAtlasRuntime.ts` — 질문 출처 노드의 일시 강조를 적용하고 제거한다.
- `quartz/quartz/components/styles/memoryAtlas.scss` — 데스크톱 하단 패널과 모바일 아래 시트의 경계를 소유한다.

`brain-ask`는 공개 인터넷에 직접 연결하지 않는 같은 출처 중계 계층이다.
브라우저 인증은 외부 인증 계층에 맡기고, 이 계층은 모델 key 은닉, 입력 제한, 근거 경로 검증과 응답 형태 고정을 담당한다.
질문 한 건은 `brain-ask` 안의 메모리 잠금 하나를 사용하며 서버 재시작 뒤 복원할 상태는 없다.

## 의존성

로컬 검색은 설치된 qmd를 사용하고 원격 실행 환경은 qmd HTTP transport를 사용할 수 있다.
Quartz는 기존 Preact, TypeScript, SCSS, PixiJS를 재사용한다.
문서별 로컬 그래프는 기존 D3와 PixiJS를 계속 사용한다.
홈의 실제 3D 회전과 카메라 제어에만 `3d-force-graph`와 `three`를 사용하고, 홈 진입 시 동적으로 불러와 일반 문서의 초기 실행 비용과 브라우저 전역 접근을 격리한다.
Quartz의 공용 `postscript.js`에는 가벼운 loader만 포함하고 3D 의존성은 `/static/memory-atlas.js`에 별도로 내보낸다.
3D canvas는 유일한 탐색 수단이 아니며 검색, 필터, 선택 상세, 결과 목록은 실제 HTML 요소로 유지한다.
로컬 qmd 명령은 고정 wrapper만 실행하며, wrapper가 없으면 PATH의 실행 파일을 대신 사용하지 않는다.
검색 transport가 설정되면 `/query`를 우선하고 HTTP가 실패하면 로컬 검색 경계로 돌아간다.

질문 API는 Node.js 24의 `http`, `fetch`, `fs`만 사용한다.
별도 웹 프레임워크, 데이터베이스, 큐와 외부 벡터 저장소를 추가하지 않는다.
`brain-ask`는 qmd 결과의 URI를 직접 신뢰하지 않고 허용 collection과 mount 경계를 검사한 뒤 wiki 본문을 읽는다.
모델 API에는 `store: false`와 `brain` 모델 별칭을 전달하며 이전 응답 식별자나 대화 식별자를 보내지 않는다.

내보내기 스크립트는 YAML 객체를 자체 파서로 재구성하지 않는다.
기존 frontmatter 원문을 보존하고 최상위 키의 존재만 감지한 뒤, 누락된 교환 필드를 JSON 호환 YAML 값으로 삽입한다.
기존 `sources`, `generated`, `verified` 구조는 내용 손실 없이 그대로 통과시킨다.
`title`, `description`, `generated` 보완은 concept, topic, entity 문서에만 적용한다.
묶음의 `index.md`와 `log.md`는 예약 문서로 별도 처리한다.
raw Markdown은 내보내기 사본에서만 `type: Reference`를 보완하고 원본 본문을 유지한다.

## 운영 구성 저장 경계

- `services/brain-ask/`는 환경에 독립적인 질문 BFF 소스와 unit test를 소유한다.
- public 저장소는 Compose, reverse proxy, Jenkins, Hermes profile과 호스트 경로를 소유하지 않는다.
- private 인프라 저장소는 public 저장소의 검증된 commit을 입력으로 build와 배포를 수행한다.
- `.agents/plugin/fos-brain/scripts/brain-search-http.cjs`는 public qmd HTTP client 계약을 계속 소유한다.

## 검증 경계

- 지식 유입 정책 — 대표 후보 fixture가 기대 목적지와 판정값을 가지며 모든 쓰기 스킬이 단일 정책을 참조하는지 검사한다.
- 검색 벤치마크 — 대표 질문마다 기대 slug의 상위 순위를 검사한다.
- OKF 내보내기 — 임시 fixture를 내보내고 메타데이터, raw Reference, 예약 문서, 링크, private 제외를 검사한다.
- Quartz — SCSS를 불러오지 않는 순수 메타데이터 helper의 단위 검사, TypeScript 검사, 공개 정적 빌드를 실행한다.
- Memory Atlas — 색인 정규화와 필터·집계 순수 함수 단위 검사, 데스크톱과 390px 화면의 실제 렌더, 검색·필터·배치·노드 선택·오류 폴백을 검증한다.
- Brain 질문 — 입력 제한, 동시 요청, qmd URI 경계, 근거 크기, 빈 결과의 모델 API 미호출, 모델 오류 변환과 로그 비노출을 단위·통합 검사한다.
- Brain 질문 UI — 질문 상태, 답변 평문 렌더, 출처 이동, 그래프 강조 해제, 1440px와 390px의 넘침을 브라우저에서 검사한다.
- 스킬 — `quick_validate.py`로 수정한 skill 폴더를 검사한다.
