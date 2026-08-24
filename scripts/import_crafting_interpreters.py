#!/usr/bin/env python3
"""Build a link map of Crafting Interpreters as a Grimoire dungeon.

    python scripts/import_crafting_interpreters.py
    python scripts/import_crafting_interpreters.py --dry-run
    python scripts/import_crafting_interpreters.py --no-cache

craftinginterpreters.com is published under CC BY-NC-ND 4.0: NO DERIVATIVES.
Its prose therefore cannot be copied, excerpted, adapted or paraphrased into
Grimoire, and this importer does not try to. It fetches exactly one page --
contents.html -- and takes only the table of contents from it: part names,
chapter numbers, chapter titles, design-note titles and their URLs. Titles and
URLs are bibliographic data, the same thing a library catalogue records.

What lands in content/compilers.json is consequently a MAP, not a lesson:
every lesson section names one chapter, carries a one-line structural
description written here in this file (see CHAPTER_NOTE below -- it says which
stage of which interpreter the chapter builds, not what the chapter's prose
says), and prints the canonical URL so a learner reads the real thing on the
author's own site, where he is credited and paid.

Nothing is generated for practice or exam. Challenges for this dungeon must be
authored from scratch by a human; they cannot be derived from an ND source.
Every floor says so in its `_todo`.

Source: craftinginterpreters.com (CC BY-NC-ND 4.0), (c) Robert Nystrom.
See content/attribution.md.
"""
import argparse
import html
import io
import json
import os
import re
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "craftinginterpreters")
SITE = "https://craftinginterpreters.com/"
CONTENTS = SITE + "contents.html"

DUNGEON_ID = "compilers"
LICENCE = "CC BY-NC-ND 4.0"
SOURCE = "craftinginterpreters.com (CC BY-NC-ND 4.0)"
AUTHOR = "Robert Nystrom"

# The two implementations the book builds, used by the structural notes below.
JLOX = "jlox, the Java tree-walk interpreter"
CLOX = "clox, the C bytecode VM"

# ---------------------------------------------------------------------------
# One line per chapter, WRITTEN HERE, not taken from the book. Each says where
# the chapter sits in the build order and what artefact it produces -- the kind
# of thing a syllabus row says. None of it is drawn from the chapter's prose,
# because under CC BY-NC-ND we may not adapt that prose at all.
# ---------------------------------------------------------------------------
CHAPTER_NOTE = {
    "introduction":
        "Opening chapter: what the book builds, and how its two interpreters relate.",
    "a-map-of-the-territory":
        "Overview chapter: names the phases of a language implementation that the "
        "later chapters build one at a time.",
    "the-lox-language":
        "Specifies Lox, the language both interpreters in this book implement.",

    "scanning":
        "Part II, first stage: the hand-written scanner that turns Lox source text "
        "into tokens (%s)." % JLOX,
    "representing-code":
        "Part II: the syntax-tree classes the parser produces, and the visitor "
        "pattern used to walk them.",
    "parsing-expressions":
        "Part II, second stage: a recursive-descent parser for Lox's expression grammar.",
    "evaluating-expressions":
        "Part II, third stage: the tree-walking evaluator for expressions.",
    "statements-and-state":
        "Part II: statements, variable declarations, and the environment chain that "
        "holds them.",
    "control-flow":
        "Part II: if, while and for, added to both the parser and the evaluator.",
    "functions":
        "Part II: function declarations, calls, parameters, return values and closures.",
    "resolving-and-binding":
        "Part II: a static resolution pass run between parsing and evaluation to fix "
        "variable scope.",
    "classes":
        "Part II: class declarations, instances, fields, methods and `this`.",
    "inheritance":
        "Part II, final chapter: superclasses and `super` -- %s is complete here." % JLOX,

    "chunks-of-bytecode":
        "Part III, foundation: the bytecode chunk, its constant pool, and a "
        "disassembler for it (%s)." % CLOX,
    "a-virtual-machine":
        "Part III: the stack-based VM that executes a chunk instruction by instruction.",
    "scanning-on-demand":
        "Part III: clox's scanner, producing tokens on demand instead of all at once.",
    "compiling-expressions":
        "Part III: the single-pass Pratt parser that emits bytecode for expressions.",
    "types-of-values":
        "Part III: a tagged-union value representation covering numbers, booleans and nil.",
    "strings":
        "Part III: heap-allocated string objects, and who owns their memory.",
    "hash-tables":
        "Part III: the hash table implementation the VM uses for strings and variables.",
    "global-variables":
        "Part III: declaring, reading and assigning globals, in both compiler and VM.",
    "local-variables":
        "Part III: locals resolved to stack slots at compile time.",
    "jumping-back-and-forth":
        "Part III: jump instructions and backpatching, which give clox control flow.",
    "calls-and-functions":
        "Part III: function objects, call frames and the VM's call stack.",
    "closures":
        "Part III: upvalues and closure objects, so clox can capture enclosing locals.",
    "garbage-collection":
        "Part III: a mark-sweep collector for the VM's heap.",
    "classes-and-instances":
        "Part III: class objects, instances and field access.",
    "methods-and-initializers":
        "Part III: method definitions, bound methods and initializers.",
    "superclasses":
        "Part III: inheritance and `super` calls in the bytecode compiler and VM.",
    "optimization":
        "Part III, final chapter: benchmarking, then two optimizations to the "
        "finished VM.",

    "appendix-i":
        "Reference: the complete Lox grammar, collected in one place.",
    "appendix-ii":
        "Reference: the generated syntax-tree classes used by %s." % JLOX,
}

# Floor flavour, per part, in floor order. Tuned to the default grouping
# (--per-floor 4); any floor past the end of a pool gets a numbered fallback.
FLOOR_NAMES = {
    "welcome": ["The Cartographer's Threshold"],
    "a-tree-walk-interpreter": [
        "Hall of Raw Glyphs",
        "The Reckoning Chamber",
        "Vault of Bound Names",
    ],
    "a-bytecode-virtual-machine": [
        "The Bytecode Furnace",
        "Chamber of Compiled Forms",
        "The Warded Tables",
        "Depths of the Call Stack",
        "Sanctum of Instances",
    ],
    "backmatter": ["The Archivist's Appendices"],
}

TODO_PRACTICE = ("practice: empty on purpose. The source is CC BY-NC-ND, so no "
                 "exercise may be lifted or paraphrased from it -- every challenge "
                 "on this floor has to be authored from scratch.")
TODO_EXAM = ("exam: empty on purpose. Author 8-12 questions from scratch; do not "
             "derive them from the chapter text.")
TODO_CODE = ("lesson sections carry no code example. Runnable Lox/Java/C snippets "
             "must be written for Grimoire, not copied from the book.")


def cache_key(name):
    """A filesystem-safe cache filename. Windows rejects ? : * \" < > |."""
    safe = re.sub(r'[^A-Za-z0-9._-]', "_", name)
    return safe[-180:]


# --------------------------------------------------------------- fetching
class Fetcher:
    def __init__(self, use_cache=True):
        self.use_cache = use_cache
        self.hits = 0
        self.misses = 0
        self.failures = []

    def get(self, url):
        """Returns page text, or None if it could not be fetched."""
        key = os.path.join(CACHE, cache_key(url))
        if self.use_cache and os.path.exists(key):
            self.hits += 1
            return io.open(key, encoding="utf-8").read()
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "grimoire-importer"})
            with urllib.request.urlopen(req, timeout=30) as r:
                text = r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            self.failures.append("%s -> HTTP %s" % (url, e.code))
            return None
        except Exception as e:
            self.failures.append("%s -> %s" % (url, e))
            return None
        self.misses += 1
        os.makedirs(os.path.dirname(key), exist_ok=True)
        io.open(key, "w", encoding="utf-8").write(text)
        return text


# ---------------------------------------------------------- html -> toc
TAG = re.compile(r"<[^>]+>")
NUM = re.compile(r'<span class="num">(.*?)</span>', re.S)
LINK = re.compile(r'<a\s+href="([^"]+)"[^>]*>(.*?)</a>', re.S)
# One pass over the contents list: an <h2> opens a part, an <li> is an entry.
ITEM = re.compile(r"<h2\b[^>]*>(.*?)</h2>|<li\b([^>]*)>(.*?)</li>", re.S)


def text_of(frag):
    """Tag-free, entity-decoded, whitespace-collapsed text."""
    return re.sub(r"\s+", " ", html.unescape(TAG.sub("", frag or ""))).strip()


def absolute(href):
    if re.match(r"^https?://", href):
        return href
    return SITE + href.lstrip("/")


def slug_of(url):
    tail = url.rsplit("/", 1)[-1].split("#")[0]
    return re.sub(r"\.html?$", "", tail) or "index"


def parse_contents(page, report):
    """Read parts, chapters and design notes out of contents.html.

    Titles and URLs only. Nothing else on that page is touched.
    """
    body = page
    start = body.find('<div class="chapters">')
    if start >= 0:
        body = body[start:]
    end = body.find("<footer")
    if end >= 0:
        body = body[:end]

    parts, part = [], None
    for m in ITEM.finditer(body):
        if m.group(1) is not None:                      # ---- part heading
            inner = m.group(1)
            rest = NUM.sub("", inner)
            link = LINK.search(rest)
            if link:
                url = absolute(link.group(1))
                part = {"title": text_of(link.group(2)), "url": url,
                        "slug": slug_of(url), "chapters": []}
            else:
                title = text_of(rest)
                part = {"title": title, "url": None,
                        "slug": re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-"),
                        "chapters": []}
            parts.append(part)
            continue

        attrs, inner = m.group(2) or "", m.group(3)     # ---- list entry
        numm = NUM.search(inner)
        num = text_of(numm.group(1)) if numm else ""
        link = LINK.search(NUM.sub("", inner))
        if not link or part is None:
            continue
        url = absolute(link.group(1))
        title = text_of(link.group(2))

        if "design-note" in attrs:
            if part["chapters"]:
                # Strip the label; the chapter it hangs off already says what it is.
                part["chapters"][-1]["notes"].append(
                    {"title": re.sub(r"^Design Note:\s*", "", title), "url": url})
                report["design_notes"] += 1
            continue

        kind = ("chapter" if re.match(r"^\d+\.$", num)
                else "appendix" if re.match(r"^[A-Z]\d*\.$", num)
                else "front")
        if kind == "front":
            # Dedication, acknowledgements: not teaching material, not mapped.
            report["skipped_front"].append(title)
            continue
        part["chapters"].append({
            "num": num.rstrip("."), "kind": kind, "title": title,
            "url": url, "slug": slug_of(url), "notes": [],
        })

    parts = [p for p in parts if p["chapters"]]
    report["parts"] = len(parts)
    report["chapters"] = sum(len(p["chapters"]) for p in parts)
    return parts


# ------------------------------------------------------------ body text
def normalise_body(text):
    """Force text into the subset the Grimoire renderer supports.

    Allowed: **bold**, `inline code`, blank-line paragraphs, "- " bullets, and
    $...$ / $$...$$ LaTeX, which is left byte-for-byte alone. Everything this
    importer writes is already in that subset; the pass exists so a title
    fetched from the source can never smuggle in syntax the renderer would
    print raw.
    """
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)            # images
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)        # inline links
    text = re.sub(r"\[([^\]]+)\]\[[^\]]*\]", r"\1", text)       # ref links
    text = re.sub(r"^\[[^\]]+\]:\s*\S+\s*$", "", text, flags=re.M)
    text = TAG.sub("", text)                                    # raw html
    text = re.sub(r"^\s*\|.*\|\s*$", "", text, flags=re.M)      # tables
    text = re.sub(r"^\s*>\s?", "", text, flags=re.M)            # block quotes
    text = re.sub(r"^#{1,6}\s+(.+?)\s*$", r"**\1**", text, flags=re.M)
    text = re.sub(r"(?<![A-Za-z0-9_])_([^_\n]+)_(?![A-Za-z0-9_])",
                  r"**\1**", text)                              # _em_ -> bold
    text = re.sub(r"^\s*[*+]\s+", "- ", text, flags=re.M)       # bullet markers
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def section_for(ch, report):
    """One lesson section = one chapter of the book, as a catalogue entry."""
    label = ("Chapter %s - %s" % (ch["num"], ch["title"]) if ch["kind"] == "chapter"
             else ch["title"])
    note = CHAPTER_NOTE.get(ch["slug"])
    if not note:
        note = ("No structural description has been written for this chapter yet "
                "-- see CHAPTER_NOTE in scripts/import_crafting_interpreters.py.")
        report["missing_note"].append(ch["slug"])

    where = "chapter" if ch["kind"] == "chapter" else "appendix"
    lines = ["**%s**" % label, "", note, "",
             "Read this %s at %s" % (where, ch["url"])]
    if ch["notes"]:
        lines += ["", "**Design notes in this chapter**", ""]
        lines += ["- %s - %s" % (n["title"], n["url"]) for n in ch["notes"]]
    lines += ["", "The chapter text itself is not reproduced here: %s is %s "
                  "(no derivatives), so Grimoire links to it instead of copying "
                  "or rewriting it." % (SITE.rstrip("/"), LICENCE)]

    return {
        "title": label,
        "body": normalise_body("\n".join(lines)),
        "code": "",
        "lang": "text",
        "annotations": [],
        "url": ch["url"],
        "source": "%s %s" % (SOURCE, ch["slug"]),
    }


# -------------------------------------------------------------- floors
def distribute(items, per_floor):
    """Split one part's chapters into evenly sized floor groups."""
    n = len(items)
    if not n:
        return []
    target = max(1, (n + per_floor - 1) // per_floor)
    base, extra = divmod(n, target)
    out, i = [], 0
    for f in range(target):
        take = base + (1 if f >= target - extra else 0)
        out.append(items[i:i + take])
        i += take
    return out


def floor_name(part, idx):
    pool = FLOOR_NAMES.get(part["slug"], [])
    if idx < len(pool):
        return pool[idx]
    return "%s - Depth %d" % (part["title"], idx + 1)


def build_floors(parts, per_floor, report):
    floors = []
    for part in parts:
        for idx, group in enumerate(distribute(part["chapters"], per_floor)):
            n = len(floors) + 1
            sections = [section_for(ch, report) for ch in group]
            todo = [TODO_CODE, TODO_PRACTICE, TODO_EXAM]
            if len(sections) < 2:
                todo.insert(0, "lesson has %d section(s); the spec wants 2-4."
                            % len(sections))
                report["undersized_floors"] += 1
            if len(sections) > 4:
                todo.insert(0, "lesson has %d sections; the spec caps a lesson at 4 "
                            "(lower --per-floor)." % len(sections))
                report["oversized_floors"] += 1
            floors.append({
                "n": n,
                "name": floor_name(part, idx),
                "concepts": [ch["slug"] for ch in group],
                "part": part["title"],
                "partUrl": part["url"],
                "chapters": [{"num": ch["num"], "title": ch["title"], "url": ch["url"]}
                             for ch in group],
                "lesson": {"sections": sections},
                "practice": [],
                "exam": [],
                "_todo": todo,
            })
    return floors


def build_dungeon(parts, per_floor, report):
    return {
        "id": DUNGEON_ID,
        "name": "The Forge of Tongues",
        "subject": "Compilers & Interpreters",
        "category": "theory",
        "disciplineType": "theory",
        "lang": "text",
        "runtime": "none",
        "source": SOURCE,
        "importedBy": "scripts/import_crafting_interpreters.py",
        "sigil": "⚒",
        "unlock": None,
        "blurb": "A map of Crafting Interpreters: every chapter, in build order, "
                 "linked to the author's own site.",
        "linkMapOnly": True,
        "notice": "Crafting Interpreters by %s is licensed %s (no derivatives). "
                  "Grimoire records its table of contents and links out; no prose, "
                  "code or exercise from the book is reproduced or adapted here."
                  % (AUTHOR, LICENCE),
        "floors": build_floors(parts, per_floor, report),
    }


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--per-floor", type=int, default=4,
                    help="maximum chapters per floor (default 4, the section cap)")
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--dry-run", action="store_true",
                    help="print the summary without writing files")
    args = ap.parse_args()

    report = {"parts": 0, "chapters": 0, "design_notes": 0, "oversized_floors": 0,
              "undersized_floors": 0, "skipped_front": [], "missing_note": []}

    f = Fetcher(use_cache=not args.no_cache)
    print("importing %s ..." % CONTENTS)
    page = f.get(CONTENTS)
    if page is None:
        raise SystemExit("Could not fetch %s: %s" % (CONTENTS, "; ".join(f.failures)))

    parts = parse_contents(page, report)
    if not parts:
        raise SystemExit("contents.html parsed to zero chapters - the page layout "
                         "changed; fix the parser rather than shipping a stub.")
    dungeon = build_dungeon(parts, args.per_floor, report)

    out_json = os.path.join(ROOT, "content", "%s.json" % DUNGEON_ID)
    if not args.dry_run:
        os.makedirs(os.path.dirname(out_json), exist_ok=True)
        json.dump(dungeon, io.open(out_json, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)

    # ------------------------------------------------------- summary
    floors = dungeon["floors"]
    n_sec = sum(len(fl["lesson"]["sections"]) for fl in floors)
    n_prac = sum(len(fl["practice"]) for fl in floors)
    n_exam = sum(len(fl["exam"]) for fl in floors)
    todos = sum(len(fl["_todo"]) for fl in floors)

    print("")
    print("=" * 70)
    print("  IMPORT SUMMARY - craftinginterpreters.com")
    print("=" * 70)
    print("  network: %d fetched, %d from cache%s" % (
        f.misses, f.hits, ", %d failed" % len(f.failures) if f.failures else ""))
    print("  licence: %s -- NO DERIVATIVES" % LICENCE)
    print("")
    print("  *** THIS IS A LINK MAP, NOT A LESSON. ***")
    print("  Only chapter titles and URLs were taken from the source. No prose,")
    print("  no code and no exercises were copied, excerpted or paraphrased.")
    print("  Every section body is: chapter title + a one-line structural note")
    print("  written in the importer + the canonical URL.")
    print("")
    print("  EXTRACTED (titles and URLs only)")
    print("    parts in the table of contents : %d" % report["parts"])
    print("    chapters + appendices mapped   : %d" % report["chapters"])
    print("    design notes linked            : %d" % report["design_notes"])
    print("    frontmatter skipped            : %s"
          % (", ".join(report["skipped_front"]) or "none"))
    print("")
    print("  BUILT")
    print("    floors                         : %d" % len(floors))
    print("    lesson sections                : %d (1 per chapter)" % n_sec)
    print("    sections with a code example   : 0 (ND source: none may be copied)")
    print("")
    print("  NEEDS MANUAL WORK - nothing below can come from this source")
    print("    practice challenges            : %d (need >= 6 per floor = %d)"
          % (n_prac, 6 * len(floors)))
    print("    exam questions                 : %d (need 8-12 per floor = %d-%d)"
          % (n_exam, 8 * len(floors), 12 * len(floors)))
    print("    code examples to write         : %d" % n_sec)
    print("    total _todo entries            : %d" % todos)
    if report["missing_note"]:
        print("    chapters with no note written  : %s"
              % ", ".join(report["missing_note"]))
    if report["oversized_floors"]:
        print("    floors over the 4-section cap  : %d" % report["oversized_floors"])
    if report["undersized_floors"]:
        print("    floors under the 2-section min : %d" % report["undersized_floors"])
    if f.failures:
        print("    fetch failures                 : %s" % "; ".join(f.failures[:5]))
    print("")
    print("  PER FLOOR")
    for fl in floors:
        print("    %2d. %-30s %d sections  %-28s %s"
              % (fl["n"], fl["name"], len(fl["lesson"]["sections"]),
                 fl["part"][:28],
                 "ch " + ",".join(c["num"] for c in fl["chapters"])))
    print("")
    if args.dry_run:
        print("  (dry run - nothing written)")
    else:
        print("  wrote %s" % os.path.relpath(out_json, ROOT))
    print("  content/index.json is NOT touched here - the caller regenerates it.")
    print("  next: python scripts/validate_content.py %s" % DUNGEON_ID)
    print("        (it will fail on practice/exam/code: that is the honest state)")
    print("=" * 70)


if __name__ == "__main__":
    main()
