#!/usr/bin/env python3
"""Import The-Art-of-Hacking/h4cker into the Grimoire Cryptography dungeon.

    python scripts/import_h4cker.py
    python scripts/import_h4cker.py --dry-run
    python scripts/import_h4cker.py --no-cache

h4cker is a very large reference repository. The overwhelming majority of it is
curated *link lists* -- `tools.md`, `crypto_frameworks.md`, the DFIR README and
so on are bibliographies, not lessons. A handful of directories are genuinely
written prose: the cryptography/PKI tutorials, labs and challenges, the
buffer-overflow teaching set, the ethical-hacking methodology notes and the
threat-hunting write-ups.

This importer therefore does not walk the tree indiscriminately. It reads a
hand-picked syllabus of files, then applies a prose gate to every candidate
section: a section whose lines are mostly markdown links, or which has too
little link-free text, is refused and reported rather than shipped as a lesson.
Nothing is paraphrased or invented -- every body is the source's own words,
converted into the renderer's markdown subset. Files that fail the gate become
an honest one-line link-out, never fabricated teaching text.

No practice or exam challenges are emitted. The repository has challenge
write-ups but they publish their own answers inline, so they cannot be turned
into gradeable questions without authoring; each floor carries a _todo saying so.

Source: github.com/The-Art-of-Hacking/h4cker (MIT). See content/attribution.md.
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
CACHE = os.path.join(ROOT, ".cache", "h4cker")
REPO = "The-Art-of-Hacking/h4cker"
BRANCH = "master"
RAW = "https://raw.githubusercontent.com/%s/%s/%%s" % (REPO, BRANCH)
BLOB = "https://github.com/%s/blob/%s/%%s" % (REPO, BRANCH)
TREE = "https://api.github.com/repos/%s/git/trees/%s?recursive=1" % (REPO, BRANCH)

DUNGEON_ID = "cryptography"

CRYPTO = "cybersecurity-domains/cryptography-pki/cryptography-and-pki/"
BOF = "cybersecurity-domains/offensive-security/buffer-overflow-examples/"
FUND = "cybersecurity-domains/fundamentals/"
DEF = "cybersecurity-domains/defensive-security/"
OFF = "cybersecurity-domains/offensive-security/"

# The syllabus. Only directories that actually contain written prose appear
# here; `tools.md`-style bibliographies are deliberately excluded, and the
# summary reports how many candidate files were refused by the prose gate.
SYLLABUS = [
    ("The Warded Threshold",
     ["cia-triad", "security-controls", "social-engineering", "risk"],
     [FUND + "foundational-cybersecurity-concepts/README.md",
      FUND + "foundational-cybersecurity-concepts/Undertanding Information Security Controls.md",
      FUND + "foundational-cybersecurity-concepts/social_eng_countermeasures.md"]),

    ("Hall of Sanctioned Trespass",
     ["methodology", "scoping", "rules-of-engagement", "static-dynamic-analysis",
      "reconnaissance"],
     [FUND + "methodology/README.md",
      FUND + "methodology/scoping.md",
      FUND + "methodology/static_dynamic_analysis.md",
      FUND + "methodology/post_engagement_cleanup.md",
      OFF + "recon/stealth_nmap.md"]),

    ("The Cipher Foundry",
     ["symmetric-encryption", "asymmetric-encryption", "hashing",
      "algorithm-selection", "disk-encryption"],
     [CRYPTO + "README.md",
      CRYPTO + "crypto_algorithms.md",
      CRYPTO + "disk_encryption.md",
      CRYPTO + "quick-reference/crypto-algorithms-reference.md"]),

    ("Vault of Broken Alphabets",
     ["caesar-cipher", "vigenere-cipher", "frequency-analysis", "cryptanalysis"],
     [CRYPTO + "challenges/README.md",
      CRYPTO + "challenges/01_Classic_Caesar_Cipher.md",
      CRYPTO + "challenges/04_Classic_Vigenere_Cipher.md",
      CRYPTO + "challenges/07_Frequency_Analysis_Attack_Substitution.md"]),

    ("The Shared Secret",
     ["diffie-hellman", "key-exchange", "elliptic-curve", "rsa"],
     [CRYPTO + "challenges/02_Diffie_Hellman_Key_Exchange.md",
      CRYPTO + "challenges/05_Implement_Diffie_Hellman_Key_Exchange.md",
      CRYPTO + "challenges/08_Elliptic_Curve_Key_Pair_Generation.md",
      CRYPTO + "challenges/09_Attack_on_Weak_RSA_Modulus.md"]),

    ("Chamber of Seals",
     ["digital-signatures", "signature-forgery", "gpg", "key-management"],
     [CRYPTO + "challenges/03_Digital_Signature_Forgery.md",
      CRYPTO + "challenges/06_Digital_Signature_Forgery_Advanced.md",
      CRYPTO + "gpg_how_to.md",
      CRYPTO + "labs/lab-01-gpg-basics.md"]),

    ("The Certificate Spire",
     ["pki", "certificate-authority", "x509", "certificate-lifecycle"],
     [CRYPTO + "tutorials/pki-fundamentals.md",
      CRYPTO + "cert_openssl.md",
      CRYPTO + "labs/lab-02-openssl-certificates.md"]),

    ("Corridor of Sealed Channels",
     ["tls", "cipher-suites", "code-signing", "post-quantum"],
     [CRYPTO + "tutorials/tls-ssl-guide.md",
      CRYPTO + "tutorials/code-signing-guide.md",
      CRYPTO + "tutorials/post-quantum-migration.md"]),

    ("Depths of the Overflowing Stack",
     ["buffer-overflow", "stack-memory", "cpu-registers", "offset-calculation"],
     [BOF + "basics/what-is-buffer-overflow.md",
      BOF + "basics/memory-and-stack.md",
      BOF + "basics/registers.md",
      BOF + "basics/assembly-basics.md",
      BOF + "exploitation/calculating-offsets.md"]),

    ("The Archmage's Ward",
     ["exploit-mitigations", "memory-safety", "secure-coding", "threat-hunting",
      "incident-response"],
     [BOF + "defenses/mitigations.md",
      BOF + "defenses/memory-safe-languages.md",
      BOF + "defenses/secure-coding.md",
      DEF + "threat-hunting/intro-to-threat-hunting.md",
      DEF + "threat-hunting/threat_hunting_process.md",
      DEF + "threat-hunting/zeek-tips.md"]),
]

# A section must clear both gates to ship as a lesson. These numbers were tuned
# against the repository: `tools.md` scores ~0.9 link fraction, the PKI tutorial
# ~0.08.
MIN_PROSE_CHARS = 220
MAX_LINK_FRACTION = 0.50
MAX_BODY_CHARS = 2200
SECTIONS_PER_FLOOR = 4
MIN_SECTIONS = 2

FENCE = re.compile(r"```([a-zA-Z0-9+#._-]*)[ \t]*\n(.*?)```", re.S)
MD_LINK = re.compile(r"\[[^\]]*\]\([^)]*\)")
EMOJI = re.compile("[←-⇿⌀-➿⬀-⯿️"
                   "\U0001F000-\U0001FAFF]")


def cache_key(name):
    """A filesystem-safe cache filename. Windows rejects ? : * " < > |."""
    safe = re.sub(r'[^A-Za-z0-9._-]', "_", name)
    return safe[-180:]


class Fetcher:
    def __init__(self, use_cache=True):
        self.use_cache = use_cache
        self.hits = self.misses = 0
        self.failures = []

    @staticmethod
    def _normalise(text):
        """Unix line endings, no BOM.

        Much of h4cker is committed with CRLF. Every regex below anchors on
        "\\n", so a stray "\\r" silently defeats fence and heading detection --
        which is exactly how a tutorial full of `openssl` examples ends up
        looking like it has no code at all.
        """
        return text.lstrip("\ufeff").replace("\r\n", "\n").replace("\r", "\n")

    def get(self, path, absolute=None):
        key = os.path.join(CACHE, cache_key(absolute or path))
        if self.use_cache and os.path.exists(key):
            self.hits += 1
            return self._normalise(io.open(key, encoding="utf-8").read())
        url = absolute or (RAW % urllib.parse.quote(path))
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "grimoire-importer"})
            with urllib.request.urlopen(req, timeout=30) as r:
                text = r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                self.failures.append("%s -> 404" % path)
                return None
            self.failures.append("%s -> HTTP %s" % (path, e.code))
            return None
        except Exception as e:
            self.failures.append("%s -> %s" % (path, e))
            return None
        self.misses += 1
        os.makedirs(os.path.dirname(key), exist_ok=True)
        io.open(key, "w", encoding="utf-8", newline="").write(text)
        return self._normalise(text)


# ---------------------------------------------------------------- markdown
def normalise_body(md):
    """Convert source markdown into the subset the Grimoire renderer supports.

    The renderer handles **bold**, `inline code`, blank-line paragraphs and
    "- " bullets, and hands $...$ / $$...$$ to KaTeX. Everything else -- tables,
    block quotes, raw HTML, images, headings, numbered lists -- has to be
    converted or dropped here rather than shown to a learner as raw syntax.
    """
    held = []

    def hold(text):
        held.append(text)
        return "\x00H%d\x00" % (len(held) - 1)

    # 1. inline code first, so nothing below can corrupt what is inside it
    md = re.sub(r"`[^`\n]+`", lambda m: hold(m.group(0)), md)

    # 2. h4cker writes maths as \( x \) / \[ x \]; KaTeX here is $-delimited
    md = re.sub(r"\\\[(.+?)\\\]", lambda m: "$$%s$$" % m.group(1).strip(), md, flags=re.S)
    md = re.sub(r"\\\((.+?)\\\)", lambda m: "$%s$" % m.group(1).strip(), md, flags=re.S)
    # 3. hold the maths verbatim -- it must survive byte-for-byte
    md = re.sub(r"\$\$.+?\$\$", lambda m: hold(m.group(0)), md, flags=re.S)
    md = re.sub(r"\$[^$\n]+\$", lambda m: hold(m.group(0)), md)

    # 4. images, raw HTML, reference-style link definitions
    md = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", md)
    md = re.sub(r"!\[[^\]]*\]\[[^\]]*\]", "", md)
    md = re.sub(r"^\s*\[[^\]]+\]:\s*\S+.*$", "", md, flags=re.M)
    md = re.sub(r"<[^>\n]{1,200}>", "", md)

    # 5. links become their own label
    md = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", md)
    md = re.sub(r"\[([^\]]*)\]\[[^\]]*\]", r"\1", md)

    # 6. tables and block quotes have no representation in the subset
    md = re.sub(r"^\s*\|.*$", "", md, flags=re.M)
    md = re.sub(r"^\s*>\s?", "", md, flags=re.M)
    # horizontal rules
    md = re.sub(r"^\s*([-*_])(?:\s*\1){2,}\s*$", "", md, flags=re.M)

    # 7. headings that survived sectioning become bold lead-in lines.
    # The blank lines matter: the renderer separates paragraphs on blank lines
    # only, so a bold lead-in glued to the line above merges into it, and two
    # adjacent headings would render as one run-on "**A****B**".
    # Strip any bold the heading already carried, or "## **Title**" would come
    # out as "****Title****".
    md = re.sub(r"^[ \t]*#{1,6}\s+(.+?)\s*#*\s*$",
                lambda m: "\n**%s**\n" % m.group(1).strip().strip("*").strip(), md,
                flags=re.M)

    # 8. _emphasis_ -> **emphasis** (never inside a word, never in code/maths)
    md = re.sub(r"(?<![A-Za-z0-9_\\])_([^_\n]+)_(?![A-Za-z0-9_])", r"**\1**", md)
    # *emphasis* -> **emphasis**, leaving existing ** alone
    md = re.sub(r"(?<![*\w])\*([^*\n]+)\*(?!\*)", r"**\1**", md)

    # 9. list markers -- bullets and numbered items both become "- "
    md = re.sub(r"^\s*[*+•]\s+", "- ", md, flags=re.M)
    md = re.sub(r"^\s*-\s+", "- ", md, flags=re.M)
    md = re.sub(r"^\s*\d+[.)]\s+", "- ", md, flags=re.M)

    md = re.sub(r"[ \t]+$", "", md, flags=re.M)
    md = re.sub(r"\n{3,}", "\n\n", md).strip()

    for i, text in enumerate(held):
        md = md.replace("\x00H%d\x00" % i, text)
    return md


def clip(body, limit=MAX_BODY_CHARS):
    """Trim an over-long body at a paragraph boundary. Never mid-sentence."""
    if len(body) <= limit:
        return body, False
    cut = body[:limit]
    at = cut.rfind("\n\n")
    if at < limit // 3:
        at = cut.rfind("\n")
    if at < limit // 3:
        at = len(cut)
    return body[:at].rstrip(), True


def prose_score(raw):
    """How much genuine explanatory text a raw markdown chunk carries.

    Returns (link-free characters, fraction of body lines that are links).
    A curated bibliography scores near-zero characters and a link fraction
    close to 1; written prose scores the other way round.
    """
    nofence = FENCE.sub("", raw)
    lines = [l.rstrip() for l in nofence.split("\n") if l.strip()]
    body = [l for l in lines if not l.lstrip().startswith("#")]
    if not body:
        return 0, 1.0
    linky = sum(1 for l in body if MD_LINK.search(l))
    prose = [l for l in body
             if not MD_LINK.search(l)
             and not l.lstrip().startswith("|")
             and len(l.strip()) > 40]
    return sum(len(l) for l in prose), linky / float(len(body))


def clean_title(text):
    text = EMOJI.sub("", text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"[`*_#]", "", text)
    text = re.sub(r"^\s*\d+[.)]\s*", "", text)
    # an emoji inside brackets leaves "Intermediate Challenges ()" behind
    text = re.sub(r"[(\[]\s*[)\]]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text.rstrip(":-– ").strip()


def doc_title(md, path):
    m = re.search(r"^#\s+(.+?)\s*$", md, flags=re.M)
    if m:
        return clean_title(m.group(1))
    stem = os.path.splitext(os.path.basename(path))[0]
    return clean_title(stem.replace("_", " ").replace("-", " ").title())


# Headings that say nothing on their own. A section called "Overview" needs the
# document's name in front of it; one called "Certificate Lifecycle Management"
# does not, and gluing both together just produces an unreadable title.
GENERIC_HEADINGS = {
    "overview", "introduction", "summary", "conclusion", "background",
    "key takeaways", "takeaways", "getting started", "prerequisites",
    "objectives", "lab objectives", "goals", "notes", "usage", "examples",
    "example", "description", "instructions", "answer", "details", "steps",
    "what you will learn", "requirements", "setup", "basics", "concepts",
    "challenge text", "challenge", "solution", "explanation",
}

# Sections that are housekeeping or a reading list, not a lesson. These pass
# the prose gate -- a bibliography of O'Reilly courses is written in sentences
# -- but they teach nothing about the subject, so they are refused by name.
BLOCKED_HEADINGS = {
    "video courses", "courses", "books", "training", "resources",
    "additional resources", "more resources", "other resources", "references",
    "further reading", "reading list", "links", "useful links", "tools",
    "table of contents", "contents", "contributing", "license", "licence",
    "acknowledgements", "acknowledgments", "disclaimer", "author", "authors",
    "about", "about the author", "credits", "sponsors", "newsletter",
    "directory structure", "repository structure", "what's next", "next steps",
}


def section_title(title, doc):
    """A readable section name: the heading, qualified by the document only
    when the heading alone would be meaningless."""
    doc = (doc or "").split(":")[0].strip()
    if not title:
        return doc[:90]
    t = clean_title(title)
    if not t:
        return doc[:90]
    if t.lower() in GENERIC_HEADINGS and doc and doc.lower() != t.lower():
        return ("%s: %s" % (doc, t))[:90]
    return t[:90]


def split_chunks(md):
    """(title, raw markdown) pairs, splitting on ## and then on ### if needed.

    Fenced code is masked before splitting so a `### ` comment inside a shell
    example can never be mistaken for a heading.
    """
    blocks = []

    def mask(m):
        blocks.append((m.group(1).lower(), m.group(2).strip("\n")))
        return "\x00B%d\x00" % (len(blocks) - 1)

    masked = FENCE.sub(mask, md)

    def cut(text, level):
        pat = re.compile(r"^%s\s+(.+?)\s*$" % ("#" * level), re.M)
        parts = pat.split(text)
        if len(parts) < 3:
            return None
        out = []
        # re.split hands back the text before the first heading as parts[0].
        # Dropping it loses the opening explanation of every document that puts
        # its lead paragraphs under the H1 and only starts using ## later on.
        if prose_score(unmask(parts[0]))[0] >= MIN_PROSE_CHARS:
            out.append((None, parts[0]))
        out.extend((parts[i].strip(), parts[i + 1])
                   for i in range(1, len(parts) - 1, 2))
        return out

    chunks = cut(masked, 2) or cut(masked, 3)
    if not chunks:
        # flat document: the whole body is one chunk
        stripped = re.sub(r"^#\s+.+?$", "", masked, count=1, flags=re.M)
        chunks = [(None, stripped)]

    # a ## chunk that is far too long is re-cut at ### so the learner gets
    # digestible sections instead of one wall of text
    out = []
    for title, raw in chunks:
        if len(raw) > MAX_BODY_CHARS * 1.6:
            sub = cut(raw, 3)
            if sub:
                # cut() already returns the text before the first ### as its
                # own untitled chunk; it inherits the parent ## heading.
                out.extend((title if s_title is None else s_title, s_raw)
                           for s_title, s_raw in sub)
                continue
        out.append((title, raw))
    return out, blocks


def merge_prose_and_code(chunks, blocks):
    """Rejoin a prose section with the code section it introduces.

    These documents are written as "explain, then show the commands": a `##`
    section of pure prose is followed by a sibling `##` section that is nothing
    but fenced `openssl`/`gpg` examples. Split naively, the first half has no
    example and the second half has no explanation, and the prose gate below
    correctly throws the second half away.

    Merging the pair restores the document's own reading order. No text is
    rewritten and nothing is paired across a file boundary -- an absorbed chunk
    is always the one that immediately followed it in the source.
    """
    def has_code(raw):
        return bool(re.search(r"\x00B\d+\x00", raw))

    out, i = [], 0
    while i < len(chunks):
        title, raw = chunks[i]
        prose = prose_score(unmask(raw))[0]
        # a prose section with no example of its own absorbs the code-only
        # sibling directly after it, and only that one
        if prose >= MIN_PROSE_CHARS and not has_code(raw) and i + 1 < len(chunks):
            n_title, n_raw = chunks[i + 1]
            if has_code(n_raw) and prose_score(unmask(n_raw))[0] < MIN_PROSE_CHARS:
                joined = raw.rstrip() + "\n\n"
                if n_title:
                    joined += "### %s\n\n" % n_title
                out.append((title, joined + n_raw.lstrip()))
                i += 2
                continue
        out.append((title, raw))
        i += 1
    return out


def pick_code(raw, blocks):
    """The first fenced example referenced in this chunk, with its language."""
    ids = [int(i) for i in re.findall(r"\x00B(\d+)\x00", raw)]
    for i in ids:
        lang, text = blocks[i]
        if not text.strip():
            continue
        return text, (lang or "text")
    return "", ""


def unmask(raw):
    return re.sub(r"\x00B\d+\x00", "", raw)


def sections_for(md, path, report):
    """Every section of one source file that clears the prose gate."""
    chunks, blocks = split_chunks(md)
    chunks = merge_prose_and_code(chunks, blocks)
    title0 = doc_title(md, path)
    out = []
    for title, raw in chunks:
        if title and clean_title(title).lower() in BLOCKED_HEADINGS:
            report["sections_blocked"] += 1
            continue
        chars, link_frac = prose_score(unmask(raw))
        if chars < MIN_PROSE_CHARS or link_frac > MAX_LINK_FRACTION:
            report["sections_refused"] += 1
            continue
        body, was_clipped = clip(normalise_body(unmask(raw)))
        if not body.strip():
            report["sections_refused"] += 1
            continue
        if was_clipped:
            report["clipped"] += 1
        code, code_lang = pick_code(raw, blocks)
        name = section_title(title, title0)
        out.append({
            "title": name[:90] or title0,
            "body": body,
            "code": code,
            "lang": code_lang or "text",
            "annotations": [],
            "_source": path,
            "_doc": title0,
            "_prose": chars,
            "_hasCode": bool(code),
        })
    return out


def linkout_section(path, why):
    """An honest pointer at a file we refuse to reproduce as a lesson.

    This is scaffolding, not teaching text: it states plainly that the chapter
    was not imported and where the real thing lives. It never paraphrases the
    source.
    """
    return {
        "title": clean_title(os.path.splitext(os.path.basename(path))[0]
                             .replace("_", " ").replace("-", " ").title()),
        "body": ("This chapter was not imported as lesson text: %s\n\n"
                 "Read it at the source: %s" % (why, BLOB % urllib.parse.quote(path))),
        "code": "",
        "lang": "text",
        "annotations": [],
        "_source": path,
        "_linkout": True,
    }


# ---------------------------------------------------------------- building
def concept_overlap(section, concepts):
    """How many of a floor's concept words this section actually talks about."""
    text = (section["title"] + " " + section["body"]).lower()
    hits = 0
    for concept in concepts:
        # three letters is the floor, not four: tls, rsa, pki, gpg and x509 are
        # the whole point of the floors they belong to.
        words = [w for w in concept.split("-") if len(w) >= 3]
        if words and all(w in text for w in words):
            hits += 1
    return hits


def build_floor(n, name, concepts, paths, fetcher, tree, report):
    candidates, refused_files = [], []
    for path in paths:
        if tree and path not in tree:
            report["missing_paths"].append(path)
            continue
        md = fetcher.get(path)
        if md is None:
            report["missing_paths"].append(path)
            continue
        report["files_read"] += 1
        secs = sections_for(md, path, report)
        if not secs:
            chars, frac = prose_score(md)
            refused_files.append((path, "it is a curated link list rather than prose"
                                  if frac > MAX_LINK_FRACTION else
                                  "it carries too little explanatory text to teach from"))
            report["files_refused"] += 1
            continue
        candidates.extend(secs)

    # Rank by: carries a runnable example, then how well it matches this
    # floor's concepts, then how much prose it has. Relevance matters because a
    # file like challenges/README.md describes every challenge in the set, and
    # without it a floor on classical ciphers happily picks up the section
    # about elliptic curves purely for being longer.
    for s in candidates:
        s["_relevance"] = concept_overlap(s, concepts)
    ranked = sorted(candidates,
                    key=lambda s: (not s["_hasCode"], -s["_relevance"], -s["_prose"]))
    # Keep the strongest sections, but never more than two from one file, so a
    # single long tutorial cannot crowd the rest of the floor out.
    chosen, per_file = [], {}
    for s in ranked:
        if len(chosen) >= SECTIONS_PER_FLOOR:
            break
        if per_file.get(s["_source"], 0) >= 2:
            continue
        per_file[s["_source"]] = per_file.get(s["_source"], 0) + 1
        chosen.append(s)
    # restore the syllabus/document order for reading
    order = {p: i for i, p in enumerate(paths)}
    chosen.sort(key=lambda s: (order.get(s["_source"], 99), candidates.index(s)))

    # Two files on one floor can both call a section "Security Best Practices".
    # Qualify the clashes with their document so the floor reads as a sequence
    # of distinct lessons.
    seen = {}
    for s in chosen:
        seen[s["title"]] = seen.get(s["title"], 0) + 1
    for s in chosen:
        if seen.get(s["title"], 0) > 1 and s.get("_doc"):
            doc = s["_doc"].split(":")[0].strip()
            if doc and doc.lower() not in s["title"].lower():
                s["title"] = ("%s: %s" % (doc, s["title"]))[:90]

    todo = []
    # rule 2: a floor that could not be filled links out honestly, never fakes
    if len(chosen) < MIN_SECTIONS:
        for path, why in refused_files:
            if len(chosen) >= MIN_SECTIONS:
                break
            chosen.append(linkout_section(path, why))
            report["linkouts"] += 1
    if len(chosen) < MIN_SECTIONS:
        todo.append("lesson needs %d more section(s): the source did not yield "
                    "enough prose" % (MIN_SECTIONS - len(chosen)))
    no_code = [s for s in chosen if not s["code"]]
    if no_code:
        todo.append("%d lesson section(s) have no code example - h4cker is prose "
                    "and command-line material, not a test suite; add a worked "
                    "example by hand" % len(no_code))
    report["sections_without_code"] += len(no_code)
    for path, why in refused_files:
        todo.append("not imported: %s (%s)" % (path, why))

    todo.append("practice: author 6-10 challenges. h4cker publishes its answers "
                "inline with its challenge text, so none can be imported as a "
                "gradeable question without authoring.")
    todo.append("exam: author 8-12 questions. This source has no quiz bank.")
    if n == 10:
        todo.append("boss floor: author a `project` challenge - nothing in the "
                    "source is shaped like a project brief.")

    sections = [{k: v for k, v in s.items() if not k.startswith("_")} for s in chosen]

    report["per_floor"].append({
        "n": n, "name": name, "sections": len(sections),
        "linkouts": sum(1 for s in chosen if s.get("_linkout")),
        "nocode": len(no_code), "files": len(paths),
        "refused": len(refused_files),
    })
    return {
        "n": n,
        "name": name,
        "concepts": concepts,
        "sources": [s["_source"] for s in chosen],
        "lesson": {"sections": sections},
        "practice": [],
        "exam": [],
        "_todo": todo,
    }


def build(fetcher, report):
    tree_raw = fetcher.get("tree.json", absolute=TREE)
    tree = set()
    if tree_raw:
        try:
            tree = set(e["path"] for e in json.loads(tree_raw).get("tree", []))
            report["tree_entries"] = len(tree)
        except ValueError:
            tree = set()
    if not tree:
        report["notes"].append("repository tree unavailable (GitHub API may be "
                               "rate-limited); syllabus paths fetched blind")

    floors = []
    for i, (name, concepts, paths) in enumerate(SYLLABUS):
        floors.append(build_floor(i + 1, name, concepts, paths, fetcher, tree, report))

    return {
        "id": DUNGEON_ID,
        "name": "The Cipherlock Reliquary",
        "subject": "Cryptography & Security",
        "category": "theory",
        "disciplineType": "security",
        "sigil": "\U0001F510",
        "unlock": None,
        "lang": "text",
        "runtime": "none",
        "source": "The-Art-of-Hacking/h4cker (MIT)",
        "importedBy": "scripts/import_h4cker.py",
        "blurb": ("Ciphers, certificates and the ways they fail. Imported from "
                  "the written chapters of the h4cker reference collection."),
        "floors": floors,
    }


# ------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--dry-run", action="store_true",
                    help="print the summary without writing files")
    args = ap.parse_args()

    report = {"files_read": 0, "files_refused": 0, "sections_refused": 0,
              "sections_without_code": 0, "clipped": 0, "linkouts": 0,
              "sections_blocked": 0,
              "missing_paths": [], "per_floor": [], "notes": [],
              "tree_entries": 0}

    f = Fetcher(use_cache=not args.no_cache)
    print("importing %s@%s ..." % (REPO, BRANCH))
    dungeon = build(f, report)

    out_json = os.path.join(ROOT, "content", "%s.json" % DUNGEON_ID)
    if not args.dry_run:
        os.makedirs(os.path.dirname(out_json), exist_ok=True)
        json.dump(dungeon, io.open(out_json, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)

    n_sec = sum(len(fl["lesson"]["sections"]) for fl in dungeon["floors"])
    n_prac = sum(len(fl["practice"]) for fl in dungeon["floors"])
    n_exam = sum(len(fl["exam"]) for fl in dungeon["floors"])
    todos = sum(len(fl["_todo"]) for fl in dungeon["floors"])
    files_in_syllabus = sum(len(p) for _, _, p in SYLLABUS)

    print("")
    print("=" * 70)
    print("  IMPORT SUMMARY - The-Art-of-Hacking/h4cker -> %s" % DUNGEON_ID)
    print("=" * 70)
    print("  network: %d fetched, %d from cache%s" % (
        f.misses, f.hits, ", %d failed" % len(f.failures) if f.failures else ""))
    print("  repository tree entries       : %d" % report["tree_entries"])
    print("  syllabus files                : %d selected by hand from the tree"
          % files_in_syllabus)
    print("  files read                    : %d" % report["files_read"])
    print("")
    print("  IMPORTED")
    print("    floors                      : %d" % len(dungeon["floors"]))
    print("    lesson sections             : %d  (%d carry a code example)"
          % (n_sec, n_sec - report["sections_without_code"]))
    print("    honest link-outs            : %d  (no prose to import, linked instead)"
          % report["linkouts"])
    print("    bodies clipped to %d chars : %d" % (MAX_BODY_CHARS, report["clipped"]))
    print("")
    print("  REFUSED (link lists / too thin - never faked)")
    print("    whole files refused         : %d of %d read"
          % (report["files_refused"], report["files_read"]))
    print("    sections refused            : %d" % report["sections_refused"])
    print("    sections blocked by name    : %d  (reading lists, licence, TOC)"
          % report["sections_blocked"])
    print("    gate: >= %d link-free chars and <= %d%% link lines"
          % (MIN_PROSE_CHARS, int(MAX_LINK_FRACTION * 100)))
    if report["missing_paths"]:
        print("    syllabus paths not found    : %s" % ", ".join(report["missing_paths"][:4]))
    print("")
    print("  NEEDS MANUAL WORK")
    print("    practice challenges         : %d - this source has no test suites" % n_prac)
    print("    exam questions              : %d - this source has no quiz bank" % n_exam)
    print("    sections with no code       : %d" % report["sections_without_code"])
    print("    total _todo entries         : %d" % todos)
    for note in report["notes"]:
        print("    note                        : %s" % note)
    if f.failures:
        print("    fetch failures              : %s" % "; ".join(f.failures[:4]))
    print("")
    print("  PER FLOOR")
    for r in report["per_floor"]:
        extra = []
        if r["linkouts"]:
            extra.append("%d link-out" % r["linkouts"])
        if r["refused"]:
            extra.append("%d file(s) refused" % r["refused"])
        if r["nocode"]:
            extra.append("%d no code" % r["nocode"])
        print("    %2d. %-32s %d sections  %s"
              % (r["n"], r["name"][:32], r["sections"], ", ".join(extra)))
    print("")
    if args.dry_run:
        print("  (dry run - nothing written)")
    else:
        print("  wrote %s" % os.path.relpath(out_json, ROOT))
    print("  content/index.json is NOT touched - the caller regenerates it.")
    print("  next: python scripts/validate_content.py %s" % DUNGEON_ID)
    print("=" * 70)


if __name__ == "__main__":
    main()
