# 지식 데이터 계약

## 지식 후보 판정

지식 후보 판정은 미리보기와 스킬 사이에서 쓰는 임시 계약이다.
판정 자체를 wiki나 raw에 별도 지식으로 저장하지 않는다.

| 필드 | 형식 | 규칙 |
| --- | --- | --- |
| `candidate` | 문자열 | 사용자가 판정 대상을 구분할 수 있는 제목이다. |
| `decision` | `admit`, `reinforce`, `route`, `reject` | 저장, 기존 문서 보강, 다른 시스템으로 이동, 제외 중 하나다. |
| `value_axes` | 문자열 배열 | `work-style`, `taste`, `decision`, `personal-system`, `career`, `durable-domain` 중 하나 이상이다. `route`와 `reject`는 빈 배열일 수 있다. |
| `future_question` | 문자열 또는 `null` | 6개월 뒤 이 지식이 답할 구체적인 질문이다. `admit`과 `reinforce`에서는 필수다. |
| `durability_reason` | 문자열 또는 `null` | 일회성 기록이 아닌 이유다. `admit`과 `reinforce`에서는 필수다. |
| `destination` | `public`, `private`, `nbrain`, `skill`, `agents`, `repo-docs`, `none` | 실제 단일 소스다. |
| `source_of_truth` | 문자열 | 이 정보를 장기 관리할 책임이 있는 위치다. |
| `sensitivity` | `public`, `private`, `company` | 공개 범위 판정이다. |
| `freshness` | `stable`, `review-date-required`, `historical` | 최신성 관리 방식이다. |
| `evidence` | 문자열 배열 | 출처 경로나 URL이다. |
| `reason` | 문자열 | 저장, 이동, 제외 이유를 사용자가 이해할 수 있게 설명한다. |

`admit`과 `reinforce`는 `destination`이 `public` 또는 `private`여야 한다.
`company` 민감도는 항상 `route`와 `nbrain`을 사용한다.
실행 절차는 `skill`이나 `repo-docs`, 행동 규칙은 `agents`, 코드와 git으로 자명한 사실과 일회성 상태는 `none`으로 보낸다.
숫자 점수만으로 `admit`을 만들 수 없으며 사용자의 미리보기 승인이 필요하다.

## 내부 wiki frontmatter

기존 필수 필드는 계속 유지한다.
새로 만들거나 실질적으로 보강하는 문서는 검색과 표시 품질을 위해 권장 필드를 함께 기록한다.

| 필드 | 형식 | 규칙 |
| --- | --- | --- |
| `type` | `concept`, `topic`, `entity` | 필수이며 문서 유형과 일치한다. |
| `created` | `YYYY-MM-DD` | 필수이며 최초 생성일이다. |
| `updated` | `YYYY-MM-DD` | 필수이며 마지막 의미 변경일이다. |
| `title` | 문자열 | 권장하며 H1과 같은 의미를 가진다. |
| `description` | 문자열 | 권장하며 질문 없이도 문서 경계를 이해할 수 있는 한 문장이다. |
| `tags` | 문자열 배열 | 권장하며 동의어보다 안정된 주제 분류를 담는다. |
| `status` | `draft`, `stable`, `deprecated` | 선택이며 지식의 수명 상태를 나타낸다. |
| `stale_after` | `YYYY-MM-DD` | 선택이며 이 날짜부터 사실 갱신이 필요한 상태가 된다. |
| `sources` | 객체 배열 | 선택이며 필수 `resource`, 선택 `id`, 선택 `title`을 가진다. |
| `generated` | 객체 | 선택이며 `by`, `at`을 가진다. |
| `verified` | 객체 또는 객체 배열 | 선택이며 각 항목이 `by`, `at`을 가진다. |

`sources` frontmatter는 검색·교환용 구조 신호다.
사람이 원문으로 이동할 수 있도록 본문의 `## Sources`도 유지한다.

## 링크 계약

- 내부 wiki의 다른 페이지는 `[[bare-slug]]`로 연결한다.
- 내부 raw 출처는 기존 상대 경로 wikilink를 유지한다.
- OKF 내보내기에서는 두 형태를 묶음 내부의 상대 Markdown 링크로 변환한다.
- public 문서는 private slug나 경로를 참조할 수 없다.

## OKF 내보내기 묶음

내보내기 루트에는 `index.md`, `wiki/`, `raw/`가 있다.
루트 `index.md`의 frontmatter에는 `okf_version: "0.2"`만 기록한다.
내부 `wiki/INDEX.md`는 `wiki/index.md`로 내보내고 `wiki/log.md`와 함께 일반 지식 문서 메타데이터를 주입하지 않는다.
concept, topic, entity 문서는 필수 `type`을 가지며 검색과 표시를 위해 `title`, `description`도 보완한다.
이 문서들의 내보내기 시점과 도구는 `generated.by`, `generated.at`으로 기록한다.
raw Markdown은 원본을 바꾸지 않고 내보내기 사본에만 `type: Reference`를 보완한다.
raw 본문의 wikilink와 Markdown 이외 파일은 원본 그대로 보존한다.
내보내기는 기존 frontmatter 원문을 유지하고 최상위 키 존재 여부만 읽는다.
누락 필드는 JSON 문자열로 인용한 YAML scalar 또는 명시적인 YAML block으로 추가한다.
기존 중첩 객체와 배열을 해석하거나 다시 직렬화하지 않는다.

내부 스키마가 OKF의 모든 필드를 필수로 강제하지는 않는다.
OKF 규격 변경은 내보내기 계층에서 흡수하고 내부 링크와 네임스페이스 계약은 유지한다.

## 검색 벤치마크 fixture

각 항목은 다음 필드를 가진다.

| 필드 | 형식 | 규칙 |
| --- | --- | --- |
| `query` | 문자열 | 실제 에이전트가 받을 자연어 질문이다. |
| `collection` | 문자열 | 공개 fixture는 `brain-wiki`만 사용한다. |
| `expected_slugs` | 문자열 배열 | 상위 결과에 들어와야 하는 문서 slug다. |
| `top_k` | 정수 | 성공으로 인정할 최대 순위다. |

전체 성공률은 성공한 fixture 수를 전체 fixture 수로 나눈 값이다.
기본 통과선은 0.8이다.
fixture는 사용자의 qmd에 이미 등록된 `brain-wiki` 컬렉션을 대상으로 실행하는 검색 smoke다.
worktree 전용 임시 collection을 만들거나 전역 qmd 설정을 변경하지 않는다.

## 운영 구성 저장 경계

public 저장소의 구조화 설정은 애플리케이션 동작에 필요한 이름과 형식만 정의한다.
실제 host 경로, service 주소, image, secret 파일, proxy와 webhook 설정은 private 인프라 저장소에서 관리한다.

## brain-qmd HTTP 입력과 출력

검색 client는 `POST /query`에 다음 값을 보낸다.

| 필드 | 형식 | 규칙 |
| --- | --- | --- |
| `searches` | 객체 배열 | 같은 질문의 `lex`, `vec`를 포함한다. |
| `collections` | 문자열 배열 | `brain-wiki`, `brain-raw`, `brain-private` 중 하나 이상이다. 단수형 `collection`은 쓰지 않는다. |
| `limit` | 정수 | 기본값 5이며 1에서 20 사이다. |
| `rerank` | boolean | CPU 실측 전 기본값은 `false`다. |

응답은 `results` 배열이며 각 항목은 `docid`, `file`, `title`, `score`, `line`, `snippet`을 가진다.
`file`은 `qmd://<collection>/<path>` 형식이어야 하며 허용하지 않은 collection이면 client가 실패한다.
`GET /health`는 `status: ok`를 반환한다.

## Memory Atlas 콘텐츠 색인

정적 `/static/contentIndex.json`의 문서 항목은 기존 검색 필드에 다음 선택 필드를 더한다.
필드가 없거나 잘못되면 해당 필터 신호만 생략하고 노드는 유지한다.

| 필드 | 형식 | 규칙 |
| --- | --- | --- |
| `description` | 문자열 | frontmatter 설명이며 노드 상세에 사용한다. |
| `type` | `concept`, `topic`, `entity` | 기존 정규화 결과를 사용한다. |
| `status` | `draft`, `stable`, `deprecated` | 잘못된 값은 생략한다. |
| `freshness` | `{ date?: string, state: current\|stale\|invalid }` | `stale_after`의 날짜와 판정 결과다. |
| `updated` | ISO 8601 문자열 | Quartz가 선택한 수정일을 직렬화한다. |
| `sourceCount` | 0 이상의 정수 | 유효한 `sources` 항목 수다. |

브라우저는 slug가 `_private/`로 시작하면 private, 아니면 public 네임스페이스로 계산한다.
공개 빌드에는 `_private/` 입력이 없으므로 private 항목과 필터가 생성되지 않는다.

Memory Atlas의 연결은 기존 `links` 배열에서 대상 slug가 현재 색인에 있는 항목만 사용한다.
중복된 source와 target 쌍은 하나로 합치며 self-link는 제외한다.
supports나 contradicts 같은 의미 연결 유형은 현재 wiki에 저장된 근거가 없으므로 생성하지 않는다.

브라우저 상태는 다음 값을 메모리에만 보관하며 wiki와 콘텐츠 색인을 수정하지 않는다.

| 필드 | 값 | 기본값 |
| --- | --- | --- |
| `query` | 문자열 | 빈 문자열 |
| `lens` | `all`, `topic`, `type`, `freshness`, `namespace` | `all` |
| `types` | 지식 유형 집합 | 전체 |
| `tags` | 태그 집합 | 전체 |
| `freshness` | 최신성 상태 집합 | 전체 |
| `namespaces` | `public`, `private` 집합 | 현재 색인의 전체 |
| `layout` | `constellation`, `cluster`, `orbit` | `constellation` |
| `colorBy` | `type`, `freshness`, `namespace` | `type` |
| `spacing` | `compact`, `normal`, `wide` | `normal` |
| `labels` | boolean | `true` |
| `selectedSlug` | slug 또는 없음 | 없음 |

검색은 제목과 태그의 대소문자를 구분하지 않는 부분 일치다.
필터 묶음 사이는 AND, 같은 필터 묶음의 선택값 사이는 OR로 결합한다.

## Brain 근거 질문 API

같은 출처의 `POST /api/brain/ask`는 `application/json`만 받는다.

요청은 다음 필드 하나를 가진다.

| 필드 | 형식 | 규칙 |
| --- | --- | --- |
| `question` | 문자열 | 앞뒤 공백을 제거한 뒤 1자 이상 500자 이하다. |

성공 응답은 다음 형태다.

| 필드 | 형식 | 규칙 |
| --- | --- | --- |
| `requestId` | 문자열 | 로그와 사용자 오류를 연결하는 임시 식별자다. |
| `answer` | 문자열 | 근거가 없으면 빈 문자열이며 HTML로 해석하지 않는다. |
| `sources` | 객체 배열 | qmd 순서를 유지한 최대 6개 근거다. |
| `sources[].title` | 문자열 | wiki 문서 제목이다. |
| `sources[].slug` | 문자열 | 콘텐츠 색인과 그래프 노드를 연결하는 slug다. |
| `sources[].namespace` | `public`, `private` | 출처 네임스페이스다. |
| `sources[].score` | 숫자 | qmd가 반환한 관련도다. |
| `sources[].excerpt` | 문자열 | qmd 발췌문을 정규화한 짧은 평문이다. |
| `sources[].href` | 문자열 | 같은 보호 사이트 안의 wiki 문서 경로다. |

오류 응답은 `requestId`, `error.code`, `error.message`, `error.retryable`을 가진다.

| HTTP | `error.code` | 의미 |
| --- | --- | --- |
| 400 | `invalid_question` | 요청 형식이나 질문 길이가 잘못되었다. |
| 429 | `busy` | 다른 질문 한 건을 처리하고 있다. |
| 502 | `retrieval_unavailable` | qmd에서 근거를 가져오지 못했다. |
| 502 | `model_unavailable` | 모델 API가 응답을 만들지 못했다. |
| 504 | `model_timeout` | 모델 API가 90초 안에 끝나지 않았다. |

빈 근거는 오류가 아니다.
`answer`가 빈 문자열이고 `sources`가 빈 배열인 200 응답으로 반환한다.

## Brain 근거 구성

`brain-ask`는 qmd에 `brain-wiki`, `brain-private` 두 collection의 키워드·벡터 검색을 요청한다.
`limit`는 6이고 `rerank`는 `false`다.
`brain-raw`와 private raw는 이 API에서 사용할 수 없다.

| 제한 | 값 | 처리 |
| --- | --- | --- |
| qmd 호출 시간 | 10초 | 넘으면 `retrieval_unavailable`이다. |
| 모델 API 호출 시간 | 90초 | 넘으면 `model_timeout`이다. |
| 문서 수 | 최대 6개 | 초과 결과는 읽지 않는다. |
| 문서별 본문 | 최대 8 KiB | UTF-8 경계에서 잘라 근거에 넣는다. |
| 전체 본문 | 최대 32 KiB | qmd 순서대로 채우고 이후 문서는 제외한다. |
| 동시 요청 | 1개 | 처리 중 새 요청은 `busy`다. |

qmd의 `qmd://brain-wiki/<path>`는 public wiki 읽기 전용 mount로, `qmd://brain-private/<path>`는 private wiki 읽기 전용 mount로 바꾼다.
다른 collection, 절대 경로, `..`, mount 밖으로 나가는 심볼릭 링크는 거부한다.
출처 `href`는 public이면 기존 slug 경로, private이면 `/_private/` 아래 경로로 만든다.

모델 요청은 `/v1/responses`에 `model: brain`, `store: false`를 보낸다.
이전 응답이나 conversation 식별자는 보내지 않으며 도구 호출 결과를 받을 수 없다.

## Brain 질문 실행 설정

`brain-ask`는 qmd URL, 모델 API URL, key 파일과 public·private wiki root를 runtime 설정으로 받는다.
public 문서는 변수의 역할만 정의하며 실제 주소, port, host 경로와 profile 전환 규칙을 기록하지 않는다.
질문, 답변과 출처 본문은 영구 데이터가 아니며 서버 재시작 뒤 복원하지 않는다.
