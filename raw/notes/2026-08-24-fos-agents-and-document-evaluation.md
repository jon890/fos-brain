---
source: 현재 Codex 세션의 사용자 확인과 fos-agents 공개 문서
collected: 2026-08-24
type: conversation-note
visibility: public
---

# fos-agents 현황과 문서 변환 품질 평가

## fos-agents 현황

- 개인 자동화 저장소의 현재 이름은 `fos-agents`다.
- `fos-claw`과 `ai-nodes`는 현재 환경 이름으로 사용하지 않는다.
- 저장소는 커리어, 투자, 건강, 생활과 콘텐츠 자동화를 독립 워크스페이스로 운영한다.
- 각 워크스페이스는 자체 `AGENTS.md`, 설정, 스크립트와 skill을 가진다.
- 워크스페이스 한정 helper는 해당 워크스페이스에 두고, 실제 공통 책임만 루트에 둔다.
- 사용자가 보는 분석·추천 리포트는 HTML로 만들고, 외부 공유가 승인되면 Cloudflare Pages 게시 결과를 검증한다.

현재 워크스페이스는 다음과 같다.

- `apartment`
- `accountbook`
- `career-os`
- `stock-investment`
- `travel`
- `health-care`
- `ji-yoon-blog`
- `side-projects`

## 문서 변환 품질 평가

사용자는 다양한 파일을 Markdown으로 변환하는 문서 파서를 운영·유지보수한다.
현재는 실제 질문의 답변 품질보다 원본 문서와 변환 Markdown이 적절히 대응하는지를 LLM as Judge로 판단하는 환경을 만들고 반복해서 실험한다.

핵심 관심사는 다음과 같다.

- 표의 헤더와 행·열 관계를 어떻게 보존할지
- 병합 셀과 다단 헤더의 의미를 어떻게 직렬화할지
- 다양한 파일 형식을 어떤 Markdown 구조로 변환할지
- 변환 결과가 chunk로 나뉘어도 문맥을 유지하는지
- 정적 지표와 LLM 판정을 어떻게 조합할지

평가는 회귀 검사, golden 출력, NED와 표 구조 지표로 결정적인 오류를 먼저 찾고, LLM as Judge로 내용 누락, 구조 손실, 읽기 순서와 RAG 입력 적합성을 보완한다.
문서 파싱 품질은 최종 RAG 답변 품질과 같지 않으며, 신뢰할 수 있는 입력을 만드는 선행 계층으로 구분한다.

## 검증한 공개 출처

- `fos-agents/AGENTS.md`
- `fos-agents/docs/code-architecture.md`
- `fos-agents/career-os/sources/fos-study/resume/2607_김병태_경력기술서_backend-ai.md`
- 2026-08-24 사용자 직접 확인
