# 지식 유입 정책

이 문서는 fos-brain에 들어올 지식 후보를 판정하는 단일 정책이다.
brain-add, brain-curate, brain-search, brain-lint, brain-delete는 판정 전에 이 문서를 읽는다.
개인 brain은 public과 private만 사용하며 회사 내부 지식은 어느 쪽에도 저장하지 않는다.

## 저장 가치 축

개인 brain에는 6개월 뒤 사용자나 에이전트가 다시 물을 만한 개인 지식을 저장한다.
후보는 아래 축 가운데 하나 이상과 구체적으로 연결되어야 한다.

| 값 | 저장할 지식 |
| --- | --- |
| `work-style` | 사용자가 일하고 협업하는 방식과 AI 하네스 운영 원칙 |
| `taste` | 도구, 기술, 표현, 생활 방식에 관한 개인 취향과 선택 기준 |
| `decision` | 채택하거나 기각한 결정과 근거, 트레이드오프 |
| `personal-system` | 사용자가 관리하는 개인 서비스, 장비, 환경의 책임 경계와 설계 |
| `career` | 이력, 경험, 성취, 배운 점처럼 장기간 참고할 개인 기록 |
| `durable-domain` | 사용자에게 장기 적용되는 분야 지식과 개인 맥락이 결합된 이해 |

단순 설명이 위 축의 이름과 비슷하다는 이유만으로 저장하지 않는다.
개인적 특수성이나 실제 결정과 연결되지 않은 일반 설명은 제외한다.

## 판정 순서

모든 후보는 다음 질문을 순서대로 통과해야 한다.

1. **미래 질문**: 6개월 뒤 이 지식이 답할 구체적인 질문이 있는가?
2. **지속성**: 일회성 상태가 아니라 6개월 뒤에도 의미가 남는 이유가 있는가?
3. **개인 연결**: 사용자 고유의 취향, 경험, 시스템, 업무 방식, 결정과 연결되는가?
4. **단일 소스**: 장기간 이 내용을 관리할 올바른 위치가 fos-brain인가?
5. **출처**: 사용자가 확인할 수 있는 세션, 파일, 문서, URL 같은 근거가 있는가?
6. **공개 범위**: public, private, company 가운데 민감도를 구분했는가?

하나라도 설명할 수 없으면 저장을 승인하지 않는다.
근거가 불충분한 후보는 보류하거나 `reject`로 판정하고, 추측으로 빈 필드를 채우지 않는다.

## 목적지와 제외 기준

| 후보 | 판정과 목적지 |
| --- | --- |
| 새로 저장할 개인 지식 | `admit`과 `public` 또는 `private` |
| 기존 문서에 새 근거나 의미를 더하는 개인 지식 | `reinforce`와 기존 문서의 `public` 또는 `private` |
| 회사 내부 시스템, 업무 기록, 내부 운영 지식 | `route`와 `nbrain` |
| 반복 실행 절차 | `route`와 `skill` |
| 저장소에만 적용되는 개발·운영 절차 | `route`와 `repo-docs` |
| 에이전트 행동 규칙과 지속할 지시 | `route`와 `agents` |
| 코드와 git으로 자명한 파일 구조, 함수 위치, 변경 이력 | `reject`와 `none` |
| 특정 PR, 배포, 장애 시점에만 유효한 일회성 상태 | `reject`와 `none` |
| 개인 맥락이 없는 일반 설명 | `reject`와 `none` |
| 좁은 장애 우회법 | 반복 절차면 `skill`이나 `repo-docs`, 일회성이면 `none` |

회사 자료는 공개 가능 여부와 상관없이 개인 brain의 public이나 private로 보내지 않는다.
회사 자료가 섞인 원본도 raw에 그대로 저장하지 않는다.
개인 지식만 독립적으로 분리할 수 있고 사용자가 확인한 경우에는 정제한 후보를 새로 판정한다.

## 판정 기록 계약

각 후보는 다음 필드를 모두 가진다.

| 필드 | 허용값과 의미 |
| --- | --- |
| `candidate` | 사용자가 판정 대상을 구분할 수 있는 제목 |
| `decision` | `admit`, `reinforce`, `route`, `reject` |
| `value_axes` | 저장 가치 축 배열. `admit`과 `reinforce`에서는 한 개 이상 |
| `future_question` | 6개월 뒤 답할 질문. `admit`과 `reinforce`에서는 비어 있지 않은 문자열 |
| `durability_reason` | 일회성이 아닌 이유. `admit`과 `reinforce`에서는 비어 있지 않은 문자열 |
| `destination` | `public`, `private`, `nbrain`, `skill`, `agents`, `repo-docs`, `none` |
| `source_of_truth` | 내용을 장기 관리할 책임이 있는 구체적인 위치 |
| `sensitivity` | `public`, `private`, `company` |
| `freshness` | `stable`, `review-date-required`, `historical` |
| `evidence` | 비어 있지 않은 출처 경로나 URL 배열 |
| `reason` | 저장, 보강, 이동, 제외 이유 |

`admit`과 `reinforce`는 `public` 또는 `private`만 목적지로 쓴다.
`sensitivity`와 개인 brain 목적지는 같아야 한다.
`company`는 항상 `route`와 `nbrain`을 함께 쓴다.
`route`는 `nbrain`, `skill`, `agents`, `repo-docs` 가운데 하나를 사용한다.
`reject`는 `none`을 사용한다.

`.agents/plugin/fos-brain/scripts/knowledge-admission-check.cjs`는 이 기록의 필드, 허용값, 조합만 검사한다.
검사 결과나 숫자 점수는 의미 적합성 판정이나 사용자 승인을 대신하지 않는다.

## 저장과 갱신 조건

brain-add와 brain-curate는 소스를 임시 위치에서 읽고 판정 미리보기를 먼저 제공한다.
사용자가 승인한 `admit`이나 `reinforce`가 있을 때만 해당 소스를 raw에 보존하고 wiki, INDEX, log, qmd를 갱신한다.
승인한 저장 후보가 없으면 raw, wiki, INDEX, log, qmd 상태를 모두 그대로 둔다.

brain-search의 환원 후보도 같은 정책으로 다시 판정하고 승인 전에는 쓰지 않는다.
brain-lint는 기존 문서를 같은 정책에 비춰 유지, 갱신, 병합, 보관, 삭제 후보로 분류한다.
brain-delete는 정책 판정을 삭제 사유로 받을 수 있지만 사용자 승인과 raw 보존 원칙을 계속 지킨다.
