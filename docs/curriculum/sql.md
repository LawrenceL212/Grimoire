# SQL (PostgreSQL)

Your SQL runs on real PostgreSQL in the browser (PGlite). Status key and
"checked by" key: [README](README.md). Problems with any row: [gaps.md](gaps.md).

## Built: what the game teaches today (in play order)

Every card runs on **your own** company database (empty at the start): S0-S2
build the rooms, S3 asks about them (M-B), S4-S6 build people and bookings and
fill them through colleagues' scripts you can read (M-C: Priya's paper
bookings, Tom's import of Sam's spreadsheet), and the cards after S6 (T13 to
T21) run on that data, written in your own column names and ids. No card
starts from a ready-made world any more (gaps.md W2 is done).

| # | Concept | Plain meaning | Taught at | Checked by | Comes back | Status |
|---|---|---|---|---|---|---|
| 1 | Table, row, column | A table holds one kind of thing; a row is one of them; a column is one fact about it | O1 "Everything we have" (S0, on Priya's paper notebook) | interact (cheat: picking by position after re-sorting) | S1, S2, O3, T01 | Built |
| 2 | Linking by id | A row points at another row by keeping its number ("room 2") | O2 "Room 2" (S0) | interact | T14 (as typed-in numbers only) | Built |
| 3 | CREATE TABLE | Declare a table first: its name, then each column with a type | S1 "Somewhere to keep the rooms" (pad: one word, one line, then blank) | schema + probe (cheat: seats stored as TEXT, so 10 sorts below 7) | none built (S4 planned) | Built |
| 4 | Column types (TEXT, INTEGER) | The type decides what a column accepts and how it compares | S1 (inside it) | probe "rooms seating at least 7" | none built (S4 timestamps planned) | Built |
| 5 | Primary key, SERIAL or IDENTITY | Every row gets its own never-repeated number, made for you (`GENERATED ALWAYS AS IDENTITY` is the modern form; both pass) | S1 (one line of the Learn card) | schema (an `id` key exists) | none | Built, thin |
| 6 | INSERT | Add rows: columns in brackets, then VALUES | S2 "The three rooms" | probe: exactly Priya's 3 rooms (cheat: inserted twice) | none built (T06 retired) | Built |
| 7 | A query is a question (SELECT *) | Ask the database; rows come back | Tutorial part 2 (preview), O3 "Asking a question" | rows | T01, T17, T18 | Built |
| 8 | Reading an SQL error | Read what, where (the quoted word), what it expected | O4 "Reading an error" | rows after the fix | O7 (same habit in JS) | Built |
| 9 | Looking things up | Search the Library by what you want to do | O5 "Looking it up" | lookup | T08, T17 | Built |
| 10 | Writing a query from blank | SELECT * FROM a table, typed yourself | T01 "The whole rooms list" | rows | T11 | Built |
| 11 | Choosing columns | List the columns you want instead of * | T02 "Only what the website needs" | rows, exact columns | T18 | Built |
| 12 | WHERE, text in single quotes | Keep only rows that match; `=` compares here | T03 "The Boardroom on the phone" | rows on both worlds (cheat: `SELECT 8`) | T04, T11, T13, T14, T16-T21 | Built |
| 13 | UPDATE ... SET ... WHERE | Change values in chosen rows; in SET `=` means "becomes" | T04 "Ten, not eight" | world + unchanged (cheat: every room set to 10) | T21 (optional route only) | Built |
| 14 | ORDER BY, ASC/DESC | Sort the answer; the table itself is not changed | T08 "Biggest first" | rows, sorted | T17, T18 | Built |
| 15 | Comparing: > >= < <= <> | "At least", "more than" and so on in a WHERE | T10 "A team of seven" | rows (cheat: `> 7` misses a 7-seater) | T11, T18 | Built |
| 16 | Investigate before changing | Run a read-only SELECT first; reply with evidence | T11 "The Garden Room won't take us" | rows + unchanged + reply, closed-book explain step | T13, T21 | Built |
| 16a | Timestamps (TIMESTAMPTZ) | Store a moment, not words: it compares, sorts and subtracts as a time (as text, '10:00' sorts before '9:00') | S4 "People and bookings" (blank editor; `people` is a recall of CREATE TABLE) | schema + probe: two bookings 9-10 and 10-11 both start before 10:30, each lasts one hour (cheats: TEXT, DATE, links not named room_id/person_id) | S5, S6, T16, T17, T19 | Built (TIMESTAMP without a zone passes and is recorded for P12) |
| 16b | Foreign key (REFERENCES, ALTER TABLE ... ADD FOREIGN KEY) | A link column may only point at a row that exists; added to a table with rows, every row is checked first | S5 "There is no room 7" (Priya's script brings a booking for room 7) | world (the key in the catalogue, no booking without a room, the others unchanged) + probe: room 999 refused (23503), a brand-new room accepted (cheat: CHECK room_id BETWEEN 1 AND 4) | S6 (the import's log) | Built; if his S4 table already had REFERENCES, S5 is the reply variant ("what does this error mean?") |
| 16c | Checking someone else's import | Query the result, read their code and its log | S6 "Sam's spreadsheet" (Tom's script, visible) | rows on both worlds + reply (the skipped Atrium line) | T13-T21 run on this data | Built |
| 17 | DELETE ... WHERE id | Remove only the row you found | T13 "Friday by mistake" | world + unchanged (cheat: all of Sam's bookings) | T21 | Built |
| 18 | AND (OR in the Library) | A row stays only if both conditions hold | T14 "Too many in the Garden Room" | rows | T16, T17, T19 | Built |
| 19 | A day as a time range | Timestamps like `'2026-01-09 00:00+00'`; a day is from midnight up to, not including, the next; you decide whose midnight (UTC equals London only in winter) | T16 "This Friday in the Boardroom" | rows (cheat: `<=` next midnight) | T17, T19 | Built (gaps.md I4 fixed) |
| 20 | LIMIT | Only the first n rows (learnt by look-up, no Learn card) | T17 "How long have I got?" | rows (cheat: sort by id, not time) | T18 | Built |
| 21 | Filter, sort, take the top | Combine earlier ideas, unaided | T18 checkpoint "The smallest room for five" | rows (any tied answer), calibration prompt | none | Built |
| 22 | Overlap of two time ranges | Two periods overlap when each starts before the other ends | T19 "Thursday, two till three" | rows + explain step | T21 | Built |
| 23 | Fixing a clash in data | Find the clashing pair, keep the older, move or remove the newer | T21 "Two people, one Boardroom" | world (no overlaps) + unchanged | P3, P9 planned | Built (gaps.md I5 fixed) |

## Library only (look up and run, not taught or checked)

| # | Concept | Plain meaning | Library entry | Status |
|---|---|---|---|---|
| 24 | DEFAULT | Value used when an INSERT leaves the column out | sql-default | Library |
| 25 | DROP TABLE vs DELETE | Remove the whole table vs remove rows | sql-drop-table | Library |
| 26 | DISTINCT | Remove duplicate rows from an answer | sql-distinct | Library |
| 27 | IN, BETWEEN, LIKE/ILIKE | Match a list, a range (both ends included), a text pattern | sql-in, sql-between, sql-like, sql-ilike | Library |
| 28 | AS (alias) | Give a result column a name | sql-alias | Library |
| 29 | String functions, `\|\|` | upper, length, joining text | sql-string-functions | Library |
| 30 | now() | The current moment, with time zone | sql-now | Library |

## Planned

| # | Concept | Plain meaning | Taught at | Checked by | Comes back | Status |
|---|---|---|---|---|---|---|
| 31 | TIMESTAMPTZ type | Store a moment as a real time, not words | S4 "People and bookings" | schema + probe (cheat: times as TEXT, "10:00" before "9:00") | P12 | Planned (arc) |
| 32 | Foreign key (REFERENCES) | A link column may only point at a row that exists | S5 "There is no room 7" | schema + probe (SQLSTATE 23503) | P13, P20, P22 | Planned (arc) |
| 33 | Loading data through your schema | An import shows which rows your rules refuse | S6 "Sam's spreadsheet" | world | P4 | Planned (arc) |
| 34 | UNIQUE, finding duplicates | Refuse a second row with the same value; GROUP BY ... HAVING finds existing ones | P2 "The list says Studio twice" | schema + probe (23505) | none | Planned (arc) |
| 35 | CHECK constraint | Refuse a row that breaks your rule (end before start) | P4 | probe (23514) | P6 | Planned (arc) |
| 36 | Exclusion constraint | The database itself refuses overlapping bookings | P9 / T53 | interleaved customers: one row, other gets 409 | T67, T99 | Planned (arc) |
| 37 | Soft delete, IS NULL | Mark a booking cancelled instead of deleting it | P10, P11 / T27, T28 | customers + world | P11 | Planned (arc) |
| 38 | Time zones (AT TIME ZONE) | Store the moment, show London time; clocks change | P12 / T60 | customers across a clock change | none | Planned (arc) |
| 39 | Tenancy (client_id scoping) | Each client sees only its own rows | P13 / T35, T74 | scripted other-client user gets nothing | P15, P16 | Planned (arc) |
| 40 | Paging, indexes, EXPLAIN | Fetch a page at a time; add the index the plan asks for | P17 / T68, T69, T69a | plan shows an index scan | T97 | Planned (arc) |
| 41 | Audit trail | Record who changed what, and when | P20 / T86 | every change logged | T87, T88 | Planned (arc) |
| 42 | SUM, GROUP BY, JOIN | Totals per group, across linked tables | P21 / T23, T25, T30 | rows on both worlds | none | Planned (arc), too big: gaps.md C3 |
| 43 | Migration (ALTER TABLE) | Change a live table's shape without breaking the site | P22 / T27, T48 | site still passes S12 customers | none | Planned (arc) |
| 44 | count(*) | Count rows | T23 | rows | T25, T45 | Planned (LD) |
| 45 | LEFT JOIN | Keep rows with no match | T32 | rows | T34 | Planned (LD) |
| 46 | COALESCE | A stand-in for a missing value | T32a | rows | none | Planned (LD) |
| 47 | Self-join | Join a table to itself (every clashing pair) | T33 | rows | none | Planned (LD) |
| 48 | Transactions (BEGIN/COMMIT/ROLLBACK) | Several changes all happen, or none | T39 | world | T89 (PHP), T72 | Planned (LD) |
| 49 | count(DISTINCT), impact estimate | How many people a change will touch, before you make it | T45 | rows | T47, T90 | Planned (LD) |
| 50 | ON CONFLICT, RETURNING | Import without duplicates; get back what was written | T45a | world | none | Planned (LD) |
| 51 | IN (subquery), EXISTS | Filter by another query's answer | T49a, T50 | rows | T99 | Planned (LD) |
| 52 | Range types (tstzrange, &&) | A time period as one value; && means overlaps | T52 | rows | T53 | Planned (LD) |
| 53 | CASE | If/else inside a query | T56a | rows | none | Planned (LD) |
| 54 | Window functions | "First per person", "previous row", running totals | T58, T59, T96 | rows | T96 | Planned (LD) |
| 55 | Dates: date_trunc, extract, intervals, generate_series | Group by month, durations, repeating dates | T62, T65, T91 | rows | none | Planned (LD) |
| 56 | CTEs (WITH) | Split a long query into named steps | T65a | rows | none | Planned (LD) |
| 57 | Row locks (SELECT ... FOR UPDATE) | Stop two requests taking the last place | T66a | code shape + state | none | Planned (LD) |
| 58 | Roles, GRANT, row-level security | Give each login only the rights it needs | T75, T76, T87 | probes as that role | T91 | Planned (LD) |
| 59 | JSONB (->>) | Read fields stored as JSON | T88 | reply | none | Planned (LD) |

## Missing (in no plan)

| # | Concept | Plain meaning | Status |
|---|---|---|---|
| 60 | Normalisation | One fact in one place; why people and bookings are separate tables | Missing |
| 61 | Isolation levels | What PostgreSQL's default (READ COMMITTED) does and does not protect against | Missing |
| 62 | ON DELETE actions, NULL logic, identity columns, views, psql | CASCADE vs RESTRICT; three-valued logic (NULL is neither true nor false); `GENERATED AS IDENTITY`; a saved query as a view (only incidental in T48); the psql command line | Missing (see gaps.md) |
