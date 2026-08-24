#!/usr/bin/env python3
"""Validate Grimoire dungeon content. Content that fails does not ship.

    python scripts/validate_content.py            # every dungeon in index.json
    python scripts/validate_content.py python     # one dungeon
    python scripts/validate_content.py --strict   # warnings count as failures

Checks, per the build spec:
  - every floor has a lesson with >= 2 sections, each with a code example
  - every floor has >= 6 practice challenges
  - every exam has >= 8 questions
  - every concept in the floor's `concepts` array has >= 2 practice challenges
    tagged to it
  - every challenge has an `explain` field
  - the boss floor (n = 10) has a `project` type challenge

Exit code is 0 only when every dungeon passes.
"""
import argparse
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")

CHALLENGE_TYPES = {"code", "debug", "output", "fill", "order",
                   "mcq", "multi", "explain", "project"}
EXAM_ONLY = {"mcq", "multi"}
NEEDS_TESTS = {"code", "debug", "project"}

MIN_SECTIONS = 2
MIN_PRACTICE = 6
MIN_EXAM = 8
MAX_EXAM = 12
MAX_SECTIONS = 4
MIN_PER_CONCEPT = 2

# Colour only where it will actually render; Windows shells vary too much.
if sys.stdout.isatty() and os.name != "nt" and os.environ.get("TERM") not in (None, "dumb"):
    GREEN, RED, YELLOW, DIM, OFF = (
        "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[0m")
else:
    GREEN = RED = YELLOW = DIM = OFF = ""


class Result:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def err(self, where, msg):
        self.errors.append((where, msg))

    def warn(self, where, msg):
        self.warnings.append((where, msg))


def check_challenge(ch, where, phase, res, is_boss):
    cid = ch.get("id")
    if not cid:
        res.err(where, "no id")
    ctype = ch.get("type")
    if ctype not in CHALLENGE_TYPES:
        res.err(where, "unknown type %r (expected one of %s)"
                % (ctype, ", ".join(sorted(CHALLENGE_TYPES))))
        return
    if ctype in EXAM_ONLY and phase != "exam":
        res.err(where, "type %r is exam-only, found in %s" % (ctype, phase))
    if not str(ch.get("prompt", "")).strip():
        res.err(where, "empty prompt")

    # the teaching moment - required on every challenge
    explain = str(ch.get("explain", "")).strip()
    if not explain:
        res.err(where, "missing `explain` - this is the teaching moment, not optional")
    elif explain.upper().startswith("TODO"):
        res.warn(where, "`explain` is still a TODO")

    if not isinstance(ch.get("xp"), int) or ch.get("xp", 0) <= 0:
        res.err(where, "xp must be a positive integer")
    if not isinstance(ch.get("tags"), list) or not ch["tags"]:
        res.warn(where, "no tags - concept coverage cannot be measured")

    if ctype in NEEDS_TESTS:
        tests = ch.get("tests")
        if not isinstance(tests, list) or not tests:
            res.err(where, "type %r needs a non-empty `tests` array" % ctype)
        else:
            for i, t in enumerate(tests):
                if not isinstance(t, dict) or "expected" not in t:
                    res.err("%s.tests[%d]" % (where, i), "each test needs `input` and `expected`")
        if ctype in ("code", "debug") and "starterCode" not in ch:
            res.warn(where, "no starterCode - the editor will open empty")
        if not ch.get("fn") and ctype in ("code", "debug"):
            res.warn(where, "no `fn` - the runner cannot tell which function to call")

    if ctype == "output" and not str(ch.get("answer", "")).strip():
        res.err(where, "output challenge needs an `answer`")
    if ctype == "mcq":
        choices = ch.get("choices") or ch.get("options")
        if not isinstance(choices, list) or len(choices) < 2:
            res.err(where, "mcq needs at least 2 choices")
        elif not isinstance(ch.get("answer"), int) or not (0 <= ch["answer"] < len(choices)):
            res.err(where, "mcq `answer` must index into choices")
    if ctype == "project" and not is_boss:
        res.warn(where, "project challenges belong on the boss floor")
    return cid


def check_floor(fl, dungeon_id, res):
    n = fl.get("n")
    where = "%s floor %s" % (dungeon_id, n)
    is_boss = (n == 10)

    lesson = fl.get("lesson") or {}
    sections = lesson.get("sections") or []
    if len(sections) < MIN_SECTIONS:
        res.err(where + " lesson", "has %d section(s), needs >= %d"
                % (len(sections), MIN_SECTIONS))
    if len(sections) > MAX_SECTIONS:
        res.warn(where + " lesson", "has %d sections, spec caps a lesson at %d"
                 % (len(sections), MAX_SECTIONS))
    for i, s in enumerate(sections):
        sw = "%s lesson.sections[%d]" % (where, i)
        if not str(s.get("title", "")).strip():
            res.err(sw, "no title")
        if not str(s.get("body", "")).strip():
            res.err(sw, "no body")
        if not str(s.get("code", "")).strip():
            res.err(sw, "no code example - every section must have one")
        if not s.get("lang"):
            res.warn(sw, "no lang - the runner will not know how to execute it")

    practice = fl.get("practice") or []
    if len(practice) < MIN_PRACTICE:
        res.err(where + " practice", "has %d challenge(s), needs >= %d"
                % (len(practice), MIN_PRACTICE))
    exam = fl.get("exam") or []
    if len(exam) < MIN_EXAM:
        res.err(where + " exam", "has %d question(s), needs >= %d"
                % (len(exam), MIN_EXAM))
    elif len(exam) > MAX_EXAM:
        res.warn(where + " exam", "has %d questions, spec caps an exam at %d"
                 % (len(exam), MAX_EXAM))

    seen = set()
    for phase, arr in (("practice", practice), ("exam", exam)):
        for i, ch in enumerate(arr):
            cid = check_challenge(ch, "%s %s[%d]" % (where, phase, i), phase, res, is_boss)
            if cid:
                if cid in seen:
                    res.err("%s %s[%d]" % (where, phase, i), "duplicate challenge id %r" % cid)
                seen.add(cid)

    # concept coverage: every declared concept needs real practice behind it
    concepts = fl.get("concepts") or []
    if not concepts:
        res.warn(where, "no `concepts` declared - coverage cannot be checked")
    for c in concepts:
        tagged = sum(1 for ch in practice if c in (ch.get("tags") or []))
        if tagged < MIN_PER_CONCEPT:
            res.err(where, "concept %r has %d practice challenge(s) tagged to it, needs >= %d"
                    % (c, tagged, MIN_PER_CONCEPT))

    if is_boss and not any(ch.get("type") == "project" for ch in practice + exam):
        res.err(where, "boss floor has no `project` challenge")

    return {
        "n": n, "sections": len(sections), "practice": len(practice),
        "exam": len(exam), "todo": len(fl.get("_todo") or []),
    }


def check_dungeon(path, res):
    name = os.path.basename(path)
    try:
        d = json.load(io.open(path, encoding="utf-8"))
    except ValueError as e:
        res.err(name, "invalid JSON - %s" % e)
        return None
    for k in ("id", "name", "subject", "category", "floors"):
        if k not in d:
            res.err(name, "missing top-level field %r" % k)
    if d.get("category") not in ("language", "theory"):
        res.err(name, "category must be 'language' or 'theory'")
    floors = d.get("floors") or []
    if not floors:
        res.err(name, "no floors")
        return d
    rows = []
    for i, fl in enumerate(floors):
        if fl.get("n") != i + 1:
            res.err("%s floor[%d]" % (d.get("id"), i),
                    "n is %r but it sits at position %d" % (fl.get("n"), i + 1))
        rows.append(check_floor(fl, d.get("id", name), res))
    d["_rows"] = rows
    return d


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dungeon", nargs="?", help="dungeon id, e.g. python")
    ap.add_argument("--strict", action="store_true", help="treat warnings as failures")
    args = ap.parse_args()

    idx_path = os.path.join(CONTENT, "index.json")
    ids = []
    if os.path.exists(idx_path):
        try:
            idx = json.load(io.open(idx_path, encoding="utf-8"))
            ids = [e["id"] for e in idx.get("dungeons", [])
                   if e.get("status") == "available" or e.get("authored")]
        except ValueError:
            print("%scontent/index.json is not valid JSON%s" % (RED, OFF))
            return 2
    if args.dungeon:
        ids = [args.dungeon]
    if not ids:
        ids = [os.path.splitext(f)[0] for f in sorted(os.listdir(CONTENT))
               if f.endswith(".json") and not f.startswith("_") and f != "index.json"]

    overall_fail = False
    for did in ids:
        path = os.path.join(CONTENT, "%s.json" % did)
        res = Result()
        print("")
        print("%s%s%s" % (DIM, "-" * 70, OFF))
        if not os.path.exists(path):
            print("%sFAIL%s  %s - file not found" % (RED, OFF, path))
            overall_fail = True
            continue
        d = check_dungeon(path, res)
        title = "%s (%s)" % (d.get("name", did), d.get("subject", "?")) if d else did
        print("  %s  %s" % (title, DIM + os.path.relpath(path, ROOT) + OFF))
        print("%s%s%s" % (DIM, "-" * 70, OFF))

        if d and d.get("_rows"):
            print("   floor  sections  practice  exam   status")
            by_floor = {}
            for w, m in res.errors:
                for r in d["_rows"]:
                    if (" floor %s" % r["n"]) in w:
                        by_floor[r["n"]] = by_floor.get(r["n"], 0) + 1
            for r in d["_rows"]:
                bad = by_floor.get(r["n"], 0)
                mark = ("%sPASS%s" % (GREEN, OFF)) if not bad else ("%sFAIL%s (%d)" % (RED, OFF, bad))
                print("   %5d  %8d  %8d  %4d   %s" % (
                    r["n"], r["sections"], r["practice"], r["exam"], mark))

        for w, m in res.errors:
            print("   %sERROR%s %s: %s" % (RED, OFF, w, m))
        shown = res.warnings[:12]
        for w, m in shown:
            print("   %swarn %s %s: %s" % (YELLOW, OFF, w, m))
        if len(res.warnings) > len(shown):
            print("   %s...and %d more warnings%s" % (DIM, len(res.warnings) - len(shown), OFF))

        failed = bool(res.errors) or (args.strict and res.warnings)
        overall_fail = overall_fail or failed
        print("")
        print("   %s  %d error(s), %d warning(s)" % (
            ("%sFAIL%s" % (RED, OFF)) if failed else ("%sPASS%s" % (GREEN, OFF)),
            len(res.errors), len(res.warnings)))

    print("")
    if overall_fail:
        print("%sVALIDATION FAILED%s - this content does not ship." % (RED, OFF))
        return 1
    print("%sALL DUNGEONS PASS%s" % (GREEN, OFF))
    return 0


if __name__ == "__main__":
    sys.exit(main())
