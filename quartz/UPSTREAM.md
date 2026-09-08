# Quartz 업스트림 정보

이 저장소는 [jackyzha0/quartz](https://github.com/jackyzha0/quartz) v4 를 복사해 만든 fork 다.

- remote 이름: `quartz-upstream` (`https://github.com/jackyzha0/quartz.git`)
- 복사 시점 커밋: `d25a6eabf96751ffca56f8a8139272def7a65041`
  (`fix(citations): correct URL for CSL locales`, 2026-04-20)

## fork 경계

업스트림에서 복사해 온 파일은 복사 시점 커밋과 내용이 같아야 한다.
이 저장소의 코드는 `quartz/custom/` 에만 둔다.

검사가 보는 범위는 셋이다. 경로는 이 저장소 기준으로 적는다.

| 범위 | 무엇을 본다 |
| --- | --- |
| `quartz/quartz/`, `quartz/docs/`, `quartz/.github/` | 복사 시점 커밋의 파일과 내용이 같은지, 그리고 새 파일이 생겼는지 |
| `quartz/` 루트의 업스트림 파일 | 복사 시점 커밋의 파일과 내용이 같은지 |

`quartz/` 루트에 새로 더한 파일은 검사하지 않는다.
이 저장소의 도구 설정과 문서(`UPSTREAM.md`, `.tool-versions`, `pnpm-lock.yaml` 등)가 같은 자리에 있기 때문이다.
루트에서 보는 업스트림 파일 목록은 `quartz/scripts/verify-upstream-untouched.sh` 의 `ROOT_FILES` 가 소유한다.

예외로 남기는 파일은 여섯이다. 앞 셋은 업스트림이 사용자 편집을 전제하는 설정이고,
뒤 셋은 이 저장소의 도구 설정이다.

- `quartz.config.ts`
- `quartz.layout.ts`
- `quartz/styles/custom.scss`
- `.npmrc`
- `.prettierignore`
- `package.json`

경계는 `quartz/scripts/verify-upstream-untouched.sh` 로 검사한다.

## 업스트림 갱신 절차

1. `git fetch quartz-upstream` 으로 새 커밋을 받는다.
2. 예외 파일 여섯을 제외한 나머지를 새 커밋 상태로 덮어쓴다.
3. 이 문서의 복사 시점 커밋 해시를 갱신한다.
4. `bash scripts/verify-upstream-untouched.sh` 로 경계가 다시 성립하는지 확인한다.
