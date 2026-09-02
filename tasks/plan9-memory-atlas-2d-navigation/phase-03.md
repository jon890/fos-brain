# Phase 03 browser-driver 회귀와 통합 검증

**Execution profile**: standard

---

## 목표

Memory Atlas의 2D·3D 전환, 시작점, 지역 관계, 접근성과 privacy 경계를 `browser-driver` 한 진입점으로 반복 검증한다.

**범위 외**: 실제 외부 게시, 접근 제어 설정, qmd 운영 주소, 실행 환경 연결과 rollback은 private 인프라 저장소가 담당한다.

---

## 작업 항목 (4)

### 1. 브라우저 회귀 실행기 전환

`verify-memory-atlas-browser.sh`가 `agent-browser`를 직접 호출하는 구조를 제거한다.
얇은 shell 진입점과 `verify-memory-atlas-browser.mjs`가 `~/.claude/scripts/browser-driver`의 `driver`, `doctor`, `open`, `waitjs`, `js`, `shot`, `console`, `errors`, `worktree`, `close`만 사용하게 한다.
Orca가 선택되면 `ORCA_WORKTREE=path:<worktree>`를 지정하고 열린 handle의 worktree가 현재 검증 worktree인지 확인한다.
고정 대기 대신 `waitjs`로 runtime과 화면 상태를 기다리고 driver 종료 코드가 실패면 검사도 실패한다.

browser assertion은 JavaScript 표현식과 이름을 Node 모듈에 두고 shell heredoc으로 만들지 않는다.
Node 실행기는 `spawn`의 인자 배열로 표현식을 driver에 전달해 shell quote에 의존하지 않는다.
성공과 실패 경로 모두에서 탭, 임시 server와 화면 산출물을 정리한다.

### 2. 2D 전체·지역 관계 시나리오

driver에 viewport 명령이 없으므로 같은 출처 iframe을 1440×1000과 390×844로 만들어 각 iframe의 실제 viewport에서 화면을 검사한다.
증거 screenshot에는 해당 iframe을 이름과 크기가 보이는 harness 안에 담는다.
두 viewport에서 기본 mode가 2D이고 문서와 보이는 조작 요소의 `scrollWidth`가 `clientWidth`를 넘지 않는지 검사한다.
고정 커리어·건강·AI와 AI 아래 RAG, 자동 시작점 영역, 모든 2D 노드 제목과 관계 유형 범례를 검사한다.
RAG 시작점 선택, 1-hop·2-hop opacity, 연결 노드 재선택, 배경 노드 유지와 전체 지도 복원을 순서대로 실행한다.
키보드 `Tab`, `Enter`, `Space`, `Escape`만으로 같은 흐름을 완료한다.
움직임 줄이기는 iframe의 `matchMedia`를 재초기화 전에 override한 뒤 최종 좌표가 즉시 적용되는지 검사한다.

### 3. mode·실패·privacy 회귀

2D에서 선택과 filter를 만든 뒤 iframe의 `performance` resource entries를 확인해 3D bundle 요청이 없음을 검증한다.
3D로 전환해 같은 선택이 유지되고 3D runtime resource가 그때 처음 생기는지 검사한다.
다시 2D로 돌아오면 3D canvas와 renderer 자원이 제거되고 2D 노드만 남아야 한다.
SPA 문서 이동과 홈 복귀 뒤 mode와 선택을 복원하고 선택 해제 뒤 이전 강조가 되살아나지 않는지 검사한다.

iframe의 `fetch`를 override한 뒤 `nav` 재초기화를 실행해 의미 관계 파일 오류가 link·tag 축소 상태로 나타나는지 검사한다.
콘텐츠 색인 오류는 페이지 준비 전에 생성되는 `fetchData` promise라 Phase 01의 주입 가능한 loader 단위 검사가 담당한다.
public fixture에 private 의미 edge와 시작점 후보를 넣어도 DOM, 상태 문구와 정제한 graph 입력에 `_private/` slug와 private 제목이 나타나지 않아야 한다.
기존 Brain 질문 성공·빈 근거·오류, 출처 강조 해제와 원문 복귀 회귀를 유지한다.

### 4. 통합 검사와 완료 상태

`verify-memory-atlas.sh`는 format, typecheck, unit, build, 임시 server와 browser-driver 회귀를 순서대로 실행한다.
검사 산출물은 기존 `/tmp/fos-brain-memory-atlas-suite` 아래에 assertion JSON, console, errors와 1440px·390px screenshot을 남긴다.
검사 실패를 재시도로 성공 처리하지 않고 browser 연결 timeout만 새 handle로 한 번 복구한다.
모든 검증이 성공한 뒤에만 task index를 완료 상태로 바꾼다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `quartz/scripts/verify-memory-atlas-browser.sh` | browser-driver 진입점으로 축소 |
| `quartz/scripts/verify-memory-atlas-browser.mjs` | 화면 시나리오와 assertion 실행기 추가 |
| `quartz/scripts/memory-atlas-browser-assertions.mjs` | 재사용 가능한 JS assertion 추가 |
| `quartz/scripts/verify-memory-atlas.sh` | 새 runtime과 browser 검사 연결 |
| `tasks/plan9-memory-atlas-2d-navigation/index.json` | 완료 상태 수정 |

## 검증

```bash
# cwd: <worktree>/
~/.claude/scripts/browser-driver doctor
scripts/verify-public-infra-boundary.sh
git diff --check
```

```bash
# cwd: <worktree>/quartz
scripts/verify-memory-atlas.sh
```

```bash
# cwd: <worktree>/
! rg -n '(^|[^-])agent-browser|orca browser|browser backend' quartz/scripts/verify-memory-atlas-browser.sh quartz/scripts/verify-memory-atlas-browser.mjs quartz/scripts/memory-atlas-browser-assertions.mjs
~/.claude/scripts/korean-style-check.sh docs/prd.md docs/flow.md docs/code-architecture.md docs/data-schema.md docs/memory-atlas-design.md docs/adr/002-memory-atlas-3d-home.md docs/adr/008-memory-atlas-2d-semantic-navigation.md docs/adr/INDEX.md
python3 ~/.claude/scripts/check-readability.py docs/prd.md docs/flow.md docs/code-architecture.md docs/data-schema.md docs/memory-atlas-design.md docs/adr/002-memory-atlas-3d-home.md docs/adr/008-memory-atlas-2d-semantic-navigation.md docs/adr/INDEX.md
```

검증이 모두 성공하면 `tasks/plan9-memory-atlas-2d-navigation/index.json`의 `status`를 `completed`, `current_phases`를 `3`으로 바꾼다.

## 의도 메모 (왜)

- browser-driver의 실패 종료 코드를 기준으로 사용해 backend가 실패를 성공처럼 반환하는 문제를 막는다.
- 화면 assertion을 Node 모듈에 두어 같은 사용자 흐름과 privacy 검사를 다음 변경에서도 재실행할 수 있게 한다.
- 2D와 3D를 한 회귀에서 오가며 renderer cleanup과 상태 복원을 각각 검사한다.
