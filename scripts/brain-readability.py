#!/usr/bin/env python3
"""brain-readability — brain 문서의 가독성 규칙 위반 후보를 점검.

전역 CLAUDE.md·korean-style 가독성 규칙 중 기계 점검 가능한 항목을 스캔한다.
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
  - 표현 사전: 한 번에 안 읽히는 압축 한자어·구어·풀이 대상 외래어 (누적 관리)
  - 명사형 종결: paragraph 평문 문장이 명사형 어미로 끝남 (bullet·표·헤더 제외)

표현 사전·명사형은 false positive 가 날 수 있어 사람이 최종 판단한다.
반복 지적되는 표현은 EXPR_DICT 에 추가해 다음부터 자동 차단한다(self-improving).
"""
import sys, os, re, glob

BRAIN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INLINE = re.compile(r" [+·&] ")

# 풀어써야 하는 표현 사전 — korean-style 매핑 + 세션 누적 지적.
# 영문 관용(streaming·generator·pipeline·backpressure·rate limit 등)은 의도적으로 제외한다.
EXPR_DICT = {
    "차출": "빌려 쓰기·빼서 쓰기",
    "오살": "엉뚱한 프로세스를 죽임",
    "외과적": "정밀한·국소적",
    "폭주": "과점유",
    "매트릭스": "표",
    "트리아지": "분류",
    "클램프": "범위 제한",
    "ephemeral": "일회성",
    "하이브리드": "혼합·크기별",
    "싸게": "가볍게·비용 적게",
    "비싸": "무겁게·비용 높게",
}
# 명사형 종결 어미 (평문 문장 끝). bullet·표·헤더·인용 제외하고 평문만 검사한다.
NOUN_END = re.compile(r"(필요|불변|미확정|확보|측정|완료|권장|도출|반영|개선|적용|제거|추가|변경)\.$")


def strip_code(s):
    s = re.sub(r"`[^`]*`", "", s)         # 인라인 코드
    s = re.sub(r"\[\[[^\]]*\]\]", "", s)  # wikilink 슬러그(고유명) 제외
    return s


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
    if os.path.basename(path) in ("INDEX.md", "log.md"):
        return flags
    for i, raw in enumerate(open(path, encoding="utf-8"), 1):
        line = raw.rstrip("\n"); nc = strip_code(line); s = line.strip()
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
        for term, sug in EXPR_DICT.items():
            if term in nc:
                flags.append((i, f"표현({term}→{sug})", s[:60]))
        # 명사형 종결은 평문 문장만 — bullet(-·*)·인용(>) 안 항목은 명사구 종결 허용
        if not s.startswith(("-", "*", ">")) and NOUN_END.search(nc):
            flags.append((i, "명사형종결", s[:60]))
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
    print("※ 인라인연결·표현 사전은 고유명·plus 의미·영문 관용이면 false positive — 사람 판단.")
    print("※ 반복 지적되는 표현은 EXPR_DICT 에 추가해 다음부터 자동 차단한다.")
    sys.exit(1 if total else 0)


if __name__ == "__main__":
    main()
