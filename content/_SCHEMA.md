# Grimoire Content Schema — v2

The engine knows nothing about any subject. It reads `content/index.json` for
the catalogue and `content/{id}.json` for a curriculum. Adding a course means
adding a JSON file — the engine never changes.

Copy `_TEMPLATE.json` to start. Validate with:

```bash
python scripts/validate_content.py {id}
python scripts/validate_content.py --strict   # warnings fail too
```

**Content that fails validation does not ship.**

---

## 1. `content/index.json` — the catalogue

Drives the dungeon map. Three books, and the dungeons that fill them.

```json
{
  "version": 2,
  "books": [
    { "id": "codex", "numeral": "I", "name": "The Codex",
      "subtitle": "Languages", "tint": "#3E5A78", "blurb": "Every language a spell." }
  ],
  "dungeons": [
    {
      "id": "python",
      "name": "Python",
      "books": ["codex"],
      "sigil": "🐍",
      "floors": 10,
      "status": "scaffold",
      "source": "exercism/python",
      "exercismTrack": "python",
      "requires": [],
      "unlocks": ["data-structures", "machine-learning"],
      "mentions": []
    }
  ]
}
```

### Book

| field | required | meaning |
|---|---|---|
| `id` | yes | `codex` \| `arcana` \| `foundations` |
| `numeral` | yes | Roman numeral shown above the name |
| `name` | yes | e.g. "The Codex" |
| `subtitle` | yes | e.g. "Languages" |
| `tint` | yes | Hex. Applied as a low-alpha wash, never as a text colour |
| `blurb` | no | One line under the tab row |

### Dungeon entry

| field | required | meaning |
|---|---|---|
| `id` | yes | Filename stem: `"python"` → `content/python.json`. Lowercase, no spaces |
| `name` | yes | Display name |
| `books` | yes | Array. A dungeon may appear in more than one book — `discrete-maths` is in both The Arcana and The Foundations and is **one** dungeon, not two |
| `sigil` | no | Single glyph on the node |
| `floors` | yes | Integer, or `null` when the syllabus has not been derived yet. **Never hardcode 10** — floor count follows the syllabus |
| `status` | yes | `available` = playable · `scaffold` = imported, not yet authored · `planned` = catalogued only |
| `source` | no | Attribution string; see `attribution.md` |
| `requires` | no | Dungeons you should finish first. **Soft gate** — a warning, not a lock |
| `requiresAny` | no | Satisfied by **any one** of the listed dungeons |
| `unlocks` | no | Completing this highlights these |
| `mentions` | no | Dungeons whose concepts appear inside this one's lessons; these become the inline concept links |

---

## 2. `content/{id}.json` — a dungeon

```json
{
  "id": "python",
  "name": "The Serpent's Descent",
  "subject": "Python",
  "category": "language",
  "sigil": "🐍",
  "unlock": null,
  "source": "exercism/python (MIT)",
  "lang": "python",
  "runtime": "pyodide",
  "floors": [ Floor, ... ]
}
```

`category` is `language` or `theory`. Top-level `lang` and `runtime` are the
defaults for every section and challenge in the file; either may be overridden
per section or per challenge.

### Floor

```json
{
  "n": 1,
  "name": "Threshold of Syntax",
  "concepts": ["basics", "bools", "numbers"],
  "lesson":   { "sections": [ Section, ... ] },
  "practice": [ Challenge, ... ],
  "exam":     [ Challenge, ... ]
}
```

| field | rule |
|---|---|
| `n` | 1-based, must equal its position in the array |
| `name` | Floor title |
| `concepts` | Every concept this floor teaches. **Each needs ≥2 practice challenges tagged to it** |
| `lesson` | 2–4 sections, each with a code example and a checkpoint |
| `practice` | 6–10 challenges |
| `exam` | 8–12 challenges |

All three phases are required. Gating is enforced by the engine and is not
configurable:

**lesson** (every checkpoint passed) → **practice** (every challenge passed) →
**exam** (≥80%) → next floor unlocks.

The last floor of a dungeon is the **boss floor** and must contain a `project`
challenge.

---

## 3. Lesson section

A section is a loop, not a page: explain, let them run it, then make them prove
it. The learner cannot reach the next section until this one's checkpoint passes.

```json
{
  "title": "Variables and Assignment",
  "body": "Programmers bind **names** to values with the `=` operator...",
  "code": "x = 42\nprint(x)",
  "lang": "python",
  "annotations": [
    { "line": 1, "text": "x now refers to the integer 42." },
    { "line": 2, "text": "print writes the value, not the name." }
  ],
  "checkpoint": {
    "prompt": "Assign the value 100 to a variable called `score` and print it.",
    "starterCode": "# your code here",
    "tests": [ { "input": "", "expected": "100" } ],
    "hint1": "Use the = operator to assign a value.",
    "hint2": "Variable names go on the left: score = ...",
    "hint3": "print(score) will output the value."
  }
}
```

| field | required | rule |
|---|---|---|
| `title` | yes | One idea per section |
| `body` | yes | **3–5 sentences.** Markdown subset below. If it needs more, it is two sections |
| `code` | yes | Must run standalone and produce useful output. Rendered into a live editor with Run and Experiment |
| `lang` | no | Defaults to the dungeon's `lang` |
| `annotations` | no | 1-based line numbers into `code`. Annotate the lines that carry the idea, not every line |
| `checkpoint` | yes | See below |

**2–4 sections per lesson.** One idea each.

### Body markdown subset

Only these are rendered. No headings, links, images, tables or raw HTML.

- `**bold**`
- `` `inline code` ``
- blank-line paragraphs
- `- ` bullet lists
- `{{link:dungeon-id}}` — inline concept link into another dungeon

`{{link:...}}` is authored now and reserved for the knowledge-graph phase.
Until that ships the engine renders it as the dungeon's plain name, so it is
never shown raw to a learner. The target id must exist in `index.json`, and the
dungeon should also list it in `mentions`.

### Checkpoint

A single inline challenge, directly about what the section just showed. It is
the gate to the next section.

| field | required | rule |
|---|---|---|
| `prompt` | yes | One task. Simple — it tests the idea just shown, nothing more |
| `starterCode` | yes | Sets the shape, never the answer. May be a comment |
| `tests` | yes | Same format as a challenge's `tests` (§5) |
| `hint1` | no | Revealed on the first "Stuck?" |
| `hint2` | no | Second press |
| `hint3` | no | Third press. Nearest thing to the answer without being it |

Hints cost **no mana** — a lesson is for learning, not gatekeeping. Whether a
hint was used is recorded: a checkpoint passed with hints is flagged for the
spaced-repetition queue.

A checkpoint has no `id`, `xp`, `type` or `tags`. It is not a graded challenge;
it is the price of admission to the next section.

---

## 4. Challenges

Used in `practice` and `exam`. Every challenge needs an `id` unique within its
floor, a `type`, a `prompt`, an `explain`, `xp` and `tags`.

```json
{
  "id": "py-1-p-01",
  "type": "code",
  "fn": "bake_time_remaining",
  "prompt": "Complete `bake_time_remaining()` so it returns the minutes left.",
  "starterCode": "def bake_time_remaining(elapsed):\n    pass",
  "tests": [
    { "input": "1", "expected": 39 },
    { "input": "30", "expected": 10 }
  ],
  "explain": "Subtracting from the constant keeps the rule in one place...",
  "hint": "EXPECTED_BAKE_TIME is already defined for you.",
  "xp": 15,
  "tags": ["basics"]
}
```

| field | required | meaning |
|---|---|---|
| `id` | yes | Unique within the floor. Convention: `{lang}-{floor}-{p\|e}-{nn}` |
| `type` | yes | See the table below |
| `prompt` | yes | The task. Same markdown subset as `body` |
| `explain` | yes | **Shown after answering, right or wrong. This is the actual teaching moment** — say why, not just what |
| `xp` | yes | Positive integer. `code`, `debug` and `project` are worth most |
| `tags` | yes | Concept slugs. Coverage is measured from these |
| `hint` | no | Costs mana to reveal in practice and exam, unlike a lesson checkpoint |
| `fn` | for `code`/`debug` | The function the tests call |
| `starterCode` | for `code`/`debug` | Opens in the editor |
| `tests` | for `code`/`debug`/`project` | See §5 |
| `answer` | for `output`/`mcq`/`multi` | Expected output string, or choice index |
| `choices` | for `mcq`/`multi` | Array of options |

### Types

| type | what the learner does | notes |
|---|---|---|
| `code` | writes code, executed against test cases | the default |
| `debug` | fixes broken `starterCode`, tests must pass | |
| `output` | types what the code prints | free text, whitespace-normalised |
| `fill` | fills blanks in code | |
| `order` | drags fragments into sequence | |
| `mcq` | one correct of four | **exams only** |
| `multi` | several correct | **exams only** |
| `explain` | free text, graded against a keyword rubric | |
| `project` | full project spec with acceptance tests | **boss floor only** |

MCQ is for things code cannot test — a complexity class, a judgement call,
"which of these is invalid". Never as the primary way to learn or practise.

---

## 5. Tests

A challenge passes only when **every** test passes.

```json
{ "input": "1, 2", "expected": 39 }
```

| field | meaning |
|---|---|
| `input` | The **arguments** to `fn`, as source text. `""` for a function taking none. For a whole-program challenge with no `fn`, this is stdin |
| `expected` | A real JSON value, not a string of source code |

**How comparison works.** The result is serialised (`json.dumps` in Python,
`JSON.stringify` in JavaScript) and compared **structurally**, not as text — the
serialised forms are parsed back and compared as values. So `30` matches `30.0`,
and Python's `[1, 9]` matches JavaScript's `[1,9]`. A value that cannot be
serialised falls back to a string comparison against its `repr()`.

| target value | write `expected` as |
|---|---|
| integer `5` | `5` |
| float `13.5` | `13.5` |
| string `"hi"` | `"hi"` |
| boolean | `true` / `false` |
| `None` / `null` | `null` |
| list `[1, 2]` | `[1, 2]` |
| Python tuple `(1, 9)` | `[1, 9]` — tuples serialise as arrays |

On failure the learner sees the failing input and a line-by-line diff of
expected against actual.

### Carried-forward context

Imported exercises often split one file across several tasks, where a later
task uses something an earlier one defined. The practice runner therefore
**accumulates each passing solution into a running context** and prepends it
before executing the next challenge from the same source exercise. Multi-task
exercises are not collapsed into one giant challenge.

This means a challenge may rely on a function or constant defined by an earlier
challenge **in the same floor, from the same `source` exercise**. It may never
rely on anything from another floor.

---

## 6. Languages and runtimes

| `runtime` | how it executes | notes |
|---|---|---|
| `pyodide` | CPython on WebAssembly, in a Web Worker | loaded lazily on first use; one-time "loading runtime" state |
| `worker` | sandboxed Web Worker | JavaScript/TypeScript. 2 s hard timeout, no network, no DOM |
| `piston` | `https://emkc.org/api/v2/piston/execute` | everything else. Free, no key, 70+ languages |

`lang` for Piston follows Piston's own naming: `c`, `cpp`, `csharp`, `java`,
`rust`, `go`, `swift`, `kotlin`, `ruby`, `php`, `r`, `scala`, `haskell`, `lua`,
`dart`, `zig`, `typescript`, `bash`.

**If execution is unavailable** — Pyodide fails to load, Piston is unreachable,
the learner is offline — the engine shows the expected output, blocks
progression, and offers no self-assessment override. A floor is completed by
running code or not at all.

---

## 7. Authoring rules

1. **Teach, then test.** Every practice challenge is solvable using only what
   that floor's lesson taught. No forward references.
2. **Deterministic.** No randomness, no clocks, no network. Same input, same
   output, every run.
3. **Test behaviour, not source.** Never assert on how code is written — only
   on what it returns or prints.
4. **Prompts state the exact expected output.** If the test wants
   `Hello, Grimoire!`, the prompt shows that string verbatim.
5. **Cover the edges.** 3–4 tests per challenge including at least one boundary
   case — zero, empty, negative.
6. **Starter code sets the shape**, never the answer.
7. **Escalate across a floor.** The first practice challenge is near-trivial;
   the last combines every idea on the floor.
8. **`explain` is not optional and is not a restatement.** "Returns the sum" is
   useless. Say why this approach and not the obvious wrong one.

---

## 8. What the validator checks

`scripts/validate_content.py` enforces:

- every floor has a lesson with ≥2 sections, each carrying a code example
- every floor has ≥6 practice challenges and ≥8 exam questions
- every concept in `concepts` has ≥2 practice challenges tagged to it
- every challenge has `explain`, positive `xp`, a known `type`, a unique id
- `code`/`debug`/`project` have non-empty `tests`; every test has `expected`
- `mcq` has ≥2 choices and an in-range `answer`
- `mcq`/`multi` do not appear in a practice phase
- the boss floor has a `project` challenge
- floor `n` matches its array position

Warnings (failures under `--strict`): a TODO `explain`, missing `tags`,
missing `starterCode`, missing `fn`, a lesson over 4 sections, an exam over 12.

### Known gaps in the validator

Two things this document specifies that the validator does not yet enforce.
Do not rely on it to catch either.

1. **`checkpoint` on lesson sections** is required here but unchecked. The check
   lands with the interactive checkpoint work in step 2c.
2. **The boss floor is identified as `n == 10`** in code, but floor count now
   follows the syllabus — a nine-floor dungeon's boss is floor 9. The rule is
   *last floor*, and the validator will be corrected to match when the boss
   floor is implemented. Until then a `project` challenge on any floor other
   than 10 raises a warning it should not.
