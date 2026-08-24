#!/usr/bin/env python3
"""Import the OSTEP chapter list into a Grimoire dungeon JSON.

    python scripts/import_ostep.py
    python scripts/import_ostep.py --dry-run
    python scripts/import_ostep.py --no-cache

WHAT THIS IMPORTER ACTUALLY PRODUCES -- read this before trusting the output.

OSTEP ("Operating Systems: Three Easy Pieces") publishes every chapter as a
PDF and nothing else. There is no markdown, no HTML chapter text, no plain
text edition. Extracting prose from those PDFs would need a third-party
library, which this project does not allow, and the authors explicitly ask
readers not to mirror their chapters:

    "If you are using these free chapters, please just link to them directly
     (instead of making a copy locally)"      -- pages.cs.wisc.edu/~remzi/OSTEP

So this script does NOT import teaching text. It imports the *structure*:
the real part names, the real chapter numbers, the real chapter titles and
the real PDF URLs, scraped from the book's own index page, plus the companion
source-code links the page attaches to some chapters. Every lesson section it
writes is a signpost to a chapter, marked "_placeholder": true, with a
_todo saying the prose still has to be authored by a human.

It emits no practice and no exam questions at all. There is nothing in the
source to ground them in, and inventing them would be worse than leaving the
gap visible.

Source: pages.cs.wisc.edu/~remzi/OSTEP (free online; link-only, per the authors).
"""
import argparse
import io
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "ostep")
INDEX_URL = "https://pages.cs.wisc.edu/~remzi/OSTEP/"

DUNGEON_ID = "operating-systems"
DUNGEON_NAME = "The Kernel Depths"
SUBJECT = "Operating Systems"
SIGIL = "◴"
SOURCE = "pages.cs.wisc.edu/~remzi/OSTEP (free online, link-only)"
IMPORTED_BY = "scripts/import_ostep.py"

# The authors' own request, quoted from the index page. Recorded in the JSON so
# nobody later "helpfully" pastes chapter text in.
LINK_ONLY_NOTE = (
    "OSTEP is free to read online but the authors ask that chapters be linked "
    "to directly rather than copied. Grimoire links out; it does not mirror "
    "the book's text."
)

# Dungeon flavour, keyed by the part heading the index page actually prints.
# An unknown part still imports -- it just gets a generic floor name.
PART_FLAVOUR = {
    "Intro":          "The Threshold Gate",
    "Virtualization": "The Hall of Mirrors",
    "Concurrency":    "The Tangled Weave",
    "Persistence":    "The Deep Archive",
    "Security":       "The Warded Vault",
    "Appendices":     "The Sealed Annex",
}

# Not a heading the page prints: the unnumbered appendices share the Security
# column, so they are regrouped under a name of our own. Structural only.
APPENDIX_PART = "Appendices"

ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
         "XI", "XII", "XIII", "XIV", "XV"]


# --------------------------------------------------------------- fetching
def cache_key(name):
    """A filesystem-safe cache filename. Windows rejects ? : * " < > |."""
    safe = re.sub(r'[^A-Za-z0-9._-]', "_", name)
    return safe[-180:]


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
            return io.open(key, encoding="utf-8", errors="replace").read()
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "grimoire-importer"})
            with urllib.request.urlopen(req, timeout=30) as r:
                text = r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            self.failures.append("%s -> HTTP %s" % (url, e.code))
            return None
        except Exception as e:
            self.failures.append("%s -> %s" % (url, e))
            return None
        self.misses += 1
        os.makedirs(os.path.dirname(key), exist_ok=True)
        io.open(key, "w", encoding="utf-8").write(text)
        return text


# ---------------------------------------------------------- html helpers
ENTITIES = {"&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
            "&apos;": "'", "&nbsp;": " ", "&mdash;": "-", "&ndash;": "-",
            "&#39;": "'", "&#38;": "&"}


def unescape(s):
    for k, v in ENTITIES.items():
        s = s.replace(k, v)
    return s


def text_of(html_fragment):
    """Tag soup -> plain text. The index page is hand-written 1990s HTML."""
    s = re.sub(r"<[^>]*>", " ", html_fragment)
    return re.sub(r"\s+", " ", unescape(s)).strip()


def attr_url(raw):
    """Hrefs on this page are usually unquoted; some are quoted."""
    return raw.strip().strip('"').strip("'")


# ------------------------------------------------------- chapter scraping
def find_chapter_table(html):
    """The chapter grid is the first <table> after the #book-chapters anchor.

    Anchoring on the page's own named anchor rather than a table index means a
    new promo table above it does not silently shift what we parse.
    """
    m = re.search(r'<a\s+name="?book-chapters"?', html, re.I)
    if not m:
        return None
    start = html.find("<table", m.end())
    if start < 0:
        return None
    end = html.find("</table>", start)
    if end < 0:
        return None
    return html[start:end]


def parse_cell(cell_html, base_url):
    """One <td> -> a chapter record, or None if the cell is empty / has no PDF."""
    anchors = re.findall(r"<a\s[^>]*?href=([^\s>]+)[^>]*>(.*?)</a>",
                         cell_html, re.S | re.I)
    pdf_url, title, code_url = None, None, None
    for href, inner in anchors:
        href = attr_url(href)
        if pdf_url is None and href.lower().endswith(".pdf"):
            pdf_url = urllib.parse.urljoin(base_url, href)
            title = text_of(inner)
        elif code_url is None and "github.com" in href:
            code_url = href
    if not pdf_url or not title:
        return None

    num = None
    mnum = re.search(r"<small>\s*(\d+)\s*</small>", cell_html, re.I)
    if mnum:
        num = int(mnum.group(1))
    italic = bool(re.search(r"<i>", cell_html, re.I))

    return {"num": num, "title": title, "pdf": pdf_url,
            "code": code_url, "italic": italic}


def classify(rec, part):
    if rec["num"] is None:
        return "front-matter" if part.lower().startswith("intro") else "appendix"
    return "dialogue" if rec["italic"] else "chapter"


def scrape_chapters(html, base_url, report):
    """Read the column-major chapter grid into [(part, [chapters])].

    The grid is one column per part; the header row names them, and a part
    wide enough to need two columns leaves the second header blank, so a blank
    header inherits the part to its left. Rows are read in document order and
    the chapters are then sorted by the book's own chapter numbers.
    """
    table = find_chapter_table(html)
    if table is None:
        raise SystemExit(
            "Could not locate the chapter table on %s -- the page layout "
            "changed. Refusing to guess." % base_url)

    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S | re.I)
    if not rows:
        raise SystemExit("Chapter table has no rows; refusing to guess.")

    def cells(row):
        return re.findall(r"<td[^>]*>.*?</td>", row, re.S | re.I)

    # ---- header row names the parts ----
    header = cells(rows[0])
    parts, last = [], None
    for c in header:
        name = text_of(c)
        if name:
            last = name
        parts.append(last or "Unsorted")
    report["columns"] = len(parts)

    # ---- body rows ----
    order, found = [], {}
    for row in rows[1:]:
        for i, c in enumerate(cells(row)):
            part = parts[i] if i < len(parts) else "Unsorted"
            rec = parse_cell(c, base_url)
            if rec is None:
                continue
            rec["part"] = part
            rec["kind"] = classify(rec, part)
            if part not in found:
                found[part] = []
                order.append(part)
            found[part].append(rec)
            report["cells_with_pdf"] += 1

    if len(found) < 3:
        raise SystemExit(
            "Only %d part(s) parsed from the chapter table; the page layout "
            "changed. Refusing to emit a half-read map." % len(found))

    # The page stacks the unnumbered appendices under the Security heading
    # because they share a column, not because they are security chapters.
    # Split them out under a derived heading rather than mislabel them.
    appendices = []
    for part in order:
        keep = [r for r in found[part] if r["kind"] != "appendix"]
        appendices.extend(r for r in found[part] if r["kind"] == "appendix")
        found[part] = keep
    order = [p for p in order if found[p]]
    if appendices:
        for r in appendices:
            r["part"] = APPENDIX_PART
        found[APPENDIX_PART] = appendices
        order.append(APPENDIX_PART)
        report["appendices_split"] = len(appendices)

    # Numbered chapters in book order; unnumbered appendices keep page order.
    for part in found:
        numbered = sorted([r for r in found[part] if r["num"] is not None],
                          key=lambda r: r["num"])
        rest = [r for r in found[part] if r["num"] is None]
        found[part] = numbered + rest
    return [(p, found[p]) for p in order]


def find_extra_link(html, label, base_url):
    """Pull one of the page's own resource links (HOMEWORK, PROJECTS ...)."""
    m = re.search(r"<b>%s[^<]*</b>.{0,600}?<a\s[^>]*?href=([^\s>]+)"
                  % re.escape(label), html, re.S | re.I)
    if not m:
        return None
    return urllib.parse.urljoin(base_url, attr_url(m.group(1)))


# -------------------------------------------------------- body rendering
def normalise_body(text):
    """Keep emitted bodies inside the renderer's subset.

    The renderer supports **bold**, `inline code`, blank-line paragraphs and
    "- " bullets, and nothing else. These bodies are generated rather than
    imported, but they still run through the same gate so a stray character in
    a scraped chapter title cannot smuggle markup in.
    """
    text = re.sub(r"(?<![A-Za-z0-9_])_([^_\n]+)_(?![A-Za-z0-9_])", r"**\1**", text)
    text = re.sub(r"^#{1,6}\s+(.+?)\s*$", r"**\1**", text, flags=re.M)
    text = re.sub(r"^\s*\|.*\|\s*$", "", text, flags=re.M)   # tables
    text = re.sub(r"^\s*>\s?", "", text, flags=re.M)          # block quotes
    text = re.sub(r"^\s*[*+]\s+", "- ", text, flags=re.M)     # bullet markers
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)          # images
    text = re.sub(r"<[^>]+>", "", text)                       # raw html
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def clean_title(t):
    """Scraped titles go into JSON `title` fields; keep them plain."""
    return re.sub(r"\s+", " ", re.sub(r"[*`_\[\]]", "", t)).strip()


# Every part ends in one of these, so the title alone would give a dozen
# sections all called "Summary". The PDF filename is the real identity.
GENERIC_TITLES = {"dialogue", "summary", "intro", "introduction"}


def pdf_stem(rec):
    return os.path.splitext(os.path.basename(
        urllib.parse.urlparse(rec["pdf"]).path))[0]


KIND_LEAD = {
    "chapter":      "OSTEP chapter",
    "dialogue":     "OSTEP dialogue chapter",
    "appendix":     "OSTEP appendix",
    "front-matter": "OSTEP front matter",
}


def part_line(rec):
    """Name the part, and say so when the grouping is ours rather than theirs."""
    if rec["part"] == APPENDIX_PART:
        return ("Part: **Appendices** -- the index page lists this under its "
                "Security column; the grouping here is the importer's.")
    return "Part: **%s**." % rec["part"]


def section_for(rec):
    """A signpost to one chapter. Deliberately carries no teaching text."""
    label = KIND_LEAD.get(rec["kind"], "OSTEP chapter")
    if rec["num"] is not None:
        heading = "**%s %d - %s**" % (label, rec["num"], rec["title"])
        title = "%d. %s" % (rec["num"], rec["title"])
    else:
        # Unnumbered appendices are often just called "Dialogue"; the PDF
        # filename is the only thing telling three of them apart.
        title = rec["title"]
        if title.strip().lower() in GENERIC_TITLES:
            title = "%s (%s)" % (title, pdf_stem(rec))
        heading = "**%s - %s**" % (label, title)

    lines = [
        heading,
        "",
        part_line(rec),
        "",
        "This is a **chapter map entry, not a lesson**. OSTEP publishes this "
        "chapter as a PDF only, so no prose has been imported and none has "
        "been written for it yet. Read it at the source:",
        "",
        "- Chapter PDF: %s" % rec["pdf"],
    ]
    if rec["code"]:
        lines.append("- Companion code: %s" % rec["code"])
    lines += ["", "**TODO:** author the lesson prose for this chapter."]

    return {
        "title": clean_title(title),
        "body": normalise_body("\n".join(lines)),
        "code": placeholder_code(rec),
        "lang": "c",
        "annotations": [],
        "_placeholder": True,
        "_chapter": rec["num"],
        "_pdf": rec["pdf"],
        "_code": rec["code"],
        "_kind": rec["kind"],
    }


def placeholder_code(rec):
    """Scaffolding, not an example. Says so on its first line."""
    num = ("chapter %d" % rec["num"]) if rec["num"] is not None else "appendix"
    out = ["/* PLACEHOLDER - not code from OSTEP, nothing is taught here. */",
           "/* %s: %s */" % (num, rec["title"]),
           "/* PDF:  %s */" % rec["pdf"]]
    if rec["code"]:
        out.append("/* Code: %s */" % rec["code"])
    out.append("/* TODO: replace with a real example when the prose is written. */")
    return "\n".join(out)


# ------------------------------------------------------------- building
def slug(text):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s or "chapter"


def concept_slug(rec):
    if rec["title"].strip().lower() in GENERIC_TITLES:
        return slug(pdf_stem(rec))
    return slug(rec["title"])


def chunk(items, cap):
    """Split a part into floors of at most `cap` chapters, evenly.

    Balancing matters: a naive slice leaves a trailing floor holding one
    chapter, and a one-section floor is below the schema's minimum of two.
    """
    n = len(items)
    if not n:
        return []
    if not cap or cap >= n:
        return [items]
    k = (n + cap - 1) // cap
    base, extra = divmod(n, k)
    out, i = [], 0
    for f in range(k):
        take = base + (1 if f >= k - extra else 0)
        out.append(items[i:i + take])
        i += take
    return out


def floor_name(part, idx, total):
    base = PART_FLAVOUR.get(part, "%s Depths" % part)
    if total <= 1:
        return base
    return "%s %s" % (base, ROMAN[idx] if idx < len(ROMAN) else str(idx))


def build_floor(n, part, group, total_in_part, idx):
    sections = [section_for(r) for r in group]
    nums = [r["num"] for r in group if r["num"] is not None]
    if len(nums) > 1:
        span = "chapters %d-%d" % (min(nums), max(nums))
    elif nums:
        span = "chapter %d" % nums[0]
    else:
        span = "appendix material"

    todo = [
        "lesson: OSTEP ships PDF only -- NO prose was imported. Author the "
        "teaching text for all %d section(s) on this floor." % len(sections),
        "lesson: all %d code example(s) are placeholders naming the chapter, "
        "not real C. Replace them." % len(sections),
        "practice: author 6+ challenges. None were imported -- the source is "
        "PDF, and inventing them was not an option.",
        "exam: author 8-12 questions. None were imported, same reason.",
    ]
    coded = [r["title"] for r in group if r["code"]]
    if coded:
        todo.append("practice: the ostep-code repo has runnable C for %s -- "
                    "check its licence before embedding anything."
                    % ", ".join(coded))

    return {
        "n": n,
        "name": floor_name(part, idx, total_in_part),
        "part": part,
        "span": span,
        "concepts": [concept_slug(r) for r in group],
        "chapters": [
            {"n": r["num"], "title": r["title"], "pdf": r["pdf"],
             "code": r["code"], "kind": r["kind"]}
            for r in group
        ],
        "lesson": {"sections": sections},
        "practice": [],
        "exam": [],
        "_todo": todo,
    }


def build_dungeon(parts, extras, report, max_sections, include_front_matter):
    floors = []
    for part, chapters in parts:
        if not include_front_matter:
            dropped = [r for r in chapters if r["kind"] == "front-matter"]
            chapters = [r for r in chapters if r["kind"] != "front-matter"]
            report["front_matter_skipped"] += len(dropped)
        if not chapters:
            continue
        groups = chunk(chapters, max_sections)
        for i, g in enumerate(groups):
            floors.append(build_floor(len(floors) + 1, part, g,
                                      len(groups), i + 1))
        report["part_sizes"].append((part, len(chapters), len(groups)))

    blurb = normalise_body(
        "A chapter map of **Operating Systems: Three Easy Pieces** by Remzi "
        "and Andrea Arpaci-Dusseau, structured around the book's three "
        "pieces: virtualization, concurrency and persistence.\n\n"
        "No lesson prose has been imported. OSTEP is distributed as PDFs "
        "only, and the authors ask that chapters be linked to rather than "
        "copied, so every section here is a signpost to the real chapter.")

    d = {
        "id": DUNGEON_ID,
        "name": DUNGEON_NAME,
        "subject": SUBJECT,
        "category": "theory",
        "disciplineType": "systems",
        "sigil": SIGIL,
        "unlock": None,
        "lang": "c",
        "runtime": "piston",
        "source": SOURCE,
        "importedBy": IMPORTED_BY,
        "blurb": blurb,
        "sourceUrl": INDEX_URL,
        "sourceNote": LINK_ONLY_NOTE,
        "_chapterMapOnly": True,
        "_todo": [
            "THIS FILE IS A CHAPTER MAP, NOT CONTENT. Every lesson section is "
            "a link to a PDF; no teaching text, no practice and no exams "
            "exist yet.",
        ],
        "floors": floors,
    }
    if extras:
        d["resources"] = extras
        d["_todo"].append(
            "resources: %s were scraped from the index page and may ground "
            "practice challenges better than the PDFs do."
            % ", ".join(sorted(extras)))
    return d


# -------------------------------------------------------------- syllabus
BEGIN = "<!-- GENERATED:BEGIN - import_ostep.py rewrites this block -->"
END = "<!-- GENERATED:END -->"


def write_syllabus(dungeon, path):
    lines = ["# Syllabus - %s (%s)" % (dungeon["subject"], dungeon["name"]), ""]
    lines.append("Scraped from `%s`. **Chapter map only** - no prose was "
                 "imported, because OSTEP ships PDFs and the authors ask for "
                 "links rather than copies." % dungeon["source"])
    lines.append("")
    lines.append("| Floor | Name | Part | Chapters |")
    lines.append("|---|---|---|---|")
    for f in dungeon["floors"]:
        chs = ", ".join(
            ("%d. %s" % (c["n"], c["title"])) if c["n"] is not None else c["title"]
            for c in f["chapters"])
        lines.append("| %d | %s | %s | %s |" % (f["n"], f["name"], f["part"], chs))
    lines += ["", "## Every chapter, with its PDF", ""]
    for f in dungeon["floors"]:
        for c in f["chapters"]:
            num = ("%d. " % c["n"]) if c["n"] is not None else ""
            extra = " - code: %s" % c["code"] if c["code"] else ""
            lines.append("- %s%s - %s%s" % (num, c["title"], c["pdf"], extra))
    lines += ["", "## Still to author", "",
              "- lesson prose for every chapter above (nothing was imported)",
              "- practice challenges (none imported)",
              "- exam questions (none imported)"]
    block = BEGIN + "\n" + "\n".join(lines) + "\n" + END + "\n"

    # Hand-written notes live outside the generated block and must survive a
    # re-import; only the scraped map is regenerated.
    if os.path.exists(path):
        old = io.open(path, encoding="utf-8").read()
        if BEGIN in old and END in old:
            head = old.split(BEGIN)[0]
            tail = old.split(END, 1)[1]
            io.open(path, "w", encoding="utf-8").write(head + block + tail)
            return
    io.open(path, "w", encoding="utf-8").write(block)


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--max-sections", type=int, default=4,
                    help="chapters per floor; 0 puts a whole OSTEP part on "
                         "one floor (default 4, the schema cap)")
    ap.add_argument("--include-front-matter", action="store_true",
                    help="keep Dedication / Preface / TOC as sections")
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--dry-run", action="store_true",
                    help="print the summary without writing files")
    args = ap.parse_args()

    report = {"cells_with_pdf": 0, "columns": 0, "part_sizes": [],
              "front_matter_skipped": 0, "appendices_split": 0}

    f = Fetcher(use_cache=not args.no_cache)
    print("importing OSTEP from %s ..." % INDEX_URL)
    html = f.get(INDEX_URL)
    if html is None:
        raise SystemExit("Could not fetch %s -- nothing to import." % INDEX_URL)

    parts = scrape_chapters(html, INDEX_URL, report)

    extras = {}
    for label, key in (("HOMEWORKS", "homework"), ("PROJECTS", "projects")):
        url = find_extra_link(html, label, INDEX_URL)
        if url:
            extras[key] = url

    dungeon = build_dungeon(parts, extras, report,
                            args.max_sections, args.include_front_matter)

    out_json = os.path.join(ROOT, "content", "%s.json" % DUNGEON_ID)
    out_syl = os.path.join(ROOT, "syllabi", "%s.md" % DUNGEON_ID)

    if not args.dry_run:
        os.makedirs(os.path.dirname(out_json), exist_ok=True)
        os.makedirs(os.path.dirname(out_syl), exist_ok=True)
        json.dump(dungeon, io.open(out_json, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
        write_syllabus(dungeon, out_syl)

    # ------------------------------------------------------------ summary
    floors = dungeon["floors"]
    n_sec = sum(len(fl["lesson"]["sections"]) for fl in floors)
    n_prac = sum(len(fl["practice"]) for fl in floors)
    n_exam = sum(len(fl["exam"]) for fl in floors)
    todos = sum(len(fl["_todo"]) for fl in floors) + len(dungeon["_todo"])
    with_code = sum(1 for fl in floors for c in fl["chapters"] if c["code"])
    kinds = {}
    for fl in floors:
        for c in fl["chapters"]:
            kinds[c["kind"]] = kinds.get(c["kind"], 0) + 1

    print("")
    print("=" * 70)
    print("  IMPORT SUMMARY - OSTEP -> %s" % DUNGEON_ID)
    print("=" * 70)
    print("  network: %d fetched, %d from cache%s" % (
        f.misses, f.hits, ", %d failed" % len(f.failures) if f.failures else ""))
    print("  chapter grid: %d columns, %d cells with a PDF link"
          % (report["columns"], report["cells_with_pdf"]))
    print("")
    print("  IMPORTED (structure only)")
    print("    OSTEP parts                 : %d" % len(report["part_sizes"]))
    print("    floors built                : %d" % len(floors))
    print("    lesson sections             : %d  (1 per chapter, all signposts)"
          % n_sec)
    print("    real chapter titles + PDFs  : %d" % n_sec)
    print("    chapters with companion code: %d" % with_code)
    print("    chapter kinds               : %s"
          % ", ".join("%s %d" % (k, v) for k, v in sorted(kinds.items())))
    if report["appendices_split"]:
        print("    appendices regrouped        : %d (page stacks them under Security)"
              % report["appendices_split"])
    if report["front_matter_skipped"]:
        print("    front matter skipped        : %d (--include-front-matter keeps it)"
              % report["front_matter_skipped"])
    print("")
    print("  NOT IMPORTED - AND NOT FAKED")
    print("    lesson prose                : 0 words. OSTEP is PDF-only and the")
    print("                                  authors ask for links, not copies.")
    print("    code examples               : 0 real, %d placeholders naming the chapter"
          % n_sec)
    print("    practice challenges         : %d  (nothing in the source to ground them in)"
          % n_prac)
    print("    exam questions              : %d  (same)" % n_exam)
    print("    total _todo entries         : %d" % todos)
    print("")
    print("  PER FLOOR")
    for fl in floors:
        print("    %2d. %-24s %-14s %d sections  %s"
              % (fl["n"], fl["name"][:24], fl["part"][:14],
                 len(fl["lesson"]["sections"]), fl["span"]))
    print("")
    print("  PER PART")
    for part, n, g in report["part_sizes"]:
        print("    %-16s %2d chapters over %d floor(s)" % (part, n, g))
    if extras:
        print("")
        print("  ALSO SCRAPED")
        for k, v in sorted(extras.items()):
            print("    %-12s %s" % (k, v))
    if f.failures:
        print("")
        print("  fetch failures: %s" % "; ".join(f.failures[:5]))
    print("")
    print("  VERDICT: chapter map only. This file is scaffolding for a human")
    print("           author, not shippable teaching content. It will fail")
    print("           scripts/validate_content.py, and it should.")
    print("")
    if args.dry_run:
        print("  (dry run - nothing written)")
    else:
        print("  wrote %s" % os.path.relpath(out_json, ROOT))
        print("  wrote %s" % os.path.relpath(out_syl, ROOT))
    print("=" * 70)


if __name__ == "__main__":
    main()
