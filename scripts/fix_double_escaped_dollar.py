#!/usr/bin/env python3
"""Repair dollars that ended up double-escaped.

A literal dollar in prose is written \\$ . Somewhere between the OpenStax
import and the prose repair pass a few of them became \\\\$ - an escaped
backslash followed by a live $ . That live $ flips maths parity for the rest
of the body, so one bad character silently swallows a paragraph and dumps raw
LaTeX on the page for the rest of the section.

Two different mistakes wear the same disguise, and which repair is correct
depends on where the character sits:

    prose        \\\\$1.37          currency  -> \\$1.37
    closing $    ...0.05t}.\\\\$    delimiter -> ...0.05t}.$

So walk the body with the same little state machine the renderer uses and ask
what state we are in when we reach the dollar. Inside a maths span it can only
be the delimiter; outside it can only be currency.

    python scripts/fix_double_escaped_dollar.py           # report only
    python scripts/fix_double_escaped_dollar.py --write
"""
import glob
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")

# In the decoded string: backslash, backslash, dollar - and not the tail of a
# longer run of backslashes, which would be something else entirely.
BAD = re.compile(r"(?<!\\)\\\\\$")


def state_at(text, pos):
    """out | inline | display | code, at character offset `pos`."""
    i, state = 0, "out"
    while i < pos and i < len(text):
        c = text[i]
        # an escaped non-letter is literal - and \\ is a literal backslash,
        # so it must be consumed as a pair or it shields the dollar after it
        if c == "\\" and i + 1 < len(text) and not text[i + 1].isalpha():
            i += 2
            continue
        if state == "out":
            if c == "`":
                state = "code"
            elif c == "$":
                if text.startswith("$$", i):
                    state = "display"
                    i += 2
                    continue
                state = "inline"
        elif state == "code":
            if c == "`":
                state = "out"
        elif state == "display":
            if text.startswith("$$", i):
                state = "out"
                i += 2
                continue
        elif state == "inline":
            if c == "$" or c == "\n":
                state = "out"
        i += 1
    return state


def repair(text):
    """Return (fixed, [(kind, context), ...])."""
    notes = []
    out, last = [], 0
    for m in BAD.finditer(text):
        # `state_at` walks the ORIGINAL text; the two forms are the same
        # length up to this point only if we have not rewritten earlier, so
        # measure against the original and splice as we go.
        st = state_at(text, m.start())
        if st in ("inline", "display"):
            kind, rep = "delimiter", "$"
        elif st == "code":
            continue
        else:
            kind, rep = "currency", "\\$"
        notes.append((kind, text[max(0, m.start() - 58):m.start() + 34]))
        out.append(text[last:m.start()])
        out.append(rep)
        last = m.end()
    out.append(text[last:])
    return "".join(out), notes


def walk(node, path, found):
    if isinstance(node, str):
        fixed, notes = repair(node)
        for kind, ctx in notes:
            found.append((path, kind, ctx))
        return fixed, len(notes)
    if isinstance(node, list):
        total = 0
        for i, v in enumerate(node):
            node[i], n = walk(v, "%s[%d]" % (path, i), found)
            total += n
        return node, total
    if isinstance(node, dict):
        total = 0
        for k, v in node.items():
            node[k], n = walk(v, "%s.%s" % (path, k), found)
            total += n
        return node, total
    return node, 0


def main():
    write = "--write" in sys.argv
    grand = 0
    for path in sorted(glob.glob(os.path.join(CONTENT, "*.json"))):
        name = os.path.basename(path)
        if name.startswith("_") or name == "index.json":
            continue
        d = json.load(io.open(path, encoding="utf-8"))
        found = []
        d, n = walk(d, name[:-5], found)
        if not n:
            continue
        grand += n
        print("%-26s %d repair(s)" % (name, n))
        for where, kind, ctx in found:
            print("   %-9s %s" % (kind, where))
            print("      ...%s..." % ctx.replace("\n", " "))
        if write:
            with io.open(path, "w", encoding="utf-8") as fh:
                json.dump(d, fh, ensure_ascii=False, indent=1)
                fh.write("\n")

    if not grand:
        print("no double-escaped dollars")
    elif write:
        print("\n%d repaired" % grand)
    else:
        print("\n%d found - rerun with --write to repair" % grand)
    return 0


if __name__ == "__main__":
    sys.exit(main())
