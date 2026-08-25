---
name: brain-lint
description: 개인 지식 기반(brain, ~/personal/fos-brain) 의 무결성 점검 — 깨진 백링크, 고아 노트, 중복 개념, 누락 Sources, frontmatter, INDEX 동기화, 모순, 누락 교차 참조, 공개/비공개 링크 누출. 공개·개인비공개 네임스페이스별로 점검. "brain lint", "brain 점검", "brain 정리해줘", "wiki lint", "위키 점검", "vault 무결성", "고아 노트", "백링크 점검" 같은 요청 시 사용.
---

# brain-lint

Karpathy 워크플로우의 lint 단계. brain 품질을 점진적으로 끌어올린다.
사용자가 명시적으로 요청할 때만 실행하며 brain-add 후 자동으로 돌리지 않는다.

## 대상 디렉터리

`~/personal/fos-brain`에서 개인 네임스페이스인 public과 private를 각각 점검한다.
사용자가 범위를 지정하면 해당 네임스페이스만.

품질 점검을 수행하기 전에 [`../../references/knowledge-admission-policy.md`](../../references/knowledge-admission-policy.md)를 읽는다.

## 검사 항목

1. **깨진 백링크 / 경로형 wikilink** — `<ns>/wiki/**/*.md` 의 `[[...]]` 무결성.
   - (a) 링크가 실제 페이지를 가리키는지.
   - (b) **경로형 금지** — `[[topics/X]]`·`[[../concepts/Y]]` 처럼 경로가 붙은 링크는 bare-slug(`[[X]]`)로 고친다. 경로형은 로컬 전체 빌드에서 prefix 누락으로 404 가 된다(CLAUDE.md 작업 원칙 3). 단 `raw/` Sources 링크(`[[../../raw/...]]`)는 예외로 유지.
   - 일괄 점검: `grep -rnE '\[\[(\.\./)*(topics|concepts|entities)/' <ns>/wiki/`
2. **고아 노트** — INDEX 와 다른 어느 곳에서도 참조되지 않는 페이지
3. **중복 개념** — 제목·정의가 거의 같은 두 페이지(병합 후보)
4. **Sources 누락** — 본문 주장이 있는데 Sources 가 비거나 없는 페이지
5. **frontmatter 위반** — 필수 필드인 type / created / updated 누락. 권장 메타데이터 누락은 이 구조 검사를 실패시키지 않고 11번 품질 축에서만 보고한다.
6. **INDEX 동기화 깨짐** — 파일은 있는데 INDEX 에 없거나 그 반대
7. **stale 마커 탐지** — 페이지 본문에서 미완료를 뜻하는 표현을 grep 으로 찾는다.
   - 찾는 표현: `남은 작업`, `TODO`, `예정`, `미완`, `추후`.
   - 명령: `grep -rlnE '(남은 작업|TODO|예정|미완|추후)' <ns>/wiki/`
   - frontmatter `updated` 가 오래된(예: 3개월+) 페이지에서 발견되면 우선순위를 높인다 — 방치된 미완료 마커일 확률이 높다.
   - 이건 발견만 한다(구조 검사). "지금 실제로 완료됐는가"는 사람 판단이 필요해 11번 품질 축에서 다룬다.
8. **페이지 간 모순(의미 검사)** — 같은 사실·수치에 두 페이지가 다른 주장. 출처(raw)가 다르면 모순이 아닐 수 있음.
9. **누락된 교차 참조 제안(의미 검사)** — 본문에서 다른 개념을 언급하는데 `[[...]]` 가 없는 경우 후보 제안. 자동 추가 금지.
10. **공개/비공개 링크 누출(보안)** — 공개(public) 페이지가 `private/`를 링크하는지 확인한다. 발견 시 즉시 보고한다. 비공개 → 공개는 정상이다.
11. **품질 축 (Quality Loop, 명시 요청 시)** — 기존 페이지의 *내용 품질*을 재판단한다. 구조 검사(1~10)와 별개.
    - **정확성 재검토** — 출처(raw)와 대조해 주장이 여전히 맞는지. 사용자 정정 여지 큰 주관 판단 플래그.
    - **미검증·신뢰도** — 2차 출처(자동자막·에이전트 생성물)나 근거 없는 단정 표시.
    - **stale** — 7번이 찾은 미완료 마커 페이지를 실제로 검토한다. 최신 사실과 대조해 이미 완료됐으면 "완료 처리" 로, 여전히 유효하면 "유지" 로 분류한다. `brain-curate` 의 dedup 단계가 어떤 후보를 "reinforce" 로 판정했는지도 참고한다. 그 판정 자체가 종종 "기존 페이지가 최신 상태를 못 따라갔다"는 신호다. 실제로 `ocr-requestid-trace.md` 의 "모델 서버 측 (남은 작업)" 은 2026-07-01 brain-curate 에서 완료 사실이 확인돼 갱신됐다.
    - **중복·병합 후보** — 다른 페이지와 상당 부분 겹침.
    - **공용 정책 적합성** — 기존 페이지를 공용 정책의 전체 판정 기록으로 다시 판정한다. 의미 적합성을 점수로 자동 결정하지 않는다.
    - **미사용** — `scripts/brain-usage.py` 의 genuine 기준 미사용 페이지(데이터 충분할 때만 archive 후보로).
    - **카테고리 비대(topic 분리 후보)** — INDEX 한 카테고리에 concept 이 대략 7개를 넘거나 성격이 섞이면(예: 학습 개념, 실전 장애), `topics/` 로 묶을 후보로 제안. 자동 분리 금지 — 주제 경계·이름은 사용자 확인. (brain-add 9단계와 동일 기준)
    - **권장 메타데이터** — 새 문서나 실질 보강 문서에서 `title`, `description`, `tags`, `status`, `stale_after`, `sources`, `generated`, `verified` 누락을 품질 개선 후보로 보고한다. 기존 문서를 누락만으로 구조 실패 처리하거나 일괄 수정하지 않는다.
    - **날짜·상태 유효성** — `created`, `updated`, `stale_after`는 `YYYY-MM-DD` 형식인지, `generated.at`과 단일 객체 또는 배열인 `verified`의 `at`은 유효한 날짜 또는 날짜·시간인지 확인한다. `status`가 있으면 `draft`, `stable`, `deprecated` 중 하나인지 확인한다. 잘못된 값은 품질 발견 사항으로 보고하고 자동 추정해 고치지 않는다.
    - 분류: `keep`(유지), `refresh-needed`(갱신), `merge`(병합), `archive`(보관), `delete-candidate`(삭제 후보) 5단계.
    - 품질 축은 **기본 실행 아님** — 사용자가 "품질 점검", "quality loop" 등 명시 호출 시에만.

## 절차

0. **qmd 인덱스 점검** — `qmd status` 로 동기화 확인. public 파일이 어긋나면 `qmd update && qmd embed` 먼저.
1. **검사만 먼저(read-only)** — 네임스페이스별로 위 10개 구조 항목을 훑어 발견 사항을 표로 보고.
2. **수정 승인** — 항목별 `AskUserQuestion` 으로 자동 수정 여부 확인.
   - 깨진 백링크: 오타면 수정, 페이지 없음이면 후보 제안 후 결정
   - 고아 노트: 삭제 / 링크 추가 / 그대로 중 선택
   - 중복 개념: 병합 / 분리 유지
   - 공개/비공개 누출: 링크 제거 또는 비공개로 페이지 이동 중 선택
   - 나머지는 자동 수정 OK
3. **수정 적용** — 승인된 항목만 편집.
4. **INDEX 메타 갱신** — "마지막 brain-lint" 에 오늘 날짜.
5. **log append (필수)** — `<ns>/wiki/log.md` **파일 맨 끝**에 추가한다 (시간순 오름차순 — 맨 위나 중간에 끼워 넣지 않는다):
   ```
   ## [YYYY-MM-DD] lint | <한 줄 요약>
   - 검사: 10개 항목 / 발견: N건 / 수정: M건
   - 주요 발견·수정: <메모>
   ```

## 점수 점검 (reward)

docs-audit 의 docs_score 와 같은 SkillOpt 검증 점검 패턴.
11개 항목 중 *객관 채점 가능한* 구조 항목만 점수로 환산해 수정 전후를 비교한다.
중복·stale마커·모순·교차참조·품질축(3·7·8·9·11)은 주관 판단이거나 발견 전용이라 점수에서 제외한다.

### 측정 도구

`scripts/brain_score.py`는 위반을 가중 감점으로 합산한다. 위반 0이면 score 0(만점)이다.

| 채점 축 | 가중 | 근거 |
|---|---|---|
| visibility_leak | 10 | public이 private slug를 링크함 (유출, 보안 최고) |
| broken_backlink | 5 | `[[slug]]` 가 어느 페이지도 안 가리킴 |
| path_wikilink | 4 | `[[topics/X]]` 경로형 — 로컬 빌드 404 |
| missing_sources | 3 | concepts 페이지에 `## Sources` 없음/빔 (entities·topics 면제) |
| frontmatter | 3 | type/created/updated 누락 |
| index_desync | 2 | 페이지가 자기 ns INDEX 에 없음 |
| orphan_note | 2 | 어디서도 참조 안 됨 |

### 사용

```bash
python3 scripts/brain_score.py          # 측정 + 직전 대비 delta
python3 scripts/brain_score.py --save   # 게이트 통과 시 history 기록
python3 scripts/brain_score.py --json    # 기계 판독용
```

### 점검 흐름

1. lint 착수 전 측정해 기준값을 본다.
2. 항목별로 수정한다 (누출 → 백링크 → frontmatter → Sources 순).
3. 다시 측정해 점수가 기준값보다 올랐는지 확인한다.
4. 올랐으면 `--save` 로 기록한다.

### reward 정확성 주의

점수 함수가 틀리면 잘못된 방향으로 고치게 된다 (docs-audit 의 교훈).

- `visibility_leak` 는 보안 위반이니 즉시 사용자에게 보고한다. 자동 수정 금지.
- `missing_sources` 는 concepts 만 대상. entities(자기 프로젝트)·topics(narrative)는 면제.
- ADR 류 concept 은 자기 결정 기록이라 Sources 가 없을 수 있다 — 잔존 건은 spot-check 후 면제 판단.

## 외부 자원

- 누락 Sources 보강 시 WebSearch 사용 가능 — 사용자 승인 후.
- raw 파일은 절대 수정·삭제하지 않는다.

## 금지

- 사용자 승인 없이 페이지 삭제·병합
- 백링크 자동 "추측" 추가(오탐 위험)
- lint 결과를 wiki 페이지로 만들기(보고는 채팅으로만)
- 비공개 내용을 공개 페이지로 옮기며 누출
