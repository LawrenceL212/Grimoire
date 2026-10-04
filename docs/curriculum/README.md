# Curriculum: what the game teaches, and in what order

For Lawrence, the player. Use these pages to check three things about the
game: is what it teaches **correct**, is it **complete** (nothing a junior
developer on the Siso stack needs is missing), and is it **chunked** small
enough (one idea at a time).

Written 2026-10-04 from the game's own files (the cards in `game/problems/`,
the Library in `game/reference/data/`), not from the plans. The plans are
used only for the parts marked Planned.

## The pages

| Page | What it covers |
|---|---|
| [sql.md](sql.md) | PostgreSQL: tables, queries, changes, constraints, time |
| [javascript.md](javascript.md) | JavaScript: programs, data, the page, talking to the server |
| [php.md](php.md) | PHP: the server side, the database from PHP, safety |
| [web.md](web.md) | HTML, CSS, HTTP, REST and JSON |
| [gaps.md](gaps.md) | The audit: missing, thin, too-big, wrong-order and inaccurate items, with fixes |
| [day-by-day.md](day-by-day.md) | A 30-day pacing sketch, at most 4-5 new ideas a day |

## How to read a concept table

Every language page has one row per concept, in the order you meet them:

| Column | Meaning |
|---|---|
| Concept | The idea, in a few words |
| Plain meaning | One line, no jargon |
| Taught at | The card or stage that teaches it (id and title), or "not yet taught" |
| Checked by | How the game decides you really did it (key below) |
| Comes back | Later cards that make you use it again (recall) |
| Status | See the status key |

### Status key

| Status | Meaning |
|---|---|
| **Built** | A card exists and the game serves it today |
| **Library** | Only an entry in the Library (the in-game reference, 119 entries). You can look it up and run its example; nothing teaches or checks it |
| **Planned (arc)** | In the product-arc design (stages S3-S12, problems P1-P23). Not built |
| **Planned (LD)** | A ticket (T-number) in the older learning design, not yet placed in the arc. Not built |
| **Missing** | Not built and not in any plan |

### "Checked by" key

| Check | What actually happens |
|---|---|
| rows | Your query's answer is compared with the true answer, on your world and on a hidden second ("shadow") world with different data, so an answer typed off the screen fails |
| world | The data afterwards is inspected (for example "the Boardroom seats 10") |
| unchanged | Every row you were not asked to touch is checked to be exactly as it was |
| schema | The database's own record of its tables (the catalogue) is read: table names, keys, column types |
| probe | Test rows are tried in your table inside a transaction that is then undone, so your data is never changed |
| interact | You click the right cell; the page can be re-sorted, so a click by position fails |
| return / output | What your JavaScript returned or your PHP printed |
| reply | You choose the right answer to give the person, and nothing was changed |
| customers | Planned: scripted customers use your real page by its labels and buttons |

Every Built card also names a **cheat** (a plausible wrong answer) that must fail.

## The whole journey on one page

Minutes are the design's first-attempt times. A true beginner usually takes
2-3 times as long; the "Real" column uses that.

| # | Section | Contents | Status | Design | Real |
|---|---|---|---|---|---|
| 1 | First day | Tutorial part 1, S0 notebook (O1, O2): tables, rows, ids, on paper | Built | 15 min | 30 min |
| 2 | First table | S1 create the rooms table, S2 put the three rooms in | Built | 20 min | 45 min |
| 3 | Asking the database | Tutorial part 2, O3-O5, T01-T17 (SELECT, WHERE, UPDATE, ORDER BY, compare, DELETE, AND, time ranges, LIMIT) | Built | 30 min | 1.5 h over 2-3 days |
| 4 | First JS and PHP | O6, O7 (a first program, its errors), O8 (PHP asks the database) | Built | 7 min | 20 min |
| 5 | Checkpoint and clashes | T18 checkpoint, T19 overlap, T21 fix a double booking | Built | 9 min | 25 min |
| 6 | People and bookings | S4 timestamps, S5 foreign keys, S6 Sam's spreadsheet import | Planned (arc) | 2.5 h | 5-7 h over 4 days |
| 7 | A web page and a form | S7 HTML, S8 the booking form | Planned (arc) | 27 min | 1-1.5 h |
| 8 | Saving from the site | S9 a PHP endpoint with prepared statements | Planned (arc) | 20 min | 1 h (more: see gaps.md C2) |
| 9 | Confirm and show availability | S10 fetch and JSON, S11 what's free on Friday | Planned (arc) | 45 min | 2-3 h (more: see gaps.md C1) |
| 10 | Launch day | S12 checkpoint, ten scripted customers | Planned (arc) | 25 min | 1 h |
| 11 | Natural problems | P1-P23: phones, duplicates, clashes, injection, XSS, races, cancelling, time zones, second client, logins, speed, colleague's bug, audit, billing report, microscopes, tests | Planned (arc) | about 7 h | 15-25 h |
| 12 | The rest of the learning design | About 70 tickets (T20, T22-T101) and work samples WS1-WS3: joins, grouping, window functions, CTEs, transactions, roles, triggers, refactoring | Planned (LD) | not scheduled | 30-50 h |
| 13 | The bridge (outside the game) | git, a local PHP + PostgreSQL setup, one small project of your own | Planned (LD, B1), the game cannot check it | | 40-80 h |

Sections 1-5 are what you can play today: **24 cards plus the tutorial, about
67 designed minutes, 23 new ideas** (20 SQL, plus two JavaScript and one
PHP on-ramp card). The SQL page shows 23 Built rows because it splits S1
into three (table, types, primary key) and lists the T18 checkpoint. The
design's own estimate for sections 1-11 is
45-60 hours of play, 6-10 weeks at 45-60 minutes a day.

## Counts at a glance

| Page | Concepts listed | Built | Library only | Planned | Missing |
|---|---|---|---|---|---|
| SQL | 62 | 23 | 7 | 29 | 3 (grouping 7 topics) |
| JavaScript | 41 | 2 | 6 | 25 | 8 |
| PHP | 44 | 1 | 6 | 27 | 10 |
| Web | 34 | 0 | 5 | 19 | 10 |
| **All** | **181** | **26** | **24** | **100** | **31** |

The audit in [gaps.md](gaps.md) lists 94 items: 34 must, 48 should, 12 nice.

"Built" for JavaScript and PHP is only on-ramp cards, which are scaffolded and
never count as evidence of what you can do alone.
