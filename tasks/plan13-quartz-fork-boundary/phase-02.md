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

## 작업 항목 (6)

### 1. 문서 상단 항해 요소를 컴포넌트로 옮긴다

현재 `renderPage.tsx` 가 `memory-atlas-doc-nav` 를 직접 만들고 `body` 에 `memory-atlas-page`, `memory-atlas-doc-page` 클래스를 붙인다.

항해 요소는 `quartz/custom/components/MemoryAtlasDocNav.tsx` 로 옮긴다.
링크 주소 계산에 쓰는 `resolveRelative` 는 업스트림 `util/path` 에서 그대로 import 한다.

**`quartz.layout.ts` 의 `sharedPageComponents.header` 에 넣는다.**
`defaultContentPageLayout.beforeBody` 에 넣으면 본문 페이지에만 붙어, 지금 이 요소를 받고 있는
목록 페이지(`FolderPage`, `TagPage`)와 404 페이지가 항해 요소를 잃는다.
`FolderPage` 와 `TagPage` 는 `defaultListPageLayout` 을 쓰고, 404 는 `beforeBody: []` 를 코드에 명시해 두었다.
`sharedPageComponents` 는 셋이 모두 펼쳐 쓰는 유일한 자리다.

홈 제외는 layout 의 `ConditionalRender` 가 아니라 컴포넌트 자신이 한다.
`sharedPageComponents` 에는 조건을 걸 자리가 없기 때문이다.
컴포넌트가 `fileData.slug` 를 소문자로 바꿔 `index` 면 `null` 을 반환한다.

이 요소는 `position: fixed` 라 DOM 위치가 화면 위치를 바꾸지 않는다.
다만 조상에 stacking context 가 생기면 겹침 순서가 달라질 수 있으므로,
구현 뒤 1440px 와 390px 화면에서 실제로 문서 상단에 고정돼 보이는지 확인한다.

`body` 클래스는 렌더 함수를 고치지 않고 대체한다.
`memoryAtlas.scss` 의 `body.memory-atlas-page` 를 `body:has(.memory-atlas)` 로,
`body.memory-atlas-doc-page` 를 `body:has(.memory-atlas-doc-nav)` 로 바꾼다.

**`html:has(body.memory-atlas-page)` 는 `html:has(.memory-atlas)` 로 쓴다.**
`html:has(body:has(.memory-atlas))` 로 쓰면 `:has()` 안에 `:has()` 가 들어가 CSS 규격상 무효가 되고,
규칙 전체가 무시돼 홈 화면의 스크롤 잠금이 풀린다.

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
링크 배열은 업스트림 `contentIndex` 가 쓰는 것과 같은 방식으로 `file.data.links` 에서 만든다.

항목 필드는 아래 열하나다.
`docs/data-schema.md` 의 표는 업스트림 색인에 **더하는** 선택 필드 일곱만 적고 있어서, 그것만으로는 부족하다.
`buildMemoryAtlasData` 가 실제로 읽는 필드를 기준으로 정한다.

| 필드 | 출처 |
| --- | --- |
| `slug` | 문서 slug |
| `title` | `file.data.frontmatter.title` |
| `links` | `file.data.links` |
| `tags` | `file.data.frontmatter.tags` |
| `description` | `normalizeKnowledgeMetaData` 결과 |
| `type` | 같음 |
| `role` | 같음 |
| `status` | 같음 |
| `freshness` | 같음 (`staleAfter`) |
| `updated` | `getDate` 결과의 ISO 문자열 |
| `sourceCount` | `normalizeKnowledgeMetaData` 결과 `sources` 길이 |

구현 전에 `quartz/custom/components/memoryAtlasData.ts` 의 `buildMemoryAtlasData` 가 읽는 필드를 직접 확인해
이 표와 맞는지 대조한다. 다르면 실제 코드를 따르고 차이를 결과에 적는다.

`quartz.config.ts` 의 emitter 목록에 이 emitter 를 더한다.

### 4. controller 가 자체 색인을 읽는다

`memoryAtlasController.ts` 의 `loadContentIndex` 가 전역 `fetchData` 대신 `/static/memory-atlas-index.json` 을 읽는다.
기존 주입 경계인 `options.loadContentIndex` 는 그대로 유지한다. 단위 검사가 이 경계를 쓴다.

읽기가 실패하면 지금과 같이 서버 렌더 문서 목록과 재시도 상태로 축소한다.
`ContentDetails` 타입 import 를 업스트림 emitter 가 아니라 커스텀 색인 모듈에서 가져오도록 바꾼다.

### 5. 문서의 색인 계약을 새 파일로 옮긴다

`docs/data-schema.md` 의 `Memory Atlas 콘텐츠 색인` 절은 이 필드들이 `/static/contentIndex.json` 에 붙는다고 적고 있다.
`/static/memory-atlas-index.json` 이 소유하는 것으로 다시 쓰고, 위 표의 열하나를 모두 적는다.

`docs/code-architecture.md` 의 `사람용 렌더링` 절은 `quartz/quartz/plugins/emitters/contentIndex.tsx` 가
색인에 지식 metadata 를 넣는다고 적고 있다. 그 줄을 새 emitter 로 바꾼다.
같은 문서의 옮긴 파일 경로도 `quartz/custom/**` 로 함께 고친다.

`docs/data-schema.md` 의 `관리자 콘텐츠 API` 절과 `BRAIN_PRIVATE_CONTENT_INDEX_FILE` 설명은
`/api/private/content-index` 가 병합 `contentIndex.json` 을 반환한다고 적고 있다.
이 endpoint 가 실제로 넘기는 것은 Memory Atlas 가 읽는 색인이므로, 반환하는 파일을 병합
`memory-atlas-index.json` 으로 다시 적는다. endpoint 이름과 Guard 는 그대로 둔다.

**private 인프라 저장소가 mount 하는 파일 경로를 함께 바꿔야 한다.**
이 저장소는 계약만 소유하므로 그 변경은 여기서 하지 않는다. 후속으로 보고한다.

### 6. 브라우저 검증이 새 색인을 읽게 한다

`quartz/scripts/memory-atlas-browser-assertions.mjs` 가 `/static/contentIndex.json` 을 받아
`role === "navigation"` 항목을 찾고, 없으면 스스로 실패한다.
`contentIndex.tsx` 를 원복하면 그 필드가 사라지므로 이 검증이 반드시 실패한다.
읽는 주소를 `/static/memory-atlas-index.json` 으로 바꾼다.

같은 파일에서 `/static/contentIndex.json` 을 읽는 다른 자리도 함께 확인한다.
공개 산출물에 private slug 가 없는지 보는 검사는 업스트림 색인을 그대로 읽어야 하므로 바꾸지 않는다.
어느 자리를 바꾸고 어느 자리를 두었는지 결과에 적는다.

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
| `quartz/quartz/styles/custom.scss` | 수정 |
| `quartz/quartz.config.ts` | 수정 |
| `quartz/quartz.layout.ts` | 수정 |
| `quartz/scripts/memory-atlas-browser-assertions.mjs` | 수정 |
| `docs/data-schema.md` | 수정 |
| `docs/code-architecture.md` | 수정 |

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
grep -c '"role":"navigation"' public/static/memory-atlas-index.json
```

`role: navigation` 문서 둘이 색인에 `role` 값을 그대로 달고 담겨야 한다.
노드와 연결 계산에서 그 둘을 빼는 일은 브라우저의 `buildMemoryAtlasData` 가 한다.
색인 자체에서 빼면 그 판정 근거가 사라진다.

```bash
# cwd: <worktree>/quartz
grep -c '"role"' public/static/contentIndex.json
```

기대값은 `0` 이다. 업스트림 색인이 원래대로 돌아갔다는 뜻이다.

```bash
# cwd: <worktree>/quartz
MEMORY_ATLAS_VERIFY_PORT=8116 MEMORY_ATLAS_VERIFY_WS_PORT=3116 bash scripts/verify-memory-atlas.sh
```

종료 코드가 `0` 이어야 한다.
`verify-memory-atlas-browser.mjs` 는 서버 주소를 인자로 받으므로 단독으로 실행하지 않는다.
`verify-memory-atlas.sh` 가 빌드와 임시 서버를 띄운 뒤 그것을 부른다.

홈의 지도와 문서 페이지의 항해 요소가 모두 이전과 같이 보여야 한다.
목록 페이지(태그, 폴더)와 404 페이지에서도 항해 요소와 어두운 화면이 그대로 남아야 한다.

```bash
# cwd: <worktree>/
git diff --check
```

## 의도 메모 (왜)

- 색인을 자체 파일로 내보내는 이유는 이것이 Quartz 에 대한 마지막 실질 결합점이기 때문이다. 이 파일 하나가 되면 나중에 Quartz 를 교체할 때 갈아끼울 표면이 드러난다.
- `body` 클래스를 `:has` 로 대체한 이유는 렌더 함수를 고치지 않기 위해서다. 클래스를 붙일 다른 확장 지점이 업스트림에 없다.
- RSS 의 `description` 처리를 업스트림으로 되돌리는 이유는, 그 변경이 Memory Atlas 를 위한 것이었고 자체 색인으로 옮기면 필요 없어지기 때문이다.

## 범위 밖 후속

`/api/private/content-index` 가 넘기는 파일이 병합 `contentIndex.json` 에서 병합 `memory-atlas-index.json` 으로 바뀐다.
이 저장소는 계약만 소유하고 실제 파일 경로와 mount 는 private 인프라 저장소가 소유한다.
그쪽의 `BRAIN_PRIVATE_CONTENT_INDEX_FILE` 값을 함께 바꿔야 관리자 화면이 계속 동작한다.
이 phase 는 그 변경을 하지 않고 후속으로 보고한다.

## Blocked 조건

- `browser-driver` 가 없으면 브라우저 판정을 빼고 나머지 검증만 수행한 뒤 그 사실을 결과에 적는다.
