#!/usr/bin/env python3
"""Validate a single floor fragment at its true position in the dungeon.

While a dungeon is being authored floor by floor, the missing floors shift
every later floor's index, so `validate_content.py` reports band mismatches
and position errors that belong to the gaps rather than to the floor in front
of you. This checks one fragment as if the dungeon were already complete.

    python scripts/validate_floor.py content/_floors/data-structures-03.json
    python scripts/validate_floor.py content/_floors/data-structures-*.json

The dungeon-wide rules - every concept reaching Application somewhere, the
capstone on the last floor - are NOT checked here. Run validate_content.py
once the dungeon is whole.
"""
import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from validate_content import Result, band_for, check_floor  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def meta_for(path):
    """The dungeon's meta header sits beside the fragments."""
    d = os.path.dirname(path)
    base = os.path.basename(path)
    dungeon = base.rsplit("-", 1)[0]
    meta = os.path.join(d, dungeon + "-meta.json")
    if os.path.exists(meta):
        return dungeon, json.load(io.open(meta, encoding="utf-8"))
    return dungeon, {}


def main():
    paths = sys.argv[1:]
    if not paths:
        print(__doc__)
        return 2
    worst = 0
    for path in paths:
        base = os.path.basename(path)
        if base.endswith("-meta.json"):
            continue
        dungeon, meta = meta_for(path)
        fl = json.load(io.open(path, encoding="utf-8"))
        total = meta.get("totalFloors") or 10
        n = fl.get("n")
        res = Result()
        row = check_floor(fl, n - 1, total, dungeon, meta.get("disciplineType"), res,
                          meta.get("curriculum", 3))
        band = band_for(n, total, fl.get("stage"))
        print("%s  floor %s of %s  band=%s  %d section(s)  %d challenge(s)  %d application"
              % (base, n, total, band, row["sections"], row["challenges"], row["app"]))
        for where, msg in res.errors:
            print("   ERROR %s: %s" % (where, msg))
        for where, msg in res.warnings:
            print("   WARN  %s: %s" % (where, msg))
        if res.errors:
            worst = 1
        elif res.warnings:
            worst = max(worst, 0)
    print("\n%s" % ("FLOOR ERRORS - fix before committing" if worst else "all floors clean"))
    return worst


if __name__ == "__main__":
    sys.exit(main())
