# 코드 아키텍처

## 책임 경계

### 지식 원본과 문서

- `raw/` — public 원본의 변경 불가 저장소다.
- `wiki/` — 에이전트와 Quartz가 함께 읽는 컴파일된 지식이다.
- `private/` — 독립 저장소이며 public 산출물에서 제외한다.

### 에이전트 검색과 교환

- `.agents/plugin/fos-brain/references/knowledge-admission-policy.md` — 저장할 개인 지식과 다른 시스템으로 보낼 정보를 구분하는 단일 정책이다.
- `.agents/plugin/fos-brain/skills/brain-search/` — 네임스페이스 분리, wiki 우선 검색, 링크 탐색, 근거 작성 절차를 소유한다.
- `.agents/plugin/fos-brain/skills/brain-add/` — 정책 판정, 새 문서의 메타데이터 작성, 검색 검증 절차를 소유한다.
- `.agents/plugin/fos-brain/skills/brain-curate/` — 여러 세션에서 후보를 찾되 같은 정책으로 저장 가치와 목적지를 판정한다.
- `.agents/plugin/fos-brain/skills/brain-lint/` — 기존 문서가 정책에 맞는지 품질 점검에서 분류한다.
- `.agents/plugin/fos-brain/scripts/` — OKF 내보내기, 검색 벤치마크, 격리된 지식 유입 행동 평가처럼 반복 실행해야 하는 동작을 소유한다.
- `.agents/plugin/fos-brain/tests/` — 지식 유입 정책, 행동 평가의 원문과 채점 근거, 내보내기 계약, 스크립트 회귀를 검증한다.

스킬은 언제 어떤 단계를 실행할지 설명한다.
다섯 줄을 넘는 파싱, 변환, 판정은 스크립트에 둔다.
의미 적합성은 에이전트와 사용자가 판단하고, 스크립트는 판정 기록의 필드와 허용값만 검사한다.
행동 평가는 기준 commit과 현재 commit을 임시 복사본에서 읽기 전용으로 실행한다.
평가 원문, 별도 채점, 전후 파일 hash, 결과 JSON을 함께 보존해 결과만 임의로 작성하는 검사를 막는다.

### 사람용 렌더링

- `quartz/quartz/components/KnowledgeMeta.tsx` — 페이지 frontmatter를 사람이 읽는 설명·신뢰·최신성 표시로 바꾼다.
- `quartz/quartz/plugins/emitters/contentIndex.tsx` — 그래프가 사용할 문서 유형을 콘텐츠 색인에 포함한다.
- `quartz/quartz/components/Graph.tsx` — 유형 범례를 렌더한다.
- `quartz/quartz/components/scripts/graph.inline.ts` — 문서 유형별 노드 색을 선택한다.

표시 컴포넌트는 frontmatter가 일부만 있어도 동작해야 한다.
OKF 내보내기 로직을 Quartz에 넣지 않고 교환 경계를 별도 스크립트로 유지한다.

## 의존성

새 외부 의존성은 추가하지 않는다.
검색은 설치된 qmd를 사용하고, 내보내기 스크립트는 Node.js 표준 라이브러리만 사용한다.
Quartz는 기존 Preact, TypeScript, SCSS, PixiJS를 재사용한다.
qmd 명령은 고정 wrapper만 실행하며, wrapper가 없으면 PATH의 실행 파일을 대신 사용하지 않는다.

내보내기 스크립트는 YAML 객체를 자체 파서로 재구성하지 않는다.
기존 frontmatter 원문을 보존하고 최상위 키의 존재만 감지한 뒤, 누락된 교환 필드를 JSON 호환 YAML 값으로 삽입한다.
기존 `sources`, `generated`, `verified` 구조는 내용 손실 없이 그대로 통과시킨다.
`title`, `description`, `generated` 보완은 concept, topic, entity 문서에만 적용한다.
묶음의 `index.md`와 `log.md`는 예약 문서로 별도 처리한다.
raw Markdown은 내보내기 사본에서만 `type: Reference`를 보완하고 원본 본문을 유지한다.

## 검증 경계

- 지식 유입 정책 — 대표 후보 fixture가 기대 목적지와 판정값을 가지며 모든 쓰기 스킬이 단일 정책을 참조하는지 검사한다.
- 검색 벤치마크 — 대표 질문마다 기대 slug의 상위 순위를 검사한다.
- OKF 내보내기 — 임시 fixture를 내보내고 메타데이터, raw Reference, 예약 문서, 링크, private 제외를 검사한다.
- Quartz — SCSS를 불러오지 않는 순수 메타데이터 helper의 단위 검사, TypeScript 검사, 공개 정적 빌드를 실행한다.
- 스킬 — `quick_validate.py`로 수정한 skill 폴더를 검사한다.
