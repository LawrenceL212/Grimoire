#!/usr/bin/env python3
"""Validate Grimoire dungeon content against schema v3.

    python scripts/validate_content.py            # every authored dungeon
    python scripts/validate_content.py python     # one dungeon
    python scripts/validate_content.py --strict   # warnings fail too

Content that fails does not ship. See content/_SCHEMA.md.
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

TYPES = {"code", "debug", "design", "project", "output", "fill", "order",
         "mcq", "multi", "explain", "problem", "proof", "complexity",
         "trace", "diagnose", "scenario"}
EXAM_ONLY = {"mcq", "multi"}
NEEDS_TESTS = {"code", "debug", "design", "project"}
RUBRIC_TYPES = {"explain", "problem", "proof", "scenario"}
ANSWER_AND_RUBRIC = {"complexity", "diagnose"}
LAYERS = {"exposure", "retrieval", "application"}
APPLICATION_TYPES = {"code", "debug", "design", "project", "scenario",
                     "diagnose", "complexity", "problem", "proof"}
LEVELS = ["recognition", "recall", "application", "transfer", "design", "boss"]

# Legal assessment types per discipline (content/_SCHEMA.md section 2).
DISCIPLINE_TYPES = {
    "language":    {"code", "debug", "design", "project", "output", "fill",
                    "explain", "order", "trace", "mcq", "multi"},
    "algorithms":  {"code", "complexity", "proof", "trace", "explain", "order",
                    "design", "project", "output", "fill", "debug", "mcq", "multi"},
    "mathematics": {"problem", "proof", "fill", "explain", "mcq", "multi",
                    "order", "trace", "complexity"},
    "systems":     {"trace", "diagnose", "scenario", "explain", "code", "fill",
                    "order", "output", "design", "project", "mcq", "multi"},
    "security":    {"scenario", "diagnose", "explain", "code", "trace", "fill",
                    "design", "project", "mcq", "multi"},
    "theory":      {"proof", "problem", "fill", "trace", "explain", "order",
                    "complexity", "design", "project", "mcq", "multi"},
    "engineering": {"scenario", "design", "explain", "mcq", "trace", "diagnose",
                    "code", "project", "multi", "fill"},
}
# Disciplines where MCQ must never be the dominant instrument.
NO_MCQ_PRIMARY = {"language", "algorithms"}

MIN_SECTIONS, MAX_SECTIONS = 2, 4
MIN_EXAM, MAX_EXAM = 8, 12
MIN_TESTS = 3

if sys.stdout.isatty() and os.name != "nt" and os.environ.get("TERM") not in (None, "dumb"):
    GREEN, RED, YELLOW, DIM, OFF = ("\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[0m")
else:
    GREEN = RED = YELLOW = DIM = OFF = ""


class Result:
    def __init__(self):
        self.errors, self.warnings = [], []

    def err(self, where, msg):
        self.errors.append((where, msg))

    def warn(self, where, msg):
        self.warnings.append((where, msg))


def band_for(n, total):
    """Proportional cognitive band. Last floor is boss, the one before design."""
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


def check_challenge(ch, where, stage, res, discipline, level, is_last_floor):
    cid = ch.get("id")
    ctype = ch.get("type")
    if not cid:
        res.err(where, "no id")
    if ctype not in TYPES:
        res.err(where, "unknown type %r" % ctype)
        return cid, None
    if ctype in EXAM_ONLY and stage != "exam":
        res.err(where, "type %r is exam-only, found in stage %r" % (ctype, stage))
    if discipline and ctype not in DISCIPLINE_TYPES.get(discipline, TYPES):
        res.err(where, "type %r is not valid for a %r dungeon" % (ctype, discipline))

    layer = ch.get("layer")
    if layer is None:
        res.err(where, "no `layer` - it is declared, never inferred")
    elif layer not in LAYERS:
        res.err(where, "layer %r must be one of %s" % (layer, sorted(LAYERS)))

    if not str(ch.get("prompt", "")).strip():
        res.err(where, "empty prompt")

    explain = str(ch.get("explain", "")).strip()
    if not explain:
        res.err(where, "missing `explain` - the teaching moment, not optional")
    elif explain.upper().startswith("TODO"):
        res.err(where, "`explain` is still a TODO")
    elif len(explain) < 40:
        res.warn(where, "`explain` is %d chars - say why, not what" % len(explain))

    if not isinstance(ch.get("xp"), int) or ch.get("xp", 0) <= 0:
        res.err(where, "xp must be a positive integer")
    if not ch.get("tags") and not ch.get("concepts"):
        res.warn(where, "no tags or concepts - coverage cannot be measured")

    if ctype in NEEDS_TESTS:
        tests = ch.get("tests")
        if not isinstance(tests, list) or not tests:
            res.err(where, "type %r needs a non-empty `tests` array" % ctype)
        else:
            # a checkpoint is a small gate between lesson sections, not a
            # graded challenge, so it is not held to the edge-case minimum
            if len(tests) < MIN_TESTS and stage != "checkpoint":
                res.err(where, "%d test(s); every code challenge needs >= %d "
                               "including an edge case" % (len(tests), MIN_TESTS))
            for i, t in enumerate(tests):
                if not isinstance(t, dict) or "expected" not in t:
                    res.err("%s.tests[%d]" % (where, i), "each test needs `expected`")
        if ctype in ("code", "debug") and not ch.get("starterCode", "").strip():
            if level not in ("design", "boss"):
                res.warn(where, "no starterCode outside a design/boss floor")
        if ctype in ("design", "project") and ch.get("starterCode", "").strip():
            res.err(where, "%r on a %s floor must have no starter code" % (ctype, level))
        if ch.get("hint") or ch.get("hint1"):
            if level in ("design", "boss"):
                res.err(where, "hints are not available on a %s floor" % level)

    if ctype == "output" and not str(ch.get("answer", "")).strip():
        res.err(where, "output challenge needs an `answer`")
    if ctype in ("mcq", "multi"):
        choices = ch.get("choices")
        if not isinstance(choices, list) or len(choices) < 2:
            res.err(where, "%s needs at least 2 choices" % ctype)
        elif ctype == "mcq":
            if not isinstance(ch.get("answer"), int) or not (0 <= ch["answer"] < len(choices)):
                res.err(where, "mcq `answer` must index into choices")
        else:
            a = ch.get("answer")
            if not isinstance(a, list) or not a or any(
                    not isinstance(i, int) or not (0 <= i < len(choices)) for i in a):
                res.err(where, "multi `answer` must be a non-empty list of indices")
    if ctype == "fill":
        blanks = ch.get("blanks")
        tmpl = ch.get("template", "")
        if not isinstance(blanks, list) or not blanks:
            res.err(where, "fill needs a `blanks` array")
        elif tmpl.count("___") != len(blanks):
            res.err(where, "template has %d ___ but %d blanks"
                    % (tmpl.count("___"), len(blanks)))
    if ctype == "order":
        frags = ch.get("fragments")
        if not isinstance(frags, list) or len(frags) < 2:
            res.err(where, "order needs at least 2 fragments")
        elif not isinstance(ch.get("answer"), list) or \
                sorted(ch["answer"]) != list(range(len(frags))):
            res.err(where, "order `answer` must be a permutation of every fragment index")
    if ctype == "trace":
        steps = ch.get("steps")
        if not isinstance(steps, list) or not steps:
            res.err(where, "trace needs a `steps` array")
        elif any("expected" not in s for s in steps):
            res.err(where, "every trace step needs `expected`")
    if ctype in RUBRIC_TYPES or ctype in ANSWER_AND_RUBRIC:
        rub = ch.get("rubric")
        if not isinstance(rub, dict) or not rub.get("required"):
            res.err(where, "%r needs a rubric with a non-empty `required` list" % ctype)
    if ctype in ANSWER_AND_RUBRIC and not str(ch.get("answer", "")).strip():
        res.err(where, "%r needs an `answer`" % ctype)
    if ctype == "project" and not is_last_floor:
        res.warn(where, "project challenges belong on the boss floor")

    return cid, ctype


def check_floor(fl, i, total, dungeon_id, discipline, res):
    n = fl.get("n")
    where = "%s floor %s" % (dungeon_id, n)
    is_last = (i == total - 1)

    if n != i + 1:
        res.err(where, "`n` is %r but it sits at position %d" % (n, i + 1))
    if not fl.get("name"):
        res.warn(where, "no floor name")

    level = fl.get("cognitiveLevel")
    expected = band_for(i + 1, total)
    if level is None:
        res.err(where, "no `cognitiveLevel`")
        level = expected
    elif level not in LEVELS:
        res.err(where, "cognitiveLevel %r unknown" % level)
    elif level != expected:
        res.err(where, "cognitiveLevel is %r but floor %d of %d is the %r band"
                % (level, i + 1, total, expected))

    concepts = fl.get("concepts") or []
    if not concepts:
        res.err(where, "no `concepts` - coverage cannot be measured")

    lesson = fl.get("lesson") or {}
    sections = lesson.get("sections") or []
    if not (MIN_SECTIONS <= len(sections) <= MAX_SECTIONS):
        res.err(where + " lesson", "has %d sections, needs %d-%d"
                % (len(sections), MIN_SECTIONS, MAX_SECTIONS))
    for si, s in enumerate(sections):
        sw = "%s lesson.sections[%d]" % (where, si)
        if not str(s.get("title", "")).strip():
            res.err(sw, "no title")
        body = str(s.get("body", "")).strip()
        if not body:
            res.err(sw, "no body")
        if not str(s.get("code", "")).strip():
            res.err(sw, "no code example - every section needs one")
        cp = s.get("checkpoint")
        if not cp:
            res.err(sw, "no `checkpoint` - it is the gate to the next section")
        else:
            check_challenge({**cp, "id": cp.get("id", "cp"), "xp": cp.get("xp", 10)},
                            sw + ".checkpoint", "checkpoint", res, discipline, level, is_last)
        for a in s.get("annotations") or []:
            ln = a.get("line")
            nlines = len(str(s.get("code", "")).split("\n"))
            if not isinstance(ln, int) or not (1 <= ln <= nlines):
                res.err(sw, "annotation line %r out of range (code has %d lines)" % (ln, nlines))

    sequence = fl.get("sequence")
    if not isinstance(sequence, list) or not sequence:
        res.err(where, "no `sequence` - the floor declares its own shape")
        sequence = []
    if sequence and sequence[0] != "lesson":
        res.warn(where, "sequence does not start with `lesson`")

    seen, types_seen, app_layer_ids, tagged = set(), [], [], {}
    for stage in sequence:
        if stage == "lesson":
            continue
        items = fl.get(stage)
        if not isinstance(items, list):
            res.err(where, "sequence names stage %r but the floor has no such array" % stage)
            continue
        if not items:
            res.err(where, "stage %r is empty" % stage)
        for ci, ch in enumerate(items):
            cid, ctype = check_challenge(ch, "%s %s[%d]" % (where, stage, ci),
                                         stage, res, discipline, level, is_last)
            if cid in seen:
                res.err("%s %s[%d]" % (where, stage, ci), "duplicate challenge id %r" % cid)
            seen.add(cid)
            if ctype:
                types_seen.append(ctype)
            if ch.get("layer") == "application":
                app_layer_ids.append(cid)
            for c in (ch.get("concepts") or ch.get("tags") or []):
                tagged.setdefault(c, []).append(ctype)

    has_project = any(
        ch.get("type") == "project"
        for stage in sequence if stage != "lesson"
        for ch in (fl.get(stage) or []))

    exam = fl.get("exam")
    if not isinstance(exam, list):
        # a boss floor is assessed by its project, not by an exam
        if not (is_last and has_project):
            res.err(where, "no `exam` stage")
    else:
        if not (MIN_EXAM <= len(exam) <= MAX_EXAM):
            res.err(where + " exam", "has %d questions, needs %d-%d"
                    % (len(exam), MIN_EXAM, MAX_EXAM))
        if len(set(c.get("type") for c in exam)) < 2:
            res.err(where + " exam", "must mix assessment types")
        if not any(c.get("layer") == "application" for c in exam):
            res.err(where + " exam", "needs at least one Application-layer question")

    if types_seen and discipline in NO_MCQ_PRIMARY:
        mcq = sum(1 for t in types_seen if t in EXAM_ONLY)
        if mcq > len(types_seen) / 2:
            res.err(where, "MCQ is %d of %d challenges - never the primary "
                           "instrument in a %s dungeon" % (mcq, len(types_seen), discipline))

    for c in concepts:
        if c not in tagged:
            res.err(where, "concept %r has no challenge tagged to it" % c)

    if is_last and not has_project:
        res.err(where, "the last floor is the boss and needs a `project` challenge")

    return {"n": n, "level": level, "sections": len(sections),
            "challenges": len(seen), "app": len(app_layer_ids)}


def check_dungeon(path, res):
    name = os.path.basename(path)
    try:
        d = json.load(io.open(path, encoding="utf-8"))
    except ValueError as e:
        res.err(name, "invalid JSON - %s" % e)
        return None
    for k in ("id", "name", "subject", "category", "disciplineType", "lang", "floors"):
        if k not in d:
            res.err(name, "missing top-level field %r" % k)
    discipline = d.get("disciplineType")
    if discipline and discipline not in DISCIPLINE_TYPES:
        res.err(name, "unknown disciplineType %r" % discipline)
    floors = d.get("floors") or []
    if not floors:
        res.err(name, "no floors")
        return d
    total = d.get("totalFloors") or len(floors)
    rows = [check_floor(fl, i, total, d.get("id", name), discipline, res)
            for i, fl in enumerate(floors)]
    # every concept must reach Application somewhere in the dungeon
    declared, applied = set(), set()
    for fl in floors:
        declared.update(fl.get("concepts") or [])
        for stage, items in fl.items():
            if not isinstance(items, list) or stage in ("concepts", "sequence", "_todo", "exercises"):
                continue
            for ch in items:
                if isinstance(ch, dict) and ch.get("layer") == "application":
                    applied.update(ch.get("concepts") or ch.get("tags") or [])
    missing = sorted(declared - applied)
    if missing:
        res.err(d.get("id", name), "concepts never reaching Application layer: %s"
                % ", ".join(missing[:8]))
    d["_rows"] = rows
    return d


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dungeon", nargs="?")
    ap.add_argument("--strict", action="store_true")
    args = ap.parse_args()

    paths = []
    if args.dungeon:
        paths = [os.path.join(CONTENT, args.dungeon + ".json")]
    else:
        for p in sorted(glob.glob(os.path.join(CONTENT, "*.json"))):
            b = os.path.basename(p)
            if b in ("index.json", "_TEMPLATE.json"):
                continue
            try:
                d = json.load(io.open(p, encoding="utf-8"))
            except ValueError:
                paths.append(p)
                continue
            # only gate dungeons that declare v3 authorship
            if d.get("disciplineType") and any(
                    f.get("sequence") for f in (d.get("floors") or [])):
                paths.append(p)

    if not paths:
        print("no v3-authored dungeons to validate yet")
        return 0

    overall = False
    for path in paths:
        res = Result()
        print("")
        print("-" * 72)
        if not os.path.exists(path):
            print("%sFAIL%s  %s - file not found" % (RED, OFF, path))
            overall = True
            continue
        d = check_dungeon(path, res)
        print("  %s  %s" % (d.get("name", "?") if d else "?", DIM + os.path.relpath(path, ROOT) + OFF))
        print("-" * 72)
        if d and d.get("_rows"):
            print("   floor  level         sect  chal   app")
            for r in d["_rows"]:
                print("   %5s  %-12s  %4d  %4d  %4d"
                      % (r["n"], r["level"], r["sections"], r["challenges"], r["app"]))
        for w, m in res.errors:
            print("   %sERROR%s %s: %s" % (RED, OFF, w, m))
        for w, m in res.warnings[:15]:
            print("   %swarn %s %s: %s" % (YELLOW, OFF, w, m))
        if len(res.warnings) > 15:
            print("   %s...and %d more warnings%s" % (DIM, len(res.warnings) - 15, OFF))
        failed = bool(res.errors) or (args.strict and res.warnings)
        overall = overall or failed
        print("")
        print("   %s  %d error(s), %d warning(s)"
              % (("%sFAIL%s" % (RED, OFF)) if failed else ("%sPASS%s" % (GREEN, OFF)),
                 len(res.errors), len(res.warnings)))

    print("")
    if overall:
        print("%sVALIDATION FAILED%s - this content does not ship." % (RED, OFF))
        return 1
    print("%sALL AUTHORED DUNGEONS PASS%s" % (GREEN, OFF))
    return 0


if __name__ == "__main__":
    sys.exit(main())
