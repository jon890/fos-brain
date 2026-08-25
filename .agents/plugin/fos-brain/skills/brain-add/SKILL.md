---
name: brain-add
description: 개인 지식 기반(brain, ~/personal/fos-brain) 에 소스를 가져와 컴파일한다. URL·유튜브·PDF·GitHub·이미지·메모·붙여넣은 텍스트를 raw/ 로 저장하고 wiki/ 의 개념 그래프에 통합(백링크·INDEX·log 갱신). "brain add", "brain 추가", "brain 에 정리", "지식 추가", "brain 에 넣어줘", "이 링크 정리해줘", "이 영상 정리", "wiki 적재", "위키 컴파일", "raw 처리해줘" 같은 요청 시 사용. 공개/개인비공개 네임스페이스 선택 지원.
---

# brain-add

Karpathy 스타일 지식 기반의 적재 단계다.
소스를 임시 위치에서 읽고 저장 가치를 판정한 뒤, 사용자가 승인한 개인 지식만 raw와 wiki에 통합한다.

## 대상 디렉터리

대상은 `~/personal/fos-brain`이다. 다른 곳에서 호출되었다면 사용자에게 확인한다.

## 공용 지식 유입 정책 (필수)

후보를 만들기 전에 [`../../references/knowledge-admission-policy.md`](../../references/knowledge-admission-policy.md)를 읽는다.
스킬 안에 별도 저장 기준을 만들지 않고 공용 정책의 판정 순서와 기록 계약을 그대로 적용한다.
의미 적합성을 숫자 점수나 키워드 일치로 자동 승인하지 않는다.

## 0단계: 네임스페이스 선택 (필수)

`AskUserQuestion` 으로 어느 brain 에 넣을지 묻는다(사용자가 이미 지정했으면 생략):

- `public` — 루트(`raw/`, `wiki/`). git commit과 Quartz 공개 대상.
- `private` — `private/`. gitignore(개인 비공개).

회사·팀 지식(사내 시스템 조회법, 업무 기록 등)은 이 brain의 대상이 아니다. `nbrain`(Dooray 위키 기반) 대상이면 등록을 건너뛰고 사용자에게 알린다.

이후 모든 경로의 `<ns>` 는 선택된 네임스페이스 루트다(public=루트, private=`private/`).

## 1단계: 소스 선택 (필수)

사용자가 소스를 명시하지 않았으면 `AskUserQuestion` 으로 묻는다:

- **현재 세션에서 논의한 내용** — `/brain-add` 를 호출하면 지금까지의 대화·결정·분석을 소스로 삼아 정리한다. 사용자가 명시 호출하면 이 옵션을 기본값으로 삼는다.
- obsidian 최근 메모(`~/personal/obsidian/YYYY년 메모/` 의 최근 변경분)
- 특정 경로(로컬 파일·디렉터리)
- URL(웹 기사)
- 유튜브 링크
- 붙여넣은 텍스트

세션 논의 내용을 등록할 때는 결론·결정·근거를 임시 대화 요약으로 만든다.
사용자가 승인한 뒤에만 재사용 가치가 있는 핵심을 `<ns>/raw/notes/`에 저장한다.

점진적 컴파일 원칙에 따라 **한 번에 raw 전체를 처리하지 않는다**.

## 2단계: 소스 임시 획득

소스 종류별로 처리하되 `/tmp/brain-add/` 같은 임시 위치에 둔다.
이 단계에서는 raw, wiki, INDEX, log, qmd 상태를 바꾸지 않는다.

| 소스 | 처리 | 승인 뒤 raw 위치 |
| --- | --- | --- |
| 웹 기사·페이지 | WebFetch → markdown 본문 | `<ns>/raw/web/` |
| 유튜브 링크 | 아래 "유튜브 처리" | `<ns>/raw/videos/` |
| PDF 논문 | Read 로 파싱(원본 PDF 도 복사) | `<ns>/raw/papers/` |
| GitHub repo | `gh`/clone 로 README·핵심 코드 | `<ns>/raw/repos/` |
| 이미지 | Read 로 시각 분석 → 설명 텍스트 | `<ns>/raw/notes/` |
| obsidian 메모 | 원본 복사(원본은 obsidian 에 그대로 둠) | `<ns>/raw/notes/` |
| 붙여넣은 텍스트 | 그대로 저장 | `<ns>/raw/notes/` |

임시 소스에 원본 URL, 수집일, 소스 종류를 함께 기록한다.
승인 뒤 raw로 보존할 때 이 출처 메타데이터를 frontmatter로 옮긴다.

### 유튜브 처리

영상·음성을 직접 듣지 못하므로 자막을 경유한다. **현재는 자막 있는 영상만 우선 지원**한다.

1. 메타 추출:
   `yt-dlp --skip-download --print "%(title)s | %(channel)s | %(upload_date)s" <URL>`
2. 자막 추출(한국어 우선, 없으면 영어, 자동자막 허용):
   `yt-dlp --skip-download --write-subs --write-auto-subs --sub-langs "ko,en" --sub-format vtt -o "/tmp/brain-add/%(id)s.%(ext)s" <URL>`
3. vtt → 평문 텍스트로 정리(타임스탬프·중복 라인 제거)해 임시 markdown 작성.
4. 자막이 전혀 없으면 사용자에게 알리고 (a) 제목·설명을 WebSearch로 보강하거나, (b) whisper 설치 후 STT(미설치, 나중에) 중에서 선택한다.
5. 자동자막 기반이면 raw 와 wiki 양쪽에 "자동자막 기반(오인식 가능)" 을 표기.

## 3단계: 현황 파악과 기존 지식 검색 (중복 방지, 필수)

새 페이지를 만들기 **전에 이미 있는지 먼저 검색한다**. brain 이 커지면 INDEX 목차만으로는 제목이 다른 유사 페이지를 놓쳐 중복이 쌓인다.

- `<ns>/wiki/INDEX.md` 읽기 — 기존 concept·topic·entity 목록 확인.
- 임시 소스 정독.
- **유사 지식 검색 (필수)** — 추출할 핵심 개념·주제마다 brain 을 검색해 기존 페이지가 있는지 본다.
  - public: `qmd query "<개념>"`(BM25+벡터+rerank) 또는 `qmd search "<키워드>" -c brain-wiki`.
  - 의미·동의어로 겹치는 페이지를 놓치지 않도록 `qmd vsearch "<문장>" -c brain-wiki`(벡터)도 함께 본다.
  - 비공개도 qmd 컬렉션이 있다 — private 는 `brain-private`. `qmd query "..." -c brain-private` 로 검색한다. 컬렉션이 아직 없는 네임스페이스만 grep 폴백: `grep -rli "<키워드>" <ns>/wiki/`.
- **검색 결과 라우팅**:
  - 의미가 겹치는 페이지가 있으면 → **신규 생성 금지, 그 페이지 보강**으로(4단계·7단계).
  - 부분만 겹치면 → 새 페이지를 만들고 기존 페이지에 양방향 백링크를 추가한다.
  - 전혀 없으면 → 신규 생성.
- 검색으로 찾은 기존·유사 페이지 목록을 6단계 미리보기에 함께 제시한다(무엇을 보강하고 무엇을 새로 만드는지 사용자가 판단하도록).

## 4단계: 개념 추출 및 cross-reference 탐색

- 임시 소스에서 별도 페이지로 다룰 개념을 선정한다.
- **Karpathy 원칙**: 한 소스 적재는 흔히 10개 이상 wiki 페이지에 영향. INDEX 의 기존 페이지를 훑어 보강·교차 참조 후보를 찾는다.
- 기존 페이지와 겹치면 **새로 만들지 말고 보강**.

### 주제 지정 적재의 커버리지 순서 (중요)

사용자가 특정 대상(도구, 개념, 시스템, 인물 등)을 지목해 "X 에 대한 지식을 쌓아라" 라고 하면, X 의 **전반을 먼저 세우고 함정은 마지막에 얹는다**. 오류·함정부터 기록하면 정작 X 가 무엇인지가 brain 에 비게 된다.

커버 순서:

1. **무엇인가** — X 의 정의, 정체성, 핵심 개념.
2. **어떻게 쓰나** — 기본 사용법, 주요 명령·인터페이스, 워크플로우.
3. **어디에·언제 쓰나** — 적용처, 쓰면 좋은 상황, 대안 대비 강점.
4. **좋은 패턴** — 재사용 가능한 모범 사용법, 권장 구성.
5. **함정·교훈** — 위 1~4 가 선 다음에 보조로 얹는 회피법. **단독으로 출발하지 않는다.**

미리보기(6단계)에서 "1부터 4까지 다뤘는가, 아니면 5(함정)로 건너뛰었는가"를 점검한다. 함정만 있으면 1부터 4까지 보강한 뒤 진행한다.

## 5단계: 지식 유입 판정 (필수)

임시 소스에서 추출한 각 후보를 공용 정책에 따라 판정한다.
각 기록은 `candidate`, `decision`, `value_axes`, `future_question`, `durability_reason`, `destination`, `source_of_truth`, `sensitivity`, `freshness`, `evidence`, `reason`을 모두 가진다.
`knowledge-admission-check.cjs`로 허용값과 조합을 검사하되, 검사 통과를 저장 가치 승인으로 해석하지 않는다.

회사 내부 후보는 `route`와 `nbrain`으로 보내고 public이나 private로 저장하지 않는다.
이미 같은 지식이 있으면 새 페이지가 아니라 `reinforce`로 판정한다.
출처를 확인할 수 없거나 사용자 정정 가능성이 큰 후보는 저장 후보로 승인하지 않고 미리보기에 불확실성을 드러낸다.

**출처별 공개 기본값 (네임스페이스 과잉 플래그 방지)**

- **fos-study 출처는 public-OK 가 기본.** fos-study 콘텐츠는 `blog-post-writer` 스킬이 민감정보를 제거해 외부 공개용으로 이미 검증한 자료다(회사명·내부 URL → 일반화). 본문에 회사·제품명이 보여도 이미 공개 수준이면 private 로 과잉 분류하지 않는다.
- 그 외 출처(사내 레포·내부 문서·미검증 대화)는 회사 운영 세부가 있으면 nbrain 대상이므로 등록 제외, 개인 비공개면 private 로.
- 애매하면 보수적으로 비공개로 분류하고 사용자에게 확인한다.

## 6단계: 핵심 요약 미리보기 (사용자 개입)

wiki에 쓰기 전에 채팅 인라인(기록용)과 HTML 미리보기(렌더링 검토용)를 **함께** 보여준다.
둘 중 하나만 띄우지 않는다. 인라인은 결정 근거를 텍스트로 남기고, HTML 은 실제 렌더·백링크 그래프를 보여준다.

### 6a. 채팅 인라인 요약

채팅 본문에 인라인으로 보여준다:

- 추출한 핵심 요약
- 5단계 **유입 판정 기록** (`admit`, `reinforce`, `route`, `reject`와 목적지, 근거, 이유)
- 3단계 **유사 지식 검색 결과** (기존·유사 페이지 → 신규 생성 vs 보강 라우팅)
- 만들·보강할 페이지 목록
- 연결할 백링크

### 6b. HTML 미리보기 (기본, 생략 금지)

페이지가 실제로 어떻게 렌더되는지, `[[wikilink]]` 백링크가 맞는지는 텍스트만으로 검토가 어렵다.
쓸 페이지 `.md`를 임시 파일로 만들어 HTML 미리보기를 띄운다. Dooray·GitHub 미리보기와 같은 관례다.

- 생성기: `scripts/generate_preview.py` (이 스킬 번들 안). 템플릿: `templates/preview.html`.
- 신규/보강을 배지로 구분하고, `[[wikilink]]` 대상이 이미 brain 에 있는지(빨간 배지 = 신규 생성 예정 또는 오타)를 표시한다.

```bash
python3 ~/.claude/skills/brain-add/scripts/generate_preview.py \
  --ns <public|private> \
  --title "<요약 제목>" \
  --summary "<한 줄 설명>" \
  --new /tmp/brain-new/*.md \
  --update /tmp/brain-update/*.md \
  --known-from ~/personal/fos-brain/wiki \
  --out /tmp/brain-preview.html
cmux browser open "file:///tmp/brain-preview.html"
```

- `--ns` 가 private 면 `--known-from` 도 그 네임스페이스 wiki 로 바꾼다 (예: `~/personal/fos-brain/private/wiki`).
- `--new` 는 새로 만들 페이지, `--update` 는 기존 보강 페이지. 보강본은 실제 brain 파일을 복사해 보강 내용을 얹은 버전을 넘긴다.
- 주의: 본문에 `</script>` 가 있으면 생성기가 거부한다. CDN 로드라 오프라인이면 스타일이 빠진다.
- 빨간 🔗 배지는 아직 없는 백링크 대상이다. 신규 생성 예정이거나 slug 오타이므로 의도와 맞는지 확인한다.

### 6c. 결정 (다음 턴)

미리보기 6a와 6b는 그 턴에 끝낸다.
유입 검증에서 갈린 항목·네임스페이스 확정은 사용자가 본문을 읽은 **다음 턴**에 `AskUserQuestion` 으로 묻는다.
미리보기와 같은 턴에 모달을 띄우면 본문을 가려 읽기 전에 결정을 강요하게 된다.
사용자 검토·승인을 받은 뒤 7단계로 진행한다.
승인한 `admit`이나 `reinforce` 후보가 없으면 raw, wiki, INDEX, log, qmd를 바꾸지 않고 종료한다.

## 7단계: raw 보존과 페이지 작성·갱신

- 승인한 후보의 출처만 `<ns>/raw/<카테고리>/`에 저장한다.
- 회사 내용이 섞인 원본은 개인 brain에 통째로 저장하지 않는다.
- 개인 지식만 독립적으로 분리할 수 있고 사용자가 확인한 경우에는 정제한 소스를 저장한다.

- 새 concept: `<ns>/wiki/concepts/<kebab-case>.md` (CLAUDE.md 스키마)
- 개체(사람·프로젝트·목표): `<ns>/wiki/entities/<kebab-case>.md`
- 보강: 기존 페이지 하단 `## 추가 (YYYY-MM-DD)` 로 append, Sources 갱신
- 새 문서와 의미를 실질적으로 보강한 문서에는 기존 `type`, `created`, `updated`와 함께 `title`, `description`, `tags`를 기록한다. 기존 문서는 권장 필드가 없다는 이유만으로 일괄 변경하지 않는다.
- 지식의 수명 상태가 필요하면 `status`를 `draft`, `stable`, `deprecated` 중에서 기록하고, 재검토 날짜가 있으면 `stale_after`를 `YYYY-MM-DD`로 기록한다.
- 검색과 교환에 구조화된 출처가 필요하면 `sources`에 필수 `resource`, 선택적 `id`, 선택적 `title`을 기록하되 본문의 `## Sources`도 유지한다.
- 에이전트 생성 사실이 있으면 `generated.by`, `generated.at`을 기록하고, 실제 검증 이력이 있으면 `verified`의 단일 객체나 객체 배열에 검증 주체 `by`와 시각 `at`을 기록한다. 확인되지 않은 값은 추정하지 않는다.
- 모든 페이지에 양방향 백링크
- **wikilink 는 bare-slug 로**: 다른 wiki 페이지는 경로 없이 파일명만 — `[[work-style]]` (O), `[[topics/work-style]]`·`[[../concepts/X]]` (X). 경로형은 로컬 전체 빌드에서 prefix 누락으로 404. 단 `raw/` Sources 링크(`[[../../raw/...]]`)는 경로형 유지(빌드 대상 아님). (CLAUDE.md 작업 원칙 3 참조)
- **링크 방향 규칙**: 공개(public) 페이지는 private 를 링크하지 않는다. 비공개 → 공개는 허용.

## 8단계: INDEX 갱신

- 새 페이지 등록, 한 줄 요약 갱신
- "마지막 brain-add" 메타에 오늘 날짜
- public·private(qmd 인덱싱 대상) 네임스페이스면 검색 인덱스 갱신: `qmd update && qmd embed` (private 는 `brain-private` 컬렉션 — `~/.config/qmd/index.yml` 에 없으면 먼저 등록)
- **카테고리 비대 점검 (topic 분리)** — 새 concept 을 등록하며 INDEX 한 카테고리가 비대해졌는지 본다.
  - 한 카테고리에 concept 이 대략 **7개를 넘고**, 그중 일부가 한 주제를 이루면 `topics/` 페이지로 묶을지 검토한다.
  - 이미 적합한 topic 이 있으면 그 Concepts 에 편입, 없으면 신설 제안.
  - **자동 분리 금지** — 주제 경계·이름은 사용자에게 확인한 뒤 진행한다.
  - 성격이 다른 항목이 한 카테고리에 섞여 있으면(예: 학습 개념과 실전 장애) 개수와 무관하게 분리를 검토한다.

## 9단계: 검색 검증 (query test, 필수)

등록·인덱싱이 끝나면 **실제로 검색되는지 확인**한다.
인덱싱 누락·컬렉션 미등록이면 다른 세션이 영영 못 찾으므로, 등록과 검색 확인을 한 묶음으로 본다(등록만 하고 검색 확인을 빠뜨리면 "넣었는데 안 나오는" 결함이 조용히 남는다).

- 등록한 핵심 개념마다 brain 을 조회해 그 페이지가 상위로 나오는지 본다.
  - public·private: `qmd query "<개념 문장>"`, 필요하면 `-c <컬렉션>` 한정(예: `-c brain-private`).
  - 비교 기준: 의도한 페이지가 1~2위로, 엉뚱한 기존 페이지보다 높은 점수로 나와야 한다.
- 안 나오면 인덱싱 경로를 점검한다.
  - 컬렉션이 `~/.config/qmd/index.yml` 에 등록됐는지 → 없으면 `path`·`pattern` 추가.
  - `qmd update && qmd embed` 를 돌렸는지 → 재실행 후 재조회.
- 검증 결과(나온 페이지·점수)를 11단계 요약 보고에 한 줄 남긴다.

## 10단계: log append (필수)

`<ns>/wiki/log.md` **파일 맨 끝**에 추가한다. 시간순 오름차순이므로 맨 위나 중간에 끼워 넣지 않는다.

```
## [YYYY-MM-DD] add | <한 줄 설명>
- Source: <처리한 raw 경로 / 원본 URL>
- 신규 N 페이지, 보강 M 페이지
```

## 11단계: 요약 보고

만든/보강한/건너뛴 페이지를 표로 보고. 건너뛴 개념은 이유 명시.
query test(9단계)에서 의도한 페이지가 상위로 나왔는지도 한 줄 포함한다.

## 금지

- 판정과 사용자 승인 전에 raw나 wiki 쓰기
- 승인한 저장 후보가 없는데 INDEX, log, qmd 갱신
- raw 파일 수정·삭제
- 공개 페이지에서 private 링크
- `.gitignore` 수정해 비공개를 공개로 전환
- 출처 없는 주장
- 한 번에 raw 전체 훑기
