# ADR-001: OKF는 내부 형식이 아니라 호환 경계로 적용한다

- **결정**: 내부 wiki의 기존 frontmatter와 bare-slug 링크를 유지하고, OKF v0.2와 겹치는 의미 필드를 점진적으로 추가한다.
  외부 교환은 public 전용 내보내기에서 표준 Markdown 링크와 OKF 묶음으로 변환한다.
- **맥락**: fos-brain의 공개·비공개 병합 Quartz는 경로를 모르는 bare-slug 링크에 의존한다.
  반면 OKF 소비자는 표준 Markdown 링크와 출처·생성·검증·수명 신호를 활용한다.
  OKF는 2026년에 공개된 초기 규격이므로 내부 저장 형식을 전면 이전하면 규격 변화와 링크 회귀 비용이 크다.
- **대안 기각**: 모든 wiki 문서를 즉시 OKF 형식으로 이전하는 안은 기존 링크 계약을 깨고 100여 개 문서의 의미 메타데이터를 한 번에 추정하게 하므로 기각한다.
  현재 형식을 그대로 두고 교환 기능을 만들지 않는 안은 출처와 최신성 신호를 검색·표시에 재사용하기 어렵기 때문에 기각한다.
- **트레이드오프**: 내부 형식과 내보내기 형식 사이에 변환 검증이 필요하다.
  대신 Quartz 호환성과 private 경계를 유지하면서 OKF 변화는 한 계층에서 흡수할 수 있다.

참고 자료는 [Google Cloud의 OKF 소개](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing), [OKF v0.2 신뢰 신호](https://cloud.google.com/blog/products/data-analytics/okf-v0-2-adds-trust-signals), [OKF 명세](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)다.
