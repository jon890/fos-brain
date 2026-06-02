# fos-brain — Claude Code 작업 규칙

이 저장소는 Karpathy 스타일 LLM 지식 기반(brain)이다.
원본(`raw/`)은 사용자가 수집하거나 brain-add 로 가져오고, 위키(`wiki/`)는 Claude Code 가 컴파일·유지한다.

범용 개인 brain 이다 — 기술 연구뿐 아니라 일지·목표·건강·취미 등 개인 지식 전반을 다룬다.

메모는 별도 공간(`~/personal/obsidian`)에서 작성하고, 그중 brain 에 통합할 가치가 있는 것만 brain-add 로 이 저장소에 가져온다.

## 네임스페이스 (공개·비공개 분리)

brain 은 세 네임스페이스로 나뉜다. 각 네임스페이스는 독립된 mini-brain(자체 `raw/` + `wiki/` + INDEX + log)이다.

| 네임스페이스 | 경로 | git | Quartz 공개 | 용도 |
| --- | --- | --- | --- | --- |
| public | 루트(`raw/`, `wiki/`) | commit | 게시 | 공개 가능한 개인 자료 |
| private | `private/` | **gitignore** | 제외 | 개인 비공개 자료 |
| work | `work/<회사>/` | **gitignore** | 제외 | 회사 자료 (회사별 분리) |

`work` 는 **회사별 서브레벨**을 둔다 — 각 회사는 `work/<회사>/{raw,wiki}` 자체 mini-brain.
현재: `work/nhn/`. 이직·복수 소속 시 `work/<회사>/` 를 추가한다.

규칙:

1. **라우팅**: brain-add 는 호출 시 네임스페이스를 선택받아 해당 트리에만 저장·컴파일한다. work 선택 시 회사(`<회사>`)도 함께 받는다.
2. **링크 방향**: 공개 페이지는 비공개(private·work)를 링크하지 않는다(공개 빌드 깨짐·유출 방지). 비공개 → 공개 링크는 허용.
3. **검색**: brain-search 는 로컬에서 세 네임스페이스를 모두 검색하되, 인용 시 출처에 네임스페이스를 표기한다.
4. **gitignore 불변**: `private/`, `work/` 를 commit 대상에 올리지 않는다. `.gitignore` 를 수정해 비공개를 공개로 바꾸지 않는다.
5. **네임스페이스 간 매핑**(비공개 작업 ↔ 공개 지식 연결): 비공개 → 공개 방향만 건다.
   - 비공개 페이지에서 **bare-slug** `[[개념명]]` 으로 공개 개념을 가리킨다(경로 없이). 병합 빌드에서 slug 로 해석된다.
   - 이 cross-link 는 **로컬 전체 그래프(`quartz-local`)에서만** 렌더된다. 공개 빌드(`quartz`)엔 비공개 노드가 없어 보이지 않는다(회사·개인 쪽 비공개 유지).
   - 예: `work/nhn` 의 OCR 배포 incident 페이지 → 공개 `[[k8s-run-tmpfs-containerd]]` 개념.
   - 반대(공개 → 비공개)는 금지(규칙 2).

### 형상관리 (네임스페이스별 독립 VC)

각 네임스페이스는 **독립된 git repo** 로 버전관리한다. 공개 repo 가 `private/`·`work/` 를 gitignore 하므로 중첩 독립 repo 라도 서로 섞이지 않는다(submodule 포인터·URL 노출 없음).

| 네임스페이스 | git repo | 비고 |
| --- | --- | --- |
| public | `github.com/jon890/fos-brain` (PUBLIC) | 루트 repo |
| private | `github.com/jon890/fos-brain-private` (PRIVATE) | `private/` 안 중첩 `.git`, SSH |
| work | **로컬 전용** git (원격 없음) | `work/` 안 중첩 `.git`. **외부 push 절대 금지** |

불변 규칙:

- **work 에 remote 를 추가하지 않는다.** 회사 자료는 이 컴퓨터 로컬에만 둔다.
- private repo 는 **PRIVATE visibility** 유지(개인 커리어·건강·투자 포함).
- 개인·회사 repo 생성은 반드시 `github.com`(개인 계정) 또는 로컬에. 회사 GitHub Enterprise 에 개인 brain 을 올리지 않는다.

아래 디렉터리·스키마 설명은 한 네임스페이스 내부 구조를 가리킨다(public 기준이며 private·work 도 동일).

## 디렉터리 역할

- `raw/` — **원본**. LLM 은 읽기 전용으로 취급한다. 수정·삭제 금지(사용자 명시 지시 예외).
  - 하위 카테고리는 자유롭게 추가 가능: `web/`, `papers/`, `repos/`, `notes/`, 그리고 개인 brain 용 `journal/`, `health/`, `articles/`, `videos/` 등.
- `wiki/INDEX.md` — 전체 목차 + 한 줄 요약. 모든 brain-add / brain-lint 후 최신 상태로 유지.
- `wiki/concepts/` — 개념 단위 페이지. 백링크 의무.
- `wiki/topics/` — 여러 개념을 묶는 상위 narrative 페이지.
- `wiki/entities/` — 사람·프로젝트·목표 같은 개체 페이지(개인 brain 용).
- `wiki/log.md` — append-only 활동 연대기.

## 작업 원칙

1. **사용자 편집 최소화**: wiki 의 모든 변경은 LLM 책임. 사용자가 wiki 를 직접 고친 흔적이 보이면 덮어쓰기 전에 확인.
2. **백링크 의무**: 새 페이지를 만들면 다음을 모두 한다.
   - `INDEX.md` 에 등록
   - 관련 다른 페이지에 양방향 링크 추가
   - 어떤 `raw/` 출처에서 왔는지 페이지 하단 "Sources" 섹션에 기록
3. **wikilink 는 bare-slug 로 작성 (필수)**: 다른 wiki 페이지를 가리킬 땐 경로 없이 파일명만 쓴다.
   - O: `[[work-style]]` · `[[ai-harness-pattern]]`
   - X: `[[topics/work-style]]` · `[[../concepts/ai-harness-pattern]]` (경로형 금지)
   - 이유: 로컬 전체 빌드(`quartz-local`)는 네임스페이스를 하위 폴더(`public/`·`_work_nhn/`·`_private/`)로 병합한다. 경로형 링크는 이 prefix 를 모른 채 루트 기준으로 풀려 404 가 된다. bare-slug 는 quartz 가 파일명으로 전역 매칭해 공개 빌드·로컬 빌드 양쪽 모두 정확한 경로를 만든다.
   - 파일명이 전역 고유하므로 bare-slug 로 충분하다. alias·heading 은 붙여도 된다: `[[work-style|개발 스타일]]`.
   - **예외 — `raw/` Sources 링크는 경로형 유지**: `[[../../raw/notes/원본.md]]` 처럼 raw 를 가리키는 출처 링크는 빌드 대상이 아니므로 경로형 그대로 둔다.
4. **raw 는 출처**: wiki 의 주장은 raw 로 추적 가능해야 한다. 출처 없는 주장 금지.
5. **점진적 컴파일**: 한 번에 raw 전체를 처리하지 않는다. 새 raw 파일 또는 사용자가 지정한 범위만 처리.
6. **lint 는 별도 호출**: 무결성 점검은 사용자가 brain-lint 를 명시 요청할 때만 실행.

## 무엇을 brain 에 넣는가 (durable vs 일회성)

brain 은 compounding 자산이다. 6개월 뒤에도 검색해서 유용할 **durable 지식만** 남긴다.

넣는다 (durable):

- 개념·정의, 도메인 지식, 결정과 근거, 재사용 패턴, 일반화 교훈, 인물·개체.

넣지 않는다 (일회성·자명):

- **코드·git 으로 자명한 것** — 특정 파일 구조, 함수 위치, 변경 이력.
- **일회성 업무 기록** — 특정 plan·PR 로 끝난 작업, 특정 시점의 버그·drift 실측 사례.
- **이미 널리 알려진 원칙의 단순 사례** — 그 자체로 새 인사이트가 아니면 durable 가치가 낮다.
- 실행 절차(→skill), 행동 규칙(→CLAUDE.md), 일시적·세션 한정 상태.

판단 기준: **"6개월 뒤 이 페이지를 검색해서 유용할까, 아니면 그때 코드·git 을 보면 되나?"** 후자면 넣지 않는다.

이미 들어온 페이지도 주기적으로 이 기준으로 재평가해 솎아낸다(brain-delete 또는 brain-lint). 특히 함정·일회성 업무로 쏠린 항목을 점검한다. 한 페이지에 durable 교훈과 일회성 세부가 섞여 있으면, 교훈만 일반 concept 으로 추리고 업무 세부는 버린다.

## 페이지 스키마

### `wiki/concepts/<개념명>.md`

```markdown
---
type: concept
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# <개념명>

한 줄 정의.

## 핵심 포인트

- ...

## 관련 개념

- [[다른-개념]] — 관계 설명

## Sources

- [[../../raw/papers/원본파일.md]]
- [[../../raw/web/기사.md]]
```

### `wiki/topics/<주제명>.md`

여러 concept 을 묶는 narrative. 같은 frontmatter + "Concepts" 섹션에 `[[concept]]` 나열.

### `wiki/entities/<개체명>.md`

사람·프로젝트·목표 등. `type: entity` frontmatter. 관련 concept·topic 과 양방향 링크.

## 가독성 표준 (필수)

brain 은 LLM 이 쓰고 사람이 같이 읽으며 고치는 문서다. 모든 페이지는 다음을 지킨다.

- **인라인 연결 금지** — `A + B`, `A · B`, `A & B` 로 항목을 묶지 않는다. 두 개 이상이면 bullet list.
- **콤마 3+ 나열 금지** — 한 bullet 에 항목이 3개 이상이면 sub-bullet 으로 분리.
- **한 bullet = 한 정보** — 서로 다른 사실 3개를 한 bullet 에 압축하지 않는다.
- **목록은 그룹 라벨 + sub-bullet** — 스택·구성요소처럼 항목이 많으면 범주별로 묶는다.
  - 예: `스택` 아래 `프레임워크 / UI / 인증 / 테스트` sub-bullet.
- **표 셀 4+ 정보** → `<br>` 로 분리.
- **종결** — bullet·표·헤더 항목은 명사구 OK. paragraph 평문 문장은 동사로 끝맺는다.
- **헤더 + 1줄 요약 + 본문** 순서. 헤더 바로 뒤 긴 줄글 금지.

자가 점검(쓰기 직후): `+`·`·`·`&` 인라인 연결이 있나? 콤마 3+ 나열이 있나? 한 bullet 에 정보가 3개 이상인가? 있으면 분리한다.

## 워크플로우 진입점 (Skill)

brain 스킬의 **실제 파일은 이 저장소 `skills/` 에** 있다(관심사를 brain repo 에 모음 + 버전관리). 각 머신의 전역 `~/.claude/skills/` 는 이 repo 를 가리키는 **symlink** 다.

- `brain-add` — 소스를 가져와 `raw/` 로 저장한 뒤 `wiki/` 로 컴파일
- `brain-search` — INDEX → wiki → raw 순으로 답변, 결과는 wiki 로 환원
- `brain-lint` — 무결성 점검(백링크·고아·중복·Sources·frontmatter·INDEX 동기화·모순·교차 참조·공개/비공개 누출)
- `brain-delete` — wiki 페이지를 안전하게 제거(백링크·INDEX·log 정리 동반, 완전 삭제/archive 선택). raw 원본은 기본 보존

모든 skill 은 `wiki/log.md` 에 append-only 로 활동 기록을 남긴다. 모든 skill 의 대상 디렉터리는 이 저장소(`~/personal/fos-brain`)다.

### 새 머신 설정

repo 를 clone 한 뒤 전역 skills 에 symlink 를 건다:

```bash
for s in brain-add brain-search brain-lint brain-delete; do
  ln -s "$HOME/personal/fos-brain/skills/$s" "$HOME/.claude/skills/$s"
done
```

## brain-add 가 처리하는 소스

brain-add 는 다양한 소스를 `raw/` 로 가져와 파싱한다.

| 소스 | 처리 방식 |
| --- | --- |
| 웹 기사·페이지 | WebFetch → markdown 본문 |
| 유튜브 링크 | `yt-dlp` 로 자막(자동·수동) + 메타 추출 → 텍스트 |
| PDF 논문 | Read 로 직접 파싱 |
| GitHub repo | clone / `gh` 로 README·코드 |
| 이미지 | Read 로 시각 분석 |
| 붙여넣은 텍스트·로컬 파일 | 그대로 |

유튜브는 영상·음성을 직접 듣지 못하므로 자막을 경유한다.
현재는 **자막 있는 영상만 우선 지원**한다.
자막 없는 영상의 로컬 STT(`whisper`)는 미설치 상태이며 나중에 추가한다.

## 검색 도구: qmd

규모가 커지면 `grep` 으로는 한계가 있다.
Karpathy 가 권장한 qmd(BM25 + 벡터 + LLM rerank)를 사용한다.

- 등록 컬렉션: `brain-wiki`(fos-brain/wiki), `brain-raw`(fos-brain/raw)
- 1차 검색(BM25): `qmd search "<keyword>" -c brain-wiki`
- 의미 검색(벡터): `qmd vsearch "<text>" -c brain-wiki`
- 하이브리드 + rerank(권장): `qmd query "<question>"`
- 인덱스 갱신: `qmd update`(파일 변경 후), `qmd embed`(임베딩 재생성)
- 상태 점검: `qmd status`

`brain-search` skill 은 wiki 가 일정 규모 이상이면 grep 대신 `qmd query` 를 1차 검색으로 사용한다.

### 런타임 함정 — bun 으로 고정 (node ABI 불일치 방지)

qmd 는 `better-sqlite3` 네이티브 모듈을 쓰고, 이 모듈의 ABI 는 **실행 런타임에 종속**된다.

- qmd 의 `bin/qmd` 는 패키지 디렉터리의 lockfile 로 런타임을 고른다: `bun.lock` 이면 bun, `package-lock.json` 이면 node, 둘 다 없으면 node.
- mise 가 세션·디렉터리마다 node 버전(22/24 등)을 바꾸므로, **node 로 실행하면** better-sqlite3 ABI(예: node24=137 vs node22=127)가 어긋나 `"better-sqlite3 재컴파일 필요"` 로 깨진다.
- **회피 — bun 고정**: qmd 패키지(`~/.bun/install/global/node_modules/@tobilu/qmd/`)에 `bun.lock` 을 두면 항상 bun 으로 실행된다. bun 은 단일 런타임이라 mise node 버전과 무관하게 안정적이다.
- 깨졌을 때 복구: `touch ~/.bun/install/global/node_modules/@tobilu/qmd/bun.lock`. (qmd 재설치·업데이트 시 lockfile 이 사라지면 재발하므로 다시 touch.)
- qmd 가 끝내 안 되면 `brain-search` 는 grep 으로 폴백한다(품질은 떨어지지만 동작).

## 웹 UI: Quartz

연결된 지식을 그래프로 보는 웹 UI 는 Quartz v4 정적 사이트로 구축한다(`quartz/`).
공개 빌드와 로컬 전체 빌드 두 가지를 운영한다.

### 툴체인 전제

- node 24.15.0 핀(`quartz/.tool-versions` = mise, `quartz/.npmrc` 의 `use-node-version` = pnpm). quartz engines 는 `node >=22`. node 25 에선 tsx 가 `.scss` ESM 로딩에 실패하므로 24 를 쓴다(25 회피). 핀 파일은 루트가 아니라 `quartz/` 에 있다.
- pnpm(`packageManager` 필드). `quartz/.npmrc` 에 `node-linker=hoisted`(Quartz 가 phantom 의존성을 직접 import).
- fos-brain 은 **독립 git repo** 여야 한다. 홈(`/Users/nhn`)이 `*` 화이트리스트 .gitignore 라, fos-brain 에 자체 `.git` 이 없으면 Quartz 의 `isGitIgnored` 가 모든 content 를 걸러내 입력 0 이 된다.

### 공개 빌드 (`quartz/`)

- content: `quartz/content` → 루트 `wiki/` 심볼릭 링크(public 만). private·work 는 config `ignorePatterns` 로 제외.
- 기능: 그래프 뷰 + 전문 검색 + 백링크 패널
- 서빙: `cd quartz && pnpm quartz build --serve` (기본 포트 8080)
- 외부 게시(GitHub Pages 등)는 별도 요청 시에만. raw RAG 분석 등 공개 적정성 확인 후.

### 로컬 전체 빌드 (`quartz-local/`)

- content: public + private + work 전체 그래프. 비공개 폴더는 `_private`/`_work` 로 병합(공개 config 의 ignore 회피).
- 병합 content 는 repo 밖 temp 에 생성(repo 안이면 `.gitignore` 때문에 입력이 걸러짐).
- **gitignore 대상**(`quartz-local/content`, `quartz-local/public`) — 절대 게시하지 않는다.
- 서빙: `./quartz-local/serve.sh` (포트 8081)

## Obsidian 호환

이 저장소는 순수 markdown + `[[wikilink]]` 라 Obsidian vault 로도 열 수 있다.
하지만 주 뷰어는 Quartz 웹 UI 다.
메모 작성은 별도 vault(`~/personal/obsidian`)에서 한다.

## 금지 사항

- `raw/` 파일 자동 수정·삭제
- wiki 페이지 일괄 재작성(사용자 요청 시 외)
- 출처 없는 주장 작성
- 한 번의 brain-add 에서 raw 전체를 훑기
