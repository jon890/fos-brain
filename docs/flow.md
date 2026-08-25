# 지식 저장·검색·탐색 흐름

## 저장 흐름

1. `brain-add`가 새 원본을 선택한 네임스페이스의 `raw/`에 보존한다.
2. 기존 wiki를 검색해 새 페이지 생성과 기존 페이지 보강을 결정한다.
3. wiki 문서에 기본 메타데이터와 출처를 기록하고 양방향 링크를 연결한다.
4. INDEX와 log를 갱신한 뒤 qmd 인덱스를 갱신한다.
5. 대표 질의에서 대상 문서가 상위 결과에 나오는지 확인한다.

원본이 없거나 출처 신뢰도를 판단할 수 없으면 wiki 반영 전에 사용자 검토 흐름으로 돌아간다.

## 에이전트 검색 흐름

1. 질문에서 대상 네임스페이스를 결정한다.
2. public은 `brain-wiki`, private은 `brain-private` 컬렉션으로 각각 검색한다.
3. 각 네임스페이스의 상위 후보를 읽고 질문과 직접 관련된 근거를 고른다.
4. 후보 문서의 관련 개념 링크를 한 단계 따라가 누락된 전제와 반례를 찾는다.
5. 답변이 부족할 때만 해당 네임스페이스의 raw 원문으로 내려간다.
6. 답변에 네임스페이스와 문서 경로를 붙이고, brain 밖 지식은 분리해 밝힌다.

qmd가 없거나 실패하면 INDEX로 후보를 좁힌 뒤 `rg`로 본문을 찾는다.
후보가 없으면 지식이 없다고 명시하고 일반 지식과 혼합하지 않는다.
검색은 읽기 전용이므로 잠금이나 중복 쓰기 충돌을 만들지 않는다.

## 사람의 탐색 흐름

1. Quartz 페이지의 제목 아래에서 설명과 지식 유형을 확인한다.
2. 상태와 최신성 표시로 검토가 필요한 문서인지 판단한다.
3. 출처 수와 생성·검증 정보를 보고 신뢰 수준을 판단한다.
4. 유형별 색과 범례가 있는 로컬 그래프로 인접 concept, topic, entity를 찾는다.
5. 관련 개념, 백링크, 전체 그래프로 범위를 넓힌다.

메타데이터가 없는 항목은 표시하지 않되 페이지 자체는 정상 렌더한다.
`stale_after` 날짜가 되었거나 지났으면 최신성 경고를 보여준다.
날짜가 잘못되었으면 날짜 대신 경고 상태만 표시한다.

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
9. 실패하면 직전 `current`를 유지하며 운영자는 Jenkins에서 같은 작업을 수동으로 다시 실행할 수 있다.

두 저장소 push가 겹치면 뒤 작업이 잠금을 기다린다.
잠금을 얻은 작업은 두 저장소의 최신 `main`을 다시 읽으므로 중간 push를 하나의 최종 산출물로 합칠 수 있다.
Quartz 빌드는 웹 검색 색인을 갱신하지만 Codex가 로컬에서 쓰는 qmd 임베딩은 변경하지 않는다.
