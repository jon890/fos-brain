---
type: concept
created: 2026-08-27
updated: 2026-08-27
title: "검색 백엔드 선택 기준"
description: "RAG의 검색 계층을 벡터DB 기본값이 아니라 문서 성격, 규모, 기존 운영 역량으로 고르는 판단 기준"
tags: [rag, retrieval, search, bm25, vector-database]
status: stable
sources:
  - id: ask-hn-local-rag
    resource: ../../raw/web/2026-08-27-ask-hn-local-rag.md
    title: "Ask HN: 로컬에서 RAG를 어떻게 구현하고 있나요?"
---

# 검색 백엔드 선택 기준

RAG를 만들 때 벡터DB부터 세우는 것이 기본값은 아니다. 검색 계층은 문서 성격과 규모, 이미 운영할 수 있는 인프라로 고른다.

## 핵심 포인트

- 문서가 대부분 마크다운이고 규모가 작으면 SQLite FTS5나 BM25만으로 필요한 품질이 나온다.
- 코드와 고유명사, 식별자를 찾는 검색은 임베딩이 약하다. BM25와 trigram 조합이 더 정확하고 빠르다.
- 메타데이터 태그로 후보를 좁힐 수 있으면 벡터 검색을 아예 두지 않아도 되는 경우가 있다.
- 벡터를 쓰더라도 별도 벡터DB가 아니라 이미 쓰는 저장소의 확장(pgvector, SQLite BLOB, DuckDB)으로 시작할 수 있다.
- 선택 기준은 "정확도"만이 아니라 운영 인수인계가 되는가, 색인 갱신 비용을 감당하는가까지 포함한다.

## 단계적으로 올리는 순서

1. 키워드 검색과 메타데이터 필터로 시작한다.
2. 부족한 질의 유형을 확인한 뒤에 벡터 검색을 더한다.
3. 두 순위를 RRF 같은 순위 기반 방식으로 합친다.
4. 마지막에 재정렬 모델을 얹는다.

각 단계를 올릴 때 무엇이 좋아졌는지 측정하지 않으면 복잡도만 남는다.

## 개인 적용

- fos-brain은 마크다운 위키라 이 기준에서 키워드 검색이 먼저다. qmd가 BM25, 벡터, 재정렬을 한 도구로 묶어 주므로 단계 조합을 직접 만들지 않는다.
- 홈서버에서는 qmd를 `brain-qmd` container로 분리하고, 실패하면 로컬 qmd와 INDEX, `rg` 순서로 축소한다. 검색 계층이 없어도 최소 조회가 되도록 남긴 폴백이다.

## 관련 개념

- [[rag-retrieval-pipeline]] — 이 선택 위에서 돌아가는 검색 파이프라인 전체
- [[embedding-versioned-vector-index]] — 벡터를 도입했을 때 따라오는 운영 비용
- [[rag-system-architecture-strategies]] — 상위 설계 관점

## Sources

- [[../../raw/web/2026-08-27-ask-hn-local-rag.md]]
