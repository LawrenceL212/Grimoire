# GRIMOIRE

**Every language a spell. Every concept a power.**

A learning platform for computer science. Each **dungeon** is a full course; each
**floor** takes you from not knowing something to being able to use it. You do not
tick boxes or rate yourself — you write real code, it really runs, and it either
passes the tests or it does not.

## How a floor works

Three phases, in order, gated:

| phase | what it is | to pass |
|---|---|---|
| **Lesson** | 2–4 concept sections, each with an annotated code example you can edit and run in place | read it |
| **Practice** | 6–10 coding challenges, checked against real test cases with a diff on failure | **all** must pass |
| **Exam** | 8–12 mixed challenges — code, output-prediction, bug-fix, multiple choice | **80%+** |

Clearing a floor's exam unlocks the next one. There is no skip, and no
self-assessment: if code cannot be executed, the floor cannot be completed.

## Running it

Content is loaded over HTTP, so it needs a server — `file://` will not work.

```bash
python -m http.server 8000
# open http://localhost:8000
```

On GitHub Pages it is served from the repository root as `index.html`.

## Code execution

| language | runtime | notes |
|---|---|---|
| Python | Pyodide (CPython on WebAssembly) in a Web Worker | loaded lazily on first run |
| JavaScript | sandboxed Web Worker | 2 s hard timeout, no network or DOM |
| everything else | [Piston](https://emkc.org/api/v2/piston/execute) | needs a connection |

Runaway loops are killed by terminating the worker, so an infinite loop costs you
a few seconds, not the tab.

## Content is data

The engine knows nothing about Python, or about any subject. It reads
`content/index.json` for the catalogue and `content/{id}.json` for a curriculum.
Adding a course means adding a JSON file — the engine never changes.

```
content/
  index.json      the dungeon catalogue shown on the map
  python.json     a full course: floors, each with lesson + practice + exam
  _SCHEMA.md      the complete format, with authoring rules
  _TEMPLATE.json  copy this to start a new dungeon
tools/
  validate_content.py
index.html        the whole engine
```

Validate before committing content:

```bash
python tools/validate_content.py          # every available dungeon
python tools/validate_content.py python   # just one
```

## Status

**Phase 1 — shipped.** Auth, dungeon map, the full floor runner with real code
execution, and Python floors 1–3 authored as real curriculum.

- Floor 1 — Values, Variables, and Output
- Floor 2 — Control Flow
- Floor 3 — Functions

49 dungeons appear on the map; the other 48 are catalogued but not yet written.

## Setup

`firebaseConfig` sits at the top of the script in `index.html`. Firestore holds
`users/{uid}` (profile, XP, streak) and `progress/{uid}` (per-floor phase
completion). If Firebase is unreachable or unconfigured, the app falls back to
`localStorage` and says so on the profile screen.

Firebase console needs **Authentication → Email/Password enabled**, and Firestore
rules restricting each user to their own documents:

```
match /users/{uid}    { allow read, write: if request.auth.uid == uid; }
match /progress/{uid} { allow read, write: if request.auth.uid == uid; }
```
