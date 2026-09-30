# Grimoire Game — Learning Design

Status: draft for review (2026-10-01). Companion to
`2026-09-30-grimoire-game-design.md` (section 11 is the direction this follows).
This is the course the director serves: what is taught, in what order, how it
is checked, how it comes back for review, and what the player can honestly say
he can do at each point.

The company in the game is fictional (working name **Slotwise**), a small
booking-platform business in the spirit of Smarthub and Smartlab. Nothing here
is a claim about Siso Software beyond the stack and mindset listed in the brief
(PHP, PostgreSQL, HTML/CSS, REST/JSON, booking domain, ISO 9001/14001/27001
habits: security, audit, clean structure, efficient queries).

**Starting point: zero.** The design assumes Lawrence has no working knowledge
of PostgreSQL, JavaScript or PHP: no syntax, no tools. His CS degree is
general background only (he may recognise ideas; he is never assumed to be
able to type them). So the course starts *before* syntax: what a table, a row
and a column are (the bookings table *is* the timetable on screen), what a
query is, what running code and a variable are, how to read an error, and how
to look something up. Every symbol is introduced the first time it appears.

**Numbering.** Tickets have stable ids (`O1`-`O8` for the on-ramp, `T01`-`T101`
for the ladder). The order he meets them is the *serve position* `#1`-`#109`, plus
lettered positions such as `#38a` for tickets added after review, then the work
samples WS1-WS3 at `#110`-`#112`
(section 8 gives the full order); the recall map (section 9) uses positions.

---

## 1. Honest progression (binding on everything below)

1. **Progress is demonstrated competence, never time, clicks or tickets seen.**
   Business growth (new clients, districts, office upgrades), levels and every
   "You can now..." statement are earned only by **clean solves of fresh
   problems**. A *fresh* problem is one whose exact form he has not seen: new
   data, a new surface (other table, other sector, other wording), and ideally
   another language. Re-solving a ticket he has already passed earns nothing
   (the Playground is free for that).
2. **Hints are honest help and cost credit** (table below). A solve that used
   the worked example is *exposure*, not mastery, and the concept comes back
   soon as a fresh variation.
3. **Real developer workflow, not quiz steps.** Every bug ticket follows:
   reproduce, investigate (read data, logs, the colleague's code), find the root
   cause, fix, verify, reply. From Act 2 the ladder includes the rest of the
   job: debugging someone else's code, writing a test that proves a bug is
   fixed, reviewing a colleague's change and proving the defect, estimating the
   impact of a change, a client whose diagnosis is wrong, "it works but it's
   wrong", "it's not a bug, the client misunderstood", and performance and
   security investigations.
4. **Clear, true statements of ability at every milestone** (section 7), each
   phrased as what he can do at work unaided, each backed by the list of clean
   solves that earned it. No titles, no "master".
5. **Calibrated to junior-to-mid work at a booking-software company**, and
   plain about what the game cannot teach or verify (section 13).
6. **Mastery must hold over time.** A skill counts as *Working* only after two
   clean fresh solves separated by at least 3 days, and as *Held* only after a
   clean fresh solve at least 21 days after the previous evidence. A failed or
   assisted review drops the skill back a step and its milestone statement
   shows "needs refresh" until it is re-earned.

### What each kind of help costs

Running code, reading error messages, seeing which checks fail, searching the
Codex on his own and experimenting in the Playground are **free**: real
developers do all of these. What costs credit is the game handing him the
thinking.

Opening the Codex *before* his first run on a recall ticket is recorded (the
solve then counts as "nudged"), because producing it from memory first is the
point (section 2). After a first attempt, the Codex is free again.

The stability change `S -> S'` uses the recall `R` estimated at the moment of
the review (formula in section 2, item 3). `g(R) = e^(2(1-R))`, so a review at
R = 0.9 gives g = 1.22 and one at R = 0.75 gives g = 1.65.

| Help used on the solve | Counts as | Stability change | Milestone evidence? |
|---|---|---|---|
| None (free tools only) | **clean** | `S' = S x min(4, 1 + 1.5 g(R))`, x 1.3 more if fast ("the gap was too short"); x 1.1 at most if already solved clean today | yes, if the problem was fresh |
| Hint 1: nudge (where to look, no concept named), or Codex opened before the first run | **clean, nudged** | `S' = S x min(3, 1 + 0.8 g(R))` | yes, but a skill cannot reach *Held* on a nudged solve |
| Hint 2: concept named | **guided** | `S' = S`, next review within 3 days | no |
| Hint 3: the exact Codex entry opened for him | **guided** | `S' = S`, next review within 2 days | no |
| Hint 4: worked example (a solved sibling problem, different data) | **exposure** | `S' = max(1, 0.3 S)`; a fresh, one-step-easier variant next session | no |
| Failed even with hint 2, or gave up and viewed a reference solution | **exposure, not yet** | `S' = max(1, 0.3 S)`; an easier variant later in the same session (after 2 other tickets), then next day | no |

Three more honesty rules: on-ramp tickets and the first ticket in each language
(O1-O8, T01, T05, T07) are scaffolded, so they never count as evidence;
re-reading, watching a worked example or recognising an answer never counts
(only producing it does); and a solve that passes the ticket but fails the
hidden robustness probes (section 10) is recorded as **passed, weak**: the
reply still goes out, the stability gain is halved, he is told which edge case
it missed, and a *new* problem with that edge (another client, day or
language) is scheduled at the half interval. It is not presented as his code
breaking.

**Recall credit only for what the solution used.** A solve credits a concept
cell only if the submitted code actually contains that construct (detected in
the code: `UPDATE`, `DELETE`, `JOIN`, `.filter`, `foreach` and so on). A
ticket that accepts two approaches credits whichever one he used.

### Skill levels (per concept x language cell)

`Not met` -> `Seen` (exposure) -> `Practised` (guided solve) -> `Can do` (one
clean fresh solve) -> `Working` (two clean fresh solves, at least 3 days apart)
-> `Held` (a clean, un-nudged fresh solve at least 21 days after the previous
evidence). Milestone statements show *provisional* while any listed cell is at
`Can do`, and *confirmed* when all are `Working` or better.

**What counts as milestone evidence:** only the recall-map "U" solves (clean,
unaided, not the teaching ticket, a different form) and fresh variants of those
concepts, plus the act checkpoint. A teaching ticket solved straight after its
Learn card and worked example is fluency, not evidence (section 2, item 1).

---

## 2. Learning science the game runs on

Lawrence chose a video summary of established memory research as the basis.
The ideas below are the research's, in our words, with the researchers named;
each rule says what the game does because of it.

1. **Storage strength vs retrieval strength; the fluency illusion** (Robert
   and Elizabeth Bjork, the "new theory of disuse"). How easily something comes
   to mind *right now* (retrieval strength) is not how well it is kept
   (storage strength); the two can even move in opposite directions. Feeling
   fluent is a poor guide. *Game:* re-reading a Learn card, watching a worked
   example or recognising a right answer earns nothing; only producing it in a
   new problem does. When a solve felt quick straight after teaching, the recap
   says so plainly: "Easy today is not the same as kept. It comes back in a
   few days to find out."
2. **Retrieval, not review** (Roediger and Karpicke: testing yourself beats
   re-studying for long-term retention). *Game:* after a concept's first
   worked example, every later use asks him to *type* it before any help is
   shown. The Codex and hints are one click away, but opening them before the
   first run is recorded (section 1). Recall tickets are the main event; there
   are no lesson pages to re-read.
3. **Spacing until almost forgotten** (Bjork's desirable difficulties;
   Ebbinghaus's curve). A retrieval that is effortful but successful builds
   more storage strength than an easy one. *Game:* the director aims each
   return of a concept at the "tip of the tongue" zone, **estimated recall
   0.75-0.85 (the sweet spot)**, not while it is fresh and not after it has
   gone. Bands: *fresh* R >= 0.85; *sweet spot* 0.75-0.85 (the scheduling
   target); *late* 0.70-0.75 (served before sweet-spot items); *due* < 0.70
   (overdue).
   **Change to Phase 1's `nextStability`** (in `game/memory/curve.js`, which
   multiplies stability by a fixed 2.5 for any clean solve): the gain must
   depend on recall at the time of review, as in FSRS-style models.
   - Elapsed time is **fractional days**, `t = (now - last) / DAY`. Phase 1's
     `daysSince` floors to whole days, so a review 20 hours later would read
     `t = 0, R = 1` and look like a same-day repeat; `daysSince` stays for
     display only.
   - `g(R) = e^(2(1-R))`. `nextStability(S, outcome, R, fast, cleanToday)`:
     clean `S x min(4, (1 + 1.5 g(R)) x f)` with `f = 1.3` if *fast*, else 1 (the bonus sits inside the x4 cap); nudged
     `S x min(3, 1 + 0.8 g(R))`; guided `S`; failure or exposure
     `max(1, 0.3 S)`. The caps (x4, x3) and a maximum stability of 180 days
     stop one lucky recall at very low R from pushing a gap past a year.
   - *Fast* means under the ticket's median solve time (designer estimate
     until play data exists) with no failed runs.
   - *Same day* means within 12 hours of the last clean solve of that cell
     (not the calendar day, so midnight gives no reset): the
     second one gives `S' = S x min(1.1, 1 + 1.5 g(R))` and any later one that
     day gives `S' = S`.
   - Unit tests: clean at R = 0.9 gives x 2.83; clean at R = 0.75 gives
     x 3.47; clean at R = 0.3 gives x 4 (capped); guided gives x 1; exposure
     gives `max(1, 0.3 S)`; a second clean solve the same day gives at most
     x 1.1; S never exceeds 180.
   So recalling a more faded memory raises stability more; an easy fast solve
   means the gap was too short, so the next gap grows a lot; failing even with
   the concept hint means the gap was too long, so it returns soon, one step
   easier (a starter line in the editor). `THRESHOLDS` change from Phase 1's
   fresh 0.9 / fading 0.7 to the bands above.
4. **Interleaving** (Rohrer and Taylor: mixing problem types beats blocking
   them, because choosing the method is itself the skill). *Game:* after a
   concept's foothold (its teaching ticket and one follow-up), tickets arrive
   **without a label** naming the concept or tool: the quest panel shows only
   the symptom and the objective. Choosing the approach is part of the task;
   hint 2 names the concept and costs credit. Consecutive tickets mix concept
   types and languages. Practice accuracy *will* drop compared with blocked
   practice; the game says so once, early, and whenever his first-try rate
   dips: "Mixed practice feels harder and works better."
5. **Explain it with the source closed** (self-explanation; Chi and colleagues).
   Some tickets end with a client or Maya asking "why did that happen?"; he
   writes two or three plain sentences with the editor and Codex hidden. Then
   the game shows a model explanation and a 3-4 point checklist so he sees the
   exact gap. Self-judgement is unreliable (see 7), so this is gap-finding
   practice, **never mastery evidence on its own**. Explain steps are marked
   "Explain" in the ladder.
6. **Chunks, not facts** (Chase and Simon: experts see meaningful patterns,
   not pieces). *Game:* the course teaches named **patterns** that recur
   across tickets and languages. Each has a Codex pattern page linking its
   SQL, JavaScript and PHP forms and every ticket where it appeared; he builds
   a visible pattern collection. Recaps ask "What is this an instance of?"
   (he picks from his collection; getting it right adds the ticket to that
   page). Later tickets combine patterns.

   | Pattern | First met | Forms |
   |---|---|---|
   | Find by key | T03 | `WHERE id = ?`, `.find`, prepared lookup |
   | Filter rows | T10 | `WHERE`, `.filter`, `array_filter` |
   | Sort and take the top | T17 | `ORDER BY ... LIMIT`, `.sort` + `[0]` |
   | Investigate before you change | T11 | read-only queries, logs, audit |
   | Overlap of two time ranges | T19 | `a.start < b.end AND b.start < a.end`, `&&` |
   | Count per group | T25 | `GROUP BY`, object tally, PHP array tally |
   | Look up across two tables | T30 | `JOIN`, `.find` by id, one query not N |
   | Keep the ones with no partner | T32 | `LEFT JOIN ... IS NULL`, `NOT EXISTS` |
   | Soft delete (keep the record) | T27 | `cancelled_at` |
   | All or nothing | T39 | `BEGIN/COMMIT`, `beginTransaction` |
   | Never trust input | T22 | prepared statements, `textContent`, scoping |
   | Validate then save | T37 | PHP checks, form checks, constraints |
   | Make it impossible, not tidy | T36 | constraints, `EXCLUDE` |
   | Fail loudly, handle kindly | T54 | exceptions, 409, `res.ok` |
   | Prove it with a test | T46 | JS and PHP asserts |
   | Estimate before you change | T45 | counts before updates |
   | Scope to the tenant | T74 | `client_id` from the user, RLS |

7. **Calibration** (people judge their own learning poorly; Kornell and Bjork
   on the illusion of competence). About one ticket in four during Acts 1-2
   (where the fluency illusion is strongest) and one in five after that, the
   quest panel asks "Will you solve this without hints?" (yes /
   not sure / no). The pattern collection shows prediction against reality
   over time, so he learns to trust retrieval over feeling.
8. **No learning styles** (Pashler, McDaniel, Rohrer and Bjork found no good
   evidence that matching teaching to "visual" or "hands-on" types helps).
   *Game:* nothing is designed around a style. The 3D world is used because it
   carries meaning (the bookings table *is* the timetable; a clash is two
   blocks in one slot), not to suit a type of learner.
9. **Desirable difficulty with ADHD-friendly rewards.** Rewards are frequent,
   short and visible, but they pay for the right thing. Three currencies:
   - *XP* pays every clean solve, scaled by effort: a clean recall in the
     sweet spot pays 3 units; a clean fresh variant of a cell already solved
     clean today pays 1 (small, but not nothing, so a long night still feels
     rewarded); re-solving a ticket he has passed pays 0.
   - *Office upgrades and cosmetics* come from XP.
   - *Business growth* (clients, districts, scale steps) moves only when cells
     reach `Working`, so it tracks proven skill, never ticket count (section 5).

   Struggle is framed briefly and positively ("That was hard because it was
   nearly forgotten; that is when it sticks best."), one line, never a
   lecture. A visible *sweet-spot streak* (recalls caught in the sweet spot in
   a row) replaces any count of what is due.

---

## 3. How you know what to do, and how you learn

Every ticket uses the same loop, so he always knows the next move:

1. **Ticket and objective.** The ticket window shows who, their words (the
   symptom), and a one-line **objective** in the quest panel ("Find Priya's
   booking"). After a concept's foothold, the objective never names the tool.
2. **Learn card, only the first time a concept appears:** 3-5 lines, one
   example tied to something visible in the world, no jargon; then a **worked
   example** he runs and watches change the world; then the task.
3. **Codex:** every keyword, symbol and function, each with a tiny runnable
   example on the live world. Searching it is a skill taught at O5.
4. **Hint ladder, always there, honest about credit:** 1 nudge, 2 which
   concept, 3 the Codex entry, 4 a worked example (costs in section 1).
5. **Recap after the solve:** two lines naming what he just did in plain
   words, and "What is this an instance of?" from his pattern collection.

**Scaffold levels** (how much of the code is written for him): *L0* run it
and watch; *L1* change one token; *L2* write one line with a starter; *L3*
blank editor. Each language's first tickets go L0 -> L1 -> L2 before any L3;
The first blank editor in each language is always a ticket with **no new
keyword**: SQL at T11 (#13, an investigation using only recalled SQL),
JavaScript at the planned recall `v@#28` (a date filter on another list), PHP
at T33a (#41a, recall only). Every ticket that brings a new keyword before
then has a starter (L2).

**Explain steps are skippable** in one click, with no penalty and no nagging.
**Long tickets are split into steps** of at most 3-5 minutes, each with its
own visible world change (a tile, a drone action, confetti) and a step tracker
in the quest panel; this applies to every ticket over 5 minutes, checkpoints
and work samples included.

**Language pacing and why.** SQL first (O1-O5, then T01-T17): it is the
closest to plain English, it acts directly on the timetable he can see, and
every later JavaScript and PHP ticket reads or writes the same data. Then
JavaScript basics (O6-O7, T05, T09, T12) once he can already say what he wants
from the data; then PHP basics (O8, T07, T15), which *contain* SQL, so a PHP
query is one new idea rather than two. Only after all three have a foothold
(position #25) do tickets interleave across languages. Starting all three at
once would put three unfamiliar syntaxes in front of him before any one of
them has a place to attach to.

### The flow in full for the first five tickets (#1-#5)

The on-ramp teaches what the tools *are*. No typing from memory yet; none of
it counts as evidence; each takes about a minute.

**#1 · O1 · "The timetable is a table"** — Priya: "I've put our first bookings
in. Can you find mine? It's the one at ten on Monday."
- Cause: report or question.
- Objective: *Find Priya's booking.*
- Learn card: "Everything the business knows lives in **tables**. The
  timetable you see *is* the `bookings` table. Each block is a **row**. Each
  fact about it (room, person, start, end) is a **column**." Picture: a
  booking block lifts out of the diorama and unfolds into a row with labels.
- Worked example: click any block; its row lights up in the table window.
- Task: click Priya's 10:00 Monday booking, then its row.
- Codex unlocked: table, row, column.
- Hints: 1 "Monday is the first column of the timetable." 2 "Rows and
  blocks are the same thing." 4 replays the worked example.
- Check: the selected row is Priya's booking.
- Recap: "You found one row in a table. Every question you'll answer is
  'which rows?' and 'which columns?'." Pattern: *Find by key* (preview).

**#2 · O2 · "Numbers that point"** — Priya: "Which room is booking 7 in? The
table just says 2."
- Cause: report or question.
- Objective: *Find which room booking 7 is in.*
- Learn card: "Every row has an **id**, its unique number. `room_id = 2`
  in a booking means 'the room whose id is 2', which lives in the `rooms`
  table." Picture: a line draws from the booking's `room_id` to the Studio's
  row.
- Worked example: follow booking 3's `person_id` to the person.
- Task: follow booking 7's `room_id` and answer with the room's name.
- Codex: id, linking by id.
- Hints: 1 "The answer is in another table." 2 "An id points at a row
  elsewhere." 4 the worked example again.
- Check: answer is the right room on both worlds.
- Recap: "You followed an id from one table to another. Later a query will
  do this for thousands of rows at once." Pattern: *Look up across two tables*
  (preview).

**#3 · O3 · "Asking a question"** — Priya: "Clicking is fine for three rooms.
What happens when we've a hundred?"
- Cause: report or question.
- Objective: *Run the query and see what comes back.*
- Learn card: "A **query** is a question typed in SQL, the database's
  language. **Running** it sends it to the database and shows the answer.
  `SELECT * FROM rooms;` means 'show every column of every row in rooms'."
  Each symbol is labelled: `*` "every column"; `;` "end of the question".
- Worked example: the query is already typed (L0). He presses Run; the result
  panel fills and every room glows in the diorama.
- Task: press Run, then answer "How many rooms came back?"
- Codex: query, Run, `SELECT`, `FROM`, `*`, `;`.
- Hints: 1 "The Run button is under the editor." 4 shown already.
- Check: he ran it and the number is right.
- Recap: "You sent a question and got rows back. Code only does something
  when you run it."

**#4 · O4 · "Reading an error"** — Priya: "I tried to ask about rooms myself and
got a red message. What did I do?"
- Cause: other people's code.
- Objective: *Read the error and fix Priya's query.*
- Learn card: "An **error** is the computer telling you exactly what it
  could not understand, and roughly where. Read three things: *what* (the
  message), *where* (the line, the word near it), *what it expected*. Errors
  are help, not failure."
- Worked example: `SELECT * FORM rooms;` runs; the message says syntax error
  at or near "FORM"; the word is underlined; he watches it fixed to `FROM`.
- Task (L1, one token): Priya's `SELEC * FROM rooms;`. Change one word.
- Codex: error messages, "syntax error at or near".
- Hints: 1 "Look at the word the message quotes." 2 "Spelling of a keyword."
  4 the worked example.
- Check: the query runs and returns the rooms.
- Recap: "You read an error and fixed the word it pointed at. That habit is
  half of debugging."

**#5 · O5 · "Looking it up"** — Priya: "Can the list come out in name order? I
don't know if the database can do that."
- Cause: client feature request.
- Objective: *Find the Codex entry that sorts, and run its example.*
- Learn card: "Nobody remembers everything. The **Codex** holds every word
  you've met and every one you haven't found yet. Search it by what you want
  to do ('sort', 'count', 'only some')."
- Worked example: search "first", open `LIMIT`, press its Run button.
- Task: search "sort" (or "order"), open the entry, run its example on
  `rooms`.
- Codex: the Codex itself (search, entries, runnable examples).
- Check: the sorting entry was opened and its example run.
- Recap: "You looked something up by what you wanted to do. Later you'll use
  it after you've tried from memory, which is how it sticks."

T01 then applies the same loop to real SQL at L0 -> L1 -> L2 (section 8).

### Symbols, introduced the first time they appear

| Symbol | Language | Means | First at |
|---|---|---|---|
| `*` `;` | SQL | every column; end of statement | O3 |
| `,` | SQL | separates a list | T02 |
| `'...'` | SQL | text value (single quotes) | T03 |
| `=` | SQL | in `WHERE`: "is equal to" (compares) | T03 |
| `=` | SQL | in `SET`: "becomes" (stores); both meanings taught side by side | T04 |
| `( )` | SQL | groups a list of columns or values | T06 |
| `<` `>` `<=` `>=` `<>` | SQL | comparisons | T10 |
| `--` | SQL | comment, ignored | T13 |
| `::int` | SQL | "treat this as a whole number" (a cast) | T23 |
| `&&` | SQL | "these two ranges overlap" (cross-linked: JS `&&` means "and") | T52 |
| `->>` | SQL | "this field of the JSON, as text" (looks like PHP `->`; the Codex shows both) | T88 |
| `.` `( )` | JS | "the part called"; "run this" | O6 |
| `=` | JS | **only** stores a value (SQL used `=` both to compare in `WHERE` and to set in `SET`) | O6 |
| `//` `"..."` `'...'` | JS | comment; text | O6 |
| `[ ]` | JS | a list; item by position | T05 |
| `{ }` | JS | a block of lines that belong together | T09 |
| `===` `!==` | JS | "is exactly equal"; `==` is avoided because it converts types first (Codex shows `'1' == 1`) | T12 |
| `new` | JS | "make a new one of these" (`new Date(...)`) | T20 |
| `&&` `\|\|` `!` | JS | and, or, not | T20 (`&&`), T26 (`\|\|`, `!`) |
| `=>` | JS | a short function | T24 |
| `` `...${}` `` | JS | text with values inside | T38 |
| `??` | JS | "or, if missing" | T29 (given in the starter) |
| `<?php` `$` | PHP | start of PHP; every variable starts with `$` | O8 |
| `->` | PHP | "use this object's ability" (`$pdo->query`) | O8 |
| `.` | PHP | joins text (unlike JS) | O8 |
| `$row['name']` | PHP | a value by its key | T15 |
| `[ ]` | PHP | a list literal (`execute([$id])`) | T22 |
| `if` `else` `!` `\|\|` `&&` | PHP | deciding; not; or; and | T30a |
| `$list[] = ...` | PHP | "add to the end of this list" | T30a |
| `=>` | PHP | key to value in an array (unlike JS) | T40 |
| `::` | PHP | a class's own function | T37 |
| `==` `===` | PHP | loose vs strict comparison; the Codex shows the loose trap (`"abc" == 0` was true before PHP 8) and cross-links JS `==` | T37 |
| `<=>` | PHP | "compare: -1, 0 or 1" (for `usort`) | T66 |

Every row is a Codex entry; each entry for a symbol that means different
things in different languages (`=`, `.`, `=>`, `&&`, `->`/`->>`) links the
other meanings.

---

## 4. Principles

- **One new idea per ticket.** Everything else in the ticket is something he
  has already met. Where a ticket needs a small supporting fact (a function
  name, quoting a string) it comes from the Codex, not as a second lesson.
- **Symptoms, not instructions.** People say what they see ("two groups turned
  up for the Boardroom"), never what to type. No term is used in a symptom or a
  hint before the ticket that teaches it.
- **Worked example before the first independent task** in each language, and
  on demand (hint 4) afterwards, always on different data from the ticket.
  First tickets per language climb the scaffold L0 -> L1 -> L2 before any
  blank editor (section 3).
- **No labels after the foothold.** The "New idea" field in the ladder is
  designer metadata. The player sees it (as a Learn card) only on the ticket
  that teaches it; afterwards tickets show only the symptom and objective.
- **Hint ladder:** 1 nudge (where to look), 2 which concept, 3 the Codex entry,
  4 worked example. Costs as in section 1.
- **Codex:** a reference entry for every keyword and function a ticket needs,
  unlocked the first time a ticket needs it (listed per ticket below), always
  searchable afterwards, each entry with a two-line runnable example on the
  live world. Entries dull on screen as the linked skill fades.
- **Outcome grading, twice.** Any valid solution passes. Answers and functions
  are checked on the real world *and* on a hidden **shadow world** (same shape,
  different data), so typing the answer you eyeballed fails. Every ticket names
  at least one cheat that must fail.
  - *Shadow-world invariants:* the ids and names of named entities (the named
    rooms, Priya, Sam, Helen and the other named people, every client, site
    and resource named in a ticket) are the same in both worlds; bookings,
    capacities, dates, unnamed people and row counts vary. So `WHERE id = 3`
    for Sam is legitimate; hard-coding an *answer* or a *booking id found by
    eyeballing* is not.
  - *Grading mode per ticket* (a `grading` field on the card): **query** (an
    answer, function or endpoint; graded on both worlds and by probes) or
    **one-off data fix** (graded on the real world only, with invariants that
    protect everything else and the named cheats). One-off data fixes: T04,
    T06, T13, T21, T33, T36 (the data part; its constraints are probed), T52,
    T60, T72 (the merge), T90, T91, T98. Every other ticket is *query*.
  - *Named seed:* the world seed uses the named rooms and people of the story
    (Boardroom, Studio, Library; Priya, Sam...), replacing Phase 1's "Room 1"
    and "Person 1"; worked examples use the same names.
- **Interleaving rules.** Once all three languages have a foothold (from #25): never
  more than two new tickets in a row in the same language; each new concept is
  revisited in another language within the next 3-6 tickets (the *transfer*
  ticket); a review set never takes more than half its items from one language.
- **Review scheduling.** Each skill x language cell has a forgetting curve
  (`game/memory/curve.js`, with the `nextStability` change in section 2).
  Bands: fresh R >= 0.85, **sweet spot 0.75-0.85** (the target: the director
  serves a ticket that needs the concept while it is here), late 0.70-0.75,
  due < 0.70. Reviews are always new problems that need the concept (fresh
  variants, often in another language, or genuine reopens, section 10), never
  the same ticket again and never a quiz.
- **Start of every session: the overnight set.** The session opens with the
  cells that entered the sweet spot, went late or went due since the last
  session: at most 8, or 10 when genuine reopens are pending; at most 3
  reopens and at most 2 per concept family; due first, then late, then sweet
  spot. For flow it opens with one quick win (the easiest item in the set),
  then runs *3 recalls, 1 new ticket, 3 recalls...* until the set is cleared,
  rather than 8-10 reviews in a row. Overflow rolls to the next session, most
  overdue first.
- **Caps so review never becomes a wall.** If the backlog passes 20, new
  tickets slow to one per three reviews instead of the set growing, and
  overdue intervals are re-spread so they do not all land on one day. After
  the opening set, one review is slipped in after every 3 new tickets if
  anything is in the sweet spot. The 5-minute session is 2 recalls and 1 new
  ticket at most. Play is never blocked.
- **Difficulty grows with the business**, not with arbitrary puzzles:

| Act | World size | What makes it harder |
|---|---|---|
| 1 Founding | 3-4 rooms, 5 people, about 20 bookings | nothing; you could eyeball it, but the shadow world means you must query |
| 2 First clients | 2 clients, 8 rooms, 40 people, 300 bookings | too many to eyeball; time ranges; cancellations |
| 3 Growth | 5 clients, sites, 2,000 bookings, a junior colleague | tenants must not mix; other people's code; APIs and a front end |
| 4 Districts | 10 clients across sectors, 10,000 bookings | sector rules (training, capacity, terms, money, time zones) |
| 5 Scale and security | 12 clients, 50,000 bookings, users and roles | slow queries, attackers, privacy, least privilege |
| 6 Audit and compliance | five years of history | audit trail, retention, incidents, end-to-end features |

  The world sizes are *reached* when skills are proven, not by ladder
  position: each scale step (300 -> 2,000 -> 10,000 -> 50,000 bookings), new
  client and new district is triggered by the cells it needs reaching
  `Working`, and each Act opens only when the previous Act's milestone is
  *confirmed* (not merely provisional). Until then the director keeps serving
  recall, combination and review tickets in the current Act.
- **The company calendar runs on real days.** The company's Day N is his real
  Day N (real days since his first session). Rules:
  - time is real calendar time from the device, replaced by server time once
    synced; if the clock ever goes backwards, it is ignored: elapsed time `t`
    is never lowered and nothing earned is ever un-earned;
  - each ticket *instance* stores its own "today" (the real date when it was
    served), so its checks stay deterministic however long he takes;
  - seeds and truth queries for relative-time tickets ("last month", "this
    week", "ninety days") are computed from that stored date, and the runtimes
    answer "now" with it (platform capability PC-9, section 14);
  - weekends and evenings exist in the story: a ticket served on a Saturday
    comes from a client working the weekend, not from a Monday.

---

## 5. Time, sessions and long nights

### Ticket length and session shape

- On-ramp and Act 1 tickets take 1-3 minutes; Act 2 3-5; Act 3 4-10; Acts 4-6
  5-15, always split into steps of at most 3-5 minutes with a step tracker.
- 5-minute session: up to 2 recalls and 1 new ticket. A normal session (20-30
  minutes): the overnight set (section 4: one quick win, then 3 recalls, 1 new,
  3 recalls...), then new tickets with a recall after every 3. A break prompt
  every 25 minutes (one click "carry on"; a prompt, never a lock).

### The pace rule

- **At most 5 new concepts per calendar day (target 4-5).** Cramming new
  material gives strong same-night fluency and weak storage (section 2,
  item 1).
- **The gate:** a new concept is served only after *every* earlier new concept
  has had one unaided solve: clean, not the teaching ticket, in a problem that
  forces the concept (usually the next ladder ticket or a planned `v@`
  variant, section 9).
- **What counts as a new concept:** every ticket that shows a Learn card,
  including each on-ramp item O1-O8 and each lettered ticket that teaches.
  Checkpoints (T18, T34, T47, T67, T85), work samples (WS1-WS3), recall-only
  tickets (for example T33a) and Codex-only notes (`OR`, `SERIAL`, `::int`)
  count as 0. A T17-style "learn by look-up" ticket counts as 1.
- **Consequence, stated plainly:** #1-#26 hold 25 new concepts (O1-O8 and 17
  teaching tickets), so Act 1 takes at least 5-6 days at 4-5 a day; "M1 in the
  first week" is true only for daily play. The whole ladder holds about 111
  new concepts (8 on-ramp, 93 teaching T-tickets, 10 lettered), so at least
  about 22 playing days even at the maximum pace; with the six Act gates (each
  waits 2-3 days for confirmation) at least about 35 playing days.
- **After the day's cap**, the director serves only recall, combination and
  larger tickets that use known concepts, reopens, and skippable explain
  steps; never another new concept. Play is never blocked.
- **Same-session repeats barely change what is kept,** and the game says so.
  Only the first clean solve of a cell each day uses the full stability
  formula; the second clean solve that day multiplies stability by at most
  1.1, and later ones that day change nothing. Mastery needs unaided recall
  after days (*Working* needs clean solves at least 3 days apart), and
  business growth tracks proven cells, not ticket count.
- **Stopping.** The end-of-session summary always ends with a gentle
  recommendation to stop, and the reason: "Sleep is when today's learning
  settles in. This is a good place to stop." After 90 minutes it also appears
  once mid-session. It never locks anything.

### Worked example: a 50-ticket night and the two days after

Stabilities below follow section 2 (a new cell starts at S = 3 days; its
first clean recall at R near 0.95 multiplies S by about 2.7, to about 8 days;
with S = 8 the sweet spot 0.75-0.85 falls about 1.3-2.3 days later, so a
concept learnt on day N is usually in its sweet spot on day N+2).

**Before the night.** Day 1: O1-O5 (5 new). Day 2: T01, T02, T03, T04, T06
(5 new). Day 3: T08, T10, T11, T13, T14 (5 new). Each was followed by its
gate recall.

**Day 4, the night.** He plays three hours and clears 50 tickets, starting at
#16. The day-1 cells are not in tonight's set: they reached the sweet spot on
day 3, were served in day 3's opening set and are now fresh (S about 27).

1. *Opening and the new concepts, interleaved.* The overnight set holds the 5
   day-2 cells now in the sweet spot (R about 0.78): SELECT, columns, WHERE,
   UPDATE, INSERT, each as a fresh variant ("the Library's seats", "the Studio
   was set up wrong", "a new member, Jo"...). The session runs: quick win
   (SELECT), 3 recalls (columns, WHERE, UPDATE), then **T16** (#16, time
   filters, new) and its gate `v@#16a` "the Studio on Tuesday", then the last
   recall (INSERT), then **T17** (#17, LIMIT by look-up) and its gate `v@#17`
   "the last booking in the Library on Friday", then **O6** (#18, program and
   variable) and its gate "total seats of the Garden Room and the Library",
   typed from memory, then **O7** (#19, JS errors) and its gate, a fresh
   "Unexpected token" fixed unaided, then **T05** (#20, `world.rooms.length`)
   and its gate "how many rooms and people are there altogether?" (a sum of
   two lengths, not T05's own example). Each new concept is served only after
   the previous one's gate was solved clean. That is 15 tickets; the daily cap
   of 5 is reached and T09 is not served tonight.
2. *The other 35 tickets*, none new:
   - 16 SQL combination tickets from the Act 1 families (filter, sort and take
     the top, time filters, find by key then fix), each a new problem, for
     example "Sam's Friday bookings, earliest first" and "the smallest room
     free on Tuesday morning";
   - 7 one-off data fixes (wrong capacity, a duplicate person, a mistaken
     booking to cancel);
   - 4 not-a-bug investigations (T11 family: "the Studio won't take six");
   - 4 JavaScript counting variants (T05 family, other lists);
   - 4 explain steps (skippable), after T11 and T16 variants.
   Most of these hit cells already solved clean tonight, so they pay 1 XP; the
   second clean solve of a cell today adds at most x 1.1 and later ones add
   nothing.
3. *On screen after a same-night repeat*, for example the sixth WHERE: "WHERE:
   solved 6 times tonight. The first counted fully; the rest add almost
   nothing. The next one that really counts is on Thursday."
4. *End-of-night summary:* "Tonight: 5 new ideas, each solved once more on your
   own. 5 skills caught in their sweet spot. 35 practice tickets kept today's
   skills warm; more solves on the same day add almost nothing to what you
   keep (that is how memory works, not a flaw in you). Sleep is when today's
   learning settles in. This is a good place to stop. Tomorrow: 5 skills in
   their sweet spot."

**Day 5, start.** Meter: the day-3 cells are in the sweet spot (ORDER BY,
comparisons, investigate first, DELETE, AND; R about 0.78); the day-4 new
cells are fresh (R about 0.88); tonight's recalled cells are fresh (S about
25, R about 0.96). Opening set: those 5 sweet-spot cells, with the quick win
first, then the interleaved pattern. New concepts today (at most 5, gated):
T09, T12, O8, T07, T15.

**Day 6, start.** Meter: the day-4 new cells are now in the sweet spot (time
filters, LIMIT, JS program and variable, JS errors, JS lists): 5 items, served
first. Then T18, the Act 1 checkpoint (0 new). Act 2 opens only when M1 is
*confirmed* (each M1 cell `Working`: a second clean fresh solve at least 3 days
after the first), which is day 8 at the earliest, because the last Act 1 cells
were first recalled on day 5. Days 6-7 therefore serve no new concepts:
recall, combination tickets and larger Act 1 jobs (a "set up the pilot"
task combining several patterns), with an honest line in the quest panel:
"Act 2 opens when your Act 1 skills have held for a few days. Everything today
strengthens them." If he did not play on day 1-3 at full pace, the same days
simply move later.

**Day 1 is a special case.** Only O1-O5 exist, so "recall" would be drill. After
the 5 new ideas and their gates the director serves world-exploration tickets
(find a booking by clicking, follow an id), Playground challenges marked
"practice, no credit" (change a word in a given query and watch the world),
and after about 30 minutes the gentle stop: "You've met 5 new ideas today,
which is about the most that sticks. Anything else tonight is practice with no
credit. Sleep is when it settles; see you tomorrow."

### Honest timescales

- **Projection from his own rate.** The game shows a range, never a date,
  recomputed after each session from his measured pace: "At your current pace
  (about N clean new concepts a week, M review minutes a day), M4 in about 5-7
  weeks."
- **Realistic range for a zero-knowledge learner** (reviewer estimate, to be
  calibrated by play tests). Designed first-attempt time: about 15 hours for
  O1-O8 and T01-T101, about 45 minutes for the 11 lettered tickets, and 4-9
  hours for WS1-WS3 done twice (40-90 minutes each pass): about 20-25 hours in
  all. A true beginner typically takes 2-3 times the designed time (errors,
  the Codex, retries), and recalls, variants and reopens roughly double that
  again. **In-game M6 is therefore about 80-150 hours**: roughly 5-10 months
  at 30 minutes a day, or 2-5 months at 1-1.5 hours a day. **Job-ready**,
  adding the bridge (git, a local PHP + PostgreSQL setup, one small project of
  his own; about 40-80 hours), is **about 120-230 hours**. His CS background
  and this narrow stack may make it shorter; nothing in the game promises it.

### Seasonal tickets on a real-day calendar

No symptom states a fixed date or season. Every date in a ticket is a template
computed from the ticket instance's stored "today", always pointing at a real
future or recent date that exists whenever he plays:
- T60 and T61 (clock changes): about **the next** UK clock change (last Sunday
  of March or October): "Our timetable for next term shows every lesson after
  the clocks change an hour late." Seeds straddle that real date.
- T62: "next term" (from the `terms` table, generated relative to today).
- T65: "last month's hours".
- T45: "the fortnight starting next Monday".
- T52: "from the 1st to the 3rd of next month".
- Weekday words ("this Friday", "Monday morning") in Acts 1-2 are the next or
  most recent such day relative to today.
If a real event is near (a clock change within a fortnight), the director may
serve the matching ticket then, as a bonus in season, but never waits for it.

---

## 6. The story arc

**Act 1 — Founding (O1-O8, T01-T18).** Priya Shah, co-founder, has typed three rooms
into a brand-new, almost empty system. Harbour Street Co-working (Sam Fletcher)
agrees to pilot it. You learn to read, find, sort and change single rows.

**Act 2 — First clients (T19-T34).** Sam signs; Oakfield Primary (Helen Price,
school office manager) joins; Tom Okafor joins as support lead. Time ranges,
double bookings, counting, cancellations and joining tables.

**Act 3 — Growth (T35-T47).** More clients means tenants that must not mix.
Maya Chen joins as a junior developer: her code, her pull requests. The first
JSON API and front end.

**Act 4 — Sector districts (T48-T67).** New districts on the diorama: the lab
(Dr Anil Rao, Westbrook University chemistry lab), the gym (Jess Morgan, Pulse
Fitness), the school district grows (terms), the council (Martin Hughes,
Hartley District Council halls) and co-working invoicing. Each brings real
domain rules.

**Act 5 — Scale and security (T68-T85).** 50,000 bookings, user accounts, a
clinic (Claire Doyle, Riverside Physio) with privacy needs, and the first
attacks. Performance, authentication, authorisation, tenant isolation.

**Act 6 — Audit and compliance (T86-T101, then WS1-WS3).** Grace Adeyemi,
quality and compliance manager, prepares for ISO audits: audit trails,
retention, access reviews, an incident, and a final end-to-end feature. The
Act ends with three unscaffolded work samples: a feature end to end, a bug in
a contractor's unfamiliar plugin, and a real review.

Each Act opens only when the previous milestone is *confirmed* (section 4);
the company's days are his real days.

---

## 7. Milestones: what he can honestly say

Each statement cites only **unaided evidence**: the recall-map U solves and
planned fresh variants (`v@#k`, section 9) of those concepts, plus the act
checkpoint. Teaching tickets never count. A statement is *provisional* when the
evidence exists once, and *confirmed* when every cell in it is `Working` (a
second clean fresh solve at least 3 days later). It claims no more than the
evidence shows; where a language has only a foothold, it says so.

- **M1 (after T18, #26).** "In PostgreSQL, from a blank editor, you can pull
  out the rows and columns someone asks for using one condition or a
  comparison, sort them and take the top one, and add, change or remove a
  single row without touching any other. In JavaScript and PHP you have a
  foothold: you have run and adapted small programs with help, but nothing
  unaided yet."
  Evidence: #13 T11 (SELECT and WHERE, first blank editor), #14 T13 (find by key,
  unlabelled), v@#13 (UPDATE, L3), v@#15 (INSERT, L3), v@#16b (DELETE, L3), #26
  T18 checkpoint (comparison, sort, take the top).
- **M2 (after T34, #42).** "You can answer 'is it free?' correctly at the edges
  in SQL and JavaScript, count, group and join bookings to people and rooms,
  count only bookings that are still active, loop over records in JavaScript,
  and put a user's value into a PHP query safely. You can tell a real bug from
  a misunderstanding and reply with evidence."
  Evidence: #34 (overlap in JavaScript), #36 (count), #37 (JS loop written
  unaided), #40 (investigate first), #41 (active only, IS NULL), #41a (prepared
  statement in a legacy script), #42 T34 checkpoint (JOIN, GROUP BY, time
  range).
- **M3 (after T47, #55).** "You can design a small table with keys and
  constraints, make a multi-step change all-or-nothing, list what has no
  match, write a PHP JSON endpoint filtered by a client id it validates (not
  yet secured against a user asking for another client's data; see M5), fetch
  that data and show it safely on a page, find and prove an injection bug in a
  colleague's code, and estimate how many rows a change will touch."
  Evidence: #55 T47 checkpoint (table, constraints, endpoint, estimate step),
  v@#43 (no partner), v@#52 (all-or-nothing), v@#53 (fetch and render),
  v@#54 (an unaided injection review of Maya's site search).
- **M4 (after T67, #75).** "You can turn a client's rule into a database
  guarantee (an exclusion constraint on time ranges, an EXISTS check), return a
  clear conflict from PHP when it fires, get British time zones and money in
  pence right, use a window function for 'first' or 'latest per person', and
  write a test that proves a fix."
  Evidence: v@#65 (EXISTS), #70 (ranges and time zones), #72 (money, in
  JavaScript), v@#73 (window function), #63 (test), #75 T67 checkpoint
  (exclusion constraint plus the PHP 409; checked layer by layer, section 13).
- **M5 (after T85, #93).** "You can find why a query is slow and fix it with
  the right index, remove N+1 queries, store and check passwords properly, stop
  one user or one client reaching another's data in PHP, give a reporting role
  only the rights it needs, and keep untrusted text out of the page."
  Evidence: v@#86 (index chosen from a plan), v@#90 (N+1), #87 (passwords),
  v@#89 (least privilege), #93 T85 checkpoint (authorisation, tenant scoping,
  untrusted text).
- **M6 (after WS1-WS3).** "You can take a well-scoped ticket in a small
  PHP/PostgreSQL/JavaScript codebase from report to reply: reproduce,
  investigate, fix at the right layer, prove it with a test, keep an audit
  trail, and explain the change and its impact. This covers the core coding
  of junior work. It does not yet cover git, a framework, a large codebase,
  real HTTP or PHP against PostgreSQL (section 13)."
  Evidence: WS1, WS2 and WS3 each passed unaided, and a fresh equivalent of
  each passed again at least 21 days later; #100 (audit trail, T92); M1-M5
  confirmed. **M6 is conditional on both passes.**
  - **Bridge step B1 (named, part of the milestone):** before starting work,
    do the bridge outside the game: git basics, a local PHP + PostgreSQL
    setup, and one small project of his own. The game lists it as the next
    step and records his own "done", but says plainly that it cannot verify it.

---

## 8. The ticket ladder

Legend: **Kind** is Bug, Feature or Question (a support question answered from
the data; the answer is the reply). **Needs** lists prerequisite tickets.
**New idea** is designer metadata: shown to the player as a Learn card only on
the teaching ticket, hidden on every later ticket (section 2, item 4).
**Checks** are what must be true of the world (or of his answer on the real
and shadow worlds) afterwards; **Cheat** is a named wrong solution that must
fail. Hints: H1 nudge, H2 concept, H4 worked-example outline (H3 is always
"open the Codex entry for the new idea"). **Explain** marks a closed-book
explanation step at the end (section 2, item 5). Every ticket has a one-line
objective and a two-line recap; they are written out for Act 1 and follow the
same form afterwards. **Cause** is why the ticket exists in the world (section
10: client feature request, growth and scale, messy real-world input, other
people's code, rules and security, misunderstanding, report or question).
**Grading** is *query* unless the ticket is listed as a one-off data fix in
section 4. **Needs platform capability** names what section 14 must build
before the ticket can be graded honestly; every JavaScript and PHP ticket from
#35 on also needs PC-4 (not repeated per ticket).

### Serve order

| Positions | Tickets |
|---|---|
| #1-#5 | O1-O5 (on-ramp: tables, ids, queries, errors, the Codex; section 3) |
| #6-#17 | T01, T02, T03, T04, T06, T08, T10, T11, T13, T14, T16, T17 (SQL foothold) |
| #18-#22 | O6, O7, T05, T09, T12 (JavaScript foothold) |
| #23-#25 | O8, T07, T15 (PHP foothold) |
| #26 | T18 (Act 1 checkpoint) |
| #27-#109 | T19-T101 in id order (position = id + 8), interleaved |
| lettered | T30a #38a, T32a #40a, T33a #41a, T36a #44a, T45a #53a, T49a #57a, T54a #62a, T56a #64a, T65a #73a, T66a #74a, T69a #77a (inserted after review without renumbering) |
| #110-#112 | WS1, WS2, WS3 (work samples), each re-passed as a fresh equivalent at least 21 days later |

Between ladder tickets the director inserts the planned `v@#k` recall variants
and due reviews (section 9); they have no position of their own. The order is
also paced by section 5 (at most 5 new concepts a day, each gated) and by Act
gates (an Act opens when the previous milestone is confirmed).

World at O1: `rooms` (Boardroom 8 seats, Studio 4, Library 6), `people` (5,
named: Priya, Sam and three others), `bookings` (about 20, none clashing):
Phase 1's schema with the named seed of section 4.

### Act 1 — Founding

#1-#5 are O1-O5, written out in full in section 3.

**#6 · T01 · SQL · Question · Priya Shah, co-founder**
- Cause: report or question.
- Says: "Now I've put the rooms in, can you show me the whole rooms list yourself?"
- Objective: *Show Priya every room.*
- New idea: writing your first query (`SELECT * FROM <table>;`). Needs: O3.
- Scaffold: L0 run `SELECT * FROM people;` and watch the people glow; L1 change one word so it shows rooms; L2 type the whole line for `bookings` (Priya asks "and the bookings?").
- Codex: `SELECT`, `FROM`, `*`, `;` (from O3), table names.
- H1 "Which table holds rooms?" H2 "Reading a whole table." H4 the L0 example.
- Checks: his last result equals every row of `bookings` on both worlds. Cheat: `SELECT 'Boardroom';` fails.
- Recap: "You asked the database for a whole table. `SELECT` says what, `FROM` says where." Pattern prompt starts here.
- Revisits: O3. Time: 2 min. (Scaffolded: not evidence.)

**#7 · T02 · SQL · Question · Priya**
- Cause: client feature request.
- Says: "For the website I only want each room's name and how many it seats. Nothing else, it looks messy."
- Objective: *Show only room names and seats.*
- New idea: choosing columns (a list separated by `,`). Needs: T01.
- Scaffold: L1: `SELECT * FROM rooms;` is typed; replace the `*`.
- Codex: column lists, `,`.
- H1 "The website wants two things." H2 "Choosing columns." H4 `SELECT name, role FROM people;`.
- Checks: result has exactly the columns name and capacity, all rooms. Cheat: `SELECT *` fails (extra columns).
- Recap: "You chose columns instead of taking them all."
- Revisits: T01. Time: 1 min.

**#8 · T03 · SQL · Question · Priya**
- Cause: report or question.
- Says: "How many does the Boardroom seat again? I've a client on the phone."
- Objective: *Find the Boardroom's seats.*
- New idea: choosing rows (`WHERE column = value`; text in single quotes; SQL's `=` compares). Needs: T02.
- Scaffold: L2: `SELECT capacity FROM rooms` is typed; add the rest of the line.
- Codex: `WHERE`, `=`, `'text'`.
- H1 "You only want one room." H2 "Filtering rows." H4 `SELECT role FROM people WHERE name = 'Person 3';`.
- Checks: the answer is the Boardroom's capacity on both worlds. Cheat: `SELECT 8;` fails on the shadow world.
- Recap: "You picked one row by a fact about it." Pattern: *Find by key*.
- Revisits: T02, O4 (a missing quote gives his first real error). Time: 2 min.

**#9 · T04 · SQL · Bug · Priya**
- Cause: messy real-world input.
- Says: "I got the Boardroom wrong. It seats ten, not eight. Can you put it right?"
- Objective: *Correct the Boardroom's seats.*
- New idea: changing a value (`UPDATE ... SET ... WHERE`). In SQL `=` has two jobs, and the Learn card shows both on this one line: in `SET capacity = 10` it means "becomes"; in `WHERE name = 'Boardroom'` it means "is equal to". Needs: T03.
- Scaffold: L2 with starter `UPDATE rooms`. The diorama's Boardroom grows two chairs when it works.
- Codex: `UPDATE`, `SET`.
- H1 "Only one room is wrong." H2 "Changing existing rows, and choosing which." H4 update a person's role by name.
- Checks: Boardroom capacity is 10; every other room unchanged; room count unchanged. Cheat: `UPDATE rooms SET capacity = 10;` fails.
- Recap: "You changed one value in one row. The `WHERE` decided which row; without it, every room would have changed."
- Revisits: T03 (the WHERE, recalled the next ticket). Time: 2 min.

**#10 · T06 · SQL · Feature · Priya**
- Cause: client feature request.
- Says: "We've just fitted out the Garden Room, six seats. It isn't showing on the system."
- Objective: *Add the Garden Room.*
- New idea: adding a row (`INSERT INTO rooms (name, capacity) VALUES ('Garden Room', 6);`; brackets hold lists). Needs: T04.
- Scaffold: L2 with starter `INSERT INTO rooms`. A new room tile rises in the diorama.
- Codex: `INSERT INTO`, `VALUES`, `( )`, ids given automatically.
- H1 "The room doesn't exist yet." H2 "Adding rows." H4 insert a person.
- Checks: exactly one room called Garden Room with 6 seats; room count up by exactly 1. Cheats: running the insert twice fails; renaming the Studio fails.
- Recap: "You added a row; the database gave it its own id."
- Revisits: T04, O2 (ids). Time: 2 min.

**#11 · T08 · SQL · Feature · Priya**
- Cause: client feature request.
- Says: "Can the room list come out biggest first? People always ask for the big rooms."
- Objective: *List rooms biggest first.*
- New idea: sorting (`ORDER BY`, `DESC`). Needs: T02, O5 (he met the entry while learning to look up).
- Scaffold: L2: `SELECT name, capacity FROM rooms` is typed; he adds the sorting (he met `ORDER BY` in O5).
- Codex: `ORDER BY`, `ASC`, `DESC`.
- H1 "The rows are right, the order isn't." H2 "Sorting results." H4 people sorted by name.
- Checks: rows in descending capacity order. Cheat: unsorted `SELECT` fails (the shadow world's insertion order differs from capacity order).
- Recap: "You sorted results. Sorting never changes the table, only the answer."
- Revisits: T01, T02 from memory. Time: 2 min.

**#12 · T10 · SQL · Question · Priya**
- Cause: report or question.
- Says: "A team of seven wants a room on Thursday. Which of ours could take them?"
- Objective: *Find rooms for seven people.*
- New idea: comparisons (`>=`, `>`, `<`, `<=`, `<>`). Needs: T03.
- Scaffold: L2: `SELECT name FROM rooms WHERE capacity` is typed; he adds the comparison.
- Codex: comparison operators.
- H1 "Seven people need at least seven seats." H2 "Comparing numbers in a filter." H4 people with id above 2.
- Checks: rooms with capacity of 7 or more. Cheat: `capacity > 7` fails (the shadow world has a 7-seater).
- Recap: "You filtered with 'at least' instead of 'equals'." Pattern: *Filter rows*.
- Revisits: T03 (fourth ticket after it), T08. Time: 2 min.

**#13 · T11 · SQL · Question (not a bug) · Sam Fletcher, Harbour Street Co-working (pilot)**
- Cause: misunderstanding.
- Says: "Your system won't let me book the Garden Room for our twelve-person workshop. It must be broken."
- Objective: *Find out why Sam can't book, and reply.*
- New idea: investigate before changing anything; not every report is a bug; reply with evidence. Needs: T10.
- Scaffold: **L3, first blank SQL editor** (no new keyword: the query is recalled).
- Codex: the Reply panel (root cause options plus evidence); a worked example reply on a sibling case is shown before the task, because the panel is new.
- H1 "Check what the system knows about the Garden Room." H2 "Read-only investigation." H4 a solved sibling: "the Studio won't take 6".
- Checks: rooms table unchanged; reply picks "the room seats 6" and his evidence query returns the rooms that can take 12. Cheat: raising the Garden Room's capacity to 12 fails.
- Explain: Sam asks "So why did it say no?" Checklist: capacity is 6; 12 is more; the system was right; these rooms fit.
- Recap: "You proved the system right before touching anything." Pattern: *Investigate before you change*.
- Revisits: T03, T10 unaided (no label says "comparison"). Time: 3 min.

**#14 · T13 · SQL · Bug · Sam**
- Cause: messy real-world input.
- Says: "I booked the Boardroom for Friday by mistake. Can you cancel it? My afternoon one's fine."
- Objective: *Cancel only Sam's wrong booking.*
- New idea: removing rows (`DELETE ... WHERE id =`), after finding the right id first. The Learn card says: find Friday's block on the timetable and read its id (time values come at T16). Needs: T03, T04.
- Codex: `DELETE FROM`, `--` comments (for keeping the finding query while writing the fix).
- H1 "First find Sam's bookings, then remove only one." H2 "Deleting rows by id." H4 delete one of Person 2's bookings after listing them.
- Checks: that booking gone; Sam's other booking still there; total down by exactly 1. Cheat: `DELETE FROM bookings WHERE person_id = <Sam>` fails.
- Recap: "You looked first, then removed one row by its id." Pattern: *Find by key*.
- Revisits: T03 unaided (sixth ticket after it), T04 (fifth after it). Time: 2 min.

**#15 · T14 · SQL · Question · Sam**
- Cause: report or question.
- Says: "Which of my bookings are in the Garden Room? I think I've got too many."
- Objective: *List Sam's Garden Room bookings.*
- New idea: combining conditions (`AND`; `OR` in the Codex). Needs: T03, T10.
- Codex: `AND`, `OR`, brackets.
- H1 "Two things must both be true." H2 "Combining conditions." H4 rooms between 5 and 8 seats.
- Checks: Sam's Garden Room bookings on both worlds. Cheat: filtering by person only fails.
- Recap: "Two conditions, both must hold."
- Revisits: T03, T10, O2 (ids). Time: 2 min.

**#16 · T16 · SQL · Question · Sam**
- Cause: report or question.
- Says: "What's on in the Boardroom this Friday? I'm trying to fit a client in."
- Objective: *List Friday's Boardroom bookings.*
- New idea: comparing times; a day runs from midnight up to, not including, the next midnight. Needs: T14.
- Codex: time values (`'2026-01-09 00:00+00'`), UTC.
- H1 "Friday starts at midnight and ends at the next midnight." H2 "Filtering by time." H4 Monday's bookings for the Studio.
- Checks: Friday's Boardroom bookings; the shadow world has a booking at exactly 00:00 Saturday that must be excluded. Cheat: `start_at <= '...Saturday 00:00'` fails.
- Recap: "You used 'from ... up to but not including' for a day. You'll use that shape for every time question."
- Revisits: T14 (next ticket), T10. Time: 3 min.

**#17 · T17 · SQL · Question (learn by look-up) · Sam**
- Cause: report or question.
- Says: "When's the next booking in the Boardroom after nine on Monday? I need to know how long I've got."
- Objective: *Find the next Boardroom booking after 9:00 Monday.*
- New idea: taking only the first rows (`LIMIT`), **found in the Codex, with no Learn card**. Needs: T08, T16, O5.
- H1 "Sort by time. Is there a Codex word for 'only the first'?" H2 "Limiting results." H4 the smallest room.
- Checks: one row, the correct booking on both worlds. Cheat: `ORDER BY id LIMIT 1` fails.
- Recap: "You found a tool you hadn't been shown. That's how you'll learn most things at work." Pattern: *Sort and take the top*.
- Revisits: T08 (sixth after it), T16, O5. Time: 3 min.

**#18 · O6 · JavaScript · on-ramp · Priya: "Can the website work out things for itself, like how many seats we have in total?"**
- Cause: client feature request.
- Objective: *Run your first program and watch it answer.*
- Learn card: "A **program** is a list of instructions run from top to bottom. A **variable** is a named box: `const total = 8;` puts 8 in a box called total. In JavaScript `=` only *stores* (in SQL, `=` compared in `WHERE` and set a value in `SET`; JavaScript keeps those two jobs apart). `return total;` hands the answer back."
- Scaffold: L0 run `const seats = 10 + 4 + 6; return seats;` (10 is the Boardroom figure *he* corrected at T04), watch "20" float above the office; L1 add the Garden Room's 6, the room he inserted at T06.
- Codex: program, variable, `const`, `=`, `return`, `;`, `//`, text in quotes.
- Check: returns the new total. Recap: "You stored a value in a variable and returned it." Not evidence. Time: 2 min.

**#19 · O7 · JavaScript · on-ramp · Priya: "The seat counter says 'retrun is not defined'. Is it broken?"**
- Cause: other people's code.
- Objective: *Read the error and fix the program.*
- Learn card: "JavaScript errors say *what* (for example 'is not defined': a word it doesn't know) and *where* (line number). Same habit as SQL: read the word it quotes."
- Scaffold: L1: fix `retrun` (one token); then `return Total;` gives "Total is not defined" (capital letters matter).
- Codex: "is not defined", "Unexpected token", capital letters.
- Check: runs and returns the total. Recap: "Same habit as in SQL: the error names the word." Time: 2 min.

**#20 · T05 · JavaScript · Question · Priya**
- Cause: report or question.
- Says: "Quick one: how many rooms have we got in the system now?"
- Objective: *Count the rooms, in JavaScript.*
- New idea: the world as JavaScript data: `world.rooms` is a list; `.length`; `.` means "the part called". Needs: O6, T01.
- Scaffold: L0 `return world.people.length;`; L1 change it to rooms; L2 return the number of bookings.
- Codex: `world`, lists (arrays), `[ ]`, `.length`, `.`.
- H1 "The rooms are a list." H2 "Lists know their own length." H4 the L0 example.
- Checks: returned value equals the booking count on both worlds. Cheat: `return 20;` fails.
- Recap: "The same tables you queried are lists in JavaScript." Revisits: T01 (same data, new language). Time: 2 min. (Scaffolded: not evidence.)

**#21 · T09 · JavaScript · Feature · Priya**
- Cause: client feature request.
- Says: "Can you print every room name for the sign by the front door, one per line?"
- Objective: *Print every room name.*
- New idea: looping over a list (`for (const room of world.rooms) { ... }`, `room.name`, `console.log`); `{ }` holds the lines that repeat. Needs: T05.
- Scaffold: L2: the loop line is given; write the line inside.
- Codex: `for...of`, `{ }`, `console.log`, `( )` to run something.
- H1 "One line per room." H2 "Going through a list one item at a time." H4 print every person's name.
- Checks: logged lines equal the room names on both worlds. Cheat: logging hard-coded names fails.
- Recap: "You repeated one instruction for every item in a list."
- Revisits: T05. Time: 2 min.

**#22 · T12 · JavaScript · Question · Priya**
- Cause: report or question.
- Says: "Which rooms are small enough to call quiet rooms? Four seats or fewer. Just the names."
- Objective: *List the quiet rooms' names.*
- New idea: deciding with `if` (equality is written `===`). Needs: T09, T10.
- Scaffold: L2: the starter holds `const quiet = [];`, the loop, `if ( ) { quiet.push(room.name); }` and `return quiet;`; he writes only the condition.
- Codex: `if`, `===`, `!==`, why `==` is avoided, `.push` (in the starter, explained).
- H1 "Keep only some rooms." H2 "Deciding with if." H4 collect the names of staff people.
- Checks: returned list equals the rooms with capacity 4 or less on both worlds. Cheat: a hard-coded list fails.
- Recap: "Same filter as `WHERE capacity <= 4`, written as a loop." Pattern: *Filter rows* (second form).
- Revisits: T10 in a new language (tenth ticket after it; prompted by the Learn card, so not a U recall), T09. Time: 3 min.

**#23 · O8 · PHP · on-ramp · Tom Okafor (just joined, support): "Our website pages are PHP. Can you show me how one asks the database something?"**
- Cause: report or question.
- Objective: *Run a PHP script that asks the database a question.*
- Learn card: "PHP runs on the server and usually asks the database for data. Every PHP file starts `<?php`. Every variable starts with `$`. `$pdo` is the connection to the database; `->` means 'use its ability': `$pdo->query("SELECT ...")` sends an SQL query you already know. `echo` prints. `.` joins text (in JavaScript `.` meant 'the part called'; here it glues)."
- Scaffold: L0 run `$n = $pdo->query("SELECT count(*) FROM people")->fetchColumn(); echo 'People: ' . $n;` ("count is taught later; just run it"); L1 change `people` to `rooms`; read the error when a `;` is missing.
- Codex: `<?php`, `$`, `$pdo`, `->`, `query`, `fetchColumn`, `echo`, `.`, "unexpected end of file".
- Check: prints the room count. Recap: "PHP wraps SQL you already know." Not evidence. Time: 3 min.

**#24 · T07 · PHP · Question · Priya**
- Cause: report or question.
- Says: "What does the system think the Garden Room seats? I want to be sure it went in right."
- Objective: *Print the Garden Room's seats from PHP.*
- New idea: a query with a condition from PHP (the SQL inside is T03's). Needs: O8, T03, T06.
- Scaffold: L2: the `$pdo->query(...)` line is given with an empty SQL string.
- Codex: double quotes around SQL containing single quotes.
- H1 "Ask the database the same question you would in SQL." H2 "Running a query from PHP." H4 the Studio's seats.
- Checks: printed output is the Garden Room's capacity on both worlds. Cheat: `echo 6;` fails.
- Recap: "You ran your own SQL from PHP." Revisits: T03 unaided inside PHP (sixteen tickets later), T06. Time: 3 min. (First PHP ticket: not evidence.)

**#25 · T15 · PHP · Feature · Priya**
- Cause: client feature request.
- Says: "For the brochure, can you print each room with its seats, like 'Boardroom (10)'?"
- Objective: *Print every room with its seats.*
- New idea: looping over rows in PHP (`fetchAll`, `foreach ($rows as $row)`, `$row['name']`). Needs: T07.
- Scaffold: L2: the `foreach` line is given; write the `echo` inside.
- Codex: `fetchAll`, `foreach`, `as`, `$row['name']`, `"\n"`.
- H1 "One line per room, two facts per line." H2 "Looping over rows." H4 print each person with their role.
- Checks: printed lines match `name (capacity)` for every room on both worlds. Cheat: hard-coded text fails.
- Recap: "Same loop as JavaScript's `for...of`, in PHP's words."
- Revisits: T09 (loop, in a new language), T02. Time: 3 min.

**#26 · T18 · any language (SQL recommended: the JS and PHP paths would need sorting, taught later) · Question · checkpoint (no worked example, no label) · Priya**
- Cause: report or question.
- Says: "Sam's team of five needs a room on Monday. What's the smallest room that can take them? I don't want to waste the Boardroom."
- Objective: *Find the smallest room for five.*
- New idea: none (fresh combination). Needs: T10, T08, T17 (SQL); T12 (JS); T15 (PHP).
- Calibration prompt: "Will you solve this without hints?"
- Checks: the correct room on both worlds. Cheat: returning the Boardroom (the biggest) fails.
- Recap: "Filter, then sort and take the top: two patterns combined."
- Revisits: WHERE, comparison, ORDER BY, LIMIT; JS if and loop; PHP loop. Time: 3 min. Earns **M1** (provisional).

### Act 2 — First clients

Setup at T19 (once M1 is confirmed): Sam signs; 8 rooms, 40 people, 300 bookings. You can no longer eyeball it. Oakfield's rooms join the same single pool: there are no separate clients until T35, so tickets name Oakfield's rooms (the Hall, the Music Room) directly.

**T19 · SQL · Question · Sam**
- Cause: report or question.
- Says: "Is the Boardroom free on Thursday from two till three? A client wants it."
- New idea: two time periods overlap when each starts before the other ends. Needs: T16.
- Codex: overlap rule (`start_at < '15:00' AND '14:00' < end_at`).
- H1 "A meeting that starts at half one is still there at two." H2 "Overlapping time periods." H4 is the Studio free Monday 10-11.
- Checks: result is exactly the overlapping bookings; the shadow world has one that straddles 14:00, one that encloses the whole hour, and one ending at exactly 14:00 that must *not* be returned. Cheat: "start_at between 14:00 and 15:00" fails.
- Revisits: T16, T14. Time: 3 min.

**T20 · JavaScript · Question · Sam**
- Cause: report or question.
- Says: "Our cleaner says someone was in the Garden Room before nine on Monday. Was it booked?"
- New idea: dates in JavaScript (`new Date(text)`, comparing times). Needs: T12, T16.
- Scaffold: L2: the loop and result list are given; he writes the date test.
- Codex: `new`, `new Date`, `.getTime()`, ISO strings, `&&` ("and", like SQL's `AND`).
- H1 "The start times are text; turn them into dates." H2 "Dates in JavaScript." H4 bookings starting after noon on Tuesday.
- Checks: returned bookings equal the truth on both worlds. Cheat: comparing the text of the time only (not the date) fails.
- Revisits: T16 (time filtering in a second language), T12. Time: 3 min.

**T21 · SQL or PHP · Bug · Sam** — *Phase 1's `double-booking-1`, reskinned (Room 1 is the Boardroom)*
- Cause: growth and scale.
- Says: "Two people turned up for the Boardroom at half past eight this morning, both with bookings. Whoever booked first should have it."
- New idea: fixing a clash in existing data: find the pair with the overlap rule, keep the older (lower id), remove or move the newer. Needs: T19, T13, T04. (JavaScript joins the allowed languages for review variants after T24.)
- Codex: none new (ids grow in booking order: a note on `SERIAL`).
- H1 "Find every Boardroom booking that overlaps 08:30." H2 "Overlap, then choose which row to change." H4 a clash in the Studio fixed by moving the newer booking.
- Checks (Phase 1): no room double-booked; the original 20 bookings untouched. Cheats: deleting every booking; deleting the older booking.
- Revisits: T19, T13, T04. Time: 3 min. Its skill returns as a new problem at T33, because the system still has no guard.

**T22 · PHP · Feature · Tom Okafor, support lead**
- Cause: client feature request.
- Needs platform capability: PC-7 (section 14).
- Says: "The 'my bookings' page needs to show someone's bookings from the number they type in."
- New idea: putting a value from outside into a query safely (`prepare` with `?`, `execute([$input['person']])`). Needs: T15, T16.
- Scaffold: L2: the output loop is given; he writes the `prepare` and `execute` lines.
- Codex: `$input`, `$pdo->prepare`, `execute`, placeholders, `[ ]` (a PHP list: `execute([$id])`), "SQL injection" (explained here, first time the word appears).
- H1 "The number comes from a stranger's keyboard." H2 "Prepared statements." H4 look up a room by a typed-in name.
- Checks: probe `person = 3` prints person 3's booking ids; probe `3 OR 1=1` prints nothing or an error, never every booking. Cheat: building the SQL by joining text fails the second probe.
- Revisits: T15, T07. Time: 3 min.

**T23 · SQL · Question · Helen Price, Oakfield Primary (school)**
- Cause: report or question.
- Needs platform capability: PC-9 (section 14).
- Says: "Before we sign, how busy is your system really? How many bookings did the hall have last month?"
- New idea: counting (`count(*)`). Needs: T16.
- Codex: `count(*)`, `::int` ("as a whole number"; optional). "Last month" is relative to the ticket instance's stored date (PC-9).
- H1 "She wants one number." H2 "Aggregates." H4 how many people are staff.
- Checks: number correct on both worlds. Cheat: a typed number fails.
- Revisits: T16, T14. Time: 2 min.

**T24 · JavaScript · Bug (other people's code) · Tom**
- Cause: other people's code.
- Says: "Priya's script to list one person's bookings is so long I can't follow it, and it misses some. Can you tidy it up?"
- New idea: a test function applied to a list: `filter` (every match) and its sibling `find` (the first match), written with `=>`. Priya's buggy loop uses only taught syntax: a `for...of` with a `return` inside the loop that fires too early (no `for (let i...)`, no `break`). Needs: T12.
- Codex: `.filter`, `.find`, `=>`.
- H1 "Read Priya's loop: which bookings does it skip?" (her loop stops early) H2 "Filtering a list with a test." H4 filter rooms with more than 5 seats.
- Checks: returned list equals person N's bookings on both worlds. Cheat: returning Priya's result unchanged fails.
- Revisits: T12, T09. Time: 3 min.

**T25 · SQL · Question · Helen**
- Cause: report or question.
- Says: "Which of your rooms get used most? A count for each room would do."
- New idea: grouping (`GROUP BY`). Needs: T23.
- Codex: `GROUP BY`, `sum`, `min`, `max`, `avg`.
- H1 "One number per room." H2 "Grouping rows." H4 bookings per person.
- Checks: counts per room_id match on both worlds. Cheat: one overall count fails.
- Revisits: T23, T08. Time: 3 min.

**T26 · JavaScript · Feature · Tom**
- Cause: client feature request.
- Says: "I keep needing to know if two bookings clash. Could you give me something I can reuse?"
- New idea: writing your own function (`function clashes(a, b) { ... return true/false }`). Needs: T19, T20, T12.
- Scaffold: L2: `function clashes(a, b) {` and `}` are given; he writes the body.
- Codex: `function`, parameters, booleans, `||`, `!`.
- H1 "Tom wants to hand it two bookings and get yes or no." H2 "Functions." H4 `isBig(room)`.
- Checks: probes call `clashes` on straddling, enclosing, touching and separate pairs, and on the pair swapped. Cheat: `return true` fails; using `<=` fails the touching pair.
- Revisits: T19 (overlap in JS), T20. Time: 3 min.

**T27 · SQL · Feature · Sam**
- Cause: client feature request.
- Says: "When someone cancels, the booking just vanishes, so I can't see who cancels a lot. Can you keep cancelled ones but mark them?"
- New idea: changing a table's shape (`ALTER TABLE ... ADD COLUMN cancelled_at timestamptz`); an empty value (NULL) means "not cancelled". Needs: T06.
- Codex: `ALTER TABLE`, `ADD COLUMN`, `NULL`.
- H1 "The table needs somewhere to remember a cancellation." H2 "Changing a table." H4 adding `email` to people.
- Checks: column exists with type timestamptz, nullable; every booking kept; all existing rows NULL. Cheat: dropping and recreating the table fails (bookings lost).
- Revisits: T06. Time: 2-3 min. World change: `bookings.cancelled_at`.

**T28 · SQL · Bug (works but wrong) · Sam**
- Cause: other people's code.
- Needs platform capability: PC-9 (section 14).
- Says: "The dashboard says the Boardroom had fourteen bookings this week, but half of those were cancelled."
- New idea: testing for NULL (`IS NULL`; `= NULL` never matches). Needs: T27, T23.
- Codex: `IS NULL`, `IS NOT NULL`.
- H1 "What does the count include?" H2 "NULL is not a value you can compare with =." H4 people with no email.
- Checks: his count equals active bookings only, on both worlds (the shadow world has cancellations). Cheat: `cancelled_at = NULL` returns 0 and fails.
- Revisits: T23, T16. Time: 3 min.

**T29 · JavaScript · Question · Helen**
- Cause: report or question.
- Says: "For the governors I need how many bookings each room had, by name, not number."
- New idea: an object as a tally (`counts[name] = (counts[name] ?? 0) + 1`). Needs: T24, T25.
- Scaffold: L2: the starter gives the line that finds a booking's room name (`world.rooms.find(...)`, known from T24) with the `?? 0` fallback explained; the loop and the tally are his.
- Codex: object literals, `[key]` access, `??`.
- H1 "One running total per room." H2 "Objects as lookup tables." H4 count bookings per person id.
- Checks: returned object equals the per-room counts (by name, active only) on both worlds. Cheat: counting cancelled bookings fails.
- Revisits: T25 (grouping in JS), T28 (ignoring cancelled), T24. Time: 3-4 min.

**T30 · SQL · Question · Tom**
- Cause: client feature request.
- Needs platform capability: PC-9 (section 14).
- Says: "The booking list only shows person numbers. Support can't ring 'person 17'."
- New idea: joining two tables (`JOIN ... ON`). Needs: T03, T16.
- Codex: `JOIN`, `ON`, table aliases.
- H1 "Names live in another table." H2 "Joining tables." H4 bookings with room names.
- Checks: today's bookings with person names, correct on both worlds. Cheat: hard-coded names fail.
- Revisits: T16, T02. Time: 3 min.

**T30a (#38a) · PHP · Feature · Priya**
- Cause: client feature request.
- Says: "In the brochure, the small rooms should say '(quiet room)' after the seats, and the others shouldn't."
- New idea: deciding in PHP (`if`, `else`, `!`, `||`, `&&`) and adding to a list (`$quiet[] = $row['name']`). Needs: T15, T12 (the same idea in JavaScript).
- Scaffold: L2: the `foreach` from T15 is given; he writes the `if`/`else`.
- Codex: PHP `if`, `else`, `!`, `||`, `&&`, `$list[] =`.
- H1 "Some lines need extra words." H2 "Deciding in PHP." H4 marking staff in a people list.
- Checks: printed lines match, with the suffix exactly on rooms of 4 seats or fewer, on both worlds. Cheat: hard-coded room names fail.
- Recap: "Same `if` as JavaScript; PHP just wants `$` on its variables."
- Revisits: T12 (in PHP), T15. Time: 3 min.

**T31 · PHP · Bug (other people's code) · Tom**
- Cause: other people's code.
- Says: "Some pages say the Garden Room's free when it isn't. The 'is it free' check is copied in three places and I think one's different."
- New idea: PHP functions (`function isFree(PDO $pdo, int $roomId, string $start, string $end): bool`) replacing three copied functions in one file (`free.php`). Needs: T19, T22, T28, T15, T30a.
- Codex: `function`, type declarations, `return`, `bool`.
- H1 "Compare the three copies line by line." H2 "One function, used everywhere." H4 a `roomName($pdo, $id)` function.
- Checks: probes call `isFree` for straddling, touching and cancelled-booking cases (a cancelled booking must not block); the three call sites use it. Cheat: fixing only the broken copy fails the "one function" probe on the others' behaviour with cancellations.
- Revisits: T19 and T28 in PHP, T22. Time: 4-5 min.

**T32 · SQL · Bug (wrong diagnosis) · Helen**
- Cause: misunderstanding.
- Says: "Your system has lost the Music Room. It's gone from the usage list."
- New idea: keeping rows with no match (`LEFT JOIN`; `count(b.id)` not `count(*)`). Needs: T30, T28, T25.
- Codex: `LEFT JOIN`.
- H1 "Is the Music Room really gone from the rooms table?" H2 "Joins drop rows that have no partner." H4 people with no bookings.
- Checks: rooms table unchanged; his list includes every room, Music Room with 0; reply picks "the report hides unused rooms". Cheats: re-inserting a Music Room fails; `count(*)` shows 1 and fails.
- Revisits: T11 (investigate first), T25, T30. Time: 4 min.

**T32a (#40a) · SQL · Question (not a bug) · Helen**
- Cause: misunderstanding.
- Says: "The governors think the report's broken: rooms that have never been used show a blank for 'last booked'."
- New idea: a stand-in for missing values (`COALESCE(max(b.start_at)::text, 'never')`). Needs: T32, T28.
- Codex: `COALESCE`.
- H1 "What does a room with no bookings have for its latest booking?" H2 "Replacing NULL in results." H4 people with no email shown as 'none'.
- Checks: world unchanged; every room listed, never-used rooms say 'never'; reply picks "nothing is broken; those rooms have no bookings". Cheat: inserting fake bookings fails.
- Recap: "Empty is a fact, not a fault; `COALESCE` says so in words." Pattern: *Keep the ones with no partner*.
- Revisits: T32, T11 (investigate first). Time: 3 min.

**T33 · SQL or JS · Bug (new clashes; the system still has no guard) · Sam**
- Cause: growth and scale.
- Says: "It's happened again: two groups in the Boardroom on Wednesday. I think there's more than one clash this week."
- New idea: joining a table to itself to find every clashing pair. Needs: T21, T30, T28 (SQL); T26, T24 (JS, nested loops with `clashes`).
- Codex: self-join, aliases `a` and `b`, `a.id < b.id`.
- H1 "Compare each booking with every other booking in the same room." H2 "Self-join." H4 people who share a name.
- Checks: no active overlapping pair; every original booking still present; newer ones are cancelled (not deleted, per T27). Cheats: deleting the newer bookings fails; cancelling every Wednesday booking fails.
- Revisits: T19, T21, T27, T28. Time: 5 min.

**T33a (#41a) · PHP · Bug (recall only, no new idea) · Tom**
- Needs platform capability: PC-7 (section 14).
- Says: "Siobhan O'Brien can't book anything. The page just errors when she types her name."
- Cause: messy real-world input meeting other people's code: the member search is an inherited legacy script that builds its SQL by joining text.
- New idea: none: find the root cause (the apostrophe ends the SQL text early) and apply T22's prepared statement from memory. Needs: T22, T15.
- H1 "Try the search with a plain name, then with hers." H2 (costs credit) "Values from outside." H4 a sibling legacy script fixed.
- Checks: probes `O'Brien`, `D'Souza`, a plain name and `x' OR '1'='1` all behave (the last returns nobody). Cheat: stripping apostrophes from input fails the `O'Brien` probe (she must still be found).
- Explain: Tom asks "Why did one apostrophe break it?" Checklist: the name was pasted into the SQL; the apostrophe ended the text; the rest became SQL; prepared statements keep values out of the SQL.
- Recap: "The same fix as T22, found by yourself in someone else's code." Pattern: *Never trust input*.
- Revisits: T22 unaided (U), T15. Time: 4 min.

**T34 · any language · Question · checkpoint · Helen**
- Cause: report or question.
- Says: "Who used the hall most last month? Names and how many times, busiest first."
- New idea: none. Needs: T30, T25, T16, T08 (SQL); T29, T20 (JS); T15, T30 (PHP).
- Checks: correct ordered list on both worlds, active bookings only. Cheat: ids instead of names fails.
- Time: 5 min. Earns **M2** (provisional).

### Act 3 — Growth

Setup at T35: three new clients sign; Maya Chen joins as junior developer.

**T35 · SQL · Feature · Priya**
- Cause: growth and scale.
- Says: "We're signing two more companies next week. Their rooms mustn't get muddled with Sam's."
- New idea: creating a table and linking it (`CREATE TABLE clients`, `rooms.client_id REFERENCES clients(id)`). Needs: T27, T30.
- Codex: `CREATE TABLE`, `PRIMARY KEY`, `REFERENCES`, foreign key.
- H1 "Every room belongs to someone." H2 "Foreign keys." H4 a `sites` table linked to rooms.
- Checks: `clients` exists; every room has a client; the foreign key exists (catalogue query); probe: a room with client 999 is rejected. Cheat: a plain integer column with no reference fails the probe.
- Revisits: T27, T06. Time: 5 min. World change: `clients(id, name, sector)`, `rooms.client_id`; setup then adds `people.client_id`.

**T36 · SQL · Bug · Tom**
- Cause: messy real-world input.
- Says: "Someone's created a room with minus two seats, one with no name, and Harbour Street now has two Boardrooms."
- New idea: constraints (`NOT NULL`, `CHECK`, `UNIQUE (client_id, name)`), after cleaning the bad data. Needs: T35.
- Codex: `CHECK`, `UNIQUE`, `NOT NULL`, `ADD CONSTRAINT`.
- H1 "Fix the three rooms, then make it impossible again." H2 "Constraints." H4 a CHECK on people.role.
- Checks: bad rows fixed (not deleted if they have bookings); probes: capacity -1 rejected, blank name rejected, duplicate name in the same client rejected, same name in a different client accepted. Cheat: `UNIQUE (name)` fails the last probe.
- Revisits: T04, T35. Time: 5 min.

**T36a (#44a) · PHP · Bug · Tom**
- Says: "The booking page crashed for Harbour Street at 9:14 this morning. Here's what the log says."
- Cause: other people's code (a colleague's report function assumes every booking has a room).
- Needs platform capability: PC-7, PC-17 (section 14).
- New idea: reading a PHP stack trace and an application log: the error message, the file and line at the top, the chain of calls under it, the log line's time and request. Needs: T31.
- Codex: stack trace, "Trying to access array offset on value of type null", `error_log`.
- H1 "Start at the top line of the trace; which function, which line?" H2 "Reading a stack trace." H4 a sibling trace walked through line by line.
- Checks: his fix makes the replayed 9:14 request succeed; a booking with a deleted room is shown as "room removed" rather than crashing; the reply names the line and cause. Cheat: wrapping everything in `@` or an empty `catch` fails (the log must still record the missing room).
- Recap: "The trace told you where; the data told you why."
- Revisits: T31, T28 (a missing value). Time: 5 min.

**T37 · PHP · Bug · Sam**
- Cause: messy real-world input.
- Needs platform capability: PC-7 (section 14).
- Says: "Someone booked the Garden Room for 'tomorrow-ish' and your system took it."
- New idea: validating input before touching the database (return a list of errors). Needs: T22, T31, T30a.
- Codex: `DateTimeImmutable::createFromFormat` (`::` is "the class's own function"), `filter_var`, `empty`, `===` vs `==` (the loose-comparison trap), `$errors[] =` (from T30a).
- H1 "What should the form refuse?" H2 "Validate, then act." H4 validating a new room's name and capacity.
- Checks: probes on `createBooking($input, $pdo)`: a valid booking creates one row; bad date, end before start, unknown room, missing person each create no row and return an error. Cheat: relying on the database CHECK alone fails the "unknown room returns an error, not an exception" probe.
- Revisits: T22, T31. Time: 5 min.

**T38 · JavaScript · Bug (other people's code) · Maya Chen, developer**
- Cause: other people's code.
- Says: "My booking list shows '[object Object]' on every line. I can't see why."
- New idea: turning each item into text (`.map` with template strings). Needs: T24, T20.
- Codex: `.map`, template literals, `.toISOString().slice`.
- H1 "What is each line actually made from?" H2 "Mapping a list." H4 map rooms to "Name (seats)".
- Checks: returned lines equal "Room · HH:MM-HH:MM" for today's bookings on both worlds. Cheat: hard-coded lines fail.
- Revisits: T20, T24, T15 (same format idea as PHP). Time: 4 min.

**T39 · SQL · Bug · Priya**
- Cause: other people's code.
- Needs platform capability: PC-1, PC-13 (section 14).
- Says: "When I moved Sam's team from the Boardroom to the Garden Room it went wrong halfway. Now some are in one room and some in the other."
- New idea: all-or-nothing changes (`BEGIN`, `COMMIT`, `ROLLBACK`). Needs: T36, T04.
- From this ticket on, the SQL runner uses psql semantics: statement by statement, autocommit, carrying on after an error, with an "Undo run" button that restores the pre-run snapshot. The quest panel says the training wheel has come off (PC-1). Without that change the cheat would pass, because Phase 1's runner wraps every script in one transaction.
- Codex: `BEGIN`, `COMMIT`, `ROLLBACK`.
- H1 "Either all of the team's bookings move, or none do." H2 "Transactions." H4 swapping two rooms' names.
- Checks: real world: all moved. Shadow world (one move breaks a constraint): nothing moved. Cheat: the same statements without a transaction fail the shadow world.
- Revisits: T04, T36. Time: 5 min.

**T40 · PHP · Feature · Maya**
- Cause: client feature request.
- Needs platform capability: PC-7 (section 14).
- Says: "The new phone page needs the room list for a client as JSON."
- New idea: a JSON API endpoint (`json_encode`, a response array, status code). Needs: T37, T35.
- Codex: `json_encode`, `http_response_code`, `header('Content-Type: application/json')`.
- H1 "The phone page wants data, not text." H2 "JSON responses." H4 `/api/people.php`.
- Checks: probe `client = 2` returns valid JSON of client 2's rooms only; `client = abc` returns 400 and an error. Cheat: returning every room fails.
- Revisits: T22, T37, T15. Time: 5 min.

**T41 · JavaScript · Bug · Maya**
- Cause: other people's code.
- Needs platform capability: PC-7 (section 14).
- Says: "The API sends the rooms, but my page treats them as one long line of text."
- New idea: JSON text to data and back (`JSON.parse`, `JSON.stringify`). Needs: T38.
- Codex: `JSON.parse`, `JSON.stringify`.
- H1 "Is it a list yet, or still text?" H2 "JSON." H4 parse a person.
- Checks: returned list of names equals the input's rooms (input varies per world). Cheat: splitting the text on commas fails.
- Revisits: T40, T38. Time: 3 min.

**T42 · JavaScript · Bug · Maya**
- Cause: other people's code.
- Needs platform capability: PC-6 (section 14).
- Says: "The room page spins forever. It calls the API but nothing ever comes back."
- New idea: waiting for the network (`async`, `await fetch`, `await res.json()`). Needs: T41, T40.
- Codex: `fetch`, `await`, `async`, Promise.
- H1 "What does fetch give back straight away?" H2 "Asynchronous code." H4 fetch the people list.
- Checks: returned rooms equal the API's rooms for client N on both worlds. Cheat: returning cached data fails.
- Revisits: T41, T40. Time: 4 min.

**T43 · JavaScript · Feature · Maya**
- Cause: client feature request.
- Needs platform capability: PC-5 (section 14).
- Says: "Rooms load now, but nothing appears on the page."
- New idea: the page (DOM): `document.querySelector`, `createElement`, `textContent`, `append`. Needs: T42, T38.
- Codex: `document`, `querySelector`, `createElement`, `textContent`, `append`.
- H1 "The data is there; the page doesn't know." H2 "Building page elements." H4 add a heading.
- Checks: the list has one item per room with the right text; a room named `<b>Loud</b>` shows as that literal text. Cheat: `innerHTML` with the raw names fails the second check.
- Revisits: T42, T38. Time: 5 min.

**T44 · PHP · Code review · Maya**
- Cause: other people's code.
- Needs platform capability: PC-7 (section 14).
- Says: "Could you review my change before it goes live? It filters bookings by client."
- New idea: code review: prove a defect with an input, then fix it. Needs: T22, T40.
- Codex: Review panel (mark lines, give a failing input).
- H1 "Where does the client value go?" H2 "Injection, in someone else's code." H4 a reviewed sibling diff with the defect marked.
- Checks: his input makes her version return another client's bookings; his fixed version returns only client N and survives the same input. Cheat: marking a line without a working input fails.
- Revisits: T22, T40. Time: 5 min.

**T45 · SQL · Question (impact estimate) · Priya**
- Cause: report or question.
- Says: "If we close the Garden Room for refurbishment from 2 to 13 March, how many bookings and how many different people would we have to ring?"
- New idea: counting distinct values (`count(DISTINCT person_id)`), before making a change. Needs: T25, T30, T19.
- Codex: `DISTINCT`.
- H1 "Two numbers: bookings and people." H2 "Counting distinct values." H4 how many different rooms Sam booked.
- Checks: both numbers correct on both worlds (overlapping, active bookings); world unchanged. Cheat: counting people with `count(*)` fails.
- Revisits: T19, T28, T25. Time: 4 min.

**T45a (#53a) · SQL · Feature · Sam**
- Says: "I've re-sent our member list because three people joined. Last time your import doubled everyone, and two rows had no name."
- Cause: messy real-world input (a CSV export sent twice, with bad rows).
- New idea: importing safely: `INSERT ... ON CONFLICT (email) DO NOTHING`, with `RETURNING` to report which rows went in. Needs: T36, T35, T45.
- Codex: `ON CONFLICT`, `DO NOTHING`, `DO UPDATE`, `RETURNING`.
- H1 "What should happen to a member who is already there?" H2 "Upserts." H4 importing rooms twice.
- Checks: exactly the three new members added; nobody duplicated; the two nameless rows rejected and listed in his reply; the `RETURNING` output names the three. Cheat: `DELETE` then re-insert everyone fails (ids of existing members change).
- Recap: "Imports meet the real world: duplicates and junk. The database can refuse them for you."
- Revisits: T36, T06, T45 (estimate first). Time: 5 min.

**T46 · JavaScript · Bug (write the test first) · Tom**
- Cause: other people's code.
- Needs platform capability: PC-14 (section 14).
- Says: "The front end said the Boardroom was busy at ten, but the meeting before ends at ten."
- New idea: a test that fails before the fix and passes after (`assert(clashes(a, b) === false, '...')`). Needs: T26, T19.
- Codex: `assert` helper, test cases as data.
- H1 "Write down the exact case Tom saw." H2 "Tests prove a fix." H4 a test for `isBig`.
- Checks: his tests fail against the shipped buggy `clashes`, pass against the reference, and pass against his fix; his fix passes the hidden probe set. Cheat: a test that always passes fails the first check.
- Revisits: T26, T19. Time: 5 min.

**T47 · any language, several steps · Feature · checkpoint · Priya**
- Cause: client feature request.
- Needs platform capability: PC-7 (section 14).
- Says: "Riverbank Studios signs tomorrow. Set them up with their four rooms, and make sure their phone page only ever shows theirs."
- New idea: none. Steps (2-4 minutes each, with a tracker): estimate what the setup touches, create the client and rooms, prove the constraints hold, return only their rooms from the endpoint. Needs: T35, T36, T39, T40.
- Checks: new client and rooms exist and satisfy constraints; the endpoint returns only their rooms; no other client changed. Cheat: inserting rooms without the client link fails.
- Time: 8-10 min. Earns **M3** (provisional).

### Acts 4-6, compressed (one line per ticket)

Format: **id · language · kind · who · symptom** — new idea · needs · checks (cheat) · revisits.

**Act 4 — Sector districts**

- **T48 · SQL · Feature · Priya · "Westbrook's lab wants to book equipment, not rooms. A microscope isn't a room."** *[cause: client feature request]* — safe migration: rename to `resources`, add `kind`, keep a `rooms` view so old code still works · T35, T36, T39 · all bookings intact, `rooms` view returns rooms only, kind check (cheat: drop and recreate loses bookings) · T27, T39.
- **T49 · SQL · Bug · Dr Anil Rao, lab · "People keep booking the fume cupboard in the wrong building."** *[cause: report or question]* — joining three tables (`sites` -> resources -> bookings) · T48, T30 · report of bookings whose resource is on another site than the person's (cheat: two-table join) · T30, T35. World: `sites`.
- **T49a (#57a) · SQL · Bug · Anil · "The maker's recalled four of our instruments. Cancel everything booked on them next week, and nothing else."** *[cause: rules and security]* — `IN (...)` with a list, then `IN (SELECT ...)` for the instruments of one model · T49, T27 · exactly those bookings cancelled (cheat: cancelling by name pattern hits a fifth instrument) · T27, T45.
- **T50 · SQL · Question · Anil · "Someone used the laser cutter without being trained. Who else has booked kit they aren't trained on?"** *[cause: rules and security; needs platform capability: PC-9]* — `EXISTS` / `NOT EXISTS` subqueries · T49, T16 · answer set incl. expired training on the shadow world (cheat: join that ignores expiry) · T28, T30. World: `trainings(person_id, resource_id, expires_on)`.
- **T51 · PHP · Feature · Anil · "Make it refuse, please, not just tell me afterwards."** *[cause: client feature request; needs platform capability: PC-7]* — guard clauses: refuse early with a clear reason · T50, T37 · probe: untrained or expired -> error, no row; trained -> row (cheat: checking training exists but not its date) · T37, T22.
- **T52 · SQL · Bug · Anil · "The spectrometer's being serviced 1 to 3 June and people are still booking it."** *[cause: rules and security]* — range types (`tstzrange`) and `&&` · T19, T45 · clashing bookings cancelled, others kept, reply lists who (cheat: cancel all bookings for the spectrometer) · T19, T45. World: `maintenance(resource_id, during tstzrange)`.
- **T53 · SQL · Feature (closes the T21/T33 chain) · Priya · "Third double booking this month. Make it impossible, don't just tidy it up."** *[cause: growth and scale; needs platform capability: PC-2]* — `EXCLUDE USING gist (resource_id WITH =, during WITH &&) WHERE (cancelled_at IS NULL)` with `btree_gist` and a generated range column · T52, T36, T28 · probes: overlapping insert rejected, touching accepted, overlap with a cancelled one accepted (cheat: `UNIQUE(resource_id, start_at)` fails the partial-overlap probe) · T33, T36.
- **T54 · PHP · Bug · Tom · "When a slot's taken, the booking page shows a white screen with a scary error."** *[cause: other people's code; needs platform capability: PC-7, PC-8]* — `try`/`catch (PDOException)`, a 409 response with a friendly message, other errors not swallowed · T53, T40 · probes: clash -> 409 JSON, no row; broken DB -> 500 and logged (cheat: catch everything and return 200) · T40, T31.
- **T54a (#62a) · PHP · Feature · Maya · "The phone app needs to create, change and cancel bookings, not just list them."** *[cause: client feature request; needs platform capability: PC-7]* — HTTP beyond GET: POST (201 with the new id via `lastInsertId()`), PATCH (200), DELETE (204), and 404 and 422 used correctly (401 and 403 arrive with authorisation at T73); taught as the codebase's handler convention (PC-7) · T54, T40, T37 · probes per method and status (cheat: 200 for everything) · T37, T54.
- **T55 · JavaScript · Bug · Jess Morgan, Pulse Fitness (gym) · "Spin class says fourteen of twelve places taken. How is it overbooked?"** *[cause: other people's code; needs platform capability: PC-14]* — reproduce first: log the values at each step, find the off-by-one · T46, T26 · test written first, fix passes probes at 11, 12, 13 (cheat: capacity hard-coded to 12) · T46, T12.
- **T56 · SQL · Question · Jess · "Which classes are oversold? I need to ring people."** *[cause: report or question]* — `HAVING` · T25, T30 · correct classes on both worlds (cheat: `WHERE count(*) > capacity` errors; filtering before grouping fails) · T25, T30. World: `signups(booking_id, person_id, created_at)`.
- **T56a (#64a) · SQL · Feature · Jess · "The class list should say Full, Nearly full or Space, not numbers."** *[cause: client feature request]* — `CASE WHEN ... THEN ... END` · T56 · labels correct at the boundaries (cheat: only 'Full' and 'Space') · T56, T10.
- **T57 · JavaScript · Bug · Jess · "When someone cancels, the place goes to whoever joined the waiting list last, not first."** *[cause: other people's code]* — sorting with a comparator (and `shift`) · T24, T20 · probes on order ties and dates (cheat: `.sort()` with no comparator fails on dates) · T20, T24.
- **T58 · SQL · Question · Jess · "For the loyalty card I need each member's very first class."** *[cause: report or question]* — window functions: `row_number() OVER (PARTITION BY ... ORDER BY ...)` · T56 · one row per member with class name (cheat: `min(start_at)` alone loses the class name) · T30, T25.
- **T59 · SQL · Question · Anil · "Kit needs fifteen minutes' cleaning between users. Which bookings don't leave the gap?"** *[cause: rules and security]* — `lag()` · T58 · correct pairs incl. cross-midnight on the shadow world (cheat: comparing to the previous id, not previous time) · T58, T19.
- **T60 · SQL · Bug · Helen · "Since the clocks went forward, all our lessons show an hour late."** *[cause: messy real-world input; needs platform capability: PC-1, PC-12]* — time zones: store UTC, think in `Europe/London` (`AT TIME ZONE`) · T16, T39 · after-change lessons at 09:00 local, before-change untouched, one transaction (cheat: subtract an hour from everything) · T39, T16.
- **T61 · JavaScript · Bug · Helen · "The timetable page shows 08:00 for our nine o'clock lessons."** *[cause: messy real-world input; needs platform capability: PC-12]* — displaying local time (`toLocaleString('en-GB', { timeZone: 'Europe/London' })`) · T60, T38 · lines correct in winter and summer (cheat: adding one hour) · T38, T20.
- **T62 · SQL · Feature · Helen · "Book the hall every Tuesday nine till ten for the summer term, but not in half term."** *[cause: client feature request; needs platform capability: PC-2, PC-12]* — `generate_series` over dates, with the term table · T60, T53 · right count, none in half term, all 09:00 local, the constraint catches clashes (cheat: 7 days in UTC drifts at the clock change) · T60, T53. World: `terms(client_id, name, starts_on, ends_on)`.
- **T63 · PHP · Bug (works but wrong) · Martin Hughes, Hartley District Council · "Hall invoices are a penny out on some bookings."** *[cause: other people's code]* — money as whole pence (`int`, `intdiv`, `number_format` only for display) · T31, T40 · probes on awkward rates (cheat: `round()` on floats at the end fails one probe) · T31. World: `payments(booking_id, amount_pence, paid_at)`.
- **T64 · JavaScript · Bug · Martin · "The basket total on the hall-hire page doesn't match the invoice."** *[cause: other people's code]* — `reduce`, in pence · T63, T29 · totals equal PHP's on probes (cheat: `toFixed(2)` on float sums) · T63, T29.
- **T65 · SQL · Feature · Sam · "I need each member company's hours for October so I can bill them."** *[cause: report or question]* — `date_trunc`, `extract(epoch ...)`, sum of durations · T56, T30 · hours per company, active only (cheat: counting bookings not hours) · T28, T25.
- **T65a (#73a) · SQL · Bug (other people's code) · Sam · "October's invoice doesn't add up, and nobody can read the query that makes it."** *[cause: other people's code]* — CTEs (`WITH hours AS (...), rates AS (...)`) to split a long query into named steps and find the wrong step · T65, T30 · totals correct; the query has named steps (cheat: patching the final number) · T65, T25.
- **T66 · PHP · Bug · Tom · "Sam's export lists some companies twice and the order's all over the place."** *[cause: other people's code]* — PHP array functions (`array_map`, `array_filter`, `usort`, `array_unique`) · T31, T15 · probes (cheat: sorting by id) · T15, T57 (sort idea in PHP).
- **T66a (#74a) · SQL · Bug (growth) · Jess · "Two members both got the last place in spin at 7am. How?"** *[cause: growth and scale]* — a race: two check-then-insert requests at once; fix with a row lock (`SELECT ... FOR UPDATE` on the class inside a transaction) or the constraint plus a retry · T39, T53, T54 · graded on state plus code shape (lock or constraint present, transaction boundaries right); the race itself cannot be staged (section 13) · T39, T53. Needs platform capability: PC-1, PC-13.
- **T67 · any, several steps · Feature · checkpoint · Jess · "Stop members signing up for two classes at the same time."** *[cause: client feature request; needs platform capability: PC-2, PC-7, PC-8]* — none new; steps: a `during` range on `signups`, copied from the class by the PHP handler; an exclusion constraint on `signups (person_id WITH =, during WITH &&)`; the PHP 409; the page message · T53, T54, T43 · probes per layer (the PHP layer runs against the SQLite mirror, so end-to-end is not verified; section 13) · earns **M4**.

**Act 5 — Scale and security** (setup: 50,000 bookings, 12 clients)

- **T68 · SQL · Question (performance) · Tom · "Harbour Street's bookings page takes ages now."** *[cause: growth and scale; needs platform capability: PC-11]* — reading `EXPLAIN ANALYZE` (sequential scan vs index scan, estimated vs actual rows) · T30 · reply names the slow step and the table (no change yet) · T30.
- **T69 · SQL · Bug · Tom · same page** *[cause: growth and scale; needs platform capability: PC-11]* — `CREATE INDEX` on the columns the query filters by, in the right order · T68 · after `ANALYZE`, the plan uses the index for resource and time, with estimated rows close to actual; no timing threshold (cheat: index on `start_at` alone fails the plan check) · T68.
- **T69a (#77a) · SQL + PHP · Bug (growth) · Sam · "The bookings list tries to show all forty thousand rows and the page freezes."** *[cause: growth and scale; needs platform capability: PC-7, PC-11]* — pagination: `LIMIT/OFFSET`, then keyset (`WHERE (start_at, id) > (?, ?)`) for deep pages · T17, T69, T40 · page 1 and page 200 correct and stable when a row is added between requests (cheat: OFFSET only fails the stability probe) · T17, T69.
- **T70 · PHP · Bug · Tom · "The client report got really slow after we added names."** *[cause: growth and scale]* — N+1 queries: one query per row replaced by one join · T30, T15 · same output, query count at most 2 (cheat: caching per page) · T30 in PHP.
- **T71 · PHP · Bug (security) · Priya · "Our insurer asks how we store passwords. How do we?"** *[cause: rules and security]* — `password_hash`, `password_verify`, rehash on next login · T37, T31 · no plain or md5 passwords left after logins; login probes (cheat: `md5` fails the hash-format probe) · T37. World: `users(id, person_id, client_id, email, password_hash, role, last_login_at, disabled_at)`.
- **T72 · SQL · Bug · Jess · "We've got two accounts for the same person, one with capitals in the email."** *[cause: messy real-world input; needs platform capability: PC-1]* — unique expression index on `lower(email)`, merging duplicates in a transaction · T36, T69, T71 · probe: `JESS@...` rejected (cheat: plain `UNIQUE(email)`) · T36, T39.
- **T73 · PHP · Bug (security) · Jess · "A member cancelled someone else's class by changing the number in the link."** *[cause: rules and security; needs platform capability: PC-7]* — authorisation: ownership in the query (`WHERE id = ? AND person_id = ?`), staff role allowed · T31, T71 · probes: no user -> 401, own -> cancelled, other's -> 403 and unchanged, staff -> allowed (401 and 403 taught here) (cheat: checking the id exists) · T22, T31.
- **T74 · PHP · Bug (security) · Claire Doyle, Riverside Physio (clinic) · "One of my staff saw another company's bookings in the calendar."** *[cause: rules and security; needs platform capability: PC-7]* — tenant scoping from the logged-in user, never from the request · T73, T40 · probe with a tampered `client` value returns only her rows (cheat: validating the parameter but still trusting it) · T40, T44.
- **T75 · SQL · Feature (least privilege) · Grace Adeyemi, compliance · "Our reporting tool logs in as the main account. It could delete everything, couldn't it?"** *[cause: rules and security; needs platform capability: PC-3]* — `CREATE ROLE`, `GRANT SELECT`, column rights, `SET ROLE` to prove it · T36 · role can read bookings, cannot delete, cannot read `password_hash` (cheat: `GRANT ALL`) · T36.
- **T76 · SQL · Feature · Priya · "Can the database itself refuse to show one client another's rows, in case the code slips?"** *[cause: rules and security; needs platform capability: PC-3]* — row-level security (`ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, `current_setting('app.client_id')`) · T75, T74 · as the app role, only own client's rows (cheat: policy without enabling RLS) · T74, T75.
- **T77 · JavaScript · Bug (security) · Claire · "A patient's name came up in bold on the room screen and a pop-up appeared."** *[cause: rules and security; needs platform capability: PC-5]* — untrusted text never goes into `innerHTML` (a genuine reopen of T43 only if his page code used `innerHTML`; the in-world cause, a new patient record containing markup, is visible in the data) · T43 · probe names with `<img onerror>` render as text (cheat: stripping `<b>` only) · T43.
- **T78 · JavaScript + PHP · Bug (works but wrong) · Claire · "The corridor screen shows patients' full names. It should just say 'Booked'."** *[cause: rules and security; needs platform capability: PC-5, PC-7]* — data minimisation: the API sends only what the screen needs · T77, T40 · API output has no names for that endpoint; screen correct (cheat: hiding names with CSS fails the API check) · T40, T43.
- **T79 · PHP + SQL · Bug (security) · Grace · "The logs show thousands of failed logins on one account overnight."** *[cause: rules and security; needs platform capability: PC-7, PC-9]* — throttling: count recent failures in a time window, lock temporarily · T71, T23, T19 · probes: 5 failures -> locked for 15 min, success resets (cheat: permanent lock) · T19, T23. World: `login_attempts(email, at, ok)`.
- **T80 · JavaScript + HTML · Feature · Tom · "People keep submitting the booking form with the end before the start."** *[cause: messy real-world input; needs platform capability: PC-5]* — form events (`addEventListener('submit')`, `preventDefault`), `<label>`, `required`, `type="datetime-local"`; the server still checks · T43, T37 · page shows the message; the PHP probe still rejects a direct bad request (cheat: front-end check only) · T37, T43.
- **T81 · JavaScript + CSS · Feature · Maya · "Clashing slots should be red on the calendar. They're all grey."** *[cause: client feature request; needs platform capability: PC-5]* — `classList.toggle` and a CSS class rule · T80, T26 · clashing cells carry the class, CSS rule present (cheat: inline style on every cell) · T26.
- **T82 · SQL · Question (security investigation) · Grace · "An auditor asks: did anyone export client data they shouldn't have last week?"** *[cause: rules and security]* — investigating a log table with joins and grouping; reply with evidence · T56, T30 · correct users and counts (cheat: listing all exports) · T30, T56. World: `api_requests(user_id, path, client_id, at)`.
- **T83 · JavaScript · Bug (wrong diagnosis) · Sam · "Your server must be down. My calendar's empty."** *[cause: misunderstanding; needs platform capability: PC-6]* — handling failure (`res.ok`, `try`/`catch`, a message to sign in again) · T42 · on a 401 the page says so; on 200 it renders (reply: "your session expired, the server is fine") · T42, T54.
- **T84 · JavaScript · Bug (performance) · Maya · "The dashboard makes five requests one after another and takes ages."** *[cause: growth and scale; needs platform capability: PC-6]* — `Promise.all` · T83 · same result, requests overlap in time (cheat: dropping requests) · T42.
- **T85 · review, several languages · checkpoint · Maya · "Here's my whole 'block booking' change. Anything wrong before it ships?"** *[cause: other people's code]* — none new · T44, T73, T74, T77 · at least three planted defects each proven with a failing input and fixed · earns **M5**.

**Act 6 — Audit and compliance**

- **T86 · SQL · Feature · Grace · "For ISO 27001 we must be able to say who changed any booking, and when."** *[cause: rules and security]* — a trigger (`plpgsql`) writing `audit_log` with `to_jsonb(OLD)`/`to_jsonb(NEW)` and the acting user · T39, T75 · probes: insert, update, delete each leave one correct audit row (cheat: auditing inserts only) · T39. World: `audit_log(id, at, actor_user_id, action, table_name, row_id, before jsonb, after jsonb)`.
- **T87 · SQL · Feature · Grace · "The auditor asked what stops someone quietly editing the audit log."** *[cause: rules and security; needs platform capability: PC-3]* — append-only: `REVOKE UPDATE, DELETE`, a blocking trigger · T86, T75 · app role cannot change or delete audit rows (cheat: revoke on one role only) · T75, T86.
- **T88 · SQL · Question (not a bug) · Sam · "Your system moved my booking to Thursday without asking!"** *[cause: misunderstanding]* — reading JSON fields (`->>`) in the audit log · T86 · world unchanged; reply names Sam's colleague and the time · T11, T86.
- **T89 · PHP · Bug · Tom · "Sam cancelled a booking and it shows as cancelled, but his refund never went through."** *[cause: other people's code]* — PDO transactions (`beginTransaction`, `commit`, `rollBack`) so two writes the application must pair (cancel the booking, insert the refund payment) happen together · T39, T54, T63 · probe: a failure while inserting the refund leaves the booking uncancelled; success leaves both (cheat: catching the error and carrying on) · T39 in PHP.
- **T90 · SQL · Feature · Grace · "Our retention policy: details of people who left over two years ago must go, but usage figures must stay."** *[cause: rules and security; needs platform capability: PC-1, PC-9]* — estimate first, then anonymise with `UPDATE ... FROM`/subquery in a transaction · T50, T39, T45 · names and emails gone for exactly the right people, booking counts unchanged (cheat: deleting people breaks bookings) · T45, T39.
- **T91 · SQL · Feature · Grace · "Quarterly access review: who has admin rights and hasn't logged in for ninety days?"** *[cause: rules and security; needs platform capability: PC-9]* — interval arithmetic against the ticket instance's stored date (PC-9), then disabling · T71, T16 · right users disabled, nobody else (cheat: disabling every admin) · T16, T75.
- **T92 · PHP · Feature · Claire · "A patient has asked for all the data we hold about them."** *[cause: rules and security; needs platform capability: PC-7]* — a nested JSON export, scoped and audited · T40, T74, T86 · export complete for that person only, an audit row recorded (cheat: exporting the whole people row set) · T40, T74.
- **T93 · JavaScript · Feature · Grace · "Show me what changed in booking 812 in a way I can read."** *[cause: report or question]* — comparing two objects (`Object.keys`, `Object.entries`, spread) · T88, T29 · list of changed fields only (cheat: printing both whole objects) · T29, T41.
- **T94 · PHP · Feature (refactor) · Maya · "Booking code is fifty loose functions in one long file. Can we have one place for it?"** *[cause: other people's code]* — a class with methods and the `PDO` passed in (`class BookingRepository`) · T31, T54 · probes against the class API, behaviour unchanged · T31, T54.
- **T95 · PHP · Code review + test · Maya · "I've tidied BookingRepository. Could you check it?"** *[cause: other people's code; needs platform capability: PC-14]* — a PHP test that catches a behaviour change (her refactor counts cancelled bookings as busy) · T94, T46 · his test fails on her version, passes on the reference; fix passes probes (cheat: always-passing test) · T46, T28.
- **T96 · SQL · Question · Priya · "For the board: bookings per week with a running total for the year, and our top three clients each month."** *[cause: report or question]* — `sum() OVER (ORDER BY ...)` and `rank()` per partition · T58, T65 · both results correct on both worlds · T58, T65.
- **T97 · SQL · Bug (performance) · Martin · "The monthly report times out now we've five years of data."** *[cause: growth and scale; needs platform capability: PC-2, PC-11]* — a GiST index on the range column and a partial index on active bookings · T69, T53 · plan checks only, no timing (cheat: an index the plan ignores) · T68, T69.
- **T98 · SQL + PHP · Incident · Tom · "Phones are ringing: nobody at Pulse can book anything since this morning's change."** *[cause: other people's code; needs platform capability: PC-2]* — incident triage: reproduce from the logs, find the new constraint rejecting valid data, fix safely, reply · T53, T54, T86 · Pulse can book, the intended rule still holds, audit intact (cheat: dropping every constraint) · T54, T36.
- **T99 · SQL · Feature (capstone 1/3) · Anil · "Hazardous kit needs a trained supervisor booked alongside the user."** *[cause: client feature request; needs platform capability: PC-2]* — none new: table, constraint or trigger, audited · T50, T53, T86 · probes for the rule.
- **T100 · PHP · Feature (capstone 2/3) · Anil · same feature** *[cause: client feature request; needs platform capability: PC-7, PC-8, PC-14]* — endpoint: validated, authorised, tenant-scoped, audited, transactional, 409 on conflict, with tests · T89, T73, T74, T95.
- **T101 · JavaScript · Feature (capstone 3/3) · Anil · same feature** *[cause: client feature request; needs platform capability: PC-5, PC-6, PC-14]* — page: fetch, render safely, handle errors, form validation, a test · T83, T80, T46 · (M6 now comes from WS1-WS3, below).

**Work samples: what defines "programmer" (after T101, #110-#112).** No Learn
card, no worked example, no hints beyond the free tools (errors, check names,
his own Codex searches), and no split by language. Each is sized for 40-90
minutes, playable in 3-5 minute steps that he defines himself (the tracker
shows only his own checkpoints). Each must be passed unaided, then a fresh
equivalent (another client, another feature of the same size) passed again at
least 21 days later. M6 depends on both passes.

- **WS1 · all three languages · Feature · Martin · "Hall hirers want to add extras (a projector, a PA) to a booking, charged by the hour, and see the total before paying."** — end to end: a PostgreSQL migration (table, keys, constraints), a PHP endpoint with PDO, validation, authorisation and correct statuses, a JavaScript page that calls it and renders safely, and a test that proves the pricing · all of Acts 1-6 · graded per layer by probes (PC-5, PC-6, PC-7, PC-8, PC-14) · cause: client feature request.
- **WS2 · PHP + SQL · Bug · Claire · "Since we installed the contractor's reminders plugin, some patients get two reminders and some none."** — a bug in an unfamiliar multi-file codebase (the plugin: about 8 files he has never seen); reproduce, trace, fix, test, reply · needs the multi-file runtime (PC-10) · cause: other people's code.
- **WS3 · review · Maya · "Could you review my recurring-bookings change before Friday?"** — a realistic diff (about 150 lines) with one real defect (for example a clock-change drift or a missing tenant filter) among ordinary, correct code; not announced as planted; he must find it, prove it with an input and suggest the fix; false alarms are shown back to him · cause: other people's code.


---

## 9. The recall map

What he learns at one ticket he must *use again* inside new problems at
expanding gaps: roughly the next ticket or two, then 3-5 tickets later, then
about 10, then about 20-30, then a due review or reopen in another language or
a new variation. Recall is real use in a new problem, never the same ticket and
never a quiz. **U** marks the recall that must be clean (no hints) and in a
different form (new data and surface, often another language); it is the one
that counts toward *Can do*. Several variants after one position are lettered (`v@#16a`, `v@#16b`). A U must force its concept (a different approach cannot pass), and recall credit is given only for constructs the submitted code actually used (section 1). If he solves a U with another valid construct (a loop instead of `filter`), that construct gets the credit and the U is served again later as another variant. `v@#k` is a fresh variant the director inserts
right after position #k (planned, not optional); `D` is the due review the
forgetting curve schedules after the ladder, in another language where the
concept exists there. Positions: O1-O5 are #1-#5, T01 #6, T02 #7, T03 #8, T04
#9, T06 #10, T08 #11, T10 #12, T11 #13, T13 #14, T14 #15, T16 #16, T17 #17, O6
#18, O7 #19, T05 #20, T09 #21, T12 #22, O8 #23, T07 #24, T15 #25, T18 #26, and
T19-T101 are #27-#109.

| Concept (pattern) | Taught at | Recalled at (expanding gaps) | U: unaided, new form |
|---|---|---|---|
| Table, row, column | #1 O1 | #2, #6, #10, #35 (T27 new column), #43 (T35 new table) | #43 |
| Ids that point | #2 O2 | #10, #14, #15, #38 (T30 join), #43 (foreign key) | #38 |
| Run code, read errors | #3-#4 O3-O4 | #8 (missing quote), #19 (JS errors), #23 (PHP errors), v@#24 (Priya's PHP script: "Undefined variable $nmae"), #36 (wrong answer, no error), #44a (stack trace), #62 (T54) | v@#24 |
| Look it up in the Codex | #5 O5 | #11, #17 (T17, learn by look-up), #53 (T45), #69 (T61) | #17 |
| SELECT ... FROM | #6 T01 | #7, #8, #11, #12, #13 (first blank SQL editor), #24 (in PHP), #38 | #13 |
| WHERE (find by key) | #8 T03 | #9, #12, #14, #24 (PHP), #30 (T22), v@#44 (new problem, after T36: a colleague's update by name changed both Boardrooms) | #14 |
| UPDATE | #9 T04 | v@#10, v@#13 (L3), v@#19 (SQL, between JS tickets), #29 (T21, if he moves the booking), #41 (T33: cancelling is forced, deleting is a cheat), #43, #47, #98 | v@#13 (for M1); #41 (forced, different form) |
| INSERT | #10 T06 | v@#11, v@#15 (L3: a new member joins), #24, #43 (backfill), #45 (PHP), #53a (import), #70 | v@#15 (for M1); #45 (PHP) |
| ORDER BY | #11 T08 | #17, #26, #42, #65 (JS sort), #66 | #26 |
| Comparisons | #12 T10 | #13, #15, #16, #22 (JS, prompted), #26, #27 | #26 (checkpoint, unlabelled) |
| Investigate before you change | #13 T11 | #14, #40 (T32), #53 (T45), #90 (T82), #96 (T88) | #40 |
| DELETE | #14 T13 | v@#16b (L3: remove a duplicate room), v@#19, #29 (T21, if he deletes), #35 (a new feature, not a reopen: records must now be kept), D (PHP) | v@#16b |
| AND | #15 T14 | #16, #17, #27, #31, #53 | #27 |
| Time filters (a day) | #16 T16 | v@#16a (the gate: the Studio on Tuesday), #17, #27, #28 (JS, taught there with dates), #31, #42, #68 | #31 (T23, unlabelled count for last month) |
| Sort and take the top (LIMIT) | #17 T17 | v@#17 (the gate: last booking in the Library on Friday), #26, v@#33 (three busiest rooms), #66, #77a (pagination), #104 | v@#33 |
| JS lists, `.length`, `return` | #20 T05 | #21, #22, #28, #32 | #28 |
| Loop over a list | #21 T09 | #22, #25 (PHP, loop given), #28, #37 (T29: the loop is his), #41 (nested) | #37 |
| JS `if`, `===` | #22 T12 | #28, #32, #34, v@#35 (label each booking 'morning' or 'afternoon', JS only), #37, #63 | v@#35 |
| PHP query and echo | #24 T07 | #25, #30, #39, #45, #48 | #30 |
| PHP `foreach` | #25 T15 | #30, #39, #48, #74, #78 | #30 |
| Overlap of two time ranges | #27 T19 | #29, #34 (JS), #39 (PHP), #41, #53, #54, #60 (`&&`) | #34 |
| JS dates | #28 T20 | #34, #46, #65, #69 | #46 |
| Never trust input (prepared) | #30 T22 | #39, #41a (O'Brien, legacy script), #45, #48, #52 (spot it in review), #81, #82 | #41a |
| Count | #31 T23 | #33, #36, #40, #53, #64, #87 | #36 |
| `filter` with `=>` | #32 T24 | #37, v@#39 (JS only: Sam's cancelled bookings), #41, #46, #72, #101 | v@#39 |
| Count per group | #33 T25 | #37 (JS tally), #40, #42, #53, #64, #73 | #42 |
| JS functions | #34 T26 | #39 (PHP form), #41, #54, #63 | #54 |
| Change a table's shape, NULL | #35 T27 | #36, #43, #56 | #43 |
| IS NULL (soft delete) | #36 T28 | #37, #39, #40, #41, #53, #61, #103 | #41 (T33: only active clashes count) |
| Object as tally | #37 T29 | v@#40, v@#48 (bookings per client name, blank editor), v@#62, #101 (T93) | v@#48 |
| Look up across two tables (JOIN) | #38 T30 | #40, #41, #42, #53, #57, #78 (PHP) | #42 |
| PHP functions | #39 T31 | #45, #59, #62, #102 | #59 |
| Keep the ones with no partner | #40 T32 | #40a (COALESCE), v@#43 (clients with no rooms), #58 (NOT EXISTS), D (JS) | v@#43 |
| Self-join | #41 T33 | v@#42 (a person booked in two rooms at once), v@#47 (the same across clients), #61, #67, D (JS) | v@#47 |
| Create table, foreign key | #43 T35 | #44, #55, #57, #94 | #55 |
| Make it impossible (constraints) | #44 T36 | #47, #55, #61, #80, #106 | #55 |
| Validate then save | #45 T37 | #48, #59, #88 (JS form), #108 | #59 |
| `map`, template text | #46 T38 | #49, #51, v@#53 (one line per person from the API, JS only), #69 | v@#53 |
| All or nothing (transactions) | #47 T39 | v@#48 (swap two lessons' rooms), v@#52 (move Oakfield's Tuesday lessons), #56, #68, #74a, #97 (PHP), #98 | v@#52 |
| JSON API (PHP) | #48 T40 | #50, #55, #62, #86, #100 | #55 |
| JSON parse/stringify (JS) | #49 T41 | #50, v@#52 (count the new members in Harbour's JSON), v@#60 (settings stored as JSON text), v@#80, #101 | v@#60 |
| `fetch`, `await` | #50 T42 | #51, v@#53 (render the people list from the API), #91, #92, #109 | v@#53 |
| DOM | #51 T43 | v@#53, v@#58, #75, #85, #88, #89, #109 | v@#53 |
| Code review | #52 T44 | v@#54 (Maya's site search pastes the typed name into SQL: injection, unannounced), v@#62 (her query forgets cancelled bookings), v@#75, v@#88, #93, v@#100, #103, WS3 | v@#54 |
| Estimate before you change | #53 T45 | #53a, #55 (T47 estimate step), v@#56 (rows the migration touches), #98, #106 | #55 |
| Prove it with a test | #54 T46 | #63, #103 (PHP), #108, #109 | #63 |
| EXISTS | #58 T50 | #59, v@#65 (autoclave bookings without in-date training), #98, #107 | v@#65 |
| Ranges `&&` | #60 T52 | #61, #70, #105 | #70 |
| EXCLUDE | #61 T53 | #62, #70, #75, #106 | #75 |
| Fail loudly, handle kindly | #62 T54 | #75, #91 (JS), #97 (T89: roll back on failure), #106 | #91 |
| HAVING | #64 T56 | #73, #90 | #90 |
| Window functions | #66 T58 | #67, v@#73 (each member's latest booking), #104 | v@#73 |
| Time zones | #68 T60 | #69 (JS), #70, D | #70 |
| Money in pence | #71 T63 | #72 (JS), D | #72 |
| EXPLAIN, indexes | #76-#77 T68-T69 | #77a, #80, v@#86 (the audit query is slow: choose the index), #105 | v@#86 |
| Passwords | #79 T71 | #87, #99 | #87 |
| Authorisation, tenant scoping | #81-#82 T73-T74 | #84 (RLS), #93, #108 | #93 |
| Least privilege | #83 T75 | #84, v@#89 (a payments-export role), #95 | v@#89 |
| One query, not N | #78 T70 | v@#82, v@#90 (the invoice page), D | v@#90 |
| PHP `if` and lists | #38a T30a | #39, #45, #62a, #75 | #45 |
| COALESCE | #40a T32a | v@#48, v@#58, #104 | v@#58 |
| Stack traces and logs | #44a T36a | #62, #106 (T98 incident), WS2 | #106 |
| Upsert, RETURNING | #53a T45a | v@#62, v@#70, D | v@#70 |
| IN (list, subquery) | #57a T49a | #58, #98 | #98 |
| HTTP methods and statuses | #62a T54a | #75, #100, #108, WS1 | #75 |
| CASE | #64a T56a | v@#73, #104 | v@#73 |
| CTEs (WITH) | #73a T65a | #104, #105 | #104 |
| Concurrency (lock or constraint + retry) | #74a T66a | D, WS1 | D |
| Pagination | #77a T69a | v@#86, D | D |
| Untrusted text in the page | #85 T77 | #86, #93, #109 | #93 |
| Audit trail | #94 T86 | #95 (T87), #96 (T88), #100 (T92: the export is audited), #106 (T98: audit intact), #107 | #100 |

Concepts taught late (Acts 4-6) cannot reach the 20-30 ticket gap inside the
ladder; their later steps come from the forgetting curve after the ladder ends
(the director keeps serving due variants for as long as he plays).

**A worked example of the map.** "Find by key" (`WHERE ... =`) is taught at
#8, when Priya asks what the Boardroom seats. He uses it again straight away
at #9 to correct the Boardroom, and at #12 to find rooms for seven. At #14 he
needs it with no label and no hints when Sam asks to cancel one Friday
booking: he must find the id before deleting (this is its U recall). At #24 it
comes back inside PHP, typed from memory into `$pdo->query`. At #30 the value
comes from a stranger's keyboard, so the same pattern is written as a
prepared statement. At `v@#44` (right after T36, when two clients each have a Boardroom), Tom says "I changed Oakfield's Boardroom to 12
seats and Harbour's changed too": Tom's own update picked rooms by name, and
now two clients each have a Boardroom. That is a new problem with a cause he
can find (Tom's statement is in the ticket's history), not his T04 fix
"breaking": his T04 fix was a one-off change that was right at the time.
Across days, whenever the WHERE x PHP cell drifts into the sweet spot, the
director picks a ticket that needs it.

**The timing rule across days.** The ladder order gives the within-order
spacing above. Across days the forgetting-curve meter drives it: each concept
x language cell has an estimated recall `R = e^(-t/S)`. Every cell that entered
the sweet spot (0.75-0.85), went late (0.70-0.75) or went due (< 0.70) since
the last session goes into the overnight set that opens the next session (at
most 8, or 10 with genuine reopens; due first; at most 2 per concept family;
at most half in one language), interleaved 3 recalls to 1 new ticket after a
quick win (section 4). Each is served as a ticket that *needs* that concept (a
ladder ticket that uses it, a fresh variant, or a genuine reopen).
When the ladder order and the meter both want a slot, the meter wins for up to
one ticket in four, so new material keeps moving.

### Explain steps and calibration prompts

Explain steps (closed book, then model answer and checklist; practice, never
evidence) close these tickets: T11 (why did the system refuse?), T19 (why is
a meeting from 13:30 a clash at 14:00?), T21 (why keep the older booking?),
T28 (why did `= NULL` count nothing?), T32 (why did the Music Room vanish from
the list?), T39 (what would have happened without the transaction?), T44 (how
could someone misuse Maya's code?), T53 (why can't two overlapping bookings now
exist?), T68 (why is the page slow?), T74 (why must the client come from the
logged-in user?), T86 (how would you prove who changed a booking?). Each
checklist has 3-4 points in plain words.

Calibration prompts ("Will you solve this without hints?") appear on about one
ticket in four during Acts 1-2 and one in five later, always on checkpoints (T18, T34, T47, T67, T85,
T101), and the pattern collection shows his hit rate over time.

---

## 10. Review design

### Why tickets appear (every ticket has a true cause)

If his code were perfect, tickets would still arrive, because the world
changes. Every ticket in section 8 carries one cause category, and the
director only raises a ticket whose cause exists in the world state:

| Cause | What it looks like in the world | Examples |
|---|---|---|
| Client feature request (the largest source) | a client asks for something new | T06, T27, T40, T54a, T62, WS1 |
| Growth and scale | a data threshold is crossed (300, 2,000, 50,000 bookings), a new client or district arrives | T21, T35, T53, T66a, T68, T69a |
| Messy real-world input | imports, apostrophes, typos, clocks changing, daylight saving | T04, T13, T33a (O'Brien), T45a (CSV sent twice with bad rows), T60, T72 |
| Other people's code | a colleague's change, a contractor's plugin, an inherited legacy script, a code review | T24, T31, T33a (legacy script), T36a, T44, T66 (contractor's export plugin), WS2, WS3 |
| Rules and security | ISO audit trails, a regulation, an attack in the logs | T50, T71, T79, T86, T90 |
| Misunderstanding ("not a bug") | the client's diagnosis is wrong or the system is right | T11, T32, T32a, T83, T88 |
| Report or question | only code can answer it | T23, T25, T45, T96 |

**What drives the director:** the business state (a new client signs, a data
threshold is crossed, a district opens: each only when the skills it needs are
`Working`, section 4), the skill meter (a sweet-spot or due cell selects an
event that needs it) and pacing (section 5).

**The honesty rule.** The game never pretends that working code broke. A
review of a skill whose earlier fix was solid arrives as a **new problem**
that needs the skill (another client, another language, another variation),
never as "your fix failed". A ticket reopens only for a realistic cause he can
discover by investigating, which is shown in the world: a colleague's commit
in the change history, or new data the fix did not handle.

### How reopens work

- **Genuine reopen (code that persists).** Only code that stays in the
  codebase can reopen: functions, endpoints, constraints, views and page code.
  When an in-world event happens (a colleague's commit touches the same code,
  or new data arrives that the code does not handle), his stored solution is
  replayed against the new state. If it fails, the ticket reopens with his own
  code in the editor, and the cause is visible (the commit, or the new rows).
  If it passes, nothing reopens.
- **One-off data fixes never reopen.** A capacity corrected, a booking
  cancelled: these were right at the time. Their skills come back as new
  problems.
- **Weak pass.** A solution that passed the checks but failed hidden
  robustness probes is told so at once ("works today; this edge would catch
  it: ..."), and a new problem with that edge arrives at the half interval.
- **Due variant.** When a cell is in the sweet spot and nothing reopens, the
  director serves a fresh variant of a past ticket (new data and wording,
  often another language).

### Genuine reopens (code that persists), with their in-world cause

| His code | Reopens at | Discoverable cause |
|---|---|---|
| T19 / T31 `isFree` | T35 | Tom's commit adds a second client; the function now sees other clients' rooms (the commit is in the history) |
| T26 / T46 `clashes()` | T61 | the clocks change; new lessons straddle the change (new data) |
| T40 rooms endpoint | T74 | a clinic signs and a staff member tries another client's id (the request is in the log) |
| T43 room page | T77 | a patient record containing markup arrives (visible in the data), only if his page used `innerHTML` |
| T53 exclusion constraint | T98 | Maya's migration adds a stricter rule on top of it (her commit is in the history) |

### New problems that need an earlier skill (not reopens)

| Earlier skill | New problem | Why it is new |
|---|---|---|
| T04 update one row | `v@#44` (Tom's update by name changed both Boardrooms) | a colleague's update; his own fix was right |
| T13 delete | T27 (records must now be kept) | a client feature request |
| T22 prepared statements | T33a (legacy script), T44 (review), T74 (tenant) | other people's code |
| T28 IS NULL | T29, T45, T95 | new reports and a colleague's refactor |
| T36 UNIQUE | T72 | new data: e-mails with capitals |
| T37 validation | T60 | the clocks change |
| T39 transactions | T89 | a new pair of writes in PHP |
| T21 clash fix (a one-off) | T33, then closed for good by T53 | the system still has no guard; new clashes are visible in the data |

### Interleaving pattern

After the opening set, within a session: new, new, recall (if anything is in
the sweet spot), new, ... with no more than two new tickets in one language in
a row. Each concept's transfer ticket comes 3-6 tickets after it is taught
(examples: WHERE T03 -> PHP T07; loops T09 -> PHP T15; overlap T19 -> JS T26 ->
PHP T31; grouping T25 -> JS T29; transactions T39 -> PHP T89). Review sets draw
at most half from one language and at most two items per concept family (for
example "time ranges"). From Act 3 a small code-review variant appears every
10-15 tickets (section 9), because review is a daily junior task.

### The skill map behind the meter

Each meter is one **concept x language cell**. Concept families and their
cells (S = SQL, J = JS, P = PHP):

- Reading: select/columns (S), where (S, J via filter, P via prepared), sort/limit (S, J), loops (J, P).
- Changing data: insert, update, delete (S, and J/P via write-back), soft delete (S, P).
- Time: time filters (S, J), overlap (S, J, P), time zones (S, J), ranges and exclusion (S).
- Summaries: count/group/having (S, J tally, P), distinct (S), windows (S).
- Relations: joins, left join, self-join (S; P in T70), subqueries (S).
- Schema: alter, create/foreign keys, constraints, migrations, indexes (S).
- Correctness: NULL (S, J `??`), transactions (S, P), validation (P, J), error handling (P, J), money (P, J).
- Code: functions (J, P), array methods (J, P), objects (J), JSON (J, P), async (J), DOM/forms/CSS (J), classes (P).
- Security: injection (P), passwords (P), authorisation and tenant scoping (P, S via RLS), least privilege (S), XSS (J), throttling (P), audit (S, P).
- Workflow: investigate/reply, other people's code, review, tests, impact, incidents (language-neutral cells, scored on the ticket's language).

A solve updates every cell the ticket exercises (the new idea at full weight,
revisited skills at half), which is how revisits keep older cells alive.

---

## 11. Coverage matrix

First = the ticket that teaches it in that language; then revisits. "-" means
not applicable in that runtime (explained). **GAP** = needed but thin.

| Concept | SQL | JavaScript | PHP |
|---|---|---|---|
| Tables, rows, columns, ids | O1, O2 (T01, T06, T27, T30, T35) | T05 (world as lists) | T15 (rows as arrays) |
| Running code, reading errors | O3, O4 (T03, T28) | O6, O7 (T05, T83) | O8 (T07, T54) |
| Looking things up (Codex) | O5 (T08, T17, T45) | T61 | T37 |
| Program, variable, `=` stores | - | O6 (T05, T12) | O8 (T07) |
| Read a table / columns | T01, T02 (T07, T18) | T05 (T09) | O8, T07 (T15) |
| Filter (WHERE / if / filter) | T03, T10, T14 (T16, T19) | T12, T24 (T29) | T07 via SQL, T22 (T37) |
| Sort, limit | T08, T17 (T18, T34) | T57 (T66 transfer) | T66 |
| Insert / update / delete | T06, T04, T13 (T21, T33, T36) | write-back T21 variants (T33) | T21, T37 (T51) |
| Time filters and dates | T16 (T19, T23) | T20 (T38, T61) | T37 (T60, a new problem) |
| Overlap | T19 (T21, T33, T45) | T26 (T46, T55) | T31 (T37, T51) |
| Aggregates, GROUP BY | T23, T25 (T32, T34, T45) | T29 (T64) | T70 (via SQL) |
| HAVING, DISTINCT | T56, T45 (T65, T82) | - | - |
| NULL | T27, T28 (T32, T45) | `??` in T29 | T31 (cancelled) |
| JOIN, LEFT JOIN, self-join | T30, T32, T33 (T34, T45, T49) | nested loops T33 | T70 |
| Subquery / EXISTS | T50 (T90) | - | T51 |
| Create table, foreign keys | T35 (T48, T49) | - | - |
| Constraints | T36 (T53, T72, T98) | - | T54 (handling) |
| Transactions | T39 (T48, T60, T72, T90) | - | T89 (T100) |
| Migrations | T48 (T98) | - | - |
| Indexes, EXPLAIN | T68, T69 (T72, T97) | - | T70 (query count) |
| tstzrange, EXCLUDE | T52, T53 (T62, T97, T99) | - | T54 (the error) |
| Window functions | T58, T59 (T96) | - | - |
| Time zones | T60 (T62) | T61 | T37 (T60, a new problem) |
| generate_series, date_trunc | T62, T65 | - | - |
| Roles, RLS | T75, T76 (T87) | - | T74 (app-level) |
| Triggers, audit, jsonb | T86, T87, T88 (T92, T99) | T93 | T89, T92 |
| Values, return, arrays | - | T05 (all JS) | T07 (all PHP) |
| Loops | - | T09 (T12, T33) | T15 (T66) |
| Functions | - | T26 (T46) | T31 (T37, T94) |
| Array methods | - | T24, T38, T57, T64 (T93) | T66 |
| Objects | - | T29 (T93) | assoc arrays T15 (T40) |
| JSON | T88 (jsonb) | T41 (T42) | T40 (T54, T92) |
| async / fetch | - | T42 (T83, T84) | - |
| DOM, forms, CSS | - | T43, T80, T81 (T77, T101) | - |
| Error handling | - | T83 | T54 (T89) |
| Prepared statements / injection | - | - | T22, T44 (T74) |
| Input validation | - | T80 | T37 (T51, T100) |
| Password hashing, throttling | - | - | T71, T79 |
| Authorisation, tenant scoping | T76 | - | T73, T74 |
| XSS, data minimisation | - | T43, T77, T78 | T78 |
| Money in pence | - | T64 | T63 |
| COALESCE, CASE, IN, CTEs | T32a, T56a, T49a, T65a (v@#58, v@#73, T90, T96) | - | - |
| Upsert, RETURNING | T45a (v@#62, v@#70) | - | `lastInsertId` in T54a |
| Pagination | T69a | - | T69a |
| Concurrency (lock or constraint + retry) | T66a (WS1) | - | T54 handling |
| HTTP methods and statuses | - | T83 (reads status) | T54a (T75 checkpoint, T100, WS1) |
| Stack traces, logs | T82 (log table) | O7 (errors) | T36a (T98, WS2) |
| PHP control flow (`if`, lists) | - | - | T30a (T37, T54a) |
| Classes | - | **GAP** (Codex only) | T94 (T95) |
| Tests | - | T46 (T55, T101) | T95 (T100) |
| Investigate / not a bug / wrong diagnosis | T11, T32, T88 | T83 | T11 |
| Review, impact, incident | T45, T90, T98 | - | T44, T85, T95 |
| Unscaffolded work samples | WS1 | WS1 | WS1, WS2, WS3 |

Gaps flagged: JS classes (not needed for the job's front-end basics; Codex
only), JS `switch`/regular expressions/`Set` (Codex only), SQL `OR` (Codex
from T14, used lightly), PHP sessions and cookies (the game injects `$user`;
see section 13), HTML/CSS layout (only T80-T81; light).

---

## 12. Prerequisite check

Every ticket's **Needs** was checked against the ticket that teaches each idea
it uses. Exceptions found while drafting, and how they were fixed:

1. T13 (DELETE) first needed `AND` to pick one booking; fixed by finding the id
   first (two statements), `AND` moved to T14.
2. T21 (double booking) allowed JavaScript, whose natural fix uses `filter`
   (T24); JavaScript now joins only in review variants after T24.
3. T11 allowed JavaScript before `if` (T12) and PHP before its foothold (#23);
   limited to SQL (it sits at #13).
4. T31 (isFree) must ignore cancelled bookings, so it now needs T28.
5. T32 (LEFT JOIN) needs `count(column)` versus `count(*)`: taught inside T32
   as part of the one idea (rows with no partner), relying on T25.
6. T33 JavaScript path needs `clashes()` (T26) and `filter` (T24): both listed.
7. JSON parsing was first needed in T42 (fetch); split into T41.
8. T45 originally used day-of-week (`extract(dow)`, untaught); reworded to a
   date range (T19).
9. T76 (RLS) needs roles (T75) because the table owner bypasses policies:
   roles now come first.
10. O8's worked example uses `count(*)` before T23: allowed only as a shown
    example ("just run it"), never needed to solve O8 or T07.
11. Zero-knowledge pass (after the starting point changed to "no syntax
    known"): T01 assumed he knew what a table and a query were, so the on-ramp
    O1-O5 now comes first; T05 assumed "program", "variable" and `return`, so
    O6-O7 precede it; T07 assumed `$`, `->` and `.`, so O8 precedes it; T08
    assumed `ORDER BY` could be found, now met in O5; T12 used `===` untaught,
    now introduced there with a Codex entry. The first JS and PHP tickets moved
    after the SQL foothold (serve order in section 8), so T11 and T13-T17 no
    longer sit between languages.
12. Scaffold check: no blank editor before L0 -> L1 -> L2 in that language,
    and every first blank editor is a ticket with no new keyword (SQL at T11
    #13, JS at `v@#28`, PHP at T33a #41a).
13. Symbol check: every symbol in a ticket's expected solution appears in the
    symbol table (section 3) at or before that ticket.
14. After review: T04 used SQL `=` as assignment untaught (now taught there
    with both meanings); T12 bundled `if`, collecting, `===` and the first
    blank editor (now L2 with the collecting lines given); T20 used `&&` and
    `new` (now Codex entries there, loop given); T22 used PHP `[ ]` (now in
    the symbol table); T23 used `::int` (Codex note, optional); T24's
    colleague code limited to taught syntax, and `.find` taught there as
    `filter`'s sibling; T29 bundled tally, `.find` and `??` (now `.find` from
    T24, `??` given in the starter); T37 used PHP `if`, `!`, `||`, `$list[]`
    and `::` untaught (PHP control flow now taught at T30a before T31 and T37;
    `::` in T37's Codex); T66 used `<=>` (symbol table); T67 needed a
    cross-table rule (re-scoped to an exclusion constraint on `signups` with a
    copied range); T89 contradicted T86 (rewritten around a booking and its
    refund); T88's `->>` cross-linked with PHP `->`; T13 now says to find
    Friday on the timetable, since time values come at T16.
15. Lettered tickets: T30a needs T15, T12; T32a needs T32, T28; T33a needs
    T22, T15; T36a needs T31; T45a needs T36, T35, T45; T49a needs T49, T27;
    T54a needs T54, T40, T37; T56a needs T56; T65a needs T65, T30; T66a needs
    T39, T53, T54; T69a needs T17, T69, T40. Each sits after all of them.
16. T18: the JavaScript and PHP paths would need sorting (T57/T66), so the
    ticket says "SQL recommended"; the other languages are allowed but not
    needed for the milestone.

Known remaining soft spots: `SERIAL` ids (T06, T21) and `OR` (T14) arrive as
Codex notes rather than their own tickets; Act 2 onwards tickets carry the
same objective and recap fields but they are not written out here.

---

## 13. What the game cannot teach or verify

Said plainly so the milestones are not over-read:

- **Version control and team process:** git, branches, pull requests in real
  tools, stand-ups, estimation, ticket systems, change approval.
- **A large existing codebase and its framework:** whatever Siso actually uses
  is unknown here; the game's codebase is small and made for it.
- **Deployment and operations:** servers, web server configuration, CI,
  backups and restores, monitoring, production releases and rollbacks.
- **PHP against real PostgreSQL:** PHP runs on a SQLite copy, so `pdo_pgsql`
  specifics (`RETURNING`, types, PostgreSQL error codes) are not exercised.
- **Real concurrency:** two users booking at the same instant cannot be staged
  in one browser database; the game teaches the guard (T53) and the handling
  (T54), not the race itself.
- **Real performance:** 50,000 rows in a browser is indicative, not production.
- **Web security beyond the basics:** sessions and cookies, CSRF, security
  headers, dependency updates, penetration testing.
- **Front-end craft:** layout, responsive CSS, accessibility depth, browser
  quirks.
- **People:** talking to real clients, prioritising, ISO audits and their
  documentation.

Also, plainly:

- **Outcome grading does not judge code quality** (naming, structure,
  readability). Only the review tickets touch it, and only partly.
- **No real HTTP server:** there is no request lifecycle, session or `$_POST`
  handling; endpoints are functions the game calls with `$input` and `$user`,
  using this codebase's handler convention.
- **JavaScript runs against a fixture page**, not a real browser app.
- **PHP's database errors and types come from SQLite** through a translation
  layer (section 14, PC-8), not from PostgreSQL.
- **No debugging tools** such as browser devtools or Xdebug; he debugs with
  errors, logs, `console.log` and `echo`.
- **End to end** (database rule to PHP to page) is checked layer by layer,
  not as one running system (T67, T100, WS1).
- **Real races** cannot be staged (T66a is graded on code shape and state).

**The bridge (step B1 of M6, not optional):** git basics, a local PHP +
PostgreSQL setup, and one small project of his own outside the game (about
40-80 hours, section 5). The game names it as the next step and cannot verify
it.

---

## 14. Platform capabilities the ladder requires

The runtimes as built in Phase 1 (`game/world/world.js`, `views.js`,
`game/runners/{sql,js,php}.js`) cannot grade every ticket honestly. Each gap
below is a capability; every affected ticket in section 8 is marked "needs
platform capability". A ticket is not built until its capabilities exist, or
it uses the stated fallback.

| Id | Capability (concrete) | Why (what breaks today) | Tickets |
|---|---|---|---|
| PC-1 | **SQL run modes.** Before T39: Phase 1's wrap in `BEGIN/COMMIT`. From T39: psql semantics: split into statements, autocommit, carry on after an error and report each; snapshot the world before the run and offer "Undo run". | `runSql` wraps every script in one transaction, so T39's cheat passes and a learner's own `BEGIN/ROLLBACK` clashes with the wrapper. | T39 and all later SQL; T60, T66a, T72, T90 rely on it |
| PC-2 | **`btree_gist` loaded** in `World.create` and `World.restore` (`new PGlite({ extensions: { btree_gist } })`; it ships in PGlite 0.5.8 `dist/contrib/btree_gist.js`, as the main app's `test_runtimes_siso.mjs` already uses). Fallback with no extension: `EXCLUDE USING gist (int4range(resource_id, resource_id, '[]') WITH &&, during WITH &&)`. | `new PGlite()` has no extensions, so `CREATE EXTENSION btree_gist` fails. | T53, T62, T67, T97, T98, T99 |
| PC-3 | **Role isolation per run.** Spike first: `CREATE ROLE`, column `GRANT`, `SET ROLE`, RLS in PGlite 0.5.8. The runner issues `RESET ROLE` after every run; checks `SET ROLE` explicitly; tables under test get `FORCE ROW LEVEL SECURITY`. Fallback: grade the catalogue (`has_table_privilege`, `has_column_privilege`, `pg_policies`) as well as behaviour. | PGlite runs as a superuser (superusers bypass RLS), and a learner's `SET ROLE` would persist into later runs and checks. | T75, T76, T87 |
| PC-4 | **Schema-driven, diff-based write-back** for JavaScript and PHP: read the table list and columns from the catalogue; insert, update and delete only rows that changed; skip generated columns, views and audit tables; the PHP runner's hard-coded `['rooms','people','bookings']` goes. | `applyObjects` truncates and reinserts fixed columns: after T27 it resets `cancelled_at`, after T48 `rooms` is a view, after T53 the generated `during` column rejects inserts, after T86 every run floods `audit_log`, after T87 every run fails. | every JavaScript and PHP ticket from #35 |
| PC-5 | **A page runtime:** a sandboxed iframe with a fixture page (preferred) or a DOM shim in the worker with `querySelector(All)`, `createElement`, `textContent`, `append`, `classList`, `addEventListener`, and an `innerHTML` that parses to inert elements so an injected `<img onerror>` is detectable without running. | The JavaScript worker has no DOM. | T43, T77, T78, T80, T81, T101, WS1, v@#53 |
| PC-6 | **A fake `fetch`:** stubbed in the worker or iframe and answered from the world or from the learner's own PHP handler (PC-7); the real network blocked (CSP `connect-src 'none'`); scriptable 401/500 responses. | The worker has the real network `fetch`. | T42, T83, T84, T101, WS1, v@#53 |
| PC-7 | **Request context:** JavaScript gets `input`; PHP gets `$input`, `$user` and `$now`, and endpoints are written as `handle(array $input, array $user, PDO $pdo): array` returning `[status, body]` (taught as "our codebase's convention"). | Today PHP gets only `$pdo`; status codes and headers cannot be observed through the stdout sentinel. | T22, T33a, T37, T40, T41, T44, T47, T51, T54, T54a, T67, T69a, T73, T74, T78, T79, T92, T100, WS1 |
| PC-8 | **SQLite mirror of PostgreSQL rules:** mirror CHECK, UNIQUE, foreign keys, and exclusion (as a trigger raising an error); a harness `PDO` subclass that rethrows mirrored exclusion errors with SQLSTATE `23P01` and a PostgreSQL-like message. The limitation is stated to him. | SQLite reports `23000`/`HY000`, so code written correctly for PostgreSQL fails; SQLite has no exclusion constraints. | T54, T67, T100, WS1 |
| PC-9 | **One controlled clock.** Default: seeds for relative-time tickets are generated from the ticket instance's stored date at attempt start, and truth queries use the same `now()` at grading time (regrade if the date changed mid-attempt). Where a fixed moment matters: the worker's `Date` is overridden, PHP uses the injected `$now` (taught as good practice), and SQL runs with `search_path = public, pg_catalog` and a `public.now()`; `CURRENT_DATE` cannot be overridden, so hints steer to `now()`. | Learners naturally type `now()`, `CURRENT_DATE`, `new Date()` or `time()`, which read the real clock. | T23, T28, T30, T50, T79 (fixed moment), T90, T91 |
| PC-10 | **Multi-file PHP runtime** (adapt the Stage 4 repository runner of the main app): several files, `require`, a file tree view. | One script file only. T31 and T94 were redesigned as single-file; WS2 cannot be. | WS2 |
| PC-11 | **Plan grading:** `EXPLAIN (FORMAT JSON)` checked for a node type and index name, estimates close to actual; `ANALYZE` after seeding; no timing thresholds (browser timing is flaky). | Timing checks would pass or fail at random. | T68, T69, T69a, T97, v@#86 |
| PC-12 | **Time zone data** verified in PGlite (IANA `Europe/London` for `AT TIME ZONE`) and `Intl` in the worker. | Unverified; T60 and T62 depend on it. | T60, T61, T62 |
| PC-13 | **Code-shape detection** per language (does the submitted code contain `BEGIN`, `FOR UPDATE`, `UPDATE`, `.filter`...), used for recall credit (section 1) and for tickets graded partly on shape. | Outcome checks alone cannot tell which construct earned the credit, nor detect a lock. | recall credit everywhere; T39, T66a |
| PC-14 | **Test harness:** JavaScript `expect(x).toBe(y)` (Jest/Vitest shape) and PHP `assertSame` (PHPUnit shape), running learner tests against the buggy version, the reference and his fix. | Nothing runs learner tests today. | T46, T55, T95, T100, T101, WS1 |
| PC-15 | **Large seeds without freezing** (50,000 bookings and five years of history in a worker). | Unmeasured. | Act 5 and 6 |
| PC-16 | **Meter time rules:** fractional-day elapsed time, device clock replaced by server time once synced, a backwards clock ignored (elapsed time never lowered, nothing un-earned). | `curve.js` floors to whole days and trusts the device. | all review scheduling |
| PC-17 | **PHP error and log capture, request replay:** the harness records uncaught exceptions with message, file, line and call chain (shown as a trace), captures `error_log` output and a harness `$logger` into a visible log, and can replay a recorded request (`$input`, `$user`, `$now`) against the handler after a fix. | Nothing captures traces or logs today, and a logged request cannot be re-run. | T36a, T98, WS2 |

Tickets that could be redesigned instead: T31 (three copied functions in one
file) and T94 (one long file into a class) now need no multi-file runtime.

---

## 15. What Phase 2 must build to support this

- **Ticket card fields** beyond Phase 1: `act`, `from` (person, role, client,
  sector), `says`, `cause` (one of the seven categories, section 10), `kind`
  (bug/feature/question/review/incident/checkpoint/work sample), `grading`
  (`query` or `one-off`), `platform` (PC ids), `concept` (one id), `needs`,
  `revisits`, `codex`, `hints` (4 levels), `today` (stored per instance),
  `worldVersion` and `setup`, `inputs`, `shadow` (seed, keeping named entities
  fixed), `robustness` probes, `reopens` (in-world trigger, code-that-persists
  only), `reply` (root-cause options), `timeMinutes`, `steps`,
  `workedExample`, `objective`, `learnCard`, `scaffold` (L0-L3 with starter
  code), `recap`, `pattern`, `explain` (question, model answer, checklist),
  `calibrate` (bool), `servePosition`, `newConcept` (counts toward the daily
  cap: 0 or 1).
- **New check kinds:** `answer` (result, return value or output compared with a
  truth query on real and shadow worlds); `rejects`; `probe` (call the
  learner's function or PHP handler; compare status, body and world effects);
  `plan`; `queries` (PDO query count); `dom`; `tests`; `review` (marked lines
  plus a failing input; false alarms shown back); `shape` (PC-13); `reply`.
- **World growth:** schema versions at T27, T35, T45a, T48-T50, T52-T53, T56,
  T62, T63, T71, T79, T82, T86; the named seed; growth steps triggered by
  `Working` cells, not by ladder position; everything in section 14.
- **Codex:** entry per keyword, symbol and function with a runnable two-line
  example on the live world, unlocked by ticket, searchable, dulling with the
  linked cell; cross-language symbol pages (`=`, `.`, `=>`, `&&`, `->`/`->>`).
- **Hints:** four-level ladder per ticket, each use logged with the solve;
  the credit table in section 1 applied by the memory module.
- **Reopen mechanics:** stored solutions per ticket; replay only for code that
  persists, only on an in-world trigger (a colleague's commit or new data)
  that is shown in the ticket; weak-pass detection from robustness probes; a
  queue with caps.
- **Skill map and meter:** concept x language cells with levels (Seen to
  Held); bands fresh >= 0.85, sweet spot 0.75-0.85, late 0.70-0.75, due < 0.70;
  milestone statements with their evidence list (U and variant solves only),
  provisional/confirmed and "needs refresh".
- **Scheduler change:** replace Phase 1's `nextStability(S, outcome)` with
  `nextStability(S, outcome, R, fast, cleanToday)` as in section 2, item 3
  (R-dependent gain, caps x4 / x3, maximum S 180 days, fractional days, the
  same-day rule, the listed unit tests); change `THRESHOLDS` to the bands.
- **Director:** serves the ladder in serve order; at most 5 new concepts per
  calendar day, each only after every earlier new concept has had one unaided
  solve; the overnight set at session start (quick win, then 3 recalls : 1
  new; cap 8-10); planned `v@#k` variants; Act gates on confirmed milestones;
  business events chosen from world state, meter and pacing; fresh variants
  (and one-step-easier ones after a failure) from ticket templates; never
  blocks play.
- **Company calendar:** Day N = real days since the first session; ticket
  instances store their "today"; PC-9 and PC-16.
- **Unlabelled tickets:** the quest panel shows only symptom and objective
  after a concept's foothold; the concept name appears only through hint 2.
- **Learn loop UI:** Learn cards (first appearance only), runnable worked
  examples, scaffold levels L0-L3 (pre-filled and locked lines), on-ramp
  interactions (clicking a block or row as the answer), the two-line recap, a
  quest-panel objective line, a step tracker for anything over 5 minutes.
- **Codex tracking:** record whether the Codex was opened before the first run
  on a recall ticket (counts as nudged); pattern pages.
- **Explain step:** closed-book text box, then model explanation and
  checklist; skippable in one click; stored, never scored as evidence.
- **Pattern collection:** the "What is this an instance of?" recap choice,
  the visible collection, and the ticket list per pattern.
- **Calibration prompts:** about one ticket in four in Acts 1-2, one in five
  later, every checkpoint; prediction vs outcome shown over time.
- **Rewards:** XP scaled by effort (sweet-spot recall 3, same-day fresh
  variant 1, repeat 0), office upgrades from XP, business growth only from
  `Working` cells, a sweet-spot streak.
- **Session tools:** the break prompt every 25 minutes; the end-of-session
  summary (new ideas, recalls, what fades when) that always ends by gently
  recommending a stop because sleep consolidates memory; the same-night
  repeat message; the projected-pace line ("at your current pace, M4 in about
  5-7 weeks") recomputed each session; "easy today is not the same as kept"
  and "mixed practice feels harder" messages.
- **Work samples:** WS1-WS3 runtime (no hints, no split), learner-defined
  step tracker, and the 21-day re-pass with a fresh equivalent.

---

## 16. Changes after review

Review: `.superpowers/sdd/2026-10-01-grimoire-game-phase2a/learning-design-review.md`.

| Fix | What changed | Where |
|---|---|---|
| 1 Pace rule | cap 5 a day (target 4-5), the unaided-solve gate, what counts as new, the consequence (#1-#26 = 25 concepts, 5-6 days) | section 5 "The pace rule"; section 15 Director |
| 2 50-ticket night | day 4 in full (overnight set, the 5 new with their gates, the other 32 by family, the on-screen repeat message, the summary), days 5 and 6, and day 1 | section 5 worked example |
| 3 Session timing | overnight set at session start with quick win and 3:1 interleave (a); sweet spot 0.75-0.85 (b); real calendar, server time, backwards clock ignored (c); summary recommends stopping, sleep (d) | sections 2.3, 4, 5, 9, 15; PC-16 |
| 4 `nextStability` | fractional days, "fast" defined, same-day rule as a formula, caps and 180-day maximum (R2), unit tests | section 2 item 3; section 1 table |
| 5 Milestones | evidence only from U and variant solves plus checkpoints (a); M1 narrowed, L3 variants added (b); M3 "not yet secured" (c); M6 reworded with the bridge as a named step (d); honest timescale (e) | sections 1, 7, 5, 13 |
| 6 Recall map | U entries fixed (errors, SELECT, loop, time filters, comparisons, UPDATE/DELETE split); recall credit only for constructs used; `v@` steps added (LIMIT, review, self-join, JSON, tally, transactions, fetch/DOM, EXISTS, windows, indexes, least privilege, N+1) and rows for new concepts | section 9; section 1 |
| 7 Shadow world and grading | named entities keep ids and names; `query` vs `one-off` grading, with the one-off list; `grading` card field | section 4; section 8 legend; section 15 |
| 8 Symbols and one idea | SQL `=` both meanings at T04, O6 wording; symbols added (`&&` `\|\|` `!` `new` `::int` PHP `[ ]` PHP `if` `$list[]` `<=>` `->>` range `&&`); T12 to L2; `.find` in T24; T29 starter; PHP `if` taught at T30a before T31/T37; T24 colleague syntax; T67 re-scoped | sections 3, 8, 12 |
| 9 Gradability | T39 redesigned (psql semantics); T31/T94 single-file; timing checks removed; every other gap is a capability PC-1..PC-17 marked on its tickets | section 14; section 8 marks |
| 10 Why tickets appear | `cause` on every ticket; cause table and director drivers; reopens only for persisting code with a discoverable in-world cause; earlier "reopens" recast as new problems; O'Brien, CSV import, legacy script, contractor plugin added | sections 8, 9, 10 |
| 11 Job realism | T30a (PHP `if`), T32a (COALESCE), T33a (O'Brien/legacy), T36a (stack trace and logs), T45a (upsert, RETURNING, CSV), T49a (IN), T54a (HTTP methods and statuses), T56a (CASE), T65a (CTE), T66a (concurrency), T69a (pagination) | section 8; coverage in section 11 |
| 12 T89 | rewritten: cancel plus refund payment as one PHP transaction | section 8 Act 6 |
| 13 Cannot verify | code quality, no HTTP server, fixture page, SQLite errors, no debuggers, layer-by-layer end to end, races | section 13 |
| 14 North star | real-day calendar and per-instance "today" (a); growth and Acts gated on `Working`/confirmed (a); WS1-WS3 unscaffolded, re-passed after 21 days, M6 conditional (b); projection from his own rate plus the 60-100 / 100-180 hour range (c) | sections 4, 5, 6, 7, 8 |

Recommendations applied: R1 (quick win, 3:1 interleave, sweet-spot streak,
skippable explain, steps of 3-5 minutes with a tracker), R2 (caps), R3 (XP for
same-day fresh variants; growth only from `Working`), R4 (named seed), R5 (O6
uses his own numbers), R6 (single pool until T35), R7 (`expect` and
`assertSame` shapes), R8 (calibration 1 in 4 early), R9 (review variant every
10-15 tickets), R10 (T08 at L2, first SQL L3 at T10), R11 (the `==` traps).

### After the re-review

Re-review: `.superpowers/sdd/2026-10-01-grimoire-game-phase2a/learning-design-rereview.md`.

| Item | What changed | Where |
|---|---|---|
| Fix 2 (partial) | day-1 cells now served on day 3 and fresh on day 4; T05 gate is a fresh problem (rooms plus people); `v@#16` split into `v@#16a` (time-filter gate) and `v@#16b` (DELETE); the night follows quick win, 3 recalls, new plus gate; repeat message says "the first counted fully; the rest add almost nothing"; totals now 5 + 10 + 35 | section 5 worked example; section 9 |
| Fix 4 (loose ends) | the fast bonus sits inside the x4 cap; "same day" means within 12 hours | section 2 item 3 |
| Fix 5 (partial) | M3's injection clause now rests on `v@#54`, an unannounced injection review; M6 cites #100 (T92, audited export) instead of #97 | sections 7, 9 |
| Fix 6 (partial) | forced U's: JS `if` `v@#35`, `filter` `v@#39`, `map` `v@#53` (JS only); a U solved with another construct credits that construct and is re-served; stack traces U #106; audit U #100; the Boardroom problem moved to `v@#44` | sections 9, 10 |
| Fix 14 (partial) | timescale recomputed with lettered tickets and WS passes (about 80-150 hours in game, 120-230 job-ready); concept count 111 and minimum days corrected; seasonal tickets are templates relative to the stored today | section 5 |
| N1 | #97 audit references replaced (recall map, M6) | sections 7, 9 |
| N2 | PC-17 (PHP error and log capture, request replay) added and marked on T36a, T98, WS2 | sections 8, 14 |
| N3 | T33 is a new problem ("the system still has no guard"), moved from the reopen table to the new-problems table; T21's line reworded | sections 8, 10 |
| N4 | first blank editors are tickets with no new keyword: SQL T11 (#13), JS `v@#28`, PHP T33a (#41a); T10, T22, T26 get starters (L2); M1 and recall map evidence moved to #13 and `v@#13` | sections 3, 8, 9, 12, 7 |
| N5 | T54a limited to 201, 204, 404, 422; 401 and 403 taught at T73 | section 8 |
| N6 | day-4 contradictions and recall-map slips fixed (see fix 2 and fix 6 rows) | sections 5, 9 |
| N7 | see fix 14 row | section 5 |

