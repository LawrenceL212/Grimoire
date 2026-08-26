# Grimoire — Curriculum Architecture

This is the layer above `_SCHEMA.md`. The schema says whether a floor is well
**formed**. This says whether a floor is well **aimed**.

The governing question, asked of every floor and every dungeon:

> If a learner completes this, what can they actually DO that they could not
> do before?

"Finished the lessons" is not an answer. "Got the multiple-choice questions
right" is not an answer. "Understood the explanation" is not an answer.

---

## 1. Where the corpus actually stands

Measured, not asserted — run `python scripts/audit_curriculum.py`.

| Requirement | State at adoption |
|---|---|
| Floors stating a capability (§3, §13) | **0 of 205** |
| Floors declaring prerequisites (§9) | **0 of 205** |
| Floor count driven by depth (§14) | 12 of 19 dungeons are exactly 10 |
| Practice reaches productive types (§4) | passes |
| Bosses avoid naming the technique (§12) | passes |
| Language dungeons reach professional practice (§7) | none do |

What exists is a rigorous **assessment engine** with well-formed content
inside it. What does not exist is the curriculum architecture that turns a
sequence of well-formed floors into a route from zero to professional.

The content is not wasted. It is under-framed: every floor teaches something
real, and no floor says what capability it confers, what it assumes, or where
it sits on the road.

---

## 2. The six stages

Every dungeon and every floor declares a `stage`. It is the single most
important field added here, because it is what makes "beginner to
professional" checkable rather than aspirational.

| Stage | Name | The learner can… | Measured by |
|---|---|---|---|
| 0 | Absolute Beginner | nothing assumed — not variables, not source code, not what an interpreter is | reaching stage 1 at all |
| 1 | Foundations | write small programs alone; decompose a problem; debug | producing working code from a written problem |
| 2 | Competent | build non-trivial programs; choose data structures; read others' code; test | choosing the structure, not being handed it |
| 3 | Advanced | reason about memory, concurrency, performance, systems | explaining behaviour and predicting cost |
| 4 | Professional | work inside an existing codebase they did not write | changing a repository safely, with tests |
| 5 | Specialist | depth in one branch | the specialisation dungeons |
| 6 | Elite | learn the unfamiliar; reason from first principles; transfer | unfamiliar problems, no technique named |

Stage 0 is a real obligation, not a courtesy. Nothing may assume knowledge the
curriculum has not established. The first floors of the first dungeon must
explain what a program is, what source code is, and what runs it.

---

## 3. The knowledge graph

Prerequisites exist so a learner cannot walk into a room where the words mean
nothing. Arrows are hard requirements.

```
STAGE 0-1  foundations
  computer-fundamentals ──┐
  bash ───────────────────┼──► python (0-2) ──► git ──► testing-debugging
  precalculus ────────────┘         │
                                    ▼
STAGE 2  competence            data-structures ──► algorithms
  discrete-maths ──────────────────►│                  │
  databases ◄───────────────────────┘                  │
                                                       ▼
STAGE 3  systems and theory
  computer-architecture ──► operating-systems ──► concurrency
             │                      │                  │
             │                      ▼                  ▼
             └──► compilers    networking ──────► distributed-systems
                                    │
  linear-algebra ──► calculus-1 ──► probability-stats ──► machine-learning
                                    │
  number-theory ──────────────► cryptography

STAGE 4  professional
  software-architecture, code review, CI/CD, legacy work
  (drawn from every Stage 3 dungeon; assessed on repositories, not snippets)

STAGE 5  specialisation
  graphics · security · data · ML/AI · embedded · PL/compilers · infra
```

Two rules follow:

- A floor may only assume concepts its own dungeon has taught, or concepts
  from a dungeon it declares in `requires`.
- A dungeon may not claim a stage above the highest stage of its prerequisites
  plus one.

---

## 4. The floor contract

A floor is a **capability checkpoint**, not a chapter. Four fields become
required, and the schema now enforces them.

```jsonc
{
  "n": 7,
  "name": "The Vault of Forms",        // flavour, for the map
  "goal": "Choose an appropriate collection type for a problem and justify the choice against its alternatives.",
  "stage": 2,
  "requires": [{ "dungeon": "python", "floor": 4 }],
  "description": {
    "what":   "How Python stores groups of values, and how the four built-in collections differ.",
    "why":    "Choosing the wrong container is the commonest cause of code that is correct but far too slow.",
    "enables":"Pick a list, dict, set or tuple for a stated problem and defend the choice on cost.",
    "assumes":"You can write a loop and a function, and you know what a variable holds.",
    "assessed":"You will write code that chooses its own structure, and explain the cost of the alternative."
  }
}
```

`name` is the game. `goal` is the curriculum. They are different fields
because they do different jobs, and conflating them is how "Floor 7 — Arrays"
happens.

**`goal` must be a capability**, phrased as something the learner does. It
must begin with a verb. "Arrays" is not a goal; "Represent and manipulate a
collection of data using arrays" is.

---

## 5. The five modes, and the one that matters

Each floor moves through modes by removing scaffolding. Stage names in
`sequence` now carry meaning the engine and the validator both understand:

| Stage name | Mode | Scaffolding | Technique named? |
|---|---|---|---|
| `lesson` | Learn + Worked Example | full | yes |
| `guided-practice` | Guided | starter code, hints | yes |
| `independent-practice` | Independent | none | **no** |
| `challenge` / named lab | Challenge | none | no |
| `exam` | Retrieval check | none | mixed |
| `trial` | Boss | none | never |

The distinction that carries the most weight is **independent practice**. A
learner who solves

> "Use recursion to flatten this list"

has demonstrated something much weaker than one who reads

> "Flatten this list."

and reaches for recursion themselves. Recognising *that a technique applies*
is a separate skill from applying it, and it is the one that transfers.

So: in an `independent-practice` stage, or on a boss floor, a prompt may not
name the technique. The validator checks this, and it is the mechanical
expression of §12.

---

## 6. Projects

Isolated challenges cannot measure whether someone can build a thing. Every
dungeon at Stage 2 or above carries at least one project, and projects grow
across a dungeon:

- **Stage 1** — one file, one behaviour. A calculator, a guessing game.
- **Stage 2** — several modules, real input, tests. A CLI tool, a small API.
- **Stage 3** — a system with a hard part. An interpreter, an HTTP server, a
  cache with an eviction policy.
- **Stage 4** — *an existing repository.* The learner navigates code they did
  not write, reproduces a bug, finds the root cause, fixes it without breaking
  anything else, and writes the regression test.

The Stage 4 shape is the one that distinguishes this curriculum from a
tutorial series, and it is the shape every language dungeon must end on.

---

## 7. What "Professional" means, and when we may say it

The rank shown to the learner is derived from demonstrated work, never from
progression through the UI:

- **Familiar** — recognition and recall only.
- **Capable** — has written working code from a stated problem.
- **Competent** — has chosen its own approach in independent practice.
- **Professional** — has completed a Stage 4 repository project in that
  dungeon, with tests.

A dungeon that contains no Stage 4 work cannot award Professional, and must
not imply it. Today no dungeon can. That is a statement about our content, not
about the learner.

---

## 8. Two honest blockers

**Runtime.** §5 says a programming learner must eventually write code that
runs. Fourteen language dungeons have no runtime at all — the public Piston
API has been whitelist-only since 2026-02-15, and this is a static site with
no server to replace it. Those dungeons can reach Stage 1–2 on
comprehension-shaped assessment and **cannot reach Stage 4 by any honest
route**. The options are to add in-browser runtimes where they exist
(Lua/Fengari, Ruby/ruby.wasm, C and C++/clang-wasm are all real), or to label
the rest as reference tracks and say so on the dungeon page. What must not
happen is a Rust dungeon that claims professional competence it cannot test.

**Scale.** Reaching Stage 4 in Python is roughly a 25–30 floor dungeon, not a
10 floor one. The existing ten floors take a learner to about Stage 2 and stop
at the language's edge: no files, no modules, no standard library, no testing,
no packaging, no Git, no reading of unfamiliar code. Depth is what the
standard asks for, so breadth across 54 dungeons is the wrong axis to grow on
until at least one dungeon proves the whole route.

---

## 9. Order of work

Per §17, architecture before content, and one dungeon proved before scaling.

1. Schema v4 — `goal`, `stage`, `requires`, `description`; validator enforces
   them, and enforces the independent-practice rule. **← this is where the
   corpus is now**
2. Retrofit the seven authored dungeons with goals, stages and prerequisites.
   No new floors; make the existing ones state their aim.
3. Rebuild **Python** as the proof dungeon, end to end, Stage 0 → Stage 4,
   at whatever floor count that honestly takes. It is the entry point, it
   executes, and it is where a beginner actually starts.
4. Validate that dungeon against this document, in full, with a real learner
   route from "never programmed" to a repository project.
5. Only then scale to the rest.

A shallow fifty-floor dungeon is worse than a rigorous twenty-floor one.
