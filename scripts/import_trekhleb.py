#!/usr/bin/env python3
"""Import trekhleb/javascript-algorithms into the Grimoire algorithms dungeon.

    python scripts/import_trekhleb.py
    python scripts/import_trekhleb.py --dry-run
    python scripts/import_trekhleb.py --no-cache

Reads the repository tree from the GitHub API, then for each algorithm or
data structure on the floor plan pulls two real files:

  README.md   -> the lesson section body (prose only; tables, images, links,
                 fenced blocks and raw HTML have no representation in the
                 renderer subset and are stripped rather than shown raw)
  *.js        -> the lesson section's runnable code example

The implementations are ES modules. Every `import`/`export` statement is
removed so the snippet can be pasted into the worker as-is, and the local
modules an implementation depends on are inlined above it (dependencies
first, so class declarations resolve). When a dependency chain is too large
to inline, nothing is inlined and the missing names are named in a comment
and in the floor's _todo -- never silently dropped.

Nothing here is written by hand. Every word of every `body` came out of a
README in the source repo; the only authored text in the output is the
structural scaffolding (floor names, _todo lines, the `//` provenance
comment at the top of each code example). No practice or exam challenge is
emitted, because this source has no question bank -- it has Jest specs, and
the paths to them are recorded in each floor's _todo so a later pass can
ground real challenges in them.

Source: github.com/trekhleb/javascript-algorithms (MIT).
"""
import argparse
import io
import json
import os
import posixpath
import re
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "trekhleb")
REPO = "trekhleb/javascript-algorithms"
BRANCH = "master"
RAW = "https://raw.githubusercontent.com/%s/%s/%s"
TREE = "https://api.github.com/repos/%s/git/trees/%s?recursive=1" % (REPO, BRANCH)
BLOB = "https://github.com/" + REPO + "/blob/" + BRANCH + "/%s"

DUNGEON_ID = "algorithms"
MAX_SECTIONS = 4          # content/_SCHEMA.md caps a lesson at four sections
INLINE_BUDGET = 28000     # chars an example may reach once its dependencies
                          # are inlined. Set high enough that every chain in
                          # this repo fits: the AVL tree drags in the whole
                          # BST/HashTable/LinkedList stack and needs ~25k, and
                          # a long-but-runnable example beats a short one that
                          # throws on load. Lower it with --inline-budget to
                          # get shorter snippets that name what they lack.
INLINE_DEPTH = 8          # how deep the local-module dependency walk follows

# ---------------------------------------------------------------- floor plan
# Topic -> the directories that teach it, most-canonical first. The first
# MAX_SECTIONS that actually yield a README plus an implementation become the
# floor's lesson; the rest are recorded in the floor's _todo so nothing in the
# source silently disappears.
FLOORS = [
    ("The Ordering Halls", "sorting", [
        "src/algorithms/sorting/bubble-sort",
        "src/algorithms/sorting/merge-sort",
        "src/algorithms/sorting/quick-sort",
        "src/algorithms/sorting/heap-sort",
        "src/algorithms/sorting/insertion-sort",
        "src/algorithms/sorting/selection-sort",
        "src/algorithms/sorting/shell-sort",
        "src/algorithms/sorting/counting-sort",
        "src/algorithms/sorting/radix-sort",
        "src/algorithms/sorting/bucket-sort",
    ]),
    ("The Seeker's Corridor", "searching", [
        "src/algorithms/search/binary-search",
        "src/algorithms/search/linear-search",
        "src/algorithms/search/jump-search",
        "src/algorithms/search/interpolation-search",
    ]),
    ("Vault of Chains", "linear data structures", [
        "src/data-structures/linked-list",
        "src/data-structures/stack",
        "src/data-structures/queue",
        "src/data-structures/doubly-linked-list",
        "src/data-structures/deque",
    ]),
    ("The Scattering Vault", "hashing and sets", [
        "src/data-structures/hash-table",
        "src/data-structures/bloom-filter",
        "src/data-structures/lru-cache",
        "src/data-structures/disjoint-set",
    ]),
    ("The Branching Grove", "trees", [
        "src/data-structures/tree/binary-search-tree",
        "src/data-structures/heap",
        "src/data-structures/trie",
        "src/data-structures/tree/avl-tree",
        "src/data-structures/tree/red-black-tree",
        "src/data-structures/tree/segment-tree",
        "src/data-structures/tree/fenwick-tree",
        "src/data-structures/priority-queue",
        "src/data-structures/tree",
    ]),
    ("The Web of Ways", "graphs", [
        "src/data-structures/graph",
        "src/algorithms/graph/breadth-first-search",
        "src/algorithms/graph/depth-first-search",
        "src/algorithms/graph/dijkstra",
        "src/algorithms/graph/bellman-ford",
        "src/algorithms/graph/floyd-warshall",
        "src/algorithms/graph/prim",
        "src/algorithms/graph/kruskal",
        "src/algorithms/graph/topological-sorting",
        "src/algorithms/graph/detect-cycle",
        "src/algorithms/graph/articulation-points",
        "src/algorithms/graph/bridges",
        "src/algorithms/graph/strongly-connected-components",
        "src/algorithms/graph/eulerian-path",
        "src/algorithms/graph/hamiltonian-cycle",
    ]),
    ("Hall of Remembered Paths", "dynamic programming", [
        "src/algorithms/sets/longest-common-subsequence",
        "src/algorithms/string/levenshtein-distance",
        "src/algorithms/sets/knapsack-problem",
        "src/algorithms/sets/maximum-subarray",
        "src/algorithms/sets/longest-increasing-subsequence",
        "src/algorithms/sets/shortest-common-supersequence",
        "src/algorithms/uncategorized/unique-paths",
        "src/algorithms/uncategorized/recursive-staircase",
        "src/algorithms/uncategorized/rain-terraces",
        "src/algorithms/math/integer-partition",
    ]),
    ("The Whispering Script", "string algorithms", [
        "src/algorithms/string/hamming-distance",
        "src/algorithms/string/knuth-morris-pratt",
        "src/algorithms/string/rabin-karp",
        "src/algorithms/string/longest-common-substring",
        "src/algorithms/string/z-algorithm",
        "src/algorithms/string/palindrome",
        "src/algorithms/string/regular-expression-matching",
    ]),
    ("The Numeric Sanctum", "mathematics", [
        "src/algorithms/math/euclidean-algorithm",
        "src/algorithms/math/sieve-of-eratosthenes",
        "src/algorithms/math/fast-powering",
        "src/algorithms/math/primality-test",
        "src/algorithms/math/bits",
        "src/algorithms/math/fibonacci",
        "src/algorithms/math/factorial",
        "src/algorithms/math/prime-factors",
        "src/algorithms/math/pascal-triangle",
        "src/algorithms/math/least-common-multiple",
        "src/algorithms/math/is-power-of-two",
    ]),
    ("The Archmage's Combinatorium", "backtracking and combinatorics", [
        "src/algorithms/uncategorized/hanoi-tower",
        "src/algorithms/uncategorized/n-queens",
        "src/algorithms/sets/power-set",
        "src/algorithms/sets/permutations",
        "src/algorithms/sets/combinations",
        "src/algorithms/sets/combination-sum",
        "src/algorithms/sets/cartesian-product",
        "src/algorithms/sets/fisher-yates",
        "src/algorithms/uncategorized/knight-tour",
        "src/algorithms/graph/travelling-salesman",
    ]),
]


# ------------------------------------------------------------------ fetching
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
        """File text from the repo, or None if it does not exist."""
        key = os.path.join(CACHE, cache_key(absolute or path))
        if self.use_cache and os.path.exists(key):
            self.hits += 1
            return io.open(key, encoding="utf-8").read()
        url = absolute or (RAW % (REPO, BRANCH, path))
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "grimoire-importer"})
            with urllib.request.urlopen(req, timeout=45) as r:
                text = r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            self.failures.append("%s -> HTTP %s" % (path, e.code))
            return None
        except Exception as e:
            self.failures.append("%s -> %s" % (path, e))
            return None
        self.misses += 1
        os.makedirs(os.path.dirname(key), exist_ok=True)
        io.open(key, "w", encoding="utf-8").write(text)
        return text


# ------------------------------------------------------------ markdown -> body
FENCE = re.compile(r"```[a-zA-Z0-9+#-]*\n.*?```", re.S)
DROP_HEADINGS = re.compile(
    r"^(references?|read this|see also|resources|links|table of contents|"
    r"further reading|videos?)\b", re.I)


def mask_math(md):
    """Hide $...$ / $$...$$ so no other rule can touch the LaTeX inside.

    The app renders these with KaTeX, so they have to survive byte for byte.
    """
    saved = []

    def keep(m):
        saved.append(m.group(0))
        return "\x00M%d\x00" % (len(saved) - 1)

    md = re.sub(r"\$\$.+?\$\$", keep, md, flags=re.S)
    md = re.sub(r"(?<!\$)\$[^$\n]+\$(?!\$)", keep, md)
    return md, saved


def unmask_math(text, saved):
    return re.sub(r"\x00M(\d+)\x00", lambda m: saved[int(m.group(1))], text)


def unwrap(text):
    """Join hard-wrapped lines into real paragraphs.

    The renderer turns every single newline into a <br>, so the source's
    55-column hard wrapping would otherwise render as a ragged column.
    Bullets keep their own line; a wrapped bullet folds back into it.
    """
    out_blocks = []
    for block in re.split(r"\n\s*\n", text):
        lines = [l.strip() for l in block.split("\n") if l.strip()]
        if not lines:
            continue
        merged = []
        for line in lines:
            if line.startswith("- ") or not merged:
                merged.append(line)
            else:
                merged[-1] = merged[-1] + " " + line
        out_blocks.append("\n".join(merged))
    return "\n\n".join(out_blocks)


def clean_chunk(text):
    """One markdown chunk -> the renderer subset: **bold**, `code`, "- "."""
    # fenced code has no representation in a body; the .js file is the example
    text, n_fences = FENCE.subn("", text)
    # images, then links -> their text, then reference definitions
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)
    text = re.sub(r"\[([^\]]*)\]\[[^\]]*\]", r"\1", text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"^\s*\[[^\]]+\]:\s*\S+.*$", "", text, flags=re.M)
    # emphasis -> bold (before the HTML rules, so <sub>_x_</sub> cannot confuse
    # it). The source hard-wraps its prose, so emphasis routinely straddles a
    # newline; it may not straddle a blank line, which ends the paragraph.
    text = re.sub(r"(?<![A-Za-z0-9_])_((?:(?!\n\s*\n)[^_]){1,200}?)_(?![A-Za-z0-9_])",
                  r"**\1**", text)
    text = re.sub(r"(?<![*\w])\*((?:(?!\n\s*\n)[^*]){1,200}?)\*(?![*\w])",
                  r"**\1**", text)
    # raw HTML: keep the meaning of super/subscripts, drop the rest of the tags
    text = re.sub(r"<sup>(.*?)</sup>", r"^\1", text, flags=re.S)
    text = re.sub(r"<sub>(.*?)</sub>", r"_\1", text, flags=re.S)
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"<[^>\n]{1,80}>", "", text)
    # tables and block quotes
    text = re.sub(r"^\s*\|.*$", "", text, flags=re.M)
    text = re.sub(r"^\s*>\s?", "", text, flags=re.M)
    # horizontal rules, and the attribution captions the repo puts under images
    text = re.sub(r"^\s*([-*_])\1{2,}\s*$", "", text, flags=re.M)
    text = re.sub(r"^\s*\*{0,2}Made with .*$", "", text, flags=re.M)
    # bullet markers, including numbered lists the subset cannot express
    text = re.sub(r"^\s*[*+]\s+", "- ", text, flags=re.M)
    text = re.sub(r"^\s*-\s+", "- ", text, flags=re.M)
    text = re.sub(r"^\s*\d+[.)]\s+", "- ", text, flags=re.M)
    text = re.sub(r"[ \t]+$", "", text, flags=re.M)
    return unwrap(text), n_fences


def dropped_note(images, table, truncated, path):
    """The one authored line in a body: what the import could not carry.

    A README's formulas and diagrams are images and its complexity figures are
    a table; none of them survive into the renderer subset. Losing them
    silently would leave captions dangling with nothing above them, so every
    body that lost something ends by saying what, and where to read it.
    """
    missing = []
    if images:
        missing.append("%d figure%s" % (images, "" if images == 1 else "s"))
    if table:
        missing.append("the complexity table")
    if truncated:
        missing.append("the rest of the chapter")
    if not missing:
        return ""
    return ("\n\n**Not reproduced here:** %s. Read it at %s"
            % (", ".join(missing), BLOB % (path + "/README.md")))


def readme_to_body(md, path, max_len, stats):
    """A README -> (title, body). body is None when nothing usable survives."""
    md, math = mask_math(md)
    images = len(re.findall(r"!\[[^\]]*\]\([^)]*\)", md))
    stats["images_dropped"] += images

    title = None
    m = re.search(r"^#\s+(.+?)\s*$", md, flags=re.M)
    if m:
        title = re.sub(r"[`*_]", "", m.group(1)).strip()
        md = md[:m.start()] + md[m.end():]

    # the translation banner every README opens with
    md = re.sub(r"^\*?_?Read this in other languages:.*?(?=\n\s*\n)", "",
                md, flags=re.M | re.S)

    has_table = bool(re.search(r"^\s*\|.*\|\s*$", md, flags=re.M))
    if has_table:
        stats["tables_stripped"] += 1

    parts = re.split(r"^#{2,6}\s+(.+?)\s*$", md, flags=re.M)
    chunks = [(None, parts[0])]
    for i in range(1, len(parts) - 1, 2):
        chunks.append((parts[i].strip(), parts[i + 1]))

    pieces, fences = [], 0
    for heading, text in chunks:
        if heading and DROP_HEADINGS.match(heading):
            continue
        body, n = clean_chunk(text)
        fences += n
        if not body:
            continue           # e.g. a Complexity section that was only a table
        if heading:
            head = re.sub(r"[`*_]", "", heading).strip()
            pieces.append("**%s**\n\n%s" % (head, body))
        else:
            pieces.append(body)
    stats["fences_dropped"] += fences

    body = "\n\n".join(pieces)
    body = re.sub(r"\n{3,}", "\n\n", body).strip()
    body = unmask_math(body, math)

    if not body:
        return title, None

    truncated = len(body) > max_len
    if truncated:
        kept, total = [], 0
        for para in body.split("\n\n"):
            if kept and total + len(para) > max_len:
                break
            kept.append(para)
            total += len(para) + 2
        body = "\n\n".join(kept)
        stats["bodies_truncated"] += 1
    body += dropped_note(images, has_table, truncated, path)
    return title, body


# --------------------------------------------------------- javascript modules
IMPORT_RE = re.compile(
    r"^import\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{[^}]*\}\s*)?"
    r"(?:from\s*)?['\"]([^'\"]+)['\"];?[ \t]*$", re.M)
NAMED_RE = re.compile(r"^import\s*\{([^}]*)\}\s*from\s*['\"]([^'\"]+)['\"];?",
                      re.M)


def module_imports(src):
    """[(local_name_or_None, specifier)] for every top-level import."""
    out = []
    for m in IMPORT_RE.finditer(src):
        out.append((m.group(1), m.group(2)))
    for m in NAMED_RE.finditer(src):
        for name in m.group(1).split(","):
            name = name.strip().split(" as ")[-1].strip()
            if name:
                out.append((name, m.group(2)))
    seen, uniq = set(), []
    for name, spec in out:
        if (name, spec) in seen:
            continue
        seen.add((name, spec))
        uniq.append((name, spec))
    return uniq


def strip_module_syntax(src):
    """Remove import/export syntax; return (code, default_export_name).

    A worker has no module loader, so `export default class Foo` has to become
    `class Foo` for the snippet to be pasteable and runnable as-is.
    """
    src = IMPORT_RE.sub("", src)
    src = NAMED_RE.sub("", src)

    default_name = None
    m = re.search(r"^export\s+default\s+(?:async\s+)?"
                  r"(class|function)\s+([A-Za-z_$][\w$]*)", src, flags=re.M)
    if m:
        default_name = m.group(2)
    src = re.sub(r"^export\s+default\s+(?=(?:async\s+)?(?:class|function)\b)",
                 "", src, flags=re.M)

    holder = {"name": default_name}

    def drop_default_ref(m2):
        holder["name"] = holder["name"] or m2.group(1)
        return ""

    src = re.sub(r"^export\s+default\s+([A-Za-z_$][\w$]*)\s*;\s*$",
                 drop_default_ref, src, flags=re.M)
    src = re.sub(r"^export\s+(?=(?:async\s+)?(?:class|function|const|let|var)\b)",
                 "", src, flags=re.M)
    src = re.sub(r"^export\s*\{[^}]*\}\s*;?\s*$", "", src, flags=re.M)
    return re.sub(r"\n{3,}", "\n\n", src).strip("\n"), holder["name"]


def resolve(spec, from_path, tree):
    """A relative import specifier -> the repo path it names, or None."""
    if not spec.startswith("."):
        return None
    base = posixpath.dirname(from_path)
    target = posixpath.normpath(posixpath.join(base, spec)).replace("\\", "/")
    for cand in (target, target + ".js", target + "/index.js"):
        if cand in tree:
            return cand
    return None


def load_module(path, fetcher, tree, seen, depth):
    """Inline `path` and everything it imports, dependencies first.

    Returns (chunks, unresolved_names) where chunks is a list of
    (path, code, default_export_name) with every dependency ahead of the
    module that needs it -- class declarations are not hoisted, so a
    `class BubbleSort extends Sort` only works if Sort came first.
    """
    if path in seen:
        return [], []
    seen.add(path)
    src = fetcher.get(path)
    if src is None:
        return [], []

    chunks, unresolved = [], []
    for name, spec in module_imports(src):
        dep = resolve(spec, path, tree)
        if dep is None or depth <= 0:
            if name:
                unresolved.append(name)
            continue
        sub, sub_unres = load_module(dep, fetcher, tree, seen, depth - 1)
        chunks.extend(sub)
        unresolved.extend(sub_unres)
        if name and sub:
            declared = sub[-1][2]
            if declared and declared != name:
                # the default export is bound under a different local name
                chunks.append((dep + " (alias)",
                               "const %s = %s;" % (name, declared), name))

    code, default_name = strip_module_syntax(src)
    chunks.append((path, code, default_name))
    return chunks, unresolved


HEADER = ("// %s\n"
          "// trekhleb/javascript-algorithms (MIT) -- ES module import/export\n"
          "// statements were stripped so this runs standalone in the worker.")


DECLARED_RE = re.compile(
    r"^(?:class|function|async\s+function|const|let|var)\s+([A-Za-z_$][\w$]*)",
    re.M)


def still_missing(unresolved, chunks):
    """Names an import wanted that nothing in the snippet actually defines.

    A name can be reported unresolved on one branch of the dependency walk and
    still be inlined via another (or be a bare Node builtin the walk refuses to
    follow), so the claim is checked against the emitted code before it is
    made -- a wrong "does not include" note is as bad as a silent omission.
    """
    declared = set()
    for _cpath, code, name in chunks:
        if name:
            declared.add(name)
        declared.update(DECLARED_RE.findall(code))
    return sorted(set(n for n in unresolved if n not in declared))


def build_code(path, fetcher, tree, stats, budget):
    """The runnable example for one implementation file."""
    chunks, unresolved = load_module(path, fetcher, tree, set(), INLINE_DEPTH)
    if not chunks:
        return None, []
    deps = [c for c in chunks[:-1] if not c[0].endswith("(alias)")]
    total = sum(len(c[1]) for c in chunks)
    header = HEADER % path

    if total > budget and deps:
        # too large to inline honestly; ship the module alone and name what
        # is missing rather than pretending the snippet is self-contained
        main = chunks[-1]
        names = sorted(set(c[2] or posixpath.basename(c[0])[:-3] for c in deps))
        stats["deps_not_inlined"] += 1
        stats["modules_stripped"] += 1
        note = ("// Depends on, but does not include: %s\n// (%s)"
                % (", ".join(names), ", ".join(c[0] for c in deps[:4])))
        return "%s\n%s\n\n%s\n" % (header, note, main[1]), names

    body = []
    for cpath, code, _name in chunks:
        if not code.strip():
            continue
        label = (cpath if cpath == path
                 else "dependency, inlined: %s" % cpath)
        body.append("// --- %s ---\n%s" % (label, code))
        if cpath != path:
            stats["deps_inlined"] += 1
    missing = still_missing(unresolved, chunks)
    out = header
    if missing:
        out += "\n// Depends on, but does not include: %s" % ", ".join(missing)
    out += "\n\n" + "\n\n".join(body) + "\n"
    stats["modules_stripped"] += len(chunks)
    return out, missing


def pick_impl(dirpath, tree):
    """The implementation file for a directory, or None."""
    here = [p for p in tree
            if p.startswith(dirpath + "/")
            and p.endswith(".js")
            and "__test__" not in p
            and "/" not in p[len(dirpath) + 1:]]
    if not here:
        return None
    slug = dirpath.rsplit("/", 1)[-1].replace("-", "").lower()
    exact = [p for p in here
             if os.path.basename(p)[:-3].replace("-", "").lower() == slug]
    if exact:
        return sorted(exact)[0]
    # prefer the container over its node type, then the shortest name
    non_node = [p for p in here
                if not os.path.basename(p).lower().endswith("node.js")]
    pool = non_node or here
    return sorted(pool, key=lambda p: (len(os.path.basename(p)), p))[0]


def test_specs(dirpath, tree):
    return sorted(p for p in tree
                  if p.startswith(dirpath + "/__test__/")
                  and p.endswith(".test.js"))


# ------------------------------------------------------------------ building
def build(fetcher, max_body, max_sections, budget, stats):
    tree_raw = fetcher.get("tree.json", absolute=TREE)
    if not tree_raw:
        raise SystemExit(
            "Could not read the repository tree (the GitHub API may be "
            "rate-limiting). Try again later, or re-run with the cache warm.")
    tree = set(e["path"] for e in json.loads(tree_raw).get("tree", []))
    stats["tree_entries"] = len(tree)

    floors = []
    for i, (floor_name, topic, dirs) in enumerate(FLOORS):
        n = i + 1
        sections, concepts, used, todo, skipped = [], [], [], [], []
        for dirpath in dirs:
            slug = dirpath.rsplit("/", 1)[-1]
            if len(sections) >= max_sections:
                skipped.append(slug)
                continue
            md = fetcher.get(dirpath + "/README.md")
            if md is None:
                stats["no_readme"].append(dirpath)
                skipped.append(slug)
                continue
            impl = pick_impl(dirpath, tree)
            if not impl:
                stats["no_impl"].append(dirpath)
                skipped.append(slug)
                continue
            title, body = readme_to_body(md, dirpath, max_body, stats)
            if not body:
                stats["no_body"].append(dirpath)
                skipped.append(slug)
                continue
            code, missing = build_code(impl, fetcher, tree, stats, budget)
            if not code:
                stats["no_impl"].append(impl)
                skipped.append(slug)
                continue
            sections.append({
                "title": title or slug.replace("-", " ").title(),
                "body": body,
                "code": code,
                "lang": "javascript",
                "annotations": [],
                "source": impl,
            })
            concepts.append(slug)
            used.append(dirpath)
            if missing:
                todo.append("section '%s': the code example references %s, "
                            "which is not inlined -- provide it in the worker "
                            "preamble or inline it by hand"
                            % (title or slug, ", ".join(missing)))
            stats["sections"] += 1

        specs = []
        for d in used:
            specs.extend(test_specs(d, tree))
        if specs:
            todo.append("practice: author 6-10 challenges grounded in the "
                        "source's Jest specs -- %s" % ", ".join(specs[:6]))
        else:
            todo.append("practice: author 6-10 challenges (no Jest specs "
                        "found under this floor's directories)")
        todo.append("exam: author 8-12 questions")
        if len(sections) < 2:
            todo.append("lesson needs %d more section(s) with a code example"
                        % (2 - len(sections)))
        if skipped:
            todo.append("also in this topic, not imported (a lesson caps at "
                        "%d sections): %s" % (max_sections, ", ".join(skipped)))
        if n == 10:
            todo.append("boss floor: needs a `project` challenge")
        stats["todos"] += len(todo)

        floors.append({
            "n": n,
            "name": floor_name,
            "topic": topic,
            "concepts": concepts,
            "exercises": used,
            "lesson": {"sections": sections},
            "practice": [],
            "exam": [],
            "_todo": todo,
        })

    return {
        "id": DUNGEON_ID,
        "name": "The Recursive Labyrinth",
        "subject": "Algorithms & Data Structures",
        "category": "theory",
        "disciplineType": "algorithms",
        "sigil": "⟲",
        "unlock": None,
        "lang": "javascript",
        "runtime": "worker",
        "source": "trekhleb/javascript-algorithms (MIT)",
        "importedBy": "scripts/import_trekhleb.py",
        "blurb": "Sorting, searching, structures and the classic algorithms, "
                 "read from their reference JavaScript implementations.",
        "floors": floors,
    }


# ---------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--max-body", type=int, default=2400,
                    help="characters of README prose per lesson section")
    ap.add_argument("--max-sections", type=int, default=MAX_SECTIONS,
                    help="lesson sections per floor (the schema caps this at 4)")
    ap.add_argument("--inline-budget", type=int, default=INLINE_BUDGET,
                    help="chars an example may reach once its local module "
                         "dependencies are inlined; over this it ships alone "
                         "with a comment naming what is missing")
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--dry-run", action="store_true",
                    help="print the summary without writing files")
    args = ap.parse_args()

    stats = {"sections": 0, "todos": 0, "tables_stripped": 0,
             "images_dropped": 0,
             "fences_dropped": 0, "bodies_truncated": 0, "deps_inlined": 0,
             "deps_not_inlined": 0, "modules_stripped": 0, "tree_entries": 0,
             "no_readme": [], "no_impl": [], "no_body": []}

    f = Fetcher(use_cache=not args.no_cache)
    print("importing %s ..." % REPO)
    dungeon = build(f, args.max_body, args.max_sections,
                    args.inline_budget, stats)

    out_json = os.path.join(ROOT, "content", "%s.json" % DUNGEON_ID)
    if not args.dry_run:
        os.makedirs(os.path.dirname(out_json), exist_ok=True)
        json.dump(dungeon, io.open(out_json, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)

    n_sec = sum(len(fl["lesson"]["sections"]) for fl in dungeon["floors"])
    n_prac = sum(len(fl["practice"]) for fl in dungeon["floors"])
    n_exam = sum(len(fl["exam"]) for fl in dungeon["floors"])
    body_chars = sum(len(s["body"]) for fl in dungeon["floors"]
                     for s in fl["lesson"]["sections"])
    code_chars = sum(len(s["code"]) for fl in dungeon["floors"]
                     for s in fl["lesson"]["sections"])

    print("")
    print("=" * 70)
    print("  IMPORT SUMMARY - trekhleb/javascript-algorithms")
    print("=" * 70)
    print("  network: %d fetched, %d from cache%s" % (
        f.misses, f.hits,
        ", %d failed" % len(f.failures) if f.failures else ""))
    print("  repo tree entries read        : %d" % stats["tree_entries"])
    print("")
    print("  IMPORTED")
    print("    floors                      : %d" % len(dungeon["floors"]))
    print("    lesson sections             : %d  (%d chars of README prose)"
          % (n_sec, body_chars))
    print("    code examples               : %d  (%d chars of .js)"
          % (n_sec, code_chars))
    print("    ES modules stripped         : %d import/export headers removed"
          % stats["modules_stripped"])
    print("    dependency modules inlined  : %d  (each emitted before its "
          "dependent)" % stats["deps_inlined"])
    print("")
    print("  DROPPED - no representation in the renderer subset")
    print("    READMEs carrying tables     : %d  (complexity tables stripped)"
          % stats["tables_stripped"])
    print("    fenced blocks dropped       : %d  (the .js file is the example)"
          % stats["fences_dropped"])
    print("    figures dropped             : %d  (they are images; every body"
          % stats["images_dropped"])
    print("                                  that lost one says so and links out)")
    print("    bodies cut at --max-body    : %d  (each links to the full "
          "chapter)" % stats["bodies_truncated"])
    print("")
    print("  NEEDS MANUAL WORK")
    print("    practice challenges         : %d  - NONE imported. This source"
          % n_prac)
    print("                                  has no question bank. The Jest")
    print("                                  specs are named in each floor's")
    print("                                  _todo as grounding for a later pass.")
    print("    exam questions              : %d  - none imported, %d floors "
          "need 8-12 each" % (n_exam, len(dungeon["floors"])))
    print("    examples with uninlined deps: %d" % stats["deps_not_inlined"])
    print("    total _todo entries         : %d" % stats["todos"])
    for label, key in (("no README.md", "no_readme"),
                       ("no .js implementation", "no_impl"),
                       ("README had no usable prose", "no_body")):
        if stats[key]:
            print("    %-27s : %d  %s"
                  % (label, len(stats[key]), ", ".join(stats[key][:3])))
    if f.failures:
        print("    fetch failures              : %s"
              % "; ".join(f.failures[:5]))
    print("")
    print("  PER FLOOR")
    for fl in dungeon["floors"]:
        print("    %2d. %-30s %d sections  %d todo  %s"
              % (fl["n"], fl["name"], len(fl["lesson"]["sections"]),
                 len(fl["_todo"]), ",".join(fl["concepts"])[:36]))
    print("")
    if args.dry_run:
        print("  (dry run - nothing written)")
    else:
        print("  wrote %s" % os.path.relpath(out_json, ROOT))
    print("  content/index.json untouched - the caller regenerates it.")
    print("  next: python scripts/validate_content.py %s" % DUNGEON_ID)
    print("=" * 70)


if __name__ == "__main__":
    main()
