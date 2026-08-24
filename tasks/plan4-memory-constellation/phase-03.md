# Phase 03: 심해 항해도 시각 정체성과 반응형 화면

**Execution profile**: standard

---

## 목표

참고 화면의 그래프 중심 위계를 유지하면서 fos-brain만의 심해 항해도 정체성과 모바일·접근성 품질을 완성한다.

**범위 외**: wiki 본문과 Cloudflare Access 설정은 변경하지 않는다.

---

## 작업 항목 (4)

### 1. 디자인 토큰과 서체 적용

`docs/memory-atlas-design.md`의 여섯 색상 토큰을 `memoryAtlas.scss`의 홈 범위 custom property로 정의한다.
`quartz/quartz.config.ts`의 header 서체를 `Gowun Batang`, body를 `IBM Plex Sans KR`, code를 `IBM Plex Mono`로 설정한다.
종이색은 선택 상세와 제목에만 사용하고 그래프 배경은 심해 청록색을 유지한다.

### 2. 그래프 중심 전체 화면 배치

루트에서만 기존 `.page` 최대 폭과 3열 grid를 해제하고 272px 필터 레일과 전체 높이 그래프를 배치한다.
상단 검색, 필터 chip, 수치, 배치 설정은 조밀하지만 44px 터치 목표와 보이는 focus 상태를 유지한다.
일반 문서의 light/dark theme와 기존 Quartz 색상 변수는 바꾸지 않는다.

### 3. 기억의 항적과 움직임

선택 노드와 직접 연결만 밝히고 나머지는 낮은 opacity로 내려 선택 경로를 구분한다.
선택 노드에는 얇은 궤도 두 개를 표시하며 다른 장식용 입자와 반복 등장 애니메이션은 추가하지 않는다.
`prefers-reduced-motion: reduce`에서는 궤도 회전, 자동 카메라 이동, 전환 애니메이션을 끈다.

### 4. 모바일 서랍과 상세 시트

800px 이하에서는 필터 레일을 왼쪽 서랍으로 전환하고, 390px에서는 상세를 아래 시트로 표시한다.
서랍이 열리면 배경 클릭과 닫기 버튼으로 닫을 수 있고 `aria-expanded`, `aria-controls`, 대화형 요소의 label을 유지한다.
화면 높이가 낮아도 검색과 초기화 동작이 가려지지 않게 각 패널만 독립적으로 스크롤한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `quartz/quartz.config.ts` | header 서체 변경 |
| `quartz/quartz/components/MemoryAtlas.tsx` | 문구와 접근성 속성 보강 |
| `quartz/quartz/components/scripts/memoryAtlas.inline.ts` | 기억의 항적과 움직임 줄이기 |
| `quartz/quartz/components/styles/memoryAtlas.scss` | 시각 정체성과 반응형 완성 |

## 검증

```bash
# cwd: <worktree>/quartz
pnpm test
pnpm check
pnpm quartz build
```

390px와 1440px에서 body 가로 overflow가 없고 모든 대화형 요소가 키보드 focus를 받아야 한다.

## 의도 메모 (왜)

- 검정과 버건디를 복제하지 않고 기존 fos-brain의 청록색을 탐사 화면의 재료로 사용한다.
- 기억의 항적 하나에 시각적 강조를 집중해 그래프가 장식보다 탐색 도구로 읽히게 한다.
