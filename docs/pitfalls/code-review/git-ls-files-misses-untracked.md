# git ls-files 로 뽑은 검사 대상이 추적하지 않는 파일을 빠뜨린다

## 증상

경계 검사가 "이 디렉터리에 새 파일이 생겼는가" 를 `git ls-files <dir>` 로 본다.
이 명령은 index 에 올라온 파일만 내므로, 아직 `git add` 하지 않은 파일은 목록에 없다.
검사가 잡으려던 것이 "새 파일이 있는가" 인데 실제로 잡는 것은 "추적 중인 새 파일이 있는가" 라,
commit 하지 않은 채로 두면 경계가 무너져도 종료 코드 0 이 난다.

작업 중에 돌리는 검사일수록 이 차이가 드러난다.
새 파일을 만든 직후가 바로 추적하지 않는 상태이기 때문이다.

## 실제 사례

`quartz/scripts/verify-upstream-untouched.sh` 가 업스트림 원본만 담아야 하는
`quartz/quartz/` 아래의 새 파일을 `git ls-files quartz/` 로 찾았다.
그 디렉터리에 파일 하나를 만들고 add 하지 않은 상태에서 돌리면 검사가 통과했다.

## 고치는 방법

`--cached --others --exclude-standard` 를 함께 준다.
`--others` 가 추적하지 않는 파일을, `--exclude-standard` 가 gitignore 대상 제외를 맡는다.
두 목록이 겹칠 수 있으므로 `sort -u` 로 묶는다.

```bash
git ls-files --cached --others --exclude-standard <dir> | sort -u
```

## 검출

```bash
rg -n 'git .*ls-files' --glob '*.sh'
```

걸린 자리마다 그 목록이 "무엇이 있는가" 를 묻는지 "무엇이 추적되는가" 를 묻는지 본다.
앞쪽이면 `--others` 가 필요하다.
