#!/usr/bin/env python3
"""Validate GRIMOIRE content files against _SCHEMA.md.

    python tools/validate_content.py            # all available dungeons
    python tools/validate_content.py python     # one dungeon

Exits non-zero if anything is wrong. Run before committing content.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")

CATEGORIES = {"Languages", "Web", "Theory", "Systems", "Specialisms"}
RUNTIMES = {"pyodide", "worker", "piston"}
KINDS = {"code", "bugfix", "predict", "mcq"}
EXPR_LANGS = {"python", "javascript"}

errors = []
warnings = []


def err(where, msg):
    errors.append("%s: %s" % (where, msg))


def warn(where, msg):
    warnings.append("%s: %s" % (where, msg))


def need(d, key, where, types=None):
    if key not in d:
        err(where, "missing required field '%s'" % key)
        return None
    if types and not isinstance(d[key], types):
        err(where, "'%s' must be %s, got %s" % (key, types, type(d[key]).__name__))
        return None
    return d[key]


def check_tests(ch, where, lang):
    tests = ch.get("tests")
    if not isinstance(tests, list) or not tests:
        err(where, "needs a non-empty 'tests' array")
        return
    for i, t in enumerate(tests):
        tw = "%s.tests[%d]" % (where, i)
        kind = t.get("kind")
        if kind not in ("expr", "stdout"):
            err(tw, "test kind must be 'expr' or 'stdout', got %r" % kind)
            continue
        if kind == "expr":
            if lang not in EXPR_LANGS:
                err(tw, "expr tests are unsupported for lang '%s' — use stdout tests" % lang)
            if not t.get("call"):
                err(tw, "expr test needs 'call'")
            if "expect" not in t:
                err(tw, "expr test needs 'expect' (a JSON value)")
        else:
            if not isinstance(t.get("expect"), str):
                err(tw, "stdout test 'expect' must be a string")
            if "stdin" in t and not isinstance(t["stdin"], list):
                err(tw, "'stdin' must be an array of lines")
    # A single fully-deterministic stdout check IS the whole spec for a
    # print-exact task. Only nag when varied inputs could have been covered.
    if len(tests) == 1:
        t = tests[0]
        if t.get("kind") == "expr" or t.get("stdin"):
            warn(where, "only 1 test - aim for 3-4 including an edge case")


def check_challenge(ch, where, default_lang, phase):
    cid = need(ch, "id", where, str)
    kind = need(ch, "kind", where, str)
    need(ch, "prompt", where, str)
    if kind is not None and kind not in KINDS:
        err(where, "unknown kind %r (expected one of %s)" % (kind, sorted(KINDS)))
        return cid
    lang = ch.get("lang", default_lang)

    if kind in ("code", "bugfix"):
        if "starter" not in ch:
            err(where, "'%s' needs a 'starter' field (may be an empty string)" % kind)
        check_tests(ch, where, lang)
        if not ch.get("solution"):
            warn(where, "no 'solution' — learners see nothing after passing")
    elif kind == "predict":
        if not ch.get("code"):
            err(where, "predict needs 'code' to execute")
        if not isinstance(ch.get("expect"), str):
            err(where, "predict 'expect' must be a string of the expected output")
    elif kind == "mcq":
        choices = need(ch, "choices", where, list)
        ans = ch.get("answer")
        if choices is not None:
            if len(choices) < 2:
                err(where, "mcq needs at least 2 choices")
            if not isinstance(ans, int) or not (0 <= ans < len(choices)):
                err(where, "mcq 'answer' must be a 0-based index into choices (got %r)" % ans)
        if not ch.get("explain"):
            warn(where, "mcq has no 'explain'")
    return cid


def check_floor(fl, where, default_lang):
    n = need(fl, "n", where, int)
    need(fl, "title", where, str)
    if not fl.get("goal"):
        warn(where, "no 'goal' statement")

    lesson = need(fl, "lesson", where, dict)
    if lesson is not None:
        need(lesson, "title", where + ".lesson", str)
        secs = need(lesson, "sections", where + ".lesson", list)
        if secs is not None:
            if not (2 <= len(secs) <= 4):
                err(where + ".lesson", "must have 2-4 sections, has %d" % len(secs))
            for i, s in enumerate(secs):
                sw = "%s.lesson.sections[%d]" % (where, i)
                need(s, "title", sw, str)
                need(s, "body", sw, str)
                code = need(s, "code", sw, str)
                if code is not None:
                    lines = code.split("\n")
                    for a in s.get("annotations", []):
                        ln = a.get("line")
                        if not isinstance(ln, int) or not (1 <= ln <= len(lines)):
                            err(sw, "annotation line %r out of range (code has %d lines)" % (ln, len(lines)))
                        if not a.get("text"):
                            err(sw, "annotation on line %r has no text" % ln)

    for phase, lo, hi in (("practice", 6, 10), ("exam", 8, 12)):
        arr = need(fl, phase, where, list)
        if arr is None:
            continue
        if not (lo <= len(arr) <= hi):
            err("%s.%s" % (where, phase), "must have %d-%d challenges, has %d" % (lo, hi, len(arr)))
        seen = set()
        for i, ch in enumerate(arr):
            cid = check_challenge(ch, "%s.%s[%d]" % (where, phase, i), default_lang, phase)
            if cid in seen:
                err("%s.%s[%d]" % (where, phase, i), "duplicate challenge id %r" % cid)
            seen.add(cid)
    return n


def check_dungeon(path):
    name = os.path.basename(path)
    try:
        d = json.load(open(path, encoding="utf-8"))
    except Exception as e:
        err(name, "invalid JSON — %s" % e)
        return
    need(d, "id", name, str)
    need(d, "name", name, str)
    lang = need(d, "lang", name, str) or "python"
    rt = d.get("runtime")
    if rt not in RUNTIMES:
        err(name, "runtime must be one of %s, got %r" % (sorted(RUNTIMES), rt))
    floors = need(d, "floors", name, list)
    if not floors:
        err(name, "no floors")
        return
    for i, fl in enumerate(floors):
        n = check_floor(fl, "%s floor[%d]" % (name, i), lang)
        if n is not None and n != i + 1:
            err("%s floor[%d]" % (name, i), "'n' is %d but it sits at position %d" % (n, i + 1))
    print("  %-16s %d floors, %d practice, %d exam" % (
        d.get("id"), len(floors),
        sum(len(f.get("practice", [])) for f in floors),
        sum(len(f.get("exam", [])) for f in floors)))


def main():
    idx_path = os.path.join(CONTENT, "index.json")
    if not os.path.exists(idx_path):
        print("FATAL: content/index.json not found")
        return 2
    idx = json.load(open(idx_path, encoding="utf-8"))
    dungeons = idx.get("dungeons", [])
    seen = set()
    for e in dungeons:
        w = "index.json:%s" % e.get("id")
        for k in ("id", "name", "category", "lang", "runtime", "status"):
            need(e, k, w, str)
        if e.get("category") not in CATEGORIES:
            err(w, "unknown category %r" % e.get("category"))
        if e.get("runtime") not in RUNTIMES:
            err(w, "unknown runtime %r" % e.get("runtime"))
        if e.get("status") not in ("available", "planned"):
            err(w, "status must be 'available' or 'planned'")
        if e.get("id") in seen:
            err(w, "duplicate dungeon id")
        seen.add(e.get("id"))

    only = sys.argv[1] if len(sys.argv) > 1 else None
    targets = [e for e in dungeons if e.get("status") == "available"]
    if only:
        targets = [e for e in dungeons if e.get("id") == only]
        if not targets:
            print("no dungeon with id %r in index.json" % only)
            return 2

    print("checking %d dungeon file(s):" % len(targets))
    for e in targets:
        p = os.path.join(CONTENT, e["id"] + ".json")
        if not os.path.exists(p):
            err("index.json:%s" % e["id"], "status is 'available' but %s is missing" % p)
            continue
        check_dungeon(p)

    print("")
    for w in warnings:
        print("  warn  " + w)
    if errors:
        for e in errors:
            print("  ERROR " + e)
        print("\n%d error(s), %d warning(s)" % (len(errors), len(warnings)))
        return 1
    print("OK - %d error(s), %d warning(s)" % (0, len(warnings)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
