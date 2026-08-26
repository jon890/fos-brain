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

## 홈서버 배포 구성

### 추적 가능한 변수

| 이름 | 형식 | 규칙 |
| --- | --- | --- |
| `BRAIN_REPO` | 절대 경로 | 홈서버의 public fos-brain checkout이며 기본값은 `/home/bifos/personal/fos-brain`이다. |
| `HOST_UID` | 정수 | Quartz 산출물을 소유할 홈서버 사용자 UID다. |
| `HOST_GID` | 정수 | Quartz 산출물을 소유할 홈서버 사용자 GID다. |
| `CLOUDFLARED_IMAGE` | digest가 포함된 이미지 | 검증한 `cloudflare/cloudflared` 다중 아키텍처 digest를 사용한다. |
| `NGINX_IMAGE` | digest가 포함된 이미지 | 검증한 `nginx` stable-alpine digest를 사용한다. |
| `PRIVATE_BRAIN_REPO` | 절대 경로 | 독립 private 저장소이며 기본값은 `${BRAIN_REPO}/private`다. |
| `PROTECTED_OUTPUT_ROOT` | 절대 경로 | 보호 산출물의 `releases/`와 `current`를 담으며 기본값은 `${BRAIN_REPO}/quartz-protected`다. |
| `BRAIN_SYNC_LOCK` | checkout 밖 절대 경로 | public·private push의 중복 빌드를 직렬화하며 `BRAIN_DEPLOY_ROOT` 아래에 둔다. |
| `BRAIN_DEPLOY_ROOT` | 절대 경로 | 검증한 동기화·빌드 스크립트와 Jenkins 작업 정의를 설치하는 운영 경로다. |
| `BRAIN_QMD_CONTAINER` | 컨테이너 이름 | 검색 HTTP 서비스이며 기본값은 `brain-qmd`다. |
| `BRAIN_QMD_DATA_DIR` | 절대 경로 | qmd 설정, SQLite 색인, 모델 cache를 담으며 기본값은 `/home/bifos/.brain-qmd`다. |
| `BRAIN_QMD_URL` | 내부 URL | Hermes가 호출하는 주소이며 `http://brain-qmd:8181`이다. |
| `BRAIN_QMD_COMPOSE` | 절대 경로 | 검증된 `brain-qmd` compose 파일을 가리킨다. |
| `QMD_VERSION` | 고정 버전 | image에 설치하는 qmd 버전이며 `2.8.3`이다. |
| `QMD_SYNC_LOCK` | checkout 밖 절대 경로 | 색인 갱신을 직렬화하며 `BRAIN_QMD_DATA_DIR` 아래에 둔다. |

### 비밀값

| 이름 | 저장 위치 | 삭제·회전 규칙 |
| --- | --- | --- |
| `TUNNEL_TOKEN` | 홈서버 `deploy/home-server/.env`, 권한 600 | Tunnel을 재생성하거나 노출이 의심되면 Cloudflare에서 교체한다. git과 로그에 출력하지 않는다. |
| Access 허용 이메일 | Cloudflare Access 정책 | git에 기록하지 않는다. 계정 변경 시 정책에서 교체한다. |
| GitHub webhook HMAC secret | GitHub webhook 설정과 Jenkins Secret Text credential | 저장소와 URL에 넣지 않는다. 모든 발신 webhook을 갱신한 뒤 Jenkins 검증 값을 교체한다. |

### 호스트 정책

| 호스트·경로 | 공개 범위 | Access | Tunnel 원본 |
| --- | --- | --- | --- |
| `fosworld.co.kr` | 누구나 | 없음 | `https://fos-npm:443` |
| `blog.fosworld.co.kr` | 누구나 | 없음 | `https://fos-npm:443` |
| `accountbook.fosworld.co.kr` | 누구나 | 없음 | `https://fos-npm:443` |
| `accountbook-api.fosworld.co.kr` | 누구나 | 없음 | `https://fos-npm:443` |
| `brain.fosworld.co.kr` | 허용 계정 | 이메일 일회용 PIN | 평상시 `https://fos-npm:443`, 전환 격리 `http_status:503` |
| `brain.fosworld.co.kr/.well-known/acme-challenge/*` | 인증서 발급 기관 | Bypass | `https://fos-npm:443` |
| `grafana.fosworld.co.kr` | 허용 계정 | 이메일 일회용 PIN | 평상시 `https://fos-npm:443`, 전환 격리 `http_status:503` |
| `jenkins.fosworld.co.kr/*` | 허용 계정 | 이메일 일회용 PIN | 평상시 `https://fos-npm:443`, 전환 격리 `http_status:503` |
| `jenkins.fosworld.co.kr/generic-webhook-trigger/*` | GitHub webhook | Bypass와 HMAC-SHA256 | 평상시 `https://fos-npm:443`, 전환 격리 `http_status:503` |
| `npm.fosworld.co.kr` | 허용 계정 | 이메일 일회용 PIN | 평상시 `https://fos-npm:443`, 전환 격리 `http_status:503` |

Tunnel의 각 호스트 항목은 원래 호스트 이름을 `originServerName`과 `httpHostHeader`로 전달한다.
NPM은 각 이름과 일치하는 인증서를 제공하며 Tunnel은 인증서 검증을 끄지 않는다.
등록되지 않은 호스트는 404로 끝난다.
Pending 영역에서는 Access self-hosted 애플리케이션 생성이 오류 12130으로 거부될 수 있다.
이때 보호 호스트를 503으로 격리한 뒤 영역이 Active가 되어 Access 애플리케이션과 Bypass 저장 상태를 확인할 때까지 NPM 원본을 복구하지 않는다.
기존 apex·하위 도메인의 A 레코드는 Tunnel CNAME으로 교체하고 TXT 두 개는 값과 TTL을 그대로 유지한다.
폐기한 `career`와 `nreview` 레코드는 다시 만들지 않는다.
최종 권한 DNS는 Cloudflare의 CNAME 8개와 TXT 2개를 제공한다.
Cloudflare DNSSEC 상태와 등록기관 DS를 함께 유지하며 재귀 확인 결과에는 인증된 데이터 표시가 있어야 한다.
NPM 호스트 포트 80·81·443은 loopback에만 바인딩하고 Tunnel의 `public-net` 연결은 유지한다.

배포 중 생성하는 DNS 스냅샷, Tunnel token, Access 계정, HMAC secret은 git 추적 대상이 아니다.
정적 산출물 `quartz/public`도 기존대로 gitignore 상태를 유지한다.

## 보호 Quartz 산출물

| 경로 | 내용 | 규칙 |
| --- | --- | --- |
| `quartz-protected/releases/<release-id>/` | public·private wiki의 Quartz 정적 파일 | gitignore 대상이며 빌드 성공 뒤에만 활성화한다. |
| `quartz-protected/current` | 활성 release를 가리키는 상대 심볼릭 링크 | 같은 상위 디렉터리 안에서 원자적으로 교체한다. |
| `/concepts`, `/topics`, `/entities` | public wiki의 기존 URL | 보호 빌드 전환 전후에 경로를 유지한다. |
| `/_private/` | private wiki URL prefix | Access Allow 정책 안에서만 제공한다. |

`release-id`는 public과 private commit 식별자와 UTC 빌드 시각으로 만든다.
release에는 public과 private의 컴파일된 wiki만 들어가며 두 네임스페이스의 raw와 모든 회사 자료를 포함하지 않는다.
private INDEX가 없거나 private Markdown 수가 0이면 새 release를 활성화하지 않는다.

## 보호 brain 웹훅 입력

| 필드 | 허용값 | 실패 처리 |
| --- | --- | --- |
| `repository.full_name` | `jon890/fos-brain`, `jon890/fos-brain-private` | 다른 저장소는 작업 대상에서 제외한다. |
| `ref` | `refs/heads/main` | 다른 branch push는 작업 대상에서 제외한다. |
| `X-Hub-Signature-256` | Jenkins HMAC 검증 성공 | 누락하거나 일치하지 않으면 403으로 끝낸다. |

Jenkins는 동시에 하나의 `sync-brain`만 실행한다.
작업은 두 checkout이 clean이고 원격 `main`으로 fast-forward할 수 있을 때만 빌드를 시작한다.
성공한 보호 배포 뒤 `sync-brain-qmd`를 실행하며, 이 후속 단계만 실패하면 활성 release를 되돌리지 않는다.

## brain-qmd 영구 데이터와 mount

| 경로 | 내용 | 규칙 |
| --- | --- | --- |
| `/home/bifos/.brain-qmd/config/qmd/index.yml` | 컬렉션 설정 | public wiki, public raw, private wiki의 container 경로만 등록한다. |
| `/home/bifos/.brain-qmd/cache/qmd/index.sqlite*` | SQLite 색인과 WAL·SHM | 상위 `/home/bifos/.brain-qmd`를 mode 700으로 유지하고 git과 Quartz 입력에서 제외한다. |
| `/home/bifos/.brain-qmd/cache/qmd/models/` | 임베딩 모델 cache | 최초 sync에서 내려받고 이후 재사용한다. |
| `/tmp/brain-qmd-sqlite-backup.*` | 중지된 색인의 임시 복구본 | sync 성공이나 복구 완료 뒤 제거한다. |
| `/home/bifos/apps/fos-brain-deploy/sync-qmd.lock` | 색인 갱신 잠금 | 동시에 하나의 Jenkins 갱신만 실행한다. |

qmd container는 `XDG_CONFIG_HOME=/data/config`, `XDG_CACHE_HOME=/data/cache`를 사용한다.
private 문서 본문, 검색어, 검색 결과는 Jenkins 로그에 출력하지 않는다.

| host 경로 | brain-qmd 경로 | 접근 |
| --- | --- | --- |
| `/home/bifos/.brain-qmd` | `/data` | UID와 GID 1000 쓰기 |
| `/home/bifos/personal/fos-brain/wiki` | `/brain/public/wiki` | 읽기 전용 |
| `/home/bifos/personal/fos-brain/raw` | `/brain/public/raw` | 읽기 전용 |
| `/home/bifos/personal/fos-brain/private/wiki` | `/brain/private/wiki` | 읽기 전용 |

private raw는 mount와 컬렉션에서 제외한다.
HTTP container와 일회성 sync container는 동시에 실행하지 않는다.

## brain-qmd HTTP 입력과 출력

Hermes는 `POST /query`에 다음 값을 보낸다.

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
