# GRIMOIRE Content Schema

The engine knows nothing about any subject. It reads `content/index.json` for the
catalogue and `content/{id}.json` for a dungeon's curriculum. Adding a course means
adding a JSON file — no engine changes, ever.

Copy `_TEMPLATE.json` to start.

---

## 1. `content/index.json`

The dungeon catalogue shown on the map.

```json
{
  "version": 1,
  "dungeons": [
    {
      "id": "python",
      "name": "Python",
      "category": "Languages",
      "lang": "python",
      "runtime": "pyodide",
      "totalFloors": 10,
      "authoredFloors": 3,
      "status": "available",
      "blurb": "One line shown on the map card."
    }
  ]
}
```

| field | required | meaning |
|---|---|---|
| `id` | yes | Filename stem. `"python"` → `content/python.json`. Lowercase, no spaces. |
| `name` | yes | Display name. |
| `category` | yes | Map filter group: `Languages`, `Web`, `Theory`, `Systems`, `Specialisms`. |
| `lang` | yes | Execution language id (see §5). |
| `runtime` | yes | `pyodide` \| `worker` \| `piston` (see §5). |
| `totalFloors` | yes | Planned length of the course. |
| `authoredFloors` | no | How many floors actually exist. Defaults to the count in the dungeon file. |
| `status` | yes | `available` = playable. `planned` = greyed out on the map, not clickable. |
| `blurb` | no | One sentence on the card. |

A dungeon must not be `available` until its content file exists and every floor
has all three phases.

---

## 2. `content/{id}.json` — a dungeon

```json
{
  "id": "python",
  "name": "Python",
  "lang": "python",
  "runtime": "pyodide",
  "totalFloors": 10,
  "floors": [ Floor, Floor, ... ]
}
```

Top-level `lang` and `runtime` are the defaults for every challenge in the file.
Any section or challenge may override `lang` individually.

### Floor

```json
{
  "n": 1,
  "title": "Values, Variables, and Output",
  "goal": "One sentence: what the learner can do after this floor.",
  "lesson":   { ... },
  "practice": [ Challenge, ... ],
  "exam":     [ Challenge, ... ]
}
```

- `n` — floor number, 1-based, must match the array position.
- **All three phases are required.** A floor missing one will not load.
- Practice: **6–10** challenges. Exam: **8–12** challenges.

Gating is enforced by the engine and is not configurable per floor:
lesson → practice (all must pass) → exam (≥80% to unlock the next floor).

---

## 3. Lesson

```json
{
  "title": "The First Incantation",
  "intro": "Optional short paragraph above the first section.",
  "sections": [
    {
      "title": "Printing",
      "body": "Prose with **bold**, `code`, and\n\n- bullet lists",
      "code": "print(\"Hello\")",
      "lang": "python",
      "annotations": [
        { "line": 1, "text": "What this line does and why." }
      ]
    }
  ]
}
```

- **2–4 sections per lesson.** One idea per section. If you need a fifth, it is a
  second floor.
- `code` is rendered into a live editor with a Run button — the learner can edit
  and execute it in place. It must run standalone and produce useful output.
- `annotations` are keyed to 1-based line numbers of `code` and render beneath it.
  Annotate the lines that carry the idea, not every line.
- `body` supports a small Markdown subset only: `**bold**`, `` `code` ``,
  blank-line paragraphs, and `- ` bullets. No headings, links, or images.

---

## 4. Challenges

Every challenge needs a unique-within-its-phase `id` and a `kind`.
`prompt` supports the same Markdown subset as `body`.

### `kind: "code"` and `kind: "bugfix"`

Identical to the engine; `bugfix` only changes the label shown to the learner
(and by convention ships broken `starter` code).

```json
{
  "id": "p1",
  "kind": "code",
  "prompt": "Write a function `add(a, b)` that returns their sum.",
  "lang": "python",
  "starter": "def add(a, b):\n    ",
  "tests": [ Test, ... ],
  "hint": "Shown on request. Never gives the whole answer.",
  "solution": "def add(a, b):\n    return a + b"
}
```

`solution` is revealed only after the learner passes, or after they give up on an
exam question. It is never used for grading.

### `kind: "predict"` — output prediction

```json
{
  "id": "e3",
  "kind": "predict",
  "prompt": "What does this program print?",
  "code": "x = 2\nprint(x * 3)",
  "lang": "python",
  "expect": "6",
  "explain": "Shown after answering."
}
```

The learner types the output they expect. **The engine actually executes `code`
and compares the learner's answer to the real output**, so `expect` is a
correctness check on your authoring — if it disagrees with the real run, the
engine reports a content error rather than failing the learner.

Comparison ignores trailing whitespace on each line and leading/trailing blank
lines. Everything else must match exactly.

### `kind: "mcq"` — multiple choice

```json
{
  "id": "e1",
  "kind": "mcq",
  "prompt": "What is the type of `3.0`?",
  "code": "optional snippet shown above the choices",
  "choices": ["int", "float", "str", "bool"],
  "answer": 1,
  "explain": "Shown after answering."
}
```

`answer` is a 0-based index. Use MCQ only where writing code cannot test the
idea — vocabulary, judgement calls, "which of these is invalid". Never use it as
a shortcut for something the learner should have to type.

---

## 5. Tests

A challenge passes only when **every** test passes. There are two kinds, and one
challenge may mix them.

### `kind: "expr"` — check a value

Runs the learner's code, then evaluates an expression against it.

```json
{ "kind": "expr", "call": "add(2, 3)", "expect": 5, "label": "add(2, 3) → 5" }
```

- `call` — any expression in the target language, evaluated after the learner's
  code. Works for function calls *and* bare variable names, so it tests floors
  that have not reached functions yet: `{ "call": "total", "expect": 55 }`.
- `expect` — a real JSON value, not a string of source code.
- `label` — optional; shown in the results list. Auto-generated if omitted.

**How comparison works.** The result is serialised with `json.dumps` (Python) or
`JSON.stringify` (JavaScript) and compared to the serialised `expect`. This makes
one JSON value mean the same thing in every language:

| target value | write `expect` as |
|---|---|
| integer `5` | `5` |
| float `13.5` | `13.5` |
| string `"hi"` | `"hi"` |
| boolean | `true` / `false` |
| `None` / `null` | `null` |
| list `[1, 2]` | `[1, 2]` |
| **Python tuple `(1, 9)`** | `[1, 9]` — tuples serialise as arrays |
| anything not JSON-serialisable | its `repr()` as a string |

Comparison is **structural, not textual**: the serialised forms are parsed back
and compared as values. `30` and `30.0` match, and Python's `[1, 9]` matches
JavaScript's `[1,9]`. Only a value that cannot be parsed as JSON falls back to a
string comparison.

`expr` tests require a language the engine can wrap in a harness: **`python` and
`javascript` only**. Piston-backed languages must use `stdout` tests.

### `kind: "stdout"` — check what the program prints

```json
{ "kind": "stdout", "stdin": ["Mira", "17"], "expect": "Mira will be 18 next year.", "label": "input \"Mira\", \"17\"" }
```

- `stdin` — optional array of lines fed to `input()` / stdin, one array element
  per line read.
- `expect` — the full expected output. Trailing whitespace per line and
  leading/trailing blank lines are ignored; everything else must match exactly.
- On failure the learner sees a line-by-line diff of expected vs actual.

Works in every language and every runtime.

---

## 6. Languages and runtimes

| `runtime` | how it executes | `expr` tests | notes |
|---|---|---|---|
| `pyodide` | CPython compiled to WebAssembly, in a Web Worker | yes | First run downloads ~10 MB, then cached. |
| `worker` | Sandboxed Web Worker, 2 s hard timeout | yes | JavaScript only. No network, no DOM. |
| `piston` | `https://emkc.org/api/v2/piston/execute` | no | Needs a connection; public API is rate-limited. |

`lang` values for Piston follow Piston's own naming: `c`, `cpp`, `csharp`,
`java`, `rust`, `go`, `swift`, `kotlin`, `ruby`, `php`, `r`, `scala`, `haskell`,
`lua`, `dart`, `zig`, `typescript`, `octave`.

**If execution is unavailable** — Pyodide fails to load, Piston is unreachable,
the learner is offline — the engine shows the expected output, blocks
progression, and offers no self-assessment override. A floor is completed by
running code or not at all.

---

## 7. Authoring rules

1. **Teach, then test.** Every practice challenge must be solvable using only
   what the lesson on that same floor taught. No forward references.
2. **Deterministic.** No randomness, no clocks, no network. Same input, same
   output, every run.
3. **Test behaviour, not source.** Never assert on how the code is written —
   only on what it returns or prints.
4. **Prompts state the exact expected output.** If the test wants
   `Hello, GRIMOIRE!`, the prompt shows that string verbatim, punctuation
   included.
5. **Cover the edges.** Give each challenge 3–4 tests including at least one
   boundary case — zero, empty, negative.
6. **Starter code sets the shape.** Give the signature or the variable to fill,
   never the answer.
7. **Escalate across a floor.** Practice 1 should be near-trivial; the last
   should combine every idea on the floor.

## 8. Validating

```
python tools/validate_content.py
```

Checks structure, phase counts, id uniqueness, floor numbering, annotation line
bounds, and `answer` bounds for every content file. Run it before committing —
malformed content is the one thing that can break the engine.
