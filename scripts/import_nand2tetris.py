#!/usr/bin/env python3
"""Import the Nand to Tetris project map into a Grimoire dungeon JSON.

    python scripts/import_nand2tetris.py
    python scripts/import_nand2tetris.py --dry-run
    python scripts/import_nand2tetris.py --no-cache

Fetches https://www.nand2tetris.org/course and reads the real course
structure out of the page: the two part headings, the twelve project
titles as they are written on the page, and the resource links that sit
under each title. Links are classified by the icon the page uses for
them - project guidelines, lecture slides, book chapter - with a
href-based fallback.

WHAT THIS IMPORTER DOES NOT DO
------------------------------
Nand to Tetris publishes its teaching material as PDF guidelines, PDF
book chapters and slide decks. None of that is text. This importer does
not attempt PDF extraction and does not paraphrase the material, so what
it writes is a PROJECT MAP, not a set of lessons: every floor carries the
real project title and honest links out to the original, and every floor
carries a _todo saying the teaching text still has to be written by a
human who has read the source. practice and exam are left empty on
purpose. The summary at the end says this loudly.

The only running prose in the output is quoted verbatim from the site
(the course page's own description of the project structure, the home
page's description of the course, the licence page's licence sentence)
and is attributed as such.

Source: nand2tetris.org (CC BY-NC-SA 3.0). See content/attribution.md.
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
CACHE = os.path.join(ROOT, ".cache", "nand2tetris")

COURSE_URL = "https://www.nand2tetris.org/course"
HOME_URL = "https://www.nand2tetris.org/"
LICENSE_URL = "https://www.nand2tetris.org/license"

DUNGEON_ID = "computer-architecture"

# The course page is a Wix site: every resource is an <img> wrapped in an
# <a>, and the image tells you what kind of resource it is. These are the
# three icons in use. Unknown icons fall back to the href and are counted
# in the summary rather than silently mislabelled.
ICONS = {
    "44046b_6428b9125acd46ae99ec0cb5d8c9c6fa": "guidelines",
    "44046b_5fb5cbdadf4f499cbaabb07bd1b11609": "slides",
    "44046b_3cf3a0c439154efcb5613b4cf7554a36": "chapter",
}
KIND_LABEL = {
    "guidelines": "Project guidelines",
    "slides": "Lecture slides",
    "chapter": "Book chapter",
    "unknown": "Linked resource",
}

# Flavour only. Nothing here claims to be course content.
FLOOR_NAMES = {
    1: "The Nand Gate",
    2: "The Adder's Forge",
    3: "The Clocked Vault",
    4: "Tongue of the Machine",
    5: "The Assembled Engine",
    6: "Hall of Symbols",
    7: "The Stack Ascends",
    8: "Corridors of Control",
    9: "The Jack Sanctum",
    10: "The Parsing Spire",
    11: "The Code Foundry",
    12: "The Final Layer",
}

# Cross-check only: the importer never invents a project the page does not
# list, it just reports the mismatch.
EXPECTED_PROJECTS = 12


# --------------------------------------------------------------- fetching
def cache_key(name):
    """A filesystem-safe cache filename. Windows rejects ? : * " < > |."""
    safe = re.sub(r'[^A-Za-z0-9._-]', "_", name)
    return safe[-180:]


class Fetcher:
    def __init__(self, use_cache=True):
        self.use_cache = use_cache
        self.hits = self.misses = 0
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
            with urllib.request.urlopen(req, timeout=45) as r:
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


# ---------------------------------------------------------- body text rules
# The renderer supports **bold**, `inline code`, blank-line paragraphs and
# "- " bullets, and nothing else. $...$ / $$...$$ must survive untouched
# for KaTeX, and so must URLs, whose underscores would otherwise be eaten
# by the emphasis rule.
MATH = re.compile(r"\$\$.+?\$\$|\$[^$\n]+?\$", re.S)
URL = re.compile(r"https?://[^\s)>\]]+")


def normalise_body(text):
    if not text:
        return ""
    kept = []

    def hide(m):
        kept.append(m.group(0))
        return "\x00K%d\x00" % (len(kept) - 1)

    text = text.replace("\u00a0", " ").replace("\u2019", "'")
    text = MATH.sub(hide, text)          # LaTeX is preserved exactly
    text = URL.sub(hide, text)           # so are bare links

    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)                # images
    text = re.sub(r"^\[[^\]]+\]:\s*\S+\s*$", "", text, flags=re.M)  # ref defs
    text = re.sub(r"\[([^\]]+)\]\[[^\]]*\]", r"\1", text)           # ref links
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)            # inline links
    text = re.sub(r"<[^>]+>", "", text)                             # raw HTML
    text = re.sub(r"^\s*\|.*\|\s*$", "", text, flags=re.M)          # tables
    text = re.sub(r"^\s*>\s?", "", text, flags=re.M)                # quotes
    text = re.sub(r"(?<![A-Za-z0-9_])_([^_\n]+)_(?![A-Za-z0-9_])",
                  r"**\1**", text)                                  # _em_ -> bold
    text = re.sub(r"^#{1,6}\s+(.+?)\s*$", r"**\1**", text, flags=re.M)
    text = re.sub(r"^\s*[*+]\s+", "- ", text, flags=re.M)           # bullets
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"(?<=\S)[ \t]{2,}", " ", text)   # a stripped nbsp doubles up
    text = re.sub(r"\n{3,}", "\n\n", text)

    text = re.sub(r"\x00K(\d+)\x00", lambda m: kept[int(m.group(1))], text)
    return text.strip()


def trim_to_sentence(text):
    """Drop a trailing fragment left behind when a link was stripped.

    The site's paragraphs often end "... Here is a recent CACM article
    about <link>". Quoting the fragment would misrepresent the source.
    """
    text = text.strip()
    cut = max(text.rfind("."), text.rfind("!"), text.rfind("?"))
    return text[:cut + 1].strip() if cut > 40 else text


# ------------------------------------------------------------ page parsing
# One pass over the document in order. Wix lays the projects out in two
# columns, so DOM order is 1,3,5,2,4,6 - but each project's links follow
# its own heading, which is all the grouping we need. Requiring a colon in
# the heading keeps the title="Project 01" tooltips out of the match.
TOKEN = re.compile(
    r'<a\b[^>]*?\bhref="([^"]+)"[^>]*>\s*<img\b[^>]*?\bsrc="([^"]+)"[^>]*>'
    r'|>\s*(Part\s+[IVX]+\s*:[^<]{1,80}?)\s*<'
    r'|>\s*(Project\s+(\d{1,2})\s*:[^<]{1,120}?)\s*<',
    re.S)

RICH_TEXT = re.compile(r'class="wixui-rich-text__text"[^>]*>([^<]{60,})<')


def clean_href(href):
    """Unescape, and drop the `authuser` parameter.

    The page's own links pin several Google Drive URLs to the author's
    personal account, which both publishes his address and breaks the
    link for anyone signed in as someone else.
    """
    url = html.unescape(href).strip()
    url = re.sub(r"[?&]authuser=[^&]*", "", url)
    url = url.replace("?&", "?")
    return url.rstrip("?&")


def link_kind(src, href, report):
    base = re.sub(r"^.*/media/", "", src).split("/")[0].split("~")[0]
    kind = ICONS.get(base)
    if kind:
        return kind
    report["unknown_icons"].append(base)
    if "_files/ugd/" in href and href.lower().endswith(".pdf"):
        return "chapter"
    return "unknown"


def parse_course(page, report):
    """-> (intro paragraph, [part dicts]) read out of the course page."""
    page = re.sub(r"<script.*?</script>", "", page, flags=re.S)
    page = re.sub(r"<style.*?</style>", "", page, flags=re.S)

    intro = ""
    for run in RICH_TEXT.findall(page):
        t = normalise_body(html.unescape(run))
        if "project" in t.lower() and len(t) > 80:
            intro = trim_to_sentence(t)
            break

    parts, current_part, current_proj = [], None, None
    for m in TOKEN.finditer(page):
        href, src, part_txt, proj_txt, proj_no = m.groups()
        if part_txt:
            current_part = {"title": re.sub(r"\s+", " ", html.unescape(part_txt)).strip(),
                            "links": [], "projects": []}
            parts.append(current_part)
            current_proj = None
            continue
        if proj_txt:
            title = re.sub(r"\s+", " ", html.unescape(proj_txt)).strip()
            current_proj = {"n": int(proj_no), "title": title, "links": []}
            if current_part is None:
                current_part = {"title": "", "links": [], "projects": []}
                parts.append(current_part)
            current_part["projects"].append(current_proj)
            continue
        if href:
            url = clean_href(href)
            if "nand2tetris.org" in url and "_files/ugd/" not in url:
                continue           # site chrome: nav and footer links
            kind = link_kind(src, url, report)
            label = KIND_LABEL[kind]
            if url.lower().endswith(".pdf"):
                label += " (PDF)"      # only claim PDF when it really is one
            entry = {"kind": kind, "label": label, "url": url}
            if current_proj is not None:
                current_proj["links"].append(entry)
            elif current_part is not None:
                current_part["links"].append(entry)
    return intro, parts


def site_blurb(fetcher, report):
    """The course's own one-paragraph description, quoted from the home page."""
    page = fetcher.get(HOME_URL)
    if not page:
        return ""
    page = re.sub(r"<script.*?</script>", "", page, flags=re.S)
    for run in RICH_TEXT.findall(page):
        t = normalise_body(html.unescape(run))
        if "this website contains" in t.lower():
            return trim_to_sentence(t)
    report["notes"].append("home page fetched but its description paragraph moved")
    return ""


# The version number contains a full stop, so a "[^.]* up to License"
# pattern stops dead at "3.0". Both of these are bounded and non-greedy.
LICENCE_PATTERNS = [
    r"(All [^<>]{0,200}?Creative Commons?\s+Attribution.{0,140}?License\.)",
    r"(Creative Commons?\s+Attribution.{0,140}?License)\.?",
]


def licence_note(fetcher, report):
    """The exact licence sentence, quoted from the site's licence page."""
    page = fetcher.get(LICENSE_URL)
    if not page:
        return ""
    page = re.sub(r"<script.*?</script>", "", page, flags=re.S)
    text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", page)))
    for pat in LICENCE_PATTERNS:
        m = re.search(pat, text)
        if m:
            note = m.group(1).strip()
            return note if note.endswith(".") else note + "."
    report["notes"].append("licence page fetched but the licence sentence moved")
    return ""


# ---------------------------------------------------------------- building
def slug(text):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text.lower())).strip("-")


def subtitle(title):
    """'Project 7: VM I: Stack Arithmetic' -> 'VM I: Stack Arithmetic'."""
    return title.split(":", 1)[1].strip() if ":" in title else title


def concepts_for(title):
    sub = subtitle(title)
    out = [slug(sub)]
    for piece in sub.split(":"):
        s = slug(piece)
        if s and s not in out:
            out.append(s)
    return out


def section(title, body):
    """Every section is empty of code on purpose: the source has none.

    `code` stays an empty string rather than a plausible-looking HDL or
    Jack snippet, because a plausible-looking snippet would be a
    fabrication. validate_content.py will flag it, and it should.
    """
    return {"title": title, "body": normalise_body(body), "code": "",
            "lang": "text", "annotations": []}


SCAFFOLD = ("**This is a project map entry, not a lesson.** Nand to Tetris "
            "publishes this project as PDF guidelines and a slide deck, which "
            "Grimoire does not text-extract. Nothing below summarises the "
            "material: open the link and read the original.")


def build_floor(proj, part_title, part_links, intro, report):
    n = proj["n"]
    title = proj["title"]
    by_kind = {}
    for l in proj["links"]:
        by_kind.setdefault(l["kind"], []).append(l)

    sections, todo = [], []

    # 1. the project itself
    guide = by_kind.get("guidelines", [])
    body = [SCAFFOLD,
            "%s, project %d of %d on the nand2tetris.org course page."
            % (part_title or "Nand to Tetris", n, EXPECTED_PROJECTS)]
    if guide:
        body.append("- **%s:** %s" % (guide[0]["label"], guide[0]["url"]))
    else:
        todo.append("no project-guidelines link found on the course page for "
                    "project %d - check the page structure" % n)
        report["missing_guidelines"].append(n)
    sections.append(section(title, "\n\n".join(body)))

    # 2. the slide deck
    slides = by_kind.get("slides", [])
    if slides:
        sections.append(section(
            "Lecture slides",
            "The lecture slides published for **%s**. Slide decks are not "
            "text-extracted by this importer.\n\n- **%s:** %s"
            % (title, slides[0]["label"], slides[0]["url"])))
    else:
        todo.append("no lecture-slides link found for project %d" % n)
        report["missing_slides"].append(n)

    # 3. the book chapter, where the page links one
    chapter = by_kind.get("chapter", [])
    if chapter:
        ch = chapter[0]
        how = ("It is a PDF: this importer does not extract PDF text"
               if ch["url"].lower().endswith(".pdf")
               else "This importer does not extract its text")
        sections.append(section(
            "Book chapter",
            "The course page links a chapter of **The Elements of Computing "
            "Systems** beside this project. %s, and the licence is "
            "share-alike non-commercial, so the chapter is linked, never "
            "copied.\n\n- **%s:** %s" % (how, ch["label"], ch["url"])))
    else:
        report["no_chapter"].append(n)

    # 4. part-level material, shown once at the top of each part
    if part_links:
        bullets = "\n".join("- **%s:** %s" % (l["label"], l["url"])
                            for l in part_links)
        sections.append(section(
            "Part resources",
            "Material the course page lists beside the **%s** heading, above "
            "the individual projects, labelled by the icon the page uses for "
            "each link.\n\n%s" % (part_title, bullets)))

    # 5. the course page's own words about how a project is put together
    if intro and n == 1 and len(sections) < 4:
        sections.append(section(
            "How the course is structured",
            "Quoted from nand2tetris.org/course:\n\n%s" % intro))

    sections = sections[:4]

    todo.insert(0, "lesson: no teaching text imported - the source is PDF and "
                   "slides only. Write 2-4 sections from the linked project "
                   "guidelines.")
    todo.append("lesson: every section has an empty `code` field - nothing "
                "runnable exists on the source page")
    todo.append("practice: author >= 6 challenges from project %d's guidelines. "
                "Do not reproduce solutions: the licence page asks that project "
                "solutions not be posted publicly." % n)
    todo.append("exam: author 8-12 questions")

    report["links"] += len(proj["links"]) + len(part_links)
    report["sections"] += len(sections)
    return {
        "n": n,
        "name": FLOOR_NAMES.get(n, "Floor %d" % n),
        "concepts": concepts_for(title),
        "lesson": {"sections": sections},
        "practice": [],
        "exam": [],
        "_todo": todo,
        "_part": part_title,
        "_resources": proj["links"] + part_links,
    }


def build_dungeon(fetcher, report):
    page = fetcher.get(COURSE_URL)
    if page is None:
        raise SystemExit("Could not fetch %s - nothing written." % COURSE_URL)

    intro, parts = parse_course(page, report)
    report["intro_found"] = bool(intro)
    report["parts"] = [p["title"] for p in parts if p["title"]]

    projects = []
    for p in parts:
        for pr in p["projects"]:
            projects.append((pr, p))
    projects.sort(key=lambda x: x[0]["n"])
    report["projects_found"] = [pr["n"] for pr, _ in projects]

    seen_part, floors = set(), []
    for pr, part in projects:
        part_links = [] if part["title"] in seen_part else part["links"]
        seen_part.add(part["title"])
        floors.append(build_floor(pr, part["title"], part_links, intro, report))

    return {
        "id": DUNGEON_ID,
        "name": "The Nand Ascent",
        "subject": "Computer Architecture",
        "category": "theory",
        "disciplineType": "systems",
        "sigil": "\u25a6",
        "unlock": None,
        "lang": "text",
        "runtime": "none",
        "source": "nand2tetris.org (CC BY-NC-SA 3.0)",
        "importedBy": "scripts/import_nand2tetris.py",
        "blurb": site_blurb(fetcher, report),
        "licenceNote": licence_note(fetcher, report),
        "_import": {
            "kind": "project map",
            "warning": "Structure only. The twelve floors carry the real "
                       "project titles and links from nand2tetris.org/course; "
                       "no teaching prose was imported, because the source "
                       "material is PDF and slide decks. Every floor's _todo "
                       "says what a human still has to write.",
            "courseUrl": COURSE_URL,
            "courseNote": intro,
            "courseNoteSource": "quoted verbatim from " + COURSE_URL,
        },
        "floors": floors,
    }


# --------------------------------------------------------------- syllabus
BEGIN = "<!-- GENERATED:BEGIN - import_nand2tetris.py rewrites this block -->"
END = "<!-- GENERATED:END -->"


def write_syllabus(dungeon, path):
    lines = ["# Syllabus - %s (%s)" % (dungeon["subject"], dungeon["name"]), "",
             "Derived from `%s`, read off %s." % (dungeon["source"], COURSE_URL),
             "",
             "**This is a project map, not a syllabus of imported lessons.** The",
             "titles and links below are real; the teaching text is not written",
             "yet. See each floor's `_todo` in `content/%s.json`." % dungeon["id"],
             "",
             "| Floor | Name | Project | Part | Links |",
             "|---|---|---|---|---|"]
    for f in dungeon["floors"]:
        proj = f["lesson"]["sections"][0]["title"] if f["lesson"]["sections"] else ""
        links = ", ".join(sorted(set(l["label"] for l in f["_resources"]))) or "none"
        lines.append("| %d | %s | %s | %s | %s |"
                     % (f["n"], f["name"], proj, f.get("_part") or "", links))
    lines += ["", "## Not imported", "",
              "- lesson prose for all 12 floors (the source is PDF and slides only)",
              "- code examples: 0 sections carry one",
              "- every practice challenge",
              "- every exam question", ""]
    block = BEGIN + "\n" + "\n".join(lines) + "\n" + END + "\n"

    # Authored notes outside the generated block survive a re-import.
    if os.path.exists(path):
        old = io.open(path, encoding="utf-8").read()
        if BEGIN in old and END in old:
            io.open(path, "w", encoding="utf-8").write(
                old.split(BEGIN)[0] + block + old.split(END, 1)[1])
            return
    io.open(path, "w", encoding="utf-8").write(block)


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--dry-run", action="store_true",
                    help="print the summary without writing files")
    args = ap.parse_args()

    report = {"links": 0, "sections": 0, "unknown_icons": [],
              "missing_guidelines": [], "missing_slides": [], "no_chapter": [],
              "notes": [], "parts": [], "projects_found": [],
              "intro_found": False}

    f = Fetcher(use_cache=not args.no_cache)
    print("importing nand2tetris.org/course ...")
    dungeon = build_dungeon(f, report)

    out_json = os.path.join(ROOT, "content", "%s.json" % DUNGEON_ID)
    out_syl = os.path.join(ROOT, "syllabi", "%s.md" % DUNGEON_ID)
    if not args.dry_run:
        os.makedirs(os.path.dirname(out_json), exist_ok=True)
        os.makedirs(os.path.dirname(out_syl), exist_ok=True)
        json.dump(dungeon, io.open(out_json, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
        write_syllabus(dungeon, out_syl)

    n_floors = len(dungeon["floors"])
    n_sec = sum(len(fl["lesson"]["sections"]) for fl in dungeon["floors"])
    n_prac = sum(len(fl["practice"]) for fl in dungeon["floors"])
    n_exam = sum(len(fl["exam"]) for fl in dungeon["floors"])
    n_code = sum(1 for fl in dungeon["floors"]
                 for s in fl["lesson"]["sections"] if s["code"].strip())
    todos = sum(len(fl["_todo"]) for fl in dungeon["floors"])
    missing = [n for n in range(1, EXPECTED_PROJECTS + 1)
               if n not in report["projects_found"]]

    print("")
    print("=" * 70)
    print("  IMPORT SUMMARY - nand2tetris.org (CC BY-NC-SA 3.0)")
    print("=" * 70)
    print("  network: %d fetched, %d from cache%s" % (
        f.misses, f.hits, ", %d failed" % len(f.failures) if f.failures else ""))
    print("  parts read from page          : %s"
          % (", ".join(report["parts"]) or "none"))
    print("  projects read from page       : %d of %d%s"
          % (len(report["projects_found"]), EXPECTED_PROJECTS,
             "" if not missing else "   MISSING %s" % missing))
    print("")
    print("  IMPORTED (structure and links only)")
    print("    floors                      : %d" % n_floors)
    print("    lesson sections             : %d  (%.1f per floor)"
          % (n_sec, n_sec / float(n_floors or 1)))
    print("    resource links              : %d" % report["links"])
    print("    verbatim site quotes        : course intro %s, blurb %s, licence %s"
          % ("yes" if report["intro_found"] else "NO",
             "yes" if dungeon["blurb"] else "NO",
             "yes" if dungeon["licenceNote"] else "NO"))
    print("")
    print("  *** NOT IMPORTED - AND NOT FAKED ***")
    print("    lesson prose                : 0 words of course material. The")
    print("                                  source is PDF guidelines, PDF book")
    print("                                  chapters and slide decks. Nothing")
    print("                                  was extracted, paraphrased or")
    print("                                  invented from them.")
    print("    code examples               : %d of %d sections have one" % (n_code, n_sec))
    print("    practice challenges         : %d  (needs >= 6 x %d floors = %d)"
          % (n_prac, n_floors, 6 * n_floors))
    print("    exam questions              : %d  (needs 8-12 x %d floors)"
          % (n_exam, n_floors))
    print("    total _todo entries         : %d" % todos)
    print("    projects with no chapter    : %s" % (report["no_chapter"] or "none"))
    if report["missing_guidelines"]:
        print("    projects with no guidelines : %s" % report["missing_guidelines"])
    if report["missing_slides"]:
        print("    projects with no slides     : %s" % report["missing_slides"])
    if report["unknown_icons"]:
        print("    unrecognised link icons     : %d (labelled 'Linked resource')"
              % len(report["unknown_icons"]))
    for note in report["notes"]:
        print("    note                        : %s" % note)
    if f.failures:
        print("    fetch failures              : %s" % "; ".join(f.failures[:5]))
    print("")
    print("  PER FLOOR")
    for fl in dungeon["floors"]:
        print("    %2d. %-22s %d sec  %d links  %-10s %s"
              % (fl["n"], fl["name"], len(fl["lesson"]["sections"]),
                 len(fl["_resources"]),
                 (fl.get("_part") or "").replace("Part ", "P")[:10],
                 ",".join(fl["concepts"])[:28]))
    print("")
    print("  VERDICT: link map, not a course. Usable as the dungeon's spine and")
    print("           as an honest pointer to the originals; it teaches nothing")
    print("           on its own. All 12 floors need a human author.")
    print("")
    if args.dry_run:
        print("  (dry run - nothing written)")
    else:
        print("  wrote %s" % os.path.relpath(out_json, ROOT))
        print("  wrote %s" % os.path.relpath(out_syl, ROOT))
    print("  content/index.json not touched - the caller regenerates it.")
    print("=" * 70)


if __name__ == "__main__":
    main()
