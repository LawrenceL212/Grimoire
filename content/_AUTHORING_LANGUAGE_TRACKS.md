# Authoring challenges for an imported language track

Seventeen language dungeons were imported from Exercism with their syllabus and
lesson prose intact but **zero challenges**, because only the Python importer
has an AST test extractor. This document is the contract for filling them by
hand. It supplements `content/_SCHEMA.md`, which remains authoritative — read
that first.

The goal is stated plainly: **thin but honest, and better than empty.** These
tracks do not need to match the depth of Python, JavaScript or Algorithms. They
do need to be real: every challenge correct, every claim true, every floor
passing `validate_content.py` and `audit_content.py` clean.

## What already exists

Each imported floor carries:

- `concepts` — the Exercism concept slugs the floor covers
- `exercises` — the Exercism exercise slugs the floor's practice draws on
- `lesson.sections` — real prose and a real code example per section, taken
  from the track's own concept documents

You are adding assessment on top of that. Do not rewrite the imported prose
unless it is broken.

## The one thing that decides everything: can it execute?

| track | runtime | executes? |
|---|---|---|
| `typescript` | sandboxed Web Worker | **yes** — it is JavaScript after types are erased |
| `ruby` | Opal | **yes**, in compatibility mode |
| everything else | `piston` | **no** — the public Piston API has been whitelist-only since 2026-02-15 and returns 401 |

A `code` or `debug` challenge is graded by running its `tests`. On a track that
cannot execute, such a challenge can never be passed, so **do not author one.**
Writing tests that never run is exactly the dishonesty this project exists to
avoid.

### Types available when the track cannot execute

`output`, `fill`, `order`, `trace`, `explain`, and — exam-only — `mcq` and
`multi`. These are graded by comparison or by rubric, not by execution, so they
are honest on any track.

`output` is the workhorse. "Here is a program; what does it print?" tests real
understanding of the language's semantics, and is graded by an exact answer.

The boss floor's capstone is a `design` with **no `tests` and a `rubric`**
instead. The validator and the runner both accept that: a design or project
with no tests is graded against its keyword rubric, and says so to the learner.

### Types available when the track can execute

All of the above, plus `code`, `debug`, `design` and `project` with real
`tests`. Prefer these on `typescript` and `ruby` — a track that can run code
should ask the learner to write some.

## Per-floor minimum

Per floor, at minimum:

- a **checkpoint on every lesson section** (3–5 sections; the validator
  requires one per section, and it is the gate to the next)
- **at least 4** graded challenges in a practice stage
- an **exam** of 8–12 questions, mixing at least two types, with at least one
  Application-layer question — except the boss floor, which is assessed by its
  capstone and has no exam

Every concept named on the floor must be tagged on a challenge, and every
concept in the dungeon must reach the Application layer somewhere.

`layer` is declared, never inferred. An `output` or `trace` challenge may
legitimately be Application layer if it demands the learner reason about a
whole program rather than recall a fact — and on a track that cannot execute,
it will have to be, or nothing reaches Application at all.

`mcq` and `multi` are exam-only, and never more than half of a floor's
challenges. Use them for definitions, not for reasoning.

## Cognitive band

`cognitiveLevel` is fixed by position: run `band_for(n, totalFloors)` from
`scripts/validate_content.py`. It is proportional, so a 14-floor track and a
5-floor track both spend the same *fraction* of themselves in each band. The
last floor is always `boss` and the one before it always `design`. Neither may
carry starter code or hints.

Several of these tracks are short. A track with one or two floors is a stub
that happens to be honest about being a stub; author it to the contract and
leave it short rather than inventing floors the source syllabus does not have.

## Quality bar

- Every code example must be **valid, idiomatic code in that language**, and
  every `output` answer must be what that program actually prints. Where you
  cannot run the language, reason it through carefully and prefer examples
  whose output is unambiguous. Do not guess at formatting details — choose an
  example where you are certain.
- `explain` on every challenge says why the answer is what it is, and where the
  tempting wrong answer comes from.
- Prose is markdown, British spelling, backticks for identifiers.
- No TODO, no placeholder, no truncated sentence.

## Gate

```
python scripts/assemble_dungeon.py <track>     # if authored as fragments
python scripts/validate_content.py <track>
python scripts/audit_content.py
```

Both must be clean before the track is committed. Commit one track per commit.
