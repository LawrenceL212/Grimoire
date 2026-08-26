#!/usr/bin/env python3
"""Measure the authored corpus against the Curriculum Standard.

The v3 gate (validate_content.py) checks that a floor is well FORMED. This
checks something different and harder: whether a floor is well AIMED - whether
it states a capability, whether it teaches someone who knows nothing, whether
its practice ever removes the scaffolding, and whether the dungeon it belongs
to could plausibly take a beginner to professional competence.

Nothing here fails a build. It is a gap report, and the gaps are the point.

    python scripts/audit_curriculum.py
    python scripts/audit_curriculum.py python
"""
import glob
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")

# Standard section 4: the modes a floor should move through.
SCAFFOLDED = {"fill", "order", "trace", "mcq", "multi"}
PRODUCTIVE = {"code", "debug", "design", "project", "problem", "proof",
              "scenario", "diagnose", "explain", "complexity"}

# Standard section 7: what a language dungeon must reach beyond syntax.
PROFESSIONAL = {
    "git": r"\bgit\b|version control|commit history|branch",
    "testing": r"\bunit test|test suite|assert|pytest|jest|regression test",
    "dependencies": r"dependenc|package manager|\bpip\b|\bnpm\b|cargo|requirements",
    "project structure": r"project structure|module layout|package layout|__init__",
    "documentation": r"docstring|\bREADME|API documentation|document the",
    "refactoring": r"refactor",
    "reading unfamiliar code": r"unfamiliar (?:code|repositor|codebase)|existing codebase|read someone",
    "debugging": r"debugg|breakpoint|stack trace|traceback",
}

# Standard section 12: a boss must not name the technique for the learner.
NAMES_TECHNIQUE = re.compile(
    r"\buse (?:a |an |the )?(?:recursion|dynamic programming|binary search|hash|"
    r"stack|queue|heap|trie|union.find|memoi|greedy|two pointer|sliding window)",
    re.I)


def floors_of(d):
    return d.get("floors", []) or []


def challenges(fl):
    """Every graded challenge on a floor, with the stage that holds it."""
    out = []
    for s in (fl.get("lesson", {}).get("sections") or []):
        if s.get("checkpoint"):
            out.append(("lesson", s["checkpoint"]))
    seq = fl.get("sequence") or []
    for stage in seq:
        if stage == "lesson":
            continue
        for c in (fl.get(stage) or []):
            if isinstance(c, dict):
                out.append((stage, c))
    return out


def prose_of(fl):
    bits = []
    for s in (fl.get("lesson", {}).get("sections") or []):
        bits.append(s.get("body", ""))
    for _, c in challenges(fl):
        bits.append(c.get("prompt", ""))
        bits.append(c.get("explain", ""))
    return "\n".join(bits)


def report(name, d):
    fls = floors_of(d)
    if not fls:
        return None
    disc = d.get("disciplineType")
    is_lang = disc == "language"

    n_floors = len(fls)
    goals = sum(1 for f in fls if str(f.get("goal", "")).strip())
    briefs = sum(1 for f in fls if str(f.get("description", "")).strip())
    prereqs = sum(1 for f in fls if f.get("requires"))

    # section 4: does practice ever stop naming the technique?
    scaffold_only = []
    for f in fls:
        chs = [c for _, c in challenges(f)]
        if not chs:
            continue
        prod = [c for c in chs if c.get("type") in PRODUCTIVE]
        if not prod:
            scaffold_only.append(f.get("n"))

    # section 12: does the boss hand the learner the technique?
    boss = fls[-1]
    boss_tells = []
    for _, c in challenges(boss):
        if NAMES_TECHNIQUE.search(c.get("prompt", "") or ""):
            boss_tells.append(c.get("id"))

    # section 7: professional coverage, language dungeons only
    prose = "\n".join(prose_of(f) for f in fls)
    missing_pro = []
    if is_lang:
        for label, rx in PROFESSIONAL.items():
            if not re.search(rx, prose, re.I):
                missing_pro.append(label)

    # section 11: is there anything project-shaped at all?
    has_project = any(c.get("type") == "project"
                      for f in fls for _, c in challenges(f))

    return {
        "name": name, "discipline": disc, "floors": n_floors,
        "goals": goals, "briefs": briefs, "floor_prereqs": prereqs,
        "scaffold_only_floors": scaffold_only,
        "boss_names_technique": boss_tells,
        "missing_professional": missing_pro,
        "has_project": has_project,
        "is_language": is_lang,
    }


def main():
    want = sys.argv[1:] or None
    rows = []
    for p in sorted(glob.glob(os.path.join(CONTENT, "*.json"))):
        name = os.path.basename(p)[:-5]
        if name.startswith("_") or name == "index":
            continue
        if want and name not in want:
            continue
        try:
            d = json.load(io.open(p, encoding="utf-8"))
        except ValueError:
            continue
        if not d.get("disciplineType"):
            continue        # not authored to v3 yet
        r = report(name, d)
        if r:
            rows.append(r)

    if not rows:
        print("no authored dungeons found")
        return 0

    print("%-22s %-11s %5s %6s %7s %8s %8s" %
          ("dungeon", "discipline", "flrs", "goals", "briefs", "f-prereq", "project"))
    print("-" * 76)
    for r in rows:
        print("%-22s %-11s %5d %6s %7s %8s %8s" % (
            r["name"], r["discipline"], r["floors"],
            "%d/%d" % (r["goals"], r["floors"]),
            "%d/%d" % (r["briefs"], r["floors"]),
            "%d/%d" % (r["floor_prereqs"], r["floors"]),
            "yes" if r["has_project"] else "NO"))

    print()
    counts = {}
    for r in rows:
        counts.setdefault(r["floors"], []).append(r["name"])
    print("FLOOR COUNTS (standard 14: depth should decide, not a template)")
    for n in sorted(counts):
        print("   %2d floors: %s" % (n, ", ".join(counts[n])))

    print()
    print("STANDARD 3 + 13: a floor should state the capability it confers")
    tot = sum(r["floors"] for r in rows)
    print("   floors with a `goal`        : %d of %d" % (sum(r["goals"] for r in rows), tot))
    print("   floors with a `description` : %d of %d" % (sum(r["briefs"] for r in rows), tot))

    print()
    print("STANDARD 9: floor-level prerequisites")
    print("   floors declaring `requires` : %d of %d" % (sum(r["floor_prereqs"] for r in rows), tot))

    print()
    print("STANDARD 4: floors whose practice is entirely scaffolded types")
    any_bad = False
    for r in rows:
        if r["scaffold_only_floors"]:
            any_bad = True
            print("   %-22s floors %s" % (r["name"], r["scaffold_only_floors"]))
    if not any_bad:
        print("   none - every floor has at least one productive challenge")

    print()
    print("STANDARD 12: bosses that name the technique in the prompt")
    any_bad = False
    for r in rows:
        if r["boss_names_technique"]:
            any_bad = True
            print("   %-22s %s" % (r["name"], r["boss_names_technique"]))
    if not any_bad:
        print("   none")

    langs = [r for r in rows if r["is_language"]]
    if langs:
        print()
        print("STANDARD 7: professional topics absent from language dungeons")
        for r in langs:
            print("   %-22s missing: %s" % (
                r["name"], ", ".join(r["missing_professional"]) or "nothing"))

    print()
    print("STANDARD 11: dungeons with no project-type challenge")
    none_proj = [r["name"] for r in rows if not r["has_project"]]
    print("   %s" % (", ".join(none_proj) if none_proj else "none"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
