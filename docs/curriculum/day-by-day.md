# The first 30 days: a pacing sketch

A realistic plan, not a promise. It uses the order recommended in
[gaps.md](gaps.md) (footholds before S9 and S10, JOIN right after foreign
keys), so from day 10 it runs ahead of what is built.

**Rules it follows**

- At most 4-5 new ideas a day (the game's own cap is 5), and a new idea only
  after the previous one was solved without help.
- 45-60 minutes a day in 3-5 minute tickets. Stop at the end of a ticket, not
  in the middle of one.
- Every 4th or 5th day is a **review day**: no new ideas, earlier ones from a
  blank editor. The game has no review queue yet, so until it does, use the
  Playground and re-type earlier answers without looking.
- **Bridge** items happen outside the game, on your own computer; the game
  cannot check them.

| Day | New ideas | What you do | Status | New |
|---|---|---|---|---|
| 1 | table/row/column, linking by id, CREATE TABLE | Tutorial part 1, O1, O2, S1 | Built | 3 |
| 2 | INSERT, a query is a question, reading errors, looking things up | S2, tutorial part 2, O3, O4, O5 | Built | 4 |
| 3 | writing a query, choosing columns, WHERE, UPDATE | T01, T02, T03, T04 | Built | 4 |
| 4 | ORDER BY, comparing, investigate before changing | T08, T10, T11 | Built | 3 |
| 5 | Review | Re-type days 1-4 from blank (CREATE, INSERT, SELECT, WHERE, UPDATE, ORDER BY) | Review | 0 |
| 6 | DELETE, AND, a day as a time range | T13, T14, T16 | Built | 3 |
| 7 | LIMIT, overlap | T17, T18 checkpoint, T19 | Built | 2 |
| 8 | fixing a clash, a first JS program, JS errors | T21, O6, O7 | Built | 3 |
| 9 | PHP asks the database | O8, then review of T16-T21 | Built | 1 |
| 10 | Review + psql | Install PostgreSQL locally; recreate your rooms table in psql and run five of your queries | Review, Bridge | 1 |
| 11 | TIMESTAMPTZ, normalisation | S4 (the `people` table is CREATE TABLE recall); a short "one fact in one place" card | Planned (arc), Missing | 2 |
| 12 | foreign key, JOIN, LEFT JOIN | S5, T30, T32 | Planned (arc, LD) | 3 |
| 13 | count, GROUP BY | S6 (Sam's import), T23, T25 | Planned (arc, LD) | 2 |
| 14 | Review + git | Re-type days 11-13; git: init, add, commit, log, diff on a folder of your SQL files | Review, Bridge | 1 |
| 15 | IS NULL, COALESCE, transactions | T28, T32a, T39 | Planned (LD) | 3 |
| 16 | arrays and `.length`, for...of, if and `===`, form values are text | T05, T09, T12, a coercion card | Planned (LD), Missing | 4 |
| 17 | filter/find, your own function, closures | T24, T26, a closures card | Planned (LD), Missing | 3 |
| 18 | Review + DevTools | Re-type days 15-17; in a real browser: console, one breakpoint, the Network tab | Review, Bridge | 1 |
| 19 | HTML elements, page skeleton, labelled fields | S7, a skeleton card, S8 part 1 | Planned (arc), Missing | 3 |
| 20 | a form that submits, HTTP anatomy | S8 part 2, an HTTP card (method, URL, headers, status, body) | Planned (arc), Missing | 2 |
| 21 | PHP query with a condition, foreach over rows, if and arrays | T07, T15, T30a | Planned (LD) | 3 |
| 22 | functions with types, prepared statements | T31, T22 | Planned (LD) | 2 |
| 23 | Review + git branches | Re-type days 19-22; git branch, merge, a pull request; read a real CLAUDE.md file and say what it tells a developer | Review, Bridge | 1 |
| 24 | the handler convention, the real PHP request | S9; the same handler written with `$_POST` and `http_response_code()` | Planned (arc), Missing | 2 |
| 25 | JSON parse/stringify, submit events, promises and await | T41, the events part of S10, a promises card | Planned (LD, arc), Missing | 3 |
| 26 | fetch (GET, then POST JSON) | S10 | Planned (arc) | 1 |
| 27 | Review + AI-assisted work | Re-type days 24-26; ask Claude Code for a small change to your own project, review its diff, run it, reject anything you cannot explain | Review, Bridge | 1 |
| 28 | a JSON GET endpoint, building elements with textContent | S11 in two parts | Planned (arc) | 2 |
| 29 | REST design and status codes | A REST card, then S12 launch day (checkpoint, all recall) | Missing, Planned (arc) | 1 |
| 30 | CSS rule and class, box model | P1 part 1 and 2 | Planned (arc) | 2 |

**By day 30:** 66 new ideas across SQL, JavaScript, PHP, HTML/CSS and
HTTP, a booking site built end to end inside the game, and git, psql and
DevTools started outside it. Days 1-9 are playable now; the rest needs the
cards in gaps.md (M-J1, M-P1, M-S1-M-S3, M-W1) and the arc milestones M-B to
M-H. Slower is fine: a missed day pushes the plan back, it does not break it.
