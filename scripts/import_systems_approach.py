#!/usr/bin/env python3
"""Import *Computer Networks: A Systems Approach* into a Grimoire dungeon.

    python scripts/import_systems_approach.py
    python scripts/import_systems_approach.py --dry-run
    python scripts/import_systems_approach.py --no-cache

Reads the book's `index.rst` toctree for chapter order, each chapter's own
toctree for its section files, then parses the reStructuredText: headers are
lines underlined with =, -, ~ or ^; `.. code-block::` directives and `::`
literal blocks become the code example; the prose is converted into the body
subset the renderer understands (**bold**, `code`, blank-line paragraphs,
"- " bullets, and $LaTeX$ left exactly as written).

One floor per chapter, in book order. Nothing is emitted that was not read
out of the source:

  - Figures are PNGs and cannot be reproduced, so every lesson section links
    back to the chapter it came from, where the figures live.
  - Practice and exam challenges are left EMPTY with a _todo. A question this
    importer invented would not be grounded in the book, and the whole point
    of importing a real textbook is that the content is real.

Source: github.com/SystemsApproach/book (CC BY 4.0), branch master.
Larry Peterson and Bruce Davie. See content/attribution.md.
"""
import argparse
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "systems_approach")

REPO = "SystemsApproach/book"
BRANCH = "master"
RAW = "https://raw.githubusercontent.com/%s/%s/%%s" % (REPO, BRANCH)
TREE = "https://api.github.com/repos/%s/git/trees/%s?recursive=1" % (REPO, BRANCH)
BOOK = "https://book.systemsapproach.org/%s.html"
LICENCE = "CC BY 4.0"

# Front and back matter carry no teaching content; they are not chapters.
NOT_A_CHAPTER = {"index", "foreword", "foreword_1e", "preface", "README",
                 "latest", "print", "status", "CLA", "CONTRIBUTING"}

# Dungeon flavour. Nine chapters, nine floors, in the book's own order; the
# floor names are Grimoire scaffolding, the chapter titles underneath them
# are the book's own.
FLOOR_NAMES = {
    "foundation":      "Threshold of the Weave",
    "direct":          "The Copper Catacombs",
    "internetworking": "The Bridged Warrens",
    "scaling":         "Halls of Great Scale",
    "e2e":             "Vault of the Byte Stream",
    "congestion":      "The Throttled Deep",
    "data":            "Chamber of Encoded Forms",
    "security":        "The Ciphered Sanctum",
    "applications":    "The Cathedral of Services",
}

MAX_SECTIONS = 4         # the schema caps a lesson at four sections
MIN_SECTIONS = 2
BODY_BUDGET = 3000       # characters of prose per section, cut on a paragraph
MIN_BODY = 300
MAX_CODE_LINES = 34
INLINE_CODE_LINES = 4    # short examples stay in the prose as inline code
MIN_FILL_SECTIONS = 3    # top a floor up to this many even without examples

# Figures are PNGs in the repo and cannot be reproduced in a lesson body, so
# a reference to one says so instead of pointing at nothing.
FIGURE_PHRASE = "the figure in the source chapter"


def cache_key(name):
    """A filesystem-safe cache filename. Windows rejects ? : * " < > |."""
    return re.sub(r'[^A-Za-z0-9._-]', "_", name)[-180:]


class Fetcher:
    def __init__(self, use_cache=True):
        self.use_cache = use_cache
        self.hits = self.misses = 0
        self.failures = []

    def _read(self, url, key):
        path = os.path.join(CACHE, cache_key(key))
        if self.use_cache and os.path.exists(path):
            self.hits += 1
            return io.open(path, encoding="utf-8").read()
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "grimoire-importer"})
            with urllib.request.urlopen(req, timeout=45) as r:
                text = r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            self.failures.append("%s -> HTTP %s" % (key, e.code))
            return None
        except Exception as e:                       # reported, never silent
            self.failures.append("%s -> %s" % (key, e))
            return None
        self.misses += 1
        os.makedirs(os.path.dirname(path), exist_ok=True)
        io.open(path, "w", encoding="utf-8").write(text)
        return text

    def rst(self, path):
        return self._read(RAW % path, path)

    def tree(self):
        raw = self._read(TREE, "_git_tree.json")
        if raw is None:
            return []
        try:
            data = json.loads(raw)
        except ValueError:
            return []
        return [t["path"] for t in data.get("tree", []) if t.get("type") == "blob"]


# ------------------------------------------------------------ rst structure
UNDERLINE = set("=-~^\"'`#*+_:.<>")
DIRECTIVE = re.compile(r'^(\s*)\.\.\s+([a-zA-Z][\w+-]*)::\s*(.*)$')
COMMENT = re.compile(r'^(\s*)\.\.(\s|$)')
BULLET = re.compile(r'^(\s*)([-*•])\s+(.*)$')
ENUM = re.compile(r'^(\s*)(\d+\.|#\.)\s+(.*)$')
TABLE_RULE = re.compile(r'^\s*(\+[-=+]{2,}\+|[=-]{2,}(\s+[=-]{2,})+)\s*$')

# Directives whose body is prose worth keeping; the argument is its title.
KEEP_DIRECTIVES = {"admonition", "sidebar", "note", "important", "warning"}
# Directives that are pictures, layout, or cross-reference plumbing.
DROP_DIRECTIVES = {"figure", "image", "table", "centered", "toctree", "index",
                   "only", "raw", "contents", "rubric", "literalinclude",
                   "csv-table", "list-table", "epigraph", "highlight",
                   "container", "topic", "line-block"}
CODE_DIRECTIVES = {"code-block", "code", "sourcecode", "parsed-literal"}


def is_underline(line):
    s = line.rstrip()
    return len(s) >= 3 and s[0] in UNDERLINE and s == s[0] * len(s)


def find_headers(lines):
    """(index, underline char, title) for every underlined section header."""
    out = []
    for i in range(len(lines) - 1):
        title = lines[i].rstrip()
        if not title.strip() or title[:1].isspace():
            continue
        if is_underline(title):                       # an underline, not a title
            continue
        if not is_underline(lines[i + 1]):
            continue
        if len(lines[i + 1].rstrip()) < len(title) - 2:
            continue
        if i and lines[i - 1].strip():                # headers stand alone
            continue
        out.append((i, lines[i + 1].rstrip()[0], title.strip()))
    return out


def parse_rst(text):
    """Flat list of {level, title, lines}; level from underline-char order."""
    lines = text.replace("\r\n", "\n").replace("\u00a0", " ").split("\n")
    heads = find_headers(lines)
    order = []
    for _, ch, _t in heads:
        if ch not in order:
            order.append(ch)
    nodes = []
    for k, (i, ch, title) in enumerate(heads):
        end = heads[k + 1][0] if k + 1 < len(heads) else len(lines)
        nodes.append({"level": order.index(ch) + 1,
                      "title": title,
                      "lines": lines[i + 2:end]})
    return nodes


def consume_indented(lines, i, base):
    """Body of a directive or an indented block: blanks plus deeper lines."""
    body = []
    while i < len(lines):
        s = lines[i]
        if not s.strip():
            body.append("")
            i += 1
            continue
        if len(s) - len(s.lstrip()) <= base:
            break
        body.append(s)
        i += 1
    while body and not body[-1].strip():
        body.pop()
    return body, i


def consume_block(lines, i):
    """One indented block: every line at least as indented as its first.

    A literal block ends where the prose returns to the left margin, so the
    paragraph that follows an example is kept rather than swallowed by it.
    """
    col = len(lines[i]) - len(lines[i].lstrip())
    body = []
    while i < len(lines):
        s = lines[i]
        if not s.strip():
            body.append("")
            i += 1
            continue
        if len(s) - len(s.lstrip()) < col:
            break
        body.append(s)
        i += 1
    while body and not body[-1].strip():
        body.pop()
    return body, i


def dedent(block):
    pad = min([len(l) - len(l.lstrip()) for l in block if l.strip()] or [0])
    return [l[pad:] if l.strip() else "" for l in block]


def toctree_entries(text):
    """The .rst files a toctree lists, in order."""
    lines = text.split("\n")
    out, i = [], 0
    while i < len(lines):
        m = DIRECTIVE.match(lines[i])
        if m and m.group(2) == "toctree":
            body, i = consume_indented(lines, i + 1, len(m.group(1)))
            for b in body:
                s = b.strip()
                if not s or s.startswith(":"):
                    continue
                out.append(s if s.endswith(".rst") else s + ".rst")
            continue
        i += 1
    return out


# --------------------------------------------------------- inline conversion
def inline(t):
    """RST inline markup -> the renderer's subset. Nothing is added."""
    lits, strongs = [], []

    def keep_lit(m):
        lits.append(m.group(1))
        return "\x00L%d\x00" % (len(lits) - 1)

    t = re.sub(r'``(.+?)``', keep_lit, t, flags=re.S)

    def keep_strong(m):
        strongs.append(m.group(1))
        return "\x00S%d\x00" % (len(strongs) - 1)

    t = re.sub(r'\*\*(.+?)\*\*', keep_strong, t, flags=re.S)

    # Roles. $...$ is handed straight through to KaTeX, exactly as written.
    t = re.sub(r':math:`(.+?)`', lambda m: "$" + m.group(1) + "$", t, flags=re.S)
    t = re.sub(r':sup:`(.+?)`', r'^\1', t, flags=re.S)
    t = re.sub(r':sub:`(.+?)`', r'_\1', t, flags=re.S)
    # Figures are images; they are not reproduced, so say so rather than
    # leaving the reader hunting for a picture that is not there.
    t = re.sub(r':numref:`[^`]*`', FIGURE_PHRASE, t, flags=re.S)
    t = re.sub(r':ref:`([^`<]*?)\s*<[^`>]*>`', r'\1', t, flags=re.S)
    t = re.sub(r':[a-zA-Z][\w:+.-]*:`([^`]*)`', r'\1', t, flags=re.S)

    # Links: `text <url>`_ and `text`_ keep the text, drop the target.
    t = re.sub(r'`([^`<]+?)\s*<[^`>]+>`__?', r'\1', t, flags=re.S)
    t = re.sub(r'`([^`]+?)`__?', r'\1', t, flags=re.S)
    t = re.sub(r'\[[#*]?[\w-]*\]_', "", t)           # footnote references

    # *emphasis* -> **emphasis**; ** ** is masked out above, so this is safe.
    t = re.sub(r'(?<![*\w\\])\*([^*\n]+?)\*(?![*\w])', r'**\1**', t)

    t = t.replace("\\ ", "").replace("\\*", "*").replace("\\|", "|")
    t = re.sub(r'(^|(?<=[.!?] ))' + FIGURE_PHRASE,
               "The" + FIGURE_PHRASE[3:], t)          # sentence-initial
    t = re.sub(r'\x00S(\d+)\x00', lambda m: "**%s**" % strongs[int(m.group(1))], t)
    t = re.sub(r'\x00L(\d+)\x00',
               lambda m: "`%s`" % lits[int(m.group(1))].replace("`", "'"), t)
    return re.sub(r'[ \t]+', " ", t).strip()


def clean_title(title):
    """`1.4.1 Socket API` -> `Socket API`.

    The repeat is not paranoia: the book has headings like `3.4 2
    Distance-Vector (RIP)` where the numbering lost a dot.
    """
    t = inline(title)
    t = re.sub(r'^(\d+(\.\d+)*\.?\s+)+', "", t)
    return re.sub(r'\s+', " ", t).strip()


# Titles that mean nothing on their own once they are lifted out of the
# chapter they sit in.
GENERIC_TITLES = {
    "introduction", "overview", "implementation", "performance", "summary",
    "packet format", "segment format", "frame format", "service model",
    "addresses and routing", "evaluation criteria", "access protocol",
    "design", "architecture", "issues", "example", "examples", "history",
    "motivation", "background", "operation", "encoding", "formatting",
}


def qualify(title, file_title, chapter_name):
    """`Implementation` -> `Internetworking: Implementation`."""
    if title.lower() not in GENERIC_TITLES:
        return title
    prefix = file_title if file_title.lower() != title.lower() else chapter_name
    return "%s: %s" % (prefix, title) if prefix else title


# ---------------------------------------------------------- block conversion
def parse_blocks(lines, stats):
    """RST body lines -> [{type: para|bullets|code|heading, ...}]."""
    out = []
    i, n = 0, len(lines)
    pending_literal = False

    while i < n:
        raw = lines[i]
        if not raw.strip():
            i += 1
            continue

        if TABLE_RULE.match(raw):                     # a table has no subset form
            stats["tables"] += 1
            while i < n and lines[i].strip():
                i += 1
            continue

        m = DIRECTIVE.match(raw)
        if m:
            indent, name, arg = len(m.group(1)), m.group(2).lower(), m.group(3)
            body, i = consume_indented(lines, i + 1, indent)
            body = [b for b in body if not re.match(r'^\s*:[\w-]+:(\s|$)', b)]
            if name in CODE_DIRECTIVES:
                text = "\n".join(dedent(body)).strip("\n")
                if text.strip():
                    out.append({"type": "code", "kind": "directive",
                                "lang": (arg.strip() or "text").lower(),
                                "text": text})
                    stats["code_blocks"] += 1
            elif name == "math":
                tex = " ".join(x.strip() for x in body if x.strip())
                if tex:
                    out.append({"type": "para", "text": "$$" + tex + "$$"})
            elif name in KEEP_DIRECTIVES:
                title = inline(arg.strip()) or name.title()
                inner = parse_blocks(dedent(body), stats)
                if inner:
                    out.append({"type": "heading", "text": title})
                    out.extend(inner)
                    stats["asides"] += 1
            elif name in ("figure", "image"):
                stats["figures"] += 1
            else:
                stats["dropped_directives"] += 1
            pending_literal = False
            continue

        if COMMENT.match(raw):                        # `.. _target:` or a comment
            _body, i = consume_indented(lines, i + 1, len(raw) - len(raw.lstrip()))
            continue

        if raw[:1].isspace():
            block, i = consume_block(lines, i)
            if pending_literal:
                text = "\n".join(dedent(block)).strip("\n")
                if text.strip():
                    out.append({"type": "code", "kind": "literal",
                                "lang": "text", "text": text})
                    stats["literal_blocks"] += 1
            else:
                stats["dropped_indented"] += 1
            pending_literal = False
            continue

        if BULLET.match(raw) or ENUM.match(raw):
            items, i = read_list(lines, i)
            if items:
                out.append({"type": "bullets", "items": items})
            pending_literal = False
            continue

        para, i = read_paragraph(lines, i)
        text = " ".join(x.strip() for x in para).strip()
        pending_literal = text.endswith("::")
        if pending_literal:
            text = text[:-2].rstrip() + ":" if text[:-2].strip() else ""
        text = inline(text)
        if text:
            out.append({"type": "para", "text": text})
    return out


def read_paragraph(lines, i):
    """Un-wrap a hard-wrapped RST paragraph; the renderer honours newlines.

    A `- ` or `1. ` in the middle of a paragraph is not a list: RST needs a
    blank line before one. The book wraps "a bandwidth of 3300 Hz - 300 Hz =
    3000 Hz" across two lines, and reading that as a bullet cuts the
    sentence in half.
    """
    para = []
    while i < len(lines):
        s = lines[i]
        if not s.strip() or s[:1].isspace():
            break
        if DIRECTIVE.match(s) or COMMENT.match(s) or TABLE_RULE.match(s):
            break
        para.append(re.sub(r'^\|\s?', "", s))
        i += 1
    return para, i


def read_list(lines, i):
    """A bullet or enumerated list, continuation lines folded into the item."""
    items, cur = [], None
    while i < len(lines):
        s = lines[i]
        if not s.strip():
            nxt = lines[i + 1] if i + 1 < len(lines) else ""
            if not (nxt[:1].isspace() or BULLET.match(nxt) or ENUM.match(nxt)):
                i += 1
                break
            i += 1
            continue
        mb, me = BULLET.match(s), ENUM.match(s)
        if mb or me:
            if cur:
                items.append(cur)
            m = mb or me
            # An enumerated list keeps its number: the renderer only has
            # bullets, and dropping the number would lose the ordering.
            cur = ("%s " % m.group(2) if me else "") + m.group(3).strip()
        elif s[:1].isspace() and cur is not None:
            cur += " " + s.strip()
        else:
            break
        i += 1
    if cur:
        items.append(cur)
    return [x for x in (inline(y) for y in items) if x], i


# ------------------------------------------------------------------- units
def unit_blocks(nodes, idx, stats):
    """A section plus every subsection under it, headings kept as bold lines."""
    base = nodes[idx]["level"]
    blocks = parse_blocks(nodes[idx]["lines"], stats)
    j = idx + 1
    while j < len(nodes) and nodes[j]["level"] > base:
        blocks.append({"type": "heading", "text": clean_title(nodes[j]["title"])})
        blocks.extend(parse_blocks(nodes[j]["lines"], stats))
        j += 1
    return blocks


def render_body(blocks, budget=BODY_BUDGET):
    """Blocks -> body text in the renderer's subset, cut on a block boundary.

    Short examples stay in the body as `inline code`: the book writes
    sentences that run straight through them ("For example, <block> is the
    URL for ..."), and pulling every one of them out into the editor would
    leave the prose dangling.
    """
    out, used, truncated, kept = [], 0, False, len(blocks)
    for idx, b in enumerate(blocks):
        if b["type"] == "code":
            rows = [l for l in b["text"].split("\n") if l.strip()]
            if not rows or len(rows) > INLINE_CODE_LINES:
                continue
            text = "\n".join("`%s`" % r.strip().replace("`", "'") for r in rows)
            out.append(text)
            used += len(text) + 2
            continue
        if b["type"] == "heading":
            text = "**%s**" % b["text"]
        elif b["type"] == "bullets":
            text = "\n".join("- " + x for x in b["items"])
        else:
            text = b["text"]
        if not text.strip():
            continue
        if used and used + len(text) > budget:
            truncated, kept = True, idx
            break
        out.append(text)
        used += len(text) + 2
    while out and out[-1].startswith("**") and out[-1].endswith("**") \
            and "\n" not in out[-1]:
        out.pop()                                    # never end on a heading
        truncated = True
    return "\n\n".join(out), truncated, kept


def nlines(block):
    return len([l for l in block["text"].split("\n") if l.strip()])


def pick_code(blocks, rest=()):
    """The example for a section: a code-block if the source has one, else the
    meatiest `::` literal block. Both are verbatim.

    `blocks` is the part of the section whose prose was kept, `rest` the whole
    section. An example the retained prose talks about is preferred, but a
    real listing further down beats a one-line literal near the top.
    """
    def directive(bs):
        for b in bs:
            if b["type"] == "code" and b["kind"] == "directive":
                return b
        return None

    def literal(bs):
        cands = [b for b in bs if b["type"] == "code" and b["kind"] == "literal"]
        return max(cands, key=nlines) if cands else None

    near, far = list(blocks), list(rest)
    chosen = directive(near) or directive(far)
    if not chosen:
        a, b = literal(near), literal(far)
        chosen = a if (a and nlines(a) >= 2) else (b or a)
    if not chosen:
        return None
    lines = chosen["text"].split("\n")
    if len(lines) > MAX_CODE_LINES:
        lines = lines[:MAX_CODE_LINES]
    return {"lang": chosen["lang"], "text": "\n".join(lines).rstrip(),
            "kind": chosen["kind"]}


def build_candidates(path, text, chapter_name, stats):
    """Every lesson-sized unit in one .rst file, in reading order."""
    nodes = parse_rst(text)
    if not nodes:
        return []
    file_title = clean_title(nodes[0]["title"])
    level2 = [k for k, nd in enumerate(nodes) if nd["level"] == 2]
    idxs = level2 or [0]
    url = BOOK % path[:-4]
    cands = []
    for k in idxs:
        blocks = unit_blocks(nodes, k, stats)
        body, truncated, kept = render_body(blocks)
        if len(body) < MIN_BODY:
            continue
        code = pick_code(blocks[:kept], blocks)
        figrefs = body.count(FIGURE_PHRASE)
        title = qualify(clean_title(nodes[k]["title"]), file_title, chapter_name)
        cands.append({
            "title": title, "body": body, "code": code, "url": url,
            "file": path, "file_title": file_title, "truncated": truncated,
            # A section the book teaches with a code listing beats one it
            # teaches with a figure we cannot show.
            "score": (120 if code and code["kind"] == "directive" else
                      70 if code else 0)
                     + min(len(body), BODY_BUDGET) / 100.0 - 2 * figrefs,
        })
    stats["units"] += len(cands)
    return cands


def spread(items, k):
    """Keep k items spanning the whole chapter, not just its opening."""
    if len(items) <= k:
        return list(items)
    step = (len(items) - 1) / float(k - 1)
    picked = sorted({int(round(i * step)) for i in range(k)})
    j = 0
    while len(picked) < k and j < len(items):
        if j not in picked:
            picked = sorted(picked + [j])
        j += 1
    return [items[j] for j in picked[:k]]


# ------------------------------------------------------------------- floors
def build_floor(n, chapter_path, fetcher, stats, report):
    slug = os.path.basename(chapter_path)[:-4]
    text = fetcher.rst(chapter_path)
    if text is None:
        report["missing"].append(chapter_path)
        return None
    nodes = parse_rst(text)
    chapter_title = re.sub(r'\s+', " ", nodes[0]["title"]).strip() if nodes else slug
    chapter_name = re.sub(r'^Chapter\s+\d+:\s*', "", chapter_title)
    files = toctree_entries(text)
    report["chapter_files"][slug] = len(files)

    per_file, concepts = [], []
    for f in files:
        body = fetcher.rst(f)
        if body is None:
            report["missing"].append(f)
            continue
        cands = build_candidates(f, body, chapter_name, stats)
        if not cands:
            continue
        concepts.append(cands[0]["file_title"])
        per_file.append(max(cands, key=lambda c: c["score"]))

    # A section the book illustrates with a listing is worth more than one it
    # illustrates with a figure we cannot reproduce, so the examples are
    # picked first and spread across the chapter. Only then is the floor
    # topped up, because a chapter deserves more than two sections.
    with_code = [c for c in per_file if c["code"]]
    chosen = spread(with_code, MAX_SECTIONS)
    if len(chosen) < MIN_FILL_SECTIONS:
        taken = {id(c) for c in chosen}
        rest = sorted((c for c in per_file if id(c) not in taken),
                      key=lambda c: -c["score"])
        chosen = chosen + rest[:MIN_FILL_SECTIONS - len(chosen)]
    order = {id(c): i for i, c in enumerate(per_file)}
    chosen = sorted(chosen, key=lambda c: order.get(id(c), 0))

    sections, todo = [], []
    for c in chosen:
        body = c["body"] + (
            "\n\nRead this section in full, with the figures it refers to, at %s"
            % c["url"])
        code = c["code"]
        sections.append({
            "title": c["title"],
            "body": body,
            "code": code["text"] if code else "",
            "lang": code["lang"] if code else "text",
            "annotations": [],
            "source": "%s (%s)" % (c["file"], LICENCE),
        })
        if not code:
            todo.append("lesson section '%s' has no code or literal block in the "
                        "source - the book teaches it with a figure; author a "
                        "worked example or packet-format listing" % c["title"])
        if c["truncated"]:
            stats["truncated"] += 1

    if len(sections) < MIN_SECTIONS:
        todo.append("lesson needs %d more section(s); the chapter yielded only "
                    "%d parseable unit(s)"
                    % (MIN_SECTIONS - len(sections), len(sections)))
    todo.append("practice: author 6+ challenges grounded in %s "
                "(none were invented here)" % chapter_title)
    todo.append("exam: author 8-12 questions from %s" % chapter_title)

    return {
        "n": n,
        "name": FLOOR_NAMES.get(slug, clean_title(chapter_title)),
        "chapter": chapter_title,
        "concepts": concepts,
        "lesson": {"sections": sections},
        "practice": [],
        "exam": [],
        "_todo": todo,
    }


def build_dungeon(fetcher, stats, report):
    index = fetcher.rst("index.rst")
    if index is None:
        raise SystemExit("could not fetch index.rst from %s" % REPO)
    entries = toctree_entries(index)
    chapters = [e for e in entries
                if os.path.basename(e)[:-4] not in NOT_A_CHAPTER and "/" not in e]
    report["chapters_declared"] = len(chapters)

    # The git tree is what tells us how much of the book we are reading.
    blobs = fetcher.tree()
    report["rst_in_repo"] = len([b for b in blobs if b.endswith(".rst")])

    floors = []
    for i, ch in enumerate(chapters):
        fl = build_floor(i + 1, ch, fetcher, stats, report)
        if fl:
            floors.append(fl)

    return {
        "id": "networking",
        "name": "The Packet Labyrinth",
        "subject": "Computer Networks",
        "category": "theory",
        "disciplineType": "systems",
        "sigil": "⌘",
        "unlock": None,
        "lang": "text",
        "runtime": "none",
        "source": "%s (%s)" % (REPO, LICENCE),
        "importedBy": "scripts/import_systems_approach.py",
        "blurb": ("Computer Networks: A Systems Approach by Larry Peterson and "
                  "Bruce Davie - from a single link to the applications that "
                  "run on top of the Internet."),
        "floors": floors,
    }


# -------------------------------------------------------------- attribution
ATTR_HEADING = "### SystemsApproach/book"
ATTR = """### SystemsApproach/book - CC BY 4.0

- **Repository:** `github.com/SystemsApproach/book` (branch `master`)
- **Work:** *Computer Networks: A Systems Approach*, Larry Peterson and
  Bruce Davie, published at `book.systemsapproach.org`.
- **Licence:** Creative Commons Attribution 4.0 International (CC BY 4.0)
- **Imported by:** `scripts/import_systems_approach.py`
- **Used for:** the Networking dungeon, one floor per chapter.

| From | Used as |
|---|---|
| `index.rst` and `{chapter}.rst` toctrees | floor order and each chapter's section list |
| `{chapter}/{section}.rst` prose | lesson section bodies, converted from RST |
| `.. code-block::` and `::` literal blocks | lesson code examples, verbatim |

CC BY 4.0 permits adaptation with attribution. The prose is reformatted, not
rewritten: RST markup is converted to the renderer's subset and long sections
are cut at a paragraph boundary with a link to the full chapter. Figures are
not reproduced. Practice and exam questions are not taken from the book.
"""


def write_attribution(path):
    if not os.path.exists(path):
        return "skipped (no attribution.md)"
    text = io.open(path, encoding="utf-8").read()
    if ATTR_HEADING in text:
        return "already present"
    marker = "\n---\n\n## Runtimes and libraries"
    if marker in text:
        text = text.replace(marker, "\n" + ATTR + marker, 1)
    else:
        text = text.rstrip() + "\n\n" + ATTR
    io.open(path, "w", encoding="utf-8").write(text)
    return "appended"


# --------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-cache", action="store_true",
                    help="ignore .cache/systems_approach and refetch")
    ap.add_argument("--dry-run", action="store_true",
                    help="print the summary without writing files")
    args = ap.parse_args()

    stats = {"units": 0, "code_blocks": 0, "literal_blocks": 0, "figures": 0,
             "tables": 0, "asides": 0, "dropped_directives": 0,
             "dropped_indented": 0, "truncated": 0}
    report = {"chapters_declared": 0, "rst_in_repo": 0, "chapter_files": {},
              "missing": []}

    f = Fetcher(use_cache=not args.no_cache)
    print("importing %s@%s ..." % (REPO, BRANCH))
    dungeon = build_dungeon(f, stats, report)

    out_json = os.path.join(ROOT, "content", "networking.json")
    attr_path = os.path.join(ROOT, "content", "attribution.md")
    attr_state = "not written (dry run)"
    if not args.dry_run:
        os.makedirs(os.path.dirname(out_json), exist_ok=True)
        json.dump(dungeon, io.open(out_json, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
        attr_state = write_attribution(attr_path)

    floors = dungeon["floors"]
    n_sec = sum(len(fl["lesson"]["sections"]) for fl in floors)
    coded = sum(1 for fl in floors for s in fl["lesson"]["sections"] if s["code"])
    prose = sum(len(s["body"]) for fl in floors for s in fl["lesson"]["sections"])
    todos = sum(len(fl["_todo"]) for fl in floors)

    line = "=" * 70
    print("")
    print(line)
    print("  IMPORT SUMMARY - %s (%s)" % (REPO, LICENCE))
    print(line)
    print("  network: %d fetched, %d from cache%s" % (
        f.misses, f.hits, ", %d failed" % len(f.failures) if f.failures else ""))
    print("  .rst files in repo            : %d" % report["rst_in_repo"])
    print("  chapters in index.rst toctree : %d" % report["chapters_declared"])
    print("  section units parsed          : %d" % stats["units"])
    print("")
    print("  IMPORTED")
    print("    floors                      : %d  (one per chapter, book order)"
          % len(floors))
    print("    lesson sections             : %d  (%d with an example, %d without)"
          % (n_sec, coded, n_sec - coded))
    print("    prose imported              : %d characters of real book text" % prose)
    print("    code-block directives read  : %d" % stats["code_blocks"])
    print("    :: literal blocks read      : %d" % stats["literal_blocks"])
    print("    sidebars/admonitions kept   : %d" % stats["asides"])
    print("    practice challenges         : 0  (not invented - see _todo)")
    print("    exam questions              : 0  (not invented - see _todo)")
    print("")
    print("  DROPPED (no representation in the body subset)")
    print("    figures/images              : %d  (each section links to the chapter)"
          % stats["figures"])
    print("    tables                      : %d" % stats["tables"])
    print("    other directives            : %d" % stats["dropped_directives"])
    print("    indented block quotes       : %d" % stats["dropped_indented"])
    print("    sections cut at the budget  : %d of %d (link to the rest kept)"
          % (stats["truncated"], n_sec))
    print("")
    print("  NEEDS MANUAL WORK")
    print("    total _todo entries         : %d" % todos)
    print("    floors under 6 practice     : %d" % len(floors))
    print("    floors under 8 exam         : %d" % len(floors))
    print("    sections with no example    : %d" % (n_sec - coded))
    if report["missing"]:
        print("    files not fetched           : %s" % ", ".join(report["missing"][:6]))
    if f.failures:
        print("    fetch failures              : %s" % "; ".join(f.failures[:5]))
    print("")
    print("  PER FLOOR")
    for fl in floors:
        secs = fl["lesson"]["sections"]
        print("   %2d. %-24s %d sec  %d code  %5d ch  %s"
              % (fl["n"], fl["name"], len(secs),
                 sum(1 for s in secs if s["code"]),
                 sum(len(s["body"]) for s in secs), fl["chapter"][:30]))
    print("")
    if args.dry_run:
        print("  (dry run - nothing written)")
    else:
        print("  wrote %s" % os.path.relpath(out_json, ROOT))
        print("  attribution.md: %s" % attr_state)
    print("  next: python scripts/validate_content.py networking")
    print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
