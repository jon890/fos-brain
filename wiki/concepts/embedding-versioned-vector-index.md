---
type: concept
created: 2026-08-26
updated: 2026-08-27
title: "임베딩 버전과 벡터 색인 수명주기"
description: "임베딩 모델 변경을 벡터 재생성, 재색인과 서빙 호환성까지 포함해 운영하는 원칙"
tags: [embedding, vector-index, rag, model-versioning, operations]
status: stable
sources:
  - id: toss-securities-rag-talk
    resource: ../../raw/videos/2026-07-27-toss-securities-recommendation-search-rag-graphrag.md
    title: 토스증권 추천과 검색 테크톡
  - id: toss-securities-rag-article
    resource: ../../raw/web/2026-08-26-toss-securities-recommendation-search-rag-graphrag.md
    title: 토스증권 추천과 검색은 어떻게 진화하고 있을까?
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
- [[retrieval-backend-selection]] — 벡터 색인을 둘지 자체를 정하는 앞단 판단
- [[recommendation-batch-to-realtime-loop]] — 이 수명주기를 떠안게 되는 추천 루프

## Sources

- [[../../raw/videos/2026-07-27-toss-securities-recommendation-search-rag-graphrag.md]]

## 추가 (2026-08-27)

### 벡터 저장소는 검색 지연만으로 검증하면 부족하다

사용자의 과거 선호 아이템이나 최근 행동을 피처로 쓰면 여러 벡터를 한 번에 읽는 대량 조회가 발생한다.
고차원 벡터를 대량으로 응답에 담는 과정에서 JVM 메모리 압력이 커지므로, 검색 지연과 별도로 대량 조회 처리량과 GC 추이를 실제 요청 패턴으로 측정한다.

벤치마크 수치가 아니라 서비스의 실제 요청 형태로 재현해야 이 부하가 드러난다.

## 추가 Sources

- [[../../raw/web/2026-08-26-toss-securities-recommendation-search-rag-graphrag.md]]
