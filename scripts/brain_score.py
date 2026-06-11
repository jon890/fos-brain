#!/usr/bin/env python3
"""
brain_score.py — fos-brain 무결성 점수 측정기

brain-lint 11개 항목 중 *객관적으로 채점 가능한* 구조 항목만 점수로 환산한다.
중복·모순·교차참조 제안·품질축(3·8·9·11) 은 주관 판단이라 점수에서 제외한다.

reward = -(가중 위반 합).  위반 0이면 score 0(만점).
docs-audit 의 docs_score.py 와 같은 SkillOpt validation gate 패턴.
공개/비공개 누출(visibility_leak)은 보안 위험이라 가중치 최고.

사용:
  python3 brain_score.py                 # 측정 + 직전 대비 delta
  python3 brain_score.py --save          # 게이트 통과 시 history 기록
  python3 brain_score.py --json          # 기계 판독용
"""
import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

WEIGHTS = {
    "visibility_leak": 10,    # 보안 — public 이 private/work 를 링크 (유출)
    "broken_backlink": 5,     # [[slug]] 가 어느 페이지도 안 가리킴
    "path_wikilink": 4,       # [[topics/X]] 경로형 — 로컬 빌드 404
    "missing_sources": 3,     # 본문 있는데 ## Sources 없음/빔
    "frontmatter": 3,         # type/created/updated 누락
    "index_desync": 2,        # 페이지가 자기 ns INDEX 에 없음
    "orphan_note": 2,         # 어디서도 참조 안 됨
    "style_tilde": 2,         # ~ 취소선 함정
}

ENTRYPOINTS = {"INDEX.md", "log.md", "CLAUDE.md", "README.md"}
CONTENT_DIRS = ("concepts", "topics", "entities")

CODE_FENCE = re.compile(r"```.*?```", re.DOTALL)
INLINE_CODE = re.compile(r"`[^`]*`")
WIKILINK = re.compile(r"\[\[([^\]]+)\]\]")
FM = re.compile(r"^---\n(.*?)\n---", re.DOTALL)


def mask_code(text):
    text = CODE_FENCE.sub(lambda m: "\n" * m.group(0).count("\n"), text)
    return INLINE_CODE.sub(" ", text)


def link_slug(inner):
    """[[ 안 문자열에서 비교용 slug 추출. (slug, is_path, is_raw)"""
    target = inner.split("|")[0].strip()           # alias 제거
    is_raw = "raw/" in target
    is_path = ("/" in target) and not is_raw
    slug = target.split("/")[-1].replace(".md", "")
    return slug, is_path, is_raw


def collect_namespaces(root):
    ns = {"public": [root / "wiki"]}
    priv = root / "private" / "wiki"
    if priv.exists():
        ns["private"] = [priv]
    ns["work"] = [p for p in root.glob("work/*/wiki") if p.is_dir()]
    pages = {}  # ns -> [Path]
    for name, dirs in ns.items():
        acc = []
        for d in dirs:
            acc += [p for p in d.rglob("*.md")]
        pages[name] = acc
    return pages


def is_content(p):
    return any(part in CONTENT_DIRS for part in p.parts) and p.name not in ENTRYPOINTS


def measure(root):
    pages = collect_namespaces(root)
    slug_ns = {}  # slug -> set(ns)
    for nsname, plist in pages.items():
        for p in plist:
            slug_ns.setdefault(p.stem, set()).add(nsname)

    axes = {k: [] for k in WEIGHTS}

    # INDEX 본문 (ns 별)
    index_text = {}
    for nsname, plist in pages.items():
        idx = next((p for p in plist if p.name == "INDEX.md"), None)
        index_text[nsname] = idx.read_text(encoding="utf-8", errors="ignore") if idx else ""

    # 참조 수집 (orphan 용) + 링크 검사
    referenced = set()
    for nsname, plist in pages.items():
        for p in plist:
            raw = p.read_text(encoding="utf-8", errors="ignore")
            masked = mask_code(raw)
            rel = str(p.relative_to(root))

            for m in WIKILINK.finditer(masked):
                slug, is_path, is_raw = link_slug(m.group(1))
                if is_raw:
                    continue
                referenced.add(slug)
                if is_path:
                    axes["path_wikilink"].append({"file": rel, "link": m.group(1)})
                    continue
                target_ns = slug_ns.get(slug)
                if not target_ns:
                    axes["broken_backlink"].append({"file": rel, "slug": slug})
                elif nsname == "public" and target_ns <= {"private", "work"}:
                    # public 페이지가 비공개에만 있는 slug 를 가리킴 → 누출
                    axes["visibility_leak"].append({"file": rel, "slug": slug})

            # frontmatter
            fm = FM.match(raw)
            body = raw[fm.end():] if fm else raw
            if p.name not in ENTRYPOINTS:
                fmtext = fm.group(1) if fm else ""
                if not all(k in fmtext for k in ("type:", "created:", "updated:")):
                    axes["frontmatter"].append({"file": rel})

            # Sources — concepts 만 대상. entities(자기 프로젝트·사람)·topics(narrative)는
            # 출처가 자기 경험이라 raw Sources 면제.
            if is_content(p):
                if "concepts" in p.parts:
                    if "## Sources" not in raw or not WIKILINK.search(raw.split("## Sources")[-1]):
                        axes["missing_sources"].append({"file": rel})
                if p.stem not in index_text.get(nsname, ""):
                    axes["index_desync"].append({"file": rel})

            # tilde
            for para in re.split(r"\n\s*\n", masked):
                tmp = para.replace("\\~", "")
                tmp = re.sub(r"~/[\w./-]+", "", tmp)
                if tmp.count("~") >= 2:
                    axes["style_tilde"].append({"file": rel})
                    break

    # orphan: content 페이지가 참조도 안 되고 자기 INDEX 에도 없음
    for nsname, plist in pages.items():
        for p in plist:
            if not is_content(p):
                continue
            if p.stem not in referenced and p.stem not in index_text.get(nsname, ""):
                axes["orphan_note"].append({"file": str(p.relative_to(root))})

    penalty = sum(WEIGHTS[k] * len(v) for k, v in axes.items())
    total_pages = sum(len(v) for v in pages.values())
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "pages_scanned": total_pages,
        "counts": {k: len(v) for k, v in axes.items()},
        "weights": WEIGHTS,
        "penalty": penalty,
        "score": -penalty,
        "details": axes,
    }


def load_last(history):
    if not history.exists():
        return None
    lines = [l for l in history.read_text().splitlines() if l.strip()]
    return json.loads(lines[-1]) if lines else None


def print_report(result, last):
    c, w = result["counts"], result["weights"]
    print(f"# brain 무결성 점수 — {result['timestamp'][:19]}Z")
    print(f"스캔 페이지: {result['pages_scanned']}개\n")
    print(f"{'축':<20}{'위반':>6}{'가중':>6}{'감점':>8}")
    print("-" * 40)
    for k in WEIGHTS:
        print(f"{k:<20}{c[k]:>6}{w[k]:>6}{-w[k]*c[k]:>8}")
    print("-" * 40)
    print(f"{'SCORE':<20}{'':>6}{'':>6}{result['score']:>8}")
    if last:
        delta = result["score"] - last["score"]
        arrow = "▲ 개선" if delta > 0 else ("▼ 악화" if delta < 0 else "= 동일")
        print(f"\n직전: {last['score']}  →  현재: {result['score']}  (Δ {delta:+d}  {arrow})")
    else:
        print("\n(직전 기록 없음 — 이번이 baseline)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=None)
    ap.add_argument("--save", action="store_true")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    script_dir = Path(__file__).resolve().parent
    root = Path(args.root).resolve() if args.root else script_dir.parent  # scripts → brain root
    history = script_dir / "brain-score-history.jsonl"

    result = measure(root)
    last = load_last(history)

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print_report(result, last)

    if args.save:
        with history.open("a", encoding="utf-8") as fh:
            slim = {k: result[k] for k in
                    ("timestamp", "pages_scanned", "counts", "penalty", "score")}
            fh.write(json.dumps(slim, ensure_ascii=False) + "\n")
        print(f"\n→ history 기록: {history}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
