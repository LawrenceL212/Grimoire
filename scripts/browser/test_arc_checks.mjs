/* The product arc's checks against a real PostgreSQL (PGlite in Chromium): S1's and S2's acceptance (schema read
   from the catalogue, probes inside a rolled-back transaction) passes every valid table and fails every cheat, in
   plain words; a probe never changes his rows or his next id; and his world comes back from the change log alone
   (rebuild), with a shadow built from the DDL log. The pure parts are in game/problems/arc/arc.test.mjs. */
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame('library.html');
const out = await page.evaluate(async () => {
  const { World } = await import('/game/world/world.js');
  const C = await import('/game/problems/card.js');
  const L = await import('/game/world/ddl-log.js');
  const { toObjects } = await import('/game/world/views.js');
  const { S1 } = await import('/game/problems/arc/s1.js');
  const { S2 } = await import('/game/problems/arc/s2.js');
  const R = {};
  const grade = async (world, card, i) => { const g = await C.gradeStep(card, card.steps[i], { world, act: {} }); return { passed: g.passed, why: g.results.filter((x) => !x.ok).map((x) => x.why) }; };
  const empty = await World.create({ empty: true });
  R.emptyTables = await empty.tables();
  R.emptyObjects = await toObjects(empty);
  // S1: each table his, graded on his world (step 3), from scratch
  const tryS1 = async (sql) => {
    const w = await World.create({}, { empty: true });
    const ran = await C.runSql(w, sql);
    const g = ran.ok ? await grade(w, S1, 2) : { passed: false, why: [ran.error] };
    await w.close();
    return g;
  };
  R.s1 = {};
  for (const [k, sql] of Object.entries({
    reference: S1.reference[2].code,
    identity: 'CREATE TABLE rooms (id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, title VARCHAR(60) NOT NULL, seats SMALLINT CHECK (seats > 0), floor INTEGER NOT NULL);',
    extraColumns: 'CREATE TABLE rooms (id SERIAL PRIMARY KEY, name TEXT, description TEXT, capacity INTEGER);',
    numeric: 'CREATE TABLE rooms (id SERIAL PRIMARY KEY, name TEXT, capacity NUMERIC);',
    cheatText: S1.cheats[0].code,
    cheatNoKey: S1.cheats[1].code,
    tooShortName: 'CREATE TABLE rooms (id SERIAL PRIMARY KEY, name VARCHAR(3), capacity INTEGER);',
    unnamedSeats: 'CREATE TABLE rooms (id SERIAL PRIMARY KEY, name TEXT, cap TEXT);',
    wrongTable: 'CREATE TABLE room (id SERIAL PRIMARY KEY, name TEXT, capacity INTEGER);',
  })) R.s1[k] = await tryS1(sql);
  // a probe changes nothing of his: rows, and the next id
  const w = await World.create({ empty: true });
  await C.runSql(w, S1.reference[2].code);
  await C.runSql(w, "INSERT INTO rooms (name, capacity) VALUES ('Mine', 3);");
  const before = JSON.stringify(await w.query('SELECT * FROM rooms ORDER BY id'));
  const g = await grade(w, S1, 2);
  R.probeOnRowsPassed = g.passed;
  R.rowsUnchanged = JSON.stringify(await w.query('SELECT * FROM rooms ORDER BY id')) === before;
  await C.runSql(w, "INSERT INTO rooms (name, capacity) VALUES ('Next', 5);");
  R.nextId = (await w.query("SELECT id FROM rooms WHERE name = 'Next'"))[0].id;
  await w.close();
  // S2 on his own S1 table, with a log as the page keeps it
  let log = [];
  const his = await World.create({ empty: true });
  const run = async (sql) => { const r = await C.runSql(his, sql); if (r.ok) log = L.append(log, sql, { card: 'S' }); return r; };
  await run('CREATE TABLE rooms (id SERIAL PRIMARY KEY, title TEXT NOT NULL, seats INTEGER NOT NULL);');
  const mark = log.length;
  R.s2 = {};
  await run("INSERT INTO rooms (title, seats) VALUES ('Boardroom', 8), ('Studio', 4), ('Library', 12);");
  await run("INSERT INTO rooms (title, seats) VALUES ('Boardroom', 8), ('Studio', 4), ('Library', 12);");
  R.s2.twice = await grade(his, S2, 0);
  await run('DELETE FROM rooms WHERE id > 3;');
  R.s2.afterDelete = await grade(his, S2, 0);
  R.objects = (await toObjects(his)).rooms;
  // the world from the log alone
  const rebuilt = await L.rebuild(World, log);
  R.rebuild = { ok: rebuilt.ok, applied: rebuilt.applied, entries: log.length, sameRows: JSON.stringify(await rebuilt.world.query('SELECT * FROM rooms ORDER BY id')) === JSON.stringify(await his.query('SELECT * FROM rooms ORDER BY id')) };
  await C.runSql(rebuilt.world, "INSERT INTO rooms (title, seats) VALUES ('Garden', 6);");
  await C.runSql(his, "INSERT INTO rooms (title, seats) VALUES ('Garden', 6);");
  R.rebuild.sameNextId = (await rebuilt.world.query("SELECT id FROM rooms WHERE title = 'Garden'"))[0].id === (await his.query("SELECT id FROM rooms WHERE title = 'Garden'"))[0].id;
  const back = await L.rebuild(World, L.upTo(log, mark));
  R.resetToMark = { tables: await back.world.tables(), rows: await back.world.count('rooms') };
  const shadow = await L.shadowFromDdl(World, log);
  R.shadow = { tables: await shadow.tables(), rows: await shadow.count('rooms'), passesSchema: (await C.checkSchema(shadow, { table: 'rooms', roles: 'room' })).ok };
  const broken = await L.rebuild(World, [...log, { sql: 'INSERT INTO nowhere VALUES (1);', ddl: false }]);
  R.brokenReplay = { ok: broken.ok, applied: broken.applied, at: broken.at, error: broken.error };
  return R;
});
t.check('an empty world has no tables at all (no seed)', out.emptyTables.length === 0, JSON.stringify(out.emptyTables));
t.check('an empty world reads as no rooms, people or bookings', JSON.stringify(out.emptyObjects) === '{"rooms":[],"people":[],"bookings":[]}', JSON.stringify(out.emptyObjects));
t.check('S1: the reference table passes', out.s1.reference.passed, JSON.stringify(out.s1.reference));
for (const k of ['identity', 'extraColumns', 'numeric']) t.check(`S1: a different valid table passes (${k})`, out.s1[k].passed, JSON.stringify(out.s1[k]));
t.check('S1 cheat: capacity TEXT fails, "10 was treated as words, not a number"', !out.s1.cheatText.passed && out.s1.cheatText.why.some((w) => /10 was treated as words, not a number/.test(w)), JSON.stringify(out.s1.cheatText));
t.check('S1 cheat: no key column fails, naming the convention', !out.s1.cheatNoKey.passed && out.s1.cheatNoKey.why.some((w) => /primary key column called id/.test(w)), JSON.stringify(out.s1.cheatNoKey));
t.check('S1: a name column too short for "Boardroom" fails with the database\'s reason', !out.s1.tooShortName.passed && out.s1.tooShortName.why.some((w) => /Boardroom/.test(w) && /too long/.test(w)), JSON.stringify(out.s1.tooShortName));
t.check('S1: no column for the seats fails in plain words', !out.s1.unnamedSeats.passed && out.s1.unnamedSeats.why.some((w) => /how many people fit/.test(w)), JSON.stringify(out.s1.unnamedSeats));
t.check('S1: the wrong table name fails (the house convention: rooms)', !out.s1.wrongTable.passed && out.s1.wrongTable.why.some((w) => /no table called rooms/.test(w)), JSON.stringify(out.s1.wrongTable));
t.check('a probe on a table that has his rows still passes (his rows are set aside inside the transaction)', out.probeOnRowsPassed);
t.check('a probe leaves his rows exactly as they were', out.rowsUnchanged);
t.check('a probe does not move his next id (sequences put back after the rollback)', out.nextId === 2, String(out.nextId));
t.check("S2 cheat: the rooms put in twice fails in Priya's words", !out.s2.twice.passed && out.s2.twice.why.includes('Priya counts 6 rooms in the table; she has 3'), JSON.stringify(out.s2.twice));
t.check('S2: fixed with DELETE, it passes (his columns are title and seats)', out.s2.afterDelete.passed, JSON.stringify(out.s2.afterDelete));
t.check('the office reads his rooms through his own column names', JSON.stringify(out.objects) === JSON.stringify([{ id: 1, name: 'Boardroom', capacity: 8 }, { id: 2, name: 'Studio', capacity: 4 }, { id: 3, name: 'Library', capacity: 12 }]), JSON.stringify(out.objects));
t.check('restore: the world rebuilt from the change log has the same rows and ids', out.rebuild.ok && out.rebuild.applied === out.rebuild.entries && out.rebuild.sameRows, JSON.stringify(out.rebuild));
t.check('restore: and the same next id', out.rebuild.sameNextId);
t.check('Reset: the log up to the ticket\'s mark gives the table and no rows', JSON.stringify(out.resetToMark) === '{"tables":["rooms"],"rows":0}', JSON.stringify(out.resetToMark));
t.check('the shadow world from the DDL log has his tables and none of his rows', JSON.stringify(out.shadow) === '{"tables":["rooms"],"rows":0,"passesSchema":true}', JSON.stringify(out.shadow));
t.check('a log that cannot be replayed says where it stopped, and why', !out.brokenReplay.ok && out.brokenReplay.at === 4 && /nowhere/.test(out.brokenReplay.error), JSON.stringify(out.brokenReplay));
// ---- the rooms_pkey report (M-B): the probe's own test rows must never collide with his ids, whatever his key
const pk = await page.evaluate(async () => {
  const { World } = await import('/game/world/world.js');
  const C = await import('/game/problems/card.js');
  const { S1 } = await import('/game/problems/arc/s1.js');
  const R = {};
  const tables = {
    lawrence: 'Create TABLE if not exists Rooms(id int PRIMARY KEY, room TEXT, seats INT)', // his exact statement: no default on id
    serial: 'CREATE TABLE rooms (id SERIAL PRIMARY KEY, room TEXT, seats INT);',
    identityAlways: 'CREATE TABLE rooms (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, room TEXT, seats INT);',
    serialName: 'CREATE TABLE rooms (id SERIAL PRIMARY KEY, name TEXT, seats INT);',
  };
  for (const [k, sql] of Object.entries(tables)) {
    for (const withRows of [false, true]) {
      const w = await World.create({}, { empty: true });
      await C.runSql(w, sql);
      // the table already made in an earlier step, with his rooms 1-3 in it (given by hand when id has no default)
      if (withRows) await C.runSql(w, k === 'identityAlways' ? "INSERT INTO rooms (room, seats) VALUES ('Boardroom', 8), ('Studio', 4), ('Library', 12);"
        : `INSERT INTO rooms (id, ${k === 'serialName' ? 'name' : 'room'}, seats) VALUES (1, 'Boardroom', 8), (2, 'Studio', 4), (3, 'Library', 12);`);
      const before = JSON.stringify(await w.query('SELECT * FROM rooms ORDER BY id'));
      const g = await C.gradeStep(S1, S1.steps[2], { world: w, act: {} });
      R[`${k}${withRows ? '+rows' : ''}`] = { passed: g.passed, why: g.results.filter((x) => !x.ok).map((x) => x.why), unchanged: JSON.stringify(await w.query('SELECT * FROM rooms ORDER BY id')) === before };
      await w.close();
    }
  }
  // a real refusal (a CHECK of his) is said in plain words, the database's words last
  const w = await World.create({}, { empty: true });
  await C.runSql(w, 'CREATE TABLE rooms (id SERIAL PRIMARY KEY, name TEXT, capacity INT CHECK (capacity < 5));');
  const g = await C.gradeStep(S1, S1.steps[2], { world: w, act: {} });
  R.refused = g.results.filter((x) => !x.ok).map((x) => x.why)[0];
  return R;
});
for (const [k, v] of Object.entries(pk)) if (k !== 'refused') t.check(`S1 passes his valid table (${k}): the probe picks its own ids above his`, v.passed && v.unchanged, JSON.stringify(v));
t.check('a table his rule refuses is told in plain words first, the database last', /^To check your rooms table, the game tried to save a test Boardroom/.test(pk.refused) && /CHECK rules refused/.test(pk.refused) && /The database said: "/.test(pk.refused), pk.refused);

// ---- M-B: a card resolved by his names, graded on his world AND his shadow (built from his change log)
const s3 = await page.evaluate(async () => {
  const { World } = await import('/game/world/world.js');
  const C = await import('/game/problems/card.js');
  const L = await import('/game/world/ddl-log.js');
  const { cardById } = await import('/game/problems/ladder.js');
  let log = [];
  for (const sql of ['CREATE TABLE rooms (id int PRIMARY KEY, title VARCHAR(40) NOT NULL, seats SMALLINT NOT NULL);',
    "INSERT INTO rooms VALUES (11, 'boardroom', 8), (12, 'Studio', 4), (13, 'Library', 12);",
    "UPDATE rooms SET seats = 10 WHERE title = 'boardroom';", "INSERT INTO rooms VALUES (14, 'Garden Room', 6);"]) log = L.append(log, sql);
  const { world } = await L.rebuild(World, log);
  const shadow = await C.startArcShadow(log);
  const R = { shadowRows: await shadow.query('SELECT * FROM rooms ORDER BY id'), realRows: await world.query('SELECT * FROM rooms ORDER BY id') };
  const names = await C.namesOf(world);
  const grade = async (id, code) => {
    const card = C.resolveCard(cardById(id), names).card;
    const s = card.steps[0];
    const truths = await C.truthsOf(world, s);
    const res = await C.runQuestionSql(world, code === 'ref' ? card.reference[0].code : code === 'cheat' ? card.cheats[0].code : code);
    const g = await C.gradeStep(card, s, { world, shadow, lang: 'sql', code: code === 'ref' ? card.reference[0].code : card.cheats[0].code, res, truths, act: {} });
    return { passed: g.passed, where: g.results.filter((x) => !x.ok).map((x) => x.where), code: code === 'ref' ? card.reference[0].code : card.cheats[0].code };
  };
  for (const id of ['T02', 'T03', 'T08', 'T10']) R[id] = { ref: await grade(id, 'ref'), cheat: await grade(id, 'cheat') };
  R.after = JSON.stringify(await world.query('SELECT * FROM rooms ORDER BY id')) === JSON.stringify(R.realRows);
  return R;
});
t.check("his shadow keeps his ids and names, changes the seats, adds two rooms (his own key without a default)", JSON.stringify(s3.shadowRows.map((r) => [r.id, r.title, r.seats])) === '[[11,"boardroom",12],[12,"Studio",7],[13,"Library",4],[14,"Garden Room",9],[15,"Attic",3],[16,"Loft",16]]', JSON.stringify(s3.shadowRows));
for (const id of ['T02', 'T03', 'T08', 'T10']) {
  t.check(`${id} on his own columns (title, seats): the resolved reference passes on both worlds`, s3[id].ref.passed, JSON.stringify(s3[id].ref));
  t.check(`${id}: its cheat fails`, !s3[id].cheat.passed, JSON.stringify(s3[id].cheat));
}
t.check('T10 "more than 7" passes his world and is caught on his shadow (the 7-seater)', s3.T10.cheat.where.every((w) => w === 'shadow'), JSON.stringify(s3.T10.cheat));
t.check('questions changed nothing of his', s3.after);
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();
t.finish();
