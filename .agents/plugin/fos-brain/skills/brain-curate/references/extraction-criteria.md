# 세션 후보 추출 기준

추출 agent는 먼저 [`../../../references/knowledge-admission-policy.md`](../../../references/knowledge-admission-policy.md)를 읽는다.
저장 가치, 목적지, 공개 범위, 판정 기록의 허용값은 공용 정책만 따른다.
이 문서는 세션 transcript에서 근거를 찾고 후보를 합치는 방법만 설명한다.

## 세션에서 찾을 내용

세션은 일회성 작업과 도구 출력이 대부분이므로 작업 내용을 그대로 후보로 만들지 않는다.
결정 배경, 사용자에게 고유한 취향과 업무 방식, 개인 시스템 경계, 이력, 장기 적용되는 분야 이해를 찾는다.
공용 정책의 저장 가치 축과 연결되지 않으면 `reject`하거나 올바른 단일 소스로 `route`한다.

특정 파일 수정, PR 진행 상황, 배포 당일 상태처럼 코드나 git으로 확인할 수 있는 기록은 개인 brain 저장 후보가 아니다.
반복 실행 순서가 핵심이면 `skill`이나 `repo-docs`로 보낸다.
에이전트 행동 규칙이면 `agents`로 보낸다.

회사 경로에서 나온 세션은 `company` 후보로 표시한다.
회사 내부 시스템, 업무 기록, 운영 지식은 내용이 장기 유용해도 public이나 private로 보내지 않고 `nbrain`으로만 보낸다.

## 근거와 불확실성

- 각 후보의 `evidence`에 세션 경로와 근거가 나온 맥락을 남긴다.
- 정제 과정에서 도구 출력이 잘렸다면 남은 내용만으로 사실을 단정하지 않는다.
- 출처를 확인할 수 없으면 `admit`이나 `reinforce`로 판정하지 않는다.
- 여러 세션이 같은 후보를 뒷받침하면 하나로 합치고 모든 세션을 `evidence`에 남긴다.
- 후보가 없으면 빈 배열을 반환하며 개수를 맞추려고 만들지 않는다.

## 출력 스키마

공용 정책의 판정 기록을 그대로 반환한다.

```json
{
  "candidates": [
    {
      "candidate": "후보 제목",
      "decision": "admit | reinforce | route | reject",
      "value_axes": ["decision"],
      "future_question": "6개월 뒤 답할 구체적인 질문",
      "durability_reason": "일회성이 아닌 이유",
      "destination": "public | private | nbrain | skill | agents | repo-docs | none",
      "source_of_truth": "장기 관리 책임이 있는 위치",
      "sensitivity": "public | private | company",
      "freshness": "stable | review-date-required | historical",
      "evidence": ["session://source/path"],
      "reason": "판정 이유"
    }
  ]
}
```

`future_question`과 `durability_reason`을 적용할 수 없는 `route`나 `reject` 후보는 `null`을 쓴다.
최종 등록 전에 `knowledge-admission-check.cjs`로 필드와 조합을 검사한다.
검사 결과는 의미 판단이나 사용자 승인을 대신하지 않는다.
