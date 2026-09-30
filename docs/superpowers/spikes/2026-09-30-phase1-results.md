# Phase 1 results (spikes and vertical slice)

Branch `game-phase1`. Every number below is copied from the task reports or the full-suite run; nothing is estimated.

## Full suite (Task 10, Step 1)

`node scripts/browser/run_game_tests.mjs` (pure tests, then every browser test except the two slow spikes), exit code 0, run twice with identical results:

- Pure (`node --test`): 10 tests, 10 pass, 0 fail
- Shell 3/3, world 7/7, JavaScript view 10/10, PHP sync 7/7, grading 13/13, timetable 13/13, meter 4/4, playable slice 15/15
- No failing rows.

Not re-run here (slow, and their numbers are already recorded): `spike_world_scale.mjs` (see Task 3) and `spike_php_timeout.mjs` (a page hang; see Task 5).

Note: the plan's `npm run test:game*` commands became `node scripts/browser/run_game_tests.mjs` because `package.json` is git-ignored (Ruling 1); `node --test game/` fails on Node 22.19, so the runner passes an explicit file list (Ruling 10).

## Spike 1: world sync

- Snapshot and restore work in PGlite 0.5.8: yes. Confirmed at 50,000 rows (restored world had all 50,000 bookings) and in the small-world tests (a snapshot restores every row, including later inserts; a snapshot is independent of the live world). The server reports `PostgreSQL 18.3 (PGlite 0.5.8) on wasm32`.
- 50,000 bookings: create 3612 ms, snapshot 602 ms (7.3 MiB), restore 424 ms. The base seed has no clashes.
- Slow clash query (self-join) without an index 12065 ms, with an index 2290 ms. Indexes matter at scale, roughly a 5x difference here, which is a useful data point for the Codex and the teaching story. `CREATE INDEX` itself was not timed.
- Longest main-thread stall 16261 ms -> PGlite on the main thread must move to `PGliteWorker` for large worlds.
  - Attribution (ruling from the Task 3 review): the 16.3 s figure is the longest single gap seen by the stall meter. It is best read as several long synchronous PGlite calls, the largest being the 12 s unindexed clash query, not a single culprit. The stall meter cannot separate one long freeze from several. The conclusion stands regardless: for large worlds the world must run in a `PGliteWorker`.
  - Ruling 7: Phase 1 keeps the main-thread `World`, because small (20-row) worlds do not stall. Moving the world into a `PGliteWorker` is a required Phase 2 item.
- JavaScript round trip (objects in, objects back): works, 10/10. Timestamps arrive as ISO-8601 UTC strings; a booking pushed in JavaScript lands in PostgreSQL with the next id and the id sequence is realigned (next id 22); a thrown error is reported and changes nothing; a failed write-back rolls back and leaves the world intact; an infinite loop is terminated with `timedOut` (1510 ms in the final run, 1504 ms in Task 4) because JavaScript runs in a terminable Worker.
- PHP round trip through the SQLite mirror: works, 7/7. PHP reads the same data as SQL (7 rows), a booking inserted through PDO lands in PostgreSQL, thrown exceptions and syntax errors come back as errors, and failed runs leave the world unchanged. Integer fidelity: no integer-as-string problem occurred and no cast was needed. Timestamp fidelity: `2030-01-01T09:00:00Z` survives as the same instant.
- PHP runtime load time: 917 ms in the Task 5 run; 3793 ms in the Task 10 full-suite run (a cold load while the machine was busy with the preceding tests). Treat load as roughly 1 to 4 s.
- Can a runaway PHP script be interrupted? No. `spike_php_timeout` output: "PHP infinite loop: NOT interruptible from the main thread (page hung 25 s)"; `set_time_limit(2)` did not stop `while(true){}`.
  - What the existing app does: Task 5 Step 1 could not confirm it. The worktree's `index.html` has no `Exec.runPhp`; PHP appears only as runtime id `phpwasm` and in `phpHarness` / `Exec.phpReady` references. The generic `Exec.spawn` runs runtimes in Web Workers and `Exec.kill` calls `worker.terminate()`, but the PHP path itself was not found to be Worker-isolated. Its PHP isolation is unconfirmed.
  - Ruling 8: Phase 1 keeps PHP on the main thread and the PHP tab shows an honest note that an endless PHP loop needs a page reload. Moving php-wasm into a terminable Worker is a required Phase 2 item and needs its own spike first (php-wasm's worker build is an unknown).

## Spike 2: outcome grading

Grading suite 13/13.

- Reference solutions pass in SQL / JavaScript / PHP: yes (all three).
- Alternate valid answers accepted: yes ("move the newer booking to another day" passes; in the run it appeared twice, as SQL and JavaScript).
- Cheats and empty code rejected: yes. "delete every booking" and "empty the bookings list" both fail with "the original 20 bookings are untouched". Empty SQL and empty JavaScript fail with "no room is double-booked". Empty PHP fails, but the runner's message is the unhelpful "PHP did not finish"; the UI refuses whitespace-only editor content earlier with "Write some code first." (Ruling 9).
- Half-failed SQL rolled back: yes (world stays at 21 rows before and after).
- Things a learner could do that the checks would wrongly accept or reject (from the reviews, all deferred):
  - Learner `COMMIT` / `ROLLBACK` inside SQL can escape the transaction wrapper (Task 6).
  - The card checks only that the count of ids <= 20 is 20 and there are no overlaps; it does not enforce that booking 1 itself is unmoved, so a learner could move it (Task 6).
  - PHP sentinel output can be spoofed, and a learner printing the sentinel gets a misleading error (Task 5).
  - No PHP cheat is in the grading tests (Task 6).

## Spike 3: animation and feel

- 500-booking render time: 44 ms in the final run (Task 7 measured 40, 40, 42 ms), under the 100 ms threshold.
- Reduced motion honoured: yes. Zero animations, immediate removal, and the CSS transition is off too (transition duration "0s"). Rapid re-renders leave no duplicate or stale blocks (4 unique live blocks). A booking that changes room moves row with no duplicate; a booking whose room has no row is not left on screen.
- Play-test notes from Lawrence: Awaiting Lawrence's play test.
- Build agent's own play-through observations (not Lawrence's), from Task 9 in a real Chromium at desktop and 375 px:
  - Saw the header, goal, three room rows, booking #21 in red overlapping #4 in Room 1 (the clash is clear before any code runs), tabs, editor, Run and Reset, and the meter card with its decay curve.
  - SQL fix turned the banner green "Solved. The room is clear." and #21 was gone. One frame caught the banner mid pop-in and a block mid-fade, which read as smooth. A PHP fix after Reset also solved.
  - 375x812: layout fits, tabs and buttons wrap, the PHP note wraps under the buttons, no horizontal overflow.
  - Issues: the clash block covers the label of the booking beneath it (#4), so that label is unreadable; the meter card sits far below the fold on short viewports; Reset is low contrast by design.
  - Limit: screenshots from the throttled pane lagged, so animation timing and feel could not be judged by eye. The cheat and SQL-error paths were not hand-tested visually (they are covered by the automated test).

## Memory model

- What the existing SM-2 log looks like (`index.html`, read only): `sm2(prev, quality)` keeps `{ease (default 2.5, min 1.3), interval (days), reps, due (ms)}`, one per challenge. Quality is mapped pass=5, hint=3, otherwise 1; quality below 3 resets reps and sets interval to 1. `Reviews.queue` holds the next-due state per challenge. `Reviews.log_` is an append-only log (capped at 2000) of `{challengeId, dungeonId, reviewedAt (ms), outcome ('pass'|'hint'|fail), ease, interval}`, persisted in Firestore under `sessions/{uid}/reviewLog`.
- Recommendation: the exponential model should read the existing `Reviews.log_` rather than replace SM-2. Map `pass` to clean, `hint` to assisted and fail to failed, take `reviewedAt` as the last-used time, and replay `nextStability` over the log per skill. Because the model is pure it can be swapped later. SM-2 is per challenge and the meter is per skill, so a challenge-to-skill grouping is needed.
- The Phase 1 meter shows demonstration data only (not yet labelled as demonstration in the UI, a deferred minor).

## Decision

Recommendation: Go for Phase 2, with changes.

Everything the spikes were meant to prove works: the PostgreSQL world round-trips through JavaScript and PHP, outcome grading resists cheats, the timetable renders 500 bookings in about 44 ms and honours reduced motion, and the slice is playable. Two runtime problems must be fixed before scale, and both are required Phase 2 work rather than reasons to stop:

1. Large worlds freeze the page (16.3 s stall from long synchronous PGlite calls, the largest the 12 s unindexed clash query). The world must run in a `PGliteWorker` (Ruling 7).
2. A runaway PHP script cannot be interrupted (25 s hang). PHP must move into a terminable Worker (Ruling 8), with its own spike.

Phase 2 plans to write, in order:

1. Move the world into a `PGliteWorker` and re-run the scale spike (including a timed `CREATE INDEX`).
2. Move PHP into a terminable Worker (spike php-wasm's worker build first).
3. A proper code editor, the Codex and the stuck ladder.
4. The director and 3 to 5 more problem cards, including a generated large-world problem (slow query, then add an index).
5. The real skill log and review sessions (soft gate), reading `Reviews.log_` with a challenge-to-skill grouping.
6. JavaScript and PHP tracks at depth, and the PostgreSQL on-ramp.
7. The visual polish pass: the clash block hides the label of the booking under it; the meter is below the fold on short screens.

Then migration of old dungeons.

## Deferred minors worth fixing early

Cheap, and they matter most (full lists are in the ledger):

- Reset never closes the previous PGlite world, so each reset leaks a world; close it before rebuilding (Task 9).
- `renderMeter` interpolates name, language and line into `innerHTML` unescaped; escape or use `textContent` before real skill data reaches it (Task 8).
- Learner SQL `COMMIT` / `ROLLBACK` can escape the transaction wrapper; use a `SAVEPOINT` or a pre-run snapshot (Task 6).
- PHP sentinel spoofing and single-flight: use a per-run nonce or `lastIndexOf`, serialise `run()`, and cache the first-load promise so concurrent first calls do not race (Tasks 5 and 6).
- The card does not enforce that booking 1 itself is unmoved (Task 6).
- `boot()` failure leaves dead controls, because listeners attach after the `await`, and it prints `undefined` for a non-Error (Task 9).
- The demo meter is not labelled as demonstration data in the UI, and a never-used or NaN last-used time prints "last used NaN days ago" (Tasks 9 and 8).
