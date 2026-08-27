---
type: topic
created: 2026-05-19
updated: 2026-08-27
title: "RAG 시스템 아키텍처 전략"
description: "입력 품질, 검색 파이프라인과 관계 탐색을 나눠 RAG 시스템을 설계하는 개인 관점"
tags: [rag, architecture, retrieval, data-quality, graphrag]
status: stable
stale_after: 2027-08-25
sources:
  - id: rag-architecture-analysis
    resource: ../../raw/papers/RAG_아키텍처_분석_토스_우아한형제들_Sionic_AI_전략_비교.pdf
    title: RAG 아키텍처 분석 자료
  - id: rag-system-presentation
    resource: ../../raw/notes/다른 기업의 RAG 시스템 발표자료.md
    title: 다른 기업의 RAG 시스템 발표자료
  - id: toss-securities-rag-talk
    resource: ../../raw/videos/2026-07-27-toss-securities-recommendation-search-rag-graphrag.md
    title: 토스증권 추천과 검색 테크톡
  - id: toss-securities-rag-article
    resource: ../../raw/web/2026-08-26-toss-securities-recommendation-search-rag-graphrag.md
    title: 토스증권 추천과 검색은 어떻게 진화하고 있을까?
---

# RAG 시스템 아키텍처 전략

RAG 시스템은 하나의 검색 기법이 아니라 사용자 작업 흐름, 추론 구조와 입력 데이터 품질을 함께 설계하는 문제다.
외부 사례의 제품 이름보다 세 축을 어떤 순서로 진단할지에 장기 가치가 있다.

## 세 가지 설계 축

| 축 | 핵심 질문 | 사례에서 얻은 교훈 |
| --- | --- | --- |
| Workflow | 사용자가 이미 일하는 곳에 검색 결과가 도착하는가? | 별도 검색 화면보다 메신저와 IDE 같은 기존 흐름에 통합한다. |
| Logic | 질문 의도에 따라 검색과 추론 경로가 달라지는가? | 하나의 거대 prompt보다 분류와 특화 경로의 책임을 나눈다. |
| Data Quality | 원문이 검색과 생성에 적합한 구조로 보존되는가? | 모델 교체 전에 parsing, 표 구조와 읽기 순서를 검증한다. |

## 개인 설계 우선순위

1. **입력 완전성과 신선도**: 수집 누락, 삭제 동기화와 갱신 실패를 먼저 측정한다.
2. **변환 품질**: 문서와 표의 구조가 chunk 이후에도 보존되는지 평가한다. [[document-parsing-quality-evaluation]]
3. **검색 품질**: Recall@K, MRR과 nDCG 같은 지표로 후보 집합과 순위를 본다.
4. **최종 답변**: 근거성, 정확성과 사용자 작업 완료 여부를 평가한다.

현재 직접 경험은 1과 2에 가장 강하다.
3과 4는 학습·설계 영역과 운영 경험을 구분해 다룬다.

## 설계 판단

- 사용 흐름이 나쁘면 검색 정확도가 높아도 채택되지 않는다.
- 추론 경로가 복잡해질수록 각 단계의 실패 이유와 fallback이 보여야 한다.
- 입력 품질 결함은 생성 모델을 바꿔도 반복되므로 parser와 평가셋을 먼저 본다.
- 비결정적 평가 앞에는 스키마, 누락과 구조 같은 결정적 검사를 둔다. [[testing-philosophy]]
- 검색 품질은 단일 모델보다 질문 구조화, 후보 검색, 필터와 재정렬의 조합으로 개선한다.
- GraphRAG는 그래프 구축과 검색을 분리하고 질문에 맞는 경로를 남기는 문제로 본다.

## Concepts

- [[document-parsing-quality-evaluation]] — 입력 문서의 내용과 구조 보존 평가
- [[rag-retrieval-pipeline]] — 질문 이해부터 재정렬까지의 공통 검색 흐름
- [[retrieval-backend-selection]] — 검색 계층을 벡터DB 기본값 없이 고르는 기준
- [[embedding-versioned-vector-index]] — 임베딩 변경과 벡터 색인의 운영 수명주기
- [[graph-rag-path-retrieval]] — 제한된 경로 탐색으로 서브그래프를 만드는 방식
- [[testing-philosophy]] — 결정적 검사와 비결정적 평가의 계층

## Sources

- [[../../raw/papers/RAG_아키텍처_분석_토스_우아한형제들_Sionic_AI_전략_비교.pdf]]
- [[../../raw/notes/다른 기업의 RAG 시스템 발표자료.md]]
- [[../../raw/videos/2026-07-27-toss-securities-recommendation-search-rag-graphrag.md]]
- [[../../raw/web/2026-08-26-toss-securities-recommendation-search-rag-graphrag.md]]
