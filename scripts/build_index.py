# Generates content/index.json - the dungeon catalogue and knowledge graph.
import json, io

import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")
OUT = os.path.join(CONTENT, "index.json")

# Three wings of one library, not three volumes of a series. All open from
# day one; the knowledge graph, not the order here, decides what you can do.
BOOKS = [
    {"id": "spellbook", "name": "The Spellbook", "subtitle": "Languages",
     "tint": "#3E5A78", "blurb": "Master the languages of creation.",
     "layout": "grid"},
    {"id": "arcana", "name": "The Arcana", "subtitle": "CS Theory",
     "tint": "#5B4478", "blurb": "Understand the systems beneath the world.",
     "layout": "path"},
    {"id": "athenaeum", "name": "The Athenaeum", "subtitle": "Mathematics",
     "tint": "#3D6B4F", "blurb": "Learn the mathematics that governs everything.",
     "layout": "path"},
]

LOGO_BASE = "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/"
LOGOS = {
    "python": "python/python-original.svg",
    "javascript": "javascript/javascript-original.svg",
    "typescript": "typescript/typescript-original.svg",
    "c": "c/c-original.svg",
    "cpp": "cplusplus/cplusplus-original.svg",
    "rust": "rust/rust-original.svg",
    "go": "go/go-original.svg",
    "java": "java/java-original.svg",
    "csharp": "csharp/csharp-original.svg",
    "ruby": "ruby/ruby-original.svg",
    "php": "php/php-original.svg",
    "swift": "swift/swift-original.svg",
    "kotlin": "kotlin/kotlin-original.svg",
    "bash": "bash/bash-original.svg",
    "haskell": "haskell/haskell-original.svg",
    "lua": "lua/lua-original.svg",
    "r": "r/r-original.svg",
    "html-css": "html5/html5-original.svg",
    "scala": "scala/scala-original.svg",
    "elixir": "elixir/elixir-original.svg",
}
TEXT_SIGILS = {
    "assembly-x86-64": "ASM",
    "prolog": "\u2200x",
    "zig": "\u26A1",
    "sql": "\u25A4",
}

LANGUAGES = [
    ("python", "Python", "\U0001F40D", "python"),
    ("javascript", "JavaScript", "\u26A1", "javascript"),
    ("typescript", "TypeScript", "\u25E8", "typescript"),
    ("c", "C", "\u2699", "c"),
    ("cpp", "C++", "\u29C9", "cpp"),
    ("rust", "Rust", "\u2692", "rust"),
    ("go", "Go", "\u25C8", "go"),
    ("java", "Java", "\u2615", "java"),
    ("csharp", "C#", "\u266F", "csharp"),
    ("ruby", "Ruby", "\u25C6", "ruby"),
    ("php", "PHP", "\u25B2", "php"),
    ("swift", "Swift", "\u25B6", "swift"),
    ("kotlin", "Kotlin", "\u25E7", "kotlin"),
    ("sql", "SQL", "\u2338", None),
    ("bash", "Bash", "\u232B", "bash"),
    ("haskell", "Haskell", "\u03BB", "haskell"),
    ("lua", "Lua", "\u25D0", "lua"),
    ("r", "R", "\u2211", "r"),
    ("assembly-x86-64", "Assembly x86-64", "\u2318", None),
    ("html-css", "HTML/CSS", "\u25A7", None),
    ("prolog", "Prolog", "\u2234", "prolog"),
    ("scala", "Scala", "\u29C7", "scala"),
    ("elixir", "Elixir", "\u2697", "elixir"),
    ("zig", "Zig", "\u26A1", "zig"),
]

# ---------------------------------------------------------------------------
# Dependency-ordered books. Order is the learning path, top to bottom, and
# `requires` is the real gate.
#
# A requirement is one of:
#   {"dungeon": id}                       that dungeon completed
#   {"dungeon": id, "minFloor": n}        reached floor n of it
#   {"anyOf": [id, ...]}                  any one of them completed
#   {"anyFromBook": book, "minFloor": n}  any dungeon in that book at floor n
# ---------------------------------------------------------------------------
def D(i):
    return {"dungeon": i}

ARCANA = [
    ("dev-tooling", "Dev Tooling", "\u2692", []),
    ("data-structures", "Data Structures", "\u2263",
     [{"anyFromBook": "spellbook", "minFloor": 3}]),
    ("algorithms", "Algorithms & Complexity", "\u221E",
     [D("data-structures"), D("discrete-maths")]),
    ("databases", "Databases", "\u26C1", [D("data-structures")]),
    ("computer-architecture", "Computer Architecture", "\u25A6", [D("c")]),
    ("software-architecture", "Software Architecture", "\u25F1", [D("algorithms")]),
    ("operating-systems", "Operating Systems", "\u25F4",
     [D("computer-architecture"), D("c")]),
    ("testing-debugging", "Testing & Debugging", "\u2713",
     [{"anyFromBook": "spellbook", "minFloor": 5}]),
    ("networking", "Networking", "\u2317", [D("operating-systems")]),
    # Not in the supplied ordering; placed here because it is the real
    # prerequisite for Compilers. Flagged in the build output.
    ("automata-computability", "Automata & Computability", "\u21BB",
     [D("discrete-maths")]),
    ("compilers", "Compilers", "\u27F6",
     [D("algorithms"), D("computer-architecture"), D("discrete-maths")]),
    ("concurrency", "Concurrency", "\u21C4", [D("operating-systems")]),
    ("distributed-systems", "Distributed Systems", "\u2725",
     [D("networking"), D("concurrency")]),
    ("type-systems", "Type Systems", "\u22A6",
     [D("compilers"), D("discrete-maths")]),
    ("cryptography", "Cryptography & Security", "\u26BF",
     [D("number-theory"), D("networking")]),
    ("machine-learning", "Machine Learning Foundations", "\u2735",
     [D("linear-algebra"), D("probability-stats"), D("python")]),
    ("ai-foundations", "AI Foundations", "\u273B",
     [D("machine-learning"), D("algorithms")]),
    ("computer-graphics", "Computer Graphics", "\u25E9",
     [D("linear-algebra"), {"anyOf": ["c", "cpp"]}]),
]

FOUNDATIONS = [
    ("precalculus", "Pre-calculus & Mathematical Thinking", "\u222B", []),
    ("discrete-maths", "Discrete Mathematics", "\u2200", [D("precalculus")]),
    ("calculus-1", "Calculus I", "\u222B", [D("precalculus")]),
    ("logic-proofs", "Logic & Proof Techniques", "\u22A2", [D("discrete-maths")]),
    ("calculus-2", "Calculus II", "\u222C", [D("calculus-1")]),
    # Not in the supplied ordering; kept with its real prerequisite.
    ("multivariable-calculus", "Multivariable Calculus", "\u2207", [D("calculus-2")]),
    ("linear-algebra", "Linear Algebra", "\u2211",
     [D("calculus-1"), D("discrete-maths")]),
    ("probability-stats", "Probability & Statistics", "\u03C3", [D("calculus-2")]),
    ("number-theory", "Number Theory", "\u2115", [D("discrete-maths")]),
    ("graph-theory", "Graph Theory", "\u25C7",
     [D("discrete-maths"), D("number-theory")]),
    ("information-theory", "Information Theory", "\u211D",
     [D("probability-stats"), D("graph-theory")]),
    ("numerical-methods", "Numerical Methods", "\u2248",
     [D("calculus-2"), D("linear-algebra")]),
]

MENTIONS = {
    "compilers": ["automata-computability", "type-systems"],
    "machine-learning": ["algorithms"],
    "computer-graphics": ["calculus-1"],
    "type-systems": ["haskell", "typescript"],
    "databases": ["sql", "algorithms"],
    "cryptography": ["discrete-maths"],
}

# Floor count, discipline and status are DISCOVERED from the content files the
# importers wrote - never hand-maintained here.
def discover():
    found = {}
    if not os.path.isdir(CONTENT):
        return found
    for fn in sorted(os.listdir(CONTENT)):
        if not fn.endswith(".json") or fn.startswith("_") or fn == "index.json":
            continue
        try:
            d = json.load(io.open(os.path.join(CONTENT, fn), encoding="utf-8"))
        except Exception:
            continue
        fl = d.get("floors") or []
        sections = sum(len((f.get("lesson") or {}).get("sections", [])) for f in fl)
        # a challenge is an object carrying a prompt or a type - counting every
        # list would count the importer's `exercises` provenance list too
        chals = 0
        for f in fl:
            for k, v in f.items():
                if k in ("concepts", "sequence", "_todo", "exercises"):
                    continue
                if isinstance(v, list):
                    chals += sum(1 for x in v
                                 if isinstance(x, dict) and ("prompt" in x or "type" in x))
        found[d.get("id", fn[:-5])] = {
            "floors": len(fl) or None,
            "disciplineType": d.get("disciplineType"),
            "sections": sections, "challenges": chals,
            "status": "available" if chals else ("scaffold" if sections else "planned"),
        }
    return found

FOUND = discover()
FLOORS = {k: v["floors"] for k, v in FOUND.items() if v["floors"]}

dungeons = []

for i, (did, name, sigil, track) in enumerate(LANGUAGES):
    e = {
        "id": did, "name": name, "books": ["spellbook"], "order": i + 1,
        "sigil": TEXT_SIGILS.get(did, sigil),
        "floors": FLOORS.get(did),
        "status": FOUND.get(did, {}).get("status", "planned"),
        "disciplineType": FOUND.get(did, {}).get("disciplineType") or "language",
        "sections": FOUND.get(did, {}).get("sections", 0),
        "challenges": FOUND.get(did, {}).get("challenges", 0),
        "source": ("exercism/%s" % track) if track else None,
        "exercismTrack": track,
        "requires": [], "unlocks": [], "mentions": [],
    }
    if did in LOGOS:
        e["logo"] = LOGOS[did]
    elif did in TEXT_SIGILS:
        e["sigilStyle"] = "text"
    dungeons.append(e)

for book, rows in (("arcana", ARCANA), ("athenaeum", FOUNDATIONS)):
    for i, (did, name, sigil, reqs) in enumerate(rows):
        dungeons.append({
            "id": did, "name": name, "books": [book], "order": i + 1,
            "sigil": sigil,
            "floors": FLOORS.get(did),
            "status": FOUND.get(did, {}).get("status", "planned"),
            "disciplineType": FOUND.get(did, {}).get("disciplineType")
                              or ("mathematics" if book == "athenaeum" else "theory"),
            "sections": FOUND.get(did, {}).get("sections", 0),
            "challenges": FOUND.get(did, {}).get("challenges", 0),
            "source": None, "exercismTrack": None,
            "requires": reqs, "unlocks": [], "mentions": MENTIONS.get(did, []),
        })

by_id = {d["id"]: d for d in dungeons}

# `unlocks` is the inverse of `requires` - derived, never hand-maintained.
for d in dungeons:
    for r in d["requires"]:
        for t in ([r["dungeon"]] if "dungeon" in r else r.get("anyOf", [])):
            if t in by_id and d["id"] not in by_id[t]["unlocks"]:
                by_id[t]["unlocks"].append(d["id"])

# every referenced dungeon must exist, and the graph must be acyclic
missing, edges = set(), {}
for d in dungeons:
    deps = []
    for r in d["requires"]:
        for t in ([r["dungeon"]] if "dungeon" in r else r.get("anyOf", [])):
            if t not in by_id:
                missing.add(t)
            else:
                deps.append(t)
    edges[d["id"]] = deps

state, cycles = {}, []

def visit(n, stack):
    if state.get(n) == 2:
        return
    if state.get(n) == 1:
        cycles.append(" -> ".join(stack + [n]))
        return
    state[n] = 1
    for m in edges.get(n, []):
        visit(m, stack + [n])
    state[n] = 2

for d in dungeons:
    visit(d["id"], [])

doc = {
    "version": 3,
    "platform": "GRIMOIRE",
    "tagline": "Every language a spell. Every concept a power.",
    "notes": {
        "floors": "null means the syllabus has not been derived yet. Floor count "
                  "follows the syllabus, never a fixed number.",
        "status": "available = playable | scaffold = imported, not yet authored | "
                  "planned = catalogued only",
        "order": "position in the book's learning path, 1-based.",
        "layout": "grid = flat, no ordering | path = dependency-ordered single "
                  "column with a connector rail.",
        "requires": "array of requirement objects. {dungeon} = completed; "
                    "{dungeon, minFloor} = reached that floor; {anyOf:[...]} = any "
                    "one completed; {anyFromBook, minFloor} = any dungeon in that "
                    "book at that floor.",
        "unlocks": "derived as the inverse of requires; do not hand-edit.",
        "logo": "path under logoBase to an official language logo (devicons, MIT). "
                "Absent means render the sigil instead.",
    },
    "pistonUrl": None,
    "_pistonUrl_note": "null uses the public Piston API, which has been "
                       "whitelist-only since 2026-02-15 and returns 401. Set "
                       "this to a self-hosted instance to enable the compiled "
                       "languages. Python and JavaScript run in the browser.",
    "logoBase": LOGO_BASE,
    "books": BOOKS,
    "dungeons": dungeons,
}

io.open(OUT, "w", encoding="utf-8").write(json.dumps(doc, ensure_ascii=False, indent=1))

print("content files discovered:", len(FOUND))
print("dungeons: %d" % len(dungeons))
for b in BOOKS:
    n = sum(1 for d in dungeons if b["id"] in d["books"])
    print("  %-16s %2d  (%s)" % (b["name"], n, b["layout"]))
print("available    :", sum(1 for d in dungeons if d["status"] == "available"))
print("scaffold     :", sum(1 for d in dungeons if d["status"] == "scaffold"))
print("planned      :", sum(1 for d in dungeons if d["status"] == "planned"))
print("with logos   :", sum(1 for d in dungeons if d.get("logo")))
print("with requires :", sum(1 for d in dungeons if d["requires"]))
print("always open (non-language):",
      [d["id"] for d in dungeons if not d["requires"] and d["books"][0] != "spellbook"])
print("unknown requirement targets:", sorted(missing) or "none")
print("cycles:", cycles or "none")
print("")
print("NOTE: automata-computability and multivariable-calculus were not in the")
print("      supplied orderings; both kept, placed by their real prerequisite.")
print("NOTE: discrete-maths and logic-proofs now sit only in The Athenaeum.")
