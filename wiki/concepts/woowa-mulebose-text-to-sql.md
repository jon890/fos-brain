---
type: concept
created: 2026-05-19
updated: 2026-05-19
---

# 우아한형제들 물어보새 (AskBot)

우아한형제들의 데이터 리터러시 격차 해소용 Text-to-SQL RAG 시스템. 구성원 95% 가 데이터를 필요로 하지만 SQL 작성 능력이 부족한 문제를, 자연어 → 고정밀 SQL 변환으로 해결.

## 핵심 포인트

- **목표**: 비즈니스 사용자의 자연어 질문 ("이번 달 강남구 매출 추이?") 을 안전한 SQL 로 변환해 누구나 데이터 추출 가능하게.
- **아키텍처**: [[multi-chain-rag-architecture]] — Router Supervisor 가 의도를 분류해 Text-to-SQL / Explanation / Grammar Check / Discovery 4개 체인 중 하나로 라우팅.
- **고정밀 Text-to-SQL 4단계 공정**:
  1. **데이터 보강** — 테이블 목적·컬럼 상세 설명·비즈니스 표준 용어 메타데이터 구축
  2. **검색 알고리즘** — 질문 의도에 맞춰 연관 DDL·검증된 SQL 예제 (Few-shot) 동적 추출
  3. **프롬프트 엔지니어링** — ReAct (Reasoning+Acting), 데이터 분석가 페르소나, CoT 추론 유도
  4. **평가 시스템** — 사내 리더보드 + RAGAS 지표, 500회 이상 A/B 테스트
- **LLMOps 루프**: Good/Bad 사용자 평가 → GPT Cache (우수 답변 재사용) → Standardized Answer. 쿼리 실행 전 문법 검증으로 에러 사전 차단.
- **확장**: 단순 쿼리 생성을 넘어 테이블 구조 탐색 (Data Discovery) 영역까지.

## 관련 개념

- [[multi-chain-rag-architecture]] — 핵심 아키텍처 패턴
- [[toss-park-ssi-rag]] — Workflow 축 (Toss) 대비 Logic 축 (우아한형제들) 의 대조

## 관련 주제

- [[../topics/rag-system-architecture-strategies]] — Logic 축의 대표 사례

## Sources

- [[../../raw/papers/RAG_아키텍처_분석_토스_우아한형제들_Sionic_AI_전략_비교.pdf]] (6–9페이지)
