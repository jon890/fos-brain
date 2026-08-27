# Phase 02 Memory Atlas 질문 UI와 회귀 검사

**Execution profile**: standard

---

## 목표

기존 제목·태그 검색을 유지하면서 단일 자연어 질문, 평문 답변, 근거 이동과 그래프 강조를 Memory Atlas에 추가한다.

**범위 외**: BFF는 Phase 01, 실제 운영 배포와 폐기 서비스 전환은 private 인프라 계획의 책임이다.

---

## 작업 항목 (4)

### 1. 질문 패널 구조와 상태 계약

`MemoryAtlas.tsx`의 상단 검색 옆에 `Brain에게 묻기` 버튼을 추가한다.
질문 패널에는 연결된 label을 가진 textarea, 500자 표시, submit·닫기 버튼, public·private wiki 사용과 비저장 설명, `aria-live` 상태 영역을 둔다.
상태는 `idle`, `retrieving`, `generating`, `success`, `empty`, `error`로 구분한다.
기존 결정형 제목·태그 검색은 질문 입력과 상태를 공유하지 않는다.

### 2. API client와 브라우저 수명

`memoryAtlas.inline.ts`에 `askBrain(question, signal): Promise<BrainAnswer>`와 질문 패널 상태 전환을 구현한다.
같은 출처의 `/api/brain/ask`에 JSON을 보내고 중복 submit을 막는다.
API 오류의 `retryable`을 따라 다시 시도 동작을 보여주며, 패널을 닫거나 SPA를 떠나면 `AbortController`로 요청을 정리한다.

답변은 `textContent`로만 렌더하고 모델 HTML을 해석하지 않는다.
출처 링크는 API의 same-origin `href`만 허용하고 slug와 namespace가 현재 콘텐츠 색인과 맞는지 확인한다.
질문, 답변과 출처는 브라우저 메모리에만 두고 localStorage, sessionStorage, URL과 analytics에 쓰지 않는다.

### 3. 근거 노드 강조와 반응형 배치

`memoryAtlasRuntime.ts`에 `setEvidenceSlugs(slugs: ReadonlySet<string>): void`를 추가한다.
질문 패널이 열려 있고 성공 결과가 있을 때만 출처 노드를 기존 선택과 구분되는 신호로 표시한다.
패널 닫기, 새 질문 시작, 오류, 빈 결과, 다른 노드 선택과 SPA 정리에서 이전 강조를 제거한다.

`memoryAtlas.scss`는 데스크톱에서 그래프가 보이는 하단 오버레이, 390px에서는 focus trap이 가능한 아래 시트로 배치한다.
긴 답변·제목·URL은 패널 안에서 줄바꿈하고 viewport 가로 넘침을 만들지 않는다.
움직임 줄이기 환경에는 질문 패널 장식 애니메이션을 적용하지 않는다.

### 4. 결정적 UI 회귀 검사

API client 검사는 정상, 빈 결과, 400·429·502·504, abort, 중복 제출, HTML 평문 렌더와 저장소 미사용을 다룬다.
`verify-memory-atlas-browser.sh`의 mock API로 검색 중·생성 중·성공·빈 결과·오류 상태를 재현한다.
1440×1000과 390×844에서 패널 넘침, 키보드 focus, Escape 닫기, public·private 출처 이동, 출처 강조 생성·해제와 기존 검색·필터·노드 선택 회귀를 검사한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `quartz/quartz/components/MemoryAtlas.tsx` | 질문 버튼과 패널 구조 추가 |
| `quartz/quartz/components/scripts/memoryAtlas.inline.ts` | API client와 상태 전환 추가 |
| `quartz/quartz/components/scripts/memoryAtlasRuntime.ts` | 근거 노드 강조 API 추가 |
| `quartz/quartz/components/styles/memoryAtlas.scss` | 데스크톱·모바일 질문 패널 추가 |
| `quartz/scripts/verify-memory-atlas-browser.sh` | 질문 상태와 시각 경계 회귀 추가 |
| `quartz/scripts/verify-memory-atlas.sh` | 질문 관련 단위 검사 연결 |

## 검증

```bash
# cwd: <worktree>/quartz
scripts/verify-memory-atlas.sh
```

```bash
# cwd: <worktree>/
node --test services/brain-ask/brainAsk.test.mjs
scripts/verify-public-infra-boundary.sh
git diff --check
```

두 viewport에서 문서와 보이는 조작 요소의 `scrollWidth`는 `clientWidth`를 넘지 않아야 한다.
패널을 닫은 뒤 질문 문자열, 답변 DOM과 근거 강조가 남지 않아야 하며 기존 검색 강조와 선택 복원 검사는 계속 통과해야 한다.

## 의도 메모 (왜)

- 검색은 현재 그래프를 좁히고 질문은 근거를 합성하므로 입력과 상태를 분리한다.
- 평문 렌더와 same-origin 링크 검증으로 모델 출력이 실행 가능한 UI가 되는 경로를 막는다.
- 질문 패널을 그래프 위에 제한적으로 겹쳐 관계 탐색과 근거 읽기를 한 화면에 유지한다.

## 완료 기록

모든 검증이 통과하면 `tasks/plan7-brain-grounded-qa/index.json`의 `status`를 `completed`, `current_phases`를 `2`로 바꾼다.
