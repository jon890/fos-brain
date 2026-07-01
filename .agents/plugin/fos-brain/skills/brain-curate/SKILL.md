---
name: brain-curate
description: Claude Code(~/.claude/projects/**/*.jsonl)와 Codex CLI(~/.codex/sessions/**/*.jsonl) 세션 기록을 증분 분석해 개인 지식 기반(brain, ~/personal/fos-brain)에 올릴 durable 지식 후보를 자동 추출하고, 통합 리포트로 미리보기한 뒤 사용자가 고른 것만 brain-add로 통합한다. "세션 분석해서 brain에 올려", "claude 대화 정리해서 brain", "codex 세션 정리해서 brain", "지난 세션들 brain 큐레이션", "세션에서 지식 추출", "대화 세션 분석해서 지식 정리", "brain curate", "세션 하베스트", "내 작업 세션들 brain에 반영" 같은 요청 시 반드시 이 스킬을 사용한다. 단일 소스(URL·영상·메모·현재 대화)를 직접 넣는 것은 brain-add를 쓴다 — 이 스킬은 여러 과거 세션을 훑어 후보를 발굴하는 큐레이션 전용이다.
---

# brain-curate

여러 Claude Code 세션 기록을 훑어 brain 에 올릴 가치가 있는 durable 지식을 발굴하는 큐레이션 워크플로우.
실제 등록은 `brain-add` 에 위임한다 — 이 스킬은 **무엇을 올릴지 발굴·선별**까지 책임진다.

핵심 설계 사실:

- 세션 jsonl 은 한 파일이 수 MB~십수 MB 이고 대부분이 tool 출력이다. 통째로 LLM 에 못 넣는다 → 전처리 스크립트가 필수다.
- 세션은 일회성 작업의 연속이라 그대로 옮기면 brain 이 오염된다 → 작업이 아니라 **거기서 배운 재사용 가능한 것**을 뽑는다.
- 특히 회사 work 세션은 코드 diff 보다 **사내에서만 통하는 운영 방식·조회법·판단 기준**을 우선한다. 코드에 이미 남는 구현 세부는 제외하거나 기존 페이지의 짧은 근거로만 둔다.
- 자동 등록은 절대 하지 않는다 (fos-brain 철칙) → 항상 미리보기 → 선택 → 등록.

## 대상 디렉터리

`~/personal/fos-brain` — brain 본체. 다른 곳에서 호출됐으면 사용자에게 확인한다.

세션 기록은 두 소스에서 온다 — `--tool` 로 선택한다(기본 `both`).

- Claude Code: `~/.claude/projects/<인코딩된-경로>/<세션id>.jsonl`
- Codex CLI: `~/.codex/sessions/<yyyy>/<mm>/<dd>/rollout-*.jsonl` (OpenAI Responses API 계열 스키마 — `event_msg.user_message`/`agent_message`, `response_item.function_call`/`function_call_output`)

`extract_transcript.py` 는 첫 줄을 보고 두 포맷을 자동 감지한다(`--format`으로 강제 가능).

## 상태 파일 (증분 워터마크)

`~/.claude/brain-curate.state.json` — 마지막 큐레이션 시점을 기록해 같은 세션을 두 번 보지 않는다.

```json
{
  "last_curated": 1749700000.0,
  "last_run_iso": "2026-06-12 11:40",
  "runs": [{"iso": "...", "sessions": 25, "registered": 3}]
}
```

없으면 첫 실행으로 간주한다.

## 1단계 — 범위 선정

`scripts/list_sessions.py` 로 분석 대상을 좁힌다. 결과는 mtime 내림차순 JSON.

**첫 실행** (state 파일 없음): 누적분이 많으므로 `AskUserQuestion` 으로 범위를 받는다.

- 최근 N일 (예: 7일) — `--days 7`
- 특정 프로젝트만 — `--project <폴더문자열>`
- 크기 하한 — `--min-bytes 51200` (자투리 세션 제거 권장)

**이후 실행** (증분): state 의 `last_curated` 를 `--since` 로 넘긴다.

```bash
python3 scripts/list_sessions.py --since <last_curated> --min-bytes 51200
```

노이즈 필터(`--exclude-temp`)는 기본 끈다 — 가치 판단은 추출 단계 sub-agent 에 맡긴다.
단 대상이 너무 많으면(수십 개 이상) 사용자에게 규모를 알리고 `--exclude-temp` 나 범위 축소를 제안한다.

`brain` 플러그인(`.agents/plugin/brain`)의 Stop hook 이 세션 종료마다 `staging/pending-sessions.jsonl` 에 포인터(도구·session_id·transcript 경로)를 남긴다. 이건 발굴 데이터 소스가 아니라 "세션이 끝났다"는 트리거 신호일 뿐이다 — 실제 대상 목록은 항상 `list_sessions.py` 의 디렉터리 스캔으로 만든다(더 정확하고 mtime 기준 정렬도 된다).

대상 목록(개수·크기·네임스페이스 추정·경로)을 사용자에게 간단히 보고하고 진행한다.

## 2단계 — 전처리 (정제)

각 대상 세션을 `scripts/extract_transcript.py` 로 정제 텍스트로 변환한다.
tool 출력·중간 로그를 걷어내 16배 안팎으로 줄이면서 "무엇을 왜 했고 무엇을 알아냈는가" 맥락은 남긴다.

```bash
mkdir -p /tmp/brain-curate
python3 scripts/extract_transcript.py <세션.jsonl> > /tmp/brain-curate/<세션id>.txt
```

- 기본 `--max-result-chars 1500` (tool_result 절단 상한). 에러·실패 라인은 우선 보존된다.
- 정제 후에도 큰 세션(수백 KB+)은 추출 agent 입력 한도를 넘을 수 있다 → 그 세션만 절반으로 나눠 두 agent 에 분배하거나 `--max-result-chars` 를 줄인다.

## 3단계 — 병렬 추출 (fan-out)

정제된 transcript 들을 sub-agent 에 분배해 durable 후보를 뽑는다.
각 agent 는 `references/extraction-criteria.md` 의 기준과 출력 스키마를 따른다.

**규모에 따라 방식을 고른다:**

- 대상이 **8개 이하**: `Agent` 도구를 한 메시지에 여러 개 띄워 병렬 처리한다.
- 대상이 많으면: `Workflow` 로 fan-out 한다(토큰을 많이 쓰므로 규모를 사용자에게 먼저 알린다).
  - **Workflow `args` 함정 (실측)**: 이 런타임에서 `args` 가 스크립트에 배열로 전달되지 않아 `items.map` 이 `undefined is not a function` 으로 깨진다. 대상 목록을 `args` 로 넘기지 말고 **스크립트 본문에 데이터 배열을 직접 임베드**한다(`const items = [{txt, project, ns}, ...]`). 스크립트는 파일시스템 접근이 안 되므로 정제본 경로를 이렇게 박아 넣는 게 유일한 방법이다.
  - 각 agent 에 `schema` 를 주면 검증된 JSON(`{candidates:[...]}`)으로 반환된다. 큰 정제본(1MB+)도 agent 가 `Read` 로 읽으면 처리된다.
  - **대량 fan-out rate limit (실측)**: 50개 이상을 한 Workflow 에 parallel 로 주면 16-concurrent 로 빠르게 쏟아져 서버측 일시 rate limit(`Server is temporarily limiting requests · not your usage limit`)에 걸려 다수가 빈 결과로 실패한다. **20개씩 배치로 나눠** 여러 Workflow 로 순차 실행한다. 실패해도 `.then` 이 빈 candidates 를 반환하므로, **빈 결과 세션만 추려 다음 배치에서 재시도**하면 된다(이미 성공한 세션은 건너뛴다).

각 추출 agent 프롬프트에 담을 것:

- 정제 transcript 파일 경로 (또는 내용)
- `references/extraction-criteria.md` 를 읽으라는 지시
- 출력은 스키마대로의 JSON 만 (`{"candidates": [...]}`, durable 후보 없으면 빈 배열)
- 세션의 프로젝트 경로 (네임스페이스 1차 추정용)
- work 후보는 "회사 내부 운영 지식인가, 코드·git 으로 자명한 구현 기록인가" 를 반드시 판정하라는 지시

각 후보에 출처 세션 경로를 붙여 둔다(나중에 Sources 추적·중복 판단에 쓴다).

## 4단계 — 중복 제거

추출된 각 후보를 brain 에서 검색해 신규/보강을 가른다. 같은 지식이 이미 있으면 새로 만들지 않는다.

- public: `qmd query "<후보 제목·핵심>"` 또는 `qmd search "<키워드>" -c brain-wiki`. 의미 중복은 `qmd vsearch` 도 본다.
- 회사: `qmd query "..." ` 에 `brain-work-nhn` 컬렉션, 없으면 `grep -rli "<키워드>" work/*/wiki/`.
- 분류: **신규** / **기존 보강**(어느 페이지) / **후보끼리 중복**(여러 세션이 같은 걸 말함 → 하나로 병합).
- work 후보는 신규 노드 수를 보수적으로 잡는다. 사내 로그 조회법, admin 화면 의미, 운영 판단 기준은 남기고, 코드 변경 사실은 기존 노드의 Sources 근거나 제외 항목으로 처리한다.

여러 세션에서 같은 후보가 나오면 병합해 한 항목으로 만들고, 근거 세션을 모두 모은다.

## 5단계 — 네임스페이스 라우팅

각 후보의 네임스페이스를 확정한다. 1차 추정(경로 기반)을 검토하고, 회사 운영 세부가 있으면 보수적으로 `work` 로 둔다.

- fos-study 출처처럼 이미 공개 검증된 내용은 `public` 기본.
- 사내 레포·내부 문서·미공개 아키텍처는 `work`.
- 개인 비공개는 `private`.
- 애매하면 미리보기에서 사용자에게 묻는다.

## 6단계 — 통합 리포트 미리보기 (사용자 개입, 필수)

후보 전체를 채팅 본문에 **인라인 표**로 보여준다. 파일로만 저장하지 않는다(사용자가 검토·수정해야 한다).

| # | 후보 | 타입 | 신규/보강 | NS | 근거 세션 | durable 이유 |
|---|------|------|-----------|----|-----------|--------------|
| 1 | ... | concept | 신규 | public | docu-parser 2건 | ... |
| 2 | ... | concept | 보강: [[기존페이지]] | work | ... | ... |

- 함정에만 편중되지 않았는지 점검한다(개념·결정·도메인 지식이 같이 있는가).
- work 후보는 "회사 내부 운영 지식" / "코드로 자명해 제외" / "skill 로 라우팅" 중 하나를 표에 드러낸다.
- `verified:false` 후보는 "미검증 — 확인 필요" 로 표시한다.
- 표가 길면 핵심 후보 위주로 추리고 나머지는 접어 둔다.

### HTML 미리보기 (보조)

채팅 인라인 표만으로는 표·페이지 레이아웃이 잘 안 보인다. 등록 전 검토용으로 Quartz 톤 HTML 미리보기를 만들어 브라우저로 띄운다(인라인 표시가 1차, HTML 은 보조).

```bash
python3 scripts/generate_preview.py --data <preview.json> --out /tmp/brain-preview.html
cmux browser open "file:///tmp/brain-preview.html"
```

- 입력 JSON: `{title, namespace, stats, candidates[], pages[]}`. candidates(후보 표)·pages(wiki 페이지 본문 미리보기) 중 있는 것만 렌더된다.
- 템플릿은 `templates/preview.html` — Quartz 실측 색(`#faf8f8`·`#284b63`)·폰트(Schibsted Grotesk·Source Sans 3). 네임스페이스 색 뱃지(public·work·private) 지원.
- 폰트는 Google Fonts CDN — 오프라인이면 시스템 폰트로 대체된다.
- 본문에 `</script>` 가 있으면 생성기가 거부한다.

### 등록 전 가독성 검증 (필수)

미리보기에 넣을 wiki 페이지 본문(`pages[].markdown`)은 등록 전에 fos-brain 가독성 표준을 통과해야 한다. brain-add 가 8단계에서 처리하지만, 미리보기 단계에서 먼저 검증하면 사용자가 깨끗한 본문을 본다.

```bash
python3 ~/personal/fos-brain/scripts/brain-readability.py <페이지파일...>
```

- 스크립트가 잡는 것: 인라인 연결(` + `/` · `/` & `), 콤마 5+ 나열, `~` 취소선 함정, `§` 기호.
- 스크립트가 **못 잡아 수동 점검할 것**: `·` 3항목 나열, paragraph 평문·정의 문장의 명사형 종결("...방법.", "...설계." → "...이다."), 한 bullet 에 정보 3개 이상 압축.

## 7단계 — 선택 (AskUserQuestion)

등록할 후보를 `AskUserQuestion`(multiSelect)으로 받는다. 후보가 많으면 묶음으로 나눠 묻거나 번호로 받는다.
네임스페이스가 갈리는 후보는 그 결정도 함께 묻는다. 미리보기와 질문을 같은 턴에 묶지 않는다 — 사용자가 표를 읽은 다음 턴에 선택받는다.

## 8단계 — 등록 (brain-add 위임)

선택된 후보만 `brain-add` 로 넘긴다. 후보의 정보(제목·요약·핵심·네임스페이스·근거 세션)를 brain-add 의 입력으로 정리해 호출한다.

- 근거 세션 경로를 Sources 로 남기되, raw 출처가 세션 기록이므로 핵심 요약을 `<ns>/raw/notes/` 에 대화 요약으로 저장한 뒤 컴파일한다(원문 jsonl 전체가 아니라 재사용 가치 있는 핵심만).
- brain-add 가 백링크·INDEX·log·가독성 검증·재색인(qmd update/embed)·검색 검증(query test)을 처리한다 — 중복 구현하지 않는다. brain-add 를 호출하면 9·10단계까지 끝까지 돌려 재색인·검색 검증이 누락되지 않게 한다.

## 9단계 — 마무리

- **워터마크 갱신**: `~/.claude/brain-curate.state.json` 의 `last_curated` 를 이번 실행 시작 시각으로, `runs` 에 요약 추가.
- **log**: brain-add 가 각 네임스페이스 `wiki/log.md` 에 add 기록을 남긴다. 추가로 큐레이션 단위 요약 한 줄을 남겨도 된다.
- **임시 파일 정리**: `/tmp/brain-curate/` 는 남겨도 무방하나 원하면 삭제.
- **요약 보고**: 분석한 세션 수, 추출 후보 수, 등록·보류·제외를 표로 보고.

## 금지

- 자동 등록 (미리보기·선택 없이 brain 에 쓰기).
- 세션 원문 jsonl 전체를 raw 로 저장 (핵심 요약만).
- 일회성 작업 기록을 durable 지식으로 등록 (git 으로 자명한 것).
- 공개 페이지에서 private·work 링크.
- 한 번에 너무 많은 세션을 무차별 처리 (규모를 사용자에게 알리고 범위를 좁힌다).
