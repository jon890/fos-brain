---
type: concept
created: 2026-08-26
updated: 2026-08-27
title: "RAG 검색 파이프라인"
description: "질문 이해부터 하이브리드 검색, 재정렬과 생성 전달까지 공통화하는 검색 파이프라인"
tags: [rag, retrieval, hybrid-search, reranking, platform]
status: stable
sources:
  - id: toss-securities-rag-talk
    resource: ../../raw/videos/2026-07-27-toss-securities-recommendation-search-rag-graphrag.md
    title: 토스증권 추천과 검색 테크톡
  - id: toss-securities-rag-article
    resource: ../../raw/web/2026-08-26-toss-securities-recommendation-search-rag-graphrag.md
    title: 토스증권 추천과 검색은 어떻게 진화하고 있을까?
  - id: ask-hn-local-rag
    resource: ../../raw/web/2026-08-27-ask-hn-local-rag.md
    title: "Ask HN: 로컬에서 RAG를 어떻게 구현하고 있나요?"
---

# RAG 검색 파이프라인

RAG는 문서를 LLM에 붙이는 한 단계가 아니라 질문을 검색 조건으로 바꾸고, 후보를 찾고, 생성에 쓸 근거를 선별하는 파이프라인이다.

## 단계

1. 질문 의도, 범주, 날짜와 검색 범위를 구조화한다.
2. 키워드 검색과 벡터 검색을 조합하고 메타데이터 필터를 적용한다.
3. 재정렬 모델이 관련 없는 후보를 제거하고 중요한 순서로 다시 정렬한다.
4. 선별한 근거와 출처를 생성 단계에 전달한다.
5. 답변이 검색 근거에 기반했는지 평가한다.

## 공통 플랫폼으로 만드는 이유

- 제품마다 검색 질의와 필터를 다시 만들면 품질 기준과 운영 방식이 파편화된다.
- 제품은 자연어 질문과 필요한 범위를 전달하고 검색 플랫폼은 후보 생성과 재정렬을 맡는다.
- 검색 방식 하나를 만능으로 보지 않고 약점을 보완하는 모듈을 점진적으로 조합한다.

## 운영 관점

- 검색 품질은 후보 검색과 재정렬을 분리해 측정한다.
- 분류와 메타데이터 태그는 검색뿐 아니라 다른 제품 기능에서도 재사용할 수 있다.
- 관련 없는 문서 한두 개도 사용자의 시스템 신뢰를 크게 낮출 수 있다.

## 관련 개념

- [[rag-system-architecture-strategies]] — RAG 전체 설계 축
- [[graph-rag-path-retrieval]] — 문서가 아니라 관계 경로를 찾는 확장
- [[embedding-versioned-vector-index]] — 임베딩과 벡터 색인의 운영 수명주기
- [[document-parsing-quality-evaluation]] — 검색 이전 입력 품질 평가
- [[retrieval-backend-selection]] — 이 파이프라인의 검색 계층을 무엇으로 세울지 고르는 기준
- [[recommendation-batch-to-realtime-loop]] — 후보 검색과 재정렬을 같은 구조로 쓰는 추천 쪽 판본

## Sources

- [[../../raw/videos/2026-07-27-toss-securities-recommendation-search-rag-graphrag.md]]

## 추가 (2026-08-27)

### 하이브리드 융합은 점수 합산이 아니라 순위 통합으로 한다

BM25 점수와 벡터 유사도는 척도가 다르다. 두 점수를 그대로 더하면 어느 쪽이 얼마나 반영되는지 알 수 없다.

- Reciprocal Rank Fusion(RRF)처럼 순위를 기준으로 합치면 척도 차이가 사라진다.
- 점수를 합치는 방식을 유지한다면 정규화 함수와 가중치를 설정값으로 빼고, 바꿀 때마다 측정한다.
- 가중치를 코드 상수로 두면 조정 이력이 남지 않아 왜 그 값인지 아무도 설명하지 못한다.

### 단계를 올리기 전에 측정 장치를 먼저 만든다

질의 확장, 융합 방식 변경, 재정렬 모델 교체는 모두 검색 품질을 올리려는 변경이다. 정답 세트와 recall, nDCG 같은 지표가 없으면 좋아졌는지 판단할 근거가 없다. 부하 테스트는 처리 시간만 보므로 품질 판단을 대신하지 못한다.

## 추가 Sources

- [[../../raw/web/2026-08-27-ask-hn-local-rag.md]]
- [[../../raw/web/2026-08-26-toss-securities-recommendation-search-rag-graphrag.md]] — 테크톡 발표의 글 판본
