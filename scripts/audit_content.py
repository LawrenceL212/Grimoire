#!/usr/bin/env python3
"""Audit every dungeon content file for the defects that survive import.

    python scripts/audit_content.py

Checks what validate_content.py cannot: whether the imported prose is actually
readable. Structure is the validator's job; this is about the text.
"""
import glob
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")

# A body cut mid-sentence: ends without terminal punctuation, and not on a
# bullet, colon, code span or link.
TRUNCATED = re.compile(r"[A-Za-z,;]\s*$")
HEADING = re.compile(r"^#{1,6}\s", re.M)
TABLE = re.compile(r"^\s*\|", re.M)
REFLINK = re.compile(r"^\[[^\]]+\]:\s*\S+", re.M)
HTMLTAG = re.compile(r"<(?:div|span|table|img|a|p|br|figure)\b", re.I)
RST = re.compile(r"::\s*$|\.\.\s+\w+::|:ref:`|\|_\|")
PLACEHOLDER = re.compile(r"\b(?:TODO|FIXME|lorem ipsum|placeholder)\b", re.I)


def audit(path):
    name = os.path.basename(path)
    try:
        d = json.load(io.open(path, encoding="utf-8"))
    except Exception as e:
        return {"file": name, "fatal": "invalid JSON: %s" % e}

    floors = d.get("floors") or []
    r = {
        "file": name, "id": d.get("id"), "floors": len(floors),
        "sections": 0, "challenges": 0, "no_code": 0, "empty_body": 0,
        "truncated": 0, "heading": 0, "table": 0, "reflink": 0, "html": 0,
        "rst": 0, "placeholder": 0, "math_spans": 0, "math_unbalanced": 0,
        "short_body": 0, "examples": [],
    }
    for f in floors:
        secs = (f.get("lesson") or {}).get("sections") or []
        r["sections"] += len(secs)
        for k, v in f.items():
            if k in ("concepts", "sequence", "_todo", "exercises") or not isinstance(v, list):
                continue
            r["challenges"] += sum(1 for x in v if isinstance(x, dict)
                                   and ("prompt" in x or "type" in x))
        for s in secs:
            body = (s.get("body") or "").strip()
            if not body:
                r["empty_body"] += 1
                continue
            if len(body) < 40:
                r["short_body"] += 1
            if not (s.get("code") or "").strip():
                r["no_code"] += 1
            if HEADING.search(body):
                r["heading"] += 1
            if TABLE.search(body):
                r["table"] += 1
            if REFLINK.search(body):
                r["reflink"] += 1
            if HTMLTAG.search(body):
                r["html"] += 1
            if RST.search(body):
                r["rst"] += 1
            if PLACEHOLDER.search(body):
                r["placeholder"] += 1

            # an escaped \$ is prose, not a delimiter
            live = re.sub(r"`[^`]*`", "", body)
            live = re.sub(r"\\\\\$", "", live)
            n_dollar = live.count("$") - 2 * live.count("$$")
            r["math_spans"] += live.count("$$") // 2 + max(0, n_dollar) // 2
            if live.count("$") % 2:
                r["math_unbalanced"] += 1

            # a body that ends on a link, a URL or a bullet is finished, not cut
            tail = body.rstrip()
            last_line = tail.split(chr(10))[-1].strip()
            ends_on_link = ("http://" in last_line or "https://" in last_line
                            or last_line.startswith(("- ", "* ", ">")))
            if (tail and TRUNCATED.search(tail) and not ends_on_link
                    and not tail.endswith(("`", ":", ")", "]", "…"))):
                r["truncated"] += 1
                if len(r["examples"]) < 2:
                    r["examples"].append("%s :: ...%s" % (s.get("title", "?"), tail[-70:]))
    return r


def main():
    rows = []
    for p in sorted(glob.glob(os.path.join(CONTENT, "*.json"))):
        b = os.path.basename(p)
        if b in ("index.json", "_TEMPLATE.json"):
            continue
        rows.append(audit(p))

    hdr = ("%-24s %4s %5s %5s %6s %5s %5s %5s %5s %5s %5s %5s"
           % ("dungeon", "flr", "sect", "chal", "nocode", "empty", "trunc",
              "head", "tbl", "html", "rst", "math"))
    print(hdr)
    print("-" * len(hdr))
    bad = []
    for r in rows:
        if r.get("fatal"):
            print("%-24s  FATAL %s" % (r["file"], r["fatal"]))
            bad.append(r["file"])
            continue
        print("%-24s %4d %5d %5d %6d %5d %5d %5d %5d %5d %5d %5d"
              % (r["id"] or r["file"], r["floors"], r["sections"], r["challenges"],
                 r["no_code"], r["empty_body"], r["truncated"], r["heading"],
                 r["table"], r["html"], r["rst"], r["math_spans"]))
        if r["floors"] == 0 or r["sections"] == 0:
            bad.append("%s: no floors or no sections - would show an empty dungeon" % r["id"])
        for k, why in (("heading", "raw markdown headings"), ("table", "markdown tables"),
                       ("reflink", "reference-style links"), ("html", "raw HTML"),
                       ("rst", "unconverted RST"), ("placeholder", "TODO/placeholder text"),
                       ("empty_body", "empty lesson bodies"),
                       ("math_unbalanced", "unbalanced $ delimiters")):
            if r[k]:
                bad.append("%s: %d sections with %s" % (r["id"], r[k], why))
        if r["truncated"]:
            bad.append("%s: %d bodies cut mid-sentence  e.g. %s"
                       % (r["id"], r["truncated"], (r["examples"] or ["-"])[0]))

    print("")
    if bad:
        print("PROBLEMS (%d):" % len(bad))
        for x in bad:
            print("  -", x)
    else:
        print("No prose defects found.")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
