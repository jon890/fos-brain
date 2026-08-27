---
type: concept
created: 2026-08-27
updated: 2026-08-27
title: "배치 추천에서 실시간 루프로"
description: "미리 계산한 추천 리스트를 이벤트와 피드백을 흡수하는 루프 구조로 옮길 조건과 구성"
tags: [recommendation, realtime, feature-store, vector-index, architecture]
status: draft
sources:
  - id: toss-securities-rag-article
    resource: ../../raw/web/2026-08-26-toss-securities-recommendation-search-rag-graphrag.md
    title: 토스증권 추천과 검색은 어떻게 진화하고 있을까?
  - id: toss-securities-rag-talk
    resource: ../../raw/videos/2026-07-27-toss-securities-recommendation-search-rag-graphrag.md
    title: 토스증권 추천과 검색 테크톡
---

# 배치 추천에서 실시간 루프로

추천은 미리 계산해 저장한 리스트에서 출발해도 되지만, 맥락이 빠르게 변하면 이벤트와 피드백을 계속 흡수하는 루프 구조로 옮겨야 한다.

## 배치와 클러스터로 충분한 구간

사용자와 아이템을 배치로 모아 클러스터를 만들고 클러스터별 추천 리스트를 미리 계산해 캐시에 넣는 방식이다.
콘텐츠 종류가 단순하고 제품 주기가 빠를 때는 이 방식이 틀린 선택이 아니라 현실적인 선택이다.
구조가 단순하고 장애 지점이 적으므로 아래 조건이 나타나기 전에는 옮길 이유가 없다.

## 옮길 때를 알려주는 조건

- 사용자의 관심 맥락이 한 세션 안에서 계속 바뀐다.
- 추천 대상 자체가 외부 이벤트로 계속 변한다.
- 추천할 콘텐츠 종류가 늘어 하나의 리스트로 담기 어렵다.
- 실시간 데이터와 학습 기반이 갖춰져 비용이 감당 가능해진다.

문제 정의가 "원래 좋아할 만한 것"에서 "지금 이 맥락에서 필요한 것"으로 옮겨가는 시점이다.

## 루프의 구성

1. 행동 이벤트를 받아 저장하고 모델을 학습한다.
2. 아이템이 생기거나 바뀌면 표현을 다시 만들어 벡터를 색인한다.
3. 서빙 시점에 리트리버가 후보를 찾고 랭커가 점수를 매겨 상위 N개를 노출한다.
4. 노출 결과의 피드백을 피처 저장소와 벡터 색인으로 되돌린다.

## 루프에 따라오는 운영 부담

- 학습 데이터가 제대로 만들어지는지, 색인이 갱신되는지 확인할 관측 장치가 필요하다.
- 특정 결과가 왜 추천됐는지 되짚을 수 있어야 한다.
- 임베딩 모델을 바꿀 수 있게 열어두는 순간 벡터 색인 수명주기 관리가 따라온다. [[embedding-versioned-vector-index]]

정적 리스트에는 없던 이 세 가지가 전환 비용의 대부분이다.

## 관련 개념

- [[embedding-versioned-vector-index]] — 루프가 의존하는 벡터 색인의 운영 수명주기
- [[rag-retrieval-pipeline]] — 후보 검색과 재정렬을 나누는 같은 구조의 검색 판본

## Sources

- [[../../raw/web/2026-08-26-toss-securities-recommendation-search-rag-graphrag.md]]
- [[../../raw/videos/2026-07-27-toss-securities-recommendation-search-rag-graphrag.md]]
