# Phase 02 렌더 함수와 콘텐츠 색인 수정 제거

**Execution profile**: deep

---

## 목표

업스트림 `renderPage.tsx` 와 `contentIndex.tsx` 에 넣은 수정을 없애고, 같은 기능을 커스텀 컴포넌트와 커스텀 emitter 로 옮긴다.

이 둘이 남은 마지막 업스트림 수정이고, `contentIndex` 확장은 Memory Atlas 가 Quartz 에 의존하는 실질 결합점이다.
`memoryAtlasController.ts` 가 Quartz 전역 `fetchData` 로 색인을 받고 있다.

**범위 외**: 파일 이동과 재수출 제거는 Phase 01, 그래프 원복과 remote 연결은 Phase 03이 담당한다.

**선행 조건**: 이 phase 는 Phase 01 이 만드는 `quartz/custom/` 디렉터리를 전제한다. 없으면 `PHASE_BLOCKED: Phase 01 미완료` 로 끝낸다.

---

## 작업 항목 (4)

### 1. 문서 상단 항해 요소를 컴포넌트로 옮긴다

현재 `renderPage.tsx` 가 `memory-atlas-doc-nav` 를 직접 만들고 `body` 에 `memory-atlas-page`, `memory-atlas-doc-page` 클래스를 붙인다.

항해 요소는 `quartz/custom/components/MemoryAtlasDocNav.tsx` 로 옮긴다.
`quartz.layout.ts` 의 `defaultContentPageLayout.beforeBody` 에서 기존 `ConditionalRender` 와 같은 방식으로 홈이 아닌 문서에만 렌더한다.
링크 주소 계산에 쓰는 `resolveRelative` 는 업스트림 `util/path` 에서 그대로 import 한다.

`body` 클래스는 렌더 함수를 고치지 않고 대체한다.
`memoryAtlas.scss` 의 해당 선택자를 `body:has(.memory-atlas)` 와 `body:has(.memory-atlas-doc-nav)` 로 바꾼다.
`:has` 가 동작하지 않는 환경을 위한 대체 경로는 만들지 않는다. 이 저장소는 최신 브라우저만 대상으로 한다.

### 2. 빈 사이드바 처리를 CSS 로 옮긴다

현재 `renderPage.tsx` 는 `left`, `right` 가 비면 `div.sidebar` 자체를 만들지 않는다.
이 조건 분기를 지우고 업스트림처럼 항상 만들되, `quartz/styles/custom.scss` 에서 `.sidebar:empty { display: none; }` 로 처리한다.
`custom.scss` 는 업스트림이 사용자 편집을 전제한 파일이라 수정해도 된다.

### 3. 확장 색인을 커스텀 emitter 로 옮긴다

`contentIndex.tsx` 를 업스트림 상태로 되돌린다.
`ContentDetails` 의 `role`, `type`, `status`, `freshness`, `updated`, `sourceCount`, `rssDescription` 추가와 `description` 유지 변경이 모두 사라진다.

`quartz/custom/emitters/memoryAtlasIndex.ts` 를 새로 만든다.
`memoryAtlasAssets.ts` 와 같은 방식으로 `content` 를 순회하며 slug 별 항목을 만들어 `/static/memory-atlas-index.json` 으로 내보낸다.
항목 필드는 `docs/data-schema.md` 의 `Memory Atlas 콘텐츠 색인` 절이 정한 것과 같다.
링크 배열은 업스트림 `contentIndex` 가 쓰는 것과 같은 방식으로 `file.data.links` 에서 만든다.

`quartz.config.ts` 의 emitter 목록에 이 emitter 를 더한다.

### 4. controller 가 자체 색인을 읽는다

`memoryAtlasController.ts` 의 `loadContentIndex` 가 전역 `fetchData` 대신 `/static/memory-atlas-index.json` 을 읽는다.
기존 주입 경계인 `options.loadContentIndex` 는 그대로 유지한다. 단위 검사가 이 경계를 쓴다.

읽기가 실패하면 지금과 같이 서버 렌더 문서 목록과 재시도 상태로 축소한다.
`ContentDetails` 타입 import 를 업스트림 emitter 가 아니라 커스텀 색인 모듈에서 가져오도록 바꾼다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `quartz/quartz/components/renderPage.tsx` | 수정 (업스트림 복원) |
| `quartz/quartz/plugins/emitters/contentIndex.tsx` | 수정 (업스트림 복원) |
| `quartz/custom/components/MemoryAtlasDocNav.tsx` | 신규 |
| `quartz/custom/emitters/memoryAtlasIndex.ts` | 신규 |
| `quartz/custom/components/scripts/memoryAtlasController.ts` | 수정 |
| `quartz/custom/components/styles/memoryAtlas.scss` | 수정 |
| `quartz/styles/custom.scss` | 수정 |
| `quartz.config.ts` | 수정 |
| `quartz.layout.ts` | 수정 |

## 검증

```bash
# cwd: <worktree>/quartz
pnpm exec tsc --noEmit
pnpm test
pnpm quartz build
```

```bash
# cwd: <worktree>/quartz
test -f public/static/memory-atlas-index.json && echo "색인 생성됨"
grep -c '"role"' public/static/memory-atlas-index.json
```

`role: navigation` 문서 둘이 색인에 담기지 않으므로 노드 계산에서 제외된 상태가 유지돼야 한다.

```bash
# cwd: <worktree>/quartz
node scripts/verify-memory-atlas-browser.mjs
```

종료 코드가 `0` 이어야 한다. 홈의 지도와 문서 페이지의 항해 요소가 모두 이전과 같이 보여야 한다.

```bash
# cwd: <worktree>/
git diff --check
```

## 의도 메모 (왜)

- 색인을 자체 파일로 내보내는 이유는 이것이 Quartz 에 대한 마지막 실질 결합점이기 때문이다. 이 파일 하나가 되면 나중에 Quartz 를 교체할 때 갈아끼울 표면이 드러난다.
- `body` 클래스를 `:has` 로 대체한 이유는 렌더 함수를 고치지 않기 위해서다. 클래스를 붙일 다른 확장 지점이 업스트림에 없다.
- RSS 의 `description` 처리를 업스트림으로 되돌리는 이유는, 그 변경이 Memory Atlas 를 위한 것이었고 자체 색인으로 옮기면 필요 없어지기 때문이다.

## Blocked 조건

- `browser-driver` 가 없으면 브라우저 판정을 빼고 나머지 검증만 수행한 뒤 그 사실을 결과에 적는다.
