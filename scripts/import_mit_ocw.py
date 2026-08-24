#!/usr/bin/env python3
"""Import MIT OpenCourseWare lecture structure into Grimoire dungeon JSON.

    python scripts/import_mit_ocw.py                 # both courses
    python scripts/import_mit_ocw.py discrete-maths
    python scripts/import_mit_ocw.py --dry-run
    python scripts/import_mit_ocw.py --no-cache

Two courses, published by MIT OpenCourseWare under CC BY-NC-SA 4.0:

    discrete-maths   6.1200J Mathematics for Computer Science, Spring 2024
    linear-algebra   18.06  Linear Algebra, Spring 2010

WHAT THIS IMPORTER CAN AND CANNOT DO
------------------------------------
OCW publishes the actual teaching material for these two courses as PDF
lecture notes and as video. Neither is text this script can honestly turn into
a written lesson, so it does not try. What it *does* import is real fetched
text:

  - the lecture list, with MIT's own lecture titles           (video gallery)
  - MIT's one-paragraph description of each lecture           (resource pages)
  - the unit / topic grouping the course itself declares      (readings page)
  - the assigned textbook reading per lecture, where the
    source states it per lecture number                       (readings page)
  - links to the video, the YouTube copy and the notes PDF

The result is a **lecture map**: every floor points a learner at the real MIT
material and says what is in it, in MIT's words. It is not prose teaching, and
the summary at the end says so in as many words. Practice and exam arrays are
left empty with a `_todo`, because nothing in a lecture map grounds a question
- inventing them is the one thing this importer must not do.

Boilerplate paragraphs that OCW repeats on every video page (the "recorded in
Fall 1999" note, the textbook citation, the instructor credit) are detected by
frequency and dropped from the sections; they are reported once instead.

Source: ocw.mit.edu (CC BY-NC-SA 4.0). See content/attribution.md.
"""
import argparse
import html as htmllib
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "mit_ocw")
BASE = "https://ocw.mit.edu"
LICENCE = "CC BY-NC-SA 4.0"

# Sections per floor. The spec wants 2-4; one lecture makes one section, so
# this is also the maximum number of lectures a floor may cover.
MAX_SECTIONS = 4

COURSES = {
    "discrete-maths": {
        "slug": "6-1200j-mathematics-for-computer-science-spring-2024",
        "number": "6.1200J",
        "title": "Mathematics for Computer Science",
        "term": "Spring 2024",
        "subject": "Discrete Mathematics",
        "name": "The Sanctum of Proof",
        "sigil": "∀",
        "gallery": "video_galleries/lecture-videos/",
        "readings": "pages/readings/",
        "syllabus": "pages/syllabus/",
        "notes_list": "lists/lecture-notes/",
        "problem_sets": "lists/problem-sets/",
        "readings_style": "units",     # <h3>Unit N</h3> + one line per lecture
        "textbook": "Lehman, Leighton and Meyer, Mathematics for Computer Science",
    },
    "linear-algebra": {
        "slug": "18-06-linear-algebra-spring-2010",
        "number": "18.06",
        "title": "Linear Algebra",
        "term": "Spring 2010",
        "subject": "Linear Algebra",
        "name": "The Lattice of Spans",
        "sigil": "∑",
        "gallery": "video_galleries/video-lectures/",
        "readings": "pages/readings/",
        "syllabus": "pages/syllabus/",
        "notes_list": None,            # no lecture notes published
        "problem_sets": "pages/assignments/",
        "readings_style": "table",     # SES # | topics | readings
        "textbook": "Strang, Introduction to Linear Algebra",
    },
}

# A lecture whose title matches this closes a topic block: 18.06 has no unit
# headings, but the course marks its own boundaries with review lectures.
BLOCK_END = re.compile(r"(quiz\s*\d*\s*review|exam\s*\d*\s*review|course review)", re.I)

# A paragraph appearing on this many lecture pages is site boilerplate, not
# teaching about any one lecture.
BOILERPLATE_AT = 3


# --------------------------------------------------------------- fetching
def cache_key(url):
    """A filesystem-safe cache filename. Windows rejects ? : * " < > |."""
    return re.sub(r"[^A-Za-z0-9._-]", "_", url)[-180:]


class Fetcher:
    def __init__(self, use_cache=True):
        self.use_cache = use_cache
        self.hits = 0
        self.misses = 0
        self.failures = []

    def get(self, url):
        """Returns page text, or None if it is missing or unreachable."""
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
            if e.code != 404:
                self.failures.append("%s -> HTTP %s" % (url, e.code))
            return None
        except Exception as e:
            self.failures.append("%s -> %s" % (url, e))
            return None
        self.misses += 1
        os.makedirs(os.path.dirname(key), exist_ok=True)
        io.open(key, "w", encoding="utf-8").write(text)
        return text


# ----------------------------------------------------------- html -> text
def _anchors(s, keep_links):
    if keep_links:
        return re.sub(
            r'<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
            lambda m: "%s (%s)" % (re.sub(r"<[^>]+>", "", m.group(2)).strip(),
                                   m.group(1)),
            s, flags=re.S)
    return re.sub(r"<a\b[^>]*>(.*?)</a>", r"\1", s, flags=re.S)


def to_text(s, keep_links=False):
    """HTML -> the plain text the Grimoire renderer can show.

    Emphasis becomes **bold** (the renderer has no italics), anchors are
    flattened, everything else is dropped. Nothing is reworded.
    """
    s = re.sub(r"<(script|style)\b.*?</\1>", "", s, flags=re.S | re.I)
    s = _anchors(s, keep_links)
    s = re.sub(r"<(strong|b|em|i)\b[^>]*>(.*?)</\1>",
               lambda m: "**%s**" % re.sub(r"<[^>]+>", "", m.group(2)).strip(),
               s, flags=re.S | re.I)
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</p\s*>", "\n\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = htmllib.unescape(s)
    s = s.replace("\xa0", " ").replace("​", "").replace("﻿", "")
    s = re.sub(r"\*\*\s*\*\*", "", s)
    s = re.sub(r"[ \t]+", " ", s)
    return re.sub(r"\n{3,}", "\n\n", s).strip()


def normalise_body(text):
    """Bring text into the renderer's subset: **bold**, `code`, blanks, "- ".

    LaTeX between $...$ is deliberately untouched - the app renders it.
    """
    text = re.sub(r"^\s*\|.*\|\s*$", "", text, flags=re.M)      # tables
    text = re.sub(r"^\s*>\s?", "", text, flags=re.M)            # block quotes
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)            # images
    text = re.sub(r"\[([^\]]+)\]\[[^\]]*\]", r"\1", text)       # ref links
    text = re.sub(r"\[([^\]]+)\]\(([^)]*)\)", r"\1", text)      # inline links
    text = re.sub(r"^\[[^\]]+\]:\s*\S+\s*$", "", text, flags=re.M)
    text = re.sub(r"^#{1,6}\s+(.+?)\s*$", r"**\1**", text, flags=re.M)
    text = re.sub(r"(?<![A-Za-z0-9_])_([^_\n]+)_(?![A-Za-z0-9_])", r"**\1**", text)
    text = re.sub(r"^\s*[*+•]\s+", "- ", text, flags=re.M)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def main_content(page):
    m = re.search(r'<main id="course-content-section">(.*?)</main>', page, re.S)
    return m.group(1) if m else ""


def absolute(href):
    if not href:
        return None
    return href if href.startswith("http") else BASE + href


# --------------------------------------------------------------- parsing
def parse_gallery(page):
    """The course's own lecture list: title, resource page, YouTube id."""
    out = []
    for card in page.split("video-gallery-card")[1:]:
        m_url = re.search(r'<a class="video-link" href="([^"]+)"', card)
        m_ttl = re.search(r'<h5 class="video-title">(.*?)</h5>', card, re.S)
        if not (m_url and m_ttl):
            continue
        raw = to_text(m_ttl.group(1))
        m_yt = re.search(r"img\.youtube\.com/vi/([^/]+)/", card)
        m_no = re.match(r"^Lecture\s+(\d+[a-zA-Z]?)\s*[:.–-]\s*(.*)$", raw)
        label = m_no.group(1) if m_no else str(len(out) + 1)
        title = m_no.group(2).strip() if m_no else raw
        out.append({
            "label": label,
            # only a plain number keys the notes and readings tables: 18.06's
            # "24b" is a second lecture 24, not the one the tables mean
            "no": int(label) if label.isdigit() else None,
            "title": title,
            "full": raw,
            "url": absolute(m_url.group(1)),
            "youtube": ("https://www.youtube.com/watch?v=%s" % m_yt.group(1)
                        if m_yt else None),
        })
    return out


def parse_notes_list(page):
    """lists/lecture-notes/ -> {lecture number: {pdf, page, title}}."""
    notes = {}
    for block in page.split('class="resource-item')[1:]:
        m_pdf = re.search(r'<a class="resource-thumbnail" href="([^"]+)"', block)
        m_ttl = re.search(r'<a class="resource-list-title" href="([^"]+)">(.*?)</a>',
                          block, re.S)
        if not m_ttl:
            continue
        title = to_text(m_ttl.group(2))
        m_no = re.search(r"Lecture\s*0*(\d+)", title)
        if not m_no:
            continue
        notes[int(m_no.group(1))] = {
            "pdf": absolute(m_pdf.group(1)) if m_pdf else None,
            "page": absolute(m_ttl.group(1)),
            "title": title,
        }
    return notes


def parse_readings_units(page):
    """6.1200J readings: <h3>Unit N: Topic</h3> then one line per lecture.

    Gives both the course's own topic grouping and the assigned sections.
    """
    body = main_content(page)
    parts = re.split(r"<h3[^>]*>(.*?)</h3>", body, flags=re.S)
    intro = to_text(parts[0], keep_links=True) if parts else ""
    units, readings = [], {}
    for i in range(1, len(parts) - 1, 2):
        unit = re.sub(r"\s*:\s*$", "", to_text(parts[i])).strip()
        unit = unit.strip("*").strip()
        lectures = []
        for line in to_text(parts[i + 1]).split("\n"):
            line = line.replace("**", "").strip()
            # greedy title, so a lecture title containing ':' keeps it
            m = re.match(r"Lecture\s*0*(\d+)\s*[-–—]\s*(.*):\s*(.*)$", line)
            if not m:
                continue
            n = int(m.group(1))
            lectures.append(n)
            readings[n] = m.group(3).strip()
        if lectures:
            units.append({"title": unit, "lectures": lectures})
    return intro, units, readings


def parse_readings_table(page):
    """18.06 readings: a SES # / topics / readings table, taken verbatim."""
    body = main_content(page)
    intro = to_text(body.split("<table")[0], keep_links=True)
    rows = []
    for chunk_ in re.split(r"<tr>", body)[1:]:
        cells = [to_text(c) for c in re.findall(r"<td>(.*?)</td>", chunk_, re.S)]
        if len(cells) >= 2 and re.match(r"^\d+$", cells[0]):
            rows.append({
                "ses": cells[0],
                "topic": cells[1].replace("**", "").strip(),
                "reading4": cells[2].strip() if len(cells) > 2 else "",
                "reading5": cells[3].strip() if len(cells) > 3 else "",
            })
    return intro, rows


def parse_description(page):
    """The lecture description OCW writes above the player, as paragraphs."""
    m = re.search(r'<div class="description">(.*?)</div>', page, re.S)
    if not m:
        return []
    paras = re.findall(r"<p>(.*?)</p>", m.group(1), re.S) or [m.group(1)]
    out = []
    for p in paras:
        t = normalise_body(to_text(p))
        if t:
            out.append(t)
    return out


def parse_course_home(page):
    """Course blurb and instructors from the course landing page.

    A long description is published twice, collapsed and expanded, with a
    "Show more" button inside it; the expanded copy is the whole text.
    """
    blurb = ""
    for div in ("full-description", "expanded-description", "collapsed-description"):
        m = re.search(r'<div id="%s"[^>]*>(.*?)</div>' % div, page, re.S)
        if m:
            raw = re.sub(r"<button\b.*?</button>", "", m.group(1), flags=re.S | re.I)
            blurb = normalise_body(to_text(raw))
            if blurb:
                break
    # the desktop and mobile course-info panels each list the instructors
    people, seen = [], set()
    for x in re.findall(r'class="course-info-instructor[^"]*"[^>]*>(.*?)</a>',
                        page, re.S):
        name = to_text(x)
        if name and name not in seen:
            seen.add(name)
            people.append(name)
    return blurb, people


# --------------------------------------------------------------- grouping
def chunk(items, cap=MAX_SECTIONS):
    """Split a topic block into floors of at most `cap` lectures, evenly.

    Even splitting matters: a trailing floor holding a single lecture would be
    a one-section lesson, which the content spec rejects.
    """
    n = len(items)
    if not n:
        return []
    k = max(1, (n + cap - 1) // cap)
    base, extra = divmod(n, k)
    out, i = [], 0
    for f in range(k):
        take = base + (1 if f >= k - extra else 0)
        out.append(items[i:i + take])
        i += take
    return out


def range_name(piece):
    if len(piece) == 1:
        return "Lecture %s" % piece[0]["label"]
    return "Lectures %s–%s" % (piece[0]["label"], piece[-1]["label"])


def group_by_units(lectures, units):
    """6.1200J: the readings page states the units; keep its grouping."""
    by_no = {l["no"]: l for l in lectures}
    groups, claimed = [], set()
    for u in units:
        got = [by_no[n] for n in u["lectures"] if n in by_no]
        if not got:
            continue
        claimed.update(l["no"] for l in got)
        pieces = chunk(got)
        for piece in pieces:
            name = u["title"]
            if len(pieces) > 1:
                name = "%s (%s)" % (u["title"], range_name(piece).lower())
            groups.append({"name": name, "lectures": piece, "unit": u["title"]})
    left = [l for l in lectures if l["no"] not in claimed]
    for piece in chunk(left):
        groups.append({"name": range_name(piece), "lectures": piece, "unit": None})
    return groups


def group_by_review_blocks(lectures):
    """18.06: no unit headings, but the course marks its own boundaries.

    Each 'Quiz N review' / 'Final course review' lecture ends a block. Blocks
    are then cut into floors of at most MAX_SECTIONS lectures, in order.
    """
    blocks, cur = [], []
    for l in lectures:
        cur.append(l)
        if BLOCK_END.search(l["title"]):
            blocks.append(cur)
            cur = []
    if cur:
        blocks.append(cur)
    groups = []
    for b in blocks:
        for piece in chunk(b):
            groups.append({"name": range_name(piece), "lectures": piece,
                           "unit": None})
    return groups


# --------------------------------------------------------------- building
def resource_card(lec, notes, reading, textbook):
    """The section's `code` block: a citation card, not source code.

    Every section needs a code block and a maths lecture map has no code.
    Rather than invent one, the block carries the resource's own coordinates
    so a learner can copy a link straight out of it.
    """
    lines = ["Lecture %s — %s" % (lec["label"], lec["title"]),
             "video:   %s" % lec["url"]]
    if lec.get("youtube"):
        lines.append("youtube: %s" % lec["youtube"])
    if notes and notes.get("pdf"):
        lines.append("notes:   %s" % notes["pdf"])
    if reading:
        lines.append("reading: %s" % reading)
        lines.append("         (%s)" % textbook)
    return "\n".join(lines)


def map_disclaimer(course):
    """Said once per floor, so a learner is never told this is a lesson."""
    if course["notes_list"]:
        return ("This floor is a **lecture map**, not a written lesson. MIT "
                "OpenCourseWare publishes the %s lecture notes as PDFs, so the "
                "links in each section are the lesson." % course["number"])
    return ("This floor is a **lecture map**, not a written lesson. MIT "
            "OpenCourseWare publishes %s as recorded video lectures, so the "
            "links in each section are the lesson." % course["number"])


def build_section(lec, notes, reading, descriptions, course, lead):
    """One lecture -> one lesson section. Every word here was fetched."""
    body = list(descriptions)
    if not descriptions:
        body.append("MIT OpenCourseWare publishes no written description for "
                    "this lecture; the recording is the material.")
    links = ["**On MIT OpenCourseWare**", "", "- Video lecture: %s" % lec["url"]]
    if lec.get("youtube"):
        links.append("- YouTube: %s" % lec["youtube"])
    if notes and notes.get("pdf"):
        links.append("- Lecture notes (PDF): %s" % notes["pdf"])
    if reading:
        links.append("- Assigned reading (%s): %s" % (course["textbook"], reading))
    body.append("\n".join(links))
    if lead:
        body.append(map_disclaimer(course))
    return {
        "title": "Lecture %s: %s" % (lec["label"], lec["title"]),
        "body": normalise_body("\n\n".join(b for b in body if b)),
        "code": resource_card(lec, notes, reading, course["textbook"]),
        "lang": "text",
        "annotations": [],
    }


def build_floor(n, group, notes_by_no, readings, descs, course, report):
    sections, todos = [], []
    for i, lec in enumerate(group["lectures"]):
        notes = notes_by_no.get(lec["no"])
        reading = readings.get(lec["no"])
        d = descs.get(lec["url"], [])
        if not d:
            report["no_description"].append("L%s" % lec["label"])
            todos.append("lecture %s has no OCW description; its section is "
                         "links only" % lec["label"])
        if course["notes_list"] and not notes:
            report["no_notes"].append("L%s" % lec["label"])
            todos.append("no lecture notes PDF published for lecture %s"
                         % lec["label"])
        if reading:
            report["readings_attached"] += 1
        sections.append(build_section(lec, notes, reading, d, course, lead=(i == 0)))

    ps = None
    if course["problem_sets"]:
        ps = "%s/courses/%s/%s" % (BASE, course["slug"], course["problem_sets"])
    todos.insert(0, "lesson: lecture map only - the source publishes its notes as "
                    "PDF/video, which this importer does not transcribe; write "
                    "prose from the linked material if the floor needs it")
    todos.append("practice: author 6+ challenges grounded in the linked lecture "
                 "material%s; none imported, none invented"
                 % (" and problem sets (%s)" % ps if ps else ""))
    todos.append("exam: author 8-12 questions")
    return {
        "n": n,
        "name": group["name"],
        "concepts": [l["title"] for l in group["lectures"]],
        "lectures": [l["label"] for l in group["lectures"]],
        "lesson": {"sections": sections},
        "practice": [],
        "exam": [],
        "_todo": todos,
    }


def strip_boilerplate(desc_by_url, report):
    """Drop paragraphs OCW repeats across lecture pages.

    The 18.06 pages carry the same footer on all 35 lectures; counting
    occurrences separates a lecture's own description from the furniture.
    """
    counts = {}
    for paras in desc_by_url.values():
        for p in set(paras):
            counts[p] = counts.get(p, 0) + 1
    dropped = {p for p, c in counts.items() if c >= BOILERPLATE_AT}
    report["boilerplate"] = sorted(dropped)
    out = {}
    for url, paras in desc_by_url.items():
        kept = [p for p in paras if p not in dropped]
        report["paragraphs_dropped"] += len(paras) - len(kept)
        report["paragraphs_kept"] += len(kept)
        out[url] = kept
    return out


def build_dungeon(cid, course, f, report):
    course_url = "%s/courses/%s/" % (BASE, course["slug"])
    home = f.get(course_url)
    if home is None:
        raise SystemExit("could not fetch %s" % course_url)
    blurb, people = parse_course_home(home)

    gallery_url = course_url + course["gallery"]
    gallery = f.get(gallery_url)
    if gallery is None:
        raise SystemExit("could not fetch the lecture list at %s" % gallery_url)
    lectures = parse_gallery(gallery)
    report["lectures"] = len(lectures)
    if not lectures:
        raise SystemExit("no lectures found at %s" % gallery_url)

    readings_url = course_url + course["readings"]
    readings_page = f.get(readings_url) or ""
    units, readings, table = [], {}, []
    if course["readings_style"] == "units":
        notes_intro, units, readings = parse_readings_units(readings_page)
    else:
        notes_intro, table = parse_readings_table(readings_page)
    report["units"] = len(units)
    report["reading_rows"] = len(table)

    notes_by_no = {}
    if course["notes_list"]:
        notes_page = f.get(course_url + course["notes_list"]) or ""
        notes_by_no = parse_notes_list(notes_page)
    report["notes_pdfs"] = len(notes_by_no)

    # one fetch per lecture page - this is where the real prose comes from
    descs = {}
    for lec in lectures:
        page = f.get(lec["url"])
        descs[lec["url"]] = parse_description(page) if page else []
    descs = strip_boilerplate(descs, report)
    report["with_description"] = sum(1 for v in descs.values() if v)

    groups = (group_by_units(lectures, units) if units
              else group_by_review_blocks(lectures))
    floors = [build_floor(i + 1, g, notes_by_no, readings, descs, course, report)
              for i, g in enumerate(groups)]

    shape = ("lecture map: MIT's lecture titles, MIT's own lecture descriptions "
             "and links. " + ("The lecture notes are PDFs on MIT OpenCourseWare "
                              "and are not transcribed here."
                              if course["notes_list"] else
                              "The teaching itself is the recorded video and the "
                              "assigned textbook; neither is reproduced here."))
    dungeon = {
        "id": cid,
        "name": course["name"],
        "subject": course["subject"],
        "category": "theory",
        "disciplineType": "mathematics",
        "sigil": course["sigil"],
        "unlock": None,
        "lang": "text",
        "runtime": "none",
        "source": "MIT OpenCourseWare %s %s, %s (%s)" % (
            course["number"], course["title"], course["term"], LICENCE),
        "sourceUrl": course_url,
        "licence": LICENCE,
        "importedBy": "scripts/import_mit_ocw.py",
        "instructors": people,
        "blurb": blurb,
        "notes": normalise_body(notes_intro),
        "_shape": shape,
        "_sources": {
            "course": course_url,
            "lectures": gallery_url,
            "readings": readings_url,
            "syllabus": course_url + course["syllabus"],
            "lectureNotes": (course_url + course["notes_list"]
                             if course["notes_list"] else None),
            "problemSets": (course_url + course["problem_sets"]
                            if course["problem_sets"] else None),
        },
        "floors": floors,
    }
    if table:
        dungeon["_readings"] = table
        dungeon["_readingsNote"] = (
            "Session numbering in the 18.06 readings table does not line up "
            "one-to-one with the recorded video lectures, so readings are not "
            "attached per lecture. The table is kept verbatim; see %s."
            % readings_url)
    return dungeon


# ------------------------------------------------------------------ main
def new_report():
    return {"lectures": 0, "units": 0, "reading_rows": 0, "notes_pdfs": 0,
            "with_description": 0, "readings_attached": 0,
            "paragraphs_kept": 0, "paragraphs_dropped": 0, "boilerplate": [],
            "no_description": [], "no_notes": []}


def summarise(cid, course, dungeon, report, f, out_path, dry_run):
    floors = dungeon["floors"]
    n_sec = sum(len(fl["lesson"]["sections"]) for fl in floors)
    n_prac = sum(len(fl["practice"]) for fl in floors)
    n_exam = sum(len(fl["exam"]) for fl in floors)
    todos = sum(len(fl["_todo"]) for fl in floors)
    print("")
    print("=" * 74)
    print("  IMPORT SUMMARY - MIT OCW %s %s  ->  content/%s.json"
          % (course["number"], course["title"], cid))
    print("=" * 74)
    print("  network: %d fetched, %d from cache%s" % (
        f.misses, f.hits, ", %d failed" % len(f.failures) if f.failures else ""))
    print("  licence: %s - attributed in `source`, nothing relicensed" % LICENCE)
    print("")
    print("  IMPORTED  (fetched text only - the importer wrote no teaching text)")
    print("    lectures in the course         : %d" % report["lectures"])
    print("    floors built                   : %d" % len(floors))
    print("    lesson sections                : %d  (one per lecture, max %d/floor)"
          % (n_sec, MAX_SECTIONS))
    print("    lectures with an MIT description: %d of %d"
          % (report["with_description"], report["lectures"]))
    print("    description paragraphs kept    : %d" % report["paragraphs_kept"])
    print("    lecture-notes PDFs linked      : %d" % report["notes_pdfs"])
    print("    per-lecture readings attached  : %d" % report["readings_attached"])
    print("    topic grouping taken from      : %s"
          % ("%d units on the readings page" % report["units"] if report["units"]
             else "the review-lecture boundaries in the lecture list"))
    if report["reading_rows"]:
        print("    readings table rows kept       : %d (verbatim, in `_readings`)"
              % report["reading_rows"])
    print("")
    print("  NOT IMPORTED - AND NOT FAKED")
    if course["notes_list"]:
        print("    lecture notes are PDFs: no PDF text extracted, sections link out")
    else:
        print("    no lecture notes published: the lecture *is* the video, and the")
        print("    textbook is not open, so sections link out instead")
    print("    practice challenges            : %d (every floor carries a _todo)"
          % n_prac)
    print("    exam questions                 : %d (every floor carries a _todo)"
          % n_exam)
    print("    repeated boilerplate dropped   : %d paragraph copies, %d distinct"
          % (report["paragraphs_dropped"], len(report["boilerplate"])))
    if report["no_description"]:
        print("    lectures with no description   : %s"
              % ", ".join(report["no_description"]))
    if report["no_notes"]:
        print("    lectures with no notes PDF     : %s"
              % ", ".join(report["no_notes"]))
    print("    total _todo entries            : %d" % todos)
    if f.failures:
        print("    fetch failures                 : %s" % "; ".join(f.failures[:5]))
    print("")
    print("  PER FLOOR")
    for fl in floors:
        print("    %2d. %-44s %d sections  lectures %s"
              % (fl["n"], fl["name"][:44], len(fl["lesson"]["sections"]),
                 ",".join(fl["lectures"])))
    print("")
    print("  VERDICT: a lecture map, not prose teaching. The titles, MIT's own")
    print("  lecture descriptions%s and the links are real; the lessons behind"
          % (", the readings" if report["readings_attached"] else ""))
    print("  them stay as PDF and video on ocw.mit.edu.")
    if dry_run:
        print("  (dry run - nothing written)")
    else:
        print("  wrote %s" % os.path.relpath(out_path, ROOT))
    print("  next: python scripts/validate_content.py %s" % cid)
    print("=" * 74)


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("course", nargs="?", choices=sorted(COURSES) + ["all"],
                    default="all", help="dungeon id to import (default: all)")
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--dry-run", action="store_true",
                    help="print the summary without writing files")
    args = ap.parse_args()

    ids = sorted(COURSES) if args.course == "all" else [args.course]
    wrote = False
    for cid in ids:
        course = COURSES[cid]
        f = Fetcher(use_cache=not args.no_cache)
        report = new_report()
        print("importing MIT OCW %s %s ..." % (course["number"], course["title"]))
        dungeon = build_dungeon(cid, course, f, report)
        out_path = os.path.join(ROOT, "content", "%s.json" % cid)
        if not args.dry_run:
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            json.dump(dungeon, io.open(out_path, "w", encoding="utf-8"),
                      ensure_ascii=False, indent=1)
            wrote = True
        summarise(cid, course, dungeon, report, f, out_path, args.dry_run)
    if wrote:
        print("")
        print("  content/index.json is NOT touched by this importer - the caller"
              " regenerates it.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
