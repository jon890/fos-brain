---
type: concept
created: 2026-05-19
updated: 2026-05-19
---

# Sionic STORM Parse / Violet — VLM 기반 문서 파싱

Sionic AI 가 제시하는 RAG 성능의 숨겨진 병목 해결법: 모델보다 원본 문서를 어떻게 파싱하느냐가 정확도를 결정한다 ("Garbage In, Garbage Out").

## 핵심 포인트

- **문제**: 표준 OCR/Parser 는 복잡한 표·차트·병합 셀에서 맥락 소실·구조 붕괴. 문서 구조가 깨지면 LLM 이 답을 찾지 못함.
- **솔루션 — Sionic Violet (2-Stage)**:
  1. **Stage 1: Markdown Conversion** — 전통 파서로 기본 텍스트 구조 추출
  2. **Stage 2: VLM Semantic Refinement** — Vision-Language Model 이 원본 이미지를 보고 깨진 표 복원, 병합 셀 인식, 차트 해석
- **자연어 직렬화 (Natural Language Serialization)**:
  - 임베딩 모델은 JSON/Markdown 표보다 자연어 문장을 더 잘 이해
  - 예: `|과목:통계학|학점:3|학기:1학기|` → "통계학 과목은 3학점이며, 1학기에 개설됩니다."
  - 효과 1: 청킹 시 정보가 잘려도 문장 단위로 맥락 보존
  - 효과 2: LLM 이 구조 오해로 발생하는 할루시네이션 방지
- **벤치마크**: Sionic STORM Parse 91.85% vs OpenAI File Search 77% vs Google Gemini File Search 68% — 파서 교체만으로 검색 정확도 20%+ 향상.
- **주요 사례**: 복잡 금융 리포트 (차트), 기술 매뉴얼 (표), HWP 공공 문서.

## 관련 개념

- [[toss-park-ssi-rag]] — Toss 는 텍스트 중심이라 파싱 이슈가 적은 대조 사례
- [[woowa-mulebose-text-to-sql]] — 우아한형제들은 정형 DB 가 입력이라 파싱 문제 영역이 다름
- [[docflow-code-to-doc]] — DocFlow 도 "신뢰 가능한 입력 데이터" 라는 같은 문제를 코드 측에서 푸는 접근

## 관련 주제

- [[../topics/rag-system-architecture-strategies]] — Data Quality 축의 대표 사례

## Sources

- [[../../raw/papers/RAG_아키텍처_분석_토스_우아한형제들_Sionic_AI_전략_비교.pdf]] (10–13페이지)
