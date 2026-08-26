# fos-brain 제품 요구사항

## 목적

fos-brain은 에이전트가 필요한 개인 지식을 빠르게 찾고, 사람이 같은 지식을 관계와 근거까지 읽을 수 있게 하는 지식 기반이다.

## 핵심 사용자

- 에이전트 — 공개·비공개 네임스페이스에서 질문에 맞는 컴파일된 지식을 찾고 근거까지 추적한다.
- 사람 — Quartz에서 문서의 의미, 상태, 출처, 연결 관계를 한눈에 파악한다.

## 이번 범위

### 지식 품질 계약

- fos-brain은 에이전트가 사용자를 장기간 이해하는 데 필요한 개인 지식만 저장한다.
- 업무 방식과 하네스, 개인 취향, 결정과 근거, 관리하는 개인 서비스, 이력과 경험처럼 6개월 뒤에도 질문에 답할 수 있는 내용을 우선한다.
- 단순 설명, 일회성 작업, 코드와 git으로 확인할 수 있는 사실, 실행 절차, 좁은 장애 우회법은 wiki와 raw에 저장하지 않는다.
- 회사·팀 내부 자료는 public과 private 어느 쪽에도 저장하지 않고 nbrain으로 보낸다.
- 후보마다 저장, 기존 문서 보강, 다른 시스템으로 이동, 제외 중 하나를 판정하고 이유를 미리보기에 남긴다.
- 저장 후보가 하나도 없으면 raw, wiki, INDEX, log를 바꾸지 않는다.

### 에이전트 검색

- 공개와 비공개 컬렉션을 분리해 검색하고 결과에 네임스페이스를 유지한다.
- 홈서버의 Hermes는 내부 전용 `brain-qmd` HTTP 서비스에서 같은 세 컬렉션을 검색한다.
- 컴파일된 wiki를 먼저 검색하고, 부족할 때만 raw 원문으로 내려간다.
- 관련 문서의 링크를 한 단계 따라가며 단순 상위 결과보다 관계 맥락을 보강한다.
- 대표 질문 묶음으로 의도한 문서가 상위 결과에 나오는지 반복 측정한다.
- public 또는 private `main` push 뒤 보호 Quartz 배포가 성공하면 `brain-qmd` 색인을 증분 갱신한다.
- qmd를 사용할 수 없거나 결과가 비어도 INDEX와 본문 검색으로 축소 동작한다.

### 사람의 지식 탐색

- 각 문서에서 유형, 설명, 상태, 최신성, 생성·검증 주체, 출처 수를 확인한다.
- 그래프에서 concept, topic, entity를 색으로 구분하고 범례를 제공한다.
- 기존 세 필드 문서도 깨지지 않고 유형과 수정일을 보여준다.
- 홈에서는 전체 지식 그래프를 화면의 중심에 두고 검색, 필터, 배치 변경, 노드 상세 확인을 한 흐름으로 제공한다.
- public 빌드는 공개 지식만 보여주고, 보호 빌드는 같은 화면에서 public과 private를 구분해 탐색한다.
- 문서 화면은 같은 어두운 Memory Atlas 셸에서 읽기와 근거 확인에 집중하고, 항상 전체 그래프로 돌아갈 수 있다.

### OKF 호환

- 내부 wiki는 Quartz에 필요한 `[[bare-slug]]` 링크를 계속 사용한다.
- 새 문서는 OKF v0.2와 겹치는 메타데이터를 점진적으로 기록한다.
- 외부 교환이 필요할 때 별도 내보내기 명령이 표준 Markdown 링크를 가진 OKF 묶음을 만든다.
- 내보내기는 public만 대상으로 하며 private 자료를 포함하지 않는다.
- public raw Markdown은 원본을 바꾸지 않고 내보내기 사본에서 `Reference` 문서로 취급한다.

### 홈서버 게시와 접근 제어

- public 전용 빌드는 private 네임스페이스를 계속 제외한다.
- Access로 보호하는 `brain.fosworld.co.kr`에는 public과 private의 컴파일된 wiki를 하나의 Quartz 그래프로 게시한다.
- 보호 산출물은 private raw와 회사 자료를 포함하지 않으며 public 산출물과 다른 경로에 보관한다.
- Cloudflare Tunnel의 outbound 연결로 홈서버를 공개하며, `brain`, Grafana, Jenkins, Nginx Proxy Manager는 Cloudflare Access 인증 뒤에 둔다.
- `fosworld.co.kr`, `blog`, `accountbook`, `accountbook-api`는 로그인 없이 계속 공개한다.
- Jenkins 웹훅 경로만 Access 인증에서 제외하고 Generic Webhook Trigger의 HMAC-SHA256 검증을 필수로 한다.
- hosting.kr은 등록기관으로 유지하고 권한 DNS만 Cloudflare full setup으로 전환한다.
- Tunnel의 공개 호스트 이름 8개는 Nginx Proxy Manager의 HTTPS 원본으로 연결하고 호스트별 인증서를 검증한다.
- Cloudflare DNSSEC와 등록기관 DS를 연결해 재귀 확인자의 인증된 응답을 유지한다.
- 폐기된 `career`와 `nreview`는 DNS, 프록시, Tunnel, 컨테이너, 예약 작업에서 제외한다.

## 성공 기준

- brain-add와 brain-curate가 같은 지식 유입 정책을 읽고 저장 전 판정을 수행한다.
- brain-lint가 기존 문서가 지식 유입 정책에 맞는지 품질 점검에서 분류한다.
- 회사 지식, 절차, 일회성 기록, 일반 설명을 개인 brain에 넣지 않는 대표 시나리오를 반복 검사한다.
- 공개 대표 질문의 80% 이상에서 기대 문서가 상위 3개 안에 나온다.
- 검색 절차가 공개·비공개 결과를 섞지 않고, 답변 근거에 네임스페이스를 표시한다.
- Hermes 컨테이너의 `brain-search`가 내부 HTTP로 `brain-wiki`, `brain-raw`, `brain-private`를 검색한다.
- `brain-qmd`는 호스트 포트를 열지 않고 Hermes와의 전용 Docker network에만 연결된다.
- `brain-search`는 HTTP 실패 시 로컬 고정 qmd, INDEX와 본문 검색 순서로 축소 동작한다.
- qmd 갱신 실패는 성공한 Quartz release를 되돌리지 않으며 Jenkins에서 별도 실패 단계로 확인할 수 있다.
- qmd 설정, 색인, 모델 cache와 private 검색 결과는 git 및 공개 Quartz 산출물에 포함되지 않는다.
- OKF 내보내기 결과의 concept, topic, entity 문서에 `type`, `title`, `description`이 있고 내부 링크가 표준 Markdown 링크다.
- 묶음의 `index.md`와 `log.md`는 OKF v0.2의 예약 문서 계약을 따른다.
- 예약 문서를 제외한 모든 Markdown은 비어 있지 않은 `type`을 가진다.
- Quartz 형 검사와 공개 빌드가 통과한다.
- 메타데이터가 적은 기존 페이지와 새 메타데이터 페이지가 모두 렌더된다.
- 인증하지 않은 사용자는 보호 호스트에서 Cloudflare Access 로그인으로 이동하고, 허용 계정만 접근한다.
- Jenkins 웹훅은 올바른 `X-Hub-Signature-256` 요청만 통과하며 일반 Jenkins 화면은 계속 Access로 보호된다.
- Tunnel 전환 뒤 홈서버의 공인 80·81·443 포트는 닫히고 SSH 10022와 기존 SSH 터널 사용은 유지된다.
- 공개 호스트는 전환 전후의 대표 경로에서 기존 성공·리다이렉트·권한 응답을 유지한다.
- DNSSEC 검증 응답에는 AD(Authenticated Data) 표시가 있고 Cloudflare 영역은 Active 상태를 유지한다.
- 보호 brain의 기존 public URL은 유지되고 private 문서는 `/_private/` 아래에서 렌더된다.
- public 또는 private 저장소의 `main` push 뒤 Jenkins가 보호 산출물을 갱신하며 실패하면 직전 산출물을 유지한다.
- 보호 산출물과 정적 서버에서 private raw, 회사 네임스페이스, 호스트 공개 포트가 발견되지 않는다.
- 홈에서 3D 그래프를 회전·확대·이동하고 노드를 선택해 상세 정보와 원문 링크를 확인할 수 있다.
- 제목 검색과 유형, 태그, 최신성, 네임스페이스 필터가 그래프와 집계에 같은 결과를 적용한다.
- 별자리, 군집, 궤도 배치와 유형, 최신성, 네임스페이스 색상 기준을 전환할 수 있다.
- 그래프 초기화 실패나 결과가 없는 조건에서도 검색 가능한 문서 목록과 원문 이동 경로를 제공한다.
- 390px 모바일 화면에서 필터 서랍과 노드 상세 시트를 키보드와 터치로 사용할 수 있다.
- 1440px 데스크톱과 390px 모바일에서 그래프와 보이는 조작 요소가 viewport를 벗어나거나 잘리지 않는다.
- 문서 화면에서 항해도로 돌아오면 이전 선택과 그래프 카메라 상태를 복원한다.

## 범위 밖

- 이번 변경에서 기존 wiki를 일괄 삭제하거나 다시 분류하지 않는다.
- 의미 적합성을 숫자 점수만으로 자동 승인하지 않는다.
- 별도 벡터 데이터베이스나 GraphRAG 서비스를 도입하지 않는다.
- 100여 개 기존 페이지의 메타데이터를 한 번에 채우지 않는다.
- private 저장소를 공개 산출물에 포함하지 않는다.
- private raw 원본을 원격 Quartz에 게시하지 않는다.
- 검색 결과를 사용자 승인 없이 wiki에 자동 환원하지 않는다.
- Cloudflare를 도메인 등록기관으로 이전하지 않는다.
- Hermes와 9119 포트를 Cloudflare Tunnel에 연결하지 않는다.
- 위키 링크에 supports, contradicts 같은 의미 연결 유형을 추정해 저장하지 않는다.
- 이번 화면에서 에이전트 질의 API나 대화형 답변 서비스를 새로 만들지 않는다.
- qmd HTTP를 호스트 포트, Cloudflare Tunnel, 공개 Docker network에 노출하지 않는다.
- 이번 변경에서는 qmd 앞에 별도 Node proxy나 인증 서버를 만들지 않는다.
- 이번 변경에서는 기존 qmd 임베딩 모델을 교체하지 않는다.
