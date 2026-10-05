/* The product arc's checks against a real PostgreSQL (PGlite in Chromium): S1's and S2's acceptance (schema read
   from the catalogue, probes inside a rolled-back transaction) passes every valid table and fails every cheat, in
   plain words; a probe never changes his rows or his next id; and his world comes back from the change log alone
   (rebuild), with a shadow built from the DDL log. Milestone M-C: S4's tables (valid ones pass, the TEXT, DATE and
   misnamed-link cheats fail), S5 in both branches with Priya's script on arrival, Tom's import with and without a
   CHECK, the kept cards on the imported week (and their shadow traps), T21's morning booking, and the replay. The
   pure parts are in game/problems/arc/arc.test.mjs and s4s6.test.mjs. */
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
// ---- M-C: S4 (people and bookings), S5 (the foreign key, both branches), S6 (Tom's import) on real PostgreSQL
const mc = await page.evaluate(async () => {
  const { World } = await import('/game/world/world.js');
  const C = await import('/game/problems/card.js');
  const L = await import('/game/world/ddl-log.js');
  const SC = await import('/game/problems/arc/scripts.js');
  const { readCatalogue } = await import('/game/world/catalogue.js');
  const { toObjects } = await import('/game/world/views.js');
  const { cardById } = await import('/game/problems/ladder.js');
  const R = {};
  const ROOMS = ['CREATE TABLE rooms (id SERIAL PRIMARY KEY, name TEXT NOT NULL, capacity INTEGER NOT NULL);', "INSERT INTO rooms (name, capacity) VALUES ('Boardroom', 8), ('Studio', 4), ('Library', 12);",
    "UPDATE rooms SET capacity = 10 WHERE name = 'Boardroom';", "INSERT INTO rooms (name, capacity) VALUES ('Garden Room', 6);"];
  const logOf = (sqls, log = []) => sqls.reduce((l, s) => L.append(l, s), log);
  const why = (g) => g.results.filter((x) => !x.ok).map((x) => x.why);
  // S4: graded on his world after S3, from his own statement
  const S4 = cardById('S4');
  const tryS4 = async (sql) => {
    const { world } = await L.rebuild(World, logOf(ROOMS));
    const ran = await C.runSql(world, sql);
    const before = JSON.stringify(await toObjects(world));
    const g = ran.ok ? await C.gradeStep(S4, S4.steps[0], { world, act: {} }) : { passed: false, results: [{ ok: false, why: ran.error }] };
    const out = { passed: g.passed, why: why(g), unchanged: JSON.stringify(await toObjects(world)) === before };
    await world.close();
    return out;
  };
  R.s4 = {};
  for (const [k, sql] of Object.entries({
    reference: S4.reference[0].code,
    noZone: 'CREATE TABLE people (id SERIAL PRIMARY KEY, name TEXT);\nCREATE TABLE bookings (id SERIAL PRIMARY KEY, room_id INTEGER, person_id INTEGER, start_at TIMESTAMP, end_at TIMESTAMP);',
    linked: 'CREATE TABLE people (id SERIAL PRIMARY KEY, name TEXT NOT NULL);\nCREATE TABLE bookings (id SERIAL PRIMARY KEY, room_id INTEGER NOT NULL REFERENCES rooms(id), person_id INTEGER NOT NULL REFERENCES people(id), start_at TIMESTAMPTZ NOT NULL, end_at TIMESTAMPTZ NOT NULL, CHECK (end_at > start_at));',
    ownNames: "CREATE TABLE people (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, full_name VARCHAR(80) NOT NULL, email TEXT NOT NULL, joined DATE DEFAULT '2026-01-01');\nCREATE TABLE bookings (id int PRIMARY KEY, room_id INT NOT NULL, person_id INT NOT NULL, start_at TIMESTAMPTZ NOT NULL, end_at TIMESTAMPTZ NOT NULL, notes TEXT NOT NULL);",
    ...Object.fromEntries(S4.cheats.map((c, i) => [`cheat${i}`, c.code])),
  })) R.s4[k] = await tryS4(sql);

  // S5 and S6 as the chapter plays them: the colleague's script on arrival, the variant, the baseline, then his run
  const arrive = async (world, log, id, card) => {
    const s = SC.buildScript(id, await readCatalogue(world));
    const res = await SC.runScript(world, s);
    const sql = SC.loggedSql(s, res);
    return { log: sql ? L.append(log, sql, { card, by: s.by }) : log, verdicts: s.lines.map((l, i) => [l.label, SC.lineVerdict(l, res[i])]) };
  };
  const play = async (log, card0, code, answer = null) => {
    const { world } = await L.rebuild(World, log);
    const cat = await readCatalogue(world);
    const v = C.variantFor(card0, cat);
    const card = C.resolveCard(v ? C.withVariant(card0, v) : card0, await C.namesOf(world)).card;
    const baseline = await C.baselineOf(world, card.steps);
    const resolved = code ? C.resolveCard({ x: code }, await C.namesOf(world)).card.x : null;
    const ran = resolved ? await C.runSql(world, resolved) : { ok: true };
    const g = ran.ok ? await C.gradeStep(card, card.steps[0], { world, baseline, act: { reply: answer } }) : { passed: false, results: [{ ok: false, why: ran.error }] };
    const out = { variant: v, passed: g.passed, why: why(g), log: ran.ok && resolved ? L.append(log, resolved) : log };
    await world.close();
    return out;
  };
  const S5 = cardById('S5');
  // the branch without a link: Priya's room-7 slip goes in
  let log = logOf([...ROOMS, S4.reference[0].code]);
  let w = (await L.rebuild(World, log)).world;
  const paper = await arrive(w, log, 'paper', 'S5');
  await w.close();
  log = paper.log;
  R.paper = { verdicts: paper.verdicts, by: log.at(-1).by };
  R.s5 = { reference: await play(log, S5, S5.reference[0].code) };
  for (const [i, c] of S5.cheats.entries()) R.s5[`cheat${i}`] = await play(log, S5, c.code);
  R.s5.deleteThenLink = await play(log, S5, 'DELETE FROM bookings WHERE room_id = 7;\nALTER TABLE bookings ADD FOREIGN KEY (room_id) REFERENCES rooms(id);');
  R.s5.linkFirst = await play(log, S5, 'ALTER TABLE bookings ADD FOREIGN KEY (room_id) REFERENCES rooms(id);');
  const afterS5 = R.s5.reference.log;
  // the branch with a link already (his S4 table had REFERENCES): the slip is refused, the ticket is a reply
  let logL = logOf([...ROOMS, R.s4 && 'CREATE TABLE people (id SERIAL PRIMARY KEY, name TEXT NOT NULL);\nCREATE TABLE bookings (id SERIAL PRIMARY KEY, room_id INTEGER NOT NULL REFERENCES rooms(id), person_id INTEGER NOT NULL REFERENCES people(id), start_at TIMESTAMPTZ NOT NULL, end_at TIMESTAMPTZ NOT NULL, CHECK (end_at > start_at));']);
  w = (await L.rebuild(World, logL)).world;
  const paperL = await arrive(w, logL, 'paper', 'S5');
  R.linkedRows = await w.count('bookings');
  await w.close();
  logL = paperL.log;
  R.paperLinked = paperL.verdicts.filter((v) => /^refused/.test(v[1]));
  R.s5L = { right: await play(logL, S5, null, 'link'), broken: await play(logL, S5, null, 'broken') };
  // S6: Tom's import through each world
  const imp = async (lg) => { const x = (await L.rebuild(World, lg)).world; const a = await arrive(x, lg, 'import', 'S6'); const n = await x.count('bookings'); await x.close(); return { ...a, n }; };
  const i1 = await imp(afterS5), i2 = await imp(logL);
  R.imp = { plain: i1.verdicts.filter((v) => !/^(went in|already there)$/.test(v[1])), linked: i2.verdicts.filter((v) => !/^(went in|already there)$/.test(v[1])), n: [i1.n, i2.n] };
  // the kept cards on the imported week: T13, T16, T21 (references pass, cheats fail; T16's cheat only on his shadow)
  const full = i1.log;
  const { world: fw } = await L.rebuild(World, full);
  R.objects = await toObjects(fw);
  const shadow = await C.startArcShadow(full);
  R.shadowCounts = { people: await shadow.count('people'), bookings: await shadow.count('bookings') };
  const names = await C.namesOf(fw);
  const q = async (id, code) => {
    const card = C.resolveCard(cardById(id), names).card, s = card.steps[0], c = C.resolveCard({ x: code }, names).card.x;
    const truths = await C.truthsOf(fw, s);
    const res = await C.runQuestionSql(fw, c);
    const g = await C.gradeStep(card, s, { world: fw, shadow, lang: 'sql', code: c, res, truths, act: {} });
    return { passed: g.passed, where: g.results.filter((x) => !x.ok).map((x) => x.where), why: why(g) };
  };
  for (const id of ['T14', 'T16', 'T17', 'T19']) { const c = cardById(id); R[id] = { ref: await q(id, c.reference[0].code), cheat: await q(id, c.cheats[0].code) }; }
  R.T18 = { ref: await q('T18', cardById('T18').reference[0].code), cheat: await q('T18', cardById('T18').cheats[0].code) };
  await fw.close();
  const t13 = cardById('T13');
  R.T13 = { ref: await play(full, t13, t13.reference[0].code), cheat: await play(full, t13, t13.cheats[0].code) };
  // T21: Priya's morning booking arrives, then the clash is fixed
  const { world: cw } = await L.rebuild(World, full);
  const clash = await arrive(cw, full, 'clash', 'T21');
  await cw.close();
  const t21 = cardById('T21');
  R.T21 = { arrived: clash.verdicts, ref: await play(clash.log, t21, t21.reference[0].code), older: await play(clash.log, t21, t21.cheats[1].code), move: await play(clash.log, t21, t21.alternates[0].code) };
  // the world from his log alone (scripts included) is the same
  const a = (await L.rebuild(World, full)).world, b = (await L.rebuild(World, full)).world;
  R.replaySame = JSON.stringify(await toObjects(a)) === JSON.stringify(await toObjects(b)) && (await a.count('bookings')) === i1.n;
  return R;
});
t.check('S4: the reference tables pass (TIMESTAMPTZ, no links yet)', mc.s4.reference.passed && mc.s4.reference.unchanged, JSON.stringify(mc.s4.reference));
t.check('S4: TIMESTAMP without a zone passes (recorded for later, not punished)', mc.s4.noZone.passed, JSON.stringify(mc.s4.noZone));
t.check('S4: tables with links and a CHECK already pass', mc.s4.linked.passed, JSON.stringify(mc.s4.linked));
t.check('S4: his own names and rules pass (full_name, a required email, IDENTITY ALWAYS, a key with no default, a required notes column)', mc.s4.ownNames.passed, JSON.stringify(mc.s4.ownNames));
t.check('S4 cheat: times kept as TEXT fail, "ten o\'clock came before nine"', !mc.s4.cheat0.passed && mc.s4.cheat0.why.some((w) => /ten o'clock came before nine/.test(w)), JSON.stringify(mc.s4.cheat0));
t.check('S4 cheat: only the day (DATE) fails: the time of day is not kept', !mc.s4.cheat1.passed && mc.s4.cheat1.why.some((w) => /time of day|one hour/.test(w)), JSON.stringify(mc.s4.cheat1));
t.check('S4 cheat: links not called room_id and person_id fail, naming the house convention', !mc.s4.cheat2.passed && mc.s4.cheat2.why.some((w) => /room_id/.test(w) && /person_id/.test(w)), JSON.stringify(mc.s4.cheat2));
t.check('S4 cheat: no people table fails', !mc.s4.cheat3.passed && mc.s4.cheat3.why.some((w) => /no table called people/.test(w)), JSON.stringify(mc.s4.cheat3));
t.check("S5 arrives with Priya's script: every line goes in, the room-7 slip too (no rule yet), as Priya's log entry", mc.paper.verdicts.filter((v) => v[1] !== 'went in').length === 0 && mc.paper.by === 'Priya', JSON.stringify(mc.paper));
t.check('S5: the reference (put the slip right, add the foreign key) passes; no variant', mc.s5.reference.passed && mc.s5.reference.variant === null, JSON.stringify(mc.s5.reference));
t.check('S5: removing the slip, then the foreign key, passes too', mc.s5.deleteThenLink.passed, JSON.stringify(mc.s5.deleteThenLink));
t.check('S5: the foreign key cannot go on while room 7 is there (PostgreSQL checks every row first)', !mc.s5.linkFirst.passed && mc.s5.linkFirst.why.some((w) => /violates foreign key/.test(w)), JSON.stringify(mc.s5.linkFirst));
t.check("S5 cheat: CHECK (room_id BETWEEN 1 AND 4) fails: refused by another rule, and a new room's booking is refused", !mc.s5.cheat0.passed && mc.s5.cheat0.why.some((w) => /another rule/.test(w)), JSON.stringify(mc.s5.cheat0));
t.check('S5 cheat: the slip put right but no rule fails', !mc.s5.cheat1.passed && mc.s5.cheat1.why.some((w) => /was let in/.test(w)), JSON.stringify(mc.s5.cheat1));
t.check("S5 cheat: every booking thrown away fails (Priya's other bookings)", !mc.s5.cheat2.passed && mc.s5.cheat2.why.includes('it changed'), JSON.stringify(mc.s5.cheat2));
t.check('S5 branch: with REFERENCES already, the room-7 slip alone is refused, in plain words', mc.paperLinked.length === 1 && /room 7/.test(mc.paperLinked[0][0]) && /a link column points at a row that does not exist/.test(mc.paperLinked[0][1]) && mc.linkedRows === 13, JSON.stringify(mc.paperLinked));
t.check('S5 branch: the ticket is the reply variant; the true reply passes with the same acceptance, "broken" fails', mc.s5L.right.variant === 'refused' && mc.s5L.right.passed && !mc.s5L.broken.passed, JSON.stringify(mc.s5L));
t.check("S6: Tom's import skips the Atrium and lets in the end-before-start line when there is no CHECK", JSON.stringify(mc.imp.plain.map((v) => v[1])) === '["skipped: there is no room called Atrium in your rooms table"]', JSON.stringify(mc.imp.plain));
t.check("S6: with his CHECK (end_at > start_at) that line is refused, said in plain words (the seed of P4)", mc.imp.linked.length === 2 && mc.imp.linked.some((v) => /CHECK rules refused/.test(v[1]) && /17:00-16:00/.test(v[0])), JSON.stringify(mc.imp.linked));
t.check('the office reads people and bookings through his columns (timestamps as ISO)', mc.objects.people.length === 5 && mc.objects.bookings.length === mc.imp.n[0] && /^2026-01-0\dT\d\d:\d\d:00Z$/.test(mc.objects.bookings[0].start_at), JSON.stringify(mc.objects.bookings[0]));
t.check('his shadow has people (his five and two more) and a shadow week through his columns', mc.shadowCounts.people === 7 && mc.shadowCounts.bookings === 19, JSON.stringify(mc.shadowCounts));
for (const id of ['T14', 'T16', 'T17', 'T18', 'T19']) t.check(`${id} on the imported week: reference passes, cheat fails`, mc[id].ref.passed && !mc[id].cheat.passed, JSON.stringify(mc[id]));
t.check("T16's cheat (<= Saturday midnight) passes his week and is caught on his shadow", mc.T16.cheat.where.every((x) => x === 'shadow'), JSON.stringify(mc.T16.cheat));
t.check("T13 on the imported week: removing Sam's Friday Boardroom booking passes; all of Sam's fails", mc.T13.ref.passed && !mc.T13.cheat.passed, JSON.stringify(mc.T13));
t.check("T21: Priya's morning booking arrives through his tables; deleting it (or moving it) passes, deleting the older fails", mc.T21.arrived[0][1] === 'went in' && mc.T21.ref.passed && mc.T21.move.passed && !mc.T21.older.passed, JSON.stringify(mc.T21));
t.check('his company replays from his log alone, colleagues\' scripts included, to the same rows', mc.replaySame);
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();
t.finish();
