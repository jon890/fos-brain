# fos-brain 제품 요구사항

## 목적

fos-brain은 에이전트가 필요한 개인 지식을 빠르게 찾고, 사람이 같은 지식을 관계와 근거까지 읽을 수 있게 하는 지식 기반이다.

## 핵심 사용자

- 에이전트 — 공개·비공개 네임스페이스에서 질문에 맞는 컴파일된 지식을 찾고 근거까지 추적한다.
- 사람 — Quartz에서 문서의 의미, 상태, 출처, 연결 관계를 한눈에 파악한다.

## 이번 범위

### 에이전트 검색

- 공개와 비공개 컬렉션을 분리해 검색하고 결과에 네임스페이스를 유지한다.
- 컴파일된 wiki를 먼저 검색하고, 부족할 때만 raw 원문으로 내려간다.
- 관련 문서의 링크를 한 단계 따라가며 단순 상위 결과보다 관계 맥락을 보강한다.
- 대표 질문 묶음으로 의도한 문서가 상위 결과에 나오는지 반복 측정한다.
- qmd를 사용할 수 없거나 결과가 비어도 INDEX와 본문 검색으로 축소 동작한다.

### 사람의 지식 탐색

- 각 문서에서 유형, 설명, 상태, 최신성, 생성·검증 주체, 출처 수를 확인한다.
- 그래프에서 concept, topic, entity를 색으로 구분하고 범례를 제공한다.
- 기존 세 필드 문서도 깨지지 않고 유형과 수정일을 보여준다.

### OKF 호환

- 내부 wiki는 Quartz에 필요한 `[[bare-slug]]` 링크를 계속 사용한다.
- 새 문서는 OKF v0.2와 겹치는 메타데이터를 점진적으로 기록한다.
- 외부 교환이 필요할 때 별도 내보내기 명령이 표준 Markdown 링크를 가진 OKF 묶음을 만든다.
- 내보내기는 public만 대상으로 하며 private 자료를 포함하지 않는다.
- public raw Markdown은 원본을 바꾸지 않고 내보내기 사본에서 `Reference` 문서로 취급한다.

### 홈서버 게시와 접근 제어

- public wiki만 `brain.fosworld.co.kr`에 게시하고 private 네임스페이스는 빌드 입력과 컨테이너 마운트에서 제외한다.
- Cloudflare Tunnel의 outbound 연결로 홈서버를 공개하며, `brain`, Grafana, Jenkins, Nginx Proxy Manager는 Cloudflare Access 인증 뒤에 둔다.
- `fosworld.co.kr`, `blog`, `accountbook`, `accountbook-api`는 로그인 없이 계속 공개한다.
- Jenkins 웹훅 경로만 Access 인증에서 제외하고 Generic Webhook Trigger의 HMAC-SHA256 검증을 필수로 한다.
- hosting.kr은 등록기관으로 유지하고 권한 DNS만 Cloudflare full setup으로 전환한다.
- 폐기된 `career`는 DNS, 프록시, 컨테이너, 예약 작업에서 제외한다.

## 성공 기준

- 공개 대표 질문의 80% 이상에서 기대 문서가 상위 3개 안에 나온다.
- 검색 절차가 공개·비공개 결과를 섞지 않고, 답변 근거에 네임스페이스를 표시한다.
- OKF 내보내기 결과의 concept, topic, entity 문서에 `type`, `title`, `description`이 있고 내부 링크가 표준 Markdown 링크다.
- 묶음의 `index.md`와 `log.md`는 OKF v0.2의 예약 문서 계약을 따른다.
- 예약 문서를 제외한 모든 Markdown은 비어 있지 않은 `type`을 가진다.
- Quartz 형 검사와 공개 빌드가 통과한다.
- 메타데이터가 적은 기존 페이지와 새 메타데이터 페이지가 모두 렌더된다.
- 인증하지 않은 사용자는 보호 호스트에서 Cloudflare Access 로그인으로 이동하고, 허용 계정만 접근한다.
- Jenkins 웹훅은 올바른 `X-Hub-Signature-256` 요청만 통과하며 일반 Jenkins 화면은 계속 Access로 보호된다.
- Tunnel 전환 뒤 홈서버의 공인 80·443 포트는 닫히고 SSH 10022와 기존 SSH 터널 사용은 유지된다.
- 공개 호스트는 전환 전후의 대표 경로에서 기존 성공·리다이렉트·권한 응답을 유지한다.

## 범위 밖

- 별도 벡터 데이터베이스나 GraphRAG 서비스를 도입하지 않는다.
- 100여 개 기존 페이지의 메타데이터를 한 번에 채우지 않는다.
- private 저장소를 공개 산출물에 포함하지 않는다.
- 검색 결과를 사용자 승인 없이 wiki에 자동 환원하지 않는다.
- Cloudflare를 도메인 등록기관으로 이전하지 않는다.
- `nreview`의 기능을 복구하거나 폐기하지 않고 현재 404 동작만 보존한다.
- Hermes와 9119 포트를 Cloudflare Tunnel에 연결하지 않는다.
