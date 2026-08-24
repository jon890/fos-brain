# Phase 04: 실제 브라우저와 통합 회귀 검증

**Execution profile**: standard

---

## 목표

Memory Atlas의 실제 3D 동작, 반응형 화면, 정적 빌드, 기존 문서 회귀를 검증하고 성공한 상태만 완료로 기록한다.

**범위 외**: 홈서버 배포와 Cloudflare 변경은 이 plan에서 실행하지 않는다.

---

## 작업 항목 (4)

### 1. 전체 자동 검사

Quartz 단위 검사, TypeScript, Prettier, 정적 빌드를 실행한다.
빌드된 `INDEX.html`에는 Memory Atlas가 있고 대표 concept 문서에는 Memory Atlas 본문이 없으며 기존 KnowledgeMeta와 로컬 그래프가 있어야 한다.

### 2. 데스크톱 실제 브라우저 검사

`quartz/scripts/verify-memory-atlas-browser.sh`를 추가한다.
스크립트는 첫 인자로 로컬 서버 URL을 받고 고정 session `plan4-memory-atlas`와 `/tmp/fos-brain-memory-atlas-plan4` 증거 경로를 사용한다.
로컬 정적 서버를 열고 agent-browser를 1440px 너비로 실행한다.
WebGL canvas가 비어 있지 않고 검색, 유형 필터, 배치 전환, 색상 전환, 노드 선택, 상세 열기, 원문 이동, 조건 초기화가 동작하는지 DOM 상태와 URL로 검사한다.
`data-testid` selector와 `agent-browser eval --stdin` assertion을 사용해 runtime의 ready 상태, canvas의 양수 크기, 필터 뒤 노드 수 변화, 상세 제목, 가로 overflow를 검사한다.
browser error가 0개이며 홈에서는 `/static/memory-atlas.js`가 정확히 한 번 요청되고 대표 concept 문서에서는 요청되지 않는지 network JSON으로 확인한다.

### 3. 모바일과 실패 폴백 검사

390px 너비에서 필터 서랍과 상세 시트의 열기·닫기, 가로 overflow 0, 터치 목표와 키보드 focus를 검사한다.
`agent-browser set media dark reduced-motion`으로 움직임 줄이기를 적용하고 runtime 상태에서 자동 회전과 카메라 이동이 비활성화되는지 검사한다.
`agent-browser network route '**/static/contentIndex.json' --abort` 뒤 reload해 오류 안내, 다시 시도, 정적 안내 목록이 남는지 검사하고 마지막에 route를 제거한다.
데스크톱과 모바일 screenshot, 접근성 snapshot, browser errors, network requests, assertion 결과를 고정 증거 경로에 저장한다.

### 4. task 완료 상태 기록

모든 검사가 성공하면 `tasks/plan4-memory-constellation/index.json`의 `status`를 `completed`, `current_phases`를 `4`로 바꾼다.
어느 검사라도 실패하면 완료 상태를 기록하지 않고 실패 원인을 담당 phase로 돌린다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `quartz/scripts/verify-memory-atlas-browser.sh` | 신규 |
| `tasks/plan4-memory-constellation/index.json` | 성공 시 완료 상태 수정 |

## 검증

```bash
# cwd: <worktree>/quartz
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm quartz build
rg -n 'memory-atlas|기억의 항해도' public/INDEX.html
test -n "$(find public -path '*concepts/*.html' -print -quit)"
```

로컬 server가 실행 중인 상태에서 browser 계약을 검사한다.

```bash
# cwd: <worktree>/quartz
bash scripts/verify-memory-atlas-browser.sh http://127.0.0.1:8080
test -s /tmp/fos-brain-memory-atlas-plan4/desktop.png
test -s /tmp/fos-brain-memory-atlas-plan4/mobile.png
test -s /tmp/fos-brain-memory-atlas-plan4/network-home.json
test -s /tmp/fos-brain-memory-atlas-plan4/assertions.json
```

```bash
# cwd: <worktree>/
~/.claude/scripts/korean-style-check.sh docs/prd.md docs/flow.md docs/code-architecture.md docs/data-schema.md docs/adr/002-memory-atlas-3d-home.md docs/memory-atlas-design.md
python3 ~/.claude/scripts/check-readability.py docs/prd.md docs/flow.md docs/code-architecture.md docs/data-schema.md docs/adr/002-memory-atlas-3d-home.md docs/memory-atlas-design.md
~/.claude/skills/planning/scripts/verify-task.sh plan4-memory-constellation
git diff --check origin/main...HEAD
```

browser 검증 스크립트는 assertion 실패 시 0이 아닌 종료 코드를 반환하고 session과 network route를 cleanup해야 한다.
실행 보고에는 `/tmp/fos-brain-memory-atlas-plan4` 아래의 screenshot, 접근성 snapshot, browser errors, network, assertion 파일을 남긴다.

## 의도 메모 (왜)

- canvas 존재만으로 기능 완료를 주장하지 않고 사용자가 수행하는 탐색 흐름을 실제 브라우저에서 재현한다.
- 정적 public 빌드와 일반 문서 회귀를 함께 검사해 그래프 홈이 기존 읽기 경험을 침범하지 않게 한다.
