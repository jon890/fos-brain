# Phase 01 죽은 규칙 제거와 검사 대상 자동화

**Execution profile**: standard

---

## 목표

아무 일도 하지 않는 CSS 규칙을 지우고, 손으로 유지하던 형식 검사 대상을 디렉터리 지정으로 바꾼다.

둘 다 PR #22 리뷰가 지적한 것이다. 하나는 살아 있는 계약처럼 보이지만 동작하지 않고, 하나는 파일이 늘 때마다 사람이 목록을 고쳐야 해서 실제로 아홉 개가 빠져 있다.

**범위 외**: 브라우저 회귀 확장과 runtime 자산 경로는 Phase 02가 담당한다.

**근거 문서**: `docs/code-architecture.md` 의 「사람용 렌더링」 절이 사이드바 가시성 소유자를,
「검증 경계」 절이 형식 검사를 디렉터리로 지정하는 이유를 소유한다.

---

## 작업 항목 (3)

### 1. `quartz/quartz/styles/custom.scss` 의 `.sidebar:empty` 규칙 제거

27번째 줄 근처의 아래 규칙을 지운다.

```scss
.sidebar:empty {
  display: none;
}
```

이 규칙은 우선순위가 밀려 적용되지 않는다.
`quartz/quartz/styles/base.scss` 가 `.page > #quartz-body .sidebar` 로 id 를 포함한 선택자를 써서 `display: flex` 를 건다. 그쪽이 1-2-0 이고 이 규칙은 0-2-0 이다.

지금 빈 사이드바가 보이지 않는 이유는 `quartz/custom/components/styles/memoryAtlas.scss` 가 이미 숨기기 때문이다.
홈은 `body:has(.memory-atlas)` 블록의 `.left.sidebar`, `.right.sidebar` 가, 문서 페이지는 `body:has(.memory-atlas-doc-nav)` 블록의 `#quartz-root.page > #quartz-body > .left.sidebar` 가 `display: none !important` 로 덮는다.
`MemoryAtlasDocNav` 는 홈이 아닌 모든 페이지에 렌더되므로 두 블록이 전체를 덮는다.

우선순위를 올려 살리지 않는다. 같은 일을 하는 장치를 둘로 두지 않는다.

`quartz/quartz/styles/custom.scss` 는 업스트림이 사용자 편집을 전제한 예외 파일이라 고쳐도 경계 검사에 걸리지 않는다.

### 2. `quartz/scripts/verify-memory-atlas.sh` 의 형식 검사를 디렉터리 지정으로

`[2/6] Formatting` 단계의 `prettier --check` 인자가 파일 경로 22줄이다.
이 목록을 아래 넷으로 바꾼다.

```bash
# cwd: <worktree>/quartz
pnpm exec prettier --check custom scripts quartz.config.ts quartz.layout.ts
```

이 저장소의 코드는 모두 `quartz/custom/` 아래에 있으므로 디렉터리를 주면 목록을 유지할 필요가 없다.
`scripts` 디렉터리의 `.sh` 파일은 prettier 가 대상 확장자만 고르므로 문제가 되지 않는다.

바꾸기 전에 현재 목록에서 빠진 파일이 있는지 세어 결과에 적는다.

```bash
# cwd: <worktree>/quartz
for f in $(find custom -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.scss' \)); do
  grep -q "$f" scripts/verify-memory-atlas.sh || echo "목록 누락: $f"
done
```

### 3. 두 변경이 실제로 동작하는지 확인하는 테스트

형식 검사가 디렉터리를 실제로 훑는지 확인한다.
`custom/` 아래 파일 하나의 들여쓰기를 임시로 망가뜨리고 `prettier --check` 가 그 파일을 지목하며 실패하는지 본다.
Phase 01 이전 목록에 없던 파일로 고른다. `custom/components/memoryAtlasGraph.ts` 가 그중 하나다.
확인한 뒤 되돌린다.

사이드바 규칙 제거가 화면을 바꾸지 않는 것도 확인한다.
`browser-driver` 로 홈과 문서 페이지를 열어 `.left.sidebar` 와 `.right.sidebar` 의
`getComputedStyle(...).display` 가 `none` 인지 본다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `quartz/quartz/styles/custom.scss` | 수정 |
| `quartz/scripts/verify-memory-atlas.sh` | 수정 |

## 검증

```bash
# cwd: <worktree>/quartz
pnpm install
pnpm exec prettier --check custom scripts quartz.config.ts quartz.layout.ts
```

`All matched files use Prettier code style!` 가 나와야 한다.

```bash
# cwd: <worktree>/quartz
pnpm exec prettier --list-different custom scripts quartz.config.ts quartz.layout.ts | wc -l
```

기대값은 `0` 이다.

```bash
# cwd: <worktree>/quartz
grep -c 'sidebar:empty' quartz/styles/custom.scss
```

기대값은 `0` 이다.

```bash
# cwd: <worktree>/quartz
bash scripts/verify-upstream-untouched.sh
```

종료 코드가 `0` 이어야 한다. `custom.scss` 는 예외 파일이라 고쳐도 걸리지 않는다.

브라우저에서 홈과 문서 페이지에 빈 사이드바가 나타나지 않는 것도 확인한다.
`~/.claude/scripts/browser-driver` 만 사용하고 첫 명령 전에 `browser-driver help` 를 읽는다.

## 의도 메모 (왜)

- 우선순위를 올려 살리지 않는 이유는, 사이드바 가시성을 `memoryAtlas.scss` 가 이미 소유하기 때문이다. 두 파일이 같은 일을 하면 다음 사람이 어느 쪽을 고쳐야 하는지 판단해야 한다.
- 디렉터리 지정으로 바꾸는 이유는 목록이 실제로 표류했기 때문이다. PR #22 가 이 목록을 두 번 고쳐야 했고 그러고도 아홉이 빠졌다.
