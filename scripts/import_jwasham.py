#!/usr/bin/env python3
"""Import the topic checklist of jwasham/coding-interview-university into syllabi.

    python scripts/import_jwasham.py
    python scripts/import_jwasham.py --dry-run
    python scripts/import_jwasham.py --no-cache
    python scripts/import_jwasham.py --only networking,algorithms

Fetches README.md from main, parses the nested "- [ ]" topic checklist under its
headings, and rewrites the generated block of six theory syllabi:

    data-structures        <- Data Structures, Trees, Graphs, Tries, ...
    algorithms             <- Big-O, Binary search, Sorting, Recursion, DP, ...
    distributed-systems    <- CAP/consensus/scalability half of System Design
    software-architecture  <- design-process half of System Design, SOLID, ...
    operating-systems      <- processes and threads, caches, compilers, GC, ...
    networking             <- the Networking subtopic

This importer writes NO content/*.json, by design. coding-interview-university
is a curated index of other people's videos and articles, not a textbook: the
checklist wording is a genuine syllabus, but the teaching happens behind the
links, which are not ours to embed. So the topics land in syllabi/ as a
coverage contract and every lesson body stays honestly unwritten.

Topic and sub-topic text is upstream wording, verbatim apart from link syntax
being flattened, HTML stripped and table pipes escaped. Nothing is paraphrased,
summarised or invented here. Resource links are counted, never copied; each
syllabus links back to the upstream section that holds them.

Source: github.com/jwasham/coding-interview-university (CC BY-SA 4.0).
See content/attribution.md.
"""
import argparse
import io
import os
import re
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "jwasham")
REPO = "jwasham/coding-interview-university"
RAW = "https://raw.githubusercontent.com/%s/main/%s"
PAGE = "https://github.com/%s" % REPO
LICENCE = "CC BY-SA 4.0"
SOURCE = "%s (%s)" % (REPO, LICENCE)

BEGIN = "<!-- GENERATED:BEGIN - import_jwasham.py rewrites this block -->"
END = "<!-- GENERATED:END -->"

# A root bullet longer than this, with no children of its own, is prose the
# author wrote about a topic rather than a topic. Checklist items are exempt.
PROSE_CHARS = 160
MAX_SUBTOPICS = 8          # sub-topics shown per row before "+N more"
SUBTOPIC_CHARS = 72        # per sub-topic truncation inside the table cell


def cache_key(name):
    """A filesystem-safe cache filename. Windows rejects several punctuation
    characters in paths, so everything outside [A-Za-z0-9._-] is replaced."""
    return re.sub(r'[^A-Za-z0-9._-]', "_", name)[-180:]


class Fetcher:
    def __init__(self, use_cache=True):
        self.use_cache = use_cache
        self.hits = self.misses = 0
        self.failures = []

    def get(self, path):
        """Returns file text, or None if it could not be fetched."""
        key = os.path.join(CACHE, cache_key(path))
        if self.use_cache and os.path.exists(key):
            self.hits += 1
            return io.open(key, encoding="utf-8").read()
        url = RAW % (REPO, path)
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                text = r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            self.failures.append("%s -> HTTP %s" % (path, e.code))
            return None
        except Exception as e:
            self.failures.append("%s -> %s" % (path, e))
            return None
        self.misses += 1
        os.makedirs(os.path.dirname(key), exist_ok=True)
        io.open(key, "w", encoding="utf-8").write(text)
        return text


# ----------------------------------------------------------------- parsing
FENCE = re.compile(r"```.*?```", re.S)
HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
SUB_HEAD = re.compile(r"^[-*]\s+#{2,6}\s+(.+?)\s*$")     # "- ### Arrays"
SUB_BOLD = re.compile(r"^[-*]\s+\*\*(.+?)\*\*\s*(\([^()]*\))?\s*$")  # "- **SOLID**"
BULLET = re.compile(r"^(\s*)[-*+]\s+(\[[ xX]\]\s*)?(.*)$")
# Label tolerates one level of nested brackets ("[[Review] Stacks](url)"), href
# one level of nested parens ("(.../Word_(computer_architecture))"). Both inner
# alternations start on disjoint characters, so neither can backtrack badly.
LINK = re.compile(r"(!?)\[((?:[^\[\]]+|\[[^\[\]]*\])*)\]"
                  r"\(([^()]*(?:\([^()]*\)[^()]*)*)\)")

# Sections whose subtopics are bold bullets rather than "- ###" headings.
BOLD_SUBTOPIC_SECTIONS = {"additional detail on some subjects"}


def link_only(body, urls):
    """True when a bullet is nothing but one link.

    Upstream then put a resource title where a concept name belongs ("HTTP
    (video)"), which the syllabus counts and admits to rather than papering
    over. Checked by hand, not by regex: an anchored nested-bracket pattern
    backtracks catastrophically on the long bullets in this README.
    """
    return (len(urls) == 1 and body.startswith("[")
            and body.count("](") == 1
            and body.rstrip(".,:; ").endswith(")"))


def flatten(text, urls=None):
    """Markdown inline -> plain text, collecting the http links it carried."""
    def sub(m):
        bang, label, href = m.group(1), m.group(2), m.group(3).strip()
        if urls is not None and href.lower().startswith("http"):
            urls.append(href)
        return "" if bang else label

    prev = None
    while prev != text:
        prev = text
        text = LINK.sub(sub, text)
    text = re.sub(r"\[([^\]]+)\]\[[^\]]*\]", r"\1", text)   # reference links
    text = re.sub(r"<[^>]+>", "", text)                     # raw HTML
    text = re.sub(r"\s+", " ", text).strip()
    return text.rstrip(":").strip()


def parse(md):
    """README markdown -> [{heading, groups:[{name, items:[node]}]}] in order.

    A node is {text, checked, children, links}. Nesting comes from indent
    width, with tabs expanded, so the mixed 4-space/8-space/tab indentation
    upstream still produces the right tree.
    """
    md = FENCE.sub("", md)
    sections, cur, group, stack = [], None, None, []

    for raw in md.split("\n"):
        line = raw.rstrip()
        if not line.strip():
            continue

        m = HEADING.match(line)
        if m:
            level, title = len(m.group(1)), flatten(m.group(2))
            if level <= 2:
                cur = {"heading": title, "groups": []}
                sections.append(cur)
                group = None
            elif cur is not None:
                group = {"name": title, "items": []}
                cur["groups"].append(group)
            stack = []
            continue

        if cur is None:
            continue

        m = SUB_HEAD.match(line)
        if m is None and cur["heading"].lower() in BOLD_SUBTOPIC_SECTIONS:
            m = SUB_BOLD.match(line)
        if m:
            group = {"name": flatten(m.group(1)), "items": []}
            cur["groups"].append(group)
            stack = []
            continue

        m = BULLET.match(line)
        if m:
            indent = len(m.group(1).replace("\t", "    "))
            urls = []
            body = m.group(3).strip()
            node = {"text": flatten(body, urls),
                    "checked": m.group(2) is not None,
                    "title_only": link_only(body, urls),
                    "children": [], "links": urls}
            if not node["text"] and not node["links"]:
                continue
            while stack and stack[-1][0] >= indent:
                stack.pop()
            if stack:
                stack[-1][1]["children"].append(node)
            else:
                if group is None:
                    group = {"name": None, "items": []}
                    cur["groups"].append(group)
                group["items"].append(node)
            stack.append((indent, node))
            continue

        # An indented continuation line belongs to the bullet above it; its
        # links still count as resources for that topic.
        if stack and raw[:1] in (" ", "\t"):
            flatten(line.strip(), stack[-1][1]["links"])

    return sections


def subtree_links(node):
    n = len(node["links"])
    for c in node["children"]:
        n += subtree_links(c)
    return n


def subtree_size(node):
    n = len(node["children"])
    for c in node["children"]:
        n += subtree_size(c)
    return n


def usable_items(group, report):
    """The root bullets of a group that are real topics.

    A checklist item always is. A plain bullet counts when it heads a subtree
    ("Covers:", "Considerations:"), and, for the groups upstream wrote without
    any checkboxes at all (Unix tools; Kafka/Thrift/gRPC; Bloom filter), every
    short plain bullet counts, because there is nothing else there. Long
    childless prose bullets are the author's commentary and are dropped.
    """
    has_checks = any(i["checked"] for i in group["items"])
    # A group routed to two syllabi (Graphs) must not be counted twice.
    counted = report.setdefault("counted_groups", set())
    first_pass = id(group) not in counted
    counted.add(id(group))
    out = []
    for item in group["items"]:
        if item["checked"] or item["children"]:
            out.append(item)
        elif not has_checks and len(item["text"]) <= PROSE_CHARS:
            out.append(item)
        elif first_pass:
            report["prose_skipped"] = report.get("prose_skipped", 0) + 1
    return out


# ----------------------------------------------------------------- routing
# Which upstream sections feed which syllabus. groups=None takes the whole
# section; a list takes only those subtopics, in upstream order.
DISTRIBUTED = re.compile(
    r"cap theorem|distributed|consensus|paxos|raft|consistent hashing|nosql"
    r"|datacenter|shard|scalab|6\.824|replicat|fallacies", re.I)


def sysdesign_filter(sid):
    """Split the one upstream System Design section between two syllabi."""
    def keep(text):
        hit = bool(DISTRIBUTED.search(text))
        return hit if sid == "distributed-systems" else not hit
    return keep


SYSDESIGN = "System Design, Scalability, Data Handling"

ROUTES = [
    ("data-structures", "Data Structures", [
        ("Data Structures", None),
        ("Trees", None),
        ("Graphs", None),
        ("Even More Knowledge", ["Tries"]),
        ("Additional Learning", [
            "Bloom Filter", "HyperLogLog", "Locality-Sensitive Hashing",
            "van Emde Boas Trees", "Augmented Data Structures",
            "Balanced search trees", "k-D Trees", "Skip lists",
            "Disjoint Sets & Union Find", "Treap"]),
        ("Additional Detail on Some Subjects", ["Union-Find"]),
    ]),
    ("algorithms", "Algorithms & Complexity", [
        ("Algorithmic complexity / Big-O / Asymptotic analysis", None),
        ("More Knowledge", ["Binary search", "Bitwise operations"]),
        ("Sorting", None),
        ("Graphs", None),
        ("Even More Knowledge", [
            "Recursion", "Dynamic Programming",
            "Combinatorics (n choose k) & Probability",
            "NP, NP-Complete and Approximation Algorithms",
            "String searching & manipulations"]),
        ("Additional Learning", [
            "A*", "Fast Fourier Transform", "Network Flows",
            "Math for Fast Processing", "Linear Programming (videos)",
            "Geometry, Convex hull (videos)", "Discrete math"]),
        ("Additional Detail on Some Subjects", [
            "More Dynamic Programming", "Advanced Graph Processing",
            "String Matching", "Sorting"]),
    ]),
    ("distributed-systems", "Distributed Systems", [
        (SYSDESIGN, None, "split"),
        ("Additional Learning", [
            "Parallel Programming",
            "Messaging, Serialization, and Queueing Systems"]),
    ]),
    ("software-architecture", "Software Architecture & Design", [
        (SYSDESIGN, None, "split"),
        ("Even More Knowledge", ["Design patterns", "Testing"]),
        ("Additional Detail on Some Subjects", ["SOLID"]),
        ("Additional Learning", ["DevOps"]),
    ]),
    ("operating-systems", "Operating Systems", [
        ("Even More Knowledge", [
            "How computers process a program", "Caches", "Processes and Threads",
            "Floating Point Numbers", "Unicode", "Endianness"]),
        ("Additional Learning", [
            "Compilers", "Unix/Linux command line tools", "Garbage collection"]),
    ]),
    ("networking", "Networking", [
        ("Even More Knowledge", ["Networking"]),
    ]),
]

# Sections deliberately not routed anywhere: they are advice about the job
# hunt, book lists or resource dumps, not a topic syllabus.
IGNORED = {
    "coding interview university", "what is it?", "table of contents",
    "why use it?", "how to use it", "don't feel you aren't smart enough",
    "a note about video resources", "choose a programming language",
    "books for data structures and algorithms", "interview prep books",
    "don't make my mistakes", "what you won't see covered", "the daily plan",
    "coding question practice", "coding problems", "let's get started",
    "final review", "update your resume",
    "interview process & general interview prep",
    "be thinking of for when the interview comes",
    "have questions for the interviewer", "once you've got the job",
    "additional books", "video series", "computer science courses",
    "algorithms implementation", "papers", "license",
}

# Subtopics that belong to a dungeon this importer was not asked to write.
# Named so the summary says what was left on the table rather than hiding it.
OUT_OF_SCOPE = {
    "Emacs and vi(m)": "dev-tooling",
    "Information theory (videos)": "information-theory",
    "Parity & Hamming Code (videos)": "information-theory",
    "Entropy": "information-theory",
    "Compression": "information-theory",
    "Cryptography": "cryptography",
    "Computer Security": "cryptography",
}


def anchor(heading):
    """GitHub's heading anchor: lowercase, drop punctuation, spaces to dashes."""
    slug = heading.lower().replace(" ", "-")
    return re.sub(r"[^a-z0-9\-_]", "", slug)


def cell(text):
    return text.replace("|", "\\|").strip()


def short(text, n=SUBTOPIC_CHARS):
    text = text.strip()
    if len(text) <= n:
        return text
    return text[:n - 3].rsplit(" ", 1)[0] + "..."


def collect(sid, selectors, by_heading, report):
    """Rows for one syllabus, in upstream order."""
    rows, used = [], []
    for sel in selectors:
        heading, wanted = sel[0], sel[1]
        keep = sysdesign_filter(sid) if len(sel) > 2 else None
        sec = by_heading.get(heading.lower())
        if sec is None:
            report["bad_selectors"].append("%s: no section '%s'" % (sid, heading))
            continue
        wanted_l = None if wanted is None else [w.lower() for w in wanted]
        seen, before = set(), len(rows)
        for group in sec["groups"]:
            gname = group["name"]
            if wanted_l is not None:
                if gname is None or gname.lower() not in wanted_l:
                    continue
                seen.add(gname.lower())
            for item in usable_items(group, report):
                if keep and not keep(item["text"]):
                    continue
                rows.append({
                    "section": sec["heading"],
                    "group": gname or "-",
                    "topic": item["text"],
                    "children": [c["text"] for c in item["children"]],
                    "subs": subtree_size(item),
                    "links": subtree_links(item),
                    "title_only": item["title_only"],
                })
        if wanted_l is not None:
            for w in wanted:
                if w.lower() not in seen:
                    report["bad_selectors"].append(
                        "%s: no subtopic '%s' under '%s'" % (sid, w, heading))
        if len(rows) > before:
            used.append((sec["heading"], len(rows) - before))
    return rows, used


# --------------------------------------------------------------- rendering
def render(sid, title, rows, used):
    L = []
    L.append("# Syllabus - %s" % title)
    L.append("")
    L.append("Derived from `%s`, `README.md`. This is the contract: content"
             " must cover everything listed here." % SOURCE)
    L.append("")
    L.append("Topic wording is the upstream checklist, verbatim. Resource links"
             " are **counted, not copied** - the videos and articles behind them"
             " belong to their own authors, so follow the section links below to"
             " reach them. No lesson prose comes from this source:"
             " `import_jwasham.py` writes syllabi only, never `content/*.json`.")
    L.append("")
    L.append("**Upstream sections routed here**")
    L.append("")
    for heading, n in used:
        L.append("- [`%s`](%s#%s) - %d topics" % (heading, PAGE, anchor(heading), n))
    if sid in ("distributed-systems", "software-architecture"):
        L.append("")
        L.append("The upstream `%s` section is one flat list covering both"
                 " subjects. This importer splits it: CAP, consensus, consistent"
                 " hashing, sharding and the scalability series go to"
                 " `distributed-systems`; the design process, estimation,"
                 " normalisation and the design exercises go to"
                 " `software-architecture`. That split is the importer's, not"
                 " the source's." % SYSDESIGN)
    if sid in ("data-structures", "algorithms"):
        L.append("")
        L.append("`## Graphs` upstream mixes representations with traversal and"
                 " shortest-path algorithms, so it is listed in both"
                 " `data-structures.md` and `algorithms.md`. Teach it once, and"
                 " decide when authoring which dungeon owns it.")
    L.append("")
    L.append("| # | Section | Group | Topic | Sub-topics | Links |")
    L.append("|---|---|---|---|---|---|")
    for i, r in enumerate(rows, 1):
        kids = [short(c) for c in r["children"][:MAX_SUBTOPICS]]
        rest = len(r["children"]) - len(kids)
        if rest > 0:
            kids.append("+%d more" % rest)
        L.append("| %d | %s | %s | %s | %s | %d |" % (
            i, cell(r["section"]), cell(r["group"]), cell(r["topic"]),
            cell("; ".join(kids)) or "-", r["links"]))
    L.append("")
    L.append("**Coverage:** %d topics, %d sub-topics, %d linked resources"
             " upstream." % (len(rows), sum(r["subs"] for r in rows),
                             sum(r["links"] for r in rows)))
    titles = sum(1 for r in rows if r["title_only"])
    if titles:
        L.append("")
        L.append("**Read the topic column with care.** %d of the %d rows (%d%%)"
                 " are the title of a linked video or article, because that is"
                 " what upstream lists where a concept name would go (\"HTTP"
                 " (video)\", \"Khan Academy\"). They are kept verbatim rather"
                 " than reworded into concepts, which would be inventing"
                 " curriculum. Name the real concept when mapping these to"
                 " floors, and do not read the row count as a count of distinct"
                 " concepts." % (titles, len(rows), round(100.0 * titles / len(rows))))
    L.append("")
    L.append("## Still to do")
    L.append("")
    L.append("- Topics above are **not yet mapped to floors**. Grouping and"
             " ordering them into floors is an authoring decision.")
    L.append("- No lesson text, practice or exam content exists for this"
             " dungeon, and this source cannot supply any: it is an index of"
             " links. Teaching text must be written, or imported from a source"
             " whose licence allows embedding.")
    return BEGIN + "\n" + "\n".join(L) + "\n" + END + "\n"


def write(path, block):
    """Rewrite only the generated block; hand-authored sections survive."""
    if os.path.exists(path):
        old = io.open(path, encoding="utf-8").read()
        if BEGIN in old:
            # Another importer may own a generated block in the same file
            # (syllabi/operating-systems.md is also written by
            # import_ostep.py), so cut at OUR marker and at the first END
            # that follows it, never at the first END in the file.
            head, rest = old.split(BEGIN, 1)
            tail = rest.split(END, 1)[1] if END in rest else ""
            # The block already ends in a newline, so the tail's leading ones
            # are dropped and re-added; otherwise the file grows a blank line
            # on every re-import and is never byte-identical twice.
            tail = tail.lstrip("\n")
            out = head + block + ("\n" + tail if tail.strip() else "")
            io.open(path, "w", encoding="utf-8").write(out)
            return "updated"
        # Appended, not prepended: an importer that cuts at the first END in
        # the file (import_exercism.py's pattern) still cuts its own block
        # correctly as long as its block is the earlier one.
        io.open(path, "w", encoding="utf-8").write(old.rstrip() + "\n\n" + block)
        return "appended"
    io.open(path, "w", encoding="utf-8").write(block)
    return "created"


# ------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", default="",
                    help="comma-separated syllabus ids to write")
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--dry-run", action="store_true",
                    help="print the summary without writing files")
    args = ap.parse_args()

    only = [s.strip() for s in args.only.split(",") if s.strip()]
    report = {"prose_skipped": 0, "bad_selectors": []}

    f = Fetcher(use_cache=not args.no_cache)
    print("importing %s ..." % REPO)
    md = f.get("README.md")
    if md is None:
        raise SystemExit("could not fetch README.md: %s" % "; ".join(f.failures))

    sections = parse(md)
    by_heading = {}
    for s in sections:
        by_heading.setdefault(s["heading"].lower(), s)

    results, written = [], []
    routed_headings, routed_groups = set(), set()
    for sid, title, selectors in ROUTES:
        if only and sid not in only:
            continue
        rows, used = collect(sid, selectors, by_heading, report)
        for h, _ in used:
            routed_headings.add(h.lower())
        for r in rows:
            routed_groups.add((r["section"].lower(), r["group"]))
        block = render(sid, title, rows, used)
        path = os.path.join(ROOT, "syllabi", "%s.md" % sid)
        action = "dry-run"
        if not args.dry_run:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            action = write(path, block)
        results.append((sid, title, rows, used, path, action))
        written.append(path)

    # what the README still holds that nothing above claimed
    scratch = {"prose_skipped": 0, "bad_selectors": []}
    unrouted = []
    for s in sections:
        h = s["heading"]
        if h.lower() in IGNORED or h.lower() in routed_headings:
            continue
        n = sum(len(usable_items(g, scratch)) for g in s["groups"])
        if n:
            unrouted.append((h, n))
    leftover = []
    for s in sections:
        if s["heading"].lower() not in ("even more knowledge", "additional learning",
                                        "additional detail on some subjects"):
            continue
        for g in s["groups"]:
            if g["name"] and (s["heading"].lower(), g["name"]) not in routed_groups:
                leftover.append((g["name"], OUT_OF_SCOPE.get(g["name"], "unclaimed")))

    # ---------------------------------------------------------- summary
    total_topics = sum(len(r[2]) for r in results)
    total_subs = sum(sum(x["subs"] for x in r[2]) for r in results)
    total_links = sum(sum(x["links"] for x in r[2]) for r in results)
    title_rows = sum(sum(1 for x in r[2] if x["title_only"]) for r in results)

    print("")
    print("=" * 70)
    print("  IMPORT SUMMARY - %s" % REPO)
    print("=" * 70)
    print("  network: %d fetched, %d from cache%s" % (
        f.misses, f.hits, ", %d failed" % len(f.failures) if f.failures else ""))
    print("  README parsed: %d level-2 sections" % len(sections))
    print("")
    print("  SYLLABI WRITTEN  (syllabi/<id>.md, generated block only)")
    for sid, title, rows, used, path, action in results:
        print("    %-24s %3d concepts %4d sub-topics %4d links  [%s]" % (
            sid + ".md", len(rows), sum(x["subs"] for x in rows),
            sum(x["links"] for x in rows), action))
        print("      %d of those rows are a resource title, not a concept name"
              % sum(1 for x in rows if x["title_only"]))
    print("    %-24s %3d concepts %4d sub-topics %4d links" % (
        "TOTAL", total_topics, total_subs, total_links))
    print("")
    print("  DUNGEON JSON")
    print("    floors                      : 0")
    print("    lesson sections             : 0")
    print("    practice + exam challenges  : 0")
    print("    content/*.json written      : 0  (by design - see below)")
    print("")
    print("  NEEDS MANUAL WORK")
    print("    TODO entries in output      : %d  (2 per syllabus: floor mapping,"
          " lesson text)" % (2 * len(results)))
    print("    lesson text importable here : none. Every topic's teaching lives")
    print("      behind a third-party link (YouTube, Coursera, books). The routed")
    print("      sections carry %d such links and no prose that could be embedded"
          % total_links)
    print("      as a lesson body - not licence-wise, and not usefully.")
    print("    prose bullets skipped       : %d (author commentary, not topics)"
          % report["prose_skipped"])
    print("    rows that are a link title  : %d of %d (%d%%). Upstream lists a"
          % (title_rows, total_topics,
             round(100.0 * title_rows / total_topics) if total_topics else 0))
    print("      video where a concept name belongs; renaming them here would be")
    print("      inventing curriculum, so they are kept verbatim and flagged.")
    if report["bad_selectors"]:
        print("    ROUTING MISSES (fix these):")
        for b in report["bad_selectors"]:
            print("      - %s" % b)
    print("")
    print("  UPSTREAM NOT ROUTED HERE")
    if unrouted:
        for h, n in unrouted:
            print("    %-46s %3d topics" % (h[:46], n))
    else:
        print("    no topic section left over: the other %d level-2 sections are"
              % sum(1 for s_ in sections if s_["heading"].lower() in IGNORED))
        print("    job-hunt advice, book lists or resource dumps, not syllabus.")
    if leftover:
        print("    subtopics left for other dungeons:")
        for name, owner in leftover:
            print("      %-42s -> %s" % (name[:42], owner))
    print("")
    if args.dry_run:
        print("  (dry run - nothing written)")
    else:
        for p in written:
            print("  wrote %s" % os.path.relpath(p, ROOT).replace("\\", "/"))
    print("  content/index.json NOT touched (the caller regenerates it).")
    print("=" * 70)


if __name__ == "__main__":
    main()
