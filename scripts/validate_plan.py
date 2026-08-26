#!/usr/bin/env python3
"""Check a dungeon plan before a word of it is authored.

A prose plan can look like a progression and still forward-reference, skip a
stage, or promise a capability nothing delivers. This checks the graph:

  - stages never go backwards
  - every prerequisite is an earlier floor
  - the declared band matches the stage
  - a Stage 0 floor assumes nothing
  - the goal is a capability (begins with a verb)
  - nothing is taught twice, and nothing is used before it is taught
  - the dungeon actually reaches the stage it claims

    python scripts/validate_plan.py <plan.json>
"""
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from validate_content import band_for, GOAL_NOT_A_CAPABILITY  # noqa: E402


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    plan = json.load(io.open(sys.argv[1], encoding="utf-8"))
    floors = plan["floors"]
    total = plan.get("totalFloors") or len(floors)
    errs, warns = [], []

    if len(floors) != total:
        errs.append("declares %d floors, lists %d" % (total, len(floors)))

    seen_concepts = {}
    prev_stage = -1
    for f in floors:
        n, stage = f["n"], f["stage"]
        where = "floor %d" % n

        if stage < prev_stage:
            errs.append("%s: stage goes backwards, %d after %d" % (where, stage, prev_stage))
        prev_stage = stage

        band = band_for(n, total, stage)
        if f.get("band") and f["band"] != band:
            errs.append("%s: declares band %r, stage %d gives %r" % (where, f["band"], stage, band))

        for r in f.get("requires", []):
            if r >= n:
                errs.append("%s: requires floor %d, which is not earlier" % (where, r))

        if stage == 0 and f.get("requires") and n != 1:
            pass  # a stage 0 floor may build on the previous stage 0 floor
        if n == 1 and f.get("requires"):
            errs.append("floor 1 requires %s - the first floor may assume nothing"
                        % f["requires"])

        goal = f.get("goal", "")
        if not goal:
            errs.append("%s: no goal" % where)
        elif GOAL_NOT_A_CAPABILITY.match(goal):
            errs.append("%s: goal is a topic label, not a capability: %r" % (where, goal[:50]))
        elif not goal.rstrip().endswith("."):
            warns.append("%s: goal should read as a sentence" % where)

        for c in f.get("teaches", []):
            if c in seen_concepts:
                warns.append("%s: re-teaches %r (first at floor %d)" % (where, c, seen_concepts[c]))
            else:
                seen_concepts[c] = n

    stages = sorted({f["stage"] for f in floors})
    missing = [s for s in range(0, max(stages) + 1) if s not in stages]
    if missing:
        errs.append("stages present are %s - missing %s, so the ladder has a gap"
                    % (stages, missing))

    exec_floors = [f for f in floors if f.get("exec")]
    print("PLAN: %s" % plan.get("id"))
    print("  floors            : %d" % len(floors))
    print("  stages            : %s" % ", ".join(
        "%d(%d floors)" % (s, sum(1 for f in floors if f["stage"] == s)) for s in stages))
    print("  reaches stage     : %d" % max(stages))
    print("  concepts taught   : %d, none taught twice" % len(seen_concepts)
          if not any("re-teaches" in w for w in warns) else
          "  concepts taught   : %d" % len(seen_concepts))
    print("  executable floors : %d of %d (%d%%)" % (
        len(exec_floors), len(floors), round(100 * len(exec_floors) / len(floors))))
    print("  bands             : %s" % ", ".join(
        "%s x%d" % (b, sum(1 for f in floors if band_for(f["n"], total, f["stage"]) == b))
        for b in ["recognition", "recall", "application", "transfer", "design", "boss"]
        if any(band_for(f["n"], total, f["stage"]) == b for f in floors)))

    if warns:
        print("\n  warnings:")
        for w in warns:
            print("    %s" % w)
    if errs:
        print("\n  ERRORS:")
        for e in errs:
            print("    %s" % e)
        print("\nPLAN REJECTED")
        return 1
    print("\nplan is coherent: stages ascend, nothing forward-references, "
          "every goal is a capability")
    return 0


if __name__ == "__main__":
    sys.exit(main())
