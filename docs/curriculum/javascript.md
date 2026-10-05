# JavaScript

Your JavaScript runs in a sandboxed worker (and, for page entries, a
sandboxed mini page) in the browser. Status key and "checked by" key:
[README](README.md). Problems with any row: [gaps.md](gaps.md).

**Today the game teaches two JavaScript cards**, both on-ramp (scaffolded,
never evidence). Everything else is Library, planned, or missing.

## Built

| # | Concept | Plain meaning | Taught at | Checked by | Comes back | Status |
|---|---|---|---|---|---|---|
| 1 | A program, a variable, return | Instructions run top to bottom; `const total = 8;` puts 8 in a named box; `return` hands the answer back (the card says the game runs the program inside a function; a top-level `return` in a real page is an error) | O6 "A first program" (L0 run, L1 one change) | return (cheat: the old total typed in) | O7 | Built (gaps.md I6 fixed) |
| 2 | Reading JS errors | "x is not defined" means an unknown name, often a typo; capitals matter | O7 "'retrun is not defined'" | return after the fix | none built | Built |

## Library only (36 entries; the ones below are not covered by any card, built or planned)

| # | Concept | Plain meaning | Library entry | Status |
|---|---|---|---|---|
| 3 | typeof | What kind of value this is; arrays and null both say "object" | js-typeof | Library |
| 4 | Template strings | Text with values dropped in, using backticks | js-template-strings | Library |
| 5 | Numbers and decimals | `0.1 + 0.2` is not exactly 0.3; count money in pence | js-numbers | Library |
| 6 | Destructuring, optional chaining `?.` | Pull values out by name; read deep without crashing on a missing part | js-destructuring, js-optional-chaining | Library |
| 7 | slice, includes, join | Copy part of an array; is it in there; glue items into text | js-array-slice, js-array-includes, js-array-join | Library |
| 8 | try / catch | Handle an error instead of stopping | js-try-catch | Library |

## Planned

| # | Concept | Plain meaning | Taught at | Checked by | Comes back | Status |
|---|---|---|---|---|---|---|
| 9 | Data as arrays, `.length`, `.` | The tables you queried are lists of objects in JS | T05 | return on both worlds | T09 | Planned (LD) |
| 10 | for...of, console.log | Do the same thing for every item in a list | T09 | logged lines on both worlds | T12, T15 (PHP) | Planned (LD) |
| 11 | if, === | Decide; `===` compares without converting types | T12 | return on both worlds | T24, T26 | Planned (LD) |
| 12 | Dates (`new Date`, comparing) | A moment in time you can compare | T20 | return | T26, T61 | Planned (LD) |
| 13 | filter / find with `=>` | Keep every match / the first match | T24 | return | T33, S11 (client filter) | Planned (LD) |
| 14 | Your own function | Name a piece of code: `function clashes(a, b) { ... }` | T26 | return on probes | T33, T46 | Planned (LD) |
| 15 | Object as a tally, `??` | Count things by name in an object | T29 | return | T34 | Planned (LD) |
| 16 | map with template strings | Turn every item into a line of text | T38 | return | T43 | Planned (LD) |
| 17 | JSON.parse / JSON.stringify | JSON text to data and back | T41 | return | S10, T42 | Planned (LD) |
| 18 | Events, preventDefault | Run code when the form is submitted, without reloading | S10 / T80 | customers: page not reloaded | S11 | Planned (arc) |
| 19 | async / await, fetch, res.json() | Ask the server in the background and read its JSON answer | S10 "Did it work?" / T42 | customers: page shows the row the server created (cheat: printing "Booked!" without asking) | S11, P10 | Planned (arc), too big: gaps.md C1 |
| 20 | createElement, textContent, append | Build page elements from data, safely | S11 "What's free on Friday" / T43 | customers on both worlds (cheat: hand-typed list) | P7, P10 | Planned (arc) |
| 21 | Never innerHTML with user text (XSS) | Data must not become code on the page | P7 / T77 | no element created from data | none | Planned (arc) |
| 22 | Validation in the page | Refuse bad input early (and the server checks again) | P6 / T80 | server still refuses a direct request | none | Planned (arc) |
| 23 | Show local time (Intl, toLocaleString with Europe/London) | Display the moment in UK time, across clock changes | P12 / T61 | customers either side of a clock change | none | Planned (arc) |
| 24 | A test (assert) | Code that fails before the fix and passes after | T46 | runs against buggy and fixed versions | T95, T101 | Planned (LD) |
| 25 | Reproduce first, log values | Prove the bug with logs before changing code | T55 | return | T83 | Planned (LD) |
| 26 | sort with a comparator | Sort by a rule; ties and dates | T57 | probes | none | Planned (LD) |
| 27 | reduce, money in pence | Add up a list; whole pence, never float pounds | T64 | totals equal PHP's | none | Planned (LD) |
| 28 | classList and a CSS class | Make clashing slots red by adding a class | T81 | page state | none | Planned (LD) |
| 29 | Handling failure (`res.ok`, try/catch) | A 404 or 401 does not throw; check it | T83 | customers on a 4xx | T101 | Planned (LD) |
| 30 | Promise.all | Start several requests at once | T84 | requests overlap in time | none | Planned (LD) |
| 31 | Comparing objects (Object.entries, spread) | List which fields changed | T93 | return | none | Planned (LD) |
| 32 | Capstone page | Fetch, render safely, handle errors, validate, test | T101 | several | none | Planned (LD) |
| 33 | let vs const, arrays, push | Changeable vs fixed names; lists; add to a list | T12 starter (explained, not taught) | none | none | Planned (LD), thin |

## Missing (in no plan)

| # | Concept | Plain meaning | Status |
|---|---|---|---|
| 34 | Types and coercion | Form fields are always text: `'10' + 1` is `'101'`; `Number()`, `NaN` | Missing |
| 35 | Truthy/falsy, null vs undefined | Which values count as false; "nothing" vs "not set" | Missing |
| 36 | Scope and closures | Where a name can be seen; a function remembers the variables around it (every event handler relies on this) | Missing |
| 37 | Promises themselves | What `await` is waiting for; rejection; `.then`/`.catch` in older code | Missing (only via S10/T84) |
| 38 | Event bubbling and delegation | One listener on a list instead of one per item | Missing |
| 39 | Modules (import / export) | Split code into files; `<script type="module">` | Missing |
| 40 | throw and Error objects | Raising your own error with a clear message | Missing |
| 41 | Browser DevTools | Console, breakpoints, the Network tab (the game says it cannot teach these) | Missing |
