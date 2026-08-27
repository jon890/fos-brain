# 지식 저장·검색·탐색 흐름

## 저장 흐름

1. `brain-add`나 `brain-curate`가 소스를 임시 위치에서 읽고 지식 후보를 만든다.
2. 각 후보가 6개월 뒤 답할 질문, 개인적 특수성, 적절한 단일 소스, 출처, 공개 범위를 갖췄는지 판정한다.
3. 후보를 `admit`, `reinforce`, `route`, `reject` 중 하나로 분류한다.
4. 회사 내부 지식은 nbrain으로, 실행 절차는 skill이나 저장소 문서로, 행동 규칙은 AGENTS.md로 보낸다.
5. 저장하거나 보강할 후보와 제외한 후보의 이유를 함께 미리보기로 보여준다.
6. 사용자가 승인한 `admit`과 `reinforce` 후보가 있을 때만 소스를 해당 네임스페이스의 `raw/`에 보존한다.
7. 기존 wiki를 검색해 새 페이지 생성과 기존 페이지 보강을 결정한다.
8. wiki 문서에 메타데이터와 출처를 기록하고 양방향 링크를 연결한다.
9. INDEX와 log를 갱신한 뒤 qmd 인덱스를 갱신한다.
10. 미래 질문으로 검색해 대상 문서가 상위 결과에 나오는지 확인한다.

승인할 후보가 없으면 raw, wiki, INDEX, log, qmd 상태를 바꾸지 않는다.
회사 내부 내용이 섞인 소스는 개인 brain에 원문째 저장하지 않는다.
개인 지식만 독립적으로 분리할 수 있고 사용자가 확인한 경우에만 정제한 새 소스로 다시 판정한다.
같은 의미의 문서가 있으면 새 페이지를 만들지 않고 새로운 사실이나 근거가 있을 때만 보강한다.
출처 신뢰도를 판단할 수 없으면 `verified: false`로 미리보기에 표시하고 사용자 결정 전에는 저장하지 않는다.

## 에이전트 검색 흐름

1. 질문에서 대상 네임스페이스를 결정한다.
2. public은 `brain-wiki`, private은 `brain-private` 컬렉션으로 각각 검색한다.
3. 각 네임스페이스의 상위 후보를 읽고 질문과 직접 관련된 근거를 고른다.
4. 후보 문서의 관련 개념 링크를 한 단계 따라가 누락된 전제와 반례를 찾는다.
5. 답변이 부족할 때만 해당 네임스페이스의 raw 원문으로 내려간다.
6. 답변에 네임스페이스와 문서 경로를 붙이고, brain 밖 지식은 분리해 밝힌다.

홈서버 Hermes는 `BRAIN_QMD_URL`이 있으면 `brain-qmd`의 `/query`를 먼저 호출한다.
HTTP를 사용할 수 없으면 로컬 고정 qmd를 시도하고, 그것도 실패하면 INDEX로 후보를 좁힌 뒤 `rg`로 본문을 찾는다.
후보가 없으면 지식이 없다고 명시하고 일반 지식과 혼합하지 않는다.
검색은 읽기 전용이므로 잠금이나 중복 쓰기 충돌을 만들지 않는다.
HTTP 요청은 같은 질문의 lex와 vec 검색, 복수형 `collections`, 결과 제한, rerank 선택을 전달한다.
`brain-qmd`가 갱신을 위해 잠시 중단되면 Hermes는 같은 brain mount를 이용한 로컬 폴백으로 검색을 계속한다.

## 사람의 탐색 흐름

1. Quartz 홈의 Memory Atlas에서 전체 노드와 연결 수를 확인한다.
2. 제목 검색이나 유형, 태그, 최신성, 네임스페이스 필터로 후보를 좁힌다.
3. 별자리, 군집, 궤도 배치와 색상 기준을 바꿔 관계를 다른 관점에서 확인한다.
4. 노드를 선택해 설명, 상태, 수정일, 태그, 들어오고 나가는 연결 수를 확인한다.
5. 원문 열기를 선택하면 같은 어두운 항해도 셸의 문서 화면으로 이동한다.
6. 문서 화면에서는 제목 아래의 신뢰 메타데이터와 읽을 수 있는 로컬 그래프, 백링크로 근거와 인접 관계를 읽는다.
7. 항해도로 돌아가기를 선택하면 이전 필터, 선택 노드, 카메라 위치를 복원한다.

메타데이터가 없는 항목은 표시하지 않되 페이지 자체는 정상 렌더한다.
`stale_after` 날짜가 되었거나 지났으면 최신성 경고를 보여준다.
날짜가 잘못되었으면 날짜 대신 경고 상태만 표시한다.

Memory Atlas는 콘텐츠 색인을 한 번 읽고 브라우저 안에서 필터와 배치를 계산한다.
필터 결과가 없으면 조건을 초기화하는 동작과 함께 빈 상태를 보여준다.
콘텐츠 색인을 읽지 못하거나 3D 렌더러를 초기화하지 못하면 오류 원인과 다시 시도 동작을 보여주고, 같은 데이터로 만든 문서 목록을 탐색 경로로 유지한다.
SPA 이동이나 필터 재적용이 겹치면 이전 렌더러와 애니메이션을 먼저 정리하고 마지막 상태만 화면에 남긴다.

모바일에서는 그래프가 화면을 채우고 작은 필터 버튼과 검색 막대만 그래프 위에 둔다.
필터는 왼쪽 서랍, 노드 상세는 아래 시트로 연다.
`Escape`는 상세 시트와 필터 서랍을 닫고, 검색과 모든 토글은 실제 HTML 입력 요소를 사용한다.
사용자가 움직임 줄이기를 선택했으면 자동 회전과 장식 애니메이션을 사용하지 않는다.

Cloudflare Access는 보호 사이트 진입 전에 인증을 끝낸다.
Memory Atlas는 별도 권한 API를 호출하지 않으며, 현재 빌드의 콘텐츠 색인에 포함된 네임스페이스만 보여준다.
public 빌드에는 private 노드가 없고 private 필터도 표시하지 않는다.

## Brain 근거 질문 흐름

1. 사용자가 Memory Atlas의 `Brain에게 묻기`를 열고 500자 이하 질문을 보낸다.
2. `brain-web`이 같은 출처의 `POST /api/brain/ask`를 내부 `brain-ask`로 전달한다.
3. `brain-ask`는 동시에 처리 중인 요청이 있는지 확인하고, 있으면 `busy`로 끝낸다.
4. `brain-ask`가 `brain-qmd`에 같은 질문의 키워드·벡터 검색을 요청한다.
5. 검색 결과에서 `brain-wiki`와 `brain-private`만 받아 최대 6개 문서를 고른다.
6. qmd URI를 허용된 읽기 전용 wiki 경로로 바꾸고, 각 문서와 전체 근거 크기를 제한해 본문을 읽는다.
7. 근거가 없으면 Hermes를 호출하지 않고 빈 근거 응답을 반환한다.
8. 근거가 있으면 전용 `brain-api`의 `/v1/responses`에 질문과 근거를 전달한다.
9. Hermes는 도구 없이 근거 안에서만 평문 답변을 만들고 대화를 저장하지 않는다.
10. `brain-ask`가 답변과 결정적으로 만든 출처 목록을 반환한다.
11. Memory Atlas는 답변을 평문으로 보여주고 패널이 열려 있는 동안 출처 노드를 강조한다.
12. 사용자가 패널을 닫으면 질문, 답변과 출처 강조를 모두 브라우저 메모리에서 지운다.

qmd 호출은 10초, Hermes 호출은 90초 안에 끝나야 한다.
qmd 장애, Hermes 장애, Hermes 시간 초과와 동시 요청은 서로 다른 오류 상태로 보여주며 다시 시도할 수 있다.
서버 로그에는 요청 식별자, 성공 여부, 단계별 시간과 근거 개수만 남긴다.
질문, 답변, 발췌문과 사용자 이메일은 기록하지 않는다.

## Hermes 프로필 전환 흐름

1. `/home/bifos/.hermes/profiles/brain-api`에 전용 프로필을 만들고 `brain` 모델 별칭과 API key를 설정한다.
2. 프로필의 모든 도구 모음을 끄고 `/v1/toolsets`에서 활성 도구가 없는지 확인한다.
3. `/v1/models`와 `/v1/responses`를 내부 연결에서 검사한다.
4. `brain-ask`와 Memory Atlas를 배포하고 실제 보호 URL에서 질문과 근거 이동을 검사한다.
5. 모든 검사가 통과한 뒤 `career-api` 프로필을 삭제하고 127.0.0.1:8643 연결과 운영 문서의 참조를 제거한다.
6. 프로필 목록, 수신 포트와 컨테이너 설정에서 `career-api`가 남지 않았는지 확인한다.

새 프로필 검증 전에는 기존 `career-api`를 유지한다.
새 경로가 실패하면 `brain-api`와 `brain-ask`만 중지하고 기존 정적 Memory Atlas release를 유지한다.

## Memory Atlas 배포 흐름

1. 로컬 단위 검사와 정적 빌드, 데스크톱·모바일 브라우저 검사를 모두 통과시킨다.
2. 작업 브랜치가 깨끗하고 원격 브랜치와 같은 커밋인지 확인한 뒤 홈서버에 detached public checkout을 만들고 기존 private checkout은 읽기 전용 입력으로 사용한다.
3. 기존 보호 배포 스크립트로 새 release를 만든 뒤 `current` 링크를 원자적으로 전환한다.
4. 기존 public checkout과 운영 설정은 바꾸지 않고, 실패하면 전환 전 `current` release로 되돌린다.
5. 인증 없는 새 브라우저에서는 홈과 `/_private/`가 Cloudflare Access로 차단되는지 확인한다.
6. 인증된 브라우저에서는 실제 URL의 홈, `/_private/`, 일반 문서를 확인하고 Memory Atlas의 3D runtime 요청 범위를 다시 검사한다.

로컬 검증이나 새 release 검증이 하나라도 실패하면 홈서버의 `current`를 바꾸지 않는다.
Cloudflare DNS, Access 정책, Tunnel, NPM 설정은 이 흐름에서 변경하지 않는다.

## OKF 내보내기 흐름

1. 명령이 public `wiki/`와 `raw/`만 읽는다.
2. concept, topic, entity 문서의 제목과 첫 설명 문단으로 누락된 교환용 메타데이터를 보완한다.
3. raw Markdown 사본에는 누락된 `type: Reference`만 추가하고 원본 본문과 wikilink는 보존한다.
4. Markdown 이외 raw 파일은 내용 변경 없이 복사한다.
5. 내부 `wiki/INDEX.md`는 `wiki/index.md`로 내보내고 `wiki/log.md`와 함께 예약 문서로 보존한다.
6. wiki의 bare-slug 링크를 내보내기 묶음 안의 상대 Markdown 링크로 바꾼다.
7. 묶음 루트에 `okf_version`만 frontmatter로 가진 `index.md`를 만든다.
8. 해석할 수 없는 wiki 링크가 있으면 성공으로 숨기지 않고 오류로 보고한다.

출력 경로가 이미 존재하면 명시적인 덮어쓰기 선택 없이는 중단한다.

## 홈서버 게시와 DNS 전환 흐름

1. hosting.kr의 A·TXT 레코드와 DNSSEC 상태를 내보내 전환 전 스냅샷으로 보관한다.
2. Cloudflare에 `fosworld.co.kr` 영역을 추가하고 자동 가져온 레코드를 스냅샷과 대조하되 네임서버는 유지한다.
3. 홈서버에서 public wiki만 Quartz로 빌드하고 정적 웹 컨테이너를 `public-net`에 연결한다.
4. Nginx Proxy Manager에 `brain.fosworld.co.kr` 프록시를 추가하고 정적 컨테이너까지의 내부 경로를 확인한다.
5. Tunnel에 apex와 각 하위 도메인의 공개 호스트 이름을 등록한다.
6. 이메일 일회용 PIN과 허용 계정 정책을 준비하고 Jenkins에서 GitHub HMAC-SHA256을 검증한다.
7. `brain`, `grafana`, `jenkins`, `npm`의 Tunnel 원본을 `http_status:503`으로 바꾸고 공개 호스트 네 개는 NPM 원본을 유지한다.
8. 보호 호스트의 격리를 확인한 뒤 hosting.kr의 권한 네임서버를 Cloudflare 값으로 교체한다.
9. Cloudflare 영역이 Active가 되면 보호 호스트 네 개의 Access 애플리케이션과 Jenkins 웹훅의 더 구체적인 Bypass 애플리케이션을 만든다.
10. Access 대상과 정책 우선순위를 확인한 뒤 보호 호스트의 Tunnel 원본을 NPM으로 복구한다.
11. NPM의 호스트별 인증서와 일치하는 SNI를 사용해 공개 호스트 이름 8개의 Tunnel 원본을 `https://fos-npm:443`으로 통일한다.
12. `brain` 인증서의 HTTP-01 갱신 경로만 더 구체적인 Access Bypass로 열고 나머지 경로의 Allow 정책을 유지한다.
13. 공개 서비스의 최종 응답, 실제 Access 로그인, Cloudflare 경유 웹훅을 검사한다.
14. 모든 검사가 통과한 뒤 NPM의 호스트 80·81·443 바인딩을 loopback으로 제한하고 원본 차단을 다시 확인한다.
15. Cloudflare DNSSEC를 활성화하고 등록기관에 DS를 반영한 뒤 재귀 확인자의 인증된 응답을 검사한다.

DNSSEC DS가 있으면 네임서버 변경 전에 제거하고 Cloudflare가 Active가 된 뒤 새 DS를 등록한다.
현재 DS가 없더라도 전환 직전 다시 확인한다.

## 요청 흐름

- 공개 요청은 Cloudflare edge에서 Tunnel을 거쳐 NPM의 HTTPS 원본과 기존 서비스로 전달한다.
- 보호 요청은 Access 정책을 통과한 뒤 같은 Tunnel과 NPM 경로를 사용한다.
- Jenkins 웹훅은 Access 로그인 없이 전달되지만 Jenkins 플러그인이 원문 body와 `X-Hub-Signature-256`을 검증한 뒤에만 작업을 찾는다.
- `brain` 요청은 NPM에서 Access로 보호된 public·private Quartz 정적 컨테이너로 전달한다.
- `brain`의 ACME challenge 경로만 인증서 자동 갱신을 위해 Access를 우회하며 일반 경로는 계속 Allow 정책을 적용한다.
- Hermes와 9119 요청은 Tunnel에 등록하지 않고 기존 SSH 포워딩만 사용한다.

Tunnel이 준비되지 않았거나 Jenkins HMAC 검증이 실패하면 네임서버를 바꾸지 않는다.
Active 전환 뒤 Access 생성이 실패하면 보호 호스트를 503으로 유지하고 원본 포트를 닫지 않는다.
네임서버 전환 뒤 장애가 나면 먼저 NPM의 80·81·443 공인 바인딩을 복구하고 Cloudflare DNS를 이전 A 레코드로 되돌린다.
Cloudflare 자체 장애가 길어지면 hosting.kr 권한 네임서버 복귀를 마지막 수단으로 사용한다.
동시에 두 전환 작업을 실행하지 않도록 DNS 스냅샷과 전환 기록을 단일 작업 디렉터리에서 관리한다.

## 보호 brain 갱신 흐름

1. 검증한 동기화·빌드 스크립트를 checkout 밖의 운영 경로에 설치하고 두 저장소 checkout을 clean `main`으로 맞춘다.
2. public 또는 private 저장소의 `main` push가 GitHub HMAC 웹훅으로 Jenkins `sync-brain` 작업을 호출한다.
3. 작업은 중복 실행 잠금을 잡고 두 저장소가 clean 상태인지 확인한 뒤 fast-forward만 허용해 갱신한다.
4. private 저장소가 없거나 분기됐거나 필수 INDEX가 비어 있으면 현재 산출물을 바꾸지 않고 실패한다.
5. 빌더는 public wiki를 기존 루트 경로에 두고 private wiki를 `/_private/` 아래에 둔 임시 Quartz 입력을 만든다.
6. 고정 Node 컨테이너가 새 release를 만들며 private raw와 회사 자료는 입력으로 받지 않는다.
7. 빌더는 public 기존 경로, private INDEX, private 문서 수, 금지 경로와 정적 파일을 검사한다.
8. 모든 검사가 통과하면 `current` 링크를 새 release로 원자적으로 바꾸고 Nginx가 같은 상위 디렉터리에서 새 산출물을 읽는다.
9. 보호 release 전환이 성공하면 Jenkins가 별도 단계에서 `brain-qmd` 색인 갱신을 시작한다.
10. 갱신 스크립트는 전용 잠금을 잡고 HTTP 컨테이너를 중지한 뒤 같은 image와 volume의 일회성 명령으로 `update`, `embed`를 실행한다.
11. 갱신 전 SQLite 색인을 백업하고 성공하면 HTTP 컨테이너를 다시 시작해 `/health`를 기다린다.
12. 보호 빌드가 실패하면 직전 `current`를 유지하며 운영자는 Jenkins에서 같은 작업을 다시 실행할 수 있다.
13. qmd 갱신이 실패하면 SQLite 백업을 복원하고 HTTP 컨테이너를 다시 시작한 뒤 Jenkins 작업만 불안정 상태로 표시한다.

두 저장소 push가 겹치면 뒤 작업이 잠금을 기다린다.
잠금을 얻은 작업은 두 저장소의 최신 `main`을 다시 읽으므로 중간 push를 하나의 최종 산출물로 합칠 수 있다.
Quartz 빌드는 웹 검색 색인을 갱신하고, 뒤따르는 별도 단계가 `brain-qmd` 임베딩을 증분 갱신한다.
개발 머신의 qmd 컬렉션은 홈서버 갱신 대상이 아니며 각 머신에서 독립적으로 관리한다.
