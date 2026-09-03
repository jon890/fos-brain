# Phase 03 Memory Atlas 로그인과 권한별 데이터 전환

**Execution profile**: deep

---

## 목표

Memory Atlas 하나에서 비로그인 public 탐색과 관리자 public·private 탐색을 전환하고, private 데이터와 질문 UI가 유효한 관리자 session에서만 나타나게 한다.

**범위 외**: 별도 관리자 페이지, 가입 화면과 사용자별 설정은 만들지 않는다. 운영 Nginx와 Cloudflare 전환은 private 인프라 계획이 담당한다.

**선행 조건**: Phase 02의 인증·private API 계약과 테스트가 통과해야 한다.

---

## 작업 항목 (5)

### 1. 인증 상태와 로그인 대화상자

Memory Atlas 상단에 비로그인일 때 `관리자 로그인`, 로그인 뒤 `관리자` 상태와 `로그아웃`을 표시한다.
비밀번호만 받는 접근 가능한 대화상자를 사용하고 입력값을 component 상태 밖, URL, localStorage, sessionStorage와 analytics에 남기지 않는다.
실패 종류를 구분해 계정 정보를 드러내지 않고 제한 상태에는 재시도 가능 시점을 안내한다.

### 2. public 우선 데이터 loader

첫 화면은 기존 `/static/contentIndex.json`과 `/static/memory-atlas-semantics.json`의 public 데이터로 즉시 렌더한다.
`GET /api/auth/session` 결과가 `admin`이면 `/api/private/content-index`와 `/api/private/memory-atlas-semantics`를 읽어 현재 graph를 교체한다.
관리자 데이터로 바꿀 때 namespace checkbox에 `private` 항목을 추가하고 root의 `data-available-namespaces`도 `public,private`로 갱신한다.
관리자 데이터가 실패하면 private 상태를 부분 유지하지 않고 public 데이터로 돌아가며 다시 로그인하도록 안내한다.

### 3. 권한별 기능과 상태 정리

private namespace filter, private 노드와 Brain 질문은 관리자 데이터를 성공적으로 읽은 뒤에만 제공한다.
로그아웃, session 만료 또는 보호 API의 `401`에서 질문·답변·근거, private 노드, 선택, filter와 private 상세 내용을 메모리에서 제거한다.
이때 `private` namespace checkbox를 제거하고 `data-available-namespaces`를 `public`으로 되돌리며, `sessionStorage`의 `memoryAtlasState`에서 private namespace 선택을 제거한 값을 다시 저장한다.
화면 reload를 허용해 인증 전환 구현을 단순하게 유지하되 현재 public URL은 보존한다.

private 출처의 `href`는 같은 origin의 `/_private/<slug>` 형식만 허용한다.
실제 `/_private` 문서 요청의 `401`과 reverse proxy 접근 제어는 private 인프라 계획에서 검증한다.

### 4. Preact 책임 분리

로그인 대화상자와 인증 표시를 작은 typed Preact SSR 조각으로 둔다.
브라우저 fetch, session 전환과 graph 재초기화는 controller에 두고 renderer에는 role이나 cookie를 전달하지 않는다.
`memoryAtlasData.ts`는 public·private 구분과 filter·집계 같은 순수 데이터 변환만 유지하고 인증 fetch나 DOM 갱신은 맡지 않는다.
기존 2D·3D renderer, 검색, 시작점과 상세 panel 상태 계약을 유지한다.

### 5. 브라우저 회귀 확대

mock auth와 protected data endpoint를 사용해 public 최초 화면, 로그인 성공·실패·제한, 관리자 데이터 전환, 로그아웃, session 만료와 private API 오류를 결정적으로 재현한다.
관리자 전환과 로그아웃 때 namespace checkbox, `data-available-namespaces`와 `sessionStorage`가 같은 공개 범위를 나타내는지 검사한다.
1440×1000과 390×844에서 대화상자, 상단 상태와 graph가 viewport를 넘지 않는지 확인한다.
브라우저 저장소와 public DOM·초기 network 응답에 비밀번호나 private fixture가 남지 않는지 검사한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `quartz/quartz/components/MemoryAtlas.tsx` | 인증 상태와 로그인 대화상자 조합 |
| `quartz/quartz/components/memoryAtlasView.tsx` | 접근 가능한 인증 화면 조각 |
| `quartz/quartz/components/scripts/memoryAtlasAuth.ts` | typed auth API client와 오류 정규화 |
| `quartz/quartz/components/scripts/memoryAtlasController.ts` | session 조회, 보호 데이터 fetch, namespace DOM·저장 상태 전환과 메모리 정리 |
| `quartz/quartz/components/memoryAtlasData.ts` | public·private namespace의 순수 데이터 변환과 filter 경계 |
| `quartz/quartz/components/styles/memoryAtlas.scss` | 로그인과 관리자 상태 반응형 배치 |
| `quartz/scripts/verify-memory-atlas-browser.mjs` | 권한별 browser 회귀 시나리오 |
| `quartz/scripts/memory-atlas-browser-assertions.mjs` | private 누출과 UI 경계 assertion |

## 검증

```bash
# cwd: <worktree>/quartz
pnpm test
pnpm check
pnpm quartz build
scripts/verify-memory-atlas.sh
```

```bash
# cwd: <worktree>/
scripts/verify-public-infra-boundary.sh
git diff --check
```

비로그인 fixture에서는 `private` namespace, private slug, 질문 입력과 관리자 JSON 요청이 없어야 한다.
관리자 fixture에서는 같은 화면에 public과 private가 함께 나타나고 로그아웃 뒤 다시 public만 남아야 한다.
private 질문 출처는 검증된 `/_private/<slug>` href만 만들며 실제 요청의 인증 응답은 이 저장소의 완료 조건에 포함하지 않는다.

## 의도 메모 (왜)

- public 데이터를 먼저 보여주면 인증 API 지연이나 실패가 public 지식 조회를 막지 않는다.
- private 상태를 부분적으로 보존하지 않아 만료 시 화면 메모리에 남는 권한 혼합을 피한다.
- 렌더러는 권한을 모르고 검증된 현재 데이터만 받아 기존 관계 지도 책임을 유지한다.
