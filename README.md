# Grimoire

A dungeon-crawler learning platform for computer science. Every **dungeon** is a
full course; every **floor** takes you from not knowing something to being able
to use it. Not a quiz wrapper — you write real code, it really executes, and the
exam gates the next floor.

By the time someone finishes the Python dungeon, they can write Python. That is
the bar.

## How a floor works

Ten floors per dungeon. Each floor has three phases, in order, gated:

| phase | what it is | to pass |
|---|---|---|
| **Lesson** | 2–4 concept sections, each with an annotated example you can edit and run in place | read it |
| **Practice** | 6–10 coding challenges, executed and checked against test cases with a diff on failure | **all** must pass |
| **Exam** | 8–12 mixed challenges — code, output-prediction, bug-fix, MCQ where it fits | **80%+** |

Floor 10 is a **boss floor**: a complete project built from scratch, tested
end to end, no hints.

## Running it

Content is fetched over HTTP, so it needs a server — `file://` will not work.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

No build step, no npm, no bundler. `index.html` is the whole app; ESM modules
come from CDN.

## Code execution

| language | runtime | notes |
|---|---|---|
| Python | Pyodide, loaded lazily from CDN | one-time "loading runtime" state on first use |
| JavaScript / TypeScript | sandboxed Web Worker | 2 s hard timeout so an infinite loop cannot lock the tab |
| everything else | [Piston](https://emkc.org/api/v2/piston/execute) | free, no key, 70+ languages |

If execution is unavailable, the expected output is shown and progression is
blocked. There is no self-assessment path to completing a floor.

## Layout

```
index.html               the entire app
content/
  index.json             dungeon catalogue that drives the map
  {dungeon}.json         one full course
  attribution.md         every source used, its licence, and how
  _SCHEMA.md  _TEMPLATE.json
syllabi/
  {dungeon}.md           the concept contract a dungeon must cover
scripts/
  import_exercism.py     Exercism track  -> dungeon JSON
  import_webdev.py       Web-Dev-For-Beginners -> dungeon JSON
  validate_content.py    content gate
```

## Adding a dungeon

1. Write `syllabi/{id}.md` — every concept to cover, in order. This is the
   contract.
2. Create `content/{id}.json` from `content/_TEMPLATE.json`, or import a base:
   `python scripts/import_exercism.py {track}`
3. Add an entry to `content/index.json`.
4. `python scripts/validate_content.py {id}` — it must pass before it ships.

## The import scripts

Content is derived from open source curriculum rather than invented; the app is
the engine. See `content/attribution.md` for every source and licence.

```bash
python scripts/import_exercism.py python            # writes content/python.json + syllabi/python.md
python scripts/import_exercism.py python --dry-run  # summary only, writes nothing
python scripts/import_webdev.py                     # JavaScript + HTML/CSS
python scripts/validate_content.py                  # every dungeon
python scripts/validate_content.py python --strict  # warnings fail too
```

Both importers cache every fetched file under `.cache/`, so re-runs are instant
and offline. `--no-cache` forces a refresh.

**What the Exercism importer does.** Reads the track's `config.json`, orders the
concept exercises by their declared prerequisites, groups them into floors, and
pulls lesson text, runnable examples, per-task starter code, real task
instructions, and test cases. Test suites are parsed with `ast` — the extractor
recognises the shapes the track actually uses (direct asserts, `zip`ped
input/result lists, and packed row tables). Anything it cannot read with
confidence becomes a TODO rather than a guess, and the summary says exactly how
much.

Exams are never imported. They are written for Grimoire.

## Firebase

`firebaseConfig` is in `index.html`. Firestore rules scope every document to
`request.auth.uid`; all writes go to `users/{uid}`, `progress/{uid}`,
`sessions/{uid}` and their subcollections.

State is held in memory, persisted on a debounce, and mirrored to
`localStorage` so the app works offline and syncs on reconnect. Firestore calls
fail soft and log — they never throw into the UI, and progress is never lost.

## Build status

- **Phase 0 — content pipeline: done.** Import scripts, Python track imported,
  attribution written.
- **Phase 1 — shell and auth: done.** Responsive shell, Firebase auth, the
  three-Book dungeon map, user documents created on first sign-up.
- Phase 2 — floor runner: interactive lesson phase with checkpoints
- Phase 3 — floor runner: practice phase
- Phase 4 — floor runner: exam phase
- Phase 5 — progression systems
- Phase 6 — Python floors 1–3 fully authored
- Phase 7 — content expansion

`content/_prior/` holds hand-authored Python floors from an earlier prototype,
kept as reference material for the authoring phase.
