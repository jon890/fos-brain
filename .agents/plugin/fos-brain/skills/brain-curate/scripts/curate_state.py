#!/usr/bin/env python3
"""brain-curate의 도구 독립 로컬 워터마크를 조회하고 갱신한다."""

import argparse
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path


def state_path() -> Path:
    base = Path(os.environ.get("XDG_STATE_HOME", Path.home() / ".local" / "state"))
    return base / "fos-brain" / "brain-curate.json"


def legacy_path() -> Path:
    return Path.home() / ".claude" / "brain-curate.state.json"


def read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"상태 파일은 JSON 객체여야 한다: {path}")
    return data


def load_state() -> tuple[dict, str]:
    current = state_path()
    if current.exists():
        return read_json(current), "current"
    legacy = legacy_path()
    if legacy.exists():
        return read_json(legacy), "legacy"
    return {}, "empty"


def write_state(data: dict) -> None:
    destination = state_path()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=destination.parent,
        prefix=f".{destination.name}.",
        delete=False,
    ) as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.replace(destination)


def show() -> None:
    data, source = load_state()
    print(json.dumps({"path": str(state_path()), "source": source, "state": data}, ensure_ascii=False, indent=2))


def advance(args: argparse.Namespace) -> None:
    data, source = load_state()
    runs = data.get("runs", [])
    if not isinstance(runs, list):
        raise ValueError("runs는 배열이어야 한다")
    now = datetime.now(timezone.utc).isoformat()
    updated = {
        **data,
        "last_curated": args.started_at,
        "last_run_iso": now,
        "runs": [*runs, {"iso": now, "sessions": args.sessions, "registered": args.registered}],
    }
    write_state(updated)
    print(json.dumps({"path": str(state_path()), "migrated_from": source if source == "legacy" else None, "state": updated}, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("show")
    advance_parser = subparsers.add_parser("advance")
    advance_parser.add_argument("--started-at", type=float, required=True)
    advance_parser.add_argument("--sessions", type=int, required=True)
    advance_parser.add_argument("--registered", type=int, required=True)
    args = parser.parse_args()
    if args.command == "show":
        show()
    else:
        if args.sessions < 0 or args.registered < 0:
            parser.error("sessions와 registered는 0 이상이어야 한다")
        advance(args)


if __name__ == "__main__":
    main()
