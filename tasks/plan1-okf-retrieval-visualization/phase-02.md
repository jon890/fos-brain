# Phase 02 — 에이전트 검색과 벤치마크

**Execution profile**: standard

---

## 목표

에이전트가 네임스페이스를 섞지 않고 wiki 지식과 관계를 먼저 탐색하며, 대표 질문으로 검색 품질을 반복 측정하게 한다.

**범위 외**: Quartz 렌더링과 OKF 링크 변환은 다른 phase가 담당한다.

---

## 작업 항목 (4)

### 1. brain-search 검색 순서 수정

`.agents/plugin/fos-brain/skills/brain-search/SKILL.md`에서 public과 private를 독립 검색한다.
각 네임스페이스는 wiki 후보를 먼저 읽고 관련 wikilink를 한 단계 따라간 뒤, 근거가 부족할 때만 같은 네임스페이스 raw를 검색한다.
회사 지식은 work 디렉터리를 검색하지 않고 nbrain으로 라우팅한다.

### 2. qmd 실행 경로와 설정 점검 수정

`.agents/plugin/fos-brain/scripts/setup-check.cjs`가 `/Users/nhn/.local/bin-pinned/qmd`를 우선 사용하고 일반 `qmd`로 축소 동작하게 한다.
`bun.lock`을 만들던 동작을 제거하고 컬렉션 명령도 선택한 실행 파일로 통일한다.

### 3. 검색 벤치마크 구현

`.agents/plugin/fos-brain/scripts/retrieval-benchmark.cjs`가 JSON fixture를 읽어 collection별 `qmd query`를 실행한다.
출력의 qmd URI에서 slug 순위를 구하고 질문별 성공 여부와 전체 성공률을 JSON으로 출력한다.
qmd 실패, 해석 불가 출력, 통과선 미달은 0이 아닌 종료 코드로 보고한다.
측정 대상은 사용자의 qmd에 이미 등록된 `brain-wiki` 컬렉션이며 worktree 변경분의 색인 효과는 재지 않는다.
스크립트는 임시 collection을 만들거나 전역 qmd 설정을 수정하지 않는다.

### 4. 공개 대표 질문 fixture 추가

`.agents/plugin/fos-brain/tests/fixtures/retrieval-public.json`에 서로 다른 주제의 실제 질문을 기록한다.
기대 slug는 상위 3개 안에 들어와야 하며 기본 통과선은 0.8이다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `.agents/plugin/fos-brain/skills/brain-search/SKILL.md` | 수정 |
| `.agents/plugin/fos-brain/scripts/setup-check.cjs` | 수정 |
| `.agents/plugin/fos-brain/scripts/retrieval-benchmark.cjs` | 신규 |
| `.agents/plugin/fos-brain/tests/fixtures/retrieval-public.json` | 신규 |

## 검증

```bash
# cwd: <worktree>/
node --check .agents/plugin/fos-brain/scripts/setup-check.cjs
node --check .agents/plugin/fos-brain/scripts/retrieval-benchmark.cjs
node .agents/plugin/fos-brain/scripts/retrieval-benchmark.cjs .agents/plugin/fos-brain/tests/fixtures/retrieval-public.json
python3 /Users/nhn/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/plugin/fos-brain/skills/brain-search
```

벤치마크 JSON의 `pass_rate`가 0.8 이상이어야 한다.

## 의도 메모 (왜)

- 한 번의 통합 검색보다 네임스페이스별 검색이 출처 표시와 private 경계를 보존한다.
- benchmark fixture는 검색 품질을 감상이 아니라 반복 가능한 회귀로 바꾼다.
