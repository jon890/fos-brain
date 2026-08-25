---
source: 2026-08-25 사용자가 승인한 개인 지식 최신화와 공개 개인 저장소
collected: 2026-08-25
type: conversation-note
visibility: public
---

# 개인 지식 최신화

## AI 하네스 작업 방식

- 작업은 요구사항과 완료 조건을 먼저 닫고 구현, 독립 검토와 실측 검증을 분리한다.
- 작업 크기보다 남은 판단과 실패 비용에 따라 직접 실행, 계획, 팀 실행과 지속 검증 방식을 고른다.
- 에이전트가 만든 결과는 같은 맥락의 자기 판단만으로 완료 처리하지 않는다.
- 외부 쓰기, 권한 변경과 되돌리기 어려운 작업은 명시한 경계 안에서만 수행한다.
- 반복 절차와 행동 규칙은 skill과 AGENTS.md가 관리하고, brain에는 그 선택 이유와 업무 스타일만 남긴다.

## fos-agents

- `fos-agents`는 개인 업무와 생활의 반복 작업을 독립된 워크스페이스로 관리하는 모노레포다.
- 루트는 공통 규칙과 공유 자산을 맡고, 실제 작업과 민감 데이터는 워크스페이스 경계 안에 둔다.
- 금융 화면 기반 가계부 자동화는 vision 추출과 결정적 검증을 분리한다.
- 대화형 등록은 사용자 승인을 유지한다.
- 주간 등록은 합계, 필드 신뢰도, 원본 시각과 중복 검사를 모두 통과한 후보만 자동 처리한다.

## 정보 화면 취향

- 모바일에서도 한 항목의 의미가 카드 안에서 완결되는 구성을 선호한다.
- 전체 목록의 검색, 필터와 순위를 제공해 먼저 훑고 필요한 원문으로 내려가게 한다.
- 상태와 수치는 의미 대상 가까이에 두고 사람이 바로 읽는 날짜와 시각을 사용한다.
- 요약과 원문 화면은 같은 시각 언어를 유지한다.
- 긴 제목, 링크, 표찰과 표가 컨테이너 밖으로 나가지 않아야 한다.
- 장식보다 출처, 최신성, 상태와 관계를 먼저 드러낸다.

## 기술 선택과 테스트 기준

- Java와 Spring은 제품 백엔드의 주력 선택이다.
- TypeScript, Next.js와 React는 개인 웹 제품에서 반복해 사용한다.
- JavaScript 패키지 관리는 pnpm을 선호하고 HTTP client는 ky를 반복해 선택한다.
- Node와 framework 버전은 전역 고정값이 아니라 저장소별 pin과 지원 범위를 따른다.
- 테스트는 결정적 검사, 실제 실행 경로, 실패 시 상태 불변을 먼저 증명한다.
- 대역은 외부 네트워크와 비결정적 경계에 한정하고 내부 상태 전이는 가능한 한 실제로 실행한다.

## 검증한 출처

- `github.com/jon890/fos-agents`의 `README.md`, `AGENTS.md`
- `fos-agents/accountbook/docs/prd.md`
- `fos-agents/accountbook/docs/adr/ADR-001-vision-extraction-deterministic-validation.md`
- `fos-agents/accountbook/docs/adr/ADR-002-weekly-safe-policy-auto-submission.md`
- `fos-accountbook`, `fos-blog`, `dooray-cli`의 `package.json`
- `fos-accountbook-backend/gradle/libs.versions.toml`
- 2026-08-25 사용자 승인
