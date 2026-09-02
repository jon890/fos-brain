---
name: brain-search
description: 개인 지식 기반(brain, ~/personal/fos-brain)의 public·private wiki와 raw를 네임스페이스별로 검색해 질문에 답하고, 새로 발견한 통찰은 사용자의 승인 후 brain에 환원한다. 회사 지식 요청은 nbrain으로 라우팅한다. "brain search", "brain 검색", "brain 에 물어봐", "내 brain 에서", "지식 검색", "내 지식 기반에서", "wiki query", "위키에 물어봐", "vault 에서 찾아줘" 같은 요청 시 사용.
---

# brain-search

Karpathy 워크플로우의 Q&A 단계. brain 지식 기반만으로 답하고, 정리된 새 내용은 brain 에 다시 저장한다.

## 대상 디렉터리

`~/personal/fos-brain`에서 두 개인 네임스페이스를 독립적으로 로컬 검색한다.
이하 `<plugin-root>`는 이 스킬 디렉터리의 상위 플러그인 루트다. 번들 스크립트는 현재 작업 디렉터리가 아니라 이 경로를 기준으로 실행한다.

- public — 루트 `wiki/`, `raw/`
- private — `private/wiki/`, `private/raw/`

특정 네임스페이스로 한정하라는 지시가 있으면 그 트리만 검색한다.
회사·팀·Dooray·사내 위키 지식 요청은 개인 brain을 검색하지 말고 `nbrain`으로 라우팅한다.

환원 후보를 만들기 전에 [`../../references/knowledge-admission-policy.md`](../../references/knowledge-admission-policy.md)를 읽는다.

## 절차

1. **대상 결정** — public·private를 각각 검색한다. 회사 지식이면 여기서 멈추고 `nbrain`을 사용한다.
2. **wiki 후보 검색** — 네임스페이스별로 먼저 wiki만 검색한다.
   - `BRAIN_QMD_URL`이 있으면 `"<plugin-root>/scripts/brain-search-http.cjs" "<질문>" '["brain-wiki"]' <후보-수>` 또는 `"<plugin-root>/scripts/brain-search-http.cjs" "<질문>" '["brain-private"]' <후보-수>`를 먼저 실행한다.
   - HTTP client가 실패하면 public은 `~/.local/bin-pinned/qmd query -c brain-wiki "<질문>" -n <후보-수>`, private은 `~/.local/bin-pinned/qmd query -c brain-private "<질문>" -n <후보-수>`를 사용한다.
   - 고정 실행 파일이나 해당 collection을 쓸 수 없으면, 같은 네임스페이스의 `wiki/INDEX.md`로 후보를 좁힌 뒤 `rg`로 wiki 본문만 검색한다.
3. **후보와 관계 정독** — 각 네임스페이스에서 상위 후보만 정독하고, 관련 `[[bare-slug]]` wikilink를 한 단계만 따라 읽는다. 질문에 답할 근거가 충분해지면 후보를 더 늘리지 않는다. public에서는 private 링크를 따라가지 않는다.
4. **부족할 때만 raw로 하강** — wiki와 한 단계 관계 문서만으로 근거가 부족할 때, 같은 네임스페이스의 후보 문서 `Sources`를 따라 raw를 읽거나 해당 raw를 검색한다. raw를 1차 검색으로 사용하지 않는다.
5. **답변 작성**
   - 출처와 **네임스페이스 태그**를 함께 명시한다(예: `[public] [[ai-harness-pattern]]`, `[private] [[개념명]]`).
   - brain 에 없는 정보로 답한 경우 명시 — "이 부분은 brain 에 없어 일반 지식으로 답함".
6. **환원 (Loop back)**
   - 답변에서 생긴 후보를 공용 정책의 전체 판정 기록으로 다시 판정한다.
   - `admit`이나 `reinforce`일 때만 사용자에게 묻고, **어느 네임스페이스에** 환원할지도 함께 확인한다.
   - `route`나 `reject`면 목적지와 이유를 설명하고 개인 brain에 쓰지 않는다.
   - 공개 페이지에 비공개 출처 내용을 그대로 옮기지 않는다(유출 방지).
   - 사용자가 거부하면 환원하지 않는다.
7. **환원 기록** — 실제 환원은 `brain-add`에 위임한다. raw·wiki·INDEX·log 갱신과 미리보기·승인 계약도 `brain-add`가 단일 책임으로 수행한다. 검색만 한 경우에는 파일을 쓰지 않는다.

## 검색 전략

- HTTP 우선: `BRAIN_QMD_URL=<qmd-url> "<plugin-root>/scripts/brain-search-http.cjs" "<question>" '["brain-wiki","brain-private"]' <후보-수>`
- 정확 키워드: `~/.local/bin-pinned/qmd search "<term>" -c brain-wiki`(public) 또는 `-c brain-private`(private)
- 의미 검색: `~/.local/bin-pinned/qmd vsearch "<text>" -c <collection>`
- 하이브리드: `~/.local/bin-pinned/qmd query "<question>" -c <collection>` — 일반 Q&A 기본값
- 후보가 많으면 INDEX 요약과 qmd 점수를 함께 보고 실제로 정독할 범위를 좁힌다.
- brain 외부 정보가 명백히 필요하면 사용자에게 알린 후 WebSearch.

### HTTP qmd 축소 경로

`brain-search-http.cjs`는 qmd의 `POST /query` 계약을 사용한다.
요청은 같은 질문의 `lex`와 `vec`, 복수형 `collections`, `rerank: false`를 보낸다.
응답에 허용하지 않은 collection의 `qmd://` URI가 섞이면 실패로 처리한다.
실패 메시지는 검색 품질을 낮추는 신호일 뿐이며, private 본문이나 검색 결과를 사용자에게 노출하지 않는다.

### 하이픈 식별자 함정 (qmd vec/hyde)

`docu-parser`, `ai-playground-docu-parser` 처럼 하이픈이 든 식별자를 쿼리에 그대로 넣으면 파서가 `-parser` 를 negation(제외)으로 해석한다.

- **vec / hyde** — negation 미지원이라 에러로 실패한다 (`Negation (-term) is not supported`). 하이픈 식별자 대신 공백으로 풀어쓴다 — `"문서 파서 grafana"`, `"document parser worker pool"`.
- **lex** — negation 이 의도된 기능이라 에러는 안 나지만, `docu-parser` 가 `docu AND NOT parser` 로 새어 엉뚱한 결과를 준다. 정확 일치는 따옴표로 감싼다 — `"docu-parser"`.
- 이건 저장 측 문제가 아니다. 문서 본문에 하이픈 식별자가 있어도 매칭엔 지장 없다 — 식별자를 인위로 개명하지 말고 쿼리 쪽에서만 처리한다.

## 출력 형식

- 짧은 질문: 인라인 답변과 출처 링크(네임스페이스 태그)
- 복잡한 질문: 답변 / 근거 / 환원 제안 3단

## 금지

- 출처 없는 추측을 brain 정보처럼 제시
- 사용자 승인 없이 자동 환원
- 비공개(private) 내용을 공개(public) 페이지로 유출
- raw 수정
