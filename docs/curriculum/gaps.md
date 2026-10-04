# Gaps: an honest audit

Measured against what a junior developer needs on the Siso stack
(PostgreSQL, PHP, JavaScript, HTML/CSS, REST/JSON, booking-domain thinking,
AI-assisted development). Nothing here assumes facts about Siso beyond that
stack.

Priority: **must** (a junior would be stuck or unsafe without it), **should**
(expected within the first months), **nice** (useful, not urgent).

## The five findings that matter most

1. **Only the SQL foothold is built.** 23 new ideas, 20 of them SQL. JavaScript
   and PHP have one or two on-ramp cards each; HTML, CSS and HTTP have none.
2. **The planned JavaScript and PHP first steps are too big.** S9 (first real
   PHP) and S10 (first real JavaScript) each pack 5-7 new ideas, because the
   arc dropped the learning design's foothold tickets (T05, T09, T12, T07,
   T15, T30a, T31). See C1, C2.
3. **Spaced review is not built.** The tutorial says "reviews arrive in the
   next update". Today a concept comes back only if a later card happens to
   need it; seven built concepts never come back (R1, R2).
4. **Three Library entries and one card are wrong or misleading** (I1-I4):
   PDO's default error mode, what `catch (Exception)` catches, PHP's `||`,
   and T16's "use this shape for every time question" (UTC days are wrong in
   UK summer).
5. **Whole job areas are absent from game and plans:** git, sessions and
   cookies, CSRF, Composer, the real PHP request model, browser DevTools, and
   AI-assisted development with CLAUDE.md files (M-E1, M-P2-M-P4, M-P6,
   M-J8, M-E3).

## 1. Inaccurate or oversimplified (check against real behaviour)

| Id | Where | What it says | What is true | Fix | Priority |
|---|---|---|---|---|---|
| I1 | Library php-pdo-connect | Skipping `ERRMODE_EXCEPTION` makes errors "fail silently" | Since PHP 8.0 the default error mode **is** exceptions; silent was the PHP 7 default | "Before PHP 8 errors were silent by default; set it anyway so old config cannot change it" | must |
| I2 | Library php-try-catch | Catching `Exception` misses a `PDOException` | `PDOException` extends `RuntimeException`, an `Exception`, so it **is** caught. What `Exception` misses is `Error` (TypeError, ValueError) | Reword to "misses a TypeError or other Error; catch Throwable to see both" | must |
| I3 | Library php-null-coalesce | "Using `\|\|` for defaults ... `\|\|` would replace them" | In PHP `\|\|` returns `true`/`false`, never the value (that is JavaScript). The PHP trap is `?:`, which replaces `0` and `""` | Name `?:` as the trap; say `\|\|` gives a boolean | should |
| I4 | T16 "This Friday in the Boardroom" | A day is `'... 00:00+00'` to the next midnight; recap "You'll use that shape for every time question" | The half-open shape is right. The `+00` (UTC) is right only in winter: from late March to late October a London day starts at 23:00 UTC | Add one line: "+00 works because the office clock is January, when UK time = UTC. In summer, see time zones (P12)." | must |
| I5 | T21 "Two people, one Boardroom" | "Ids grow in booking order, so the lower id was booked first" | Ids come from a sequence when the row is inserted, not when it is committed; imports, manual ids and parallel requests break the rule, and ids can have gaps | True for this world; add "in real systems use a `created_at` column" | should |
| I6 | O6, O7 | Programs end with `return total;` | In a real script a top-level `return` is a SyntaxError; the game silently wraps the program in a function | One line on the O6 card: "the game runs your program inside a function; in a page you would use the value instead" | should |
| I7 | O8 | "in JavaScript `.` meant 'the part called'" | No built card teaches `.` in JavaScript (T05 is not built) | Drop the clause, or build T05 first | should |
| I8 | O8 and every PHP card | (O8 is silent about SQLite) | `$pdo` is a SQLite copy: it accepts `'abc'` in an INTEGER column, stores times as text (compared as text), has no `ILIKE`, `::` casts or `now()`, and gives SQLite error codes | Put the Library's caveat on O8's Learn card now, not only at S9 | must |
| I9 | S1, Library sql-primary-key | `SERIAL PRIMARY KEY` | Works everywhere, but PostgreSQL's own docs prefer `GENERATED ALWAYS AS IDENTITY` since version 10 (S1 already accepts it) | Mention both on the card; say which modern code uses | nice |
| I10 | T19 Learn card | `start_at < '15:00' AND '14:00' < end_at` | That text will not run against a timestamptz column (it needs a full date and time) | Mark it as shorthand, or use full timestamps | nice |
| I11 | T14 Learn card | "Sam is person 2; the Garden Room is room 4" | Works, but teaches typed-in ("magic") ids; real code finds ids by name with a JOIN or subquery | Add "you'll look these up properly with JOIN (T30)" | should |
| I12 | Library php-function | A function cannot see outside variables unless passed in | Arrow functions `fn() =>` capture outside variables automatically (the same Library uses them); closures use `use` | Add the exception | nice |
| I13 | Planned S9 | `handle(array $input, PDO $pdo): array` is "our codebase's convention" | Real PHP reads `$_POST`/`php://input` and sets the status with `http_response_code()` | Keep it, plus one bridge card showing the real form (M-P2) | must |
| I14 | Planned P14 | Logins taught as `password_hash` only | Real logins also need sessions, cookie flags, session id regeneration and CSRF tokens | Add M-P3, M-P4 next to P14 | must |
| I15 | Library sql-order-by | ASC is the default | Correct, but silent on NULLs: PostgreSQL sorts NULLs last in ASC, first in DESC | Add one line | nice |

Checked and correct: the S1 TEXT-capacity probe (`'10' >= '7'` is false as
text), O4/O7 error texts, the overlap rule with strict `<` (touching
bookings do not clash), T08 sorting, the SQL Library's NULL, NOT IN, LEFT
JOIN, HAVING and SUM-of-nothing notes, JS `reduce` without a start value,
`sort()` on numbers, PHP `empty("0")`, and the exclusion constraint's need
for `btree_gist` (already listed as platform work PC-2).

## 2. Missing

| Id | Concept | Why a junior needs it | Recommended fix | Priority |
|---|---|---|---|---|
| M-S1 | JOIN (inner, left) in the arc | Every report and page that shows names, not ids. The arc only reaches it in P21 | Place LD T30 and T32 right after S5 (foreign keys) | must |
| M-S2 | Aggregates: count, sum, GROUP BY, HAVING | Daily reporting work | Place LD T23, T25 after S6; P21 then becomes recall | must |
| M-S3 | NULL logic | NULL is "unknown": `= NULL` never matches, `NOT IN` with a NULL returns nothing | Place LD T28 and T32a; add a card on three-valued logic | must |
| M-S4 | Dates and times as one thread | Bookings are all time: timestamp vs timestamptz, intervals, `date_trunc`, `AT TIME ZONE` | Teach TIMESTAMPTZ (S4) and London time explicitly, not only if he chose TIMESTAMP (P12 is conditional) | must |
| M-S5 | Transactions and isolation | Default READ COMMITTED; what it allows; why check-then-insert races | LD T39 plus one isolation card before P9 | should |
| M-S6 | Normalisation | Designing tables he will be asked to review | One card at S4: "one fact in one place", why people and bookings are separate | should |
| M-S7 | Migrations as a workflow | Schema changes are versioned files, reviewed and run in order | Extend P22: write the change as a numbered migration, forward only | should |
| M-S8 | ON DELETE actions | What happens to bookings when a room is deleted | Add to S5's branch | should |
| M-S9 | Window functions, CTEs | Common in reporting queries he will read | Place LD T58, T65a after P21 | should |
| M-S10 | Indexes and EXPLAIN | Slow pages are a common first ticket | P17 exists; keep it in the arc's first problem block | should |
| M-S11 | psql and backups | Working on a real database from a terminal; `\d`, `pg_dump` | Bridge exercise | should |
| M-S12 | Views, UNION | Reading existing schemas and reports | Library entries | nice |
| M-J1 | JS foothold (arrays, loops, if, functions, filter) | S10/S11 assume all of it | Place LD T05, T09, T12, T24, T26 between O7 and S10 | must |
| M-J2 | Types and coercion, truthy/falsy, null vs undefined, NaN | Every form value is text; `'10' + 1` bugs | New card before S10 | must |
| M-J3 | Scope and closures | Event handlers and callbacks depend on it | New card after T26 | should |
| M-J4 | Promises | What `await` waits for; reading `.then` code | New card before S10's fetch | should |
| M-J5 | Events in depth (bubbling, delegation, input/change) | Interactive pages | Card after S11 | should |
| M-J6 | Modules (import / export) | Any codebase with more than one file | Card after S11 | should |
| M-J7 | throw, Error objects, finally | Clear failures | Fold into T83 | should |
| M-J8 | Browser DevTools | The main debugging tool for front-end work | Bridge exercise with a checklist (console, breakpoint, Network tab) | must |
| M-J9 | Classes, localStorage | Common in existing code | Library entries | nice |
| M-P1 | PHP foothold (arrays, foreach, if, functions with types) | S9 needs all of it | Place LD T07, T15, T30a, T31 between O8 and S9 | must |
| M-P2 | The real request model | `$_POST`, `php://input`, `header()`, `http_response_code()`: what every PHP page uses | Bridge card after S9: the same handler written the real way | must |
| M-P3 | Sessions and cookies | Every logged-in PHP app | Card at P14 (explained even if not simulated), plus bridge | must |
| M-P4 | CSRF tokens | Any form that changes data is exposed without one | Card next to P15 (in-game: a forged request from another "site" must fail) | must |
| M-P5 | PHP types, `strict_types`, `==` conversions | Avoiding silent type bugs | Card after T31 (note: `declare(strict_types=1)` only works in the included file in php-wasm) | should |
| M-P6 | Composer, autoload, namespaces | How real PHP projects are laid out | Bridge, plus a reading exercise | must |
| M-P7 | OOP beyond one class | Most modern PHP is classes: constructors, visibility, interfaces, dependencies passed in | Expand T94 into 2-3 cards | should |
| M-P8 | Errors and logging in production | `error_log`, never show raw errors to users | Card with T36a | should |
| M-P9 | Several files (include / require) | Real projects | Needs PC-10 | should |
| M-P10 | PHPUnit | The real test tool | Bridge after P23 | should |
| M-P11 | PDO on PostgreSQL | `pgsql:` DSN, `RETURNING id`, PG error codes | Bridge; Library note | should |
| M-W1 | HTTP anatomy | Method, URL, headers, status, body: needed from S9 | New card between S8 and S9 | must |
| M-W2 | REST design and status codes | APIs are named in the stack | Card after S11; T54a earlier | must |
| M-W3 | Document skeleton, semantic HTML | Every page | Add to S7's Learn card or one card after it | should |
| M-W4 | Accessibility beyond labels | Keyboard, focus, alt text, contrast | Customer steps that use the keyboard only | should |
| M-W5 | Responsive CSS (media queries) | Phones | Split P1 (C8) | should |
| M-W6 | Cascade and specificity | Which rule wins | Card with P1 | should |
| M-W7 | CORS | Front end calling an API on another address | Explain-only card | should |
| M-W8 | HTML tables, HTTPS and caching | Availability grids; stale pages | Library | nice |
| M-E1 | git | Every job, from day one | Bridge B1, moved earlier (day-by-day.md puts it in week 2) | must |
| M-E2 | Local setup: PHP CLI, built-in server, PostgreSQL, psql, a terminal | To run anything outside the game | Bridge B1 | must |
| M-E3 | AI-assisted development (Claude Code, CLAUDE.md) | The team uses it | New thread: read a CLAUDE.md, ask for a change, review the diff, run the tests, reject a wrong suggestion | must |
| M-E4 | Reading other people's code | Most of a junior's week | P18, T31, T44, WS2 exist; build one early (T31) | should |
| M-E5 | Tests | Proving fixes | P23, T46, T95: keep at least one before launch | should |
| M-E6 | A named debugging method | Reproduce, isolate, form a guess, fix, verify | One card naming the method T11/O4/O7 already use | should |
| M-E7 | Writing useful logs | Support work | With T36a | should |
| M-E8 | ISO mindset basics | 9001: follow and record the process, change control, fix root causes; 27001: least access, audit trail, report incidents; 14001: environmental awareness | Short explain cards; P20 and T86-T91 cover part of 27001 | should |
| M-E9 | Booking-domain vocabulary | Resources vs rooms, recurring bookings, buffers, cancellations, no-shows, opening hours, approvals | A glossary page in the Library; T59, T62 cover two | should |
| M-E10 | Code review habits | Reviewing and being reviewed | T44, T85, WS3 planned | nice |

## 3. Thin (present, but too little to rely on)

| Id | Concept | Where | Fix | Priority |
|---|---|---|---|---|
| T1 | Primary key | One line in S1 | A probe step: insert a duplicate id and read the refusal | should |
| T2 | Input types and select | S8 open space, no Library entry for `select` | Library entries for `select` and `datetime-local` | should |
| T3 | Status codes | Met one at a time (2xx, 409, 422, 403) with no overview | M-W1/M-W2 | must |
| T4 | let vs const, push | Only in T12's starter | Short Learn line | nice |
| T5 | update | Taught in T04, then only an optional route in T21 | Recall ticket (the arc's "Library now seats 14") | should |

## 4. Too big a chunk (proposed splits)

| Id | Card | New ideas packed in | Proposed split | Priority |
|---|---|---|---|---|
| C1 | S10 "Did it work?" | submit event, preventDefault, async/await, fetch with method and body, JSON.stringify, res.json, updating the page | (a) events + preventDefault; (b) JSON.parse/stringify (T41); (c) async/await on a timer; (d) fetch GET; (e) S10 itself: POST JSON and show the reply | must |
| C2 | S9 "Saving the booking" | typed function, arrays and keyed arrays, return `[status, body]`, prepare/execute, find-or-create a person, status codes | T07, T15, T30a, T31, M-W1, T22 (prepare on a plain script), then S9 | must |
| C3 | P21 billing report | SUM, GROUP BY, JOIN, durations | T23 count, T25 GROUP BY, T30 JOIN, then P21 with only durations new | must |
| C4 | P2 duplicates | GROUP BY/HAVING + UNIQUE | Find duplicates (after T25), then UNIQUE | should |
| C5 | T16 time range | timestamp literal, UTC offset, half-open day | (a) a moment and comparing it; (b) a day as a half-open range | should |
| C6 | O8 | `$`, echo, `.`, `$pdo`, `->`, query, fetchColumn | (a) PHP basics with no database; (b) `$pdo->query` | should |
| C7 | S1 | CREATE syntax, types, primary key, SERIAL | Keep the scaffold; add T1's probe step | nice |
| C8 | P1 phones | selectors, width, padding, viewport meta, tap size | (a) a CSS rule and class; (b) box model; (c) viewport + media query | should |
| C9 | S11 | PHP GET endpoint, JSON, JS rendering, day filter | (a) `slots.php` returns JSON; (b) render it | should |
| C10 | P9 | range types, EXCLUDE, SQLSTATE mapping, 409 | T52 range types first | should |
| C11 | S8 | form/action/method, label/for, input name and types | (a) labelled fields; (b) a form that submits | nice |
| C12 | P13 tenancy | new column, scope every query, PHP check | (a) column + FK; (b) scope queries | nice |

## 5. Wrong order

| Id | Problem | Fix | Priority |
|---|---|---|---|
| W1 | S1 (first typed SQL) comes before O4 (reading errors) | Move O4's lesson onto the S1 practice pad, or play O3/O4 on the pad before S1 | should |
| W2 | After building **his** rooms (Library 12) he plays T01-T21 on a ready-made world where the Library seats 6 and people and bookings already exist | Build milestone M-B; until then, one line on T01 saying "this is a practice copy of the office" | must |
| W3 | S10 straight after O6/O7 | M-J1 | must |
| W4 | S9 straight after O8 | M-P1 | must |
| W5 | JOIN after linked tables (S4-S6) and after T14's typed-in ids | M-S1 | must |
| W6 | P2 uses GROUP BY/HAVING before any grouping card | C4 | should |
| W7 | Status codes used (S9) before HTTP is explained | M-W1 | must |

## 6. Taught once, never comes back

| Id | Concept | Fix | Priority |
|---|---|---|---|
| R1 | (all) No spaced review exists yet | Build the review queue the meter already models | must |
| R2 | Built with no later built use: create-table (S1), insert (S2), primary key, js-program (O6), js-errors (O7), php-query (O8), fix-clash (T21) | Recall tickets (S4's `people` table, a "new room" insert, a JS and a PHP recall before S9/S10) | must |
| R3 | Planned single meetings: CSS (P1 only), HTML elements (S7 then P1), audit trail (P20), CORS-free web topics | Add recall into P-problems' "revisits" | should |

## 7. Plan inconsistencies

| Id | Problem | Fix | Priority |
|---|---|---|---|
| X1 | `spells.js` says JavaScript/PHP forms are first met at T05, T07, T09, T12, T15: none of those cards exist | Place the cards (M-J1, M-P1) or update `meets` | should |
| X2 | The arc schedules 23 old cards plus S/P items; about 70 learning-design tickets (T20, T22-T101, WS1-3) are not placed anywhere | One merged order (day-by-day.md sketches the first 30 days) | should |

## Counts

| Priority | Inaccurate | Missing | Thin | Too big | Order | Recall | Plan | Total |
|---|---|---|---|---|---|---|---|---|
| must | 6 | 17 | 1 | 3 | 5 | 2 | 0 | **34** |
| should | 5 | 29 | 3 | 6 | 2 | 1 | 2 | **48** |
| nice | 4 | 4 | 1 | 3 | 0 | 0 | 0 | **12** |
