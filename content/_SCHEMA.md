# Grimoire Content Schema — v3

Grimoire measures **competence**, not completion. Everything in this schema
follows from that.

The engine knows nothing about any subject. It reads `content/index.json` for the
catalogue and `content/{id}.json` for a curriculum. Adding a course means adding a
JSON file — the engine never changes.

```bash
python scripts/validate_content.py {id}
python scripts/validate_content.py --strict     # warnings fail too
```

**Content that fails validation does not ship.**

---

## 0. The model in one page

### Three layers

Every concept must be carried through all three. They are ordered and
non-skippable.

| layer | what it means | what satisfies it |
|---|---|---|
| **Exposure** | you met the concept | lesson sections, worked examples, demos |
| **Retrieval** | you can produce it from memory | `mcq` `multi` `output` `fill` `order` |
| **Application** | you used it on something unseen | `code` `debug` `design` `project` `scenario` `diagnose` `complexity` `problem` `proof` |

**Reading a lesson satisfies Exposure and nothing else.** A dungeon is complete
only when all three layers are satisfied **for every concept in its syllabus** —
so the unit of record is the *concept × layer* pair, not the floor.

### Mastery — four components

| component | weight | computed from |
|---|---|---|
| Coverage | 25% | concepts addressed at **Application** layer |
| Retention | 25% | SM-2 performance from the review outcome log |
| Application depth | 30% | performance on Application-layer types |
| Boss performance | 20% | boss assessment results |

| score | rank |
|---|---|
| 0–39 | Novice |
| 40–59 | Apprentice |
| 60–74 | Journeyman |
| 75–89 | Adept |
| 90–100 | Master |

- **Dungeon complete** = Adept (75+) **and** boss cleared.
- **Dungeon mastered** = Master (90+) **and** 30 days of retention above 80%.

Note Application depth is the heaviest single component, and Coverage is itself
defined at the Application layer. There is no path to Adept by reading.

---

## 1. `content/index.json` — the catalogue

```json
{
  "version": 3,
  "pistonUrl": null,
  "logoBase": "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/",
  "books": [
    { "id": "spellbook", "name": "The Spellbook", "subtitle": "Languages",
      "tint": "#3E5A78", "blurb": "Master the languages of creation.",
      "layout": "grid" }
  ],
  "dungeons": [
    {
      "id": "python", "name": "Python", "books": ["spellbook"], "order": 1,
      "disciplineType": "language",
      "sigil": "🐍", "logo": "python/python-original.svg",
      "floors": 10, "status": "available",
      "requires": [], "unlocks": ["data-structures"], "mentions": []
    }
  ]
}
```

Wings are `spellbook` (languages), `arcana` (CS theory), `athenaeum`
(mathematics). All three are open from the start; the dependency graph, not the
wing, decides what you can enter.

| field | required | meaning |
|---|---|---|
| `id` | yes | Filename stem: `"python"` → `content/python.json` |
| `books` | yes | Wing ids. A dungeon may appear in more than one |
| `order` | yes | Position in that wing's learning path, 1-based |
| `disciplineType` | yes | See §2. Drives which assessment types are legal |
| `floors` | yes | Integer, or `null` when the syllabus is not derived yet. **Never hardcode 10** |
| `status` | yes | `available` · `scaffold` (imported, unauthored) · `planned` |
| `requires` | no | Requirement objects, see below. A **real** gate on Arcana/Athenaeum |
| `unlocks` | no | Derived as the inverse of `requires`; never hand-edited |
| `mentions` | no | Dungeons whose concepts appear in this one's lessons |

### Requirement objects

```json
{"dungeon": "c"}                             completed
{"dungeon": "c", "minFloor": 3}              reached that floor
{"anyOf": ["c", "cpp"]}                      any one completed
{"anyFromBook": "spellbook", "minFloor": 3}  any dungeon in that wing at that floor
```

---

## 2. `content/{id}.json` — a dungeon

```json
{
  "id": "python",
  "name": "The Serpent's Descent",
  "subject": "Python",
  "category": "language",
  "disciplineType": "language",
  "lang": "python",
  "runtime": "pyodide",
  "totalFloors": 10,
  "source": "exercism/python (MIT)",
  "relic": { "id": "serpents-tongue", "name": "The Serpent's Tongue",
             "effect": "hint-discount", "value": 1,
             "flavour": "Hints cost one less mana." },
  "floors": [ Floor, ... ]
}
```

`lang` and `runtime` are the execution defaults for every section and challenge
in the file. **A dungeon with no `lang` falls through to the remote runner** —
this is not optional.

### Discipline types

`disciplineType` determines which assessment types are legal and what a new
floor's default sequence looks like. The engine never special-cases a discipline;
it reads this field.

| discipline | valid types |
|---|---|
| `language` | `code` `debug` `design` `output` `fill` `explain` — **never `mcq` as a primary instrument** |
| `algorithms` | `code` `complexity` `proof` `trace` `explain` `order` |
| `mathematics` | `problem` `proof` `fill` `explain`, `mcq` for definitions only |
| `systems` | `trace` `diagnose` `scenario` `explain`, `code` for small components |
| `security` | `scenario` `diagnose` `explain`, `code` in a sandbox |
| `theory` | `proof` `problem` `fill` `trace` `explain` |
| `engineering` | `scenario` `design` `explain`, `mcq` sparingly |

### Relic

Awarded automatically on boss clear. `effect` is an engine-known identifier;
`value` parameterises it. Unknown effects are ignored rather than crashing.

---

## 3. Floor

```json
{
  "n": 3,
  "name": "The Bound Sigil",
  "concepts": ["lists", "list-methods"],
  "cognitiveLevel": "recall",
  "sequence": ["lesson", "guided-practice", "challenge-set", "exam"],
  "lesson": { "sections": [ Section, ... ] },
  "guided-practice": [ Challenge, ... ],
  "challenge-set":   [ Challenge, ... ],
  "exam":            [ Challenge, ... ]
}
```

### `sequence` — the floor's shape is content-declared

The engine renders whatever this array names, in order. There is no fixed
lesson → practice → exam structure any more.

```json
["lesson", "guided-coding", "debugging", "novel-challenge", "exam"]   // Python
["lesson", "worked-examples", "complexity-analysis", "novel-problems", "exam"]
["lesson", "worked-proof", "complete-proof", "unseen-proof", "exam"]  // proofs
["lesson", "packet-trace", "scenario", "diagnose-network", "exam"]    // networking
```

Rules:
- `"lesson"` maps to the `lesson` object. **Every other name maps to a key on the
  floor holding an array of challenges.** Every named stage must exist.
- The first stage should be `lesson`; the last should be `exam` (or, on a boss
  floor, a stage containing the `project`).
- Stage names are free text, rendered title-cased. Pick names that say what the
  learner does.

### `cognitiveLevel`

Difficulty rises across a dungeon on a **proportional** curve, so a 9-floor and a
14-floor dungeon are both coherent. The engine derives the expected band from
`floor.n / totalFloors`; the floor declares its own level and the validator
checks the two agree.

| band | position | level | what the engine does |
|---|---|---|---|
| Recognition | first 20% | `recognition` | more scaffolding, hints cheap |
| Recall | next 20% | `recall` | scaffolding reduced |
| Application | next 20% | `application` | normal |
| Transfer | next 20% | `transfer` | unfamiliar framing, debugging |
| Design | second-to-last floor | `design` | **no starter code, no hints** |
| Boss | last floor | `boss` | project harness, no hints |

---

## 4. Lesson section

```json
{
  "title": "Variables and Assignment",
  "body": "A **variable** is a name pointing at a value...",
  "code": "score = 42\nprint(score)",
  "lang": "python",
  "annotations": [ { "line": 1, "text": "score now refers to the integer 42." } ],
  "checkpoint": Challenge
}
```

- **3–5 sentences of body.** If it needs more, it is two sections.
- `code` renders into a live editor with Run. It must run standalone.
- `checkpoint` is an inline challenge that gates the next section. It is a full
  Challenge object, but its `id`, `xp` and `tags` may be omitted.
- **2–4 sections per lesson.**

### Body markdown subset

Only these render. No headings, tables, images or raw HTML.

- `**bold**`, `` `inline code` ``
- blank-line paragraphs, `- ` bullets
- `$inline math$` and `$$block math$$` — rendered with KaTeX
- `{{link:dungeon-id}}` — inline concept link

---

## 5. Challenge

```json
{
  "id": "py-3-c-01",
  "type": "code",
  "layer": "application",
  "prompt": "Write `add(a, b)` returning their sum.",
  "concepts": ["functions"],
  "tags": ["functions"],
  "xp": 50,
  "explain": "Returning rather than printing lets the caller use the result...",
  "hint": "return a + b",
  "fn": "add",
  "starterCode": "def add(a, b):\n    pass\n",
  "tests": [ { "input": "2, 3", "expected": 5 } ]
}
```

Universal fields: `id`, `type`, `layer`, `prompt`, `explain`, `xp`, `tags`.

- **`layer`** is declared, never inferred. Defaults per type are in §6, but content
  overrides them: a hard `explain` asking *why does this design cause a memory
  leak* is `application`; *define recursion* is `retrieval`.
- **`explain`** is shown after answering, right or wrong. It is the teaching
  moment — say **why**, not what. A restatement of the prompt is a validation
  warning.
- **`concepts`** feeds Coverage. Falls back to `tags` when absent.

---

## 6. The sixteen assessment types

Every type renders itself, accepts input, grades itself, and returns
`{ correct, score, detail }`. `score` is 0–1.

| type | default layer | input | graded by |
|---|---|---|---|
| `code` | application | editor | test cases |
| `debug` | application | editor, broken starter | test cases |
| `design` | application | empty editor, no hints | acceptance tests |
| `project` | application | editor / multi-file | acceptance test suite |
| `output` | retrieval | text | normalised comparison |
| `fill` | retrieval | one input per blank | exact match per blank |
| `order` | retrieval | reorderable list | sequence equality |
| `mcq` | retrieval | radio, exam only | index match |
| `multi` | retrieval | checkbox, exam only | exact set match |
| `explain` | **declare** | textarea | keyword rubric |
| `trace` | **declare** | step table | per-step comparison |
| `complexity` | application | big-O field + justification | answer + rubric |
| `problem` | application | textarea | worked-solution keyword rubric |
| `proof` | application | textarea | rubric |
| `diagnose` | application | cause field + reasoning | answer + rubric |
| `scenario` | application | textarea | rubric |

### Test cases — `code` `debug` `design` `project`

```json
{ "input": "2, 3", "expected": 5 }
```

`input` is the **arguments to `fn` as source text**, or stdin for a whole-program
challenge. `expected` is a real JSON value. Comparison is **structural** — the
serialised forms are parsed back and compared as values, so `30` matches `30.0`
and Python's `[1, 9]` matches JavaScript's `[1,9]`.

### Keyword rubric — `explain` `problem` `proof` `scenario` `diagnose`

```json
"rubric": {
  "required": ["base case", "recursive case"],
  "optional": ["stack", "termination"],
  "forbidden": ["infinite"],
  "minWords": 25
}
```

Score = required hits / required count, plus up to 0.2 for optional hits, zeroed
by a forbidden hit or by falling under `minWords`. Matching is
case-insensitive on word boundaries. This is deliberately thin — it is a first
pass, not a grader that understands prose.

### Structured types

```json
// fill
"template": "for i in ___(5):\n    print(___)",
"blanks": ["range", "i"]

// order
"fragments": ["def f():", "    x = 1", "    return x"],
"answer": [0, 1, 2]

// trace
"steps": [ { "label": "after pass 1", "expected": "[1, 3, 5]" } ]

// complexity
"answer": "O(n log n)", "rubric": { "required": ["divide", "merge"] }

// diagnose
"answer": "TCP window exhaustion", "rubric": { "required": ["window", "ack"] }
```

---

## 7. Boss floors and the acceptance harness

The last floor is the boss. It must contain a `project` challenge graded by
acceptance tests — never self-assessment.

Three harness modes:

```json
"harness": "function"                       // call fn with args, assert return
"harness": "cli", "argv": ["--count","3"], "stdin": "a\nb\n"
"harness": "file", "writes": "out.txt"      // assert on file contents
```

`function` is fully implemented. `cli` and `file` are declared and stubbed —
a challenge using them reports honestly that the mode is not yet available
rather than passing the learner.

---

## 8. XP

Base by type, multiplied by the floor's cognitive level.

| types | base |
|---|---|
| `project` `design` | 100 |
| `code` `debug` `proof` `problem` | 50 |
| `complexity` `scenario` `diagnose` `trace` | 40 |
| `explain` `output` `fill` `order` | 20 |
| `mcq` `multi` | 10 |

| level | ×
|---|---|
| recognition | 1.0 |
| recall | 1.2 |
| application | 1.5 |
| transfer | 1.8 |
| design | 2.2 |
| boss | 3.0 |

`xp` on a challenge overrides the computed value.

---

## 9. Firestore

```
users/{uid}     profile, level, xp, mana, manaUpdatedAt, streak, relics[], titles[]
progress/{uid}  dungeons: { <id>: { floors:{}, concepts:{}, mastery:{} } }
sessions/{uid}  reviewQueue: [...]
sessions/{uid}/reviewLog/{entryId}
                { challengeId, dungeonId, reviewedAt, outcome, ease, interval }
```

The review **log** is append-only and separate from the queue: the queue holds
*next due* state, the log holds history, and the 30-day retention figure is
computed from the log. Streak counts days with at least one **Application-layer**
challenge — reading a lesson does not extend it.

---

## 10. Authoring rules

1. **Teach, then test.** Every challenge is solvable from that floor's lesson.
2. **Deterministic.** No randomness, clocks or network.
3. **Test behaviour, not source.**
4. **Prompts state expected output verbatim.**
5. **Cover the edges** — 3–4 tests including a boundary case.
6. **Starter code sets the shape**, never the answer. Design and boss floors have
   none at all.
7. **Escalate within a floor** and across the dungeon, following `cognitiveLevel`.
8. **`explain` is mandatory and is not a restatement.**
9. **Every concept in `concepts` reaches Application somewhere in the dungeon**,
   or the dungeon can never be completed.

---

## 11. What the validator enforces

- floor `n` matches array position; `cognitiveLevel` matches the proportional band
- every name in `sequence` exists on the floor
- lesson: 2–4 sections, each with a code example
- every challenge: known `type`, valid `layer`, non-empty `prompt` and `explain`,
  positive `xp`, unique `id`
- type is legal for the dungeon's `disciplineType`
- `mcq`/`multi` never outside an exam stage
- type-specific shape: `tests` for code-likes, `blanks` matching `___` count,
  `answer` in range for `mcq`, `rubric.required` non-empty for rubric types
- every concept in `concepts` has at least one Application-layer challenge
- the last floor has a `project`

Warnings (failures under `--strict`): TODO `explain`, missing `tags`, missing
`starterCode` on a scaffolded floor, hint present on a design/boss floor.
