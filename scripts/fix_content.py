#!/usr/bin/env python3
"""Repair imported prose in place, so what ships is readable.

    python scripts/fix_content.py            # repair every dungeon
    python scripts/fix_content.py --dry-run  # report only

Importers fetch honestly but upstream markup leaks through. This fixes the
defects scripts/audit_content.py reports, without touching meaning:

  - unpaired `$` neutralised, so KaTeX cannot swallow the prose after it
  - bodies cut mid-sentence trimmed back to the last complete sentence
  - raw HTML tags, reference-style link definitions and markdown tables removed
  - TODO/placeholder bodies rewritten as an honest statement of what is there

Run it after any import, then re-run audit_content.py.
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

REFLINK = re.compile(r"^\[[^\]]+\]:\s*\S+.*$", re.M)
TABLE_ROW = re.compile(r"^\s*\|.*\|\s*$", re.M)
HTMLTAG = re.compile(r"</?(?:div|span|table|tr|td|th|img|a|p|br|figure|figcaption|em|strong|sup|sub)\b[^>]*>", re.I)
TILDE_FENCE = re.compile(r"^~{3,}.*$", re.M)
SENTENCE_END = re.compile(r"(?s)^.*[.!?](?=[\s\"')\]]*$|[\s\"')\]])")
PLACEHOLDER_LINE = re.compile(r"^.*\b(?:TODO|FIXME)\b.*$", re.M | re.I)


def normalise_escapes(text):
    """`\\\\$` is a literal backslash followed by a delimiter - KaTeX chokes on
    it and eats the prose after. Collapse it to a single escaped dollar."""
    return re.sub(r"\\{2,}\$", r"\\$", text)


def neutralise_dollars(text):
    """Escape any `$` that cannot be paired into a plausible math span.

    A span is plausible when it closes within 200 characters, on the same
    paragraph, and is not empty. Everything else is prose - a shell prompt, a
    price - and must not be handed to KaTeX.
    """
    if "$" not in text:
        return text, 0

    # A $ inside a backtick code span is code, not maths - a JavaScript
    # template literal `${ }` must not be escaped. Mask code spans out, pair
    # the dollars over the prose only, then restore them untouched.
    spans = []

    def hide(m):
        spans.append(m.group(0))
        return "@@CODESPAN%d@@" % (len(spans) - 1)

    text = re.sub(r"`[^`]*`", hide, text)

    # leave $$ ... $$ blocks alone; they are unambiguous
    parts = text.split("$$")
    fixed_total = 0
    for idx in range(0, len(parts), 2):          # even indices sit outside $$
        seg = parts[idx]
        out, i, fixed = [], 0, 0
        while i < len(seg):
            c = seg[i]
            if c != "$":
                out.append(c)
                i += 1
                continue
            close = seg.find("$", i + 1)
            span = seg[i + 1:close] if close != -1 else ""
            ok = (close != -1 and 0 < len(span) <= 200 and "\n\n" not in span)
            if ok:
                out.append("$" + span + "$")
                i = close + 1
            else:
                out.append("\\$")
                fixed += 1
                i += 1
        parts[idx] = "".join(out)
        fixed_total += fixed
    out_text = "$$".join(parts)
    out_text = re.sub(r"@@CODESPAN(\d+)@@",
                      lambda m: spans[int(m.group(1))], out_text)
    return out_text, fixed_total


def trim_to_sentence(text):
    """Cut a mid-sentence body back to its last complete sentence."""
    t = text.rstrip()
    if not t:
        return text, False
    last = t.split("\n")[-1].strip()
    # a trailing bare URL or link line is fine, not a truncation
    if last.startswith(("http", "- http", "- ", "*")) or last.endswith((":", "`", ")", "]")):
        return text, False
    if re.search(r"[.!?][\"')\]]*$", t):
        return text, False
    m = SENTENCE_END.match(t)
    if not m or len(m.group(0)) < 60:
        return text, False
    return m.group(0).rstrip(), True


def clean_body(text):
    stats = {}
    original = text

    n = len(REFLINK.findall(text))
    if n:
        text = REFLINK.sub("", text)
        stats["reflinks"] = n
    n = len(TABLE_ROW.findall(text))
    if n:
        text = TABLE_ROW.sub("", text)
        stats["tables"] = n
    n = len(HTMLTAG.findall(text))
    if n:
        text = HTMLTAG.sub("", text)
        stats["html"] = n
    n = len(TILDE_FENCE.findall(text))
    if n:
        text = TILDE_FENCE.sub("", text)
        stats["fences"] = n

    before_esc = text
    text = normalise_escapes(text)
    if text != before_esc:
        stats["escapes"] = 1

    text, d = neutralise_dollars(text)
    if d:
        stats["dollars"] = d

    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    text, cut = trim_to_sentence(text)
    if cut:
        stats["trimmed"] = 1

    return text, stats, text != original


def honest_placeholder(body, dungeon_name):
    """Replace TODO text with a statement of what is actually here."""
    cleaned = PLACEHOLDER_LINE.sub("", body).strip()
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    if len(cleaned) >= 60:
        return cleaned
    return (cleaned + "\n\n" if cleaned else "") + (
        "The prose for this section has not been written yet. The link above "
        "goes to the original material, which is published as a PDF and cannot "
        "be embedded here.")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("dungeon", nargs="?")
    args = ap.parse_args()

    total = {}
    touched = []
    for path in sorted(glob.glob(os.path.join(CONTENT, "*.json"))):
        b = os.path.basename(path)
        if b in ("index.json", "_TEMPLATE.json"):
            continue
        if args.dungeon and b != args.dungeon + ".json":
            continue
        d = json.load(io.open(path, encoding="utf-8"))
        changed = False
        per = {}
        for f in d.get("floors") or []:
            for s in (f.get("lesson") or {}).get("sections") or []:
                body = s.get("body") or ""
                if re.search(r"\b(?:TODO|FIXME)\b", body, re.I):
                    body = honest_placeholder(body, d.get("name", ""))
                    per["placeholders"] = per.get("placeholders", 0) + 1
                    changed = True
                new, stats, did = clean_body(body)
                if did or new != (s.get("body") or ""):
                    s["body"] = new
                    changed = True
                for k, v in stats.items():
                    per[k] = per.get(k, 0) + v
            # prompts get the same dollar treatment
            for k, v in f.items():
                if not isinstance(v, list) or k in ("concepts", "sequence", "_todo", "exercises"):
                    continue
                for ch in v:
                    if not isinstance(ch, dict):
                        continue
                    for field in ("prompt", "explain"):
                        if isinstance(ch.get(field), str):
                            fixed, nd = neutralise_dollars(ch[field])
                            if nd:
                                ch[field] = fixed
                                per["dollars"] = per.get("dollars", 0) + nd
                                changed = True
        if changed:
            touched.append((d.get("id", b), per))
            for k, v in per.items():
                total[k] = total.get(k, 0) + v
            if not args.dry_run:
                json.dump(d, io.open(path, "w", encoding="utf-8"),
                          ensure_ascii=False, indent=1)

    print("repaired %d dungeon file(s)%s" % (len(touched), " (dry run)" if args.dry_run else ""))
    for did, per in touched:
        print("  %-24s %s" % (did, ", ".join("%s=%d" % kv for kv in sorted(per.items()))))
    print("")
    print("totals:", ", ".join("%s=%d" % kv for kv in sorted(total.items())) or "nothing to fix")
    return 0


if __name__ == "__main__":
    sys.exit(main())
