# PHP

Your PHP runs in php-wasm (PHP 8.4) in the browser. **Important caveat:**
there is no PostgreSQL server in a browser, so in this game `$pdo` talks to a
**SQLite practice copy** of the world, not to PostgreSQL. The PDO calls
(`prepare`, `execute`, `fetch`) are the same ones you would use against
PostgreSQL; only the connection line differs. What this changes in practice
is listed in [gaps.md](gaps.md) (I8). Status key: [README](README.md).

**Today the game teaches one PHP card**, an on-ramp (scaffolded, never
evidence).

## Built

| # | Concept | Plain meaning | Taught at | Checked by | Comes back | Status |
|---|---|---|---|---|---|---|
| 1 | PHP wraps SQL: `$`, `$pdo->query`, `fetchColumn`, `echo`, `.` | Variables start with `$`; `$pdo` is the database connection; `->` uses its ability; `echo` prints; `.` glues text | O8 "PHP asks the database" (L0 run, L1 change one word) | output (cheat: `echo 'Rooms: 3'`) | T21 (optional PHP route, `$pdo->exec`) | Built, too big: gaps.md C6 |

## Library only (30 entries; the ones below are not covered by any card, built or planned)

| # | Concept | Plain meaning | Library entry | Status |
|---|---|---|---|---|
| 2 | Double-quoted strings | `"Hello $name"` fills in the value; single quotes do not | php-string-interpolation | Library |
| 3 | String functions | strlen, strtoupper, str_contains, trim, explode, implode, sprintf, str_replace | php-string-functions and others | Library |
| 4 | for loop, math (round, intdiv, %) | Counted repeats; whole-number division | php-for-loop, php-math | Library |
| 5 | isset / empty | Exists and not null / "nothing" (careful: `"0"` counts as empty) | php-isset-empty | Library |
| 6 | json_decode | JSON text to an array; null if the text is bad | php-json-decode | Library |
| 7 | date() | Format a moment as text; set the time zone | php-date | Library |

## Planned

| # | Concept | Plain meaning | Taught at | Checked by | Comes back | Status |
|---|---|---|---|---|---|---|
| 8 | A query with a condition from PHP | Your T03 SQL, sent from PHP | T07 | output on both worlds | T15 | Planned (LD) |
| 9 | fetchAll, foreach, `$row['name']` | Loop over result rows | T15 | output on both worlds | T30a, S9 | Planned (LD) |
| 10 | Prepared statements (`prepare`, `?`, `execute`) | Values go in as parameters, never glued into the SQL text | S9 "Saving the booking" / T22 | customers book through your form; rows exist | P5, P8, P13 | Planned (arc) |
| 11 | The handler convention `handle(array $input, PDO $pdo): array` returning `[status, body]` | How this game's codebase answers a request | S9 | customers | S10, S11, every P | Planned (arc), game-only (gaps.md I17) |
| 12 | if / else, `\|\|`, `&&`, adding to an array (`$a[] = x`) | Decide, and collect results | T30a | output | T31 | Planned (LD) |
| 13 | Functions with types | `function isFree(PDO $pdo, int $roomId, ...): bool` | T31 | probes | T37, T94 | Planned (LD) |
| 14 | Returning JSON (`json_encode`, status code) | The server answers with data, not a page | S10 / T40 | customers | S11 | Planned (arc) |
| 15 | A GET endpoint | Return the day's bookings as JSON | S11 `slots.php` | customers on both worlds | P10 | Planned (arc) |
| 16 | Check before insert, 409 Conflict | Refuse an overlapping booking with a clear message | P3 | scripted pair: second gets 4xx | P9 | Planned (arc) |
| 17 | Validation, 422 | Refuse bad input on the server, even if the page checked | P4, P6 / T37 | direct request bypassing the page is refused | T51 | Planned (arc) |
| 18 | Injection: why string-glued SQL breaks | An apostrophe (O'Neill) ends the SQL text early | P5 / T33a | O'Neill books; an attack string is stored as text | P8 | Planned (arc) |
| 19 | htmlspecialchars (output escaping) | Turn `<` into `&lt;` so text cannot become HTML | P7 | no element created from data | none | Planned (arc) |
| 20 | Code review for injection | Prove a defect in someone else's code with an input | P8 / T44 | attacker request changes nothing | T85 | Planned (arc) |
| 21 | Catching a database error (PDOException, 23P01) into a 409 | Turn the database's refusal into a kind message | P9 / T54 | interleaved pair | T100 | Planned (arc) |
| 22 | Tenant checks | Only this client's rows, checked in PHP | P13 / T74 | other client's user gets nothing | P15 | Planned (arc) |
| 23 | password_hash / password_verify | Store a one-way hash, never the password | P14 / T71 | no plaintext column; login right/wrong | none | Planned (arc) |
| 24 | Authorisation (403) | Check the user owns what they change | P15, P16 / T73 | replayed request returns 403 | none | Planned (arc) |
| 25 | Reading a colleague's diff | Reproduce, fix at the right layer, keep their intent | P18 / T98 | customers book again | none | Planned (arc) |
| 26 | A PHP test (assertSame) | Proves the double-booking fix stays fixed | P23 / T95 | fails on buggy, passes on fixed | none | Planned (arc) |
| 27 | Reading a stack trace and a log | Message, file and line at the top, the calls below | T36a | reply | T98 | Planned (LD) |
| 28 | Guard clauses | Refuse early with a clear reason | T51 | probes | T100 | Planned (LD) |
| 29 | HTTP beyond GET (POST 201, lastInsertId) | Create, change, cancel through an API | T54a | probes | none | Planned (LD) |
| 30 | Money in whole pence | `int`, `intdiv`, format only for display | T63 | probes | T64 | Planned (LD) |
| 31 | Array functions (array_map, array_filter, usort, array_unique) | Transform, filter, sort lists | T66 | probes | none | Planned (LD) |
| 32 | N+1 queries | One query per row replaced by one join | T70 | query count at most 2 | none | Planned (LD) |
| 33 | Throttling logins, PDO transactions, data export | Lock after failures; pair writes; export a person's data | T79, T89, T92 | probes | T100 | Planned (LD) |
| 34 | A class with methods (repository) | Bundle the booking code with the PDO passed in | T94 | probes | T95 | Planned (LD) |

## Missing (in no plan)

| # | Concept | Plain meaning | Status |
|---|---|---|---|
| 35 | The real request model | `$_GET`, `$_POST`, `$_SERVER`, reading a JSON body (`php://input`), `header()`, `http_response_code()` | Missing (the game uses `handle()` instead) |
| 36 | Sessions and cookies | How a logged-in user stays logged in: `session_start`, `session_regenerate_id`, cookie flags | Missing |
| 37 | CSRF protection | A token in every form that changes data, so another site cannot submit it for you | Missing |
| 38 | PHP types | `declare(strict_types=1)`, how `==` converts types, nullable types | Missing |
| 39 | Composer, autoload, namespaces | How real PHP projects load their classes and libraries | Missing |
| 40 | OOP basics beyond one class | Constructors, visibility, interfaces, passing dependencies in | Missing (T94 only) |
| 41 | Several files (include / require) | Splitting code; one entry point | Missing (needs platform PC-10) |
| 42 | Errors and logging in production | Exception vs Error, `error_log`, never show raw errors to users | Missing |
| 43 | PHPUnit | The real test tool (the game's tests are a stand-in) | Missing |
| 44 | PDO on PostgreSQL specifics | `pgsql:` connection, `RETURNING id`, PostgreSQL error codes in PDOException | Missing (cannot run in the browser) |
