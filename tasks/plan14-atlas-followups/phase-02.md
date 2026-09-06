# Phase 02 문서 페이지 브라우저 회귀와 상대 경로 자산

**Execution profile**: standard

---

## 목표

브라우저 회귀가 홈만 보던 것을 문서 페이지까지 넓히고, 아직 절대 경로인 2D·3D runtime 자산 경로를 페이지 기준 상대 경로로 바꾼다.

문서 페이지의 항해 요소는 PR #22 에서 `renderPage` 수정 대신 layout 컴포넌트로 옮겼고, 빈 header 여백을 손으로 잰 값 기준으로 상쇄했다. 그런데 자동 검사가 문서 페이지를 한 번도 열지 않아 그 값을 다시 잴 방법이 저장소에 없다.

**범위 외**: 죽은 CSS 규칙 제거와 형식 검사 대상 변경은 Phase 01이 담당한다.

**근거 문서**: `docs/code-architecture.md` 의 「검증 경계」 절이 브라우저 회귀가 문서 페이지를 포함한다는 것을 소유한다.

**선행 조건**: 이 phase 는 Phase 01 이 바꾼 `verify-memory-atlas.sh` 위에서 돈다. Phase 01 이 끝나지 않았으면 `PHASE_BLOCKED: Phase 01 미완료` 로 끝낸다.

---

## 작업 항목 (4)

### 1. `quartz/scripts/verify-memory-atlas-browser.mjs` 에 문서 페이지 frame 추가

지금 harness HTML 은 iframe 둘을 만들고 둘 다 `${baseUrl}/?${cacheKey}&viewport=...` 로 홈을 연다.
문서 페이지용 frame 둘을 같은 두 너비로 더한다. id 는 `desktop-doc-frame`, `mobile-doc-frame` 으로 한다.

열 문서는 빌드 산출물에 항상 있는 것으로 고른다. 코드에 slug 를 적지 말고 색인에서 고른다.
`/static/memory-atlas-index.json` 을 읽어 `role` 이 `navigation` 이 아닌 항목 중 slug 순으로 첫 번째를 쓴다. 어느 slug 를 골랐는지 출력에 남긴다.

### 2. `quartz/scripts/memory-atlas-browser-assertions.mjs` 에 문서 페이지 판정 추가

새 frame 에 대해 셋을 검사한다.

- `.memory-atlas-doc-nav` 가 존재한다.
- 그 요소의 `getBoundingClientRect().top` 이 `0` 이다. 화면 상단에 고정돼야 한다.
- `article` 의 `getBoundingClientRect().top` 이 기대 범위 안이다.

기대 범위는 코드에 숫자를 적지 말고 같은 실행 안에서 유도한다.
항해 요소의 높이와 본문 상단 사이 여백을 함께 재고, 본문 상단이 항해 요소 아래에서 시작하며 화면 높이를 넘지 않는지로 판정한다.
숫자를 고정하면 글꼴이나 여백이 바뀔 때마다 검사가 깨지고, 그것을 고치느라 검사가 무뎌진다.

`404` 페이지는 frame 을 더하지 않는다. 대신 빌드 산출물의 `public/404.html` 에 `memory-atlas-doc-nav` 문자열이 있는지 확인하는 검사를 같은 파일에 둔다. frame 하나를 아끼면서 항해 요소가 사라지는 회귀는 잡는다.

기존 `noHorizontalOverflow` 판정을 새 frame 에도 적용한다.

### 3. `quartz/custom/components/memoryAtlasView.tsx` 의 runtime 자산을 상대 경로로

107번째 줄 근처의 두 속성이 절대 경로다.

```
data-runtime-2d-src="/static/memory-atlas-2d.js"
data-runtime-3d-src="/static/memory-atlas-3d.js"
```

같은 파일이 받는 `fileData.slug` 와 업스트림 `resolveRelative` 로 페이지 기준 상대 경로를 만든다.
`quartz/custom/components/MemoryAtlasDocNav.tsx` 가 돌아가기 링크를 만드는 방식과 같게 한다.

controller 의 `publishedAssetUrl` 은 브라우저에서 색인과 의미 파일에 쓰는 것이라 그대로 둔다.
서버 렌더가 만드는 것은 서버 렌더에서 만든다.

`quartz/custom/components/scripts/memoryAtlasController.ts` 의 `publishedAssetUrl` 근거 주석에 runtime src 가 아직 절대 경로라고 적혀 있으면 그 문장을 지운다.
`tasks/plan13-quartz-fork-boundary/phase-03.md` 의 후속 항목도 해결됨으로 갱신한다.

### 4. 새 판정이 위반을 잡는지 확인하는 테스트

판정을 더했는데 아무것도 보지 않는 상태를 막는다.

`memoryAtlas.scss` 의 항해 요소 `position` 을 임시로 `static` 으로 바꾸고
`verify-memory-atlas.sh` 가 실패하는지 본다. 확인한 뒤 되돌린다.

`public/404.html` 검사도 같은 방식으로 확인한다.
`quartz.layout.ts` 의 `sharedPageComponents.header` 를 임시로 빈 배열로 두고 다시 빌드해
그 검사가 실패하는지 본다. 확인한 뒤 되돌린다.

둘 중 하나라도 실패하지 않으면 그 판정은 조건을 다시 만든다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `quartz/scripts/verify-memory-atlas-browser.mjs` | 수정 |
| `quartz/scripts/memory-atlas-browser-assertions.mjs` | 수정 |
| `quartz/custom/components/memoryAtlasView.tsx` | 수정 |
| `quartz/custom/components/memoryAtlasView.test.tsx` | 수정 |
| `quartz/custom/components/scripts/memoryAtlasController.ts` | 수정 |
| `tasks/plan13-quartz-fork-boundary/phase-03.md` | 수정 |
| `tasks/plan14-atlas-followups/index.json` | 수정 |

## 검증

```bash
# cwd: <worktree>/quartz
pnpm exec tsc --noEmit
pnpm test
```

`memoryAtlasView.test.tsx` 에 runtime src 가 절대 경로가 아닌 것을 단언하는 검사를 더한다.

```bash
# cwd: <worktree>/quartz
grep -c 'data-runtime-2d-src="/static' custom/components/memoryAtlasView.tsx
```

기대값은 `0` 이다.

```bash
# cwd: <worktree>/quartz
bash scripts/verify-memory-atlas.sh
```

종료 코드가 `0` 이어야 한다. 포트는 비어 있는 것을 골라 쓰고 무엇을 썼는지 결과에 적는다.
출력에 문서 페이지 frame 판정과 고른 slug 가 나와야 한다.

```bash
# cwd: <worktree>/
git diff --check
```

마지막으로 `tasks/plan14-atlas-followups/index.json` 의 `status` 를 `completed`, `current_phases` 를 `2` 로 바꾼다.

## 의도 메모 (왜)

- 기대 범위를 숫자로 고정하지 않는 이유는, 고정하면 글꼴이나 여백이 바뀔 때마다 검사가 깨지고 그것을 맞추느라 검사가 무뎌지기 때문이다.
- 열 문서를 코드에 적지 않고 색인에서 고르는 이유는, 그 문서를 지우거나 이름을 바꿀 때 검사가 원인을 알 수 없는 형태로 깨지기 때문이다.
- `404` 를 frame 대신 산출물 문자열로 확인하는 이유는, 실행 시간을 늘리지 않으면서 항해 요소가 사라지는 회귀만 잡으면 되기 때문이다.
- runtime src 를 서버 렌더에서 고치는 이유는, 그 속성을 서버 렌더가 만들기 때문이다. 브라우저에서 고치면 만든 곳과 고치는 곳이 갈린다.

## Blocked 조건

- `browser-driver` 가 없으면 `PHASE_BLOCKED: browser-driver 미설치` 를 출력하고 끝낸다.
