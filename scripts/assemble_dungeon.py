#!/usr/bin/env python3
"""Assemble a dungeon from per-floor fragments.

    python scripts/assemble_dungeon.py python

Floors are authored one file at a time under content/_floors/{id}-NN.json so
that several can be written in parallel without fighting over one JSON blob.
This merges them, in floor order, under the dungeon header in
content/_floors/{id}-meta.json, and writes content/{id}.json.

Any floor fragment that is missing simply does not appear, so a dungeon can be
assembled and validated while it is still being authored.
"""
import argparse
import glob
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")
FLOORS = os.path.join(CONTENT, "_floors")


def band(n, total):
    if not total or total < 2:
        return "application"
    if n >= total:
        return "boss"
    if n == total - 1:
        return "design"
    pos = n / total
    if pos <= 0.2:
        return "recognition"
    if pos <= 0.4:
        return "recall"
    if pos <= 0.6:
        return "application"
    return "transfer"


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dungeon")
    ap.add_argument("--fix-levels", action="store_true",
                    help="rewrite each floor's cognitiveLevel to its proportional band")
    args = ap.parse_args()
    did = args.dungeon

    meta_path = os.path.join(FLOORS, "%s-meta.json" % did)
    if not os.path.exists(meta_path):
        print("no header at %s" % os.path.relpath(meta_path, ROOT))
        return 2
    dungeon = json.load(io.open(meta_path, encoding="utf-8"))

    frags = sorted(glob.glob(os.path.join(FLOORS, "%s-[0-9][0-9].json" % did)))
    floors = []
    for f in frags:
        try:
            floors.append(json.load(io.open(f, encoding="utf-8")))
        except ValueError as e:
            print("INVALID JSON in %s: %s" % (os.path.basename(f), e))
            return 1
    floors.sort(key=lambda x: x.get("n", 0))

    total = dungeon.get("totalFloors") or len(floors)
    for i, fl in enumerate(floors):
        if fl.get("n") != i + 1:
            print("  note: floor at position %d declares n=%s" % (i + 1, fl.get("n")))
        if args.fix_levels:
            fl["cognitiveLevel"] = band(i + 1, total)

    dungeon["floors"] = floors
    out = os.path.join(CONTENT, "%s.json" % did)
    json.dump(dungeon, io.open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    sections = sum(len((f.get("lesson") or {}).get("sections", [])) for f in floors)
    chal = 0
    for f in floors:
        for k, v in f.items():
            if k in ("concepts", "sequence", "_todo", "exercises") or not isinstance(v, list):
                continue
            chal += sum(1 for x in v if isinstance(x, dict) and ("prompt" in x or "type" in x))
    print("assembled %s: %d/%s floors, %d lesson sections, %d challenges -> %s"
          % (did, len(floors), total, sections, chal, os.path.relpath(out, ROOT)))
    for fl in floors:
        stages = [s for s in (fl.get("sequence") or []) if s != "lesson"]
        n_ch = sum(len(fl.get(s) or []) for s in stages)
        print("   floor %-2s %-28s %-12s %d sections  %2d challenges"
              % (fl.get("n"), (fl.get("name") or "")[:28],
                 fl.get("cognitiveLevel"), len((fl.get("lesson") or {}).get("sections", [])),
                 n_ch))
    return 0


if __name__ == "__main__":
    sys.exit(main())
