---
source: WebSearch (docling-eval, NED)
collected: 2026-06-17
type: web
---

# 문서 파싱 품질 평가 메트릭 (공개 출처)

docling-eval·NED 등 문서 파싱 평가 방법론을 WebSearch 로 검증한 공개 출처 요약.

## docling-eval

- IBM docling 진영의 문서 처리 평가 프레임워크.
- 벤치마크 — DocLayNet, FinTabnet, PubTabNet, OmniDocBench.
- 표 구조 — OTSL 포맷 + TEDS(Tree Edit Distance based Similarity) 메트릭.
- dataset 생성·ground truth·평가·시각화를 CLI 로 제공.

## NED (Normalized Edit Distance)

- `NED = 1 − (삽입+삭제+치환) / max(len1, len2)`. 0~1 이며 높을수록 좋다(보통 1−NED 로 점수화).
- 텍스트·수식·읽기 순서 같은 선형 텍스트 평가에 쓴다.

## 컴파일된 wiki

- [[document-parsing-quality-evaluation]]

## Sources

- https://github.com/docling-project/docling-eval
- https://github.com/opendatalab/OmniDocBench
