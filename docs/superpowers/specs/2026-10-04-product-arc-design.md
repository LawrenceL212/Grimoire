# Grimoire Game — The Product Arc

Status: design, not built. Date 2026-10-04. Branch `game-sandbox`.
Builds on (does not redesign): the learning design
(`docs/superpowers/specs/2026-10-01-learning-design.md`, sections 1-6, 14 PC-1..PC-17,
the ladder in section 8), the binding checklist
(`.superpowers/sdd/2026-10-01-grimoire-game-phase2a/learning-requirements.md`), the
plan notes "Product arc", "Realistic economy" and "Company growth path"
(`docs/superpowers/plans/2026-10-01-grimoire-game-phase2a.md`), the opening chapter
(`game/problems/ladder.js`, `chapter1/*`), the world (`game/world/*`), the runners
and the sandbox (`game/sandbox/*`, task-19 report with the 3b notes).

> Lawrence: "the game should take you from no customers to having customers,
> setting up the DB and creating and building the website that the users will be
> using. It's basically a tutorial but forcing you to come up with the solutions
> so you are actually learning, and problems arising through that are natural for
> a business to have."

**The one-paragraph version.** The SISO world starts empty: a bedroom desk, Priya's
paper notebook of three rooms and a dozen bookings, and Sam Fletcher of Harbour
Street Co-working willing to pilot "whatever you build". The learner builds the
product in 13 stages: the tables, the rows, the first queries, the links, a page,
a form, a PHP endpoint, a JavaScript confirmation, an availability page, then
launch day. Every stage gives a goal in someone's words, acceptance checks that
look only at the real result (the schema, the rows, the rendered page, what a
scripted customer could actually do on the learner's site), a Learn card and worked
example only for the one new idea, and the existing hint ladder. From launch day,
problems arise from what he built and the decisions he made (no `CHECK` on
capacity, `TIMESTAMP` without a time zone, string-glued SQL, `innerHTML`): the
director reads his schema and code shape to choose them. A customer walks in
through the office door only because his form and endpoint really saved a row.

---

## 0. Ground rules the arc adds (on top of the learning design)

1. **The world is what he built.** No seed at Day 0. Every row, table and page in
   the office exists because his code (or a named colleague's visible script)
   made it. The story animates only the real diff (`bridge.js`), never the
   expected answer.
2. **One house convention, everything else his decision.** Priya states the team's
   naming convention once, as a real team does (plural tables, `snake_case`, an
   `id` key, links named `<thing>_id`, times `start_at`/`end_at`). Types,
   constraints, extra columns, page structure, wording, validation rules and code
   structure are his. Reason: the bridge, the office and the 23 existing cards read
   `rooms`, `people`, `bookings`, `room_id`, `start_at`; free naming would need a
   schema adapter on every card (open question Q1).
3. **Decisions have consequences, never punishments.** A missing constraint is not
   graded down at the stage where it was optional. It becomes the trigger of a
   later natural problem, and if he already added the guard, that problem arrives
   as its friendlier twin ("the database refused Priya's typo; she wants a kinder
   message") or does not arrive at all.
4. **Acceptance checks outcomes, on two worlds where the answer could be read off
   the screen.** Schema checks read the catalogue and probe behaviour inside a
   rolled-back transaction; site checks are performed by scripted customers on his
   real page; write checks read the world afterwards. Every stage names a cheat
   that must fail.
5. **Scaffolding only on first meetings** (checklist item 1): worked example ->
   one-token change -> one-line change -> blank editor, for the first stage in each
   language (SQL S1, HTML S7, PHP S9, JavaScript S10). Later stages start blank.

---

## 1. The arc as stages

Notation per stage: **Goal** (their words) · **Builds** · **New idea** (one; Learn
card idea / worked example on different data) · **Acceptance** (+ the cheat that
must fail) · **Open space** (what he decides; any valid solution passes) · **Hints**
(H1 nudge, H2 concept named, H3 the Grimoire page, H4 worked example) · **World**
(success / failure in 3D) · **Next problem** (cause category). Times are designed
first-attempt minutes. Existing cards keep their ids; "kept" means the card runs as
written on his world (section 4).

### S0 · The notebook (tutorial, 8 min) · Priya

- **Goal:** "This is everything we've got: three rooms and the bookings, in my
  notebook. Sam wants to try us. Can the computer hold this?"
- **Builds:** nothing in code yet. He picks a row and a column on the notebook page
  drawn as a grid, then predicts what "room 2" in the bookings page points to.
- **New ideas:** the tutorial's play concepts plus O1 `table-row` and O2 `id-link`,
  re-hosted on the paper notebook (interact grading). No PostgreSQL yet.
- **Acceptance:** interact: the picked cell is the truth cell; the "room 2" pick is
  the Studio. Cheat: picking by position after the grid is re-sorted fails.
- **World:** the bedroom desk, a paper notebook on it, Sequel the drone. Nothing
  else exists: an empty office shell behind the bedroom wall, dark.
- **Next:** Priya: "Paper can't answer Sam at midnight. Start with the rooms."

### S1 · Somewhere to keep the rooms (12 min) · Priya · SQL first meeting

- **Goal:** "Sam's first question will be 'which rooms have you got and how many
  people fit?'. Make a place for that."
- **Builds:** `CREATE TABLE rooms (...)`.
- **New idea `create-table`:** a table is declared before it holds anything: a name,
  then columns, each with a type. Learn card (4 lines): "A column's TYPE decides
  what it will accept: `TEXT` for words, `INTEGER` for whole numbers. `SERIAL
  PRIMARY KEY` gives every row its own number." Worked example: `CREATE TABLE
  shifts (id SERIAL PRIMARY KEY, day TEXT, hours INTEGER);` (his waiting shifts,
  different data). L1 one-token change: rename `shifts` to `rooms` and run; L2:
  change the columns to fit the notebook.
- **Acceptance:** catalogue: table `rooms` exists, has a primary key named `id`,
  a text-like column and an integer-like column (`information_schema.columns`,
  `pg_constraint`). Probes (inside `BEGIN ... ROLLBACK`): insert the Boardroom with
  8 seats succeeds; "rooms seating at least 7" over probe rows `('A', 10)`,
  `('B', 8)`, `('C', 6)` returns A and B. **Cheat:** `capacity TEXT` passes the
  insert but the probe compares `'10' >= '7'` as text and returns only B, so it
  fails with plain words: "10 was treated as words, not a number".
- **Open space:** extra columns (a description, a floor), `NOT NULL` or not, `SMALLINT`
  vs `INTEGER`, `VARCHAR(n)` vs `TEXT`, `GENERATED ... AS IDENTITY` vs `SERIAL`. All pass.
  Decisions recorded for the director: `NOT NULL` on name? `CHECK (capacity > 0)`?
- **Hints:** H1 "Sam asks two things about each room." H2 "create-table: a name and
  a type per column." H3 Grimoire: create-table. H4 the `shifts` example.
- **World:** success: the drone assembles a filing cabinet labelled `rooms`, one
  drawer per column, his column names on the labels. Failure: the cabinet stays
  flat-packed; the error appears on the drone's screen with O4's error reading
  (taught in S3; here the error panel already highlights the line).
- **Next:** "The cabinet is empty." (report) -> S2.

### S2 · The three rooms (8 min) · Priya

- **Goal:** "Put my three rooms in: Boardroom 8, Studio 4, Library 12."
- **Builds:** `INSERT` rows. **New idea `insert`** (T06's concept, moved here; T06
  is retired, section 4). Worked example inserts two shifts.
- **Acceptance:** exactly one row per notebook room (name compared trimmed,
  case-insensitive), with the right capacities. **Cheat:** running the insert twice
  gives two Studios and fails "Priya counts 4 rooms, she has 3". (He fixes with
  `DELETE` shown as a free Grimoire look-up, or by recreating the table: both pass.)
- **Open space:** one statement or three; column list or none.
- **World:** success: each `booking-added`-style `room-added` event lights a room in
  the dark office shell, its name on the door; the office has exactly as many rooms
  as his table. Failure: a room flickers on and off (duplicate) or a sign reads
  "Studio?" for a misspelling (still passes acceptance only if the name matches).
- **Next:** duplicates or a typo seed problem P2 later; immediate next is S3.

### S3 · Asking the database (kept on-ramp, about 60 min over 2 days)

Cards O3, O4, O5, T01, T02, T03, T04, T08, T10 run **on his rooms table**: "a query
is a question", reading errors, looking things up, the first blank query, choosing
columns and rows, `UPDATE` ("the Boardroom seats 10, not 8"), sorting, comparing.
Unchanged pedagogy; only the world under them is his (section 4 says how).
**World:** each answer lights the rooms that are in it. **Next:** "Sam's members
are people, and they book times." -> S4.

### S4 · People and bookings (15 min) · Priya

- **Goal:** "Sam sent his members' names and this week's bookings. We need to keep
  who booked which room, from when to when."
- **Builds:** `people` and `bookings` tables.
- **New idea `timestamp-type`:** a moment is one value with a type that knows
  dates and times (`TIMESTAMPTZ`). Learn card: "Store the moment, not the words. A
  timestamp can be compared, sorted and subtracted; text cannot." Worked example:
  `CREATE TABLE shifts_worked (id ..., started_at TIMESTAMPTZ, ended_at TIMESTAMPTZ)`.
  `people` is a recall of `create-table` (unaided, so it is evidence).
- **Acceptance:** catalogue: both tables, keys, `bookings.room_id`,
  `bookings.person_id`, `start_at`, `end_at`; probes: insert a booking 09:00-10:00
  and one 10:00-11:00 and ask "bookings that start before 10:30" (2) and
  `end_at - start_at` is one hour. **Cheat:** `start_at TEXT` holding `'9:00'`:
  `'10:00' < '9:00'` as text, so the sort probe fails ("ten o'clock came before
  nine"). `TIMESTAMP` (no zone) **passes** and is recorded (it later triggers P12).
- **Open space:** `people` columns (email? phone?), `NOT NULL`s, whether `bookings`
  has `REFERENCES` yet (not required here: that is S5's problem), a `CHECK (end_at
  > start_at)` (not required: P4).
- **Hints:** H1 "Which booking is first on Monday? Your table must be able to tell."
  H2 timestamp-type. H3, H4 as usual.
- **World:** two more cabinets; Sam's members appear as characters in the lobby,
  waiting (rows in `people`), no one in a room yet.
- **Next:** S5, triggered by his schema state.

### S5 · "There is no room 7" (12 min) · Priya · cause: messy real-world input

- **Goal:** Priya types Sam's paper bookings in herself (a visible script in the
  history panel: "Priya, 10:42, 14 rows"). One says room 7. "The office has a
  booking for a room that doesn't exist. Can the system just refuse that?"
- **Builds:** a foreign key (`REFERENCES rooms(id)`), plus deleting or fixing the bad
  row first (recall of `delete`/`update`, unaided).
- **New idea `foreign-key`:** "A link column can be made to point only at a row
  that exists." Worked example: `shifts_worked.shift_id REFERENCES shifts(id)`.
- **Branch:** if his S4 table already had `REFERENCES`, Priya's script failed on
  that row and the ticket is instead "Priya got an error, what does it mean?":
  reading the error and replying (reply grading, explain-it closed-book). Both
  branches teach the same concept; credit is for what he produced.
- **Acceptance:** `pg_constraint` has a foreign key from `bookings.room_id` to
  `rooms`; the room-7 row is gone or corrected; probe: inserting `room_id = 999`
  raises SQLSTATE `23503`; adding a fourth room and booking it succeeds.
  **Cheat:** `CHECK (room_id BETWEEN 1 AND 3)` passes the 999 probe and fails the
  fourth-room probe.
- **World:** the ghost booking (a translucent person outside a non-existent door)
  fades; a chain links the bookings cabinet to the rooms cabinet.
- **Next:** Sam's spreadsheet import (S6). Explain step: "Sam asks why the system
  refused his room 7." (closed book, practice only.)

### S6 · Sam's spreadsheet (kept foothold, about 2 h over 3-4 days)

Tom's import script (other people's code, visible) loads Sam's existing bookings
(the named week of `named.js`) **through his schema**. Rows his constraints reject
are listed in Tom's import log; that log is the seed of P4. Then the kept cards
T11, T13, T14, T16, T17, T18 (checkpoint, M1), T19, T21 (the first double booking,
fixed by hand) run on this world. **World:** the office fills with Sam's members at
their bookings at the office clock (today's renderer, now from his rows).
**Next:** Sam: "My members want to book themselves, not ring you." -> S7.

### S7 · A page Sam's members can see (12 min) · Sam · HTML first meeting

- **Goal:** "Can my members see your rooms on their phones?"
- **Builds:** `index.html`: a heading and the three rooms with their seats (typed
  by hand: there is no server yet; that is a real first page).
- **New idea `html-element`:** a page is nested elements; tags name what each part
  is. Learn card: `<h1>`, `<ul>`, `<li>`, opening and closing tags; Codex entries
  for `<`, `>`, `/`. Worked example: a page for the restaurant's specials.
- **Acceptance:** rendered in the site sandbox (section 3): one `h1` whose text
  contains the company name (he chose it at S0); every room in **his** table
  appears in visible text with its capacity (read from the world at check time,
  so a room he added later must be on the page too). **Cheat:** a picture of text
  or the names in an HTML comment: the check reads visible text nodes only.
- **Open space:** list vs table vs paragraphs; wording; extra content.
- **World:** a screen appears in the office window facing the street, showing his
  real page (rendered in the 2D preview window, mirrored as a texture-free "screen"
  label in 3D). A passer-by stops, reads, nods; on failure they squint and walk on.
- **Next:** CSS problem P1 arrives later (phones); immediate next S8.

### S8 · The booking form (15 min) · Sam

- **Goal:** "Members want to book from that page. They need to say who they are,
  which room, and when."
- **Builds:** a `<form>` with labelled inputs and a submit button.
- **New idea `form`:** a form collects named values and sends them somewhere.
  Learn card: `<form action method>`, `<label for>`, `<input name>`, `<button>`.
  Worked example: a staff-meal order form.
- **Acceptance:** the scripted customer (section 3) Ada finds a field for her name,
  the room, the start and the end **by their labels**, fills them, presses the
  button, and the harness captures a submission to his `action` with the four
  values. **Cheat:** inputs without labels (placeholder only): Ada "cannot tell
  which box is the room" and the trail says so (labels are what screen readers and
  real test tools use; H1 says this). Fallback by `name` is a hint, not a pass.
- **Open space:** select vs free-text room, `datetime-local` vs date + time inputs,
  field names (any; S9 must read what he chose), layout.
- **World:** Ada walks to the street screen, types, presses Book... and nothing
  happens: the form has nowhere to go yet. She waits, shrugs, leaves. **This
  failure is the designed success of S8** and is said plainly: "Your form works.
  Nothing receives it yet."
- **Next:** S9 (feature request: "Ada says she pressed Book and nothing happened").

### O8 then S9 · Saving the booking (O8 kept 10 min; S9 20 min) · Tom · PHP first meeting

- O8 (kept) introduces PHP running SQL through `$pdo` on his world.
- **Goal (S9):** "When someone presses Book, the booking should actually exist."
- **Builds:** `book.php` with `function handle(array $input, PDO $pdo): array`
  returning `[status, body]` (PC-7, taught as "our codebase's convention": a
  convention of this game's codebase, not how PHP itself receives a request). Followed
  by bridge card M-P2: the same handler written the way plain PHP does it (`$_POST`,
  `json_decode(file_get_contents('php://input'), true)`, `http_response_code(201)`,
  `header('Content-Type: application/json')`), so the real request model is met too.
- **New idea `prepared-param`:** values go into a query as parameters, never glued
  into its text. Learn card: `$pdo->prepare('INSERT ... VALUES (?, ?, ?, ?)')`,
  `->execute([...])`; Codex entries for `$`, `->`, `[ ]`, `;`. Worked example:
  saving a staff-meal order. Scaffold: L1 change the table name in a working
  handler for `orders`; L2 change the column list; L3 blank `handle` for slots.
- **Acceptance:** three scripted customers book through his form. For each: a new
  `bookings` row exists with their person, room and times (the person is found or
  created: his decision); the response status is 2xx. **Cheats:** returning
  `[201, 'ok']` without inserting (no row: Ada leaves); inserting a hard-coded
  booking (customer 2 books a different room and time); string-glued SQL passes
  S9 itself (it works on these names) and is recorded for P5 (honest: it works
  until a name has an apostrophe; that day is a real event).
- **Open space:** look people up by name or email, create missing people or refuse,
  status 200 or 201, body text or JSON, validation now or later.
- **World:** **the first customer walks in through the office door and sits in
  the room she booked, because the row exists** (bridge `booking-added`). Failure:
  she waits at the door, checks her phone, leaves with a "?"; the drone shows her
  trail (section 3).
- **Next:** "Ada wasn't sure it worked" (feature request) -> S10.

### O6, O7 then S10 · "Did it work?" (O6/O7 kept 20 min; S10 20 min) · Sam · JS first meeting

- O6 and O7 (kept) teach a first JavaScript program and reading its errors.
- **Goal (S10):** "Members want to see 'Booked: Boardroom, Friday 10:00' straight
  away, without the page going blank."
- **Builds:** `app.js`: on submit, `fetch` the endpoint with the form's values as
  JSON, show the confirmation in the page.
- **New idea `fetch-json`:** the page asks the server in the background and reads
  its JSON answer. Learn card: `addEventListener('submit', ...)`,
  `event.preventDefault()`, `await fetch(url, { method, body })`, `res.json()`.
  Worked example: the staff-meal form showing "Order 12 sent". The PHP side
  returns JSON (`[201, ['id' => ..., ...]]`), a small recall of S9.
- **Acceptance:** the customer submits, the page is not reloaded (the driver's
  page marker survives), and the page's visible text afterwards contains the room
  name and the start time **of the row the server created** (id from the world).
  **Cheat:** printing "Booked!" (or echoing the form's own values) without asking
  the server: customer 2 types a room name the server refuses (S9's handler finds
  no such room), the world has no row, the page still says Booked: fails ("Ben
  was told he was booked; he wasn't"). A confirmation built from the form fields
  rather than the server's reply also fails the id check.
- **World:** a confirmation bubble pops over the customer's head with the text his
  page showed, then they walk in.
- **Next:** "Can people see what's free before booking?" -> S11.

### S11 · What's free on Friday (25 min) · Sam

- **Goal:** "Members keep booking taken slots and getting turned away by Priya.
  Show them what's already booked in a room on a day."
- **Builds:** `slots.php` (GET, returns the day's bookings as JSON) and JavaScript
  that renders them into the page.
- **New idea `render-text`:** build elements and set their `textContent` from data.
  Learn card: `document.createElement`, `.textContent`, `.append`; why not
  `innerHTML` (one line: data must not become code; the full reason is P7).
  Worked example: rendering the specials list from an array.
- **Acceptance:** customers open the page, choose the Boardroom and Friday, read the
  list; the list must equal the truth for that room and day **on the real world
  and the shadow world** (the site runs twice). **Cheat:** a hand-typed list in
  HTML fails on the shadow world; filtering by room only (forgetting the day)
  fails because the shadow world has a Thursday booking in the Boardroom.
- **Open space:** server filters (SQL `WHERE`, recall of T16) or client filters (JS
  `.filter`); list, table or timeline; time formatting. Both layers pass; the
  credit goes to the construct used (PC-13).
- **World:** customers read the street screen and pick a free slot; the drone
  highlights booked slots in the room.
- **Next:** launch day.

### S12 · Launch day (checkpoint, 25 min) · Sam and Priya

- **Goal:** "Harbour Street goes live tomorrow at nine. Ten members will try it."
- **Builds:** nothing new: whatever is missing. Calibration prompt first: "How
  many of the ten will book successfully?" (predict, then compare).
- **Acceptance:** ten scripted customers, deterministic and varied (different
  rooms, a member not yet in `people`, one who reads the free list first, two who
  want adjacent slots 10-11 and 11-12, one on a phone-width viewport). Pass: every
  valid booking exists, every customer saw a true confirmation. No messy or hostile
  input yet. **Cheat:** any earlier cheat; the adjacent-slot pair catches an
  over-eager overlap rule (`<=` instead of `<`).
- **World:** the office morning: members walk in one by one as their rows appear.
  The company's first income appears in the ledger (economy plan). The bedroom
  -> small office move unlocks when both revenue and M1 are confirmed.
- **Evidence:** the checkpoint is unscaffolded and counts toward the milestone;
  the arc's honest statement here: "You built a small booking site end to end with
  help on every first step: a database you designed, a form, a PHP endpoint that
  saves safely, and a page that reads it back." (Provisional until re-earned.)
- **Next:** the natural problems (section 2) start the next real day.

---

## 2. Natural problems

The director (section 3.7) serves a problem when its **trigger** holds in the world,
in his schema or code shape, and in the skill meter (a due skill prefers a problem
that needs it). Every trigger is a real state he can inspect. "Revisits" are the
earlier skills the problem silently needs (spaced recall in a new form). "Check"
is the honest acceptance. Learning-design ids in brackets are the cards they
realise.

| # | Problem (their words) | Trigger (world state) | Cause | Exercises | Check | Revisits |
|---|---|---|---|---|---|---|
| P1 | "On my phone the Book button is tiny and the page is wider than the screen." (Sam) | S12 done; his page at a 375 px viewport has horizontal scroll or a button under 44 px | client feature request | `css-rule` (selectors, `width`, `padding`, viewport meta) | driver at 375 px: `scrollWidth <= clientWidth`, button box >= 44 px tall (computed style) | html-element, form |
| P2 | "The list says Studio twice." (Priya) | duplicate room names exist (from S2) or Tom's import adds one | messy input | `unique` constraint, finding duplicates (`GROUP BY ... HAVING`) | catalogue `UNIQUE` on name; probe duplicate insert -> `23505`; no duplicates left | delete, where, create-table |
| P3 | "Two members turned up for the Boardroom at ten." [T21, T33] | two customers book overlapping slots through his site (the director schedules it only if his endpoint has no overlap check) | growth and scale | `overlap` in PHP (check before insert), returning 409 | scripted pair: second gets 4xx with a message, no clash row; adjacent slots both succeed | overlap (SQL, T19), prepared-param |
| P4 | "Tom's import log: 3 rows where the end is before the start." | Tom's import or a customer submits end < start, and `bookings` has no such CHECK | messy input | `check-constraint`; validation in PHP with a 422 | probe insert end<start -> `23514`; customer with swapped times gets a readable error | create-table, form |
| P5 | "Siobhan O'Neill can't book. The page just says error." | a customer named O'Neill is scheduled; the director sends her only if his PHP glues strings (PC-13 code shape) | messy input | prepared-param (unaided recall, real use) | O'Neill's booking exists; a probe name `x'); DELETE FROM bookings; --` is stored verbatim | prepared-param |
| P6 | "Someone typed 'asdf' as their name and booked 1 to 1." | a scripted customer submits blanks, `asdf`, zero-length slots | messy input | validation at every layer (`required`, JS check, PHP check, `NOT NULL`/`CHECK`) | server rejects with 422 even when the driver bypasses the page's JS (direct request) | form, check-constraint |
| P7 | "A member's name shows up in bold and a pop-up appears." [T77] | a person row contains `<b>` or `<img onerror>` (a real signup); fires only if his render uses `innerHTML` (code shape) | rules and security | XSS: `textContent`, escaping in PHP (`htmlspecialchars`) | driver detects no element/handler created from data; the markup text is shown literally | render-text |
| P8 | "Our insurer asks: could someone type SQL into the booking form?" (Grace, compliance) | P5 solved; review of all his endpoints | rules and security | injection review of his own and Maya's code [T44] | a scripted attacker request on every endpoint changes nothing (world unchanged check) | prepared-param, investigate |
| P9 | "Two people got the last Boardroom slot at the same second." [T66a] | S12 + P3 done with a PHP-only check; the interleave hook (3.5) | growth and scale | a database guarantee: `EXCLUDE` constraint (PC-2) and turning `23P01` into 409 | interleaved pair: exactly one row, the other customer gets 409 | overlap, foreign-key, check-constraint |
| P10 | "Can members cancel? They ring me now." (Sam) | customers with future bookings exist | feature request | soft delete (`cancelled_at`, `IS NULL`) [T27, T28] | cancel endpoint sets the column; availability no longer lists it; history kept | update, render-text, fetch-json |
| P11 | "Cancelled bookings still block the room." | P10 done and his overlap check ignores `cancelled_at` | others' code (his own earlier code, still correct for its time) | `IS NULL` in the overlap rule, both layers | a customer books a cancelled slot successfully | overlap, P10 |
| P12 | "Since the clocks went forward, our 9 o'clock bookings show at 10." [T60, T61] | real calendar reaches a DST change (or Helen's school data straddles one) and his column is `TIMESTAMP` or his JS formats in UTC | messy input | time zones: `TIMESTAMPTZ`, `AT TIME ZONE 'Europe/London'`, `Intl` (PC-12) | customers' slots on both sides of the change render and save at the right local time | timestamp-type, render-text |
| P13 | "Oakfield Primary signs. Their staff mustn't see Sam's bookings." [T35, T74] | a second client is signed (business state) | feature request then security | tenancy: `client_id`, scoping every query, checking it in PHP | a scripted Oakfield user requesting Harbour Street's id gets nothing (world and response) | foreign-key, prepared-param, where |
| P14 | "We need logins. Store passwords properly, the insurer asks how." [T71] | P13 done | rules and security | `password_hash` / `password_verify`; never plain text. Not a whole login on its own: beside it, M-P3 (sessions, cookie flags `HttpOnly`/`Secure`/`SameSite`, `session_regenerate_id` at login) and M-P4 (a CSRF token on every form that changes data) | catalogue: no plaintext column; probe login right/wrong; hash differs per user | create-table, prepared-param |
| P15 | "A member cancelled someone else's booking by changing the number in the link." [T73] | P10 + P14 done; a logged request in his access log shows it (a real event) | rules and security | authorisation: check ownership server-side | replayed request (PC-17) now returns 403 and changes nothing | P10, P14 |
| P16 | "Priya needs to manage rooms, members mustn't." | P14 done | feature request | roles (`role` column, checks in PHP; later PC-3 SQL roles) | member gets 403 on room edits; Priya succeeds | P14, P15 |
| P17 | "Harbour Street's page takes ages now." [T68, T69, T69a] | `bookings` passes 50,000 rows (growth via the importer of a big client) | growth and scale | `LIMIT`/paging, an index chosen from `EXPLAIN` (PC-11) | plan contains an index scan on his index; endpoint returns at most N rows per page | limit, order-by, where |
| P18 | "Maya changed the booking endpoint and now nobody can book." [T98] | a colleague's commit (visible in history with author, message and diff) | other people's code | read a diff, reproduce, fix at the right layer, reply | customers book again; his fix keeps Maya's intent (her new field still saved) | prepared-param, investigate |
| P19 | "The availability page is wrong: the Studio's free and it shows booked." (Helen) | the page is right; Helen is looking at the wrong day | misunderstanding [T32a] | investigate before changing; reply with evidence | reply grading: the root cause chosen; world unchanged | investigate, where |
| P20 | "For ISO 27001 we must say who changed any booking, and when." [T86] | Grace joins (business state after P13) | rules and security | audit trail (trigger or PHP writes an `audit_log`) | every change by a scripted customer appears in the audit log with who and when | create-table, foreign-key |
| P21 | "Each member company's hours for October, so I can bill." [T65] | a month of bookings exists in the world | report | `SUM`, `GROUP BY`, `JOIN` | rows equal truth on both worlds | where, time-range |
| P22 | "A lab wants to book a microscope, not a room." [T48] | a lab client signs | feature request (schema change) | migration: `ALTER TABLE`, generalising rooms to resources without breaking the site | his site still passes the S12 customers after the migration, and lab customers book kit | create-table, foreign-key, the whole site |
| P23 | "Write a test that proves the double-booking fix stays fixed." (Maya) [T46] | P9 done; Maya's review asks for it | others' code | a PHP `assertSame` test (PC-14) | his test fails on the buggy version, passes on his fix and the reference | overlap, prepared-param |

**Reopen logic (honest).** A problem reopens only when a cause he can find exists
in the world: a colleague's commit in the history panel that touched his file
(P18), new data his rule did not cover that he can query (P11 after P10, P12 on the
DST date), or a new client whose requirements differ (P13). The director never
edits his code silently and never "breaks" working code. A colleague's change
always arrives as a visible commit with author, time, message and diff; new data
always arrives through a visible source (a customer, Tom's import, a client
signing). A review of a solid skill arrives as a **new** problem needing it (P5 is
skipped if his PHP already uses parameters; the director instead serves P8, an
injection review of Maya's search endpoint, which needs the same skill).

**Twins for guards he already has.** P2, P3, P4, P9 and P11 each have a twin
served when his guard already exists: "the database refused Priya's entry, she
wants a kinder message" (turn the SQLSTATE into a clear 4xx in PHP). Same concept
cell, real work, no punishment for having been careful.

---

## 3. The engine

### 3.1 What runs where

```
Grimoire page (origin O)
 ├─ World: PGlite, main thread (the truth; the 3D office reads it)
 ├─ sandbox client.js  ── port ──► host-js.html  (opaque)  learner JS for tickets  [exists]
 │                     ── port ──► host.html     (opaque)  PHP worker + SQLite    [exists]
 │                     ── port ──► host-site.html (opaque, NEW)
 │                                   └─ <iframe sandbox srcdoc> the learner's site + driver
 └─ customer runner (NEW): runs a script, routes the site's requests to the PHP
    host, applies each request's writes to PGlite, snapshots the world per customer
```

All requests from the learner's site to "the server" go **through the parent**:
site -> host-site -> parent (customer runner) -> PHP host -> parent -> PGlite ->
parent -> host-site -> site. Nothing in the site can reach the network or the
Grimoire origin.

### 3.2 The site runtime: `KINDS.site` and `host-site.html` (new, M)

- Request `{ kind: 'site', files, script, world?, viewport, clock, seed, timeoutMs }`;
  response `{ ok, trail: [step results], requests: [...], dom: snapshot, error? }`.
- `host-site.html` CSP: `default-src 'none'; script-src 'unsafe-inline'; style-src
  'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none';
  frame-src 'self' about:`. A `srcdoc` child inherits this policy, so the learner's
  page has no network at all.
- The host builds the learner's page: `index.html` with his `style.css` and
  `app.js` inlined at their `<link>`/`<script src>` references (other paths ->
  "file not found" in the trail), plus a **driver prelude** injected first in
  `<head>`. The prelude captures pristine references (`Element.prototype` methods,
  `dispatchEvent`, `FormData`), replaces `fetch` with a port-backed fake (PC-6),
  pins `Date` to the office clock (PC-9) and seeds `Math.random`.
- Form submissions are intercepted in the capture phase (`submit` on `document`),
  serialised with their `method`/`action`, and routed like a fetch; a PHP string
  body becomes the next page (the frame's new `srcdoc`, prelude re-injected), so a
  plain non-JS form works too.
- Spike SP2 decides the nesting: child `sandbox="allow-scripts allow-forms"` with
  the driver only inside the child (talking over a transferred port), or
  `allow-same-origin` so the child shares host-site's opaque origin and the host
  reads its DOM directly. Either way the Grimoire origin is unreachable. **Grading
  integrity, stated plainly:** his own page runs in the same realm as the driver,
  so it could in principle tamper with it. Writes are judged from the world
  (PGlite), never from the driver; only display checks (what the customer read)
  rely on the driver, which captures its references before his code runs.
  Tampering with the grader of one's own exercise is out of the threat model.

### 3.3 The PHP request harness (extends `runners/php.js`, M)

- Project files: `*.php` at the root are routes (`book.php` answers `/book.php`
  and `book`). Each route file defines
  `function handle(array $input, PDO $pdo): array` returning `[int $status,
  string|array $body]`. From P13/P14 the signature grows `array $user` and
  `DateTimeImmutable $now` (PC-7, PC-9). Arrays are `json_encode`d with
  `Content-Type: application/json`.
- `$input` is the merge of query string, form fields and a JSON body (as frameworks
  do); `$_GET`, `$_POST` and `$_SERVER['REQUEST_METHOD']` are also populated, so a
  learner who reads them is not wrong, but the Learn cards teach `handle`.
- The wrapper (same sentinel technique as today) includes the file, calls
  `handle`, and prints one JSON envelope `{status, body, log, error?: {message,
  file, line, trace}}`. An uncaught exception is a 500 with the trace (PC-17); no
  `handle` function, or a wrong return shape, is a plain-words error.
- **Mirror, per request:** the SQLite copy is built from his PostgreSQL schema
  (catalogue -> SQLite DDL, PC-4) and rows; after `handle` returns, the harness
  diffs SQLite before/after and the parent **replays that diff into PGlite inside
  one transaction**. Spike SP3 measures rebuild-per-request against a persistent
  SQLite kept in step by diffs (preferred if it holds up).
- **What PostgreSQL rejects that SQLite accepted** (a regex `CHECK`, an `EXCLUDE`
  not yet mirrored): the replay rolls back, the request is recorded as failed with
  "your PHP saw success on the practice copy, the real database refused: <PG
  error>". His PHP never had the chance to turn that into a 409, and the trail says
  so; problems that grade the 409 path (P9) use the mirrored trigger (PC-8) so the
  error is raised **inside** his PHP with SQLSTATE `23P01`.

### 3.4 PostgreSQL vs SQLite: honesty table

| Rule in his schema | Mirrored in SQLite | How |
|---|---|---|
| `NOT NULL`, `PRIMARY KEY`, `UNIQUE` | yes | DDL |
| `REFERENCES` | yes | DDL + `PRAGMA foreign_keys = ON`; SQLSTATE mapped to `23503` by the harness PDO subclass |
| simple `CHECK` (comparisons, `AND/OR`, `IN`, `length`, `IS NOT NULL`) | yes | translated from `pg_get_constraintdef`; untranslatable -> next row |
| `CHECK` with PG-only functions/operators (`~`, `date_trunc`) | no | enforced at replay (3.3); said in the trail |
| `EXCLUDE USING gist` | yes, as a trigger | PC-8: `BEFORE INSERT/UPDATE` trigger raising; PDO subclass rethrows as `23P01` |
| column types | partly | SQLite is dynamically typed: a PHP insert of `'abc'` into an integer column succeeds on SQLite and is refused at replay |
| defaults, `SERIAL`, `now()` | yes | translated; `now()` -> the office clock |
| roles, RLS, `GRANT` | no | SQL track only (PC-3) |
| triggers he writes (P20) | no | audit via PHP is checked through PHP; a PG trigger is checked by SQL probes |

The learner is told once, on the PHP Learn card of S9 and in the Codex: "In this
game PHP talks to a practice copy of your database (SQLite). Real Siso-style PHP
talks to PostgreSQL directly. Your SQL is checked on real PostgreSQL." Spike SP5
checks whether a PGlite-backed PDO driver exists for php-wasm at a version we can
pin (unverified; if it does, most of this table disappears).

### 3.5 The customer driver (new, M)

A customer is data, not code:

```js
{ id: 'ada', name: 'Ada Okafor', viewport: 390, steps: [
  { visit: '/' },
  { fill:   { label: /name/i,  value: 'Ada Okafor' } },
  { choose: { label: /room/i,  option: 'Boardroom' } },        // select, radio or text
  { fill:   { label: /start/i, value: '2026-01-09T10:00' } },
  { fill:   { label: /end/i,   value: '2026-01-09T11:00' } },
  { click:  { role: 'button', name: /book/i } },
  { expect: { text: ['Boardroom', '10:00'], within: 1500 } },
], wants: { booking: { room: 'Boardroom', start: '2026-01-09T10:00Z' } } }
```

- **Finding things** follows the accessible name, the way real UI tests find
  elements: a `label` (wrapping or `for`), `aria-label`, then the button's text.
  A miss is a plain sentence listing what the page does have ("inputs named
  `who`, `when`; no label mentions 'room'").
- **Acting:** `fill` sets `value` and dispatches `input` and `change`; `click`
  calls the pristine `click()`; `choose` handles `select`, radios and text.
- **Bad inputs** are later step options (`value: "O'Neill"`, `value: ''`,
  `direct: true` to send a request without the page, for P6/P8), never present
  before the stage or problem that introduces them.
- **Concurrency (P3, P9):** the **interleave hook**: the harness PDO subclass,
  on request A's first write statement, first executes request B's already
  captured write (B ran against the same pre-A snapshot). This is "another request
  committed between your check and your insert", deterministic and real: a PHP-only
  check lets both through; a constraint makes A's write fail inside his code.
- **Determinism:** fixed office clock, seeded random, customer scripts in a fixed
  order, a fresh world snapshot per run, no wall-clock waits except `within`
  budgets (polling the DOM every 25 ms).
- **Time budget:** per customer at most 2.5 s (page build ~50 ms, PHP warm 3-6 ms a
  request plus the mirror), per run at most 10 customers and 20 s; the parent kill
  switch destroys host-site and the PHP iframe at 25 s. Customers run sequentially
  and the office animates each as it finishes, so latency reads as people
  arriving, not as a spinner.

### 3.6 Reporting failures

- **Trail card** per customer (2D window): each step with tick or cross, the first
  failing step in one sentence ("Ada pressed Book. Your server answered 500:
  `Undefined array key "room"` in book.php line 4"), the request and response,
  the PHP trace, the rows changed. Free to read (debugging tools are free).
- **3D:** success: the customer walks from the street screen through the door to
  the room (bridge `booking-added`, attributed to the customer by matching the new
  row's values to `wants`). Failure: the customer stops at the door, a speech
  bubble with what they experienced ("It said booked... it isn't?"), shakes their
  head and leaves (new event `customer-left`, **from the trail**, shown in a
  different style from world events, so the office never pretends a row exists).
- The story order per customer: their trail events, then the world diff of their
  requests (`diffWorlds(before_i, after_i)`), then the next customer.

### 3.7 The director (new, M)

Pure function `nextProblem(worldFacts, codeFacts, meter, business, day)`.
`worldFacts` from catalogue queries (has FK? `CHECK`s? column types? row counts,
duplicate names); `codeFacts` from PC-13 shape detection on his files (`innerHTML`,
string-glued SQL, overlap check present, `cancelled_at IS NULL` present);
`business` from the economy (clients signed, days active). Each problem declares
`trigger(facts)`, `twin(facts)`, `needs`, `revisits`. Tested in node with fixture
facts. Pace rule and soft gate from the learning design unchanged.

### 3.8 New platform work vs reuse

| Piece | Status | Size |
|---|---|---|
| `World.create({ empty: true })`, no SCHEMA, no seed | new option on `world.js` | S |
| DDL log (every successful `CREATE`/`ALTER` he ran, replayable) | new, `world/ddl-log.js` | S |
| Check kinds `schema` (catalogue query) and `probe` (SQL in `BEGIN...ROLLBACK`, expect rows or SQLSTATE) | new in `card.js` | S |
| Shadow world from DDL log replay + generated rows via his columns | new | M |
| Office from rows: rooms, cabinets, people from his tables | `office.js` change | M |
| Schema-driven views and write-back (PC-4) | replaces `TABLES` in `views.js`, `php.js` | M |
| Project files (multi-file editor, tabs, history with authors) | `editor.js`, new `project.js` | M |
| `KINDS.site`, `host-site.html`, prelude, fake fetch, form capture | new | M-L |
| Customer driver + scripts | new `game/customers/*` | M |
| PHP request harness (`handle`, envelope, trace, mirror DDL, replay) | extends `php.js`, `host.js` | M-L |
| Interleave hook, SQLSTATE mapping PDO subclass (PC-8) | new PHP prelude | M |
| Trail card, `customer-left` event, per-customer diff | `windows.js`, `story.js`, `bridge.js` | M |
| Director | new `game/problems/director.js` | M |
| Card templating for ids/names from his world | `card.js` | S-M |
| Reused unchanged | sandbox kill switch and handshake, `diffWorlds`, story playback, progress/credit, spells store, meter, hint ladder, Learn card UI | — |

---

## 4. How it fits what exists

### 4.1 The 23 cards

| Card(s) | Fate | Notes |
|---|---|---|
| tutorial | kept, re-hosted | steps "world" and "query" point at the notebook (S0) and, later, his rooms; the `SELECT * FROM bookings` starter becomes `rooms` |
| O1, O2 | re-hosted in S0 | interact grading on the notebook grid instead of the office; same concepts, same evidence rules |
| O3, O4, O5, T01, T02, T03, T04, T08, T10 | kept, S3 | run on his `rooms`; their truths are queries, so they work on any valid table; T04 "Ten, not eight" needs the Boardroom at 8 (true: S2's notebook) |
| T06 (insert) | replaced by S2 | concept `insert` moves to S2; the Garden Room appears later as a natural "new room" event (recall of insert, unaided: evidence) |
| T11, T13, T14, T16, T17, T18 | kept, S6 | need bookings: run after Tom's import of the named week through his schema |
| O6, O7 | kept, before S10 | unchanged (JS on-ramp on plain objects) |
| O8 | kept, before S9 | unchanged, now against his schema (PC-4) |
| T19 (overlap) | kept, S6 | the SQL form of the rule P3 and P9 need later |
| T21 (double booking) | kept, end of S6, then **becomes** P3/P9 | the hand fix stays (a one-off on imported data); the recurring problem is P3 (customers through his site) and the guarantee P9 (= T53) |

Literal ids in card text and truths (13 references to `ROOM.*`/`PERSON.*` or
`room_id = 1`) become templates resolved from his world by name
(`{room:Boardroom}`). Ordering in `ladder.js` becomes `ARC = [S0, S1, S2, O3...T10,
S4, S5, S6-cards, S7, S8, O8, S9, O6, O7, S10, S11, S12]`; `checkLadder` gains the
rules "every `schema`/`probe` card's tables were created by an earlier card" and
"a site card's files exist".

### 4.2 Which cards still need a seeded world

Only the S6 cards and T21 need more rows than he would type. They get them from
**Tom's import** (a visible script through his schema, `named.js` data), not from a
hidden seed. The shadow world for query-graded cards is built from his DDL log
plus `named.js`'s shadow rows inserted through his columns. The Playground keeps
today's seeded world (free practice, not his company).

### 4.3 Saves

The life record (`progress.js`) gains `arc: { stage, choices }` (company name,
recorded schema decisions for the director). The world save is the PGlite dump
(existing `World.restore`), plus the DDL log and the project files (`project:
{ files, history }`). A world that fails to restore is rebuilt by replaying the DDL
log and the recorded data changes (honest: nothing he built is invented). Existing
lives: section 7, Q5.

### 4.4 The Grimoire and pace

New spells (one per new idea): `create-table`, `timestamp-type`, `foreign-key`,
`html-element`, `form`, `prepared-param`, `fetch-json`, `render-text`, then the
problems' `css-rule`, `unique`, `check-constraint`, `validate-input`, `escape-output`,
`tenant-scope`, `password-hash`, `authorise`, `exclusion`, `soft-delete`, `index`,
`audit-trail`, `migration`, `test-assert`. Each lists its forms per language where
they exist. **Cross-language chunks** (patterns page, "what is this an instance
of?" in recaps):
- **Keep data out of code:** `$pdo->prepare` + `?` (PHP), `textContent` (JS),
  `htmlspecialchars` (PHP output), never string-building SQL in any language.
- **Guard at every layer, guarantee in the database:** `required` (HTML), a JS
  check, a PHP 422, a `CHECK`/`EXCLUDE` (SQL). P4, P6, P9 each add one layer.
- **Check then act is a race:** P3 -> P9.
- **Store the moment, show the local time:** S4, P12.

Pace rule unchanged: at most 5 new concepts a calendar day, a new one only after
the previous new one had an unaided solve; stages S1-S12 add 8 new ideas, so the
build stages alone span at least 3-4 days, more with the kept cards' 17 concepts.
Never blocks play: when the cap is reached the director serves recall work
(combination tickets: "the Library now seats 14 and its page must say so" =
`update` + the page re-check, no new idea).

### 4.5 Learning-science rules applied

- **Retrieval:** every stage after a first meeting starts blank; recalls are real
  use (people table = create-table recall; the S11 server filter = `WHERE` recall in
  PHP). Codex before first run is recorded as nudged.
- **Variants in a new language:** overlap is met in SQL (T19), used in PHP (P3) and
  JavaScript (S11 client-side filter or a P3 front-end check); prepared parameters
  in PHP, then reviewed in Maya's code (P8).
- **Interleaving:** problems from P1 on arrive unlabelled; the director mixes
  causes and languages; H2 names the concept and costs credit.
- **Explain-it closed book:** S5 ("why did it refuse room 7?"), P5 ("why did an
  apostrophe break it?"), P9 ("why wasn't the PHP check enough?"), P19 (the reply).
  Practice only, never evidence.
- **Calibration:** S12 and every customer run with more than three customers
  ("how many will succeed?").
- **No learning styles:** the 3D world is feedback on the real state, not an
  alternative "visual" route to the concept.

---

## 5. Honesty and pace

**What he must produce vs what is shown.** Shown: the goal, the acceptance in plain
words ("ten members will try to book; each must end up booked and told so"), the
Learn card and a worked example on different data for a new idea only, the trail of
any failing customer. Never shown: the schema he should write, the page structure,
the handler body. The generation effect without cruelty: the first meeting in each
language is scaffolded (L0-L3), errors are explained in plain words, the trail
always says which step failed and why, hints are one click away with the cost shown
first, and nothing is ever lost (the world can be reset to the stage start; the DDL
log makes that exact).

**Credit** follows the learning design table unchanged: clean, nudged, guided,
exposure. Additions:
- A stage passes on outcome. Credit per concept is by construct used (PC-13): a
  S11 solve with a SQL `WHERE` credits `where` in PHP-hosted SQL, a JS `.filter`
  credits `filter` in JavaScript.
- A customer-run pass after reading the trail is clean (debugging is free); a pass
  after H4 is exposure.
- First meetings (S1, S7, S9, S10 and their kept on-ramps) never count as evidence.
- **Passed, weak** (learning design section 1): S9 with string-glued SQL passes and
  is recorded weak for `prepared-param`, with the edge named ("names with
  apostrophes") and P5 scheduled; it is not presented as broken.

**What counts as mastery:** unchanged (Can do -> Working after 3 days -> Held after
21 days, unaided and fresh). S12 and the problems P3, P5, P9, P13, P15 are the arc's
evidence-bearing work; "I built the site" is not a mastery claim by itself.

**Hours (honest estimate, to calibrate in play tests).** Designed first-attempt
time: S0-S12 about 3.5 hours; the kept cards about 3 hours; P1-P23 about 15-25
minutes each, about 7 hours. About 13-14 designed hours. A true beginner takes 2-3x
(errors, Codex, retries): 30-40 hours; recalls, variants and twins add roughly half
again: **about 45-60 hours of play** for the arc through P23, which reaches roughly
the learning design's M3 plus parts of M4 and M5. With the pace rule (about 45 new
concepts at most 5 a day, each needing an unaided solve before the next) the
calendar floor is about 2 weeks; realistically **6-10 weeks at 45-60 minutes a
day**. The game shows his own projection, never a promise.

**What the arc cannot teach or verify (said in the game):**
- Real HTTP: headers, cookies, sessions, CORS, caching, a web server's config.
  Requests are simulated faithfully at the level of method, path, input, status
  and body.
- PHP against PostgreSQL (SQLite practice copy, 3.4), Composer, frameworks,
  multiple PHP files beyond simple routes until PC-10.
- Real concurrency (simulated deterministically by the interleave hook).
- Browser differences, real devices, accessibility beyond labels and tap sizes.
- Visual design quality: CSS is checked for function (fits the phone, button tap
  size, clash slots red), not taste.
- Deployment, git, backups, monitoring: the bridge step B1 stays outside the game.
- Anything specific to Siso's products beyond the stack named in `CLAUDE.md`.

---

## 6. The build plan

### Spikes first (each a throwaway harness under `scripts/browser/`, a short report)

| Spike | Question it answers | Size |
|---|---|---|
| SP1 PGlite DDL | Can learner `CREATE TABLE` run in the live world, be introspected (`information_schema`, `pg_constraint`, `pg_get_constraintdef`), probed in `BEGIN...ROLLBACK` without disturbing his state, logged and replayed into a shadow PGlite identically? Dump size with 0 and 50k rows? | S |
| SP2 nested site | In an opaque `host-site.html`, does a `srcdoc` child inherit the CSP; which nesting lets the driver see the DOM; do synthetic `input`/`click`/`submit` work on plain forms; can the fake `fetch` round-trip over the port; can the child reach `top`, storage or the network (must not); page build time? | M |
| SP3 PHP request | `handle()` with an envelope, status/body/trace capture, warm latency per request with mirror rebuild vs a persistent SQLite synced by diffs; 5k-row tables. | S-M |
| SP4 mirror fidelity | Which `pg_get_constraintdef` outputs translate to SQLite; SQLSTATE mapping through a PDO subclass; the interleave hook (an extra write inside `execute()` before the first write) behaves as a committed concurrent request. | M |
| SP5 PHP on PGlite | Is there a pinnable php-wasm release with a PGlite-backed PDO? If yes, can it share the main-thread PGlite (it cannot cross the iframe; it would need its own copy)? Decides whether 3.4 shrinks. | S |
| SP6 office from rows | Can `office.js` lay out 1-12 rooms and N people from his tables with the art pack slots, and animate a room appearing? | S |

### Milestones (each shippable, tested, and playable on its own)

**M-A · An empty company and its first table (S0-S2). Size M.** `World.create({
empty })`, DDL log, check kinds `schema` and `probe`, S0 notebook interact, S1 and
S2 cards with cheats, office cabinets and rooms lit from his rows, tutorial
re-hosted. Files: `game/world/world.js`, new `game/world/ddl-log.js`,
`game/problems/card.js`, new `game/problems/arc/{s0,s1,s2}.js`, `ladder.js`,
`game/play/office.js`, `chapter.js`. Tests: node tests for probe/schema checks and
the cheats (TEXT capacity, double insert); a Playwright playthrough of S0-S2 with
the reference solutions; a world restore from the DDL log.
*Value: the vision's first sentence is playable: an empty company, his tables,
his rooms in the office.*

**M-B · Queries on his own data (S3). Size M.** Card templating by name, shadow
world from DDL log replay, the nine kept on-ramp cards re-hosted; `checkLadder`
rules. Files: `card.js`, `chapter1/*` (templating only), `named.js` (shadow rows
via columns), `ladder.js`.

**M-C · People, bookings, links, Tom's import (S4-S6). Size M.** S4, S5 with its
branch, the import script and log as an in-world artefact, the kept S6 cards and
T21 on imported data, schema-driven views (PC-4 read side) so the office and
`bridge.js` work from his columns. Files: `views.js`, `office.js`, new
`arc/{s4,s5,import}.js`. *Milestone M1 reachable.*
*Built 2026-10-05 (branch game-product-arc):* `arc/{s4,s5,s6,sheet,scripts}.js`. The colleagues'
scripts run once, when their ticket arrives, through his tables, and join his log as their entries
(before the Reset mark); S5's branch is a card variant fixed on arrival; O6-O8 stay where they were
in the ladder and run on his company read-only (the JS/PHP write side stays with M-F); T21's clash is
Priya's morning booking (a script, not a hidden setup).

**M-D · The site preview (S7). Size M-L.** `KINDS.site`, `host-site.html`,
prelude, the project-files editor (HTML first), the preview window, DOM text
checks, the street-screen in 3D. Files: `game/sandbox/{host.js,client.js}`, new
`host-site.html`, `game/play/{editor.js,windows.js}`, new `game/play/project.js`.
Tests: `test_sandbox` extended (escape attempts from the site), a site check test.

**M-E · Customers and the form (S8). Size M.** The customer driver, scripts,
trail card, `customer-left` story event, form capture to "nowhere". Files: new
`game/customers/{driver.js,scripts.js}`, `story.js`, `bridge.js` (attribution),
`windows.js`.

**M-F · Saving bookings from the site (O8 re-hosted, S9). Size L.** PHP request
harness with `handle`, envelope and trace, mirror DDL from his catalogue, diff
replay into PGlite, PC-4 write side, routes from project files, the first customer
walking in from a real row. Files: `game/runners/php.js`, `game/sandbox/host.js`,
`views.js`, `game/customers/*`.

**M-G · JavaScript on the site (O6, O7, S10, S11). Size M.** Fake fetch to the
harness, JSON bodies, the shadow-world second site run, PC-13 construct
detection for credit. Files: host-site prelude, `game/customers/*`, `progress.js`
(construct credit), new `arc/{s10,s11}.js`.

**M-H · Launch day and the director (S12, P1-P6). Size L.** Director with
triggers and twins, the ten-customer day, calibration prompt, economy hook (first
income), bad-input customer steps, the first six problems. Files: new
`game/problems/director.js`, `arc/s12.js`, `problems/natural/*`.

**M-I · Security and races (P7-P9, P13-P16). Size L.** XSS detection without
execution side effects, the interleave hook and PC-8 trigger mirror, `$user` in
`handle`, logins with `password_hash`, replayed requests (PC-17).

**M-J · Growth (P10-P12, P17-P23). Size L.** Soft delete, DST (PC-12), 50k rows
(PC-15, PC-11 plan grading; the PHP mirror needs the persistent SQLite from SP3 or
a scoped copy), colleague commits in history, audit, reports, migration, PHP tests
(PC-14).

Order is strict up to M-F (each needs the previous); M-G to M-J can interleave with
the learning design's Act 2-3 work.

---

## 7. Risks and open questions for Lawrence

**Biggest risk (engineering):** the PHP practice copy (SQLite) diverging from his
PostgreSQL schema, so correct PHP fails or wrong PHP passes. Mitigation: SP4 and
SP5 before M-F; replay every PHP write into PostgreSQL and report a refusal
plainly; never grade a PostgreSQL-only rule through PHP unless it is mirrored.
Second risk: scope. M-A to M-F is roughly six to eight weeks of build at the
current pace; M-A alone is playable and should ship first.

1. **Naming freedom.** Free names everywhere need a schema adapter on every card,
   the bridge and the office (about +1 L milestone). *Recommend:* a house
   convention for table, key, link and time column names, stated once by Priya as
   real teams do; types, constraints, extra columns, pages and code are his.
2. **Whose company.** *Recommend:* yours. You are the founder-developer in your
   bedroom; Priya stays as co-founder (she runs the business side and the
   notebook), Sam is the first client, Tom and Maya join later as in the learning
   design. You name the company at S0. Do you want Priya as co-founder, or a solo
   start with Priya joining as the first hire?
3. **PHP on SQLite.** *Recommend:* run SP5 first; if no pinnable PGlite PDO
   exists, accept the practice copy with the plain disclosure in 3.4. Is that
   honest enough for your goal of Siso-ready PHP?
4. **How hard the blank editor is at S1.** For zero PostgreSQL knowledge, S1's
   L0-L3 scaffold (run, one token, one line, blank) is the gentlest version that
   still makes you produce the table. *Recommend:* keep it; if play tests show S1
   over 20 minutes, add an L1.5 (fill one blank column).
5. **Existing saves.** *Recommend:* a life that already started the old chapter
   keeps its spells, credit and meter; its world is rebuilt by the arc, and stages
   whose concepts it already holds are served as unaided recall (evidence), not as
   teaching. Or would you rather start fresh?
6. **Labels required by customers.** Customers find fields by label, like real
   test tools and screen readers. A page without labels fails S8 even if it
   "looks fine". *Recommend:* keep it (real-world, teaches accessibility for free);
   hint H1 says why the first time.
