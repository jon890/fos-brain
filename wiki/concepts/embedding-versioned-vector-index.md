---
type: concept
created: 2026-08-26
updated: 2026-08-26
title: "임베딩 버전과 벡터 색인 수명주기"
description: "임베딩 모델 변경을 벡터 재생성, 재색인과 서빙 호환성까지 포함해 운영하는 원칙"
tags: [embedding, vector-index, rag, model-versioning, operations]
status: stable
sources:
  - id: toss-securities-rag-talk
    resource: ../../raw/videos/2026-07-27-toss-securities-recommendation-search-rag-graphrag.md
    title: 토스증권 추천과 검색 테크톡
---

# 임베딩 버전과 벡터 색인 수명주기

임베딩 모델 변경은 모델 파일만 교체하는 배포가 아니라 벡터 공간과 색인, 서빙 호환성을 함께 바꾸는 데이터 마이그레이션이다.

## 버전 경계

- 모든 벡터에 생성한 임베딩 모델 버전을 연결한다.
- 서로 다른 모델이 만든 벡터를 같은 공간의 값으로 가정하지 않는다.
- 모델 변경에는 벡터 재생성, 재색인과 서빙 전환을 하나의 계획으로 묶는다.
- 이전 색인을 유지한 채 새 색인을 검증하고 원자적으로 전환할 수 있어야 한다.

## 저장소 부하

- 벡터 저장소는 유사도 검색만 수행하지 않는다.
- 사용자 이력과 최근 행동을 조합하면 여러 벡터를 한 번에 읽는 요청도 발생한다.
- 검색과 대량 읽기의 트래픽 형태를 나눠 지연 시간, 처리량과 I/O를 측정한다.

## 관련 개념

- [[rag-system-architecture-strategies]] — RAG 전체 설계 축
- [[rag-retrieval-pipeline]] — 벡터 색인을 사용하는 검색 흐름

## Sources

- [[../../raw/videos/2026-07-27-toss-securities-recommendation-search-rag-graphrag.md]]
