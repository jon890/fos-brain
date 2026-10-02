# 코드 아키텍처

## 책임 경계

### 지식 원본과 문서

- `raw/` — public 원본의 변경 불가 저장소다.
- `wiki/` — 에이전트와 Quartz가 함께 읽는 컴파일된 지식이다.
- `private/` — 독립 저장소이며 public 산출물에서 제외한다.
  private 포함 Quartz 빌드는 컴파일된 `private/wiki/`만 읽고 raw 원본은 원격 산출물에 넣지 않는다.

### 에이전트 검색과 교환

brain 스킬 다섯 개와 `fos-brain` 플러그인(지식 유입 정책, 스크립트, 테스트)은 저장소 deprecated 처리와 함께 제거했다.

### 사람용 렌더링

- `quartz/custom/components/KnowledgeMeta.tsx` — 페이지 frontmatter를 사람이 읽는 설명·신뢰·최신성 표시로 바꾼다.
- `quartz/custom/emitters/memoryAtlasIndex.ts` — 그래프가 사용할 문서 유형, 문서 성격(`role`), 설명, 상태, 최신성, 수정일과 출처 개수를 담은 `/static/memory-atlas-index.json`을 내보낸다. 업스트림 `contentIndex`는 고치지 않는다.
- `quartz/custom/components/memoryAtlasIndexSchema.ts` — 색인의 스키마 표식과 그 검사기를 소유한다. 표식이 없는 옛 색인이 들어오면 그 자리에서 오류를 던진다.
- `quartz/custom/components/MemoryAtlasDocNav.tsx` — 홈이 아닌 모든 페이지 상단에 항해도로 돌아가는 요소를 렌더한다. `sharedPageComponents.header`에 등록해 본문, 목록, 404 페이지가 모두 받는다.
- `quartz/custom/components/MemoryAtlas.tsx` — 홈의 검색, 필터, 표시 설정, 상세 패널에 필요한 HTML 구조를 소유한다.
- `quartz/custom/components/memoryAtlasData.ts` — 콘텐츠 색인을 그래프 노드와 연결, 집계, 필터 결과로 바꾸는 순수 함수를 소유한다. `role`이 `navigation`인 문서를 이 계산에서 뺀다.
- `quartz/custom/components/memoryAtlasSemantics.ts` — 의미 관계 임시 산출물의 형식 검증과 현재 빌드 slug 제한을 소유한다.
- `quartz/custom/components/memoryAtlasGraph.ts` — 혼합 관계 점수, 결정적 전체 배치, hop depth, 지역 배치와 자동 시작점 계산을 DOM 없이 소유한다.
- `quartz/custom/components/scripts/memoryAtlas.inline.ts` — SPA `nav` event에서 controller 초기화만 호출하는 진입점을 소유한다.
- `quartz/custom/components/scripts/memoryAtlasController.ts` — 브라우저 상태, 사용자 event, 파생 데이터 계산과 2D·3D renderer 생명 주기를 조정한다.
- `quartz/custom/components/scripts/memoryAtlasRuntimeTypes.ts` — 2D와 3D renderer가 함께 구현하는 생성·갱신·제거 계약을 소유한다.
- `quartz/custom/components/scripts/memoryAtlas2dRuntime.ts` — SVG 연결선, HTML 노드, 전체 지도와 선택 중심 지역 관계 렌더링과 지도의 이동·배율 상태를 소유한다.
- `quartz/custom/components/scripts/memoryAtlas3dRuntime.ts` — Three.js renderer와 카메라, 3D 배치와 선택 경로 강조를 소유한다.
- `quartz/custom/components/styles/memoryAtlas.scss` — 홈 전용 전체 화면 배치와 Memory Atlas 시각 정체성, 반응형 상태를 소유한다.
- `quartz/custom/emitters/memoryAtlasAssets.ts` — 2D와 3D runtime을 별도 ESM 파일로 묶고 현재 콘텐츠로 정제한 의미 관계 파일을 내보낸다.
- `quartz/scripts/generate-memory-atlas-semantics.mjs` — qmd HTTP vector 검색을 slug 관계 임시 산출물로 바꾸며 실패 시 오래된 산출물을 제거한다.

화면의 작은 SSR 조각은 `quartz/custom/components/memoryAtlasView.tsx`가 소유한다.
브라우저 controller와 2D·3D runtime은 위 경계를 유지하며 `memoryAtlas.inline.ts`에 상태나 renderer 책임을 다시 넣지 않는다.


표시 컴포넌트는 frontmatter가 일부만 있어도 동작해야 한다.
OKF 내보내기 로직을 Quartz에 넣지 않고 교환 경계를 별도 스크립트로 유지한다.
Memory Atlas는 루트 `INDEX` 문서에서만 기존 페이지 그리드를 대체하며, 일반 문서 레이아웃과 로컬 PixiJS 그래프를 변경하지 않는다.

Preact는 서버가 렌더할 HTML 구조와 작은 표시 컴포넌트 조합을 담당한다.
Quartz의 기존 SPA와 서버 렌더 대체 목록을 유지하기 위해 별도 client hydration 계층은 추가하지 않는다.
브라우저 controller는 `mode`, `selectedSlug`, 검색과 filter처럼 사용자가 바꾸는 값만 저장한다.
선택 노드 객체, hop depth, 강조 집합, 배치와 시작점은 순수 함수에서 매번 계산하고 중복 상태로 보관하지 않는다.
사용자 동작은 event handler가 처리하며 렌더러, browser event와 animation frame 같은 외부 자원은 명시적인 `destroy` 경계에서 정리한다.

### Brain 근거 질문

- `quartz/custom/components/MemoryAtlas.tsx` — 질문 버튼, 패널과 접근 가능한 상태 문구를 렌더한다.
- `quartz/custom/components/scripts/memoryAtlasController.ts` — 단일 요청 상태, 닫기·취소·출처 이동과 질문 출처 강조의 생명 주기를 소유한다.
- `quartz/custom/components/scripts/memoryAtlas2dRuntime.ts`와 `memoryAtlas3dRuntime.ts` — controller가 전달한 출처 slug의 일시 강조를 각 renderer에 적용하고 제거한다.
- `quartz/custom/components/styles/memoryAtlas.scss` — 데스크톱 하단 패널과 모바일 아래 시트의 경계를 소유한다.

질문, 로그인과 관리자 콘텐츠 API를 제공하던 NestJS BFF `services/brain-ask`는 배포를 폐기한 뒤 저장소에서도 제거했다.
위 화면 코드는 남아 있지만 응답할 서버가 없어 질문과 관리자 로그인은 동작하지 않는다.

## 의존성

로컬 검색은 설치된 qmd를 사용하고 원격 실행 환경은 qmd HTTP transport를 사용할 수 있다.
Quartz는 기존 Preact, TypeScript, SCSS, D3와 PixiJS를 재사용한다.
문서별 로컬 그래프는 기존 D3와 PixiJS를 계속 사용한다.
홈의 2D 관계 배치는 D3 force 계산만 사용하고 노드는 접근 가능한 HTML 버튼으로 렌더한다.
실제 3D 회전과 카메라 제어에만 `3d-force-graph`와 `three`를 사용한다.
Quartz의 공용 `postscript.js`에는 가벼운 loader만 포함하고 2D와 3D 의존성을 별도 runtime으로 내보내 선택한 모드만 불러온다.
3D canvas는 유일한 탐색 수단이 아니며 검색, 필터, 선택 상세, 결과 목록은 실제 HTML 요소로 유지한다.
로컬 qmd 명령은 고정 wrapper만 실행하며, wrapper가 없으면 PATH의 실행 파일을 대신 사용하지 않는다.
검색 transport가 설정되면 `/query`를 우선하고 HTTP가 실패하면 로컬 검색 경계로 돌아간다.

Memory Atlas 의미 관계 생성은 기존 qmd 내부 HTTP 경계를 재사용한다.
Quartz 일반 빌드는 qmd를 필수 의존성으로 삼지 않으며 임시 의미 산출물이 없으면 wiki 연결과 태그만으로 빌드한다.
임시 산출물은 gitignore 대상이고 emitter가 현재 빌드의 slug로 다시 제한하므로 protected 생성 결과가 남아 있어도 public 산출물에 private 관계가 포함되지 않는다.
자동 시작점은 정제된 graph에서 브라우저가 계산하고 wiki, 콘텐츠 색인과 임시 의미 산출물에 저장하지 않는다.

내보내기 스크립트는 YAML 객체를 자체 파서로 재구성하지 않는다.
기존 frontmatter 원문을 보존하고 최상위 키의 존재만 감지한 뒤, 누락된 교환 필드를 JSON 호환 YAML 값으로 삽입한다.
기존 `sources`, `generated`, `verified` 구조는 내용 손실 없이 그대로 통과시킨다.
`title`, `description`, `generated` 보완은 concept, topic, entity 문서에만 적용한다.
묶음의 `index.md`와 `log.md`는 예약 문서로 별도 처리한다.
raw Markdown은 내보내기 사본에서만 `type: Reference`를 보완하고 원본 본문을 유지한다.

## Quartz fork 경계

`quartz/`는 업스트림 Quartz를 복사해 담고 있으며 별도 upstream 이력이 없었다.
업스트림 파일을 직접 고치면 갱신할 때마다 내 코드와 업스트림 변경이 같은 파일에서 만난다.

- `quartz/quartz/**`는 업스트림 원본만 담으며 이 저장소에서 수정하지 않는다.
- `quartz/custom/**`는 이 저장소가 만든 컴포넌트, 렌더러, emitter와 스타일을 담는다.
- `quartz.config.ts`, `quartz.layout.ts`, `quartz/styles/custom.scss`는 업스트림이 사용자 편집을 전제한 설정 파일이라 예외로 둔다.
- `.npmrc`, `.prettierignore`, `package.json`은 이 저장소의 도구 설정이라 함께 예외로 둔다.
- 커스텀 컴포넌트와 emitter는 업스트림의 재수출 목록에 등록하지 않고 설정 파일이 경로로 직접 불러온다.
- 화면에 얹는 요소는 `renderPage`를 고치지 않고 layout의 컴포넌트 자리로 넣는다.
- Memory Atlas가 쓰는 확장 색인은 업스트림 `contentIndex`를 고치지 않고 커스텀 emitter가 자체 파일로 내보낸다.

plan13이 이전을 마쳐 위 목록이 현재 코드와 같다.
`quartz-upstream` remote를 연결했고 공통 조상은 복사 시점 커밋 `d25a6eab`다.
예외 파일 여섯을 뺀 나머지는 그 커밋과 내용이 같으며, `quartz/scripts/verify-upstream-untouched.sh`가 이것을 검사한다.

이 경계가 유지되면 갱신은 설정 파일 충돌만 확인하면 되고, 나중에 Quartz를 자체 구현으로 교체할 때 갈아끼울 표면이 색인 파일과 layout 하나로 드러난다.

## 운영 구성 저장 경계

- public 저장소는 Compose, reverse proxy, 모델 profile과 호스트 경로를 소유하지 않는다.
- private 인프라 저장소는 public 저장소의 검증된 commit을 입력으로 build와 게시를 수행한다.

## 검증 경계

- 지식 유입 정책 — 대표 후보 fixture가 기대 목적지와 판정값을 가지며 모든 쓰기 스킬이 단일 정책을 참조하는지 검사한다.
- 검색 벤치마크 — 대표 질문마다 기대 slug의 상위 순위를 검사한다.
- OKF 내보내기 — 임시 fixture를 내보내고 메타데이터, raw Reference, 예약 문서, 링크, private 제외를 검사한다.
- Quartz — SCSS를 불러오지 않는 순수 메타데이터 helper의 단위 검사, TypeScript 검사, 공개 정적 빌드를 실행한다.
- Quartz fork 경계 — `verify-upstream-untouched.sh`로 예외 파일을 뺀 업스트림 파일이 복사 시점 커밋과 같은지, `quartz/quartz/` 아래 새 파일이 없는지 검사한다.
- Memory Atlas — 색인 정규화와 필터·집계 순수 함수 단위 검사, 데스크톱과 390px 화면의 실제 렌더, 검색·필터·배치·노드 선택·오류 폴백을 검증한다.
- Memory Atlas 관계 계산 — 의미 산출물 형식과 namespace 제한, 혼합 점수 우선순위, 결정적 좌표, hop depth, 재중심화와 고정·자동 시작점을 DOM 없는 단위 검사로 검증한다.
- Memory Atlas 생명주기 — 2D와 3D 전환, SPA 재탐색과 컴포넌트 제거 뒤 listener, animation frame과 renderer 자원이 남지 않는지 검증한다.
- Memory Atlas 브라우저 회귀 — `browser-driver`를 통해 1440px와 390px 화면, 키보드, 움직임 줄이기, 전체 지도와 지역 관계 전환을 검증한다.
- Brain 질문 UI — 질문 상태, 답변 평문 렌더, 출처 이동, 그래프 강조 해제, 1440px와 390px의 넘침을 브라우저에서 검사한다.
- private 공개 범위 — 비로그인 BFF 응답과 public 산출물에 private slug와 본문이 없으며 private 출처 href가 같은 origin의 `/_private/<slug>` 형식인지 검사한다. 실제 `/_private` 요청의 `401`은 private 인프라 저장소에서 검증한다.
- 스킬 — `quick_validate.py`로 수정한 skill 폴더를 검사한다.
