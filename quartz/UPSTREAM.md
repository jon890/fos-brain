# Quartz 업스트림 정보

이 저장소는 [jackyzha0/quartz](https://github.com/jackyzha0/quartz) v4 를 복사해 만든 fork 다.

- remote 이름: `quartz-upstream` (`https://github.com/jackyzha0/quartz.git`)
- 복사 시점 커밋: `d25a6eabf96751ffca56f8a8139272def7a65041`
  (`fix(citations): correct URL for CSL locales`, 2026-04-20)

## fork 경계

`quartz/quartz/` 와 `quartz/` 루트의 업스트림 파일은 복사 시점 커밋과 내용이 같아야 한다.
이 저장소의 코드는 `quartz/custom/` 에만 둔다.

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
