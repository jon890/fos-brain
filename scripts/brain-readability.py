#!/usr/bin/env python3
"""brain-readability — brain 문서의 가독성 규칙 위반 후보를 점검.

전역 CLAUDE.md 가독성 규칙 중 기계 점검 가능한 항목을 스캔한다.
brain-add 가 새 페이지를 쓴 직후 호출해 작성 즉시 검증한다.

사용:
  python3 scripts/brain-readability.py                 # brain 전체
  python3 scripts/brain-readability.py wiki/concepts/foo.md ...   # 특정 파일
  python3 scripts/brain-readability.py work/nhn/wiki   # 특정 디렉터리

점검 항목:
  - 인라인 연결: ` + ` / ` · ` / ` & ` 로 구분 항목 묶기 (제목·코드·표 제외)
  - 콤마 5+ 나열: 한 bullet 에 콤마 항목 5개 이상
  - `~` 취소선 함정: 한 줄에 백틱 밖 `~` 짝수개
  - `§` 기호 사용
종결(명사형) 검사는 의미 판단이 필요해 사람이 본다.
"""
import sys, os, re, glob

BRAIN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INLINE = re.compile(r" [+·&] ")

def strip_code(s):
    return re.sub(r"`[^`]*`", "", s)

def targets(args):
    if not args:
        dirs = [f"{BRAIN}/wiki"] + glob.glob(f"{BRAIN}/work/*/wiki") + [f"{BRAIN}/private/wiki"]
        for d in dirs:
            yield from glob.glob(f"{d}/**/*.md", recursive=True)
        return
    for a in args:
        p = a if os.path.isabs(a) else os.path.join(BRAIN, a)
        if os.path.isdir(p):
            yield from glob.glob(f"{p}/**/*.md", recursive=True)
        elif os.path.isfile(p):
            yield p

def check(path):
    flags = []
    for i, raw in enumerate(open(path, encoding="utf-8"), 1):
        line = raw.rstrip("\n"); nc = strip_code(line); s = line.strip()
        if os.path.basename(path) in ("INDEX.md", "log.md"):
            continue
        if s.startswith("#") or s.startswith("|"):
            continue
        if INLINE.search(nc):
            flags.append((i, "인라인연결", s[:80]))
        t = nc.count("~")
        if t >= 2 and t % 2 == 0:
            flags.append((i, "~취소선", s[:60]))
        if "§" in nc:
            flags.append((i, "§기호", s[:60]))
        if s.startswith("-") and nc.count(",") >= 5:
            flags.append((i, "콤마5+", s[:80]))
    return flags

def main():
    files = sorted(set(targets(sys.argv[1:])))
    total = 0
    for f in files:
        fl = check(f)
        if fl:
            total += len(fl)
            rel = os.path.relpath(f, BRAIN)
            print(f"== {rel} ({len(fl)}) ==")
            for ln, rule, snip in fl:
                print(f"  L{ln} [{rule}] {snip}")
    print(f"\n점검 {len(files)} 파일 / 위반 후보 {total} 건")
    print("※ 인라인연결은 제목·고유명(React Hook Form + Zod)·plus 의미면 false positive — 사람 판단.")
    sys.exit(1 if total else 0)

if __name__ == "__main__":
    main()
