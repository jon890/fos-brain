---
type: concept
created: 2026-08-26
updated: 2026-08-26
title: "GraphRAG 경로 검색"
description: "질문과 관련된 시작 노드에서 제한된 경로를 점수화해 설명 가능한 서브그래프를 찾는 방식"
tags: [rag, graphrag, knowledge-graph, graph-search, retrieval]
status: stable
sources:
  - id: toss-securities-rag-talk
    resource: ../../raw/videos/2026-07-27-toss-securities-recommendation-search-rag-graphrag.md
    title: 토스증권 추천과 검색 테크톡
---

# GraphRAG 경로 검색

GraphRAG 검색은 그래프 전체를 펼치는 일이 아니라 질문에 맞는 시작 노드와 관계 경로를 남겨 설명 가능한 서브그래프를 만드는 일이다.

## 검색 흐름

1. 텍스트·벡터 검색으로 질문과 관련된 시작 노드 후보를 찾는다.
2. 관계를 확장할 때마다 경로에 점수를 매긴다.
3. 상위 경로만 다음 깊이로 넘기는 beam search 방식으로 폭발을 제한한다.
4. 제품별 path preference로 선호하는 노드와 관계에 가중치를 준다.
5. 결과와 함께 어떤 노드와 관계를 따라갔는지 반환한다.

## 좋은 경로를 남기는 기준

- 질문에서 찾은 시작 노드가 경로에 다시 나타나면 관련성 근거로 활용할 수 있다.
- 최신성, 중요도와 제품 목적은 도메인별 점수 함수로 분리한다.
- 시작 노드가 틀리면 이후 탐색 전체가 흔들리므로 시작점 검색을 별도로 평가한다.
- 경로 수, 탐색 깊이와 단계별 생존 수를 제한해 메모리와 지연 시간을 통제한다.

## 그래프 저장소 운영

- 인덱스를 적용할 시작 노드를 먼저 좁힌다.
- 관계 방향과 타입 조건을 탐색 초기에 적용한다.
- 각 확장 단계에서 정렬과 제한을 적용한다.
- 실행 계획으로 행 증가와 메모리 할당 지점을 확인한다.

## 관련 개념

- [[rag-system-architecture-strategies]] — RAG 전체 설계 축
- [[rag-retrieval-pipeline]] — 시작 노드 후보를 만드는 일반 검색 파이프라인

## Sources

- [[../../raw/videos/2026-07-27-toss-securities-recommendation-search-rag-graphrag.md]]
