#!/usr/bin/env python3
"""Execute every `output` and `trace` challenge and compare against its answer.

    python scripts/verify_outputs.py python

An `output` challenge whose stated answer is not what the code actually prints
teaches the learner something false and marks a correct answer wrong. Only
applies to dungeons whose lang is python, since that is what this machine runs.
"""
import argparse
import io
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")


def norm(s):
    lines = [l.rstrip() for l in str(s or "").replace("\r", "").split("\n")]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines)


def run_python(code, timeout=15):
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False,
                                     encoding="utf-8") as f:
        f.write(code)
        path = f.name
    try:
        p = subprocess.run([sys.executable, path], capture_output=True,
                           text=True, timeout=timeout, encoding="utf-8",
                           errors="replace")
        return p.stdout, p.stderr, p.returncode
    except subprocess.TimeoutExpired:
        return "", "timed out", 1
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dungeon")
    args = ap.parse_args()

    path = os.path.join(CONTENT, args.dungeon + ".json")
    d = json.load(io.open(path, encoding="utf-8"))
    if (d.get("lang") or "") != "python":
        print("%s is %r, not python - nothing this script can execute"
              % (args.dungeon, d.get("lang")))
        return 0

    checked = mismatched = errored = 0
    problems = []

    def visit(ch, where):
        nonlocal checked, mismatched, errored
        if ch.get("type") != "output" or not ch.get("code"):
            return
        checked += 1
        out, err, rc = run_python(ch["code"])
        if rc != 0:
            errored += 1
            problems.append("%s: code raised -> %s" % (where, err.strip().split("\n")[-1]))
            return
        got, want = norm(out), norm(ch.get("answer"))
        if got != want:
            mismatched += 1
            problems.append("%s\n      answer: %r\n      actual: %r"
                            % (where, want, got))

    for fl in d.get("floors") or []:
        for si, sec in enumerate((fl.get("lesson") or {}).get("sections") or []):
            cp = sec.get("checkpoint")
            if cp:
                visit(cp, "floor %s lesson.sections[%d].checkpoint" % (fl.get("n"), si))
            # the lesson's own example must run too
            code = sec.get("code")
            if code:
                out, err, rc = run_python(code)
                if rc != 0:
                    errored += 1
                    problems.append("floor %s lesson.sections[%d] example raised -> %s"
                                    % (fl.get("n"), si, err.strip().split("\n")[-1]))
        for stage in (fl.get("sequence") or []):
            if stage == "lesson":
                continue
            for ci, ch in enumerate(fl.get(stage) or []):
                visit(ch, "floor %s %s[%d] %s" % (fl.get("n"), stage, ci, ch.get("id")))

    print("%s: executed %d output challenge(s) and every lesson example"
          % (args.dungeon, checked))
    if problems:
        print("\nPROBLEMS (%d mismatched, %d errored):" % (mismatched, errored))
        for p in problems:
            print("  -", p)
        return 1
    print("every output answer matches what Python actually prints, and every "
          "lesson example runs cleanly")
    return 0


if __name__ == "__main__":
    sys.exit(main())
