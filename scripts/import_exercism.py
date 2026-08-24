#!/usr/bin/env python3
"""Import an Exercism language track into a Grimoire dungeon JSON.

    python scripts/import_exercism.py python
    python scripts/import_exercism.py python --dry-run
    python scripts/import_exercism.py rust --no-cache

Reads the track's config.json syllabus, orders concept exercises by their
declared prerequisites, groups them into floors, and pulls lesson text,
runnable examples, starter code and test cases out of the repository.

Test-case extraction is real but partial: it parses the Python test suites
with `ast` and recognises the shapes Exercism actually uses. Anything it
cannot read with confidence is emitted as a TODO rather than a guess. The
summary at the end says exactly how much was imported and what is left.

Source: github.com/exercism/{track} (MIT). See content/attribution.md.
"""
import argparse
import ast
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "exercism")
RAW = "https://raw.githubusercontent.com/exercism/{track}/main/{path}"

# Tracks whose tests this importer can parse. Others still import lessons,
# examples and starter code; their tests are emitted as TODOs.
AST_TRACKS = {"python"}

EXT = {
    "python": "py", "javascript": "js", "typescript": "ts", "ruby": "rb",
    "go": "go", "rust": "rs", "java": "java", "csharp": "cs", "cpp": "cpp",
    "c": "c", "php": "php", "swift": "swift", "kotlin": "kt", "bash": "sh",
    "haskell": "hs", "lua": "lua", "r": "r", "elixir": "ex",
}

# Dungeon flavour. Unknown tracks fall back to a generic name.
FLAVOUR = {
    "python":     {"name": "The Serpent's Descent",   "sigil": "\U0001F40D"},
    "javascript": {"name": "The Shifting Sanctum",    "sigil": "⚡"},
    "typescript": {"name": "The Warded Archive",      "sigil": "\U0001F6E1"},
    "c":          {"name": "The Bare Metal Depths",   "sigil": "⚙"},
    "cpp":        {"name": "The Obsidian Foundry",    "sigil": "\U0001F5DC"},
    "rust":       {"name": "The Ironbound Vault",     "sigil": "\U0001F980"},
    "go":         {"name": "The Concurrent Warrens",  "sigil": "\U0001F439"},
    "java":       {"name": "The Cathedral of Types",  "sigil": "☕"},
    "csharp":     {"name": "The Gilded Framework",    "sigil": "\U0001F3DB"},
    "ruby":       {"name": "The Crimson Atelier",     "sigil": "\U0001F48E"},
    "php":        {"name": "The Elephant's Crypt",    "sigil": "\U0001F418"},
    "swift":      {"name": "The Falcon's Spire",      "sigil": "\U0001F985"},
    "kotlin":     {"name": "The Twin Blades",         "sigil": "\U0001F5E1"},
    "bash":       {"name": "The Shell Catacombs",     "sigil": "▶"},
    "haskell":    {"name": "The Lambda Sanctum",      "sigil": "λ"},
    "lua":        {"name": "The Lunar Annex",         "sigil": "\U0001F319"},
    "r":          {"name": "The Statistician's Hall", "sigil": "\U0001F4CA"},
}

XP = {"code": 15, "debug": 18, "output": 10, "fill": 10, "order": 12,
      "mcq": 8, "multi": 10, "explain": 12, "project": 120}


# --------------------------------------------------------------- fetching
class Fetcher:
    def __init__(self, track, use_cache=True):
        self.track = track
        self.use_cache = use_cache
        self.hits = 0
        self.misses = 0
        self.failures = []

    def get(self, path):
        """Returns file text, or None if it does not exist."""
        key = os.path.join(CACHE, self.track, path.replace("/", "__"))
        if self.use_cache and os.path.exists(key):
            self.hits += 1
            return io.open(key, encoding="utf-8").read()
        url = RAW.format(track=self.track, path=path)
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
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


# ------------------------------------------------------------- ordering
def topo_order(exercises):
    """Order exercises so every prerequisite concept is taught first.

    Exercism declares prerequisites as concept names, not exercise slugs, so
    we map concept -> the exercise that teaches it and sort over that. Ties
    keep config.json's own order, which is already pedagogically sensible.
    """
    teaches = {}
    for e in exercises:
        for c in e.get("concepts", []):
            teaches.setdefault(c, e["slug"])

    pos = {e["slug"]: i for i, e in enumerate(exercises)}
    by_slug = {e["slug"]: e for e in exercises}
    done, order, cycles = set(), [], []

    def visit(slug, stack):
        if slug in done:
            return
        if slug in stack:
            cycles.append(" -> ".join(list(stack) + [slug]))
            return
        stack.add(slug)
        deps = []
        for c in by_slug[slug].get("prerequisites", []):
            owner = teaches.get(c)
            if owner and owner != slug:
                deps.append(owner)
        for d in sorted(set(deps), key=lambda s: pos.get(s, 1e9)):
            visit(d, stack)
        stack.discard(slug)
        done.add(slug)
        order.append(slug)

    for e in exercises:
        visit(e["slug"], set())
    return [by_slug[s] for s in order], cycles


# ------------------------------------------------------- markdown parsing
FENCE = re.compile(r"```([a-zA-Z0-9+#-]*)\n(.*?)```", re.S)


def strip_links(md):
    """Exercism uses reference-style links heavily; flatten them for display."""
    md = re.sub(r"\[([^\]]+)\]\[[^\]]*\]", r"\1", md)
    md = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", md)
    md = re.sub(r"^\[[^\]]+\]:\s*http\S+\s*$", "", md, flags=re.M)
    return md


def split_sections(md, lang, max_sections=2):
    """Turn an introduction.md into Grimoire lesson sections.

    Code fences are masked out first, so a `## ` comment inside an example
    can never be mistaken for a heading. Prefers level-2 headings, falls back
    to level-3, and finally -- for the many introductions that are flat prose
    -- splits on the code examples themselves, since a section is only useful
    to us if it carries something runnable.
    """
    md = strip_links(md)
    md = re.sub(r"^#\s+Introduction\s*$", "", md, flags=re.M)

    blocks = []

    def mask(m):
        blocks.append((m.group(1), m.group(2).strip("\n")))
        return "\x00BLOCK%d\x00" % (len(blocks) - 1)

    masked = FENCE.sub(mask, md)

    def pick_code(text):
        """First runnable-looking block referenced in this chunk."""
        ids = [int(i) for i in re.findall(r"\x00BLOCK(\d+)\x00", text)]
        for i in ids:
            body = blocks[i][1]
            if not body.lstrip().startswith(">>>"):
                return body
        if ids:
            return repl_to_script(blocks[ids[0]][1])
        return ""

    def clean(text):
        text = re.sub(r"\x00BLOCK\d+\x00", "", text)
        return re.sub(r"\n{3,}", "\n\n", text).strip()

    chunks = []
    parts = re.split(r"^##\s+(.+?)\s*$", masked, flags=re.M)
    if len(parts) < 3:
        parts = re.split(r"^###\s+(.+?)\s*$", masked, flags=re.M)

    if len(parts) >= 3:
        for i in range(1, len(parts) - 1, 2):
            chunks.append((parts[i].strip(), parts[i + 1]))
    else:
        # Flat prose: cut at each code example. The prose leading up to an
        # example is the explanation for it.
        pieces = re.split(r"(\x00BLOCK\d+\x00)", masked)
        buf = ""
        for piece in pieces:
            buf += piece
            if re.fullmatch(r"\x00BLOCK\d+\x00", piece):
                body = clean(buf)
                if body:
                    chunks.append((heading_from(body), buf))
                buf = ""
        if clean(buf) and not chunks:
            chunks.append((heading_from(clean(buf)), buf))

    out = []
    for title, body in chunks:
        body_text = clean(body)
        if not body_text:
            continue
        out.append({"title": title, "body": body_text,
                    "code": pick_code(body), "lang": lang})
    out.sort(key=lambda s: 0 if s["code"] else 1)
    return out[:max_sections]


def heading_from(text):
    """Invent a section title from the first sentence of flat prose."""
    first = re.sub(r"[*`_]", "", text.strip().split("\n")[0]).strip()
    first = re.sub(r"\s+", " ", first)
    if len(first) > 60:
        first = first[:57].rsplit(" ", 1)[0] + "..."
    return first or "Concept"


def repl_to_script(text):
    """Convert a >>> transcript into a runnable script with printed results."""
    lines, out = text.split("\n"), []
    for ln in lines:
        s = ln.rstrip()
        if s.startswith(">>> "):
            out.append(s[4:])
        elif s.startswith("... "):
            out.append(s[4:])
    return "\n".join(out)


# --------------------------------------------------- python test extraction
class TestExtractor(ast.NodeVisitor):
    """Pull {input, expected} cases out of an Exercism Python test suite.

    Recognises the three shapes the track actually uses:
      A  actual = fn(a, b) ... self.assertEqual(actual, <literal>)
      B  input_data = [...]; result_data = [...]; for ... fn(x) / fn(*params)
      C  self.assertEqual(CONSTANT, <literal>)        (constant check)
    Anything else is counted as unparsed rather than guessed at.
    """

    ASSERTS = {"assertEqual", "assertAlmostEqual", "assertIs", "assertTrue",
               "assertFalse", "assertIsNone", "assertListEqual", "assertDictEqual",
               "assertSetEqual", "assertTupleEqual", "assertCountEqual"}

    def __init__(self, functions):
        self.functions = set(functions)
        self.tasks = {}      # test method name -> {fn, cases[], unparsed}
        self.current = None

    # -- helpers ---------------------------------------------------------
    @staticmethod
    def lit(node):
        try:
            return True, ast.literal_eval(node)
        except Exception:
            return False, None

    @staticmethod
    def args_src(call, env=None):
        """Render a call's arguments as source, resolving local literals.

        Exercism often binds a literal to a name first and passes the name,
        so a purely literal-only reader misses most of the real cases.
        """
        env = env or {}

        def value(node):
            ok, v = TestExtractor.lit(node)
            if ok:
                return True, v
            if isinstance(node, ast.Name) and node.id in env:
                return True, env[node.id]
            return False, None

        parts = []
        for a in call.args:
            ok, v = value(a)
            if not ok:
                return None
            parts.append(repr(v))
        for kw in call.keywords:
            ok, v = value(kw.value)
            if not ok or kw.arg is None:
                return None
            parts.append("%s=%r" % (kw.arg, v))
        return ", ".join(parts)

    def called_fn(self, node):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) \
                and node.func.id in self.functions:
            return node.func.id
        return None

    def record(self, fn, inp, expected):
        t = self.tasks[self.current]
        t["fn"] = t["fn"] or fn
        if any(c["input"] == inp for c in t["cases"]):
            return
        t["cases"].append({"input": inp, "expected": expected})

    # -- visiting --------------------------------------------------------
    @staticmethod
    def taskno(node):
        """@pytest.mark.task(taskno=N) ties a test to a numbered instruction."""
        for dec in node.decorator_list:
            if isinstance(dec, ast.Call):
                for kw in dec.keywords:
                    if kw.arg == "taskno":
                        ok, v = TestExtractor.lit(kw.value)
                        if ok:
                            return v
        return None

    def visit_FunctionDef(self, node):
        if not node.name.startswith("test"):
            return
        self.current = node.name
        self.tasks[node.name] = {"fn": None, "cases": [], "unparsed": 0,
                                 "doc": ast.get_docstring(node) or "",
                                 "taskno": self.taskno(node)}
        env = {}
        self.walk_body(node.body, env)
        self.current = None

    def walk_body(self, body, env):
        for stmt in body:
            self.handle(stmt, env)

    def handle(self, stmt, env):
        # remember literal list assignments for the paired-data shape
        if isinstance(stmt, ast.Assign) and len(stmt.targets) == 1 \
                and isinstance(stmt.targets[0], ast.Name):
            name = stmt.targets[0].id
            ok, val = self.lit(stmt.value)
            if ok:
                env[name] = val
            elif isinstance(stmt.value, (ast.ListComp, ast.JoinedStr)):
                env[name] = self.safe_eval(stmt.value, env)
            elif self.called_fn(stmt.value):
                env["__call__"] = stmt.value
            return

        if isinstance(stmt, ast.For):
            self.handle_for(stmt, env)
            return

        if isinstance(stmt, (ast.With, ast.If)):
            self.walk_body(stmt.body, env)
            return

        if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Call):
            self.handle_assert(stmt.value, env)

    def safe_eval(self, node, env):
        """Evaluate a literal-derived comprehension in an empty namespace.

        Only used for expressions whose free names are already literals we
        read out of the same test file, and with builtins removed.
        """
        try:
            expr = ast.Expression(body=node)
            ast.fix_missing_locations(expr)
            scope = {k: v for k, v in env.items() if not k.startswith("__")}
            return eval(compile(expr, "<test>", "eval"), {"__builtins__": {}}, scope)
        except Exception:
            return None

    def handle_assert(self, call, env):
        if not (isinstance(call.func, ast.Attribute) and call.func.attr in self.ASSERTS):
            return
        if not call.args:
            return
        t = self.tasks[self.current]
        first = call.args[0]

        # shape A: assert on a call, either inline or via a saved variable
        target = first
        if isinstance(first, ast.Name) and isinstance(env.get("__call__"), ast.Call):
            target = env["__call__"]

        fn = self.called_fn(target)
        if fn:
            inp = self.args_src(target, env)
            if inp is None:
                t["unparsed"] += 1
                return
            if call.func.attr in ("assertTrue", "assertFalse"):
                self.record(fn, inp, call.func.attr == "assertTrue")
                return
            if call.func.attr == "assertIsNone":
                self.record(fn, inp, None)
                return
            if len(call.args) < 2:
                t["unparsed"] += 1
                return
            ok, exp = self.lit(call.args[1])
            if not ok and isinstance(call.args[1], ast.Name):
                exp = env.get(call.args[1].id)
                ok = exp is not None
            if not ok:
                t["unparsed"] += 1
                return
            self.record(fn, inp, exp)
            return

        # shape C: constant check -- assertEqual(CONSTANT, literal)
        if isinstance(first, ast.Name) and first.id.isupper() and len(call.args) > 1:
            ok, exp = self.lit(call.args[1])
            if ok:
                t["fn"] = t["fn"] or first.id
                t["constant"] = True
                self.record(first.id, "", exp)
                return
        t["unparsed"] += 1

    def handle_for(self, node, env):
        """Read the loop-over-a-table shapes Exercism uses.

        zip form   for i, (params, expected) in enumerate(zip(inputs, results))
        table form for i, data in enumerate(test_data)
                       temp, neutrons, expected = data
                       actual = fn(temp, neutrons)
        In the table form the columns are named by an unpack inside the body,
        so we can tell which columns are arguments and which is the answer.
        """
        it = node.iter
        if isinstance(it, ast.Call) and isinstance(it.func, ast.Name) \
                and it.func.id == "enumerate" and it.args:
            it = it.args[0]

        def resolve(node_):
            ok, v = self.lit(node_)
            if ok:
                return v
            if isinstance(node_, ast.Name):
                return env.get(node_.id)
            return None

        # ---- zip(inputs, results) ----
        if isinstance(it, ast.Call) and isinstance(it.func, ast.Name) and it.func.id == "zip":
            cols = [resolve(a) for a in it.args]
            if len(cols) == 2 and cols[0] is not None and cols[1] is not None:
                return self.emit_zip(node, env, cols[0], cols[1])
            self.walk_body(node.body, dict(env))
            return

        rows = resolve(it)
        if not isinstance(rows, (list, tuple)) or not rows:
            self.walk_body(node.body, dict(env))
            return

        # ---- what is each row bound to? ----
        row_name, colnames = None, None
        tgt = node.target
        if isinstance(tgt, ast.Name):
            row_name = tgt.id
        elif isinstance(tgt, ast.Tuple) and tgt.elts:
            last = tgt.elts[-1]
            if isinstance(last, ast.Name):
                row_name = last.id
            elif isinstance(last, ast.Tuple):
                colnames = [e.id if isinstance(e, ast.Name) else None for e in last.elts]

        # an unpack inside the body names the columns
        if colnames is None and row_name:
            for sub in ast.walk(node):
                if isinstance(sub, ast.Assign) and len(sub.targets) == 1 \
                        and isinstance(sub.targets[0], ast.Tuple) \
                        and isinstance(sub.value, ast.Name) and sub.value.id == row_name:
                    colnames = [e.id if isinstance(e, ast.Name) else None
                                for e in sub.targets[0].elts]
                    break
        if not colnames:
            self.tasks[self.current]["unparsed"] += 1
            return

        # ---- which columns feed the call, and which is the answer? ----
        fn, arg_names, starred = None, None, False
        for sub in ast.walk(node):
            if isinstance(sub, ast.Call) and isinstance(sub.func, ast.Name) \
                    and sub.func.id in self.functions:
                fn = sub.func.id
                starred = any(isinstance(a, ast.Starred) for a in sub.args)
                arg_names = [a.id if isinstance(a, ast.Name) else None for a in sub.args]
                break
        if not fn:
            self.tasks[self.current]["unparsed"] += 1
            return

        exp_name = None
        for sub in ast.walk(node):
            if isinstance(sub, ast.Call) and isinstance(sub.func, ast.Attribute) \
                    and sub.func.attr in self.ASSERTS and len(sub.args) > 1 \
                    and isinstance(sub.args[1], ast.Name):
                exp_name = sub.args[1].id
                break
        if exp_name not in colnames:
            self.tasks[self.current]["unparsed"] += 1
            return
        exp_i = colnames.index(exp_name)

        if starred or arg_names == [row_name]:
            arg_i = [i for i in range(len(colnames)) if i != exp_i]
        else:
            arg_i = [colnames.index(a) for a in arg_names if a in colnames]
            if len(arg_i) != len(arg_names):
                self.tasks[self.current]["unparsed"] += 1
                return

        for row in rows:
            if not isinstance(row, (list, tuple)) or len(row) <= exp_i:
                continue
            inp = ", ".join(repr(row[i]) for i in arg_i)
            self.record(fn, inp, row[exp_i])

    def emit_zip(self, node, env, inputs, results):
        fn, starred = None, False
        for sub in ast.walk(node):
            if isinstance(sub, ast.Call) and isinstance(sub.func, ast.Name) \
                    and sub.func.id in self.functions:
                fn = sub.func.id
                starred = any(isinstance(a, ast.Starred) for a in sub.args)
                break
        if not fn:
            self.tasks[self.current]["unparsed"] += 1
            return
        for raw_in, raw_out in zip(inputs, results):
            if starred and isinstance(raw_in, (tuple, list)):
                inp = ", ".join(repr(v) for v in raw_in)
            else:
                inp = repr(raw_in)
            self.record(fn, inp, raw_out)


def jsonable(v):
    if isinstance(v, tuple):
        return [jsonable(x) for x in v]
    if isinstance(v, list):
        return [jsonable(x) for x in v]
    if isinstance(v, dict):
        return {str(k): jsonable(x) for k, x in v.items()}
    if isinstance(v, set):
        return sorted(jsonable(x) for x in v)
    if isinstance(v, (str, int, float, bool)) or v is None:
        return v
    return repr(v)


def extract_python_tests(src, functions):
    try:
        tree = ast.parse(src)
    except SyntaxError as e:
        return {}, "could not parse test file: %s" % e
    ex = TestExtractor(functions)
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            for item in node.body:
                if isinstance(item, ast.FunctionDef):
                    ex.visit_FunctionDef(item)
    return ex.tasks, None


def imported_functions(src):
    """Names the test file imports from the solution module."""
    names = []
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return names
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            for a in node.names:
                names.append(a.name)
    return names


# ------------------------------------------------------------- building
def humanise(slug):
    return slug.replace("-", " ").title()


FLOOR_NAMES = [
    "Threshold of Syntax", "Hall of Branching Paths", "The Bound Sigil",
    "Vault of Collections", "Chamber of Forms", "The Iterating Spiral",
    "Sanctum of Structure", "The Warded Gate", "Depths of Abstraction",
    "The Archmage's Trial",
]


def distribute(items, target_floors, per_floor):
    """Split exercises into floors, keeping the syllabus order.

    With a target count the remainder is spread over the last floors rather
    than left as a stub floor at the end - a floor with two exercises cannot
    reach the six-practice minimum.
    """
    n = len(items)
    if not n:
        return []
    if not target_floors:
        target_floors = max(1, (n + per_floor - 1) // per_floor)
        # A trailing floor that is less than half full is folded backwards.
        if target_floors > 1 and n - (target_floors - 1) * per_floor <= per_floor // 2:
            target_floors -= 1
    target_floors = min(target_floors, n)
    base, extra = divmod(n, target_floors)
    out, i = [], 0
    for f in range(target_floors):
        take = base + (1 if f >= target_floors - extra else 0)
        out.append(items[i:i + take])
        i += take
    return out


def build_dungeon(track, fetcher, per_floor, report, target_floors=None):
    conf_raw = fetcher.get("config.json")
    if conf_raw is None:
        raise SystemExit("Could not fetch config.json for track '%s'." % track)
    conf = json.loads(conf_raw)

    concept_exercises = [e for e in conf.get("exercises", {}).get("concept", [])
                         if e.get("status") != "deprecated"]
    report["exercises_declared"] = len(concept_exercises)
    ordered, cycles = topo_order(concept_exercises)
    report["cycles"] = cycles

    ext = EXT.get(track, "txt")
    lang_id = track
    floors = []

    # Floor count follows the syllabus, never a fixed number. Either the
    # caller names a target and the exercises are spread evenly across it,
    # or the concept tree decides via the per-floor grouping.
    groups = distribute(ordered, target_floors, per_floor)
    report["floor_sizes"] = [len(g) for g in groups]
    for i, group in enumerate(groups):
        floors.append(build_floor(track, ext, lang_id, i + 1, group, fetcher, report))

    flav = FLAVOUR.get(track, {"name": humanise(track) + " Depths", "sigil": "◈"})
    return {
        "id": track,
        "name": flav["name"],
        "subject": conf.get("language", humanise(track)),
        "category": "language",
        "sigil": flav["sigil"],
        "unlock": None,
        "source": "exercism/%s (MIT)" % track,
        "importedBy": "scripts/import_exercism.py",
        "blurb": conf.get("blurb", ""),
        "floors": floors,
    }


def build_floor(track, ext, lang_id, n, group, fetcher, report):
    concepts, sections, practice, notes = [], [], [], []

    for ex in group:
        slug = ex["slug"]
        concepts.extend(ex.get("concepts", []) or [slug])
        base = "exercises/concept/%s" % slug

        meta_raw = fetcher.get(base + "/.meta/config.json")
        meta = json.loads(meta_raw) if meta_raw else {}
        files = meta.get("files", {})
        test_file = (files.get("test") or [None])[0]
        solution_file = (files.get("solution") or [None])[0]
        exemplar_file = (files.get("exemplar") or [".meta/exemplar.%s" % ext])[0]

        intro = fetcher.get(base + "/.docs/introduction.md")
        instructions = parse_instructions(fetcher.get(base + "/.docs/instructions.md"))
        exemplar = fetcher.get(base + "/" + exemplar_file) if exemplar_file else None
        starter = fetcher.get(base + "/" + solution_file) if solution_file else None
        tests_src = fetcher.get(base + "/" + test_file) if test_file else None

        # ---- lesson ----
        secs = split_sections(intro, lang_id, max_sections=2) if intro else []
        for s in secs:
            if not s["code"] and exemplar:
                s["code"] = first_definition(exemplar, ext)
        if not secs:
            report["missing_intro"].append(slug)
        sections.extend(secs)

        # ---- practice ----
        got = 0
        if tests_src and track in AST_TRACKS:
            fns = imported_functions(tests_src)
            tasks, err = extract_python_tests(tests_src, fns)
            if err:
                notes.append("%s: %s" % (slug, err))
            for tname, t in tasks.items():
                if not t["cases"] or not t["fn"]:
                    continue
                cases = [{"input": c["input"], "expected": jsonable(c["expected"])}
                         for c in t["cases"]]
                practice.append({
                    "id": "%s-%d-p-%02d" % (track[:2], n, len(practice) + 1),
                    "type": "code",
                    "fn": t["fn"],
                    "prompt": prompt_for(t, slug, instructions),
                    "starterCode": starter_for(starter, t, ext),
                    "tests": cases,
                    "explain": "TODO: explain why this works, not just that it does.",
                    "_promptImported": bool(instructions and t.get("taskno") in instructions),
                    "hint": "",
                    "xp": XP["code"],
                    "tags": ex.get("concepts", []) or [slug],
                    "source": "exercism/%s %s" % (track, slug),
                })
                got += len(cases)
            report["tasks_parsed"] += len(tasks)
            report["tasks_with_cases"] += sum(1 for t in tasks.values() if t["cases"])
            report["cases"] += got
            report["unparsed_asserts"] += sum(t["unparsed"] for t in tasks.values())
        elif tests_src:
            notes.append("%s: tests not parsed (no extractor for '%s')" % (slug, track))
            report["todo_tests"].append(slug)
        else:
            report["missing_tests"].append(slug)

    # cap lesson sections at the schema maximum
    if len(sections) > 4:
        report["sections_trimmed"] += len(sections) - 4
        sections = sections[:4]

    floor = {
        "n": n,
        "name": FLOOR_NAMES[n - 1] if n <= len(FLOOR_NAMES) else "Floor %d" % n,
        "concepts": sorted(set(concepts)),
        "exercises": [e["slug"] for e in group],
        "lesson": {"sections": sections},
        "practice": practice,
        "exam": [],
        "_todo": [],
    }
    if len(sections) < 2:
        floor["_todo"].append("lesson needs %d more section(s) with a code example"
                              % (2 - len(sections)))
    if len(practice) < 6:
        floor["_todo"].append("practice needs %d more challenge(s)" % (6 - len(practice)))
    floor["_todo"].append("exam: author 8-12 questions")
    floor["_todo"].extend(notes)
    return floor


def parse_instructions(md):
    """`## 3. Do the thing` -> {3: (title, body)} from an instructions.md."""
    if not md:
        return {}
    md = strip_links(md)
    out = {}
    parts = re.split(r"^##\s+(\d+)\.\s*(.+?)\s*$", md, flags=re.M)
    for i in range(1, len(parts) - 2, 3):
        try:
            n = int(parts[i])
        except ValueError:
            continue
        title, body = parts[i + 1].strip(), parts[i + 2]
        body = FENCE.sub(lambda m: "\n```%s\n%s\n```\n" % (m.group(1), m.group(2).strip("\n")), body)
        body = re.sub(r"\n{3,}", "\n\n", body).strip()
        out[n] = (title, body)
    return out


def extract_member(src, name, ext):
    """Just the one function or constant a challenge is about.

    Exercism stubs contain every task in the exercise; handing all of them to
    every challenge buries the actual question.
    """
    if not src or ext != "py":
        return None
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return None
    lines = src.split("\n")
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            start = min([node.lineno] + [d.lineno for d in node.decorator_list]) - 1
            # keep a comment block sitting directly above the def
            while start > 0 and lines[start - 1].lstrip().startswith("#"):
                start -= 1
            end = getattr(node, "end_lineno", None) or len(lines)
            return "\n".join(lines[start:end]).rstrip() + "\n"
        if isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            for t in targets:
                if isinstance(t, ast.Name) and t.id == name:
                    end = getattr(node, "end_lineno", None) or node.lineno
                    return "\n".join(lines[node.lineno - 1:end]).rstrip() + "\n"
    return None


def prompt_for(task, slug, instructions=None):
    name = task["fn"]
    tno = task.get("taskno")
    if instructions and tno in instructions:
        title, body = instructions[tno]
        return "**%s**\n\n%s" % (title, body)
    doc = (task.get("doc") or "").strip()
    if doc:
        return doc
    if task.get("constant"):
        return "Define a constant `%s` with the value the tests expect." % name
    return "Implement `%s`.\n\nTODO: write the task description (from %s)." % (name, slug)


def starter_for(starter_src, task, ext):
    """The stub for this task alone, not the whole exercise file."""
    member = extract_member(starter_src, task["fn"], ext)
    if member:
        return member
    if starter_src and starter_src.strip():
        return starter_src.rstrip() + "\n"
    fn = task["fn"]
    if task.get("constant"):
        return "%s = \n" % fn
    n_args = len(task["cases"][0]["input"].split(",")) if task["cases"] and task["cases"][0]["input"] else 0
    params = ", ".join("arg%d" % (i + 1) for i in range(n_args))
    if ext == "py":
        return "def %s(%s):\n    pass\n" % (fn, params)
    return "// implement %s(%s)\n" % (fn, params)


def first_definition(src, ext):
    """A short runnable snippet lifted from the exemplar."""
    src = re.sub(r'^""".*?"""\n', "", src, flags=re.S)
    lines = [l for l in src.split("\n")]
    out, started = [], False
    for l in lines:
        if not started and (l.startswith("def ") or l.startswith("class ")
                            or re.match(r"^[A-Z_]+\s*=", l)):
            started = True
        if started:
            out.append(l)
        if started and len(out) > 14:
            break
    return "\n".join(out).strip() or src.strip()[:400]


# -------------------------------------------------------------- syllabus
BEGIN = "<!-- GENERATED:BEGIN - import_exercism.py rewrites this block -->"
END = "<!-- GENERATED:END -->"


def write_syllabus(dungeon, conf_concepts, path):
    lines = ["# Syllabus - %s (%s)" % (dungeon["subject"], dungeon["name"]), ""]
    lines.append("Derived from `%s`. This is the contract: content must cover"
                 " everything listed here." % dungeon["source"])
    lines.append("")
    lines.append("| Floor | Name | Concepts | Exercism exercises |")
    lines.append("|---|---|---|---|")
    for f in dungeon["floors"]:
        lines.append("| %d | %s | %s | %s |" % (
            f["n"], f["name"], ", ".join("`%s`" % c for c in f["concepts"]),
            ", ".join(f["exercises"])))
    covered = set()
    for f in dungeon["floors"]:
        covered.update(f["concepts"])
    missing = [c for c in conf_concepts if c not in covered]
    lines += ["", "## Declared in the track but not yet on a floor", ""]
    lines += ["- `%s`" % c for c in missing] or ["- none"]
    block = BEGIN + "\n" + "\n".join(lines) + "\n" + END + "\n"

    # Authored floors live outside the generated block and must survive a
    # re-import; only the imported table is regenerated.
    if os.path.exists(path):
        old_text = io.open(path, encoding="utf-8").read()
        if BEGIN in old_text and END in old_text:
            head = old_text.split(BEGIN)[0]
            tail = old_text.split(END, 1)[1]
            io.open(path, "w", encoding="utf-8").write(head + block + tail)
            return
    io.open(path, "w", encoding="utf-8").write(block)


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("track", help="Exercism track slug, e.g. python")
    ap.add_argument("--per-floor", type=int, default=3,
                    help="concept exercises per floor when --floors is not given")
    ap.add_argument("--floors", type=int, default=None,
                    help="target floor count; exercises are spread evenly over it")
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--dry-run", action="store_true",
                    help="print the summary without writing files")
    args = ap.parse_args()

    report = {"exercises_declared": 0, "tasks_parsed": 0, "tasks_with_cases": 0,
              "cases": 0, "unparsed_asserts": 0, "sections_trimmed": 0,
              "missing_intro": [], "missing_tests": [], "todo_tests": [],
              "cycles": [], "exercises_beyond_10_floors": 0}

    f = Fetcher(args.track, use_cache=not args.no_cache)
    print("importing exercism/%s ..." % args.track)
    dungeon = build_dungeon(args.track, f, args.per_floor, report, args.floors)

    conf = json.loads(f.get("config.json"))
    all_concepts = [c["slug"] for c in conf.get("concepts", [])]

    out_json = os.path.join(ROOT, "content", "%s.json" % args.track)
    out_syl = os.path.join(ROOT, "syllabi", "%s.md" % args.track)

    if not args.dry_run:
        os.makedirs(os.path.dirname(out_json), exist_ok=True)
        os.makedirs(os.path.dirname(out_syl), exist_ok=True)
        json.dump(dungeon, io.open(out_json, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
        write_syllabus(dungeon, all_concepts, out_syl)

    # ------------------------------------------------------- summary
    n_prac = sum(len(fl["practice"]) for fl in dungeon["floors"])
    n_sec = sum(len(fl["lesson"]["sections"]) for fl in dungeon["floors"])
    n_exam = sum(len(fl["exam"]) for fl in dungeon["floors"])
    todos = sum(len(fl["_todo"]) for fl in dungeon["floors"])

    print("")
    print("=" * 66)
    print("  IMPORT SUMMARY - exercism/%s" % args.track)
    print("=" * 66)
    print("  network: %d fetched, %d from cache%s" % (
        f.misses, f.hits, ", %d failed" % len(f.failures) if f.failures else ""))
    print("  concept exercises in syllabus : %d" % report["exercises_declared"])
    print("  floors built                  : %d  (exercises per floor: %s)"
          % (len(dungeon["floors"]),
             ", ".join(str(x) for x in report.get("floor_sizes", []))))
    print("")
    print("  IMPORTED")
    print("    lesson sections             : %d" % n_sec)
    print("    practice challenges         : %d" % n_prac)
    print("    test cases                  : %d" % report["cases"])
    print("    test methods read           : %d of %d had usable cases"
          % (report["tasks_with_cases"], report["tasks_parsed"]))
    print("")
    print("  NEEDS MANUAL WORK")
    print("    exam questions              : %d imported, %d floors need 8-12 each"
          % (n_exam, len(dungeon["floors"])))
    print("    asserts not parsed          : %d (left as TODO, never guessed)"
          % report["unparsed_asserts"])
    print("    floors under 6 practice     : %d"
          % sum(1 for fl in dungeon["floors"] if len(fl["practice"]) < 6))
    print("    floors under 2 sections     : %d"
          % sum(1 for fl in dungeon["floors"] if len(fl["lesson"]["sections"]) < 2))
    real_prompts = sum(1 for fl in dungeon["floors"] for c in fl["practice"]
                       if c.get("_promptImported"))
    print("    prompts still TODO          : %d of %d" % (n_prac - real_prompts, n_prac))
    print("    explain fields to write     : %d" % n_prac)
    print("    total _todo entries         : %d" % todos)
    if report["missing_intro"]:
        print("    no introduction.md          : %s" % ", ".join(report["missing_intro"]))
    if report["missing_tests"]:
        print("    no test file                : %s" % ", ".join(report["missing_tests"]))
    if report["cycles"]:
        print("    prerequisite cycles         : %s" % "; ".join(report["cycles"]))
    if f.failures:
        print("    fetch failures              : %s" % "; ".join(f.failures[:5]))
    print("")
    print("  PER FLOOR")
    for fl in dungeon["floors"]:
        print("    %2d. %-26s %d sections  %2d practice  %2d cases  %s"
              % (fl["n"], fl["name"], len(fl["lesson"]["sections"]),
                 len(fl["practice"]),
                 sum(len(p["tests"]) for p in fl["practice"]),
                 ",".join(fl["concepts"])[:34]))
    print("")
    if args.dry_run:
        print("  (dry run - nothing written)")
    else:
        print("  wrote %s" % os.path.relpath(out_json, ROOT))
        print("  wrote %s" % os.path.relpath(out_syl, ROOT))
    print("  next: python scripts/validate_content.py %s" % args.track)
    print("=" * 66)


if __name__ == "__main__":
    main()
