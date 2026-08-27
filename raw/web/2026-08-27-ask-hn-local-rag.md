---
source_type: web
source_url: https://news.hada.io/topic?id=25854
original_url: https://news.ycombinator.com/item?id=46616529
collected: 2026-08-27
title: "Ask HN: 로컬에서 RAG를 어떻게 구현하고 있나요?"
---

# Ask HN: 로컬에서 RAG를 어떻게 구현하고 있나요?

GeekNews(news.hada.io) 소개 글과 원문 Hacker News 스레드 요약이다.

## 핵심 주장

1. 벡터DB는 필수가 아니다. SQLite FTS5, BM25, grep 같은 텍스트 검색만으로 충분한 경우가 많다.
2. 코드 검색에는 임베딩이 잘 맞지 않는다. 느리고 정확도가 떨어져 BM25와 trigram 조합이 더 낫다는 의견이 많았다.
3. RAG 성능은 결국 LLM에 넘기는 짧은 텍스트 조각의 질이 정한다.
4. 태그 매칭만으로 85% 상황이 해결되고, 필요할 때만 하이브리드 검색을 얹는 접근도 보고됐다.

## 임베딩 모델

- MongoDB `mdbr-leaf-ir` — CPU 전용, BEIR 53.55점(`all-MiniLM-L12-v2`는 42.69점).
- `model2vec`, `minish` — 빠르지만 정확도가 낮다.
- `Meta-Llama-3-8B` — 500만 청크에 약 40GB 메모리, FAISS로 검색.

## 저장소 선택지

| 솔루션 | 특징 |
| --- | --- |
| SQLite FTS5 | 마크다운 문서에 적합. 벡터를 BLOB으로 함께 저장 가능 |
| PostgreSQL + pgvector | 기존 운영 지식을 그대로 쓰고 인수인계가 쉽다 |
| LanceDB | 임베디드 벡터DB. Ollama `nomic-embed-text` 연동 |
| DuckDB | 3GB 이하 소규모 프로젝트에 적합 |

## 하이브리드 검색

- BM25와 벡터 검색을 함께 돌린다.
- Reciprocal Rank Fusion(RRF)으로 두 순위를 통합한다.
- 재정렬과 멀티쿼리 확장을 뒤에 붙인다.

## 언급된 도구

- `qmd` — 마크다운 검색 CLI
- `ck` — Rust 기반 시맨틱 grep
- `Kiln` — 여러 설정을 비교·평가
- `libragen` — 버전 관리되는 RAG 콘텐츠 라이브러리
- `piragi` — 로컬·S3·API 소스를 다루는 Python 라이브러리

## 댓글

- Postgres trigram과 pgvector를 함께 쓰는 하이브리드 검색 사례.
- SQLite에 fp16 벡터를 BLOB으로 저장하고 메모리에서 계산.
- 문서의 95%가 마크다운이면 FTS5로 충분하다는 의견.
- 태그 기반 검색으로 벡터DB 자체를 없앤 사례(85% 상황 해결).
- agentic RAG는 소규모 프로젝트에 과할 수 있다.
- 한국어 처리 품질에 대한 의문 제기.
