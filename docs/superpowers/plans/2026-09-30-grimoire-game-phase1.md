# Grimoire Game — Phase 1 (Spikes and Vertical Slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the three risky parts of the Grimoire game (a persistent world shared by PostgreSQL, JavaScript and PHP; outcome-based grading; animation quality) and ship one playable slice: a double-booked room you fix in any of the three languages, with an animated timetable and one forgetting-curve meter.

**Architecture:** A new zero-build game under `game/`, written as native ES modules with its own entry page. The canonical world is a long-lived PGlite (real PostgreSQL) database. JavaScript sees the world as plain objects in a worker; PHP sees a SQLite copy inside php-wasm; both write their changes back into PostgreSQL. A problem is a data card whose outcome checks are SQL queries against the world, so any valid solution passes. The old app in `index.html` is untouched.

**Tech Stack:** ES modules, PGlite 0.5.8 (CDN), php-wasm + `php-wasm-sqlite@0.1.0` (CDN), Web Workers, Web Animations API, `node:test` for pure logic, `playwright-core` 1.52.0 (already a dev dependency) for browser tests.

**Spec:** `docs/superpowers/specs/2026-09-30-grimoire-game-design.md`

**Scope note:** This is Phase 1 of the spec's build order (spikes, then vertical slice). Phase 2 onwards (PHP and JS tracks at depth, the director and generated problems, the full memory system, migrating old dungeons) each get their own plan once Task 10 records what the spikes found.

**Execution note:** Another session is editing `CLAUDE.md` files in this repository. Do the work on a branch (`game-phase1`), ideally in a git worktree (superpowers:using-git-worktrees), and do not touch existing `CLAUDE.md` files or `index.html`.

## Global Constraints

- Zero-build: no bundler, no npm runtime dependencies. `package.json` stays dev-only (`playwright-core`). Only add scripts to it.
- The game is native ES module files under `game/` with its own entry page `game/index.html`. It does not modify `index.html`.
- PostgreSQL is PGlite `0.5.8`, loaded from `https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.8/dist/index.js` (the version the existing runner uses). PHP is `php-wasm` `PhpWeb` 8.4 with `php-wasm-sqlite@0.1.0`.
- The canonical world state is PostgreSQL. JavaScript gets plain objects. PHP works on a synced SQLite copy and its changes are written back.
- Never fake execution: a language is graded only on a runtime that genuinely runs it. PHP cannot reach Postgres, so it uses the SQLite copy, and the level says so.
- Problem checks are deterministic: no clocks, randomness or network. The seed uses arithmetic only.
- Every learner-visible failure is fail-soft: a runner returns `{ ok: false, error }` and never throws into the UI.
- Prose (comments shown to learners, goals) uses British spelling and backticks for identifiers.
- Serve with `python -m http.server 8010` (or `npm run serve`); `file://` does not work. Browser tests need Chromium (`CHROMIUM_PATH` overrides auto-detect).
- The game is a first-class visual product: motion, feedback and design are checked (Task 7 and Task 9), not left as polish.

## Review Focus

Inputs and failure modes the spec implies but a happy-path test would miss, most likely first. Each has a test in the task named.

1. **Learner code that loops forever** must not freeze the game: JavaScript is terminated with a message (Task 4); whether PHP can be interrupted is measured and recorded (Task 5).
2. **An SQL script that fails halfway** must leave the world exactly as it was (Task 6).
3. **Empty code submitted** must fail the problem, not pass it or crash (Task 6).
4. **Cheating by deleting everything** must fail the problem's checks (Task 6).
5. **Rapid successive renders and reduced motion** must not leave duplicate or stale booking blocks, and must not animate when the learner asked for less motion (Task 7).

## File Structure

```
game/
  index.html                     entry page (shell)
  main.js                        boots the slice; exposes window.__game
  world/schema.js                SCHEMA sql and deterministic seedSql()
  world/world.js                 World: create, query, exec, snapshot, restore
  world/views.js                 TABLES, toObjects(), applyObjects() (JS/PHP <-> PostgreSQL)
  runners/sql.js                 runSql(): transactional SQL against the world
  runners/js.js                  runJs(): worker with a hard timeout
  runners/php.js                 createPhpRunner(): php-wasm with a SQLite mirror
  runners/index.js               runSolution(world, lang, code)
  problems/check.js              startProblem(), gradeProblem(), NO_OVERLAP_SQL
  problems/double-booking-1.js   the first problem card
  memory/curve.js                pure forgetting-curve maths
  memory/curve.test.mjs          node:test
  memory/meter.js                describeSkill() (pure) and renderMeter() (DOM)
  memory/meter.test.mjs          node:test
  ui/theme.css                   design tokens and timetable styles
  ui/timetable.js                animated front-of-house timetable
scripts/browser/
  game_lib.mjs                   shared harness helpers
  test_game_boot.mjs             shell boots
  test_game_world.mjs            world create, snapshot, restore
  spike_world_scale.mjs          50,000-booking scale and main-thread stall spike
  test_game_js_view.mjs          JS view, worker runner, write-back, timeout
  test_game_php_sync.mjs         PHP mirror and write-back
  spike_php_timeout.mjs          is PHP interruptible? (finding, not pass/fail)
  test_game_grading.mjs          outcome grading across three languages
  test_game_timetable.mjs        animation, clash flag, rapid renders, reduced motion
  test_game_meter.mjs            meter renders in the browser
  test_game_slice.mjs            end-to-end playable slice
docs/superpowers/spikes/2026-09-30-phase1-results.md   findings and go/no-go
```

---

### Task 1: Game shell and browser test harness

**Files:**
- Create: `game/index.html`, `game/main.js`, `scripts/browser/game_lib.mjs`, `scripts/browser/test_game_boot.mjs`
- Modify: `package.json` (scripts only)

**Interfaces:**
- Produces: `openGame(path?, opts?) -> { browser, page, errors, close }`, `makeReporter() -> { check(name, ok, detail?), note(name, detail), finish() }`, `BASE`, `window.__game.ready === true` once the game has booted.

- [ ] **Step 1: Write the harness helpers**

Create `scripts/browser/game_lib.mjs`:

```js
/* Shared helpers for the game's browser tests. Same conventions as the
   existing probes: print ok / XX per behaviour, exit non-zero on failure. */
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

export const BASE = process.env.GRIMOIRE_BASE || 'http://127.0.0.1:8010/';

export function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!existsSync(base)) return undefined;
  const dir = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  return dir
    ? [join(base, dir, 'chrome-win64', 'chrome.exe'), join(base, dir, 'chrome-win', 'chrome.exe')].find(existsSync)
    : undefined;
}

export async function openGame(path = 'game/index.html', opts = {}) {
  const browser = await chromium.launch({ executablePath: findChromium() });
  const context = await browser.newContext(opts.context || {});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  return { browser, page, errors, close: () => browser.close() };
}

export function makeReporter() {
  const rows = [];
  let failed = 0;
  return {
    check(name, ok, detail = '') { rows.push({ kind: ok ? 'ok' : 'XX', name, detail }); if (!ok) failed++; },
    note(name, detail = '') { rows.push({ kind: '..', name, detail }); },
    finish() {
      for (const r of rows) console.log(`${r.kind}  ${r.name}${r.detail ? '  - ' + r.detail : ''}`);
      const checks = rows.filter((r) => r.kind !== '..');
      console.log(`\n${checks.length - failed}/${checks.length} passed`);
      process.exit(failed ? 1 : 0);
    },
  };
}
```

- [ ] **Step 2: Write the failing boot test**

Create `scripts/browser/test_game_boot.mjs`:

```js
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame();
const ready = await page.waitForFunction(() => window.__game && window.__game.ready === true, null, { timeout: 15000 })
  .then(() => true, () => false);
t.check('game shell boots and sets window.__game.ready', ready);
t.check('the shell has an #app mount point', await page.locator('#app').count() === 1);
t.check('no page errors on load', errors.length === 0, errors.join(' | '));
await close();
t.finish();
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run serve` (leave running), then `node scripts/browser/test_game_boot.mjs`
Expected: FAIL (404 for `game/index.html`, so `window.__game` never appears).

- [ ] **Step 4: Write the shell**

Create `game/index.html`:

```html
<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Grimoire: Open for Business</title>
  <link rel="stylesheet" href="./ui/theme.css">
</head>
<body>
  <main id="app"></main>
  <script type="module" src="./main.js"></script>
</body>
</html>
```

Create `game/ui/theme.css` (tokens only for now; Task 7 extends it):

```css
:root {
  --ink: #14110f;
  --paper: #1d1915;
  --line: #34291f;
  --gold: #d9a441;
  --gold-dim: #8a6a2c;
  --text: #efe6d2;
  --muted: #a89b82;
  --danger: #e2574c;
  --ok: #6fbf8b;
  --radius: 10px;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--ink);
  color: var(--text);
  font: 16px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
}
#app { max-width: 960px; margin: 0 auto; padding: 16px; }
```

Create `game/main.js`:

```js
window.__game = { ready: true, phase: 1 };
```

- [ ] **Step 5: Add the test scripts to package.json**

In `package.json`, extend `scripts` (leave everything else as it is):

```json
"test:game:pure": "node --test game/",
"test:game": "node scripts/browser/test_game_boot.mjs && node scripts/browser/test_game_world.mjs && node scripts/browser/test_game_js_view.mjs && node scripts/browser/test_game_php_sync.mjs && node scripts/browser/test_game_grading.mjs && node scripts/browser/test_game_timetable.mjs && node scripts/browser/test_game_meter.mjs && node scripts/browser/test_game_slice.mjs"
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node scripts/browser/test_game_boot.mjs`
Expected: `3/3 passed`

- [ ] **Step 7: Commit**

```bash
git add game scripts/browser/game_lib.mjs scripts/browser/test_game_boot.mjs package.json
git commit -m "feat: game shell and browser test harness"
```

---

### Task 2: The world (PostgreSQL state, snapshot, restore)

**Files:**
- Create: `game/world/schema.js`, `game/world/world.js`, `scripts/browser/test_game_world.mjs`

**Interfaces:**
- Consumes: `openGame`, `makeReporter` from Task 1.
- Produces: `SCHEMA: string`; `seedSql({ rooms, people, bookings }) -> string`; `class World` with `static create(counts?, { loadDataDir }?) -> Promise<World>`, `query(sql, params?) -> Promise<row[]>`, `exec(sql) -> Promise<results>`, `count(table) -> Promise<number>`, `snapshot() -> Promise<Blob|File>`, `static restore(blob) -> Promise<World>`, `close()`, and the raw PGlite as `world.db`.

- [ ] **Step 1: Write the failing test**

Create `scripts/browser/test_game_world.mjs`:

```js
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame();
const r = await page.evaluate(async () => {
  const { World } = await import('/game/world/world.js');
  const w = await World.create({ rooms: 3, people: 5, bookings: 20 });
  const before = { rooms: await w.count('rooms'), people: await w.count('people'), bookings: await w.count('bookings') };
  const first = (await w.query('SELECT id, room_id FROM bookings ORDER BY id LIMIT 1'))[0];
  await w.exec("INSERT INTO bookings (room_id, person_id, start_at, end_at) VALUES (2, 1, '2030-01-01T09:00Z', '2030-01-01T10:00Z')");
  const snap = await w.snapshot();
  await w.exec('DELETE FROM bookings');
  const w2 = await World.restore(snap);
  const fresh = await World.create({ bookings: 5 });
  return {
    before, first,
    restored: await w2.count('bookings'),
    emptied: await w.count('bookings'),
    freshCount: await fresh.count('bookings'),
    version: (await w.query('SELECT version() AS v'))[0].v,
  };
});
t.check('seed creates the requested rows', r.before.rooms === 3 && r.before.people === 5 && r.before.bookings === 20, JSON.stringify(r.before));
t.check('the first booking is in room 1', r.first.room_id === 1);
t.check('a snapshot restores every row, including later inserts', r.restored === 21, String(r.restored));
t.check('a snapshot is independent of the live world', r.emptied === 0, String(r.emptied));
t.check('a new world is isolated from other worlds', r.freshCount === 5, String(r.freshCount));
t.check('it is a real PostgreSQL server', /PostgreSQL \d+/.test(r.version), r.version.slice(0, 40));
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();
t.finish();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/browser/test_game_world.mjs`
Expected: FAIL (`/game/world/world.js` does not exist, so the import rejects).

- [ ] **Step 3: Write the schema and seed**

Create `game/world/schema.js`:

```js
/* The booking business. Kept deliberately small: three tables, the shape every
   later problem grows from. Timestamps are timestamptz and the session runs in
   UTC, so a learner sees the same instants everywhere. */
export const SCHEMA = `
CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL
);
CREATE TABLE people (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer'
);
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  person_id INTEGER NOT NULL REFERENCES people(id),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  CHECK (end_at > start_at)
);`;

/* Deterministic: arithmetic only, no random() and no now(). Booking g goes to
   room 1 + g % rooms and starts (g / rooms) hours after 08:00 on 2026-01-01, so
   consecutive bookings in one room never overlap. The base world has no clashes;
   a problem adds its own. */
export function seedSql({ rooms = 3, people = 5, bookings = 20 } = {}) {
  return `
INSERT INTO rooms (name, capacity)
  SELECT 'Room ' || g, 4 + (g % 6) FROM generate_series(1, ${rooms}) g;
INSERT INTO people (name, role)
  SELECT 'Person ' || g, CASE WHEN g % 10 = 0 THEN 'staff' ELSE 'customer' END
  FROM generate_series(1, ${people}) g;
INSERT INTO bookings (room_id, person_id, start_at, end_at)
  SELECT 1 + (g % ${rooms}), 1 + (g % ${people}),
         TIMESTAMPTZ '2026-01-01 08:00+00' + (g / ${rooms}) * interval '1 hour',
         TIMESTAMPTZ '2026-01-01 08:00+00' + (g / ${rooms}) * interval '1 hour' + interval '1 hour'
  FROM generate_series(0, ${bookings} - 1) g;`;
}
```

- [ ] **Step 4: Write the World**

Create `game/world/world.js`:

```js
import { PGlite } from 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.8/dist/index.js';
import { SCHEMA, seedSql } from './schema.js';

/* One long-lived PostgreSQL per world. Unlike the app's grader, which builds a
   fresh database per run, the world persists across a learner's runs and can be
   snapshotted and restored, so a problem can start from a known checkpoint. */
export class World {
  constructor(db) { this.db = db; }

  static async create(counts = {}, { loadDataDir } = {}) {
    const db = new PGlite(loadDataDir ? { loadDataDir } : {});
    await db.waitReady;
    await db.exec("SET TIME ZONE 'UTC'");
    const world = new World(db);
    if (!loadDataDir) {
      await db.exec(SCHEMA);
      await db.exec(seedSql(counts));
    }
    return world;
  }

  async query(sql, params) { return (await this.db.query(sql, params)).rows; }
  async exec(sql) { return this.db.exec(sql); }
  async count(table) { return (await this.query(`SELECT count(*)::int AS n FROM ${table}`))[0].n; }
  async snapshot() { return this.db.dumpDataDir('gzip'); }
  static restore(blob) { return World.create({}, { loadDataDir: blob }); }
  async close() { await this.db.close(); }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node scripts/browser/test_game_world.mjs`
Expected: `7/7 passed`. If `dumpDataDir` or `loadDataDir` is not accepted by 0.5.8, that is a finding: record the exact error for Task 10 and try `dumpDataDir('none')`; do not switch PGlite versions without noting it there.

- [ ] **Step 6: Commit**

```bash
git add game/world scripts/browser/test_game_world.mjs
git commit -m "feat: persistent PostgreSQL world with snapshot and restore"
```

---

### Task 3: Scale spike (50,000 bookings, and does PGlite stall the page?)

**Files:**
- Create: `scripts/browser/spike_world_scale.mjs`

**Interfaces:**
- Consumes: `World` from Task 2.
- Produces: measured numbers (create, query, snapshot and restore times, snapshot size, longest main-thread stall) for Task 10.

- [ ] **Step 1: Write the spike**

Create `scripts/browser/spike_world_scale.mjs`:

```js
/* Spec risk 1: can the world hold a grown business (50,000 bookings) without
   freezing the page? Correctness is checked hard; timings are reported, with
   generous ceilings so a genuinely unusable result still fails. */
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame();
const r = await page.evaluate(async () => {
  const { World } = await import('/game/world/world.js');
  let last = performance.now(), maxGap = 0, running = true;
  const tick = () => {
    const n = performance.now();
    maxGap = Math.max(maxGap, n - last);
    last = n;
    if (running) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const ms = {};
  let t0 = performance.now();
  const w = await World.create({ rooms: 20, people: 500, bookings: 50000 });
  ms.create = Math.round(performance.now() - t0);

  const CLASH = `SELECT count(*)::int AS n FROM bookings a JOIN bookings b
    ON a.room_id = b.room_id AND a.id < b.id AND a.start_at < b.end_at AND b.start_at < a.end_at`;
  t0 = performance.now();
  const clashesBefore = (await w.query(CLASH))[0].n;
  ms.clashNoIndex = Math.round(performance.now() - t0);

  await w.exec('CREATE INDEX bookings_room_time ON bookings (room_id, start_at, end_at)');
  t0 = performance.now();
  await w.query(CLASH);
  ms.clashWithIndex = Math.round(performance.now() - t0);

  t0 = performance.now();
  const snap = await w.snapshot();
  ms.snapshot = Math.round(performance.now() - t0);
  const bytes = snap.size;

  t0 = performance.now();
  const w2 = await World.restore(snap);
  ms.restore = Math.round(performance.now() - t0);
  const restored = await w2.count('bookings');
  running = false;
  return { ms, bytes, clashesBefore, restored, total: await w.count('bookings'), maxGapMs: Math.round(maxGap) };
});

t.check('50,000 bookings were created', r.total === 50000, String(r.total));
t.check('the base seed has no clashes', r.clashesBefore === 0, String(r.clashesBefore));
t.check('a restored snapshot has all 50,000 bookings', r.restored === 50000, String(r.restored));
t.check('create finishes under 30 s', r.ms.create < 30000, r.ms.create + ' ms');
t.check('snapshot finishes under 20 s', r.ms.snapshot < 20000, r.ms.snapshot + ' ms');
t.check('restore finishes under 30 s', r.ms.restore < 30000, r.ms.restore + ' ms');
t.note('timings', JSON.stringify(r.ms));
t.note('snapshot size', (r.bytes / 1024 / 1024).toFixed(1) + ' MiB');
t.note('longest main-thread stall', r.maxGapMs + ' ms' + (r.maxGapMs > 250
  ? '  => PGlite on the main thread freezes the page; run the world in PGliteWorker'
  : '  => acceptable on the main thread'));
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();
t.finish();
```

- [ ] **Step 2: Run it**

Run: `node scripts/browser/spike_world_scale.mjs`
Expected: all `ok` lines, plus `..` lines with the timings and the stall verdict. This is a measurement: copy the `..` lines into Task 10. A stall over 250 ms is a finding (the world must move to a `PGliteWorker`), not a failure of this task.

- [ ] **Step 3: Commit**

```bash
git add scripts/browser/spike_world_scale.mjs
git commit -m "probe: PostgreSQL world at 50,000 bookings, timings and main-thread stall"
```

---

### Task 4: JavaScript view, worker runner, and write-back

**Files:**
- Create: `game/world/views.js`, `game/runners/js.js`, `scripts/browser/test_game_js_view.mjs`

**Interfaces:**
- Consumes: `World` (Task 2).
- Produces: `TABLES` (column map: table -> { column: sqliteType }), `toObjects(world) -> Promise<{ rooms, people, bookings }>` (timestamps as ISO-8601 UTC strings), `applyObjects(world, objects) -> Promise<void>` (transactional replace; assigns ids to rows without one; realigns sequences), `runJs(code, worldObjects, { timeoutMs }?) -> Promise<{ ok, result?, world?, logs?, error?, timedOut? }>`. Learner JavaScript receives `world` (the objects) and `console.log`; it may mutate `world` and may `return` a value.

- [ ] **Step 1: Write the failing test**

Create `scripts/browser/test_game_js_view.mjs`:

```js
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame();
const r = await page.evaluate(async () => {
  const { World } = await import('/game/world/world.js');
  const { toObjects, applyObjects } = await import('/game/world/views.js');
  const { runJs } = await import('/game/runners/js.js');
  const w = await World.create({ rooms: 3, people: 5, bookings: 20 });
  const objs = await toObjects(w);
  const out = {};
  out.counts = { rooms: objs.rooms.length, people: objs.people.length, bookings: objs.bookings.length };
  out.iso = objs.bookings[0].start_at;

  const sqlRoom1 = (await w.query('SELECT count(*)::int AS n FROM bookings WHERE room_id = 1'))[0].n;
  const read = await runJs('return world.bookings.filter((b) => b.room_id === 1).length;', objs);
  out.read = { ok: read.ok, result: read.result, sqlRoom1 };

  const write = await runJs(
    "world.bookings.push({ room_id: 2, person_id: 1, start_at: '2030-01-01T09:00:00Z', end_at: '2030-01-01T10:00:00Z' });",
    objs);
  await applyObjects(w, write.world);
  out.afterWrite = {
    bookings: await w.count('bookings'),
    rooms: await w.count('rooms'),
    newId: (await w.query('SELECT max(id)::int AS m FROM bookings'))[0].m,
  };
  await w.exec("INSERT INTO bookings (room_id, person_id, start_at, end_at) VALUES (1, 1, '2030-02-01T09:00Z', '2030-02-01T10:00Z')");
  out.nextSerial = (await w.query('SELECT max(id)::int AS m FROM bookings'))[0].m;

  const bad = await runJs("throw new Error('boom');", objs);
  out.error = { ok: bad.ok, error: bad.error, bookingsAfter: await w.count('bookings') };

  const t0 = performance.now();
  const loop = await runJs('while (true) {}', objs, { timeoutMs: 1500 });
  out.loop = { ok: loop.ok, timedOut: loop.timedOut, ms: Math.round(performance.now() - t0) };

  const rollback = await (async () => {
    try {
      await applyObjects(w, { rooms: objs.rooms, people: objs.people, bookings: [{ room_id: 999, person_id: 1, start_at: '2030-01-01T09:00:00Z', end_at: '2030-01-01T10:00:00Z' }] });
      return 'no error';
    } catch { return 'threw'; }
  })();
  out.rollback = { result: rollback, bookings: await w.count('bookings') };
  return out;
});

t.check('toObjects returns every row', r.counts.rooms === 3 && r.counts.people === 5 && r.counts.bookings === 20, JSON.stringify(r.counts));
t.check('timestamps arrive as ISO-8601 UTC strings', /^2026-01-01T08:00:00Z$/.test(r.iso), r.iso);
t.check('learner JavaScript sees the same data as SQL', r.read.ok && r.read.result === r.read.sqlRoom1, JSON.stringify(r.read));
t.check('a booking pushed in JavaScript lands in PostgreSQL', r.afterWrite.bookings === 21 && r.afterWrite.rooms === 3, JSON.stringify(r.afterWrite));
t.check('the pushed booking was given the next id', r.afterWrite.newId === 21, String(r.afterWrite.newId));
t.check('the id sequence is realigned after write-back', r.nextSerial === 22, String(r.nextSerial));
t.check('a thrown error is reported and changes nothing', r.error.ok === false && /boom/.test(r.error.error) && r.error.bookingsAfter === 22, JSON.stringify(r.error));
t.check('an infinite loop is terminated with timedOut', r.loop.ok === false && r.loop.timedOut === true && r.loop.ms < 3500, JSON.stringify(r.loop));
t.check('a failed write-back rolls back and leaves the world intact', r.rollback.result === 'threw' && r.rollback.bookings === 22, JSON.stringify(r.rollback));
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();
t.finish();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/browser/test_game_js_view.mjs`
Expected: FAIL (`/game/world/views.js` does not exist).

- [ ] **Step 3: Write the views**

Create `game/world/views.js`:

```js
/* How JavaScript and PHP see the PostgreSQL world, and how their changes get
   back. Both languages get the same three tables. Timestamps cross the boundary
   as ISO-8601 UTC text so neither side depends on a time zone. */
export const TABLES = {
  rooms: { id: 'INTEGER PRIMARY KEY', name: 'TEXT', capacity: 'INTEGER' },
  people: { id: 'INTEGER PRIMARY KEY', name: 'TEXT', role: 'TEXT' },
  bookings: {
    id: 'INTEGER PRIMARY KEY', room_id: 'INTEGER', person_id: 'INTEGER',
    start_at: 'TEXT', end_at: 'TEXT',
  },
};

const ISO = (c) => `to_char(${c} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ${c}`;
const SELECTS = {
  rooms: 'SELECT id, name, capacity FROM rooms ORDER BY id',
  people: 'SELECT id, name, role FROM people ORDER BY id',
  bookings: `SELECT id, room_id, person_id, ${ISO('start_at')}, ${ISO('end_at')} FROM bookings ORDER BY id`,
};
const ORDER = ['rooms', 'people', 'bookings']; // parents before children

export async function toObjects(world) {
  const out = {};
  for (const t of ORDER) out[t] = await world.query(SELECTS[t]);
  return out;
}

/* Replace the world's rows with the given objects, in one transaction. Rows
   without an id get the next one. Any failure (a foreign key, a CHECK) rolls
   everything back so a bad answer can never half-change the world. */
export async function applyObjects(world, objects) {
  await world.exec('BEGIN');
  try {
    await world.exec('TRUNCATE bookings, people, rooms RESTART IDENTITY');
    for (const t of ORDER) {
      const rows = objects[t] || [];
      const cols = Object.keys(TABLES[t]);
      let nextId = 1 + rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
      const marks = cols.map((_, i) => `$${i + 1}`).join(', ');
      for (const row of rows) {
        const values = cols.map((c) => (c === 'id' ? (row.id ?? nextId++) : (row[c] ?? null)));
        await world.db.query(`INSERT INTO ${t} (${cols.join(', ')}) VALUES (${marks})`, values);
      }
      await world.exec(
        `SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT max(id) FROM ${t}), 1), ` +
        `(SELECT count(*) > 0 FROM ${t}))`);
    }
    await world.exec('COMMIT');
  } catch (e) {
    await world.exec('ROLLBACK');
    throw e;
  }
}
```

- [ ] **Step 4: Write the JavaScript runner**

Create `game/runners/js.js`:

```js
/* Learner JavaScript runs in a Web Worker with a hard timeout, so an infinite
   loop costs the learner a message, not the page. The worker gets a copy of the
   world objects; whatever it leaves in `world` is what the caller writes back. */
const WORKER_SRC = `
self.onmessage = async (e) => {
  const { code, world } = e.data;
  const logs = [];
  const console = { log: (...a) => logs.push(a.map(String).join(' ')) };
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const fn = new AsyncFunction('world', 'console', code);
    const result = await fn(world, console);
    self.postMessage({ ok: true, result, world, logs });
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err), logs });
  }
};`;

export function runJs(code, world, { timeoutMs = 2000 } = {}) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
    const worker = new Worker(url);
    let timer;
    const done = (value) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    timer = setTimeout(
      () => done({ ok: false, error: `Timed out after ${timeoutMs} ms. Does a loop never finish?`, timedOut: true }),
      timeoutMs);
    worker.onmessage = (e) => done(e.data);
    worker.onerror = (e) => done({ ok: false, error: e.message || 'The script failed to run.' });
    worker.postMessage({ code, world });
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node scripts/browser/test_game_js_view.mjs`
Expected: `10/10 passed`

- [ ] **Step 6: Commit**

```bash
git add game/world/views.js game/runners/js.js scripts/browser/test_game_js_view.mjs
git commit -m "feat: JavaScript view of the world, worker runner with timeout, transactional write-back"
```

---

### Task 5: PHP view (SQLite mirror), write-back, and the timeout finding

**Files:**
- Create: `game/runners/php.js`, `scripts/browser/test_game_php_sync.mjs`, `scripts/browser/spike_php_timeout.mjs`

**Interfaces:**
- Consumes: `TABLES`, `toObjects`, `applyObjects` (Task 4); `World` (Task 2).
- Produces: `createPhpRunner() -> Promise<{ run(code, worldObjects) -> Promise<{ ok, stdout?, world?, error? }> }>`. Learner PHP receives `$pdo` (a PDO over an in-memory SQLite copy of the world) and writes plain PHP with no opening tag. On success the runner returns the modified world objects for `applyObjects`.

- [ ] **Step 1: Check how the existing app isolates PHP**

Run: `grep -n "phpwasm\|runPhp" index.html | cut -c1-200`
Read the matching `Exec.runPhp` (and any worker it starts). Note in Task 10 whether the app runs PHP inside a Worker and how it stops a runaway script. If it does, the approach below should copy that isolation in Phase 2; do not edit `index.html`.

- [ ] **Step 2: Write the failing test**

Create `scripts/browser/test_game_php_sync.mjs`:

```js
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame();
const r = await page.evaluate(async () => {
  const { World } = await import('/game/world/world.js');
  const { toObjects, applyObjects } = await import('/game/world/views.js');
  const { createPhpRunner } = await import('/game/runners/php.js');
  const t0 = performance.now();
  const php = await createPhpRunner();
  const loadMs = Math.round(performance.now() - t0);
  const w = await World.create({ rooms: 3, people: 5, bookings: 20 });
  const objs = await toObjects(w);
  const sqlRoom1 = (await w.query('SELECT count(*)::int AS n FROM bookings WHERE room_id = 1'))[0].n;

  const res = await php.run(`
    echo $pdo->query("SELECT COUNT(*) FROM bookings WHERE room_id = 1")->fetchColumn();
    $pdo->exec("INSERT INTO bookings (room_id, person_id, start_at, end_at)
                VALUES (2, 1, '2030-01-01T09:00:00Z', '2030-01-01T10:00:00Z')");
  `, objs);
  let after = null;
  if (res.ok) {
    await applyObjects(w, res.world);
    after = {
      bookings: await w.count('bookings'),
      rooms: await w.count('rooms'),
      start: (await w.query("SELECT to_char(start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS s FROM bookings ORDER BY id DESC LIMIT 1"))[0].s,
    };
  }
  const thrown = await php.run("throw new Exception('nope');", objs);
  const syntax = await php.run('this is not php', objs);
  return { loadMs, sqlRoom1, res: { ok: res.ok, stdout: res.stdout, error: res.error }, after, thrown, syntax, bookingsNow: await w.count('bookings') };
});

t.note('PHP runtime load', r.loadMs + ' ms');
t.check('PHP reads the same data as SQL', r.res.ok && r.res.stdout.trim() === String(r.sqlRoom1), JSON.stringify(r.res));
t.check('a booking inserted through PDO lands in PostgreSQL', r.after && r.after.bookings === 21 && r.after.rooms === 3, JSON.stringify(r.after));
t.check('timestamps survive the round trip as the same instant', r.after && r.after.start === '2030-01-01T10:00:00Z' || (r.after && r.after.start === '2030-01-01T09:00:00Z'), r.after && r.after.start);
t.check('a thrown exception is reported as an error', r.thrown.ok === false && /nope/.test(r.thrown.error), JSON.stringify(r.thrown));
t.check('a PHP syntax error is reported as an error', r.syntax.ok === false, JSON.stringify(r.syntax));
t.check('failed runs left the world unchanged', r.bookingsNow === 21, String(r.bookingsNow));
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();
t.finish();
```

Note: the `ORDER BY id DESC LIMIT 1` row is the inserted booking, whose end is `10:00`, but the check above compares `start_at` of that row, which is `09:00:00Z`. Simplify while writing: the expected value is `'2030-01-01T09:00:00Z'`. Replace the awkward `||` condition with `r.after && r.after.start === '2030-01-01T09:00:00Z'`.

- [ ] **Step 3: Run it to verify it fails**

Run: `node scripts/browser/test_game_php_sync.mjs`
Expected: FAIL (`/game/runners/php.js` does not exist).

- [ ] **Step 4: Write the PHP runner**

Create `game/runners/php.js`:

```js
import { TABLES } from '../world/views.js';

/* PHP cannot reach a Postgres server in the browser, so the learner works on a
   SQLite copy of the world through PDO and the result is written back. The
   learner's code is written to a file and included, exactly as a real request
   would load it; php-wasm's run() prefixes the script, so this also keeps
   directives like declare(strict_types=1) possible later. */
const SRC = 'https://cdn.jsdelivr.net/npm/php-wasm/PhpWeb.mjs';
const SQLITE = 'https://cdn.jsdelivr.net/npm/php-wasm-sqlite@0.1.0/index.mjs';
const SENTINEL = '@@GRIMOIRE_WORLD@@';
const b64 = (s) => btoa(unescape(encodeURIComponent(s)));

export async function createPhpRunner() {
  const { PhpWeb } = await import(SRC);
  const { default: sqlite } = await import(SQLITE);
  const php = new PhpWeb({ version: '8.4', sharedLibs: [sqlite] });
  let out = '';
  let err = '';
  php.addEventListener('output', (e) => { out += (e.detail || []).join(''); });
  php.addEventListener('error', (e) => { err += (e.detail || []).join(''); });
  await new Promise((resolve, reject) => {
    php.addEventListener('ready', resolve);
    setTimeout(() => reject(new Error('PHP runtime never became ready')), 60000);
  });

  const createTables = Object.entries(TABLES)
    .map(([t, cols]) => {
      const sql = `CREATE TABLE ${t} (` + Object.entries(cols).map(([c, ty]) => `${c} ${ty}`).join(', ') + ')';
      return `$pdo->exec(${JSON.stringify(sql)});`;
    })
    .join('\n');

  const wrap = (code, world) => `<?php
set_time_limit(2);
$__w = json_decode(base64_decode('${b64(JSON.stringify(world))}'), true);
$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
${createTables}
foreach ($__w as $t => $rows) {
  foreach ($rows as $r) {
    $cols = array_keys($r);
    $pdo->prepare("INSERT INTO $t (" . implode(',', $cols) . ") VALUES (" . implode(',', array_fill(0, count($cols), '?')) . ")")
        ->execute(array_values($r));
  }
}
file_put_contents('/tmp/learner.php', '<?php ' . base64_decode('${b64(code)}'));
try { include '/tmp/learner.php'; }
catch (Throwable $e) { echo "\\nPHP error: " . $e->getMessage(); $__failed = true; }
if (empty($__failed)) {
  echo "${SENTINEL}";
  $__o = [];
  foreach (['rooms', 'people', 'bookings'] as $t) {
    $__o[$t] = $pdo->query("SELECT * FROM $t ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
  }
  echo json_encode($__o);
}`;

  return {
    async run(code, world) {
      out = '';
      err = '';
      try { await php.run(wrap(code, world)); } catch (e) { err += String((e && e.message) || e); }
      const i = out.indexOf(SENTINEL);
      if (i === -1) return { ok: false, stdout: out, error: (err || out || 'PHP did not finish').trim() };
      try {
        return { ok: true, stdout: out.slice(0, i), world: JSON.parse(out.slice(i + SENTINEL.length)) };
      } catch (e) {
        return { ok: false, stdout: out, error: 'PHP returned data the game could not read.' };
      }
    },
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node scripts/browser/test_game_php_sync.mjs`
Expected: all checks `ok`. If integer columns come back as strings and `applyObjects` rejects them, cast in `applyObjects` (`Number(row[c])` for `INTEGER` columns) and re-run; note the fix in Task 10.

- [ ] **Step 6: Write the PHP timeout finding**

A runaway PHP script could freeze the page if PHP runs on the main thread. A Node-side race is needed because a hung page cannot answer for itself. Create `scripts/browser/spike_php_timeout.mjs`:

```js
/* Finding, not pass/fail: can a runaway PHP script be interrupted? If not, the
   PHP track must run php-wasm in a Worker that can be terminated (Phase 2). */
import { openGame } from './game_lib.mjs';

const { page, close } = await openGame();
const attempt = page.evaluate(async () => {
  const { createPhpRunner } = await import('/game/runners/php.js');
  const php = await createPhpRunner();
  const t0 = performance.now();
  const res = await php.run('while (true) {}', { rooms: [], people: [], bookings: [] });
  return { ok: res.ok, error: res.error, ms: Math.round(performance.now() - t0) };
});
const verdict = await Promise.race([
  attempt,
  new Promise((r) => setTimeout(() => r('HUNG'), 25000)),
]);
if (verdict === 'HUNG') {
  console.log('..  PHP infinite loop: NOT interruptible from the main thread (page hung 25 s)');
  console.log('..  => Phase 2 must run php-wasm in a Worker and terminate it on timeout');
} else {
  console.log('..  PHP infinite loop: interrupted after ' + verdict.ms + ' ms - ' + JSON.stringify(verdict.error));
  console.log('..  => set_time_limit works in php-wasm; a Worker is still the safer isolation');
}
await close().catch(() => {});
process.exit(0);
```

Run: `node scripts/browser/spike_php_timeout.mjs`
Expected: one of the two verdicts. Copy it into Task 10.

- [ ] **Step 7: Commit**

```bash
git add game/runners/php.js scripts/browser/test_game_php_sync.mjs scripts/browser/spike_php_timeout.mjs
git commit -m "feat: PHP view of the world through a SQLite mirror, with write-back"
```

---

### Task 6: Outcome grading across three languages

**Files:**
- Create: `game/runners/sql.js`, `game/runners/index.js`, `game/problems/check.js`, `game/problems/double-booking-1.js`, `scripts/browser/test_game_grading.mjs`

**Interfaces:**
- Consumes: `World`, `toObjects`, `applyObjects`, `runJs`, `createPhpRunner`.
- Produces: `runSql(world, code) -> Promise<{ ok, rows?, stdout?, error? }>` (a failed script is rolled back); `runSolution(world, lang, code)` with `lang` in `'sql' | 'js' | 'php'`, always `{ ok, ..., error? }`; `startProblem(problem) -> Promise<World>`; `gradeProblem(world, problem) -> Promise<{ passed, results: [{ name, ok, detail }] }>`; `NO_OVERLAP_SQL`; the problem card shape below.

Problem card shape (data, so later problems can be JSON): `{ id, title, goal, languages, world: {rooms, people, bookings}, setup: sql, checks: [{ name, sql, expect: { equals | atLeast | atMost: number } }], reference: { sql, js, php }, alternates: [{ lang, name, code }], cheats: [{ lang, name, code }] }`.

- [ ] **Step 1: Write the failing test**

Create `scripts/browser/test_game_grading.mjs`:

```js
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame();
const r = await page.evaluate(async () => {
  const { runSolution } = await import('/game/runners/index.js');
  const { startProblem, gradeProblem } = await import('/game/problems/check.js');
  const { doubleBooking1: p } = await import('/game/problems/double-booking-1.js');

  const attempt = async (lang, code) => {
    const w = await startProblem(p);
    const run = await runSolution(w, lang, code);
    const grade = await gradeProblem(w, p);
    return { run: { ok: run.ok, error: run.error }, passed: grade.passed, failed: grade.results.filter((x) => !x.ok).map((x) => x.name) };
  };

  const out = { start: null, reference: {}, alternates: [], cheats: [], empty: {} };
  const w0 = await startProblem(p);
  out.start = await gradeProblem(w0, p);
  for (const lang of p.languages) out.reference[lang] = await attempt(lang, p.reference[lang]);
  for (const a of p.alternates) out.alternates.push({ name: a.name, ...(await attempt(a.lang, a.code)) });
  for (const c of p.cheats) out.cheats.push({ name: c.name, ...(await attempt(c.lang, c.code)) });
  for (const lang of p.languages) out.empty[lang] = await attempt(lang, '');

  const w1 = await startProblem(p);
  const before = await w1.count('bookings');
  const half = await runSolution(w1, 'sql',
    "INSERT INTO bookings (room_id, person_id, start_at, end_at) VALUES (3, 1, '2030-01-01T09:00Z', '2030-01-01T10:00Z'); SELECT nonsense FROM nowhere;");
  out.half = { ok: half.ok, before, after: await w1.count('bookings') };
  return out;
});

t.check('the problem starts unsolved', r.start.passed === false, JSON.stringify(r.start.results));
for (const lang of ['sql', 'js', 'php']) {
  t.check(`the reference ${lang} solution passes`, r.reference[lang].run.ok && r.reference[lang].passed,
    JSON.stringify(r.reference[lang]));
}
for (const a of r.alternates) t.check(`a different valid answer passes: ${a.name}`, a.run.ok && a.passed, JSON.stringify(a));
for (const c of r.cheats) t.check(`the cheat fails: ${c.name}`, c.passed === false, JSON.stringify(c));
for (const lang of ['sql', 'js', 'php']) {
  t.check(`empty ${lang} code fails cleanly`, r.empty[lang].passed === false, JSON.stringify(r.empty[lang]));
}
t.check('an SQL script that fails halfway leaves the world unchanged', r.half.ok === false && r.half.after === r.half.before, JSON.stringify(r.half));
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();
t.finish();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/browser/test_game_grading.mjs`
Expected: FAIL (`/game/runners/index.js` does not exist).

- [ ] **Step 3: Write the SQL runner**

Create `game/runners/sql.js`:

```js
/* Learner SQL runs in one transaction: if any statement fails, everything the
   script did is rolled back, so a half-working answer never half-changes the
   world. */
export async function runSql(world, code) {
  try {
    await world.exec('BEGIN');
    const results = await world.exec(code);
    await world.exec('COMMIT');
    const sets = results.filter((r) => r.fields && r.fields.length);
    const last = sets[sets.length - 1];
    return { ok: true, rows: last ? last.rows : [], stdout: last ? JSON.stringify(last.rows) : '(no rows)' };
  } catch (e) {
    try { await world.exec('ROLLBACK'); } catch { /* nothing to roll back */ }
    return { ok: false, error: String((e && e.message) || e) };
  }
}
```

- [ ] **Step 4: Write the runner entry point**

Create `game/runners/index.js`:

```js
import { runSql } from './sql.js';
import { runJs } from './js.js';
import { toObjects, applyObjects } from '../world/views.js';

let phpRunner = null;

/* One door for every language. Always resolves to { ok, ..., error? }; a bad
   answer is reported, never thrown, and never changes the world. */
export async function runSolution(world, lang, code) {
  try {
    if (lang === 'sql') return await runSql(world, code);
    if (lang === 'js') {
      const res = await runJs(code, await toObjects(world));
      if (res.ok) await applyObjects(world, res.world);
      return res;
    }
    if (lang === 'php') {
      phpRunner ??= await (await import('./php.js')).createPhpRunner();
      const res = await phpRunner.run(code, await toObjects(world));
      if (res.ok) await applyObjects(world, res.world);
      return res;
    }
    return { ok: false, error: `There is no runtime for ${lang}.` };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}
```

- [ ] **Step 5: Write the grader**

Create `game/problems/check.js`:

```js
import { World } from '../world/world.js';

export const NO_OVERLAP_SQL = `SELECT count(*)::int AS n FROM bookings a JOIN bookings b
  ON a.room_id = b.room_id AND a.id < b.id AND a.start_at < b.end_at AND b.start_at < a.end_at`;

export async function startProblem(problem) {
  const world = await World.create(problem.world);
  if (problem.setup) await world.exec(problem.setup);
  return world;
}

const matches = (value, expect) => {
  if ('equals' in expect) return value === expect.equals;
  if ('atLeast' in expect) return value >= expect.atLeast;
  if ('atMost' in expect) return value <= expect.atMost;
  return false;
};

/* Outcome grading: a problem is passed when the world it leaves behind satisfies
   every check, however the learner got there. */
export async function gradeProblem(world, problem) {
  const results = [];
  for (const c of problem.checks) {
    let ok = false;
    let detail = '';
    try {
      const rows = await world.query(c.sql);
      const value = rows[0] ? Object.values(rows[0])[0] : undefined;
      ok = matches(value, c.expect);
      detail = String(value);
    } catch (e) {
      detail = String((e && e.message) || e);
    }
    results.push({ name: c.name, ok, detail });
  }
  return { passed: results.every((r) => r.ok), results };
}
```

- [ ] **Step 6: Write the first problem card**

Create `game/problems/double-booking-1.js`:

```js
import { NO_OVERLAP_SQL } from './check.js';

/* Booking 21 clashes with booking 1 in Room 1 from 08:30. The first booking
   stands, so any answer that removes or moves the newer one is valid. */
export const doubleBooking1 = {
  id: 'double-booking-1',
  title: 'Two people, one room',
  goal: 'Room 1 is double-booked from 08:30. The first booking stands. Sort out the newer one.',
  languages: ['sql', 'js', 'php'],
  world: { rooms: 3, people: 5, bookings: 20 },
  setup: `INSERT INTO bookings (room_id, person_id, start_at, end_at)
          VALUES (1, 2, '2026-01-01T08:30:00Z', '2026-01-01T09:30:00Z');`,
  checks: [
    { name: 'no room is double-booked', sql: NO_OVERLAP_SQL, expect: { equals: 0 } },
    { name: 'the original 20 bookings are untouched',
      sql: 'SELECT count(*)::int AS n FROM bookings WHERE id <= 20', expect: { equals: 20 } },
  ],
  reference: {
    sql: 'DELETE FROM bookings WHERE id = 21;',
    js: 'world.bookings = world.bookings.filter((b) => b.id !== 21);',
    php: "$pdo->exec('DELETE FROM bookings WHERE id = 21');",
  },
  alternates: [
    { lang: 'sql', name: 'move the newer booking to another day',
      code: "UPDATE bookings SET start_at = '2026-01-02T08:00:00Z', end_at = '2026-01-02T09:00:00Z' WHERE id = 21;" },
    { lang: 'js', name: 'move the newer booking to another day',
      code: "const b = world.bookings.find((x) => x.id === 21); b.start_at = '2026-01-02T08:00:00Z'; b.end_at = '2026-01-02T09:00:00Z';" },
  ],
  cheats: [
    { lang: 'sql', name: 'delete every booking', code: 'DELETE FROM bookings;' },
    { lang: 'js', name: 'empty the bookings list', code: 'world.bookings = [];' },
  ],
};
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `node scripts/browser/test_game_grading.mjs`
Expected: all checks `ok`. If a check fails because the seed has an unexpected clash, print the clashing pair with the `NO_OVERLAP_SQL` join and fix the card's `setup`, not the checks.

- [ ] **Step 8: Commit**

```bash
git add game/runners/sql.js game/runners/index.js game/problems scripts/browser/test_game_grading.mjs
git commit -m "feat: outcome grading across SQL, JavaScript and PHP, with the first problem card"
```

---

### Task 7: The animated timetable (front-of-house)

**Files:**
- Create: `game/ui/timetable.js`, `scripts/browser/test_game_timetable.mjs`
- Modify: `game/ui/theme.css` (append the timetable styles)

**Interfaces:**
- Consumes: world objects in the shape `toObjects()` returns.
- Produces: `createTimetable(root, { day = '2026-01-01', reduceMotion? }) -> { render(objects), destroy() }`. Blocks are `.tt-booking[data-booking-id]`; a booking overlapping an earlier one in the same room gets `.is-clash`; a block that is fading out has `.is-leaving`; a new block has `.is-entering` for the length of its animation. With reduced motion (the OS setting, or `reduceMotion: true`) nothing animates and removals are immediate.

- [ ] **Step 1: Write the failing test**

Create `scripts/browser/test_game_timetable.mjs`:

```js
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const scenario = async (page) => page.evaluate(async () => {
  const { createTimetable } = await import('/game/ui/timetable.js');
  const root = document.createElement('div');
  document.body.appendChild(root);
  const tt = createTimetable(root);
  const rooms = [{ id: 1, name: 'Room 1', capacity: 4 }, { id: 2, name: 'Room 2', capacity: 5 }];
  const b = (id, room, s, e) => ({ id, room_id: room, person_id: 1, start_at: `2026-01-01T${s}:00Z`, end_at: `2026-01-01T${e}:00Z` });
  const A = { rooms, people: [], bookings: [b(1, 1, '08:00', '09:00'), b(2, 2, '08:00', '09:00'), b(3, 1, '10:00', '11:00')] };
  const B = { ...A, bookings: [...A.bookings, b(4, 2, '09:00', '10:00')] };
  const C = { ...A, bookings: [...A.bookings, b(5, 1, '08:30', '09:30')] };
  const live = () => root.querySelectorAll('.tt-booking:not(.is-leaving)');
  const out = {};

  tt.render(A);
  out.rows = root.querySelectorAll('.tt-row').length;
  out.first = live().length;

  tt.render(B);
  const added = root.querySelector('[data-booking-id="4"]');
  out.added = { count: live().length, animating: added.getAnimations().length, entering: added.classList.contains('is-entering') };

  tt.render(C);
  out.clash = root.querySelectorAll('.tt-booking.is-clash:not(.is-leaving)').length;
  out.clashId = root.querySelector('.tt-booking.is-clash:not(.is-leaving)')?.dataset.bookingId;

  tt.render(A);
  out.leavingNow = root.querySelectorAll('.is-leaving').length;
  await new Promise((r) => setTimeout(r, 700));
  out.afterFade = { live: live().length, leaving: root.querySelectorAll('.is-leaving').length };

  tt.render(B); tt.render(A); tt.render(B);
  const ids = [...live()].map((e) => e.dataset.bookingId);
  out.rapid = { count: ids.length, unique: new Set(ids).size };

  const big = { rooms, people: [], bookings: Array.from({ length: 500 }, (_, i) => b(1000 + i, 1 + (i % 2), '08:00', '09:00')) };
  const t0 = performance.now();
  tt.render(big);
  out.bigMs = Math.round(performance.now() - t0);
  return out;
});

{
  const { page, errors, close } = await openGame();
  const r = await scenario(page);
  t.check('one row per room', r.rows === 2, String(r.rows));
  t.check('the first render shows every booking', r.first === 3, String(r.first));
  t.check('a new booking is added and animates in', r.added.count === 4 && r.added.animating > 0 && r.added.entering, JSON.stringify(r.added));
  t.check('an overlapping booking is flagged as a clash', r.clash === 1 && r.clashId === '5', `${r.clash} / ${r.clashId}`);
  t.check('a removed booking fades out first', r.leavingNow >= 1, String(r.leavingNow));
  t.check('faded blocks are removed from the page', r.afterFade.live === 3 && r.afterFade.leaving === 0, JSON.stringify(r.afterFade));
  t.check('rapid re-renders leave no duplicate or stale blocks', r.rapid.count === 4 && r.rapid.unique === 4, JSON.stringify(r.rapid));
  t.note('render 500 bookings', r.bigMs + ' ms');
  t.check('no page errors', errors.length === 0, errors.join(' | '));
  await close();
}
{
  const { page, close } = await openGame('game/index.html', { context: { reducedMotion: 'reduce' } });
  const r = await page.evaluate(async () => {
    const { createTimetable } = await import('/game/ui/timetable.js');
    const root = document.createElement('div');
    document.body.appendChild(root);
    const tt = createTimetable(root);
    const rooms = [{ id: 1, name: 'Room 1', capacity: 4 }];
    const b = (id) => ({ id, room_id: 1, person_id: 1, start_at: '2026-01-01T08:00:00Z', end_at: '2026-01-01T09:00:00Z' });
    tt.render({ rooms, people: [], bookings: [b(1)] });
    tt.render({ rooms, people: [], bookings: [b(1), { ...b(2), start_at: '2026-01-01T10:00:00Z', end_at: '2026-01-01T11:00:00Z' }] });
    const added = root.querySelector('[data-booking-id="2"]');
    const animations = added.getAnimations().length;
    tt.render({ rooms, people: [], bookings: [b(1)] });
    return { animations, leaving: root.querySelectorAll('.is-leaving').length, blocks: root.querySelectorAll('.tt-booking').length };
  });
  t.check('reduced motion: nothing animates', r.animations === 0, JSON.stringify(r));
  t.check('reduced motion: removal is immediate', r.leaving === 0 && r.blocks === 1, JSON.stringify(r));
  await close();
}
t.finish();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/browser/test_game_timetable.mjs`
Expected: FAIL (`/game/ui/timetable.js` does not exist).

- [ ] **Step 3: Write the timetable**

Create `game/ui/timetable.js`:

```js
const DAY_START_HOUR = 8;
const DAY_HOURS = 8; // 08:00 to 16:00
const HOUR_MS = 3600000;
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

const wantsReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* The front-of-house view. render() takes a world snapshot and diffs it against
   what is on screen: new bookings spring in, removed ones fade out, and a
   booking that overlaps an earlier one in the same room is flagged as a clash.
   It draws from plain objects, so it does not care which language changed the
   world. */
export function createTimetable(root, { day = '2026-01-01', reduceMotion } = {}) {
  const dayStart = Date.parse(`${day}T00:00:00Z`) + DAY_START_HOUR * HOUR_MS;
  const dayEnd = dayStart + DAY_HOURS * HOUR_MS;
  const known = new Map(); // booking id -> element currently live
  const tracks = new Map(); // room id -> track element
  const reduced = () => (reduceMotion !== undefined ? reduceMotion : wantsReducedMotion());
  root.classList.add('timetable');

  const ensureRow = (room) => {
    if (tracks.has(room.id)) return tracks.get(room.id);
    const row = document.createElement('div');
    row.className = 'tt-row';
    row.dataset.roomId = room.id;
    const label = document.createElement('div');
    label.className = 'tt-label';
    label.textContent = room.name;
    const track = document.createElement('div');
    track.className = 'tt-track';
    row.append(label, track);
    root.appendChild(row);
    tracks.set(room.id, track);
    return track;
  };

  const clashIds = (bookings) => {
    const flagged = new Set();
    const sorted = [...bookings].sort((a, b) => a.id - b.id);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = sorted[j];
        const b = sorted[i];
        if (a.room_id === b.room_id &&
            Date.parse(a.start_at) < Date.parse(b.end_at) &&
            Date.parse(b.start_at) < Date.parse(a.end_at)) flagged.add(b.id);
      }
    }
    return flagged;
  };

  const place = (el, b) => {
    const s = Math.max(Date.parse(b.start_at), dayStart);
    const e = Math.min(Date.parse(b.end_at), dayEnd);
    el.style.left = `${((s - dayStart) / (dayEnd - dayStart)) * 100}%`;
    el.style.width = `${(Math.max(e - s, 0) / (dayEnd - dayStart)) * 100}%`;
  };

  const inDay = (b) => Date.parse(b.end_at) > dayStart && Date.parse(b.start_at) < dayEnd;

  function render(objects) {
    const still = !reduced();
    for (const room of objects.rooms) ensureRow(room);
    const bookings = objects.bookings.filter(inDay);
    const clashes = clashIds(bookings);
    const wanted = new Set(bookings.map((b) => b.id));

    for (const [id, el] of [...known]) {
      if (wanted.has(id)) continue;
      known.delete(id); // gone from the model now, even while it fades
      if (!still) { el.remove(); continue; }
      el.classList.add('is-leaving');
      const anim = el.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.9)' }],
        { duration: 220, easing: 'ease-in', fill: 'forwards' });
      anim.finished.then(() => el.remove(), () => el.remove());
    }

    for (const b of bookings) {
      const track = tracks.get(b.room_id);
      if (!track) continue;
      let el = known.get(b.id);
      const isNew = !el;
      if (isNew) {
        el = document.createElement('div');
        el.className = 'tt-booking';
        el.dataset.bookingId = b.id;
        el.textContent = `#${b.id}`;
        known.set(b.id, el);
        track.appendChild(el);
      }
      place(el, b);
      const wasClash = el.classList.contains('is-clash');
      el.classList.toggle('is-clash', clashes.has(b.id));
      if (still && isNew) {
        el.classList.add('is-entering');
        const anim = el.animate(
          [{ opacity: 0, transform: 'translateY(-14px) scale(0.94)' }, { opacity: 1, transform: 'none' }],
          { duration: 320, easing: SPRING });
        anim.finished.then(() => el.classList.remove('is-entering'), () => el.classList.remove('is-entering'));
      }
      if (still && clashes.has(b.id) && !wasClash) {
        el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' },
          { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }], { duration: 360, easing: 'ease-out' });
      }
    }
  }

  return { render, destroy() { root.replaceChildren(); known.clear(); tracks.clear(); } };
}
```

- [ ] **Step 4: Append the timetable styles**

Append to `game/ui/theme.css`:

```css
.timetable { display: grid; gap: 6px; }
.tt-row { display: grid; grid-template-columns: 88px 1fr; gap: 10px; align-items: center; }
.tt-label { color: var(--muted); font-size: 14px; }
.tt-track {
  position: relative; height: 46px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background-image: repeating-linear-gradient(90deg, transparent 0, transparent calc(12.5% - 1px), var(--line) calc(12.5% - 1px), var(--line) 12.5%);
}
.tt-booking {
  position: absolute; top: 5px; bottom: 5px;
  display: grid; place-items: center;
  border-radius: 8px;
  background: linear-gradient(180deg, var(--gold), #b98a33);
  color: #2a1d07; font-size: 13px; font-weight: 600;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.35);
  transition: left 0.3s ease, width 0.3s ease, background-color 0.2s ease;
  overflow: hidden;
}
.tt-booking.is-clash {
  background: linear-gradient(180deg, #f07a6f, var(--danger));
  color: #2b0a07;
  outline: 2px solid rgba(226, 87, 76, 0.55);
  z-index: 2;
}
@media (prefers-reduced-motion: reduce) {
  .tt-booking { transition: none; }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node scripts/browser/test_game_timetable.mjs`
Expected: all checks `ok`, plus a `..` line with the 500-booking render time. If that render takes over about 100 ms, note it in Task 10 as a rendering-cost finding.

- [ ] **Step 6: Commit**

```bash
git add game/ui scripts/browser/test_game_timetable.mjs
git commit -m "feat: animated timetable with clash flagging, rapid-render safety and reduced motion"
```

---

### Task 8: The forgetting-curve meter

**Files:**
- Create: `game/memory/curve.js`, `game/memory/curve.test.mjs`, `game/memory/meter.js`, `game/memory/meter.test.mjs`, `scripts/browser/test_game_meter.mjs`

**Interfaces:**
- Produces: `INITIAL_STABILITY`, `THRESHOLDS`, `daysSince(lastMs, nowMs)`, `retrievability(elapsedDays, stabilityDays)`, `statusOf(r) -> 'fresh' | 'fading' | 'due'`, `reviewBy(lastMs, stabilityDays, threshold?) -> ms`, `nextStability(stabilityDays, outcome)` with `outcome` in `'clean' | 'assisted' | 'failed'`; `describeSkill({ name, lang, lastMs, stability }, nowMs) -> { line, status, r, curve }` where `line` is the plain-language sentence and `curve` is an SVG polyline `points` string; `renderMeter(el, model)`.

- [ ] **Step 1: Read the existing SM-2 code**

Run: `grep -n "sm2\|SM-2\|ease\|interval" index.html | cut -c1-180 | head -30`
The spec says the new memory builds on the existing SM-2 log. Note in Task 10 whether this exponential model should read the same review log, and what shape that log has. This task keeps the maths in pure functions so the model can be swapped without touching the UI.

- [ ] **Step 2: Write the failing maths tests**

Create `game/memory/curve.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_STABILITY, daysSince, retrievability, statusOf, reviewBy, nextStability,
} from './curve.js';

const DAY = 86400000;

test('daysSince counts whole days and never goes negative', () => {
  assert.equal(daysSince(0, 6 * DAY), 6);
  assert.equal(daysSince(0, DAY - 1), 0);
  assert.equal(daysSince(5 * DAY, 0), 0);
});

test('retrievability is 1 now and falls to 1/e after one stability', () => {
  assert.equal(retrievability(0, 10), 1);
  assert.ok(Math.abs(retrievability(10, 10) - Math.exp(-1)) < 1e-12);
});

test('statusOf uses the fresh and fading thresholds', () => {
  assert.equal(statusOf(0.9), 'fresh');
  assert.equal(statusOf(0.89), 'fading');
  assert.equal(statusOf(0.7), 'fading');
  assert.equal(statusOf(0.69), 'due');
});

test('reviewBy is the moment recall falls to the threshold', () => {
  const last = 1_000_000;
  const at = reviewBy(last, 10, 0.7);
  const elapsedDays = (at - last) / DAY;
  assert.ok(Math.abs(retrievability(elapsedDays, 10) - 0.7) < 1e-9);
});

test('nextStability: clean grows most, assisted grows a little, failed resets', () => {
  assert.equal(nextStability(2, 'clean'), 5);
  assert.ok(Math.abs(nextStability(2, 'assisted') - 2.4) < 1e-12);
  assert.equal(nextStability(8, 'failed'), INITIAL_STABILITY / 2);
  assert.ok(nextStability(4, 'assisted') < nextStability(4, 'clean'));
});

test('stability never drops below the initial floor after a failure', () => {
  assert.ok(nextStability(0.1, 'failed') >= INITIAL_STABILITY / 2);
});
```

Create `game/memory/meter.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { describeSkill } from './meter.js';

const DAY = 86400000;
const NOW = Date.UTC(2026, 8, 30); // 2026-09-30

test('a fading skill says when to review', () => {
  const m = describeSkill({ name: 'Overlap detection', lang: 'sql', lastMs: Date.UTC(2026, 8, 28), stability: 10 }, NOW);
  assert.equal(m.status, 'fading');
  assert.equal(m.line, 'last used 2 days ago · fading · review by 2026-10-01');
});

test('a due skill says review now', () => {
  const m = describeSkill({ name: 'Overlap detection', lang: 'sql', lastMs: Date.UTC(2026, 8, 24), stability: 10 }, NOW);
  assert.equal(m.status, 'due');
  assert.equal(m.line, 'last used 6 days ago · due now');
});

test('a skill used today is fresh and singular', () => {
  const m = describeSkill({ name: 'x', lang: 'sql', lastMs: NOW - 1000, stability: 10 }, NOW);
  assert.equal(m.status, 'fresh');
  assert.match(m.line, /^last used today · fresh · review by /);
  const one = describeSkill({ name: 'x', lang: 'sql', lastMs: NOW - DAY, stability: 100 }, NOW);
  assert.match(one.line, /^last used 1 day ago /);
});

test('the curve is a polyline that only falls', () => {
  const m = describeSkill({ name: 'x', lang: 'sql', lastMs: NOW, stability: 5 }, NOW);
  const ys = m.curve.split(' ').map((p) => Number(p.split(',')[1]));
  assert.ok(ys.length > 5);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] >= ys[i - 1]); // SVG y grows downwards
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `node --test game/memory/`
Expected: FAIL (`./curve.js` and `./meter.js` do not exist).

- [ ] **Step 4: Write the maths**

Create `game/memory/curve.js`:

```js
const DAY = 86400000;

/* Ebbinghaus-style forgetting: recall R = exp(-t / S), where t is the days since
   the skill was last used and S is its stability in days. A skill is "fresh"
   above 90% estimated recall, "fading" down to 70%, and "due" below that. */
export const INITIAL_STABILITY = 3;
export const THRESHOLDS = { fresh: 0.9, fading: 0.7 };

export const daysSince = (lastMs, nowMs) => Math.max(0, Math.floor((nowMs - lastMs) / DAY));

export const retrievability = (elapsedDays, stabilityDays) => Math.exp(-elapsedDays / stabilityDays);

export const statusOf = (r) => (r >= THRESHOLDS.fresh ? 'fresh' : r >= THRESHOLDS.fading ? 'fading' : 'due');

export const reviewBy = (lastMs, stabilityDays, threshold = THRESHOLDS.fading) =>
  lastMs + -Math.log(threshold) * stabilityDays * DAY;

/* A clean solve makes the memory last much longer; a solve that needed help
   makes it last a little longer; a failure resets it, so the skill returns soon. */
export function nextStability(stabilityDays, outcome) {
  if (outcome === 'clean') return stabilityDays * 2.5;
  if (outcome === 'assisted') return stabilityDays * 1.2;
  return INITIAL_STABILITY / 2;
}
```

- [ ] **Step 5: Write the meter**

Create `game/memory/meter.js`:

```js
import { daysSince, retrievability, statusOf, reviewBy } from './curve.js';

const DAY = 86400000;
const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);

/* Everything the learner sees about one skill, as plain data. */
export function describeSkill({ name, lang, lastMs, stability }, nowMs) {
  const days = daysSince(lastMs, nowMs);
  const r = retrievability((nowMs - lastMs) / DAY, stability);
  const status = statusOf(r);
  const ago = days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`;
  const line = status === 'due'
    ? `last used ${ago} · due now`
    : `last used ${ago} · ${status} · review by ${isoDate(reviewBy(lastMs, stability))}`;

  // The curve runs from the last use out to three stabilities, in a 120 x 40 box.
  const points = [];
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * 3 * stability;
    points.push(`${((i / 24) * 120).toFixed(1)},${((1 - retrievability(t, stability)) * 40).toFixed(1)}`);
  }
  return { name, lang, status, r, line, curve: points.join(' '),
           nowX: Math.min(120, ((nowMs - lastMs) / DAY / (3 * stability)) * 120) };
}

export function renderMeter(el, model) {
  el.className = `meter is-${model.status}`;
  el.innerHTML = `
    <div class="meter-name">${model.name} <span class="meter-lang">${model.lang}</span></div>
    <svg class="meter-curve" viewBox="0 0 120 40" role="img" aria-label="Estimated recall over time">
      <polyline points="${model.curve}" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="${model.nowX}" y1="0" x2="${model.nowX}" y2="40" stroke="currentColor" stroke-dasharray="3 3"/>
    </svg>
    <div class="meter-line">${model.line}</div>`;
}
```

- [ ] **Step 6: Run the maths tests to verify they pass**

Run: `node --test game/memory/`
Expected: all tests pass (pure, no browser).

- [ ] **Step 7: Write and run the browser test**

Create `scripts/browser/test_game_meter.mjs`:

```js
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame();
const r = await page.evaluate(async () => {
  const { describeSkill, renderMeter } = await import('/game/memory/meter.js');
  const el = document.createElement('div');
  document.body.appendChild(el);
  const now = Date.UTC(2026, 8, 30);
  renderMeter(el, describeSkill({ name: 'Overlap detection', lang: 'sql', lastMs: Date.UTC(2026, 8, 24), stability: 10 }, now));
  return { text: el.textContent.replace(/\s+/g, ' ').trim(), cls: el.className, points: el.querySelectorAll('polyline').length };
});
t.check('the meter shows the plain-language line', /last used 6 days ago · due now/.test(r.text), r.text);
t.check('the meter is marked due', r.cls.includes('is-due'), r.cls);
t.check('the meter draws a curve', r.points === 1, String(r.points));
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();
t.finish();
```

Append meter styles to `game/ui/theme.css`:

```css
.meter { display: grid; gap: 4px; padding: 12px; background: var(--paper); border: 1px solid var(--line); border-radius: var(--radius); }
.meter-name { font-weight: 600; }
.meter-lang { color: var(--muted); font-weight: 400; margin-left: 6px; text-transform: uppercase; font-size: 12px; }
.meter-curve { width: 100%; max-width: 240px; height: 48px; }
.meter-line { color: var(--muted); font-size: 14px; }
.meter.is-fresh { color: var(--ok); }
.meter.is-fading { color: var(--gold); }
.meter.is-due { color: var(--danger); }
.meter.is-due .meter-line { color: var(--danger); }
```

Run: `node scripts/browser/test_game_meter.mjs`
Expected: `4/4 passed`

- [ ] **Step 8: Commit**

```bash
git add game/memory scripts/browser/test_game_meter.mjs game/ui/theme.css
git commit -m "feat: forgetting-curve maths and a per-skill memory meter"
```

---

### Task 9: The playable slice

**Files:**
- Create: `scripts/browser/test_game_slice.mjs`
- Modify: `game/main.js` (replace), `game/ui/theme.css` (append)

**Interfaces:**
- Consumes: everything above.
- Produces: a page where the learner reads a one-line goal, sees the animated timetable, picks SQL, JS or PHP, writes code in a textarea, presses Run, and sees the world change and a result banner (`#result` with class `is-win`, `is-miss` or `is-error`). One demo memory meter is shown with demonstration values (the real skill log arrives in a later phase). A full code editor is out of scope for this phase.

- [ ] **Step 1: Write the failing test**

Create `scripts/browser/test_game_slice.mjs`:

```js
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const ready = (page) => page.waitForFunction(() => window.__game && window.__game.ready === true, null, { timeout: 30000 });
const run = async (page, lang, code) => {
  await page.locator(`[data-lang="${lang}"]`).click();
  await page.locator('#editor').fill(code);
  await page.locator('#run').click();
};

const { page, errors, close } = await openGame();
await ready(page);
t.check('the goal is shown', /double-booked/i.test(await page.locator('#goal').innerText()));
t.check('the clash is visible before any code runs', await page.locator('.tt-booking.is-clash').count() === 1);
t.check('a memory meter is shown', await page.locator('.meter').count() === 1);

await run(page, 'sql', 'DELETE FROM bookings;');
await page.waitForSelector('#result.is-miss, #result.is-win', { timeout: 15000 });
t.check('the cheat is not accepted', await page.locator('#result.is-miss').count() === 1, await page.locator('#result').innerText());

await run(page, 'sql', 'DELETE FROM bookings WHERE id = 21;');
await page.waitForSelector('#result.is-win, #result.is-miss', { timeout: 15000 });
t.check('a real fix is accepted', await page.locator('#result.is-win').count() === 1, await page.locator('#result').innerText());

await close();
{
  const g = await openGame();
  await ready(g.page);
  await run(g.page, 'js', 'world.bookings = world.bookings.filter((b) => b.id !== 21);');
  await g.page.waitForSelector('#result.is-win, #result.is-miss, #result.is-error', { timeout: 15000 });
  t.check('the same problem is solved in JavaScript', await g.page.locator('#result.is-win').count() === 1, await g.page.locator('#result').innerText());
  await run(g.page, 'sql', 'SELECT nonsense FROM nowhere;');
  await g.page.waitForSelector('#result.is-error', { timeout: 15000 });
  t.check('a SQL error is shown plainly', /nonsense|nowhere|does not exist/i.test(await g.page.locator('#result').innerText()));
  t.check('no page errors', g.errors.length === 0, g.errors.join(' | '));
  await g.close();
}
t.check('no page errors on first load', errors.length === 0, errors.join(' | '));
t.finish();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/browser/test_game_slice.mjs`
Expected: FAIL (`#goal` does not exist; the current `main.js` only sets a flag).

- [ ] **Step 3: Write the slice**

Replace `game/main.js`:

```js
import { toObjects } from './world/views.js';
import { runSolution } from './runners/index.js';
import { startProblem, gradeProblem } from './problems/check.js';
import { doubleBooking1 as problem } from './problems/double-booking-1.js';
import { createTimetable } from './ui/timetable.js';
import { describeSkill, renderMeter } from './memory/meter.js';
import { INITIAL_STABILITY } from './memory/curve.js';

const LANGS = { sql: 'SQL', js: 'JavaScript', php: 'PHP' };
const STARTERS = { sql: '-- write SQL here\n', js: '// `world.bookings` is an array. Change it, then run.\n', php: "// `$pdo` is connected to a SQLite copy of the world.\n" };

const app = document.getElementById('app');
app.innerHTML = `
  <header class="hud">
    <h1>Grimoire: Open for Business</h1>
    <div class="quest-title">${problem.title}</div>
  </header>
  <p id="goal" class="goal">${problem.goal}</p>
  <div id="timetable"></div>
  <div class="lang-tabs" role="tablist">
    ${problem.languages.map((l) => `<button role="tab" class="tab" data-lang="${l}">${LANGS[l]}</button>`).join('')}
  </div>
  <textarea id="editor" spellcheck="false" aria-label="Your code"></textarea>
  <div class="actions"><button id="run" class="run">Run</button><span id="note" class="note"></span></div>
  <div id="result" role="status" aria-live="polite"></div>
  <div id="meter"></div>`;

const $ = (id) => document.getElementById(id);
const tt = createTimetable($('timetable'));
let lang = 'sql';

function setLang(next) {
  lang = next;
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('is-active', b.dataset.lang === next));
  if (!$('editor').value.trim() || Object.values(STARTERS).includes($('editor').value)) $('editor').value = STARTERS[next];
  $('note').textContent = next === 'php' ? 'PHP works on a SQLite copy of the world; your changes are written back.' : '';
}

async function boot() {
  const world = await startProblem(problem);
  tt.render(await toObjects(world));
  // Demonstration values only: the real skill log arrives in a later phase.
  renderMeter($('meter'), describeSkill(
    { name: 'Overlap detection', lang: 'sql', lastMs: Date.now() - 2 * 86400000, stability: INITIAL_STABILITY * 3 }, Date.now()));
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  setLang('sql');

  $('run').addEventListener('click', async () => {
    const run = $('run');
    run.disabled = true;
    $('result').className = '';
    $('result').textContent = lang === 'php' ? 'Loading PHP, then running…' : 'Running…';
    const res = await runSolution(world, lang, $('editor').value);
    tt.render(await toObjects(world));
    if (!res.ok) {
      $('result').className = 'is-error';
      $('result').textContent = res.error;
    } else {
      const grade = await gradeProblem(world, problem);
      $('result').className = grade.passed ? 'is-win' : 'is-miss';
      $('result').textContent = grade.passed
        ? 'Solved. The room is clear.'
        : 'Not yet: ' + grade.results.filter((x) => !x.ok).map((x) => x.name).join(' · ');
    }
    run.disabled = false;
  });

  window.__game = { ready: true, phase: 1, world };
}

boot().catch((e) => {
  $('result').className = 'is-error';
  $('result').textContent = 'The game could not start: ' + e.message;
});
```

- [ ] **Step 4: Append the page styles**

Append to `game/ui/theme.css`:

```css
.hud { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.hud h1 { margin: 0; font-size: 20px; color: var(--gold); letter-spacing: 0.02em; }
.quest-title { color: var(--muted); }
.goal { font-size: 18px; margin: 12px 0 16px; }
.lang-tabs { display: flex; gap: 8px; margin: 16px 0 8px; }
.tab {
  padding: 8px 16px; border-radius: 999px; border: 1px solid var(--line);
  background: var(--paper); color: var(--muted); font: inherit; cursor: pointer;
  transition: background-color 0.15s, color 0.15s, transform 0.15s;
}
.tab:hover { color: var(--text); }
.tab.is-active { background: var(--gold); color: #2a1d07; border-color: var(--gold); }
#editor {
  width: 100%; min-height: 150px; padding: 12px; resize: vertical;
  background: #100d0b; color: var(--text); border: 1px solid var(--line); border-radius: var(--radius);
  font: 15px/1.5 ui-monospace, "Cascadia Code", Consolas, monospace;
}
#editor:focus-visible, .run:focus-visible, .tab:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.actions { display: flex; align-items: center; gap: 12px; margin: 10px 0; }
.run {
  padding: 10px 28px; border: 0; border-radius: 999px; cursor: pointer;
  background: var(--gold); color: #2a1d07; font: inherit; font-weight: 700;
  transition: transform 0.12s, filter 0.12s;
}
.run:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
.run:active:not(:disabled) { transform: translateY(1px); }
.run:disabled { opacity: 0.6; cursor: progress; }
.note { color: var(--muted); font-size: 14px; }
#result { min-height: 24px; margin: 8px 0 16px; padding: 0; border-radius: var(--radius); }
#result.is-win, #result.is-miss, #result.is-error { padding: 12px 14px; animation: pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1); }
#result.is-win { background: rgba(111, 191, 139, 0.16); color: var(--ok); border: 1px solid var(--ok); }
#result.is-miss { background: rgba(217, 164, 65, 0.14); color: var(--gold); border: 1px solid var(--gold-dim); }
#result.is-error { background: rgba(226, 87, 76, 0.14); color: var(--danger); border: 1px solid var(--danger); }
@keyframes pop { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  #result.is-win, #result.is-miss, #result.is-error { animation: none; }
  .tab, .run { transition: none; }
}
@media (max-width: 560px) {
  .tt-row { grid-template-columns: 64px 1fr; }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node scripts/browser/test_game_slice.mjs`
Expected: all checks `ok`.

- [ ] **Step 6: Play it yourself**

Open `http://127.0.0.1:8010/game/index.html` in a browser. Pick each language, fix the double booking, cheat, then make a deliberate error. Watch the timetable: the booking should slide in, the clash should shake and turn red, and a fix should make it fade away. Write down anything that feels flat, slow or confusing for Task 10; this is the visual-quality check the spec asks for.

- [ ] **Step 7: Commit**

```bash
git add game/main.js game/ui/theme.css scripts/browser/test_game_slice.mjs
git commit -m "feat: playable slice - fix a double-booked room in SQL, JavaScript or PHP"
```

---

### Task 10: Findings and go/no-go

**Files:**
- Create: `docs/superpowers/spikes/2026-09-30-phase1-results.md`

**Interfaces:**
- Consumes: the output of Tasks 3, 4, 5, 7, 8 and 9, and the play test.
- Produces: the decision that unlocks or reshapes Phase 2.

- [ ] **Step 1: Run every check in one go**

Run: `npm run test:game:pure` and then `npm run test:game`
Expected: all green. Any failure means a task is not done; fix it before recording findings.

- [ ] **Step 2: Write the results**

Create `docs/superpowers/spikes/2026-09-30-phase1-results.md` with these headings, filling every one from real output (paste the numbers; do not summarise from memory):

```markdown
# Phase 1 results (spikes and vertical slice)

## Spike 1: world sync
- Snapshot and restore work in PGlite 0.5.8: yes / no (exact error if no)
- 50,000 bookings: create ___ ms, snapshot ___ ms (___ MiB), restore ___ ms
- Slow clash query without an index ___ ms, with an index ___ ms
- Longest main-thread stall ___ ms -> PGlite on the main thread is acceptable / must move to PGliteWorker
- JavaScript round trip (objects in, objects back): works / issues
- PHP round trip through the SQLite mirror: works / issues; integer and timestamp fidelity
- PHP runtime load time ___ ms
- Can a runaway PHP script be interrupted? (spike_php_timeout output) and what index.html's existing runPhp does about it

## Spike 2: outcome grading
- Reference solutions pass in SQL / JavaScript / PHP: yes / no
- Alternate valid answers accepted: yes / no
- Cheats and empty code rejected: yes / no
- Half-failed SQL rolled back: yes / no
- Anything a learner could do that the checks would wrongly accept or reject

## Spike 3: animation and feel
- 500-booking render time ___ ms
- Reduced motion honoured: yes / no
- Play-test notes from Lawrence: what felt good, flat, slow or confusing

## Memory model
- What the existing SM-2 log looks like, and whether the exponential model should read from it or replace it

## Decision
- Go / go with changes / no-go for Phase 2, and the exact changes (for example: run the world in a PGliteWorker, run PHP in a terminable Worker)
- The list of Phase 2 plans to write next, in order
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/spikes
git commit -m "docs: Phase 1 spike results and Phase 2 go/no-go"
```

- [ ] **Step 4: Report to Lawrence**

Show the results file and the running slice, state plainly what passed and what did not, and ask for the go/no-go on Phase 2 before writing the next plan.

---

## Self-review

**Spec coverage.** Play loop and outcome grading: Task 6. The world and its persistence: Tasks 2 and 3. JavaScript and PHP views with write-back and the honest PHP limit: Tasks 4, 5 and 9 (the note in the UI). Animated front-of-house from a snapshot: Task 7. Memory meter with days since, fading and review-by, plus a curve: Task 8. Soft-gate review sessions, the director, generated problems, the Codex, the Playground, streaks and XP, and migrating old dungeons are Phase 2 onwards by design (see the scope note); this plan proves the risky foundations first, as the spec's build order says.

**Placeholders.** None: every code step contains the code. The only deliberately incomplete items are the Task 10 findings, which cannot be known until the spikes run. The demo meter values in Task 9 are labelled as demonstration data in the code.

**Type consistency.** `World.create/query/exec/count/snapshot/restore`, `toObjects/applyObjects/TABLES`, `runJs`, `createPhpRunner().run`, `runSolution`, `startProblem/gradeProblem/NO_OVERLAP_SQL`, `createTimetable().render`, and `describeSkill/renderMeter` are used with the same names and shapes in every task that consumes them. Timestamps are ISO-8601 UTC strings across the JS, PHP and timetable boundaries.

**Review Focus.** Runaway JavaScript (Task 4) and PHP (Task 5, measured), a half-failed SQL script, empty code, and the delete-everything cheat (Task 6), and rapid re-renders and reduced motion (Task 7) each have a test in the task named above.
