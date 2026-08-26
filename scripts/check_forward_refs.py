#!/usr/bin/env python3
"""Find floors that use a language feature before the curriculum teaches it.

The Curriculum Standard's Stage 0 rule is absolute: never assume prerequisite
knowledge the curriculum has not established. That is easy to state and easy
to break, because the natural way to write a graded exercise reaches for
whatever the author already knows.

This reads a dungeon plan for the floor at which each feature is introduced,
then checks every earlier floor for it. It found `def` in 46 challenges across
floors 3-6 of Python, four floors before functions are taught - a violation
nobody had noticed by reading.

    python scripts/check_forward_refs.py python
"""
import glob
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")

# feature -> (regex, the plan concept whose floor introduces it)
FEATURES = {
    "def":              (re.compile(r"(?<![\w.])def\s+\w"),        "def"),
    "return":           (re.compile(r"(?<![\w.])return(?![\w])"),  "return"),
    "class":            (re.compile(r"(?<![\w.])class\s+\w"),      "class"),
    "list literal":     (re.compile(r"=\s*\[|\[\s*['\"\d]"),       "list-literals"),
    "dict literal":     (re.compile(r"=\s*\{\s*['\"]"),            "dict-literals"),
    "f-string":         (re.compile(r"f['\"]"),                    "f-strings"),
    "comprehension":    (re.compile(r"\[[^\]\n]+\bfor\b[^\]\n]+\]"), "list-comprehension"),
    "try/except":       (re.compile(r"(?<![\w.])try\s*:"),         "try-except"),
    "with":             (re.compile(r"(?<![\w.])with\s+\w"),       "context-manager"),
    "import":           (re.compile(r"(?m)^\s*(?:import|from)\s+\w"), "import"),
    "yield":            (re.compile(r"(?<![\w.])yield(?![\w])"),   "yield"),
    "decorator":        (re.compile(r"(?m)^\s*@\w"),               "decorators"),
    "slice":            (re.compile(r"\[\s*-?\d*\s*:"),            "slicing"),
    "type hint":        (re.compile(r"def\s+\w+\([^)]*:\s*\w+"),   "annotations"),
}

# Where code actually lives. Prose may name a feature in passing while warning
# about it; executable fields may not use it.
CODE_FIELDS = ("code", "starterCode", "solution", "template")


def introduced_at(plan):
    at = {}
    for f in plan["floors"]:
        for c in f.get("teaches", []):
            at.setdefault(c, f["n"])
    return at


def code_of(floor):
    out = []
    for s in (floor.get("lesson", {}).get("sections") or []):
        for k in CODE_FIELDS:
            if s.get(k):
                out.append(("section." + k, s[k]))
        cp = s.get("checkpoint")
        if cp:
            for k in CODE_FIELDS:
                if cp.get(k):
                    out.append(("checkpoint." + k, cp[k]))
    for stage in (floor.get("sequence") or []):
        if stage == "lesson":
            continue
        for ch in (floor.get(stage) or []):
            if not isinstance(ch, dict):
                continue
            for k in CODE_FIELDS:
                if ch.get(k):
                    out.append(("%s/%s.%s" % (stage, ch.get("id", "?"), k), ch[k]))
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    dungeon = sys.argv[1]
    plan_path = os.path.join(CONTENT, "_plans", dungeon + ".json")
    if not os.path.exists(plan_path):
        print("no plan at %s - this check needs one" % plan_path)
        return 2
    plan = json.load(io.open(plan_path, encoding="utf-8"))
    at = introduced_at(plan)

    total = 0
    for path in sorted(glob.glob(os.path.join(CONTENT, "_floors", dungeon + "-[0-9]*.json"))):
        floor = json.load(io.open(path, encoding="utf-8"))
        n = floor.get("n")
        hits = {}
        for where, code in code_of(floor):
            for label, (rx, concept) in FEATURES.items():
                floor_of = at.get(concept)
                if floor_of is None or n >= floor_of:
                    continue
                if rx.search(code):
                    hits.setdefault(label, {"at": floor_of, "where": []})
                    hits[label]["where"].append(where)
        if not hits:
            continue
        print("floor %d uses features it has not been taught:" % n)
        for label, h in sorted(hits.items()):
            total += len(h["where"])
            print("   %-14s taught at floor %-2d - used in %d place(s): %s"
                  % (label, h["at"], len(h["where"]),
                     ", ".join(h["where"][:3]) + (" ..." if len(h["where"]) > 3 else "")))
        print()

    if total:
        print("%d forward reference(s). A learner meeting these has been shown "
              "something the curriculum has not taught." % total)
        return 1
    print("no forward references: every floor uses only what it has been taught")
    return 0


if __name__ == "__main__":
    sys.exit(main())
