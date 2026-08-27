# Phase 04: 실제 브라우저와 통합 회귀 검증

**Execution profile**: standard

---

## 목표

Memory Atlas의 실제 3D 동작, 반응형 화면, 정적 빌드, 기존 문서 회귀를 검증한다.

**범위 외**: 실제 게시와 인증 계층 변경은 private 인프라 저장소가 담당한다.

---

## 작업 항목 (4)

### 1. 전체 자동 검사

`quartz/scripts/verify-memory-atlas.sh`를 재실행 가능한 단일 진입점으로 추가한다.
실행기는 Quartz 단위 검사, TypeScript, Prettier, 정적 빌드, 임시 서버, 브라우저 검사를 순서대로 실행하고 서버를 정리한다.
빌드된 `INDEX.html`에는 Memory Atlas가 있어야 한다.
대표 concept 문서에는 Memory Atlas 본문과 중복 그래프가 없어야 하며 KnowledgeMeta는 남아 있어야 한다.

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

### 4. phase 성공 상태 기록

모든 검사가 성공하면 team-lead가 이 phase 변경을 독립 커밋으로 만들고 원격 작업 브랜치에 push한다.
어느 검사라도 실패하면 커밋하지 않고 실패 원인을 담당 phase로 돌린다.
마지막 검증이 통과하면 `index.json`의 `status`를 `completed`로 기록한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `quartz/scripts/verify-memory-atlas.sh` | 전체 회귀 검사의 단일 실행기 신규 |
| `quartz/scripts/verify-memory-atlas-browser.sh` | 신규 |

## 검증

```bash
# cwd: <worktree>/quartz
scripts/verify-memory-atlas.sh
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

전체 실행기는 HTTP와 실시간 갱신 포트가 이미 사용 중이면 다른 프로세스를 건드리지 않고 실패해야 한다.
browser 검증 스크립트는 assertion 실패 시 0이 아닌 종료 코드를 반환하고 session과 network route를 정리해야 한다.
완료 뒤 임시 Quartz 서버와 두 포트를 모두 정리해야 한다.
실행 보고에는 `/tmp/fos-brain-memory-atlas-plan4` 아래의 screenshot, 접근성 snapshot, browser errors, network, assertion 파일을 남긴다.

## 의도 메모 (왜)

- canvas 존재만으로 기능 완료를 주장하지 않고 사용자가 수행하는 탐색 흐름을 실제 브라우저에서 재현한다.
- 정적 public 빌드와 일반 문서 회귀를 함께 검사해 그래프 홈이 기존 읽기 경험을 침범하지 않게 한다.
