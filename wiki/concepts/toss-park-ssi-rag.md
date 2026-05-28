---
type: concept
created: 2026-05-19
updated: 2026-05-19
---

# Toss 박씨 (Park-ssi)

토스 프론트엔드 챕터의 사내 라이브러리·기술 문서 RAG 시스템. 검색 엔진을 새로 만들기보다 개발자가 가장 선호하는 "질문하기" 경험을 IDE·메신저에 통합해 워크플로우를 단축하는 것이 핵심 전략.

## 핵심 포인트

- **문제**: 사내 라이브러리는 LLM 이 학습하지 않았고, 위키 검색은 팀 간 이동·최신화에 한계. "문서 검색 실패 → 동료에게 질문" 경로의 비효율.
- **해결**: Slack 봇 "박씨" 로 즉시 답변. 사용자는 검색이 아니라 질문을 한다.
- **순환형 파이프라인**: Ingestion ([[docflow-code-to-doc]], SilokBot) → Retrieval (Algolia Unified Search) → Generation (박씨 봇, Context Injection) → Feedback (Slack Emoji Reaction, Auto-learning).
- **3단계 리뷰**: 개발자 기술 검증 → 테크니컬 라이터 구조/가독성 → 배포.
- **Impact**: 프론트엔드 챕터 문서 2,000개 이상 누적, 질문 허들 감소.

## 관련 개념

- [[docflow-code-to-doc]] — Ingestion 단계의 문서 최신성 강제 메커니즘
- [[multi-chain-rag-architecture]] — Toss 는 단일 체인 + Context Injection 위주, 우아한형제들 사례와 대비
- [[sionic-vlm-document-parsing]] — Toss 는 텍스트 문서 중심이라 파싱 이슈가 적음, 데이터 품질 축의 대조

## 관련 주제

- [[../topics/rag-system-architecture-strategies]] — Workflow 축의 대표 사례

## Sources

- [[../../raw/papers/RAG_아키텍처_분석_토스_우아한형제들_Sionic_AI_전략_비교.pdf]] (3–5페이지)
- [[../../raw/notes/다른 기업의 RAG 시스템 발표자료.md]]
