#!/usr/bin/env python3
"""Find markdown the runner's md() cannot render.

md() in index.html is a deliberately small subset: paragraphs, hard line
breaks, bullet lists, **bold**, `code spans`, {{link:id}} and maths. Anything
else an author reaches for - a fenced ``` block, a # heading, a --- rule, a
[link](url), a numbered list, *italics* - is passed through as literal text
and shows up on the page as punctuation soup.

Nothing fails the schema for this, which is exactly why it needs its own
check: the content is valid and merely renders wrong.

    python scripts/check_markdown.py                # every dungeon
    python scripts/check_markdown.py operating-systems
"""
import glob
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")

# fields md() actually renders; `code` and `template` are shown verbatim
PROSE_FIELDS = ("body", "prompt", "explain", "intro", "text", "label")

# Constructs that render as visible punctuation soup - real defects.
BROKEN = [
    ("fenced code block", re.compile(r"```")),
    ("ATX heading", re.compile(r"(?m)^#{1,6}\s")),
    ("horizontal rule", re.compile(r"(?m)^\s*(?:---+|\*\*\*+|___+)\s*$")),
    ("markdown link", re.compile(r"\[[^\]]+\]\([^)]+\)")),
    ("blockquote", re.compile(r"(?m)^\s*>\s")),
    # Key on the delimiter row, not on pipes. Pipes alone are almost always
    # maths - |S|, |P(A)|, "2|E|" - and counting them flagged perfectly good
    # cardinality notation twice before I keyed on this instead.
    ("markdown table", re.compile(r"(?m)^\s*\|?\s*:?-{3,}:?\s*\|")),
    ("HTML tag", re.compile(r"</?(?:div|span|p|br|ul|li|table|tr|td|b|i|em|strong|h[1-6])\b")),
]

# Renders legibly, just not as a styled list: md() turns newlines into breaks,
# so each item still lands on its own line. Reported, not treated as a defect.
COSMETIC = [
    ("ordered list", re.compile(r"(?m)^\s*\d+\.\s")),
]

UNSUPPORTED = BROKEN + COSMETIC
BROKEN_LABELS = {label for label, _ in BROKEN}


def walk(node, path, hits):
    if isinstance(node, dict):
        for k, v in node.items():
            if isinstance(v, str) and k in PROSE_FIELDS:
                for label, rx in UNSUPPORTED:
                    m = rx.search(v)
                    if m:
                        line = v[:m.start()].count("\n") + 1
                        snippet = v[max(0, m.start() - 30):m.start() + 50].replace("\n", " ")
                        hits.append((f"{path}.{k}", label, line, snippet))
            else:
                walk(v, f"{path}.{k}", hits)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            walk(v, f"{path}[{i}]", hits)


def targets(args):
    """Dungeon names, or paths to floor fragments.

    Authors work on a fragment long before it is assembled, so scanning only
    content/*.json means the check cannot see the floor being written - which
    is precisely when it is worth running. Accept either.
    """
    paths, names = [], []
    for a in args:
        if a.endswith(".json") or os.sep in a or "/" in a:
            paths.extend(sorted(glob.glob(a)))
        else:
            names.append(a)
    if paths:
        return paths
    for p in sorted(glob.glob(os.path.join(CONTENT, "*.json"))):
        base = os.path.basename(p)[:-5]
        if base.startswith("_") or base == "index":
            continue
        if names and base not in names:
            continue
        paths.append(p)
    return paths


def main():
    total = 0
    cosmetic = 0
    for p in targets(sys.argv[1:]):
        name = os.path.basename(p)[:-5]
        if name.endswith("-meta"):
            continue
        try:
            d = json.load(io.open(p, encoding="utf-8"))
        except ValueError:
            continue
        hits = []
        # a whole dungeon has "floors"; a fragment IS one floor
        walk(d.get("floors", d), name, hits)
        if not hits:
            continue
        hits.sort(key=lambda h: (h[1] not in BROKEN_LABELS, h[1]))
        real = [h for h in hits if h[1] in BROKEN_LABELS]
        total += len(real)
        cosmetic += len(hits) - len(real)
        print("%s: %d defect(s), %d cosmetic" % (name, len(real), len(hits) - len(real)))
        seen = {}
        for where, label, line, snippet in hits:
            seen.setdefault(label, 0)
            seen[label] += 1
            if seen[label] <= 3:
                print("   %-18s %s (line %d)" % (label, where, line))
                print("      ...%s..." % snippet.strip())
        for label, n in seen.items():
            if n > 3:
                print("   %-18s ...and %d more" % (label, n - 3))
        print()

    print("%d construct(s) md() renders as literal punctuation, %d cosmetic"
          % (total, cosmetic))
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
