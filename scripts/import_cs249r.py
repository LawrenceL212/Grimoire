#!/usr/bin/env python3
"""Import the Harvard CS249r book (Machine Learning Systems) into a dungeon.

    python scripts/import_cs249r.py
    python scripts/import_cs249r.py --dry-run
    python scripts/import_cs249r.py --no-cache --floors 10

The book is written in Quarto markdown (.qmd). This importer:

  - reads the repo tree to find every .qmd,
  - reads `book/quarto/config/_quarto-html-vol1.yml` for the *book's own*
    chapter order, so the floor order is the author's order and not ours,
  - keeps only the core Volume I chapters (no labs, kits, appendices,
    frontmatter, backmatter, parts dividers or references),
  - strips the YAML front matter, the `::: {...}` div callouts, LaTeX
    macros, `\\index{}` entries, footnotes, citations, cross-references,
    tables and figures, and
  - emits 2-4 lesson sections per floor from the surviving prose, each
    paired with a real `.python` example from the same chapter.

Nothing is written that was not fetched from the repository. Prose that
depends on a Quarto inline computation (`` `{python} stats.foo` ``) has no
value in the raw source, so those sentences are dropped rather than shown
with a hole in them; the count is reported in the summary.

Practice and exam challenges are NOT generated. The book is prose, not an
exercise bank, and inventing questions from it would be fabrication. Every
floor carries a `_todo` saying so.

Source: github.com/harvard-edge/cs249r_book, branch dev (CC BY-NC-SA 4.0).
The licence permits derivatives with attribution under the same terms.
See content/attribution.md.
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
CACHE = os.path.join(ROOT, ".cache", "cs249r")

REPO = "harvard-edge/cs249r_book"
BRANCH = "dev"
TREE = "https://api.github.com/repos/%s/git/trees/%s?recursive=1" % (REPO, BRANCH)
RAW = "https://raw.githubusercontent.com/%s/%s/%s"
BLOB = "https://github.com/%s/blob/%s/%s" % (REPO, BRANCH, "%s")

QUARTO_CONFIG = "book/quarto/config/_quarto-html-vol1.yml"
CONTENTS = "book/quarto/contents/"

DUNGEON_ID = "machine-learning"
LICENCE = "CC BY-NC-SA 4.0"

# Directories under contents/ that are not teaching chapters.
SKIP_DIRS = ("frontmatter", "backmatter", "parts", "labs", "kits", "vol3")
SKIP_STEMS = ("index", "references", "glossary", "socratiq", "404")

# Chapter `##` sections that are apparatus rather than teaching.
SKIP_SECTIONS = {"purpose", "summary", "resources", "self-check",
                 "further reading", "references", "quiz answers",
                 "learning objectives"}

# Floor names, in the order the book's four parts unfold. Purely flavour --
# the teaching content underneath is the book's, the names are Grimoire's.
FLOOR_NAMES = [
    "Threshold of the Oracle",
    "Hall of Living Systems",
    "The Sixfold Cycle",
    "Reservoir of Raw Signal",
    "Chamber of Tensors",
    "The Framework Athanor",
    "Crucible of Compression",
    "Forge of Silicon",
    "Gates of Deployment",
    "The Steward's Trial",
]

MAX_SECTIONS_PER_FLOOR = 4
MIN_SECTIONS_PER_FLOOR = 2
BODY_BUDGET = 2600          # characters of prose per lesson section
MIN_PARAGRAPH = 220         # a paragraph shorter than this is a caption/stub


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

    def get(self, path, absolute=None):
        """Returns file text, or None if it does not exist."""
        key = os.path.join(CACHE, cache_key(absolute or path))
        if self.use_cache and os.path.exists(key):
            self.hits += 1
            return io.open(key, encoding="utf-8").read()
        url = absolute or (RAW % (REPO, BRANCH, path))
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "grimoire-importer",
                              "Accept": "application/vnd.github+json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                text = r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            self.failures.append("%s -> HTTP %s" % (path, e.code))
            return None
        except Exception as e:                                   # noqa: BLE001
            self.failures.append("%s -> %s" % (path, e))
            return None
        self.misses += 1
        os.makedirs(os.path.dirname(key), exist_ok=True)
        io.open(key, "w", encoding="utf-8").write(text)
        return text

    def json(self, path, absolute=None):
        raw = self.get(path, absolute=absolute)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except ValueError as e:
            self.failures.append("%s -> bad JSON: %s" % (path, e))
            return None


# ------------------------------------------------------- chapter discovery
def list_qmd(fetcher, report):
    """Every .qmd path in the repository, from the git tree API."""
    tree = fetcher.json("__tree__", absolute=TREE)
    if not tree or "tree" not in tree:
        raise SystemExit("could not read the repository tree from %s" % TREE)
    report["tree_truncated"] = bool(tree.get("truncated"))
    paths = [t["path"] for t in tree["tree"]
             if t.get("type") == "blob" and t["path"].endswith(".qmd")]
    report["qmd_total"] = len(paths)
    return set(paths)


def is_core_chapter(path):
    """Core Volume I chapter: contents/volN/<chapter>/<chapter>.qmd."""
    if not path.startswith(CONTENTS):
        return False
    rest = path[len(CONTENTS):]
    parts = rest.split("/")
    if any(p in SKIP_DIRS for p in parts):
        return False
    stem = os.path.splitext(parts[-1])[0]
    if stem.startswith("_") or stem in SKIP_STEMS:
        return False
    # a chapter lives in its own directory and is named after it
    return len(parts) >= 2 and parts[-2] == stem


def chapter_order(fetcher, available, report):
    """The book's own chapter order, read from the Quarto render list.

    Falling back to alphabetical order would teach deployment before data,
    so if the config cannot be read we stop rather than invent a sequence.
    """
    cfg = fetcher.get(QUARTO_CONFIG)
    if not cfg:
        raise SystemExit("could not read %s -- refusing to guess the chapter "
                         "order" % QUARTO_CONFIG)
    render = re.search(r"^\s*render:\s*$(.*?)^\s*\w[\w-]*:\s*$",
                       cfg, re.S | re.M)
    block = render.group(1) if render else cfg
    ordered, seen = [], set()
    for m in re.finditer(r"^\s*-\s*(?:text:.*\n\s*href:\s*)?"
                         r"([A-Za-z0-9_./-]+\.qmd)\s*$", block, re.M):
        rel = m.group(1).lstrip("./")
        path = rel if rel.startswith("book/") else "book/quarto/" + rel
        if path in seen or not is_core_chapter(path):
            continue
        if path not in available:
            report["missing_from_tree"].append(path)
            continue
        seen.add(path)
        ordered.append(path)
    report["chapters_in_config"] = len(ordered)
    if not ordered:
        raise SystemExit("the Quarto render list yielded no core chapters")
    return ordered


# --------------------------------------------------------- quarto cleaning
FENCE = re.compile(r"^(`{3,})[ \t]*([^\n]*)\n(.*?)^\1[ \t]*$", re.S | re.M)
DIV_OPEN = re.compile(r"^:{3,}\s*(\{.*\}|[A-Za-z][\w.-]*.*)\s*$")
DIV_CLOSE = re.compile(r"^:{3,}\s*$")
COMPUTED = re.compile(r"`\{[a-zA-Z0-9_]+\}[^`]*`")
ATTRS = re.compile(r"\s*\{[^{}\n]*\}\s*$")

# `[ \t]*$` rather than `\s*$`: under re.M a trailing `\s*` also swallows the
# blank line that separates two paragraphs, gluing them into one.
LATEX_LINE = re.compile(
    r"^[ \t]*\\(begin|end)\{[^}]*\}[ \t]*$|"
    r"^[ \t]*\\(newpage|noindent|clearpage|chapterminitoc|vspace|hfill|"
    r"smallskip|medskip|bigskip|par|footnotesize|small|normalsize)\b.*$|"
    r"^[ \t]*\\[A-Za-z]+(\{[^}]*\})+[ \t]*$", re.M)


def strip_front_matter(text):
    """Remove the leading `---` YAML block Quarto puts on every chapter."""
    m = re.match(r"^\s*---\s*\n.*?\n---\s*\n", text, re.S)
    return text[m.end():] if m else text


def strip_divs(text, keep=None):
    """Drop `::: {...} ... :::` fenced divs, contents included.

    Quarto nests same-length fences, so depth has to be counted rather than
    matched by fence width. Everything inside is callout apparatus (margin
    figures, PDF-only blocks, learning objectives, war stories); none of it
    survives the flat renderer, so the whole block goes.

    The one exception is code. The book wraps most of its `{.python}`
    listings in a `::: {#lst-...}` div, so dropping divs wholesale would
    throw away every example in the book. `keep` is the set of masked-block
    placeholders worth rescuing; they are re-emitted where their div stood,
    which keeps each listing inside the section it illustrates.
    """
    out, depth, dropped, rescued = [], 0, 0, 0
    for line in text.split("\n"):
        if DIV_OPEN.match(line):
            depth += 1
            dropped += 1
            continue
        if DIV_CLOSE.match(line):
            if depth:
                depth -= 1
                dropped += 1
                continue
        if depth:
            dropped += 1
            if keep:
                for ph in re.findall(r"\x01B\d+\x01", line):
                    if ph in keep:
                        out.append(ph)
                        rescued += 1
            continue
        out.append(line)
    return "\n".join(out), dropped, rescued


def strip_footnote_defs(text):
    """`[^fn-x]: long definition` plus any indented continuation lines."""
    out, skipping = [], False
    for line in text.split("\n"):
        if re.match(r"^\s*\[\^[^\]]+\]:", line):
            skipping = True
            continue
        if skipping:
            if line.strip() == "" or re.match(r"^\s{2,}\S", line):
                if line.strip() == "":
                    skipping = False
                continue
            skipping = False
        out.append(line)
    return "\n".join(out)


def strip_tables(text):
    """Pipe tables and their `: **Caption** ... {#tbl-x}` caption lines."""
    out = []
    for line in text.split("\n"):
        s = line.strip()
        if s.startswith("|"):
            continue
        if s.startswith(": ") and re.search(r"\{#(tbl|fig|lst)-", s):
            continue
        out.append(line)
    return "\n".join(out)


def mask_math(text, store):
    """Hide $...$ and $$...$$ so no later rule can touch the LaTeX."""
    def keep(m):
        store.append(m.group(0))
        return "\x01M%d\x01" % (len(store) - 1)
    text = re.sub(r"\$\$.*?\$\$", keep, text, flags=re.S)
    return re.sub(r"(?<!\$)\$(?!\$)[^$\n]+?\$(?!\$)", keep, text)


def unmask(text, store, marker="M"):
    return re.sub(r"\x01%s(\d+)\x01" % marker,
                  lambda m: store[int(m.group(1))], text)


ABBREV = [("e.g.", "\x02EG\x02"), ("i.e.", "\x02IE\x02"),
          ("vs.", "\x02VS\x02"), ("etc.", "\x02ETC\x02"),
          ("cf.", "\x02CF\x02"), ("approx.", "\x02APX\x02"),
          ("Fig.", "\x02FIG\x02"), ("Eq.", "\x02EQ\x02"),
          ("Dr.", "\x02DR\x02"), ("St.", "\x02ST\x02")]


# A cross-reference is written two ways: Quarto's `@sec-x` / `@fig-y` and
# LaTeX's `\ref{pri-iron-law}`. Both point at something this dungeon does
# not contain, so both are handled the same way.
_REF = (r"(?:@[A-Za-z]+-[\w-]+"
        r"|\\(?:ref|eqref|cref|Cref|autoref|nameref)\{[^{}]*\})")
XREF = re.compile(_REF)

# "(see @sec-x)", "(principle \ref{pri-iron-law})", "(@fig-a, @fig-b)" --
# a whole parenthetical whose only content is references. Cutting it leaves
# the sentence intact, so nothing else has to be sacrificed.
PAREN_REF = re.compile(
    r"\s*\((?:(?:see|cf\.|e\.g\.,?|principle|principles|notebook|figure|"
    r"table|section|equation|chapter|listing|example)\s+){0,2}"
    + _REF + r"(?:\s*(?:,|;|and)\s*(?:(?:principle|figure|table|section|"
    r"equation)\s+)?" + _REF + r")*\s*\)")

# "...the algorithm introduced in @sec-dnn-architectures, the systems..."
# Here the reference is welded into the sentence. Removing the reference
# phrase -- the preposition and any reporting verb in front of it -- leaves
# grammatical prose that still says exactly what the book said.
PHRASE_REF = re.compile(
    r"\s*,?\s*(?:\bas\s+)?"
    r"(?:\b(?:see|shown|illustrated|described|discussed|detailed|covered|"
    r"introduced|defined|summarised|summarized|listed|presented|explained|"
    r"examined|analysed|analyzed|noted|quantified|formalised|formalized|"
    r"given|reported|derived|outlined)\b\s*)?"
    r"\b(?:in|by|from|per|via|of|to)\s+"
    + _REF + r"(?:\s*(?:,|and)\s*" + _REF + r")*", re.I)

BARE_SEE_REF = re.compile(r"\s*,?\s*\b(?:see|cf\.)\s+" + _REF
                          + r"(?:\s*(?:,|and)\s*" + _REF + r")*", re.I)


def drop_broken_sentences(text, report):
    """Delete sentences the raw source cannot render honestly.

    Two kinds:

    `` `{python} AIMomentStats.google_search_b_str` `` renders as a number in
    the published book. In the raw source there is no number, so the sentence
    would read "Google processes  searches per day" - a hole where a fact
    should be. It is dropped whole.

    A cross-reference that is still standing after `clean_inline` has removed
    the parenthetical and reference-phrase forms is one the sentence is built
    around -- "@fig-x illustrates the core idea..." - and deleting just the
    token leaves a subjectless fragment. That sentence goes too.

    Deleting is always safe; rewriting around the gap would be fabrication.
    Both counts are reported.
    """
    out = []
    for line in text.split("\n"):
        # a heading is not a sentence - clean it in place instead
        if line.lstrip().startswith("#") or not line.strip():
            out.append(XREF.sub("", line))
            continue
        if not (COMPUTED.search(line) or XREF.search(line)):
            out.append(line)
            continue
        for a, b in ABBREV:
            line = line.replace(a, b)
        kept = []
        for sentence in re.split(r"(?<=[.!?])\s+", line):
            if COMPUTED.search(sentence):
                report["computed_sentences_dropped"] += 1
                continue
            if XREF.search(sentence):
                report["xref_sentences_dropped"] += 1
                continue
            kept.append(sentence)
        line = " ".join(kept)
        for a, b in ABBREV:
            line = line.replace(b, a)
        out.append(line)
    return "\n".join(out)


def clean_inline(text):
    """Everything Quarto adds inside a line that the renderer cannot show."""
    text = re.sub(r"\\index\{[^{}]*\}", "", text)          # index entries
    text = re.sub(r"\{\{<[^>]*>\}\}", "", text)            # shortcodes
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)       # images
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)     # html comments
    text = re.sub(r"</?[A-Za-z][^>\n]*>", "", text)        # raw html tags
    text = re.sub(r"\[([^\]]*)\]\(([^)]*)\)", r"\1", text)  # inline links
    text = re.sub(r"\[([^\]]+)\]\[[^\]]*\]", r"\1", text)  # reference links
    text = re.sub(r"^\[[^\]]+\]:[ \t]*\S+[ \t]*$", "", text, flags=re.M)  # link defs
    text = re.sub(r"\[\^[^\]]+\]", "", text)               # footnote markers
    text = re.sub(r"\[-?@[^\]]+\]", "", text)              # citations
    # cross-references, least destructive form first
    text = PAREN_REF.sub("", text)
    text = BARE_SEE_REF.sub("", text)
    text = PHRASE_REF.sub("", text)
    # `$$ ... $$ {#eq-iron-law}` -- the label survives the maths mask
    text = re.sub(r"[ \t]*\{#[A-Za-z][\w-]*\}", "", text)
    text = re.sub(r"[ \t]*\{(?:width|height|fig-\w+)=[^{}\n]*\}", "", text)
    text = re.sub(r"\[([^\]]*)\]\{[^{}]*\}", r"\1", text)  # bracketed spans
    text = re.sub(r"\\(?:textbf|textit|emph|gls|glspl|mbox|text)\{([^{}]*)\}",
                  r"\1", text)
    text = re.sub(r"\\(?:newpage|noindent|clearpage|linebreak|par)\b", "", text)
    # pandoc smart dashes: the source writes them as hyphen runs
    text = re.sub(r"(?<=\w)---(?=\w)", "\u2014", text)
    text = re.sub(r"(?<=\w)--(?=\w)", "\u2013", text)
    text = re.sub(r"\s+([,.;:])", r"\1", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text


def to_render_subset(text):
    """**bold**, `code`, paragraphs and "- " bullets. Nothing else."""
    # headings that survived sectioning become bold lead-in lines
    text = re.sub(r"^#{1,6}[ \t]+(.+?)[ \t]*$",
                  lambda m: "**%s**" % ATTRS.sub("", m.group(1)).strip(),
                  text, flags=re.M)
    text = re.sub(r"^\s*>\s?.*$", "", text, flags=re.M)     # block quotes
    text = re.sub(r"^\s*[*+-]\s+", "- ", text, flags=re.M)  # bullets
    text = re.sub(r"^\s*\d+\.\s+", "- ", text, flags=re.M)  # numbered lists
    # _emphasis_ and *emphasis* -> **emphasis** (the renderer has no italics)
    text = re.sub(r"(?<![A-Za-z0-9_*])\*([^*\n]+)\*(?![A-Za-z0-9_*])",
                  r"**\1**", text)
    text = re.sub(r"(?<![A-Za-z0-9_])_([^_\n]+)_(?![A-Za-z0-9_])",
                  r"**\1**", text)
    text = re.sub(r"\*{3,}", "**", text)
    return text


def clean_prose(raw, report):
    """Full Quarto -> Grimoire body pipeline for one chunk of chapter text.

    Order matters: parenthetical cross-references are removed before the
    sentence filter runs, so a sentence is only sacrificed when the
    reference was load-bearing inside it.
    """
    math = []
    text = mask_math(raw, math)
    text = strip_footnote_defs(text)
    text = strip_tables(text)
    text = LATEX_LINE.sub("", text)
    text = clean_inline(text)
    text = drop_broken_sentences(text, report)
    text = to_render_subset(text)
    text = unmask(text, math)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


# The renderer supports **bold**, `code`, blank-line paragraphs and "- "
# bullets, plus KaTeX inside $...$. Anything below would be shown raw to a
# learner, so every emitted body is checked and the count is reported.
LINT = [
    ("quarto div",      re.compile(r"^:{3,}", re.M)),
    ("attribute block", re.compile(r"\{[#.][A-Za-z]")),
    ("latex macro",     re.compile(r"\\[A-Za-z]+")),
    ("citation",        re.compile(r"\[-?@")),
    ("cross-reference", re.compile(r"@[A-Za-z]+-[\w-]+")),
    ("table row",       re.compile(r"^\s*\|", re.M)),
    ("html tag",        re.compile(r"</?[A-Za-z][^>\n]*>")),
    ("image",           re.compile(r"!\[")),
    ("markdown heading", re.compile(r"^#{1,6} ", re.M)),
    ("computed value",  COMPUTED),
    ("underscore emphasis",
     re.compile(r"(?<![A-Za-z0-9_])_[^_\n]+_(?![A-Za-z0-9_])")),
    ("block quote",     re.compile(r"^\s*>", re.M)),
    ("triple hyphen",   re.compile(r"---")),
]


def lint_body(body):
    """Names of renderer-hostile constructs still present in a body.

    Math is masked out first: `$\\frac{a}{b}$` is a backslash macro on
    purpose and KaTeX renders it.
    """
    masked = mask_math(body, [])
    return [name for name, rx in LINT if rx.search(masked)]


# --------------------------------------------------------- chapter parsing
def chapter_title(text, path):
    m = re.search(r"^#\s+(.+?)\s*$", text, re.M)
    if m:
        return ATTRS.sub("", m.group(1)).strip()
    stem = os.path.splitext(os.path.basename(path))[0]
    return stem.replace("_", " ").title()


# Executed blocks that exist only to build the book itself.
MACHINERY = re.compile(r"\b(?:mlsysim|matplotlib|book_style|savefig|"
                       r"ReferenceStats)\b|book\.tools|plt\.")
HIDDEN = re.compile(r"^\s*#\|\s*echo:\s*false", re.M)


def pick_code(fences):
    """The best real example among a section's code fences, and its language.

    `{.python}` blocks are the book's illustrative listings - the code a
    reader is meant to study - and are always preferred.

    `{python}` blocks are executed by Quarto to generate the book's own
    figures and statistics. In practice every one of them is `#| echo:
    false` and pulls in `mlsysim` or matplotlib, so none is a teaching
    example; the filter is kept general rather than hard-coded in case that
    changes upstream.

    An unlabelled fence is usually a short illustrative transcript, which is
    worth showing as text.

    Nothing is stretched to fill the slot: a section with no suitable
    listing gets no code example and says so in the floor's `_todo`.
    """
    display, executable, plain = [], [], []
    for info, body in fences:
        info = info.strip()
        hidden = bool(HIDDEN.search(body))
        body = re.sub(r"^\s*#\|.*$", "", body, flags=re.M).strip("\n")
        if not body.strip():
            continue
        if ".python" in info:
            display.append(body)
        elif info in ("{python}", "python"):
            if not hidden and not MACHINERY.search(body):
                executable.append(body)
        elif not info and "\\begin" not in body:
            plain.append(body)

    def lines_of(b):
        return len([l for l in b.split("\n") if l.strip()])

    for pool, lang in ((display, "python"), (executable, "python"),
                       (plain, "text")):
        # 2-30 lines reads as an example; longer ones are reference
        # implementations that would swamp the lesson panel
        fits = [b for b in pool if 2 <= lines_of(b) <= 30 and len(b) <= 1600]
        if fits:
            return fits[0], lang
    return "", "text"


def split_chapter(text, report):
    """A chapter's `##` sections, each with its prose and its code fences.

    Fences are masked before the divs are stripped: the two constructs are
    interleaved in the source, and a `:::` div very often exists only to
    caption a listing.
    """
    blocks = []

    def mask(m):
        blocks.append((m.group(2).strip(), m.group(3)))
        return "\x01B%d\x01" % (len(blocks) - 1)

    masked = FENCE.sub(mask, strip_front_matter(text))
    keep = set("\x01B%d\x01" % i for i, (info, _) in enumerate(blocks)
               if "python" in info.lower())
    masked, _, rescued = strip_divs(masked, keep)
    report["listings_rescued_from_divs"] += rescued

    parts = re.split(r"^##[ \t]+(.+?)[ \t]*$", masked, flags=re.M)
    sections = []
    for i in range(1, len(parts) - 1, 2):
        title = ATTRS.sub("", parts[i]).strip()
        chunk = parts[i + 1]
        ids = [int(x) for x in re.findall(r"\x01B(\d+)\x01", chunk)]
        prose = clean_prose(re.sub(r"\x01B\d+\x01", "", chunk), report)
        sections.append({
            "title": title,
            "prose": prose,
            "fences": [blocks[j] for j in ids],
        })
    return sections


def trim_body(prose):
    """Leading paragraphs up to the body budget, cut on a paragraph edge."""
    paras, out, used = [p.strip() for p in prose.split("\n\n")], [], 0
    for p in paras:
        if not p:
            continue
        if not out and len(p) < MIN_PARAGRAPH and not p.startswith("**"):
            continue                       # skip a stray caption lead-in
        if out and used + len(p) > BODY_BUDGET:
            break
        out.append(p)
        used += len(p) + 2
        if used >= BODY_BUDGET:
            break
    return "\n\n".join(out).strip()


def candidates_for(chapter):
    """Every `##` section of a chapter that could become a lesson section."""
    out = []
    for s in chapter["sections"]:
        if s["title"].strip().lower() in SKIP_SECTIONS:
            continue
        body = trim_body(s["prose"])
        if len(body) < MIN_PARAGRAPH:
            continue
        code, lang = pick_code(s["fences"])
        out.append({"title": s["title"], "body": body,
                    "code": code, "lang": lang})
    return out


def allocate(caps, total):
    """Share a floor's section slots between its chapters.

    Every chapter keeps at least one section, so no chapter is silently
    dropped. Spare slots go to whichever chapter can still back one with a
    real code listing, preferring the chapter that has fewest so far - the
    book's listings are very unevenly spread (31 in the frameworks chapter,
    none in the introduction), and this is what keeps a floor's lesson from
    being all prose when its other chapter had examples going spare.
    """
    n = len(caps)
    slots = [1] * n
    for _ in range(max(0, total - n)):
        best = max(range(n), key=lambda i: (1 if caps[i] > slots[i] else 0,
                                            -slots[i], caps[i]))
        slots[best] += 1
    return slots


def build_sections(chapter, candidates, want, report):
    """Up to `want` lesson sections from one chapter, in the book's order.

    Sections carrying a real code listing are taken first, because a lesson
    section without an example does not meet the content spec. Document
    order is then restored, so the floor still teaches in the book's order.
    """
    if not candidates:
        return []
    with_code = [c for c in candidates if c["code"]]
    without = [c for c in candidates if not c["code"]]
    chosen = with_code[:want]
    if len(chosen) < want:
        chosen += without[:want - len(chosen)]
    order = {id(c): i for i, c in enumerate(candidates)}
    chosen.sort(key=lambda c: order[id(c)])

    out = []
    for c in chosen:
        if not c["code"]:
            report["sections_without_code"] += 1
        for name in lint_body(c["body"]):
            report["lint"][name] = report["lint"].get(name, 0) + 1
        out.append({
            "title": c["title"],
            "body": c["body"],
            "code": c["code"],
            "lang": c["lang"],
            "annotations": [],
            "source": "%s -- %s" % (chapter["title"], c["title"]),
        })
    return out


def link_only_section(chapter):
    """Honest stand-in for a chapter whose prose did not survive parsing.

    Rule: never invent teaching text. If the chapter cannot be read, say so
    and point at the real thing.
    """
    return {
        "title": chapter["title"],
        "body": ("This chapter could not be converted to Grimoire's lesson "
                 "format by the importer, so no text from it is reproduced "
                 "here.\n\nRead the chapter in full at its source:\n\n"
                 "- %s" % chapter["url"]),
        "code": "",
        "lang": "text",
        "annotations": [],
        "source": chapter["title"],
        "_linkOnly": True,
    }


# --------------------------------------------------------------- building
def distribute(items, target_floors):
    """Split chapters into floors, keeping the book's order.

    Remainder chapters go to the later floors: the book's opening chapters
    are framing and the depth accumulates, so the deeper floors carrying
    two chapters each matches how the material actually thickens.
    """
    n = len(items)
    if not n:
        return []
    target_floors = max(1, min(target_floors, n))
    base, extra = divmod(n, target_floors)
    out, i = [], 0
    for f in range(target_floors):
        take = base + (1 if f >= target_floors - extra else 0)
        out.append(items[i:i + take])
        i += take
    return out


def concepts_for(chapters):
    """Concept list = the chapters' own section headings, deduplicated."""
    seen, out = set(), []
    for ch in chapters:
        for s in ch["sections"]:
            t = s["title"].strip()
            key = t.lower()
            if key in SKIP_SECTIONS or key in seen or not t:
                continue
            seen.add(key)
            out.append(t)
    return out[:10]


def build_floor(n, chapters, report):
    per = max(1, MAX_SECTIONS_PER_FLOOR // len(chapters))
    sections = []
    for ch in chapters:
        got = build_sections(ch, per, report)
        if not got:
            report["chapters_link_only"].append(ch["title"])
            got = [link_only_section(ch)]
        sections.extend(got)
    sections = sections[:MAX_SECTIONS_PER_FLOOR]

    titles = ", ".join(ch["title"] for ch in chapters)
    todo = [
        "practice: author 6+ challenges grounded in %s -- the source is a "
        "prose textbook with no exercise bank, so none were imported" % titles,
        "exam: author 8-12 questions from %s" % titles,
    ]
    if len(sections) < MIN_SECTIONS_PER_FLOOR:
        todo.append("lesson needs %d more section(s)"
                    % (MIN_SECTIONS_PER_FLOOR - len(sections)))
    no_code = [s["title"] for s in sections if not s["code"]]
    if no_code:
        todo.append("no code example in the source for: %s" % ", ".join(no_code))
    if any(s.get("_linkOnly") for s in sections):
        todo.append("link-only section(s): the chapter did not parse, nothing "
                    "was reproduced")
    if any(s["code"] for s in sections):
        todo.append("code examples are the book's illustrative listings "
                    "(torch / tensorflow); they read correctly but will not "
                    "execute under pyodide without those wheels")

    return {
        "n": n,
        "name": FLOOR_NAMES[n - 1] if n <= len(FLOOR_NAMES) else "Floor %d" % n,
        "concepts": concepts_for(chapters),
        "chapters": [{"title": ch["title"], "path": ch["path"], "url": ch["url"]}
                     for ch in chapters],
        "lesson": {"sections": sections},
        "practice": [],
        "exam": [],
        "_todo": todo,
    }


def build_dungeon(fetcher, target_floors, report):
    available = list_qmd(fetcher, report)
    paths = chapter_order(fetcher, available, report)

    chapters = []
    for path in paths:
        text = fetcher.get(path)
        if text is None:
            report["fetch_failed"].append(path)
            continue
        secs = split_chapter(text, report)
        chapters.append({
            "path": path,
            "url": BLOB % path,
            "title": chapter_title(text, path),
            "sections": secs,
            "bytes": len(text),
        })
        report["source_sections"] += len(secs)
    report["chapters_read"] = len(chapters)
    if not chapters:
        raise SystemExit("no chapters could be read")

    groups = distribute(chapters, target_floors)
    report["floor_sizes"] = [len(g) for g in groups]
    floors = [build_floor(i + 1, g, report) for i, g in enumerate(groups)]

    return {
        "id": DUNGEON_ID,
        "name": "The Oracle Foundry",
        "subject": "Machine Learning Systems",
        "category": "theory",
        "disciplineType": "algorithms",
        "sigil": "\u2735",
        "unlock": None,
        "lang": "python",
        "runtime": "pyodide",
        "source": "harvard-edge/cs249r_book (%s)" % LICENCE,
        "importedBy": "scripts/import_cs249r.py",
        "blurb": "Machine learning as an engineering discipline: data, "
                 "algorithms and machines under real physical constraint.",
        "attribution": {
            "work": "Machine Learning Systems, Volume I",
            "repo": "https://github.com/%s" % REPO,
            "branch": BRANCH,
            "licence": LICENCE,
            "licenceUrl": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
            "note": "Lesson bodies and code examples are excerpted and "
                    "reformatted from the chapters listed on each floor. "
                    "Shared alike under the same licence.",
        },
        "floors": floors,
    }


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--floors", type=int, default=10,
                    help="target floor count; chapters are spread over it")
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--dry-run", action="store_true",
                    help="print the summary without writing files")
    args = ap.parse_args()

    report = {"qmd_total": 0, "chapters_in_config": 0, "chapters_read": 0,
              "source_sections": 0, "sections_without_code": 0,
              "computed_sentences_dropped": 0, "xref_sentences_dropped": 0,
              "tree_truncated": False,
              "listings_rescued_from_divs": 0,
              "missing_from_tree": [], "fetch_failed": [],
              "chapters_link_only": [], "floor_sizes": [], "lint": {}}

    f = Fetcher(use_cache=not args.no_cache)
    print("importing %s@%s ..." % (REPO, BRANCH))
    dungeon = build_dungeon(f, args.floors, report)

    out_json = os.path.join(ROOT, "content", "%s.json" % DUNGEON_ID)
    if not args.dry_run:
        os.makedirs(os.path.dirname(out_json), exist_ok=True)
        json.dump(dungeon, io.open(out_json, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)

    # ------------------------------------------------------- summary
    n_sec = sum(len(fl["lesson"]["sections"]) for fl in dungeon["floors"])
    n_prac = sum(len(fl["practice"]) for fl in dungeon["floors"])
    n_exam = sum(len(fl["exam"]) for fl in dungeon["floors"])
    todos = sum(len(fl["_todo"]) for fl in dungeon["floors"])
    body_chars = sum(len(s["body"]) for fl in dungeon["floors"]
                     for s in fl["lesson"]["sections"])
    link_only = sum(1 for fl in dungeon["floors"]
                    for s in fl["lesson"]["sections"] if s.get("_linkOnly"))

    print("")
    print("=" * 66)
    print("  IMPORT SUMMARY - %s (%s)" % (REPO, LICENCE))
    print("=" * 66)
    print("  network: %d fetched, %d from cache%s" % (
        f.misses, f.hits, ", %d failed" % len(f.failures) if f.failures else ""))
    print("  .qmd files in the tree        : %d%s"
          % (report["qmd_total"], " (TRUNCATED)" if report["tree_truncated"] else ""))
    print("  core chapters in book order   : %d" % report["chapters_in_config"])
    print("  chapters read                 : %d" % report["chapters_read"])
    print("  floors built                  : %d  (chapters per floor: %s)"
          % (len(dungeon["floors"]),
             ", ".join(str(x) for x in report["floor_sizes"])))
    print("")
    print("  IMPORTED")
    print("    chapter sections available  : %d" % report["source_sections"])
    print("    lesson sections emitted     : %d" % n_sec)
    print("    with a code example         : %d" % (n_sec - report["sections_without_code"]))
    print("    code listings freed from     ")
    print("      ::: caption divs           : %d" % report["listings_rescued_from_divs"])
    print("    prose imported              : %d chars (avg %d per section)"
          % (body_chars, body_chars // max(1, n_sec)))
    print("")
    print("  DROPPED - DELETED, NEVER REWRITTEN AROUND")
    print("    sentences with a Quarto     : %d  (the value is computed at"
          % report["computed_sentences_dropped"])
    print("      inline computation           book build time; the raw source")
    print("                                   has no number to show)")
    print("    sentences whose sense hung  : %d  (the figure/table/chapter is"
          % report["xref_sentences_dropped"])
    print("      on a cross-reference         not in this dungeon; a"
          )
    print("                                   parenthetical one is just cut)")
    print("")
    print("  NOT IMPORTED - NOTHING WAS INVENTED TO FILL THESE")
    print("    practice challenges         : %d (source is prose, no exercises)" % n_prac)
    print("    exam questions              : %d (%d floors need 8-12 each)"
          % (n_exam, len(dungeon["floors"])))
    print("    sections with no code       : %d" % report["sections_without_code"])
    print("    link-only sections          : %d" % link_only)
    print("    total _todo entries         : %d" % todos)
    print("")
    print("  RENDERER LINT (constructs the body renderer cannot show)")
    if report["lint"]:
        for name, n in sorted(report["lint"].items(), key=lambda kv: -kv[1]):
            print("    %-27s : %d section(s)" % (name, n))
    else:
        print("    clean - %d section bodies use only **bold**, `code`," % n_sec)
        print("    paragraphs, \"- \" bullets and $...$ maths")
    if report["chapters_link_only"]:
        print("    link-only chapters          : %s"
              % ", ".join(report["chapters_link_only"]))
    if report["missing_from_tree"]:
        print("    in config, not in tree      : %s"
              % ", ".join(report["missing_from_tree"][:5]))
    if report["fetch_failed"]:
        print("    fetch failed                : %s"
              % ", ".join(report["fetch_failed"][:5]))
    if f.failures:
        print("    network failures            : %s" % "; ".join(f.failures[:5]))
    print("")
    print("  PER FLOOR")
    for fl in dungeon["floors"]:
        print("    %2d. %-24s %d sec  %5d chars  %s"
              % (fl["n"], fl["name"], len(fl["lesson"]["sections"]),
                 sum(len(s["body"]) for s in fl["lesson"]["sections"]),
                 ", ".join(c["title"] for c in fl["chapters"])[:40]))
    print("")
    if args.dry_run:
        print("  (dry run - nothing written)")
    else:
        print("  wrote %s" % os.path.relpath(out_json, ROOT))
    print("  content/index.json is NOT touched by this importer.")
    print("  next: python scripts/validate_content.py %s" % DUNGEON_ID)
    print("=" * 66)


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
