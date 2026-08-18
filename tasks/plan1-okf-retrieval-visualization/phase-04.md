# Phase 04 — 대표 문서 적용과 통합 검증

**Execution profile**: standard

---

## 목표

대표 public 문서에 새 메타데이터를 적용하고 검색, 교환, 렌더링 계약을 함께 검증한다.

**범위 외**: 기존 wiki 문서의 일괄 메타데이터 migration은 후속 작업으로 남긴다.

---

## 작업 항목 (4)

### 1. 대표 문서 메타데이터 보강

`wiki/concepts/build-with-teams-rules.md`와 `wiki/topics/rag-system-architecture-strategies.md`에 title, description, tags, status, stale_after, sources를 추가한다.
본문의 H1, bare-slug 링크, Sources 섹션은 유지한다.
OpenClaw wiki 제거와 독립적으로 검색 회귀를 측정하도록 `.agents/plugin/fos-brain/tests/fixtures/retrieval-public.json`의 OpenClaw 질문을 `tech-stack-preferences` 대표 질문으로 교체한다.

### 2. 문서 계약 최종 대조

`docs/prd.md`, `docs/flow.md`, `docs/code-architecture.md`, `docs/data-schema.md`, `docs/adr/001-okf-compatibility-boundary.md`를 실제 구현과 대조한다.
구현과 다른 문장만 수정하고 중복 설명을 늘리지 않는다.
OKF 공식 명세와 저장소의 `quartz/docs/`를 우선 근거로 대조한다.
특히 source id의 선택성, verified 단일 mapping, stale 기준일, 예약 index와 log 계약을 명시한다.

### 3. 통합 검증 실행

skill 검사, Node 단위 검사, 검색 벤치마크, Quartz 검사와 공개 빌드를 실행한다.
OKF 내보내기는 임시 디렉터리에 실행하고 public wiki와 raw만 포함하는지 확인한다.
루트 `index.md`는 `okf_version`만 가지며, `wiki/index.md`와 `wiki/log.md`에는 일반 지식 문서 메타데이터가 주입되지 않아야 한다.
concept, topic, entity 문서에는 필요한 메타데이터 보완과 링크 변환이 적용되어야 한다.
실제 내보내기를 막는 `wiki/concepts/pitfalls-file-per-pattern.md`의 placeholder `[[slug]]`는 의미 링크가 아닌 리터럴 예시로 고친다.
내보내기는 inline code와 fenced code 안의 wikilink 예시를 변환하지 않으며, 일반 본문의 wikilink와 unresolved 오류 계약은 유지한다.

### 4. task 완료 상태 기록

검증이 성공하면 `tasks/plan1-okf-retrieval-visualization/index.json`의 `status`를 `completed`, `current_phases`를 `4`로 바꾼다.
검증이 실패하면 완료 상태를 기록하지 않는다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `wiki/concepts/build-with-teams-rules.md` | 수정 |
| `wiki/topics/rag-system-architecture-strategies.md` | 수정 |
| `wiki/concepts/pitfalls-file-per-pattern.md` | placeholder 링크 수정 |
| `.agents/plugin/fos-brain/tests/fixtures/retrieval-public.json` | 대표 질문 교체 |
| `.agents/plugin/fos-brain/scripts/okf-export.cjs` | Markdown 코드 구간 보존과 OKF 예약 문서 처리 수정 |
| `.agents/plugin/fos-brain/tests/okf-export.test.cjs` | 코드 구간과 OKF 예약 문서 회귀 검사 추가 |
| `quartz/.prettierignore` | 기존 lockfile 형식 불일치를 통합 형식 검사에서 제외 |
| `docs/` 관리 문서 | 구현 불일치가 있을 때만 수정 |
| `docs/retrospectives/0002-preexisting-lockfile-format.md` | 통합 검사 대응과 실행 계약 위반 기록 |
| `tasks/plan1-okf-retrieval-visualization/index.json` | 완료 상태 수정 |

## 검증

```bash
# cwd: <worktree>/
for skill in brain-add brain-search brain-lint; do python3 /Users/nhn/.codex/skills/.system/skill-creator/scripts/quick_validate.py ".agents/plugin/fos-brain/skills/$skill"; done
node --test .agents/plugin/fos-brain/tests/okf-export.test.cjs
node .agents/plugin/fos-brain/scripts/retrieval-benchmark.cjs .agents/plugin/fos-brain/tests/fixtures/retrieval-public.json
for file in docs/prd.md docs/flow.md docs/code-architecture.md docs/data-schema.md docs/adr/001-okf-compatibility-boundary.md; do ~/.claude/scripts/korean-style-check.sh "$file"; python3 ~/.claude/scripts/check-readability.py "$file"; done
```

```bash
# cwd: <worktree>/quartz
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm quartz build
```

명령이 성공하고 task 상태가 구현 결과와 일치해야 한다.

## 의도 메모 (왜)

- 검색용 주제 하나와 실행 규칙 개념 하나로 새 표시와 색인을 실제 콘텐츠에서 검증한다.
- 점진 적용 원칙을 지켜 의미 없는 대량 frontmatter 생성을 피한다.
