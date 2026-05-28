---
type: topic
created: 2026-05-19
updated: 2026-05-19
---

# RAG 시스템 아키텍처 전략 비교

기업의 RAG 시스템 구축은 단일 LLM 도입이 아니라 **조직의 문제** 에 맞춘 아키텍처 설계의 문제다. 토스·우아한형제들·Sionic AI 세 사례는 각각 **Workflow / Logic / Data Quality** 라는 서로 다른 축에 집중한다.

## 한 줄 요약

- **토스** — "검색 엔진을 만들지 말고, 사용자가 이미 있는 곳 (Slack·IDE) 에 답이 찾아오게 하라."
- **우아한형제들** — "단일 거대 프롬프트 대신, 의도를 분류해 특화 체인으로 라우팅하라."
- **Sionic AI** — "모델을 바꾸지 말고 파서를 바꿔라 — 정확도 20%+ 가 거기서 나온다."

## 3대 축

| 축 | 핵심 질문 | 대표 사례 |
|---|---|---|
| **Workflow / UX** | 사용자의 기존 워크플로우에 검색이 어떻게 스며들 것인가? | [[../concepts/toss-park-ssi-rag]] |
| **Logic / Reasoning** | 의도 분류와 추론 로직을 어떻게 설계할 것인가? | [[../concepts/woowa-mulebose-text-to-sql]] |
| **Data Quality / Parsing** | 원본 데이터를 어떻게 신뢰 가능하게 파싱할 것인가? | [[../concepts/sionic-vlm-document-parsing]] |

## 사례별 종합 비교

| 구분 | 토스 (Toss) | 우아한형제들 (Woowa) | Sionic AI |
|---|---|---|---|
| 핵심 전략 | Workflow & Culture (UX) | Logic & Reasoning (SQL) | Data Quality (Parsing) |
| 주요 기술 | IDE 통합, 순환형 파이프라인 ([[../concepts/docflow-code-to-doc]]) | [[../concepts/multi-chain-rag-architecture]], ReAct Prompt | VLM 2-Stage Parsing |
| 추천 영역 | 지식 관리 (Knowledge Mgmt) | 데이터 분석 (Data Analytics) | 문서 자산화 (Doc Processing) |

## 3가지 제언 (결론)

1. **UX 통합** — 사용자의 기존 워크플로우 (메신저·IDE) 안으로 검색이 스며들어야 한다.
2. **엔지니어링** — 단순 프롬프팅을 넘어 의도를 분류하고 추론하는 Logic 설계가 필요하다.
3. **데이터 품질** — 모델보다 중요한 것은 원본 데이터를 어떻게 Parsing 하느냐다.

## 포함 개념

- [[../concepts/toss-park-ssi-rag]]
- [[../concepts/docflow-code-to-doc]]
- [[../concepts/woowa-mulebose-text-to-sql]]
- [[../concepts/multi-chain-rag-architecture]]
- [[../concepts/sionic-vlm-document-parsing]]

## Sources

- [[../../raw/papers/RAG_아키텍처_분석_토스_우아한형제들_Sionic_AI_전략_비교.pdf]] (전체, 특히 1–2, 14–15페이지)
- [[../../raw/notes/다른 기업의 RAG 시스템 발표자료.md]]
