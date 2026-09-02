---
name: brain-curate
description: Claude Code(~/.claude/projects/**/*.jsonl)와 Codex CLI(~/.codex/sessions/**/*.jsonl) 세션 기록을 증분 분석해 개인 지식 기반(brain, ~/personal/fos-brain)에 올릴 durable 지식 후보를 자동 추출하고, 통합 리포트로 미리보기한 뒤 사용자가 고른 것만 brain-add로 통합한다. "세션 분석해서 brain에 올려", "claude 대화 정리해서 brain", "codex 세션 정리해서 brain", "지난 세션들 brain 큐레이션", "세션에서 지식 추출", "대화 세션 분석해서 지식 정리", "brain curate", "세션 하베스트", "내 작업 세션들 brain에 반영" 같은 요청 시 반드시 이 스킬을 사용한다. 단일 소스(URL·영상·메모·현재 대화)를 직접 넣는 것은 brain-add를 쓴다 — 이 스킬은 여러 과거 세션을 훑어 후보를 발굴하는 큐레이션 전용이다.
---
# brain-curate

여러 Claude Code와 Codex CLI 세션 기록을 훑어 brain에 올릴 가치가 있는 durable 지식을 발굴하는 큐레이션 워크플로우다.
실제 등록은 `brain-add`에 위임한다. 이 스킬은 **무엇을 올릴지 발굴·선별**까지 책임진다.

핵심 설계 사실:

- 세션 jsonl 은 한 파일이 수 MB~십수 MB 이고 대부분이 tool 출력이다. 통째로 LLM 에 못 넣는다 → 전처리 스크립트가 필수다.
- 세션은 일회성 작업의 연속이라 그대로 옮기면 brain 이 오염된다 → 작업이 아니라 **거기서 배운 재사용 가능한 것**을 뽑는다.
- 회사·팀 지식(사내에서만 통하는 운영 방식·조회법·업무 기록)은 개인 brain 저장 후보에서 제외하고 `route`와 `nbrain`으로 기록한다.
- 자동 등록은 절대 하지 않는다 (fos-brain 철칙) → 항상 미리보기 → 선택 → 등록.

## 0단계: 공용 지식 유입 정책 읽기

추출 기준이나 세션 목록을 적용하기 전에 [`../../references/knowledge-admission-policy.md`](../../references/knowledge-admission-policy.md)를 읽는다.
모든 후보는 공용 정책의 판정 기록 계약을 사용한다.
의미 적합성을 숫자 점수나 키워드 일치로 자동 승인하지 않는다.

## 대상 디렉터리

세션 기록은 두 소스에서 온다. `--tool`로 선택한다(기본 `both`).
이하 `<skill-dir>`은 이 `SKILL.md`가 있는 디렉터리다. 번들 스크립트는 현재 작업 디렉터리가 아니라 이 경로를 기준으로 실행한다.

- Claude Code: `~/.claude/projects/<인코딩된-경로>/<세션id>.jsonl`
- Codex CLI: `~/.codex/sessions/<yyyy>/<mm>/<dd>/rollout-*.jsonl` (OpenAI Responses API 계열 스키마 — `event_msg.user_message`/`agent_message`, `response_item.function_call`/`function_call_output`)

`extract_transcript.py` 는 첫 줄을 보고 두 포맷을 자동 감지한다(`--format`으로 강제 가능).

## 상태 파일 (증분 워터마크)

`<skill-dir>/scripts/curate_state.py`가 도구에 종속되지 않는 로컬 상태 디렉터리에 마지막 큐레이션 시점을 기록한다.
기존 `~/.claude/brain-curate.state.json`이 있으면 첫 갱신 때 값을 이어받는다.

```bash
python3 "<skill-dir>/scripts/curate_state.py" show
```

출력의 `state.last_curated`가 없으면 첫 실행으로 간주한다.

## 1단계: 범위 선정

`<skill-dir>/scripts/list_sessions.py`로 분석 대상을 좁힌다. 결과는 mtime 내림차순 JSON이다.

**첫 실행** (state 파일 없음): 누적분이 많으므로 사용자에게 범위를 묻는다.

- 최근 N일 (예: 7일) — `--days 7`
- 특정 프로젝트만 — `--project <폴더문자열>`
- 크기 하한 — `--min-bytes 51200` (자투리 세션 제거 권장)

**이후 실행** (증분): state 의 `last_curated` 를 `--since` 로 넘긴다.

```bash
python3 "<skill-dir>/scripts/list_sessions.py" --since <last_curated> --min-bytes 51200
```

노이즈 필터(`--exclude-temp`)는 기본 끈다. 가치 판단은 추출 단계 sub-agent에 맡긴다.
대상이 현재 실행에서 다루기 어려울 만큼 많으면 사용자에게 규모를 알리고 `--exclude-temp`나 범위 축소를 제안한다.

대상 목록(개수·크기·네임스페이스 추정·경로)을 사용자에게 간단히 보고하고 진행한다.

## 2단계: 전처리 (정제)

각 대상 세션을 `<skill-dir>/scripts/extract_transcript.py`로 정제 텍스트로 변환한다.
tool 출력·중간 로그를 걷어내면서 "무엇을 왜 했고 무엇을 알아냈는가" 맥락은 남긴다.

```bash
mkdir -p /tmp/brain-curate
python3 "<skill-dir>/scripts/extract_transcript.py" <세션.jsonl> > /tmp/brain-curate/<세션id>.txt
```

- 기본 `--max-result-chars 1500` (tool_result 절단 상한). 에러·실패 라인은 우선 보존된다.
- 정제 후에도 추출 agent 입력 한도를 넘는 세션은 의미 단위로 나누거나 `--max-result-chars`를 줄인다.

## 3단계: 병렬 추출

정제된 transcript에서 durable 후보를 뽑는다. 서로 독립된 세션이 많고 병렬화가 실제로 유리할 때만 현재 환경에서 사용할 수 있는 sub-agent에 나눈다.
각 agent는 공용 정책과 `references/extraction-criteria.md`의 세션 전처리 기준을 따른다.

각 추출 agent 프롬프트에 담을 것:

- 정제 transcript 파일 경로 (또는 내용)
- 공용 정책과 `references/extraction-criteria.md`를 읽으라는 지시
- 출력은 스키마대로의 JSON 만 (`{"candidates": [...]}`, durable 후보 없으면 빈 배열)
- 세션의 프로젝트 경로 (네임스페이스 1차 추정용)
- 회사·팀 지식은 `route`와 `nbrain`으로만 판정하라는 지시

각 후보에 출처 세션 경로를 붙여 둔다(나중에 Sources 추적·중복 판단에 쓴다).

## 4단계: 중복 제거

추출된 각 판정 기록을 합친 뒤 brain에서 검색해 `admit`과 `reinforce`를 가른다.
같은 지식이 이미 있으면 새로 만들지 않는다.

- public: `qmd query "<후보 제목·핵심>"` 또는 `qmd search "<키워드>" -c brain-wiki`. 의미 중복은 `qmd vsearch` 도 본다.
- 분류: **신규** / **기존 보강**(어느 페이지) / **후보끼리 중복**(여러 세션이 같은 내용을 말하면 하나로 병합).
- 병합한 기록은 공용 정책 필드를 유지하고 모든 근거 세션을 `evidence`에 모은다.
- 회사·팀 지식은 개인 brain 후보와 합치지 않고 `route`와 `nbrain`을 유지한다.

여러 세션에서 같은 후보가 나오면 병합해 한 항목으로 만들고, 근거 세션을 모두 모은다.

## 5단계: 네임스페이스 라우팅

각 후보의 목적지와 공개 범위를 공용 정책으로 확정한다.

- fos-study 출처처럼 이미 공개 검증된 내용은 `public` 기본.
- 사내 레포·내부 문서·미공개 아키텍처·회사 운영 세부는 `nbrain`으로 보낸다.
- 개인 비공개는 `private`.
- 애매하면 미리보기에서 사용자에게 묻는다.

## 6단계: 통합 리포트 미리보기 (사용자 개입, 필수)

후보 전체를 채팅 본문에 **인라인 표**로 보여준다. 파일로만 저장하지 않는다(사용자가 검토·수정해야 한다).


| # | 후보 | 판정 | 가치 축 | 목적지 | 근거 세션 | 이유 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ... | `admit` | `decision` | public | 개인 세션 2건 | ... |
| 2 | ... | `reinforce` | `taste` | private | ... | ... |


- 함정에만 편중되지 않았는지 점검한다(개념·결정·도메인 지식이 같이 있는가).
- `route`와 `reject` 후보도 목적지와 제외 이유를 표에 드러낸다.
- 근거가 불충분해 저장하지 않은 후보는 판정과 이유를 "확인 필요"로 표시한다.
- 표가 길면 핵심 후보 위주로 추리고 나머지는 접어 둔다.

### HTML 미리보기 (보조)

채팅 인라인 본문만으로는 후보와 페이지 레이아웃이 잘 안 보인다. 등록 전 검토용으로 현재 Memory Atlas 문서 화면의 시각 언어를 반영한 HTML 미리보기를 브라우저로 띄운다(인라인 표시가 1차, HTML 은 보조).

```bash
python3 "<skill-dir>/scripts/generate_preview.py" --data <preview.json> --out /tmp/brain-preview.html
"<skill-dir>/scripts/show_preview.sh" /tmp/brain-preview.html
```

- 입력 JSON: `{title, stats, candidates[], pages[]}`. candidates(후보 카드)·pages(wiki 페이지 본문 미리보기) 중 있는 것만 렌더된다.
- 후보는 공용 판정 스키마의 판정, 가치 축, 목적지, 근거, 이유를 렌더한다.
- 템플릿은 `templates/preview.html`이다. 현재 Memory Atlas 문서 화면의 심해 색상, Gowun Batang 제목, IBM Plex Sans KR 본문과 IBM Plex Mono 상태 표기를 사용한다.
- 미리보기는 3D 그래프를 복제하지 않는다. 후보 승인과 문서 읽기에 필요한 항해도 내비게이션, 정보 위계, 읽기 폭과 모바일 경계만 재현한다.
- `scripts/show_preview.sh`는 설치된 `content-preview`의 탭 갱신 절차를 우선 사용한다. 해당 스킬이 없는 환경에서만 시스템 브라우저로 연다.
- 폰트는 Google Fonts CDN을 사용하며 오프라인이면 시스템 폰트로 대체된다.
- 본문에 `</script>` 가 있으면 생성기가 거부한다.

## 7단계: 선택

등록할 후보를 사용자에게 받는다. 구조화된 복수 선택 도구가 있으면 사용하고, 없으면 번호로 받는다.
네임스페이스가 갈리는 후보는 그 결정도 함께 묻는다. 미리보기와 질문을 같은 턴에 묶지 않고 사용자가 표를 읽은 다음 턴에 선택받는다.

## 8단계: 등록 (brain-add 위임)

선택된 `admit`과 `reinforce` 후보만 판정 기록과 함께 `brain-add`로 넘긴다.
brain-add가 다시 미리보기와 승인을 거친 뒤에만 raw와 wiki에 저장한다.
선택한 저장 후보가 없으면 raw, wiki, INDEX, log, qmd를 바꾸지 않는다.

## 9단계: 마무리

- **워터마크 갱신**: 등록 단계까지 마친 뒤 다음 명령으로 실행 시작 시각과 결과 요약을 기록한다.
  `python3 "<skill-dir>/scripts/curate_state.py" advance --started-at <실행-시작-epoch> --sessions <분석-수> --registered <등록-수>`
- **log**: brain-add 가 각 네임스페이스 `wiki/log.md` 에 add 기록을 남긴다. 추가로 큐레이션 단위 요약 한 줄을 남겨도 된다.
- **임시 파일 정리**: 민감한 세션 정제본이 남지 않도록 `/tmp/brain-curate/`를 기본 삭제한다. 사용자가 디버깅 보존을 명시한 경우에만 남긴다.
- **요약 보고**: 분석한 세션 수, 추출 후보 수, 등록·보류·제외를 표로 보고.

## 금지

- 자동 등록 (미리보기·선택 없이 brain 에 쓰기).
- 세션 원문 jsonl 전체를 raw 로 저장 (핵심 요약만).
- 일회성 작업 기록을 durable 지식으로 등록 (git 으로 자명한 것).
- 공개 페이지에서 private 링크.
- 한 번에 너무 많은 세션을 무차별 처리 (규모를 사용자에게 알리고 범위를 좁힌다).
