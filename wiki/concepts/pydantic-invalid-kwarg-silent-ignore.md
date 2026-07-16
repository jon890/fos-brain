---
type: concept
created: 2026-06-12
updated: 2026-06-12
---

# Pydantic 무효 kwarg 는 조용히 버려진다 — 옵션 적용은 결과 객체로 검증

pydantic 모델 생성 시 존재하지 않는 필드명을 kwarg 로 넘기면 예외 없이 extra 로 폐기되어, 의도한 옵션이 적용되지 않은 채 기본값으로 동작한다.

## 핵심 포인트

- 존재하지 않는 필드명 kwarg 는 예외를 던지지 않고 extra 로 폐기된다 — 호출은 성공하지만 효과가 없다.
- 실측 사례: docling `PdfFormatOption` 에 `ThreadedPdfPipelineOptions=...` 를 넘겼으나 그 필드가 없어 무시되고 기본 `StandardPdfPipeline` 으로 동작했다.
- pipeline 류 옵션은 적용 여부를 생성 결과 객체 속성으로 직접 검증해야 한다.
  - 예: `format_option.pipeline_cls` 가 무엇인지 venv 에서 직접 출력해 확인한다.
  - 코드만 보고 적용됐다고 가정하면 안 된다.
- docs 와 코드가 어긋나는 부패의 근원이 된다 — 의도(threaded)를 docs 에 적었지만 코드는 기본 경로로 도는 상태가 만들어진다.

## 관련 개념

- [[review-bot-suggestion-verify]] — 마찬가지로 "적용 전 실측" 으로 묻혀버린 실패를 막는 패턴

## Sources

- 원본: work 네임스페이스에서 이관 (일반화)
