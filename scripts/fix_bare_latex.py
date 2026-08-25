#!/usr/bin/env python3
"""Wrap LaTeX that was imported without math delimiters.

    python scripts/fix_bare_latex.py --dry-run
    python scripts/fix_bare_latex.py --report     # show every run in context

The OpenStax importer re-encodes presentation MathML as LaTeX, but in places it
emitted commands with no surrounding $, so they reach the reader as raw source.

Finding them safely is the whole problem. Regex span-matching is not good
enough: `$\\text{\\$}2500$` contains an escaped dollar, and a body may hold an
odd number of backticks. Either mistake makes the tool wrap maths that was
already correct. So this walks the text as a state machine instead - outside,
inline maths, display maths, code span - and only ever touches commands seen
while genuinely outside all three.
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

# Two letters or more. A lone backslash-t or backslash-n in prose is a C-style
# escape, not LaTeX, and wrapping those in $ would corrupt perfectly good text.
CMD = re.compile(r"\\[a-zA-Z]{2,}")


def scan(text):
    """Yield (start, end) of every region that is NOT protected maths or code."""
    out = []
    i, n = 0, len(text)
    start = 0
    state = "out"           # out | inline | display | code
    while i < n:
        c = text[i]
        if c == "\\" and i + 1 < n and not text[i + 1].isalpha():
            i += 2                      # an escaped character, never a delimiter
            continue
        if state == "out":
            if c == "`":
                out.append((start, i)); state = "code"; i += 1; continue
            if c == "$":
                out.append((start, i))
                if text.startswith("$$", i):
                    state = "display"; i += 2
                else:
                    state = "inline"; i += 1
                continue
            i += 1
            continue
        if state == "code":
            if c == "`":
                state = "out"; i += 1; start = i; continue
            i += 1
            continue
        if state == "display":
            if text.startswith("$$", i):
                state = "out"; i += 2; start = i; continue
            i += 1
            continue
        if state == "inline":
            if c == "$":
                state = "out"; i += 1; start = i; continue
            if c == "\n":               # an inline span never spans a blank line
                state = "out"; start = i; continue
            i += 1
            continue
    if state == "out":
        out.append((start, n))
    return out


def grow(text, start, limit):
    """End index of the maths run beginning at `start`, bounded by `limit`."""
    i, n = start, min(len(text), limit)
    while i < n:
        c = text[i]
        if c == "\\":
            m = CMD.match(text, i)
            if not m:
                break
            i = m.end()
            continue
        if c == "{":
            depth, j = 0, i
            while j < n:
                if text[j] == "{":
                    depth += 1
                elif text[j] == "}":
                    depth -= 1
                    if depth == 0:
                        j += 1
                        break
                j += 1
            if depth != 0:
                break
            i = j
            continue
        if c in "^_":
            i += 1
            if i < n and text[i] == "{":
                continue
            if i < n:
                i += 1
            continue
        if c.isdigit() or c in "+-*/=<>(),.|'":
            i += 1
            continue
        if c == " ":
            j = i
            while j < n and text[j] == " ":
                j += 1
            if j < n and (text[j] == "\\" or text[j] == "{" or text[j].isdigit()):
                i = j
                continue
            break
        break
    return i


def wrap(text, collect=None):
    regions = scan(text)
    edits = []
    for a, b in regions:
        i = a
        while i < b:
            if text[i] == "\\":
                m = CMD.match(text, i)
                if m:
                    end = grow(text, i, b)
                    run = text[i:end].rstrip()
                    if run and CMD.search(run):
                        edits.append((i, i + len(run), run))
                        i = i + len(run)
                        continue
            i += 1
    if not edits:
        return text, 0
    out, prev = [], 0
    for a, b, run in edits:
        out.append(text[prev:a])
        out.append("$" + run + "$")
        if collect is not None:
            collect.append((run, text[max(0, a - 50):b + 50].replace("\n", " ")))
        prev = b
    out.append(text[prev:])
    return "".join(out), len(edits)


def walk_fields(d):
    for fl in d.get("floors") or []:
        for s in (fl.get("lesson") or {}).get("sections") or []:
            yield s, "body"
        for k, v in fl.items():
            if not isinstance(v, list) or k in ("concepts", "sequence", "_todo", "exercises"):
                continue
            for ch in v:
                if isinstance(ch, dict):
                    for field in ("prompt", "explain"):
                        if isinstance(ch.get(field), str):
                            yield ch, field


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--report", action="store_true")
    args = ap.parse_args()

    total, touched = 0, []
    for path in sorted(glob.glob(os.path.join(CONTENT, "*.json"))):
        b = os.path.basename(path)
        if b in ("index.json", "_TEMPLATE.json"):
            continue
        d = json.load(io.open(path, encoding="utf-8"))
        wrapped, samples = 0, []
        for holder, field in walk_fields(d):
            new, c = wrap(holder[field], samples if args.report else None)
            if c:
                holder[field] = new
                wrapped += c
        if wrapped:
            touched.append((d.get("id", b), wrapped))
            total += wrapped
            if args.report:
                print("=== %s ===" % d.get("id"))
                for run, ctx in samples[:6]:
                    print("   %-28s ...%s..." % (run[:28], ctx))
            if not (args.dry_run or args.report):
                json.dump(d, io.open(path, "w", encoding="utf-8"),
                          ensure_ascii=False, indent=1)

    print("wrapped %d bare LaTeX run(s)%s"
          % (total, " (dry run)" if (args.dry_run or args.report) else ""))
    for did, c in touched:
        print("  %-24s %d" % (did, c))
    if not touched:
        print("  nothing to wrap")
    return 0


if __name__ == "__main__":
    sys.exit(main())
