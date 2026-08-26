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

# --- Curriculum Standard (content/_CURRICULUM.md) ---------------------------
# A floor is a capability checkpoint, so it must say which capability. These
# are warnings during the retrofit and errors once a dungeon declares
# "curriculum": 4 - so the corpus can be migrated dungeon by dungeon rather
# than in one unreviewable sweep.
STAGES = range(0, 7)
DESCRIPTION_KEYS = ("what", "why", "enables", "assumes", "assessed")

# A goal states what the learner can DO, so it begins with a verb. This is a
# blunt check - a stop-list of the openings that mean a topic label was
# written instead of a capability.
GOAL_NOT_A_CAPABILITY = re.compile(
    r"^\s*(?:the\b|a\b|an\b|introduction\b|intro\b|basics\b|overview\b|"
    r"fundamentals\b|about\b|learn about\b|understanding\b)", re.I)

# Independent practice and boss floors must not hand the learner the
# technique: recognising that a tool applies is the skill being measured.
TECHNIQUE_NAMED = re.compile(
    r"\buse (?:a |an |the )?(?:recursion|recursive|dynamic programming|memoi|"
    r"binary search|hash (?:map|table|set)|dictionar|stack|queue|heap|trie|"
    r"union.find|greedy|two.pointer|sliding window|linked list|set\b|"
    r"comprehension|generator|decorator|regex|regular expression)", re.I)
NO_TECHNIQUE_STAGES = ("independent-practice", "independent", "trial")

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


# Curriculum stage -> the cognitive demand that stage IS. A Stage 4 floor asks
# for design judgement whether it sits at position 26 or 30.
STAGE_BAND = {0: "recognition", 1: "recall", 2: "application",
              3: "transfer", 4: "design", 5: "design", 6: "design"}


def band_for(n, total, stage=None):
    """The cognitive band a floor must declare.

    Proportional position was the right model while every dungeon was ten
    floors long. It breaks over a dungeon that spans absolute beginner to
    professional: at 30 floors it yields ten consecutive `transfer` floors and
    a single `design` one, which says nothing useful about any of them.

    So once a floor declares its curriculum `stage`, the stage decides - the
    demand of a floor is a property of what it asks, not of where it sits.
    Floors without a stage keep the proportional behaviour, so v3 dungeons are
    unaffected. The last floor is always the boss.
    """
    if not total or total < 2:
        return "application"
    if n >= total:
        return "boss"
    if stage is not None and stage in STAGE_BAND:
        return STAGE_BAND[stage]
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
        rubric = ch.get("rubric")
        graded_by_rubric = (
            ctype in ("design", "project")
            and not tests
            and isinstance(rubric, dict) and rubric.get("required"))
        if graded_by_rubric:
            tests = None
        elif not isinstance(tests, list) or not tests:
            res.err(where, "type %r needs a non-empty `tests` array, or - for a "
                           "design/project we cannot execute - a `rubric`" % ctype)
        elif tests:
            # a checkpoint is a small gate between lesson sections, not a
            # graded challenge, so it is not held to the edge-case minimum
            if len(tests) < MIN_TESTS and stage != "checkpoint":
                res.err(where, "%d test(s); every code challenge needs >= %d "
                               "including an edge case" % (len(tests), MIN_TESTS))
            for i, t in enumerate(tests):
                # a test asserts either a value or that the call throws
                if not isinstance(t, dict) or not ("expected" in t or "throws" in t):
                    res.err("%s.tests[%d]" % (where, i),
                            "each test needs `expected`, or `throws` to assert an error")
        if ctype in ("code", "debug") and not ch.get("starterCode", "").strip():
            # Independent practice is DEFINED by the absence of scaffolding, so
            # warning that it has none is the validator arguing with the
            # curriculum rather than checking it.
            if level not in ("design", "boss") and stage not in NO_TECHNIQUE_STAGES:
                res.warn(where, "no starterCode outside a design/boss floor")
        if ctype in ("design", "project") and ch.get("starterCode", "").strip():
            res.err(where, "%r on a %s floor must have no starter code" % (ctype, level))
        if ch.get("hint") or ch.get("hint1"):
            if level in ("design", "boss"):
                res.err(where, "hints are not available on a %s floor" % level)
            elif stage in NO_TECHNIQUE_STAGES:
                res.err(where, "independent practice carries no hints - the point "
                               "is that the learner is not helped towards the answer")

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
    if (ctype == "project" or ch.get("capstone")) and not is_last_floor:
        res.warn(where, "capstones belong on the boss floor")

    return cid, ctype


def check_curriculum(fl, where, res, level):
    """Standard sections 3, 9, 13: a floor states its aim and its footing.

    `level` is the dungeon's declared curriculum version. Below 4 these are
    warnings, so an unmigrated dungeon still ships; at 4 they are errors.
    """
    say = res.err if level >= 4 else res.warn

    goal = str(fl.get("goal", "")).strip()
    if not goal:
        say(where, "no `goal` - a floor must state the capability it confers")
    elif GOAL_NOT_A_CAPABILITY.match(goal):
        say(where, "`goal` reads as a topic label, not a capability: %r. "
                   "Begin with a verb - what can the learner now DO?" % goal[:60])

    stage = fl.get("stage")
    if stage is None:
        say(where, "no `stage` - see content/_CURRICULUM.md section 2")
    elif stage not in STAGES:
        res.err(where, "stage %r is not 0-6" % stage)

    desc = fl.get("description")
    if not isinstance(desc, dict):
        say(where, "no `description` - the learner brief (what, why, enables, "
                   "assumes, assessed)")
    else:
        missing = [k for k in DESCRIPTION_KEYS if not str(desc.get(k, "")).strip()]
        if missing:
            say(where, "`description` missing: %s" % ", ".join(missing))

    # floor 1 of a dungeon rests on the dungeon's own prerequisites
    if fl.get("n") != 1 and level >= 4 and not fl.get("requires"):
        res.warn(where, "no `requires` - what must be true before this floor?")


def check_floor(fl, i, total, dungeon_id, discipline, res, curriculum=3):
    n = fl.get("n")
    where = "%s floor %s" % (dungeon_id, n)
    is_last = (i == total - 1)

    if n != i + 1:
        res.err(where, "`n` is %r but it sits at position %d" % (n, i + 1))
    if not fl.get("name"):
        res.warn(where, "no floor name")

    level = fl.get("cognitiveLevel")
    expected = band_for(i + 1, total, fl.get("stage"))
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

    check_curriculum(fl, where, res, curriculum)

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
            # Standard 4 and 12: naming the technique turns "recognise that
            # this applies" into "apply this", which is a different and much
            # weaker skill.
            if stage in NO_TECHNIQUE_STAGES or is_last:
                m = TECHNIQUE_NAMED.search(str(ch.get("prompt", "")))
                if m:
                    res.err("%s %s[%d]" % (where, stage, ci),
                            "names the technique (%r) in a stage that must not - "
                            "the learner has to recognise it themselves" % m.group(0))
            if cid in seen:
                res.err("%s %s[%d]" % (where, stage, ci), "duplicate challenge id %r" % cid)
            seen.add(cid)
            if ctype:
                types_seen.append(ctype)
            if ch.get("layer") == "application":
                app_layer_ids.append(cid)
            for c in (ch.get("concepts") or ch.get("tags") or []):
                tagged.setdefault(c, []).append(ctype)

    # Every dungeon ends on a capstone: one un-scaffolded, whole-dungeon
    # application. `project` is the capstone where a project is legal; a
    # mathematics or theory dungeon marks its final proof or problem with
    # `capstone: true` instead. Both mean the same thing to the runner.
    capstones = [
        ch for stage in sequence if stage != "lesson"
        for ch in (fl.get(stage) or [])
        if ch.get("type") == "project" or ch.get("capstone") is True]
    has_project = bool(capstones)
    for ch in capstones:
        cw = "%s capstone %r" % (where, ch.get("id"))
        if ch.get("layer") != "application":
            res.err(cw, "a capstone is Application layer by definition")
        if ch.get("type") not in APPLICATION_TYPES:
            res.err(cw, "type %r cannot carry a capstone" % ch.get("type"))
    if len(capstones) > 1 and is_last:
        res.warn(where, "%d capstones - the boss floor should have one" % len(capstones))

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
        res.err(where, "the last floor is the boss and needs a capstone - a "
                       "`project`, or a challenge marked `capstone: true`")

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
    curriculum = d.get("curriculum", 3)
    rows = [check_floor(fl, i, total, d.get("id", name), discipline, res, curriculum)
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
