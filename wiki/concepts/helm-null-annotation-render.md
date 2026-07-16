---
type: concept
created: 2026-06-12
updated: 2026-06-12
---

# Helm 공통 values 의 annotation 을 환경별로 제거할 때 null 처리 함정

공통 values.yaml 의 annotation 을 환경별 values 에서 빼려면 키를 삭제하면 안 되고 명시적 null 을 줘야 하는데, 일부 chart 는 null 을 `"<nil>"` 문자열로 렌더하므로 deep-merge 동작을 반드시 helm template 로 검증해야 한다.

## 핵심 포인트

- helm values 는 deep merge 라 공통 values 의 annotation 이 환경별 override 에 자동 상속된다 — 키를 생략하면 공통값이 그대로 남는다.
- 제거하려면 키는 두고 값에 null(또는 `~`)을 명시해야 한다.
- 함정: chart 에 따라 null 이 빈 값이 아니라 `"<nil>"` 리터럴 문자열로 렌더될 수 있다.
  - 공인·사설 로드밸런서를 가르는 핵심 annotation 에 정의되지 않은 값이 박힌다.
  - python 파싱이 `"<nil>"` 을 빈 값으로 오인할 수 있다.
- annotation 제거 의도는 반드시 helm template 렌더 결과를 byte 단위로 확인해 검증한다.

## Sources

- 원본: work 네임스페이스에서 이관 (일반화)
