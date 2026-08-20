#!/usr/bin/env python3
"""brain 큐레이션·페이지 미리보기를 Quartz 톤 HTML 로 생성한다.

채팅 인라인 본문만으로는 표·페이지 레이아웃이 잘 안 보여서, 등록 전 검토용으로
실제 Quartz 렌더에 가까운 HTML 미리보기를 만들어 브라우저로 띄운다.
(채팅 인라인 본문 표시 원칙은 유지 — HTML 은 보조다.)

입력 JSON 스키마:
  {
    "title": "SkillOpt 등록",
    "namespace": "public",
    "stats": {"신규": {"n": 26, "kind": "new"}, "보강": {"n": 3, "kind": "augment"}, "드롭": {"n": 7, "kind": "drop"}},
    "candidates": [
      {"n": 1, "title": "...", "type": "concept", "status": "신규", "ns": "public", "evidence": "fos-study 5건", "flag": "확인 필요"}
    ],
    "pages": [
      {"frontmatter": "type: concept · created: 2026-06-12", "markdown": "# 제목\n본문..."}
    ]
  }
candidates·pages 는 선택. 둘 중 있는 것만 렌더된다.

사용:
  python3 generate_preview.py --data preview.json --out /tmp/brain-preview.html
  cmux browser open "file:///tmp/brain-preview.html"
"""
import argparse
import json
import os
import sys

TEMPLATE = os.path.join(os.path.dirname(__file__), "..", "templates", "preview.html")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="미리보기 데이터 JSON 경로")
    ap.add_argument("--out", required=True, help="출력 HTML 경로")
    ap.add_argument("--template", default=TEMPLATE, help="템플릿 경로(기본: ../templates/preview.html)")
    args = ap.parse_args()

    with open(args.data, encoding="utf-8") as f:
        raw = f.read()

    # 안전 점검: 본문에 </script> 가 있으면 템플릿 주입이 깨진다
    if "</script>" in raw.lower():
        sys.exit("오류: 데이터에 </script> 문자열이 있어 HTML 주입이 깨집니다. 제거 후 재시도.")

    # JSON 유효성 확인
    json.loads(raw)

    with open(args.template, encoding="utf-8") as f:
        tpl = f.read()

    html = tpl.replace("__DATA__", raw)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"생성 완료: {args.out} ({len(html)} bytes)")


if __name__ == "__main__":
    main()
