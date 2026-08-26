#!/usr/bin/env python3
r"""Rewrite markdown the runner cannot render into markdown it can.

md() supports paragraphs, hard breaks, bullets, **bold**, `code spans` and
maths - and nothing else. A fenced block therefore shows its ``` fences on the
page and loses its formatting, and a --- rule shows as three hyphens.

    ```
    8                          `8`
   / \          becomes        `/ \`
  3   10                       `3   10`
    ```

Each line becomes its own code span, with the leading spaces held open by
non-breaking spaces so the shape survives HTML whitespace collapsing. A fence
tagged with an Exercism directive - ```exercism/note - is prose, not code, and
becomes a bold note instead.

    python scripts/fix_markdown.py            # report
    python scripts/fix_markdown.py --write
"""
import glob
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")
PROSE_FIELDS = ("body", "prompt", "explain", "intro", "text", "label")

FENCE = re.compile(r"```([^\n`]*)\n(.*?)```", re.S)
RULE = re.compile(r"(?m)^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$")
NBSP = " "


def code_span(line):
    """One backticked line, indentation preserved against HTML collapsing."""
    stripped = line.rstrip()
    if not stripped:
        return ""
    lead = len(stripped) - len(stripped.lstrip(" "))
    return "`" + NBSP * lead + stripped.lstrip(" ").replace("`", "'") + "`"


def unfence(m):
    tag = (m.group(1) or "").strip()
    inner = m.group(2)
    # an Exercism directive fence carries prose, not code
    if tag.startswith("exercism/"):
        label = tag.split("/", 1)[1].replace("-", " ").strip().title()
        body = " ".join(x.strip() for x in inner.strip().splitlines() if x.strip())
        return "**%s.** %s" % (label, body)
    lines = [code_span(x) for x in inner.strip("\n").splitlines()]
    return "\n".join(x for x in lines if x != "") or ""


ORPHAN_FENCE = re.compile(r"(?m)^[ \t]*```[^\n]*$")


def repair(text):
    before = text
    text = FENCE.sub(unfence, text)
    # An unpaired fence is an import artifact - a closer whose opener was lost
    # when the source was scraped. It has no block to delimit, so it is just a
    # row of backticks sitting in the prose.
    text = ORPHAN_FENCE.sub("", text)
    # a rule between paragraphs is decoration the renderer cannot draw
    text = RULE.sub("", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text, text != before


def walk(node, hits):
    if isinstance(node, dict):
        for k, v in list(node.items()):
            if isinstance(v, str) and k in PROSE_FIELDS:
                fixed, changed = repair(v)
                if changed:
                    node[k] = fixed
                    hits.append(k)
            else:
                walk(v, hits)
    elif isinstance(node, list):
        for v in node:
            walk(v, hits)


def main():
    write = "--write" in sys.argv
    names = [a for a in sys.argv[1:] if not a.startswith("--")]
    total = 0
    for path in sorted(glob.glob(os.path.join(CONTENT, "*.json"))):
        name = os.path.basename(path)[:-5]
        if name.startswith("_") or name == "index":
            continue
        if names and name not in names:
            continue
        try:
            d = json.load(io.open(path, encoding="utf-8"))
        except ValueError:
            continue
        hits = []
        walk(d.get("floors", []), hits)
        if not hits:
            continue
        total += len(hits)
        print("%-24s %d field(s) repaired" % (name, len(hits)))
        if write:
            with io.open(path, "w", encoding="utf-8") as fh:
                json.dump(d, fh, ensure_ascii=False, indent=1)
                fh.write("\n")

    if not total:
        print("nothing to repair")
    elif write:
        print("\n%d field(s) rewritten" % total)
    else:
        print("\n%d field(s) would be rewritten - rerun with --write" % total)
    return 0


if __name__ == "__main__":
    sys.exit(main())
