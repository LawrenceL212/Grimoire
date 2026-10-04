/* Spike SP1 (product arc, section 6): can the learner's own CREATE TABLE run in the live PGlite world, be read
   back from the catalogue, be probed inside BEGIN ... ROLLBACK without disturbing his state, be logged and
   replayed into a shadow PGlite identically, and how big is the dump? Throwaway: prints findings, no asserts. */
import { openGame } from './game_lib.mjs';

const { page, errors, close } = await openGame('library.html');
const out = await page.evaluate(async () => {
  const { PGlite } = await import('https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.8/dist/index.js');
  const R = {};
  const mk = async () => { const db = new PGlite(); await db.waitReady; await db.exec("SET TIME ZONE 'UTC'"); return db; };
  const t0 = performance.now();
  const db = await mk();
  R.bootMs = Math.round(performance.now() - t0);
  const log = [];
  const run = async (sql) => { await db.exec(sql); log.push(sql); };
  // 1. learner DDL in the live world
  await run('CREATE TABLE rooms (id SERIAL PRIMARY KEY, name TEXT NOT NULL, capacity INTEGER CHECK (capacity > 0));');
  await run("INSERT INTO rooms (name, capacity) VALUES ('Boardroom', 8), ('Studio', 4), ('Library', 12);");
  // 2. introspection
  R.columns = (await db.query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rooms' ORDER BY ordinal_position")).rows;
  R.constraints = (await db.query("SELECT conname, contype, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'public.rooms'::regclass ORDER BY conname")).rows;
  // 3. probes inside BEGIN ... ROLLBACK
  const seqBefore = (await db.query("SELECT last_value, is_called FROM rooms_id_seq")).rows[0];
  const rowsBefore = (await db.query('SELECT * FROM rooms ORDER BY id')).rows;
  await db.exec('BEGIN');
  await db.exec("INSERT INTO rooms (name, capacity) VALUES ('A', 10), ('B', 8), ('C', 6)");
  R.probeRows = (await db.query('SELECT name FROM rooms WHERE capacity >= 7 ORDER BY name')).rows.map((r) => r.name);
  let err = null;
  try { await db.exec("INSERT INTO rooms (name, capacity) VALUES ('Z', 0)"); } catch (e) { err = { code: e.code, message: e.message }; }
  R.probeError = err;
  try { await db.query('SELECT 1'); R.afterErrorUsable = true; } catch (e) { R.afterErrorUsable = `aborted: ${e.code}`; }
  await db.exec('ROLLBACK');
  const seqAfter = (await db.query("SELECT last_value, is_called FROM rooms_id_seq")).rows[0];
  R.rowsUnchanged = JSON.stringify((await db.query('SELECT * FROM rooms ORDER BY id')).rows) === JSON.stringify(rowsBefore);
  R.sequenceBefore = seqBefore; R.sequenceAfterRollback = seqAfter;
  // savepoint per probe statement keeps the transaction usable after an expected error
  await db.exec('BEGIN'); await db.exec('SAVEPOINT p');
  try { await db.exec("INSERT INTO rooms (name, capacity) VALUES ('Z', 0)"); } catch { /* expected */ }
  await db.exec('ROLLBACK TO SAVEPOINT p');
  R.savepointRecovers = (await db.query('SELECT count(*)::int AS n FROM rooms')).rows[0].n === 3;
  await db.exec('ROLLBACK');
  // restore the sequences after a probe
  const seqs = (await db.query("SELECT schemaname, sequencename, last_value FROM pg_sequences WHERE schemaname = 'public'")).rows;
  R.pgSequences = seqs;
  // 4. TEXT capacity cheat
  await db.exec('CREATE TABLE rooms_t (id SERIAL PRIMARY KEY, name TEXT, capacity TEXT)');
  await db.exec('BEGIN');
  await db.exec("INSERT INTO rooms_t (name, capacity) VALUES ('A', 10), ('B', 8), ('C', 6)");
  try { R.textCheat = (await db.query("SELECT name FROM rooms_t WHERE capacity >= '7' ORDER BY name")).rows.map((r) => r.name); } catch (e) { R.textCheat = e.message; }
  try { R.textCheatNumber = (await db.query('SELECT name FROM rooms_t WHERE capacity >= 7 ORDER BY name')).rows.map((r) => r.name); } catch (e) { R.textCheatNumber = `${e.code} ${e.message}`; }
  await db.exec('ROLLBACK');
  await db.exec('DROP TABLE rooms_t');
  log.push('CREATE TABLE rooms_t (id SERIAL PRIMARY KEY, name TEXT, capacity TEXT)', 'DROP TABLE rooms_t');
  // 5. replay the DDL into a shadow
  const fp = async (d) => JSON.stringify({
    cols: (await d.query("SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position")).rows,
    cons: (await d.query("SELECT conrelid::regclass::text AS t, contype, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY 1, 3")).rows,
  });
  const ddl = log.filter((s) => /^\s*(create|alter|drop)\b/i.test(s));
  const t1 = performance.now();
  const shadow = await mk();
  for (const s of ddl) await shadow.exec(s);
  R.shadowMs = Math.round(performance.now() - t1);
  R.shadowSameCatalogue = (await fp(db)) === (await fp(shadow));
  R.shadowRows = (await shadow.query('SELECT count(*)::int AS n FROM rooms')).rows[0].n;
  // full replay (DDL + data) gives the same rows and ids
  const full = await mk();
  for (const s of log) await full.exec(s);
  R.fullReplaySameRows = JSON.stringify((await full.query('SELECT * FROM rooms ORDER BY id')).rows) === JSON.stringify((await db.query('SELECT * FROM rooms ORDER BY id')).rows);
  // 6. dump sizes
  const empty = await mk();
  R.dumpEmptyKB = Math.round((await empty.dumpDataDir('gzip')).size / 1024);
  R.dumpRoomsKB = Math.round((await db.dumpDataDir('gzip')).size / 1024);
  await db.exec("CREATE TABLE bookings (id SERIAL PRIMARY KEY, room_id INTEGER REFERENCES rooms(id), start_at TIMESTAMPTZ, end_at TIMESTAMPTZ)");
  await db.exec("INSERT INTO bookings (room_id, start_at, end_at) SELECT 1 + g % 3, TIMESTAMPTZ '2026-01-01' + g * interval '1 hour', TIMESTAMPTZ '2026-01-01' + (g + 1) * interval '1 hour' FROM generate_series(1, 50000) g");
  const t2 = performance.now();
  const blob = await db.dumpDataDir('gzip');
  R.dump50kKB = Math.round(blob.size / 1024); R.dump50kMs = Math.round(performance.now() - t2);
  const t3 = performance.now();
  const back = new PGlite({ loadDataDir: blob }); await back.waitReady;
  R.restore50kMs = Math.round(performance.now() - t3);
  R.restored50k = (await back.query('SELECT count(*)::int AS n FROM bookings')).rows[0].n;
  return R;
});
console.log(JSON.stringify(out, null, 1));
console.log('page errors:', errors.length ? errors.join(' | ') : 'none');
await close();
