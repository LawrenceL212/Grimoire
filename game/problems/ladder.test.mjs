// ladder.js and card.js: the opening chapter's cards are valid, in ladder order, and never use a concept
// before the card that teaches it; the answer comparisons and the spell detection are honest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LADDER, TUTORIAL, checkLadder, cardById, DAILY_CAP } from './ladder.js';
import { compareRows, compareValue, outputHas, detectSpells, castSpells, validateCard } from './card.js';
import { SPELLS } from '../play/spells.js';
import { namedRows } from '../world/named.js';

test('the ladder is sound: valid cards, nothing used before it is taught, previews taught later', () => {
  assert.deepEqual(checkLadder(), []);
});

test('the chapter runs O1-O8, the SQL tickets, and ends with the double-booking ticket; it is not first', () => {
  const ids = LADDER.map((c) => c.id);
  assert.equal(ids[0], 'O1');
  for (const id of ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'T01', 'T04', 'T11', 'T17', 'T18', 'T19', 'T21']) assert.ok(ids.includes(id), id);
  assert.equal(ids.at(-1), 'T21');
  assert.equal(cardById('T21').reskinOf, 'double-booking-1');
  assert.ok(ids.indexOf('T19') < ids.indexOf('T21') && ids.indexOf('T13') < ids.indexOf('T21'));
});

test('a card that uses a concept before it is taught is caught', () => {
  const early = { ...cardById('T03'), uses: ['overlap'] };
  const bad = checkLadder(['O1', 'O2', 'O3', 'O4', 'O5', 'T01', 'T02'].map(cardById).concat([early]), TUTORIAL);
  assert.ok(bad.some((b) => /T03: uses overlap before/.test(b)), bad.join('\n'));
  const twoIdeas = { ...cardById('T03'), teaches: ['where', 'update'] };
  assert.ok(validateCard(twoIdeas).some((b) => /one new concept/.test(b)));
  const noCheat = { ...cardById('T03'), cheats: [] };
  assert.ok(validateCard(noCheat).some((b) => /cheat/.test(b)));
  const swapped = ['O1', 'O2', 'O3', 'O4', 'O5', 'T01', 'T02', 'T04', 'T03'].map(cardById);
  assert.ok(checkLadder(swapped, TUTORIAL).some((b) => /T04: uses where before/.test(b)));
});

test('every card names its cause, reporter, sector, hints and real Grimoire spells', () => {
  for (const c of LADDER) {
    assert.ok(c.from.sector && c.cause && c.says, c.id);
    assert.equal(c.hints.length, 3, c.id);
    for (const s of [...c.spells.teach, ...c.spells.recall, c.hints[2]]) assert.ok(SPELLS.some((x) => x.id === s), `${c.id}: ${s}`);
  }
  assert.ok(DAILY_CAP >= 4 && DAILY_CAP <= 5);
  assert.equal(LADDER.reduce((n, c) => n + c.newConcept, 0), LADDER.filter((c) => c.teaches.length).length);
});

test('the recall spells each card declares are exactly what its reference solution casts, unaided and fresh', () => {
  // a card on his world is read as written against the house names (his own names change no spell)
  const house = (code) => String(code).replace(/\{(rooms|people|bookings)\.(\w+)\}/g, '$2').replace(/\{(room|person|booking):[^{}"]+\}/g, '1').replace(/\{roomName:([^{}"]+)\}/g, '$1');
  for (const c0 of LADDER) {
    const c = JSON.parse(house(JSON.stringify(c0)));
    const got = new Set();
    const shown = new Set([...(c.learnCard?.example?.code ? detectSpells(c.learnCard.example.code, c.learnCard.example.lang) : []), ...c.spells.teach]);
    for (const r of c.reference) {
      if (!r.code || c.evidence === false) continue; // scaffolded cards never count as evidence
      const step = c.steps[r.step ?? c.steps.length - 1];
      for (const s of castSpells(r.code, r.lang, step.starter || '')) if (!shown.has(s)) got.add(s);
    }
    assert.deepEqual([...got].sort(), [...c.spells.recall].sort(), c.id);
  }
});

test('compareRows: any valid column choice passes, extra columns and wrong rows fail, order when asked', () => {
  const want = [{ id: 1, name: 'Boardroom', capacity: 10 }, { id: 2, name: 'Studio', capacity: 4 }];
  assert.ok(compareRows([{ name: 'Studio' }, { name: 'Boardroom' }], want).ok);
  assert.equal(compareRows([{ name: 'Studio' }], want).ok, false);
  assert.equal(compareRows([{ name: 'Boardroom', x: 1 }, { name: 'Studio', x: 2 }], want).ok, false);
  assert.equal(compareRows([{ name: 'Boardroom' }, { name: 'Studio' }], want, { exactColumns: true }).ok, false);
  assert.equal(compareRows([{ name: 'Studio', capacity: 4 }, { name: 'Boardroom', capacity: 10 }], want, { sorted: { column: 'capacity', dir: 'desc' } }).ok, false);
  assert.ok(compareRows([{ name: 'Boardroom', capacity: 10 }, { name: 'Studio', capacity: 4 }], want, { sorted: { column: 'capacity', dir: 'desc' } }).ok);
  assert.ok(compareRows([{ name: 'Studio' }], want, { mode: 'one-of' }).ok);
  assert.equal(compareRows([{ name: 'Studio' }, { name: 'Boardroom' }], want, { mode: 'one-of' }).ok, false);
  assert.ok(compareRows([], []).ok);
  assert.equal(compareRows([{ name: 'Studio' }], []).ok, false);
  assert.ok(compareRows([{ start_at: new Date('2026-01-05T10:00:00Z') }], [{ start_at: '2026-01-05 10:00:00+00' }]).ok);
});

test('compareValue and outputHas', () => {
  assert.ok(compareValue([{ capacity: 8 }], 8).ok);
  assert.equal(compareValue([{ capacity: 8 }, { capacity: 4 }], 8).ok, false);
  assert.ok(outputHas('People: 5', 5));
  assert.equal(outputHas('People: 15', 5), false);
  assert.equal(outputHas('', 5), false);
});

test('spell detection reads the code he wrote, not the starter or comments', () => {
  assert.deepEqual(detectSpells('SELECT * FROM rooms;', 'sql'), ['select-all']);
  assert.ok(detectSpells("UPDATE rooms SET capacity = 10 WHERE name = 'Boardroom';", 'sql').includes('update'));
  assert.deepEqual(castSpells("SELECT capacity FROM rooms WHERE name = 'Boardroom';", 'sql', 'SELECT capacity FROM rooms'), ['where']);
  assert.deepEqual(castSpells('-- WHERE in a comment\nSELECT * FROM rooms;', 'sql'), ['select-all']);
  assert.ok(detectSpells("SELECT * FROM bookings WHERE start_at < '2026-01-08 15:00+00' AND '2026-01-08 14:00+00' < end_at", 'sql').includes('overlap'));
  assert.deepEqual(detectSpells('const a = 1;\nreturn a;', 'js'), ['js-variable']);
  assert.deepEqual(detectSpells('$n = $pdo->query("SELECT 1");', 'php'), ['php-query']);
});

test('the named world: the shadow keeps the named rooms and people and changes everything else', () => {
  const real = namedRows({ stage: ['boardroom10', 'garden'] }), shadow = namedRows({ shadow: true, stage: ['boardroom10', 'garden'] });
  assert.deepEqual(real.rooms.map((r) => [r.id, r.name]), shadow.rooms.map((r) => [r.id, r.name]));
  assert.deepEqual(real.people.map((p) => [p.id, p.name]), shadow.people.slice(0, 5).map((p) => [p.id, p.name]));
  assert.notDeepEqual(real.rooms.map((r) => r.capacity), shadow.rooms.map((r) => r.capacity));
  assert.notEqual(real.bookings.length, shadow.bookings.length);
  assert.equal(real.rooms.find((r) => r.name === 'Boardroom').capacity, 10);
  assert.equal(namedRows().rooms.find((r) => r.name === 'Boardroom').capacity, 8);
  assert.ok(!namedRows({ stage: ['samFridayGone'] }).bookings.some((b) => b.id === 11));
  for (const stage of [[], ['garden'], ['boardroom10', 'garden', 'samFridayGone']]) {
    const b = namedRows({ stage }).bookings;
    for (const x of b) for (const y of b) if (x.id < y.id && x.room_id === y.room_id) assert.ok(!(x.start_at < y.end_at && y.start_at < x.end_at), `${x.id} ${y.id}`);
  }
});

// ---- review round 1
test('answer checks require the asked-for columns; an alias is accepted by position; one value matching is not enough', () => {
  const want = [{ id: 1, name: 'Boardroom', capacity: 10 }, { id: 2, name: 'Studio', capacity: 4 }];
  assert.equal(compareRows([{ capacity: 10 }, { capacity: 4 }], want, { columns: ['name'] }).ok, false, 'a subset without the asked-for column');
  assert.ok(compareRows([{ name: 'Boardroom' }, { name: 'Studio' }], want, { columns: ['name'] }).ok);
  assert.ok(compareRows([{ room: 'Studio', seats: 4 }, { room: 'Boardroom', seats: 10 }], want, { columns: ['name', 'capacity'] }).ok, 'aliases, compared by position');
  assert.equal(compareRows([{ room: 'Studio', seats: 5 }, { room: 'Boardroom', seats: 10 }], want, { columns: ['name', 'capacity'] }).ok, false);
  assert.equal(compareValue([{ id: 1, n: 8 }], 8, 'capacity').ok, false, 'a row where some other value happens to match');
  assert.ok(compareValue([{ capacity: 8 }], 8, 'capacity').ok);
  assert.ok(compareValue([{ seats: 8 }], 8, 'capacity').ok, 'a single aliased value');
  assert.ok(compareValue([{ id: 1, name: 'Boardroom', capacity: 8 }], 8, 'capacity').ok);
});

test('every rows check on a card names the columns it asks for', () => {
  for (const c of LADDER) for (const s of c.steps) for (const k of s.checks) if (k.kind === 'rows') assert.ok(Array.isArray(k.columns) && k.columns.length || k.exactColumns, `${c.id}`);
});

test('T18: the smallest room for five differs between the real and the shadow world (a typed name cannot pass both)', () => {
  const pick = (w) => { const ok = w.rooms.filter((r) => r.capacity >= 5); const m = Math.min(...ok.map((r) => r.capacity)); return ok.filter((r) => r.capacity === m).map((r) => r.name).sort(); };
  const stage = ['boardroom10', 'garden', 'samFridayGone'];
  const real = pick(namedRows({ stage })), shadow = pick(namedRows({ shadow: true, stage }));
  assert.ok(real.every((n) => !shadow.includes(n)), JSON.stringify({ real, shadow }));
});

test('a question ticket refuses transaction control (a COMMIT would escape the rollback); words in strings and comments are fine', async () => {
  const { refusesTxn } = await import('./card.js');
  for (const c of ['UPDATE rooms SET capacity = 99;\nCOMMIT;\nSELECT 99;', 'BEGIN; SELECT 1;', 'rollback;', 'START TRANSACTION;']) assert.ok(refusesTxn(c), c);
  for (const c of ["SELECT * FROM bookings WHERE end_at > '2026-01-05 00:00+00';", "SELECT 'commit' AS word; -- begin", 'SELECT name FROM rooms;']) assert.equal(refusesTxn(c), null, c);
});
