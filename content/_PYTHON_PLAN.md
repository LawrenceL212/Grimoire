# Python — capability graph and floor sequence

The proof-of-concept dungeon for the whole curriculum architecture. It must
take somebody who has never written a line of code to somebody who can be
handed an unfamiliar Python repository and work in it safely.

**31 floors.** Not a target — the number that fell out of the prerequisite
chain once every capability in the standard had a home and nothing was taught
before the thing it depends on. The existing dungeon is 10 floors and reaches
about Stage 2, stopping at the language's edge.

Python is an **executable track**: Pyodide runs real CPython in a worker, so
every claim this dungeon makes about the learner's ability to write code is
verified by running their code. It is therefore eligible for Master.

---

## The capability chain

Each floor's `assumes` is satisfied by a floor above it. Nothing forward-refers.

```
STAGE 0  nothing assumed
  1 what a program is ──► 2 values and names
                              │
STAGE 1  write small programs alone
  3 expressions and types ◄───┘
        │
        ├──► 4 decisions ──┐
        │                  ├──► 6 reading failure ──► 7 functions ──► 8 decomposition
        └──► 5 repetition ─┘                                              │
                                                    9 text ◄──────────────┘
STAGE 2  build non-trivial programs, choose your own structures
  10 lists ──► 11 dicts and sets ──► 12 CHOOSING a container
        │                                   │
        └──► 13 comprehensions               ├──► 19 cost and complexity
                                             │
  14 files ──► 15 errors as control flow ──► 16 modules ──► 17 standard library
                                                   │
                                            18 classes
STAGE 3  reason about behaviour and cost
  20 iterators and generators ──► 21 closures and decorators ──► 22 typing
                                             │
  23 testing ◄───────────────────────────────┘
        │
        ├──► 24 talking to the outside (HTTP/JSON)
        └──► 25 concurrency

STAGE 4  work inside code you did not write
  26 version control ──► 27 projects and dependencies ──► 28 reading unfamiliar code
                                                                │
                                          29 refactoring under tests ◄┘
                                                                │
                                          30 professional debugging and trade-offs
                                                                │
  31 THE TRIAL — an inherited repository ◄──────────────────────┘
```

---

## The sequence

`band` is derived from `stage`, not from position — see `_CURRICULUM.md` §2.

| # | Stage | Band | Floor | Capability the learner gains |
|---|---|---|---|---|
| 1 | 0 | recognition | What a Program Is | Run a Python program, read its output, and say what the interpreter did with the source |
| 2 | 0 | recognition | Values and Names | Store a value under a name, inspect its type, and predict what a name refers to |
| 3 | 1 | recall | Expressions | Evaluate an expression by hand and predict its type and value before running it |
| 4 | 1 | recall | Decisions | Direct a program down different paths using conditions, and predict which path runs |
| 5 | 1 | recall | Repetition | Repeat work with loops, and choose between counting, accumulating and searching |
| 6 | 1 | recall | Reading Failure | Read a traceback, locate the failing line, and isolate a fault without guessing |
| 7 | 1 | recall | Functions | Package behaviour behind a name with parameters and a return value |
| 8 | 1 | recall | Decomposition | Break a stated problem into functions before writing any of them |
| 9 | 1 | recall | Text | Manipulate text by index, slice and method, and know why strings cannot be edited in place |
| 10 | 2 | application | Lists | Build and modify sequences, and tell aliasing from copying |
| 11 | 2 | application | Dictionaries and Sets | Look things up by key and test membership without scanning |
| 12 | 2 | application | Choosing a Container | Pick the right structure for a stated problem and defend it against the alternative |
| 13 | 2 | application | Comprehensions | Transform a collection in one readable expression, and know when not to |
| 14 | 2 | application | Files | Read and write files safely, handling paths and encodings |
| 15 | 2 | application | Errors as Control Flow | Raise, catch and design exceptions, and decide what must not be caught |
| 16 | 2 | application | Modules | Split a program across files and control what each exposes |
| 17 | 2 | application | The Standard Library | Find and use a module you have never seen, from its documentation |
| 18 | 2 | application | Classes | Model state and behaviour together, and judge when a class is the wrong answer |
| 19 | 2 | application | Cost | Predict how a program's running time grows, and choose on measured evidence |
| 20 | 3 | transfer | Iterators and Generators | Produce values lazily, and process data larger than memory |
| 21 | 3 | transfer | Closures and Decorators | Treat functions as values, and wrap behaviour without editing it |
| 22 | 3 | transfer | Type Annotations | Express a contract in types and use a checker to enforce it |
| 23 | 3 | transfer | Testing | Write a failing test first, then the code that satisfies it |
| 24 | 3 | transfer | Talking to the Outside | Consume an HTTP/JSON interface and survive its failures |
| 25 | 3 | transfer | Concurrency | Choose between threads, processes and async for a stated workload |
| 26 | 4 | design | Version Control | Read a repository's history as evidence, and find when a behaviour changed |
| 27 | 4 | design | Projects and Dependencies | Lay out a project, isolate its environment, and pin what it depends on |
| 28 | 4 | design | Reading Unfamiliar Code | Build a working mental model of code you did not write |
| 29 | 4 | design | Refactoring Under Tests | Change the shape of working code without changing what it does |
| 30 | 4 | design | Professional Debugging | Reproduce, isolate and fix a defect in a system you do not fully understand |
| 31 | 4 | boss | **The Trial of the Inherited Repository** | Everything above, on a codebase nobody explained to you |

---

## What the boss actually is

Floor 31 hands the learner a small but real Python project they have never
seen: several modules, existing tests, a README that is slightly out of date,
and a reported defect described the way a user would describe it — by symptom,
not by cause.

They must:

1. run it, and get the existing tests passing
2. reproduce the reported behaviour
3. find the root cause rather than the symptom
4. write a failing regression test that captures it
5. fix it without breaking anything else
6. explain what they changed and what they chose not to change

**No part of the prompt names a Python technique.** Not the module, not the
data structure, not the debugging approach. Deciding what the problem needs is
the thing being measured, and the validator now refuses a boss prompt that
names a technique.

---

## Does this actually reach Stage 4?

The test is not whether the topics appear. It is whether the *capability*
does. Checked against the standard's Stage 4 list:

| Stage 4 requirement | Where it is earned |
|---|---|
| navigate an unfamiliar repository | 28, exercised at 31 |
| understand an existing architecture | 28, 29 |
| reproduce bugs | 30, exercised at 31 |
| diagnose root causes | 6 → 30, exercised at 31 |
| implement changes safely | 29 with 23 |
| write regression tests | 23, required at 31 |
| refactor existing code | 29 |
| review code | 29 |
| use Git professionally | 26 |
| understand CI/CD | 27 |
| manage dependencies | 27 |
| read technical documentation | 17, then 28 |
| work with APIs | 24 |
| work with databases | *not here* — the Databases dungeon owns this |
| reason about security | *partly* — 15, 24; depth belongs to Cryptography |
| reason about reliability | 23, 24, 30 |
| reason about maintainability | 29, 30 |
| make engineering trade-offs | 12, 19, 25, 30 |
| explain technical decisions | required by every Stage 4 rubric and at 31 |
| understand technical debt | 30 |
| work with imperfect legacy code | 28, 29, 31 |

Two are deliberately out of scope and are named as such rather than faked:
**databases** and **security depth** belong to their own dungeons, and the
knowledge graph routes the learner there. A Python dungeon that taught them
shallowly would be worse than one that says where they live.

---

## Assessment shape

Every floor from 3 onward carries executable work — the learner writes Python
and it runs. The stage ladder governs how much scaffolding comes with it:

- **Stage 0–1** — `guided-practice` with starter code and hints, then
  `independent-practice` with neither.
- **Stage 2–3** — `independent-practice` is the bulk. The prompt states the
  problem, never the technique.
- **Stage 4** — `design` and `scenario` work on real artefacts: a diff, a
  traceback, a directory listing, an unfamiliar module.

Floors 26–31 assess judgement on material that cannot be executed as a unit
test — reading a history, choosing a layout, arguing a trade-off — so those
carry rubric-graded `design`, `scenario` and `explain` challenges alongside
the code. That is not a weakening: it is the only honest way to assess a
decision, and it sits on top of twenty-five floors of verified code.

**Floor 24 is the one honest compromise.** Pyodide cannot reach arbitrary
hosts, so API work is assessed against a local stub that behaves like an HTTP
client. The floor says so plainly rather than implying a network call happened.
