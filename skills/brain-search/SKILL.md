---
name: brain-search
description: 개인 지식 기반(brain, ~/personal/fos-brain) 의 wiki/ 와 raw/ 를 검색해 질문에 답하고, 새로 발견한 통찰은 brain 에 환원한다. 공개·개인비공개·회사 세 네임스페이스를 모두 검색하며 출처에 네임스페이스를 표기. "brain search", "brain 검색", "brain 에 물어봐", "내 brain 에서", "지식 검색", "내 지식 기반에서", "wiki query", "위키에 물어봐", "vault 에서 찾아줘" 같은 요청 시 사용.
---

# brain-search

Karpathy 워크플로우의 Q&A 단계. brain 지식 기반만으로 답하고, 정리된 새 내용은 brain 에 다시 저장한다.

## 대상 디렉터리

`~/personal/fos-brain` — 세 네임스페이스 전부 로컬 검색 대상:

- public — 루트 `wiki/`, `raw/`
- private — `private/wiki/`, `private/raw/`
- work — `work/<회사>/wiki/`, `work/<회사>/raw/` (회사별 서브레벨, 예: `work/nhn/`)

특정 네임스페이스로 한정하라는 지시가 있으면 그 트리만 검색한다.

## 절차

1. **1차 검색** — 네임스페이스별로:
   - public: 페이지 ≤ 20 이면 `wiki/INDEX.md` 한 줄 요약으로 후보 추리기. 그 이상·의미 질문은 `qmd query "<질문>" -n 5`.
   - private·work: 각 `*/wiki/INDEX.md` + `grep -ri "<키워드>" private/wiki work/wiki`(qmd 컬렉션을 등록했으면 `qmd query -c brain-private` 등 사용).
2. **개념 페이지 정독** — 후보 페이지(최대 5개)를 읽고 답이 충분한지 판단.
3. **부족하면 raw 로 하강** — 각 페이지 Sources 를 따라 원본까지 내려가 인용 근거 확보.
4. **답변 작성**
   - 출처 명시 + **네임스페이스 태그**(예: `[private] [[concepts/...]]`, `[work] ...`).
   - brain 에 없는 정보로 답한 경우 명시 — "이 부분은 brain 에 없어 일반 지식으로 답함".
5. **환원 (Loop back)**
   - 답변이 추가 가치가 있으면 `AskUserQuestion` 으로 묻고, **어느 네임스페이스에** 환원할지도 함께 확인.
   - 공개 페이지에 비공개 출처 내용을 그대로 옮기지 않는다(유출 방지).
   - 사용자가 거부하면 환원하지 않는다.
6. **log append (필수)** — 환원한 네임스페이스의 `<ns>/wiki/log.md` 에:
   ```
   ## [YYYY-MM-DD] search | <질문 요약>
   - 근거: <인용 페이지 (네임스페이스 포함)>
   - 환원: <새 페이지 / 보강 / 없음>
   ```

## 검색 전략

- 정확 키워드: `qmd search "<term>" -c brain-wiki`(public) 또는 `grep -ri`(비공개)
- 의미 검색: `qmd vsearch "<text>"`
- 하이브리드: `qmd query "<question>"` — 일반 Q&A 기본값(public)
- 후보 5개 이상이면 INDEX 요약·qmd 점수로 좁힌다.
- brain 외부 정보가 명백히 필요하면 사용자에게 알린 후 WebSearch.

### 하이픈 식별자 함정 (qmd vec/hyde)

`docu-parser`, `ai-playground-docu-parser` 처럼 하이픈이 든 식별자를 쿼리에 그대로 넣으면 파서가 `-parser` 를 negation(제외)으로 해석한다.

- **vec / hyde** — negation 미지원이라 에러로 실패한다 (`Negation (-term) is not supported`). 하이픈 식별자 대신 공백으로 풀어쓴다 — `"문서 파서 grafana"`, `"document parser worker pool"`.
- **lex** — negation 이 의도된 기능이라 에러는 안 나지만, `docu-parser` 가 `docu AND NOT parser` 로 새어 엉뚱한 결과를 준다. 정확 일치는 따옴표로 감싼다 — `"docu-parser"`.
- 이건 저장 측 문제가 아니다. 문서 본문에 하이픈 식별자가 있어도 매칭엔 지장 없다 — 식별자를 인위로 개명하지 말고 쿼리 쪽에서만 처리한다.

## 출력 형식

- 짧은 질문: 인라인 답변 + 출처 링크(네임스페이스 태그)
- 복잡한 질문: 답변 / 근거 / 환원 제안 3단

## 금지

- 출처 없는 추측을 brain 정보처럼 제시
- 사용자 승인 없이 자동 환원
- 비공개(private·work) 내용을 공개(public) 페이지로 유출
- raw 수정
