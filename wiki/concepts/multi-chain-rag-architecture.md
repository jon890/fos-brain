---
type: concept
created: 2026-05-19
updated: 2026-05-19
---

# Multi-Chain RAG Architecture

단일 프롬프트로 모든 질문을 처리하지 않고, 의도 분류 → 특화된 체인 라우팅 → 통합 답변 생성으로 정확도를 최적화하는 RAG 아키텍처 패턴. 우아한형제들 물어보새의 핵심 설계.

## 핵심 포인트

- **구성 요소**:
  - Router Supervisor — 사용자 질문 의도 분류
  - Text-to-SQL Chain (Primary) — SQL 생성
  - Explanation Chain — 해설형 답변
  - Grammar Check Chain — SQL 문법 검증
  - Discovery Chain — 테이블 탐색
  - Retrieval Layer — Meta-data & Few-shot Search (모든 체인이 공유)
- **이점**: 의도별 특화로 단일 거대 프롬프트 대비 정확도 향상, 체인별 독립 개선·평가 가능.
- **트레이드오프**: 라우팅 오류 시 잘못된 체인으로 전달되어 답변 실패. Router 자체의 품질이 시스템 천장.

## 관련 개념

- [[woowa-mulebose-text-to-sql]] — 본 패턴의 대표 구현 사례
- [[toss-park-ssi-rag]] — 단일 체인 + Context Injection 만 사용하는 더 단순한 RAG 와 대조

## 관련 주제

- [[../topics/rag-system-architecture-strategies]]

## Sources

- [[../../raw/papers/RAG_아키텍처_분석_토스_우아한형제들_Sionic_AI_전략_비교.pdf]] (7페이지)
