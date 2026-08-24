#!/usr/bin/env python3
"""Import OpenStax mathematics textbooks into Grimoire dungeon JSON.

    python scripts/import_openstax.py                    # all five books
    python scripts/import_openstax.py calculus-1         # one book
    python scripts/import_openstax.py --dry-run          # summary only
    python scripts/import_openstax.py --no-cache         # force refetch

How the content is actually reached (this took some digging, so it is
written down):

  1. https://openstax.org/apps/cms/api/v2/pages/?type=books.Book
     lists all 129 books but carries no chapter text. Each book's
     detail_url does carry `cnx_id` -- the book's UUID -- plus the real
     licence, which is NOT the same for every book.
  2. https://openstax.org/rex/release.json maps that UUID to the pinned
     content version and gives the archive host currently in service.
  3. {archive}/contents/{uuid}@{version}.json is the full table of
     contents: chapters, modules, slugs.
  4. {archive}/contents/{uuid}@{version}:{module-uuid}.json is the module
     itself, as XHTML. This is the real book text.

So chapter prose IS reachable; nothing here is a link-out placeholder and
nothing is paraphrased. The one real transformation is mathematics: the
source ships presentation MathML with no LaTeX annotation, so the
`mathml_to_tex` section below re-encodes it element by element into the
LaTeX the app renders with KaTeX. That is a change of notation, not of
content.

Practice and exam challenges are deliberately empty. OpenStax does ship
end-of-section exercises, but the archive gives the questions without a
machine-usable answer key, and inventing one would be worse than leaving
the stage to be authored. Every floor says so in its `_todo`.

Licences differ per book and are read from the API, never assumed:
Calculus Volumes 1-3 and Precalculus 2e are CC BY-NC-SA 4.0; Statistics is
CC BY 4.0. All permit derivatives with attribution, which is what this is.
See content/attribution.md.
"""
import argparse
import gzip
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "openstax")
CMS = "https://openstax.org/apps/cms/api/v2/pages/"
RELEASE = "https://openstax.org/rex/release.json"
UA = {"User-Agent": "grimoire-importer (github.com/grimoire; educational import)"}

# id -> which OpenStax book, and the dungeon flavour around it.
# `titles` is tried in order against the live catalogue, so a retired
# edition can stand in if the preferred one is ever withdrawn.
BOOKS = [
    {
        "id": "calculus-1",
        "titles": ["Calculus Volume 1"],
        "name": "The Vanishing Increment",
        "subject": "Calculus I",
        "sigil": "\u222B",
        "blurb": "Limits, derivatives and the first integrals.",
    },
    {
        "id": "calculus-2",
        "titles": ["Calculus Volume 2"],
        "name": "The Infinite Summation",
        "subject": "Calculus II",
        "sigil": "\u2211",
        "blurb": "Techniques of integration, sequences and series.",
    },
    {
        "id": "multivariable-calculus",
        "titles": ["Calculus Volume 3"],
        "name": "The Manifold Reaches",
        "subject": "Multivariable Calculus",
        "sigil": "\u2207",
        "blurb": "Vectors, partial derivatives, multiple integrals and fields.",
    },
    {
        "id": "precalculus",
        "titles": ["Precalculus 2e", "Precalculus"],
        "name": "The Antechamber of Functions",
        "subject": "Precalculus",
        "sigil": "\u0192",
        "blurb": "Functions, trigonometry and the ground calculus stands on.",
    },
    {
        "id": "probability-stats",
        "titles": ["Statistics", "Introductory Statistics 2e", "Introductory Statistics"],
        "name": "The Hall of Likelihoods",
        "subject": "Probability & Statistics",
        "sigil": "\u03C3",
        "blurb": "Distributions, sampling, inference and regression.",
    },
]

MAX_SECTIONS = 4          # content/_SCHEMA.md caps a lesson at four sections
MIN_SECTIONS = 2
BODY_BUDGET = 2200        # characters of prose per lesson section
CODE_BUDGET = 900         # characters of LaTeX in the section's example box


# --------------------------------------------------------------- fetching
def cache_key(name):
    """A filesystem-safe cache filename. Windows rejects ? : * " < > |."""
    safe = re.sub(r'[^A-Za-z0-9._-]', "_", name)
    return safe[-180:]


class Fetcher:
    """Cached HTTP GET. Module pages are ~400 KB of XHTML each and there
    are nearly 300 of them, so the cache is gzipped on disk."""

    def __init__(self, use_cache=True):
        self.use_cache = use_cache
        self.hits = 0
        self.misses = 0
        self.bytes = 0
        self.failures = []

    def get(self, url, label=None):
        key = os.path.join(CACHE, cache_key(label or url) + ".gz")
        if self.use_cache and os.path.exists(key):
            self.hits += 1
            with gzip.open(key, "rt", encoding="utf-8") as fh:
                return fh.read()
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                text = r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                self.failures.append("%s -> HTTP 404" % (label or url))
                return None
            self.failures.append("%s -> HTTP %s" % (label or url, e.code))
            return None
        except Exception as e:
            self.failures.append("%s -> %s" % (label or url, e))
            return None
        self.misses += 1
        self.bytes += len(text)
        os.makedirs(os.path.dirname(key), exist_ok=True)
        with gzip.open(key, "wt", encoding="utf-8") as fh:
            fh.write(text)
        return text

    def json(self, url, label=None):
        text = self.get(url, label)
        if text is None:
            return None
        try:
            return json.loads(text)
        except ValueError as e:
            self.failures.append("%s -> bad JSON: %s" % (label or url, e))
            return None


# ------------------------------------------------------------ html -> tree
VOID = {"br", "img", "hr", "col", "input", "meta", "link", "mspace",
        "mprescripts", "none", "source", "area", "base", "wbr"}
DROP_SUBTREE = {"script", "style", "head"}


class Node:
    __slots__ = ("tag", "attrs", "kids", "parent")

    def __init__(self, tag, attrs=None, parent=None):
        self.tag = tag
        self.attrs = attrs or {}
        self.kids = []
        self.parent = parent

    def get(self, name, default=""):
        return self.attrs.get(name, default)

    def find_all(self, pred):
        out = []
        for k in self.kids:
            if isinstance(k, Node):
                if pred(k):
                    out.append(k)
                out.extend(k.find_all(pred))
        return out

    def text(self):
        """Plain text of the subtree, math and all, with no markup."""
        parts = []
        for k in self.kids:
            parts.append(k if isinstance(k, str) else k.text())
        return "".join(parts)


class TreeBuilder(HTMLParser):
    """A tolerant XHTML reader.

    The archive serves well-formed XHTML, but `html.parser` is used rather
    than an XML parser so that a stray entity or an unclosed tag in one
    module cannot take the whole import down.
    """

    def __init__(self):
        HTMLParser.__init__(self, convert_charrefs=True)
        self.root = Node("#root")
        self.cur = self.root
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if self.skip_depth:
            if tag in DROP_SUBTREE:
                self.skip_depth += 1
            return
        if tag in DROP_SUBTREE:
            self.skip_depth = 1
            return
        node = Node(tag, dict(attrs), self.cur)
        self.cur.kids.append(node)
        if tag not in VOID:
            self.cur = node

    def handle_startendtag(self, tag, attrs):
        if self.skip_depth:
            return
        self.cur.kids.append(Node(tag, dict(attrs), self.cur))

    def handle_endtag(self, tag):
        if self.skip_depth:
            if tag in DROP_SUBTREE:
                self.skip_depth -= 1
            return
        if tag in VOID:
            return
        # Unwind to the nearest matching open element; ignore strays.
        probe = self.cur
        while probe is not None and probe.tag != tag:
            probe = probe.parent
        if probe is None or probe.parent is None:
            return
        self.cur = probe.parent

    def handle_data(self, data):
        if self.skip_depth or not data:
            return
        self.cur.kids.append(data)


def parse_html(text):
    tb = TreeBuilder()
    tb.feed(text)
    tb.close()
    return tb.root


# -------------------------------------------------------- MathML -> LaTeX
# OpenStax ships presentation MathML with a content-MathML annotation and
# no LaTeX anywhere, so every formula in the book has to be re-encoded.
# The map below covers the operators and symbols the five books actually
# use; anything unmapped falls through as its own literal character, which
# is right for ASCII and visible (rather than silently wrong) otherwise.

INVISIBLE = "⁡⁢⁣⁤​﻿"

SYM = {
    "−": "-", "–": "-", "—": "-", "·": "\\cdot ",
    "⋅": "\\cdot ", "×": "\\times ", "÷": "\\div ",
    "±": "\\pm ", "∓": "\\mp ", "∗": "*",
    "≤": "\\le ", "≥": "\\ge ", "≠": "\\ne ",
    "≈": "\\approx ", "≡": "\\equiv ", "∼": "\\sim ",
    "≅": "\\cong ", "≪": "\\ll ", "≫": "\\gg ",
    "∞": "\\infty ", "→": "\\to ", "←": "\\leftarrow ",
    "↔": "\\leftrightarrow ", "⇒": "\\Rightarrow ",
    "⇐": "\\Leftarrow ", "⇔": "\\Leftrightarrow ",
    "↦": "\\mapsto ",
    "∫": "\\int ", "∬": "\\iint ", "∭": "\\iiint ",
    "∮": "\\oint ", "∑": "\\sum ", "∏": "\\prod ",
    "∂": "\\partial ", "∇": "\\nabla ",
    "∈": "\\in ", "∉": "\\notin ", "⊂": "\\subset ",
    "⊆": "\\subseteq ", "⊃": "\\supset ", "⊇": "\\supseteq ",
    "∪": "\\cup ", "∩": "\\cap ", "∅": "\\emptyset ",
    "∀": "\\forall ", "∃": "\\exists ", "¬": "\\neg ",
    "∧": "\\wedge ", "∨": "\\vee ", "∴": "\\therefore ",
    "∵": "\\because ", "∣": "\\mid ", "∥": "\\parallel ",
    "⊥": "\\perp ", "∠": "\\angle ", "°": "^\\circ ",
    "∘": "\\circ ", "◦": "\\circ ", "“": "\\text{\"}", "”": "\\text{\"}",
    "′": "\\prime ", "″": "\\prime \\prime ",
    "‴": "\\prime \\prime \\prime ",
    "{": "\\{ ", "}": "\\} ",
    "…": "\\dots ", "⋯": "\\cdots ", "⋮": "\\vdots ",
    "⋱": "\\ddots ",
    "⟨": "\\langle ", "⟩": "\\rangle ",
    "〈": "\\langle ", "〉": "\\rangle ",
    "⌊": "\\lfloor ", "⌋": "\\rfloor ",
    "⌈": "\\lceil ", "⌉": "\\rceil ",
    "‖": "\\| ",
    "⊕": "\\oplus ", "⊗": "\\otimes ",
    "ℵ": "\\aleph ", "ℝ": "\\mathbb{R}", "ℕ": "\\mathbb{N}",
    "ℤ": "\\mathbb{Z}", "ℚ": "\\mathbb{Q}", "ℂ": "\\mathbb{C}",
    "ℒ": "\\mathcal{L}", "ℐ": "\\mathcal{I}", "ℬ": "\\mathcal{B}",
    "ℱ": "\\mathcal{F}", "ℋ": "\\mathcal{H}", "ℰ": "\\mathcal{E}",
    "ℓ": "\\ell ", "ℏ": "\\hbar ", "℘": "\\wp ",
    " ": " ", " ": "\\, ", " ": "\\, ", " ": "\\quad ",
    "□": "\\square ", "△": "\\triangle ",
    "%": "\\% ", "&": "\\& ", "#": "\\# ",
    "$": "\\$ ", "_": "\\_ ",
}

GREEK = {
    "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta",
    "ε": "varepsilon", "ϵ": "epsilon", "ζ": "zeta",
    "η": "eta", "θ": "theta", "ϑ": "vartheta",
    "ι": "iota", "κ": "kappa", "λ": "lambda", "μ": "mu",
    "ν": "nu", "ξ": "xi", "π": "pi", "ϖ": "varpi",
    "ρ": "rho", "ϱ": "varrho", "σ": "sigma",
    "ς": "varsigma", "τ": "tau", "υ": "upsilon",
    "φ": "varphi", "ϕ": "phi", "χ": "chi", "ψ": "psi",
    "ω": "omega",
    "Γ": "Gamma", "Δ": "Delta", "Θ": "Theta",
    "Λ": "Lambda", "Ξ": "Xi", "Π": "Pi", "Σ": "Sigma",
    "Υ": "Upsilon", "Φ": "Phi", "Ψ": "Psi", "Ω": "Omega",
}

# <mi>sin</mi> is the sine function, not the product s times i times n.
FUNCS = {
    "sin", "cos", "tan", "cot", "sec", "csc",
    "sinh", "cosh", "tanh", "coth", "arcsin", "arccos", "arctan",
    "log", "ln", "lg", "exp", "lim", "max", "min", "sup", "inf",
    "det", "dim", "ker", "deg", "gcd", "arg", "hom", "Pr",
}
BIG_OPS = ("\\sum", "\\prod", "\\int", "\\iint", "\\iiint", "\\oint",
           "\\lim", "\\max", "\\min", "\\sup", "\\inf", "\\bigcup", "\\bigcap")

ACCENTS = {
    "¯": "overline", "̄": "overline", "‾": "overline",
    "→": "vec", "⃗": "vec", "^": "hat", "̂": "hat",
    "ˆ": "hat", "~": "tilde", "̃": "tilde", "˜": "tilde",
    "˙": "dot", "̇": "dot", "¨": "ddot", "̈": "ddot",
    "⏞": "overbrace", "⏟": "underbrace",
}

TEXT_ESCAPE = {"\\": "\\textbackslash ", "{": "\\{", "}": "\\}",
               "$": "\\$", "&": "\\&", "%": "\\%", "#": "\\#",
               "_": "\\_", "^": "\\textasciicircum "}


def tex_text(s):
    s = "".join("" if c in INVISIBLE else c for c in s)
    return "".join(TEXT_ESCAPE.get(c, c) for c in s)


def tex_token(s):
    """One MathML token's characters, mapped into LaTeX."""
    out = []
    for c in s:
        if c in INVISIBLE:
            continue
        if c in SYM:
            out.append(SYM[c])
        elif c in GREEK:
            out.append("\\" + GREEK[c] + " ")
        else:
            out.append(c)
    return "".join(out)


def brace(s):
    """Argument of ^ or _, where a single character needs no braces."""
    s = s.strip()
    if s == "":
        return "{}"
    if len(s) == 1 and s not in "\\{}^_&%$#":
        return s
    return "{" + s + "}"


def group(s):
    """Argument of a control sequence such as \\frac, which must always
    be braced - `\\frac` followed by a bare `d` reads as `\\fracd`."""
    return "{" + s.strip() + "}"


VARIANT = {"bold": "\\mathbf", "italic": "\\mathit",
           "bold-italic": "\\boldsymbol", "normal": "\\mathrm",
           "double-struck": "\\mathbb", "script": "\\mathcal",
           "fraktur": "\\mathfrak", "sans-serif": "\\mathsf",
           "monospace": "\\mathtt", "bold-fraktur": "\\mathfrak"}


class MathMLError(Exception):
    pass


def mathml_to_tex(node, depth=0):
    """Recursively render a presentation-MathML subtree as LaTeX."""
    if depth > 80:
        raise MathMLError("nesting too deep")
    tag = node.tag

    if tag in ("annotation", "annotation-xml"):
        return ""                       # content-MathML duplicate; skip it
    if tag == "mspace":
        return space_of(node.get("width", ""))
    if tag in ("mi", "mn", "mo", "ms"):
        return leaf(node, tag)
    if tag == "mtext":
        return mtext(node)

    kids = [k for k in node.kids if isinstance(k, Node)]
    parts = [mathml_to_tex(k, depth + 1) for k in kids]

    if tag == "semantics":
        return parts[0] if parts else ""
    if tag in ("math", "mrow", "mpadded", "maction", "merror"):
        return "".join(parts)
    if tag == "mphantom":
        return "\\phantom{%s}" % "".join(parts)
    if tag == "mstyle":
        inner = "".join(parts)
        v = VARIANT.get(node.get("mathvariant", ""))
        return "%s{%s}" % (v, inner) if v else inner
    if tag == "mfrac":
        if len(parts) == 2:
            if node.get("linethickness", "") in ("0", "0pt", "0em"):
                return "\\binom%s%s" % (group(parts[0]), group(parts[1]))
            return "\\frac%s%s" % (group(parts[0]), group(parts[1]))
        return "".join(parts)
    if tag == "msqrt":
        return "\\sqrt{%s}" % "".join(parts)
    if tag == "mroot":
        if len(parts) == 2:
            return "\\sqrt[%s]{%s}" % (parts[1].strip(), parts[0])
        return "\\sqrt{%s}" % "".join(parts)
    if tag == "msup":
        if len(parts) == 2:
            return "%s^%s" % (script_base(parts[0]), brace(parts[1]))
        return "".join(parts)
    if tag == "msub":
        if len(parts) == 2:
            return "%s_%s" % (script_base(parts[0]), brace(parts[1]))
        return "".join(parts)
    if tag == "msubsup":
        if len(parts) == 3:
            return "%s_%s^%s" % (script_base(parts[0]), brace(parts[1]),
                                 brace(parts[2]))
        return "".join(parts)
    if tag in ("munder", "mover", "munderover"):
        return under_over(tag, parts, node)
    if tag == "mfenced":
        op = node.get("open", "(")
        cl = node.get("close", ")")
        sep = node.get("separators", ",")
        joined = (sep[0] if sep else ",").join(parts)
        return "%s%s%s" % (tex_token(op), joined, tex_token(cl))
    if tag == "menclose":
        notation = node.get("notation", "")
        inner = "".join(parts)
        if "radical" in notation:
            return "\\sqrt{%s}" % inner
        if "top" in notation or "overline" in notation:
            return "\\overline{%s}" % inner
        if "bottom" in notation or "underline" in notation:
            return "\\underline{%s}" % inner
        return inner
    if tag == "mtable":
        return table(node, depth)
    if tag in ("mtr", "mlabeledtr"):
        return " & ".join(parts)
    if tag == "mtd":
        return "".join(parts)
    return "".join(parts)


PUNCT_ONLY = set(" ,;:.?!()[]{}/|+-=<>*'′−")

# Characters that must stay inside \text{} but that KaTeX's text mode may
# not carry. Only typographic variants are rewritten - nothing here changes
# what the source actually says.
TEXT_FALLBACK = {"“": '"', "”": '"', "‘": "'",
                 "’": "'", "–": "-", "—": "-"}


def mtext(node):
    """<mtext> does three different jobs in these books: real prose inside
    a formula, a function name the author did not tag as <mi>, and bare
    punctuation. Only the first of those wants \\text{}.

    A symbol - a degree sign, an infinity, a Greek letter - often sits
    inside an <mtext> run as well, and those cannot stay in text mode
    because KaTeX rejects them there. So the run is split and each symbol
    is lifted back out into maths."""
    raw = node.text().replace(" ", " ").replace(" ", " ")
    clean = "".join("" if c in INVISIBLE else c for c in raw)
    stripped = clean.strip()
    if not stripped:
        return "\\ " if clean else ""
    if stripped in FUNCS:
        return "\\%s " % stripped

    out, buf = [], []

    def flush():
        if not buf:
            return
        chunk = "".join(buf)
        del buf[:]
        if all(c in PUNCT_ONLY for c in chunk):
            out.append(tex_token(chunk))
        else:
            out.append("\\text{%s}" % tex_text(chunk))

    for c in stripped:
        if ord(c) < 128:
            buf.append(c)
        elif c in SYM:
            flush()
            out.append(SYM[c])
        elif c in GREEK:
            flush()
            out.append("\\" + GREEK[c] + " ")
        else:
            buf.append(TEXT_FALLBACK.get(c, c))
    flush()

    lead = " " if clean[:1] == " " else ""
    trail = " " if clean[-1:] == " " else ""
    return "%s%s%s" % (lead, "".join(out), trail)


def script_base(base):
    """`x` takes a superscript directly, and so does a single control
    sequence; a compound expression has to be braced or `a+b^2` binds
    to the `b` alone."""
    b = base.strip()
    if not b:
        return "{}"
    if len(b) == 1:
        return b
    if re.fullmatch(r"\\[A-Za-z]+", b):
        return b
    if re.fullmatch(r"[A-Za-z0-9.]+", b):
        return b
    if b.startswith("{") and b.endswith("}") and b.count("{") == b.count("}"):
        return b
    return "{" + b + "}"


def under_over(tag, parts, node):
    if not parts:
        return ""
    base = parts[0].strip()
    is_big = any(base == op.strip() or base.startswith(op + " ") or
                 base.rstrip().endswith(op) for op in BIG_OPS)
    if tag == "munder" and len(parts) == 2:
        acc = accent_of(node.kids, 1)
        if is_big:
            return "%s_%s" % (base, brace(parts[1]))
        if acc:
            under = {"overline": "underline", "overbrace": "underbrace"}.get(acc, acc)
            return "\\%s{%s}" % (under, base)
        return "\\underset{%s}{%s}" % (parts[1].strip(), base)
    if tag == "mover" and len(parts) == 2:
        acc = accent_of(node.kids, 1)
        if acc:
            return "\\%s{%s}" % (acc, base)
        if is_big:
            return "%s^%s" % (base, brace(parts[1]))
        return "\\overset{%s}{%s}" % (parts[1].strip(), base)
    if tag == "munderover" and len(parts) == 3:
        if is_big:
            return "%s_%s^%s" % (base, brace(parts[1]), brace(parts[2]))
        return "\\overset{%s}{\\underset{%s}{%s}}" % (
            parts[2].strip(), parts[1].strip(), base)
    return "".join(parts)


def accent_of(kids, index):
    """An <mover> whose overscript is a lone bar or arrow is an accent,
    not a stacked expression."""
    nodes = [k for k in kids if isinstance(k, Node)]
    if len(nodes) <= index:
        return None
    raw = nodes[index].text().strip()
    if len(raw) == 1 and raw in ACCENTS:
        return ACCENTS[raw] or None
    return None


def table(node, depth):
    rows = [k for k in node.kids if isinstance(k, Node)
            and k.tag in ("mtr", "mlabeledtr")]
    body, ncol = [], 1
    for r in rows:
        cells = [k for k in r.kids if isinstance(k, Node) and k.tag == "mtd"]
        ncol = max(ncol, len(cells))
        body.append(" & ".join(mathml_to_tex(c, depth + 1) for c in cells))
    align = node.get("columnalign", "").split()
    spec = "".join((a[0] if a and a[0] in "lcr" else "l") for a in align[:ncol])
    spec = (spec + "l" * ncol)[:ncol] or "l"
    return "\\begin{array}{%s}%s\\end{array}" % (spec, " \\\\ ".join(body))


def space_of(width):
    m = re.match(r"([0-9.]+)\s*em", width or "")
    if not m:
        return "\\,"
    try:
        w = float(m.group(1))
    except ValueError:
        return "\\,"
    if w >= 1.0:
        return "\\quad "
    if w >= 0.4:
        return "\\;"
    return "\\,"


def leaf(node, tag):
    raw = node.text()
    clean = "".join("" if c in INVISIBLE else c for c in raw)
    stripped = clean.strip()
    if not stripped:
        return "\\ " if clean else ""
    variant = node.get("mathvariant", "")
    if tag == "mi":
        if stripped in FUNCS:
            return "\\%s " % stripped
        if len(stripped) > 1 and stripped.isalpha() and stripped not in GREEK:
            return "\\mathrm{%s}" % stripped
        body = tex_token(stripped)
        if variant and variant != "italic":
            v = VARIANT.get(variant)
            if v:
                return "%s{%s}" % (v, body)
        return body
    body = tex_token(stripped)
    if variant:
        v = VARIANT.get(variant)
        if v:
            return "%s{%s}" % (v, body)
    return body


def balanced(tex):
    """Reject anything whose braces do not close - a malformed formula
    would take the whole KaTeX render down with it."""
    depth = 0
    i, n = 0, len(tex)
    while i < n:
        c = tex[i]
        if c == "\\" and i + 1 < n:
            i += 2
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth < 0:
                return False
        i += 1
    return depth == 0


def render_math(node, stats=None):
    """A <math> element as `$...$` or `$$...$$`, or "" if unusable."""
    try:
        tex = mathml_to_tex(node)
    except (MathMLError, RecursionError):
        if stats is not None:
            stats["math_failed"] += 1
        return ""
    tex = re.sub(r"[ \t]+", " ", tex).strip()
    if not tex or not balanced(tex):
        if stats is not None:
            stats["math_failed"] += 1
        return ""
    if stats is not None:
        stats["math_ok"] += 1
    if node.get("display", "inline") == "block":
        return "$$%s$$" % tex
    return "$%s$" % tex


# ------------------------------------------------------- prose extraction
# The renderer in index.html accepts **bold**, `inline code`, blank-line
# paragraphs, "- " bullets, and $...$ / $$...$$ maths. Nothing else. Every
# block below is reduced to that subset; tables, figures, images and raw
# markup are dropped rather than shown as noise.

INLINE_BOLD = {"strong", "b", "em", "i", "dfn", "cite", "term"}
DROP_INLINE = {"img", "figure", "table", "iframe", "svg", "video", "audio"}


def clean_ws(s):
    """Collapse runs of space, but keep the line breaks a <br> put in."""
    s = (s or "").replace("\u00a0", " ").replace("\u2009", " ")
    s = re.sub(r"[ \t\f\v]+", " ", s)
    return re.sub(r"\s*\n\s*", "\n", s).strip()


def one_line(s):
    """Everything on a single line - titles, headings, list items."""
    return re.sub(r"\s+", " ", (s or "").replace("\u00a0", " ")).strip()


def escape_prose(s):
    """A literal dollar sign in the prose would otherwise open a maths
    span. The Statistics book is full of them."""
    return s.replace("$", "\\$")


def inline_text(node, stats):
    """Flatten an element's inline content into the body subset."""
    out = []
    for k in node.kids:
        if isinstance(k, str):
            out.append(escape_prose(k))
            continue
        tag = k.tag
        if tag == "math":
            out.append(render_math(k, stats))
        elif tag in DROP_INLINE:
            if tag in ("table", "figure"):
                stats["blocks_dropped"] += 1
        elif tag == "br":
            out.append("\n")
        elif tag == "code":
            inner = one_line(inline_text(k, stats))
            out.append("`%s`" % inner if inner else "")
        elif tag in INLINE_BOLD:
            inner = one_line(inline_text(k, stats))
            out.append("**%s**" % inner if inner else "")
        elif tag == "a":
            out.append(inline_text(k, stats))      # links are flattened
        else:
            out.append(inline_text(k, stats))
    return "".join(out)


def para(node, stats):
    t = clean_ws(inline_text(node, stats))
    t = re.sub(r"\s+([,.;:)])", r"\1", t)
    return t


def list_block(node, stats):
    items = []
    for li in node.kids:
        if isinstance(li, Node) and li.tag == "li":
            t = one_line(inline_text(li, stats))
            if t:
                items.append("- " + t)
    return "\n".join(items)


def block_math_of(node, stats):
    """Every display equation in a subtree, as LaTeX."""
    out = []
    for m in node.find_all(lambda n: n.tag == "math"):
        if m.get("display", "") == "block":
            tex = render_math(m, stats)
            if tex:
                out.append(tex)
    return out


SKIP_CLASS = ("os-eos", "os-section-exercises", "os-figure", "os-caption",
              "os-table", "media")
SKIP_DATATYPE = ("media", "exercise", "problem", "solution", "footnote-refs",
                 "glossary", "cnx-media", "table")


def skippable(node):
    cls = node.get("class", "")
    dt = node.get("data-type", "")
    if any(c in cls for c in SKIP_CLASS):
        return True
    if dt in SKIP_DATATYPE:
        return True
    if node.tag in ("figure", "table", "img", "aside"):
        return True
    return False


def walk_blocks(node, stats, depth=0):
    """Yield body-subset text blocks in document order.

    Sections nest, so this recurses; anything that cannot be represented
    in the subset (a figure, a data table, an end-of-section exercise
    bank) is skipped whole rather than half-rendered.
    """
    blocks = []
    for k in node.kids:
        if not isinstance(k, Node):
            continue
        if skippable(k):
            if k.tag in ("figure", "table") or "os-table" in k.get("class", ""):
                stats["blocks_dropped"] += 1
            continue
        tag = k.tag
        if tag == "p":
            t = para(k, stats)
            if t:
                blocks.append(t)
        elif tag in ("ul", "ol"):
            t = list_block(k, stats)
            if t:
                blocks.append(t)
        elif tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            t = one_line(inline_text(k, stats))
            if t:
                blocks.append("**%s**" % t)
        elif tag == "div" and k.get("data-type") == "equation":
            for tex in block_math_of(k, stats):
                blocks.append(tex)
        elif tag in ("section", "div", "span"):
            if depth < 6:
                blocks.extend(walk_blocks(k, stats, depth + 1))
        elif tag == "math":
            tex = render_math(k, stats)
            if tex:
                blocks.append(tex)
    return blocks


def strip_number(node):
    """`<span class="os-number">1.1</span>...<span class="os-text">Review
    of Functions</span>` -> `1.1 Review of Functions`."""
    num, text = "", ""
    for s in node.find_all(lambda n: n.tag == "span"):
        cls = s.get("class", "")
        if "os-number" in cls and not num:
            num = one_line(s.text())
        elif "os-text" in cls and not text:
            text = one_line(s.text())
    whole = one_line(node.text())
    if not text:
        text = whole
    return one_line("%s %s" % (num, text)) if num and not text.startswith(num) else text


def slugify(s):
    s = re.sub(r"^[0-9.]+\s*", "", s).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:48] or "topic"


# ---------------------------------------------------------- module -> section
def module_section(page_html, module, stats):
    """One book module becomes one lesson section.

    Everything in it is the source's own words. The only editing is
    truncation at a paragraph boundary once the body budget is spent,
    which is recorded rather than hidden.
    """
    root = parse_html(page_html)
    pages = root.find_all(lambda n: n.get("data-type") == "page")
    page = pages[0] if pages else root

    heads = page.find_all(lambda n: n.get("data-type") == "document-title")
    title = strip_number(heads[0]) if heads else one_line(module["title_text"])
    if not title:
        title = module["title_text"]

    objectives = [one_line(s.text()) for s in page.find_all(
        lambda n: "os-abstract-content" in n.get("class", ""))]
    objectives = [escape_prose(o) for o in objectives if o]

    abstracts = page.find_all(lambda n: n.get("data-type") == "abstract")
    abstract_ids = {id(a) for a in abstracts}

    body_source = Node("#body")
    for k in page.kids:
        if isinstance(k, Node) and id(k) in abstract_ids:
            continue
        if isinstance(k, Node) and k.get("data-type") == "document-title":
            continue
        body_source.kids.append(k)

    blocks = walk_blocks(body_source, stats)

    lead = []
    if objectives:
        lead.append("**Learning objectives**")
        lead.append("\n".join("- " + o for o in objectives))

    kept, used, truncated = list(lead), sum(len(b) for b in lead), False
    for b in blocks:
        if used and used + len(b) > BODY_BUDGET:
            truncated = True
            break
        kept.append(b)
        used += len(b) + 2
    body = "\n\n".join(x for x in kept if x.strip())
    body = re.sub(r"\n{3,}", "\n\n", body).strip()

    equations = block_math_of(page, stats)
    code, clen = [], 0
    for tex in equations:
        one = tex.strip("$").strip()
        if clen + len(one) > CODE_BUDGET and code:
            break
        code.append(one)
        clen += len(one) + 1
    if not code:
        # No display equation in this module - fall back to the inline
        # formulae, and record it if there is no mathematics at all.
        inline = []
        for m in page.find_all(lambda n: n.tag == "math"):
            tex = render_math(m, stats)
            body_tex = tex.strip("$").strip()
            if len(body_tex) > 6 and body_tex not in inline:
                inline.append(body_tex)
            if len(inline) >= 5:
                break
        code = inline

    section = {
        "title": title,
        "body": body,
        "code": "\n".join(code),
        "lang": "latex",
        "annotations": [],
    }
    stats["sections"] += 1
    if truncated:
        stats["truncated"] += 1
    if not code:
        stats["no_formula"].append(title)
    if len(body) < 200:
        stats["thin_body"].append(title)
    return section


# --------------------------------------------------------------- assembly
def html_text(fragment):
    """Chapter and module titles arrive as HTML fragments in the TOC."""
    return one_line(re.sub(r"<[^>]+>", " ", fragment or ""))


def split_evenly(items, cap):
    """Split a chapter's modules into floors of at most `cap`, balanced so
    a chapter of five never ends in a floor of one."""
    n = len(items)
    if n <= cap:
        return [items]
    groups = (n + cap - 1) // cap
    base, extra = divmod(n, groups)
    out, i = [], 0
    for g in range(groups):
        take = base + (1 if g < extra else 0)
        out.append(items[i:i + take])
        i += take
    return out


ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]


def section_range(mods):
    """`3.1-3.3` from the module numbers, for a split chapter's floor name."""
    nums = []
    for m in mods:
        mm = re.match(r"\s*([0-9]+(?:\.[0-9]+)*)", m["title_text"])
        if mm:
            nums.append(mm.group(1))
    if not nums:
        return ""
    return nums[0] if len(nums) == 1 else "%s-%s" % (nums[0], nums[-1])


def read_toc(book_json):
    """Chapters and their numbered modules, in book order."""
    chapters = []
    for c in book_json["tree"].get("contents", []):
        if c.get("toc_type") != "chapter":
            continue
        mods = []
        for m in c.get("contents", []) or []:
            if m.get("toc_target_type") != "numbered-section":
                continue
            mods.append({
                "uuid": m["id"].split("@")[0],
                "slug": m.get("slug", ""),
                "title_text": html_text(m.get("title", "")),
            })
        if mods:
            chapters.append({"title": html_text(c.get("title", "")), "modules": mods})
    return chapters


def resolve_book(spec, fetcher, catalogue, report):
    """cms catalogue -> uuid + real licence -> pinned version -> TOC."""
    entry = None
    for want in spec["titles"]:
        for item in catalogue:
            if item["title"].strip() == want:
                entry = item
                break
        if entry:
            break
    if entry is None:
        report["unresolved"].append("%s: no catalogue entry for %s"
                                    % (spec["id"], " / ".join(spec["titles"])))
        return None

    detail = fetcher.json(entry["meta"]["detail_url"],
                          "cms-book-%s" % entry["id"])
    if not detail:
        report["unresolved"].append("%s: detail_url unreachable" % spec["id"])
        return None
    uuid = detail.get("cnx_id") or detail.get("book_uuid")
    if not uuid:
        report["unresolved"].append("%s: no cnx_id on the book page" % spec["id"])
        return None

    release = fetcher.json(RELEASE, "rex-release")
    if not release:
        report["unresolved"].append("%s: rex/release.json unreachable" % spec["id"])
        return None
    archive = "https://openstax.org" + release["archiveUrl"]
    ver = (release.get("books", {}).get(uuid) or {}).get("defaultVersion")
    if not ver:
        report["unresolved"].append(
            "%s: %s is not in the live release map" % (spec["id"], detail["title"]))
        return None

    book_json = fetcher.json("%s/contents/%s@%s.json" % (archive, uuid, ver),
                             "book-%s-%s" % (uuid, ver))
    if not book_json:
        report["unresolved"].append("%s: archive contents unreachable" % spec["id"])
        return None

    lic = detail.get("license_name", "") or book_json.get("license", {}).get("name", "")
    licv = detail.get("license_version", "") or "4.0"
    return {
        "spec": spec,
        "title": detail["title"],
        "slug": detail["meta"]["slug"],
        "uuid": uuid,
        "version": ver,
        "archive": archive,
        "licence": short_licence(lic, licv),
        "licence_full": "%s %s" % (lic, licv),
        "webview": detail.get("rex_callout_title") and detail.get("webview_rex_link") or
                   ("https://openstax.org/books/%s/pages/1-introduction" % detail["meta"]["slug"]),
        "toc": read_toc(book_json),
    }


def short_licence(name, version):
    n = (name or "").lower()
    if "noncommercial" in n and "sharealike" in n:
        return "CC BY-NC-SA %s" % version
    if "sharealike" in n:
        return "CC BY-SA %s" % version
    if "noncommercial" in n:
        return "CC BY-NC %s" % version
    if "attribution" in n:
        return "CC BY %s" % version
    return name or "see openstax.org"


def build_dungeon(book, fetcher, report, cap):
    spec = book["spec"]
    stats = report["books"][spec["id"]]
    floors = []
    page_url = "%s/contents/%s@%s:%%s.json" % (book["archive"], book["uuid"],
                                               book["version"])
    for chapter in book["toc"]:
        groups = split_evenly(chapter["modules"], cap)
        for gi, mods in enumerate(groups):
            sections, concepts, missing = [], [], []
            for m in mods:
                page = fetcher.json(page_url % m["uuid"],
                                    "page-%s-%s" % (book["uuid"][:8], m["uuid"]))
                html = (page or {}).get("content")
                if not html:
                    missing.append(m["title_text"])
                    stats["pages_missing"] += 1
                    continue
                stats["pages"] += 1
                sections.append(module_section(html, m, stats))
                concepts.append(slugify(m["title_text"]))

            n = len(floors) + 1
            name = chapter["title"]
            if len(groups) > 1:
                rng = section_range(mods)
                suffix = rng or ROMAN[min(gi + 1, 10)]
                name = "%s · %s" % (chapter["title"], suffix)

            todo = []
            if len(sections) < MIN_SECTIONS:
                todo.append("lesson has %d section(s); the schema wants 2-4"
                            % len(sections))
            todo.append(
                "practice: author 6-10 problems for %s. OpenStax ships an "
                "exercise bank for these modules at %s - it is NOT imported, "
                "because the archive gives the questions without a usable "
                "answer key, and a guessed answer key is worse than none."
                % (", ".join(m["title_text"] for m in mods), book["webview"]))
            todo.append("exam: author 8-12 questions. Nothing here is imported "
                        "from OpenStax assessment material.")
            for t in missing:
                todo.append("module %r could not be fetched; no section for it" % t)

            floors.append({
                "n": n,
                "name": name,
                "concepts": concepts,
                "lesson": {"sections": sections},
                "practice": [],
                "exam": [],
                "_todo": todo,
            })

    return {
        "id": spec["id"],
        "name": spec["name"],
        "subject": spec["subject"],
        "category": "theory",
        "disciplineType": "mathematics",
        "sigil": spec["sigil"],
        "unlock": None,
        "lang": "text",
        "runtime": "none",
        "totalFloors": len(floors),
        "source": "OpenStax %s (%s)" % (book["title"], book["licence"]),
        "sourceUrl": book["webview"],
        "importedBy": "scripts/import_openstax.py",
        "blurb": spec["blurb"],
        "floors": floors,
    }


# --------------------------------------------------------------- syllabus
BEGIN = "<!-- GENERATED:BEGIN - import_openstax.py rewrites this block -->"
END = "<!-- GENERATED:END -->"


def write_generated_block(path, lines):
    block = BEGIN + "\n" + "\n".join(lines) + "\n" + END + "\n"
    if os.path.exists(path):
        old = io.open(path, encoding="utf-8").read()
        if BEGIN in old and END in old:
            head = old.split(BEGIN)[0]
            tail = old.split(END, 1)[1]
            io.open(path, "w", encoding="utf-8").write(head + block + tail)
            return
        io.open(path, "w", encoding="utf-8").write(old.rstrip() + "\n\n" + block)
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    io.open(path, "w", encoding="utf-8").write(block)


def write_syllabus(dungeon, book, path):
    lines = ["# Syllabus - %s (%s)" % (dungeon["subject"], dungeon["name"]), ""]
    lines.append("Derived from `%s`. Floors follow the book's own table of "
                 "contents; a chapter longer than four modules becomes more "
                 "than one floor so that no lesson exceeds the four-section "
                 "cap in `content/_SCHEMA.md`." % dungeon["source"])
    lines.append("")
    lines.append("Source: %s" % dungeon["sourceUrl"])
    lines.append("")
    lines.append("| Floor | Name | Modules |")
    lines.append("|---|---|---|")
    for f in dungeon["floors"]:
        mods = ", ".join(s["title"] for s in f["lesson"]["sections"])
        lines.append("| %d | %s | %s |" % (f["n"], f["name"], mods))
    lines += ["", "## Not imported", "",
              "- end-of-section exercises (questions without a machine-usable "
              "answer key)", "- figures, photographs and data tables",
              "- every assessment: practice and exam are authored for Grimoire"]
    write_generated_block(path, lines)


def write_attribution(books, path):
    lines = ["## OpenStax mathematics textbooks", "",
             "- **Site:** openstax.org", "- **Imported by:** "
             "`scripts/import_openstax.py`",
             "- **Used for:** the Athenaeum mathematics dungeons.", "",
             "| Dungeon | Book | Licence |", "|---|---|---|"]
    for b in books:
        lines.append("| `%s` | %s | %s |"
                     % (b["spec"]["id"], b["title"], b["licence_full"]))
    lines += ["",
              "What is taken: chapter and module prose, learning objectives "
              "and displayed equations, reached through the OpenStax archive "
              "API (`/apps/archive/{release}/contents/{uuid}@{version}"
              ":{module}.json`).", "",
              "The books ship presentation MathML with no LaTeX annotation, "
              "so every formula is re-encoded as LaTeX element by element by "
              "the importer. That is a change of notation, not of content.",
              "",
              "Not taken: figures, photographs, data tables and the "
              "end-of-section exercise banks. Practice and exam challenges "
              "are **not** imported from OpenStax - they are written for "
              "Grimoire.", "",
              "Both licences above permit derivative works with attribution; "
              "the CC BY-NC-SA titles additionally require that this "
              "material stay non-commercial and be shared alike."]
    write_generated_block(path, lines)


# ------------------------------------------------------------------ main
def new_stats():
    return {"pages": 0, "pages_missing": 0, "sections": 0, "truncated": 0,
            "math_ok": 0, "math_failed": 0, "blocks_dropped": 0,
            "no_formula": [], "thin_body": []}


def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("book", nargs="*",
                    help="dungeon id to import; default is all five")
    ap.add_argument("--max-sections", type=int, default=MAX_SECTIONS,
                    help="modules per floor (default 4, the schema cap)")
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--dry-run", action="store_true",
                    help="print the summary without writing files")
    args = ap.parse_args()

    wanted = args.book or [b["id"] for b in BOOKS]
    unknown = [w for w in wanted if w not in [b["id"] for b in BOOKS]]
    if unknown:
        raise SystemExit("unknown book id(s): %s\nknown: %s"
                         % (", ".join(unknown),
                            ", ".join(b["id"] for b in BOOKS)))
    specs = [b for b in BOOKS if b["id"] in wanted]

    cap = max(1, min(args.max_sections, MAX_SECTIONS))
    fetcher = Fetcher(use_cache=not args.no_cache)
    report = {"books": {}, "unresolved": [], "written": []}

    print("resolving the OpenStax catalogue ...")
    catalogue = fetcher.json(
        CMS + "?type=books.Book&limit=200&fields=title,slug", "catalogue")
    if not catalogue:
        raise SystemExit("could not reach the OpenStax book catalogue.")
    items = catalogue.get("items", [])
    print("  %d books listed" % len(items))

    dungeons, resolved = [], []
    for spec in specs:
        report["books"][spec["id"]] = new_stats()
        book = resolve_book(spec, fetcher, items, report)
        if not book:
            print("  ! %-24s unresolved" % spec["id"])
            continue
        nmods = sum(len(c["modules"]) for c in book["toc"])
        print("  - %-24s %s  %s  %d chapters, %d modules"
              % (spec["id"], book["title"], book["licence"],
                 len(book["toc"]), nmods))
        resolved.append(book)

    for book in resolved:
        print("fetching %s ..." % book["title"])
        dungeons.append(build_dungeon(book, fetcher, report, cap))

    if not args.dry_run:
        for d in dungeons:
            path = os.path.join(ROOT, "content", "%s.json" % d["id"])
            os.makedirs(os.path.dirname(path), exist_ok=True)
            json.dump(d, io.open(path, "w", encoding="utf-8"),
                      ensure_ascii=False, indent=1)
            report["written"].append(os.path.relpath(path, ROOT))
        for d, book in zip(dungeons, resolved):
            syl = os.path.join(ROOT, "syllabi", "%s.md" % d["id"])
            write_syllabus(d, book, syl)
            report["written"].append(os.path.relpath(syl, ROOT))
        if len(resolved) == len(BOOKS):
            att = os.path.join(ROOT, "content", "attribution.md")
            write_attribution(resolved, att)
            report["written"].append(os.path.relpath(att, ROOT))

    summary(dungeons, resolved, fetcher, report, args)


def summary(dungeons, books, fetcher, report, args):
    n_floors = sum(len(d["floors"]) for d in dungeons)
    n_sec = sum(len(f["lesson"]["sections"]) for d in dungeons for f in d["floors"])
    n_prac = sum(len(f["practice"]) for d in dungeons for f in d["floors"])
    n_exam = sum(len(f["exam"]) for d in dungeons for f in d["floors"])
    n_todo = sum(len(f["_todo"]) for d in dungeons for f in d["floors"])
    body_chars = sum(len(s["body"]) for d in dungeons for f in d["floors"]
                     for s in f["lesson"]["sections"])
    math_ok = sum(s["math_ok"] for s in report["books"].values())
    math_bad = sum(s["math_failed"] for s in report["books"].values())
    dropped = sum(s["blocks_dropped"] for s in report["books"].values())
    thin = sum(len(s["thin_body"]) for s in report["books"].values())
    noform = sum(len(s["no_formula"]) for s in report["books"].values())
    trunc = sum(s["truncated"] for s in report["books"].values())

    print("")
    print("=" * 74)
    print("  IMPORT SUMMARY - OpenStax")
    print("=" * 74)
    print("  network: %d fetched, %d from cache%s" % (
        fetcher.misses, fetcher.hits,
        ", %d failed" % len(fetcher.failures) if fetcher.failures else ""))
    print("")
    print("  SOURCE RESOLUTION       (chapter prose reached, or link-out only?)")
    for b in books:
        st = report["books"][b["spec"]["id"]]
        verdict = "REAL TEXT" if st["pages"] and not st["pages_missing"] else (
            "PARTIAL" if st["pages"] else "NO TEXT")
        print("    %-24s %-34s %s" % (b["spec"]["id"], b["title"], verdict))
        print("      %s | %s@%s | %d/%d module pages read"
              % (b["licence"], b["uuid"][:8], b["version"],
                 st["pages"], st["pages"] + st["pages_missing"]))
    for u in report["unresolved"]:
        print("    ! %s" % u)
    print("")
    print("  IMPORTED")
    print("    dungeons                    : %d" % len(dungeons))
    print("    floors                      : %d" % n_floors)
    print("    lesson sections             : %d" % n_sec)
    print("    prose imported              : %s characters, all of it the "
          "book's own words" % format(body_chars, ","))
    print("    formulae MathML -> LaTeX    : %d converted, %d skipped as "
          "unrenderable" % (math_ok, math_bad))
    print("")
    print("  NOT IMPORTED / NEEDS MANUAL WORK")
    print("    practice challenges         : %d  (every floor needs 6-10)" % n_prac)
    print("    exam questions              : %d  (every floor needs 8-12)" % n_exam)
    print("    total _todo entries         : %d" % n_todo)
    print("    figures and tables dropped  : %d (no representation in the "
          "body subset)" % dropped)
    print("    sections truncated at budget: %d of %d" % (trunc, n_sec))
    print("    sections with no formula    : %d" % noform)
    print("    sections under 200 chars    : %d" % thin)
    if fetcher.failures:
        print("    fetch failures              : %s"
              % "; ".join(fetcher.failures[:4]))
    print("")
    print("  PER DUNGEON")
    for d in dungeons:
        st = report["books"][d["id"]]
        print("    %-24s %2d floors  %3d sections  %s"
              % (d["id"], len(d["floors"]),
                 sum(len(f["lesson"]["sections"]) for f in d["floors"]),
                 d["source"]))
        for f in d["floors"]:
            print("      %2d. %-46s %d sections"
                  % (f["n"], f["name"][:46], len(f["lesson"]["sections"])))
    print("")
    if args.dry_run:
        print("  (dry run - nothing written)")
    else:
        for w in report["written"]:
            print("  wrote %s" % w)
        if len(books) != len(BOOKS):
            print("  (content/attribution.md left alone - it is only "
                  "regenerated on a full run)")
    print("  content/index.json is NOT touched by this script.")
    print("  next: python scripts/validate_content.py %s"
          % (dungeons[0]["id"] if dungeons else ""))
    print("=" * 74)


if __name__ == "__main__":
    main()
