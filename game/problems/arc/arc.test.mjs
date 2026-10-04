// The product arc, milestone M-A (S0-S2), the parts that need no database: the change log that is the save of his
// world, finding his columns by role, the probe judgements and the cheats they must fail, the notebook truths
// (by content, never by position), the ladder's rules for arc cards, and old saves loading (migration).
// The same checks against a real PostgreSQL run in scripts/browser/test_arc_checks.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isChange, isDdl, append, upTo, ddlOf, cleanLog, stripSql, LOG_LIMITS } from '../../world/ddl-log.js';
import { typeClass, resolveRoles, ROOM_ROLES } from '../../world/catalogue.js';
import { insertSql, fillSql, judgeProbeRows, validateCard } from '../card.js';
import { NOTEBOOK_ROOMS, noteRowKey, noteValue, sortedRows } from './notebook.js';
import { LADDER, cardById, checkLadder, heldConcept, TUTORIAL } from '../ladder.js';
import { cleanLife, freshLife, nextCardId } from '../../play/progress.js';
import { S1 } from './s1.js';
import { S2 } from './s2.js';

const table = (cols, pk = ['id']) => ({ name: 'rooms', pk, constraints: [], columns: cols.map(([name, type, nullable = true, hasDefault = false]) => ({ name, type, cls: typeClass(type), nullable, hasDefault })) });

test('the log keeps only runs that changed the database, in order; DDL is told apart', () => {
  assert.ok(isChange('CREATE TABLE rooms (id SERIAL PRIMARY KEY);') && isDdl('create table rooms (id int)'));
  assert.ok(isChange("INSERT INTO rooms (name) VALUES ('x');") && !isDdl("INSERT INTO rooms (name) VALUES ('x');"));
  assert.ok(!isChange('SELECT * FROM rooms;'));
  assert.ok(!isChange("SELECT 'drop table rooms' AS joke; -- create table"), stripSql("SELECT 'drop table rooms'"));
  assert.ok(isChange('DELETE FROM rooms WHERE id = 4;') && isChange("UPDATE rooms SET capacity = 10 WHERE name = 'Boardroom';") && isDdl('DROP TABLE rooms;'));
  let log = [];
  log = append(log, 'CREATE TABLE rooms (id SERIAL PRIMARY KEY, name TEXT, capacity INTEGER);', { card: 'S1', atMs: 5 });
  log = append(log, 'SELECT * FROM rooms;', { card: 'S1' });
  log = append(log, "INSERT INTO rooms (name, capacity) VALUES ('Studio', 4);", { card: 'S2' });
  assert.equal(log.length, 2);
  assert.deepEqual(log.map((e) => [e.ddl, e.card]), [[true, 'S1'], [false, 'S2']]);
  assert.equal(ddlOf(log).length, 1);
  assert.equal(upTo(log, 1).length, 1);
  assert.equal(upTo(log, 99).length, 2);
});

test('a stored log is checked entry by entry; nothing odd survives', () => {
  const raw = [{ sql: 'CREATE TABLE a (id int);', card: 'S1', atMs: 1 }, { sql: 'SELECT 1;' }, null, { sql: 42 }, { sql: 'x'.repeat(LOG_LIMITS.chars + 1) + ' insert into a' }, { sql: 'INSERT INTO a VALUES (1);', ddl: true }];
  const log = cleanLog(raw);
  assert.deepEqual(log.map((e) => [e.sql, e.ddl]), [['CREATE TABLE a (id int);', true], ['INSERT INTO a VALUES (1);', false]]);
  assert.deepEqual(cleanLog('nope'), []);
});

test("his columns are found by role, whatever he called them; TEXT capacity is found by its name, then judged", () => {
  assert.deepEqual(resolveRoles(table([['id', 'integer'], ['name', 'text'], ['capacity', 'integer']]), ROOM_ROLES), { map: { name: 'name', capacity: 'capacity' }, missing: [] });
  assert.deepEqual(resolveRoles(table([['id', 'integer'], ['floor', 'smallint'], ['title', 'character varying'], ['seats', 'smallint']]), ROOM_ROLES).map, { name: 'title', capacity: 'seats' });
  assert.deepEqual(resolveRoles(table([['id', 'integer'], ['name', 'text'], ['capacity', 'text']]), ROOM_ROLES).map, { name: 'name', capacity: 'capacity' });
  assert.deepEqual(resolveRoles(table([['id', 'integer'], ['name', 'text'], ['cap', 'text']]), ROOM_ROLES).missing, ['capacity']);
  assert.deepEqual(resolveRoles(null, ROOM_ROLES).missing, ['name', 'capacity']);
  assert.equal(typeClass('timestamp with time zone'), 'timestamptz');
  assert.equal(typeClass('numeric'), 'number');
});

test('probe rows go in through his columns; his other required columns get plain values', () => {
  const t = table([['id', 'integer', false, true], ['label', 'text', false], ['seats', 'integer', false], ['floor', 'integer', false], ['note', 'text']]);
  const { map } = resolveRoles(t, ROOM_ROLES);
  const sql = insertSql(t, map, [{ name: "O'Neill Room", capacity: '10' }]);
  assert.equal(sql, `INSERT INTO "rooms" ("label", "seats", "floor") VALUES ('O''Neill Room', '10', '1')`);
  assert.equal(fillSql("SELECT {name} AS name FROM {table} WHERE {capacity} >= '7'", 'rooms', map), `SELECT "label" AS name FROM "rooms" WHERE "seats" >= '7'`);
  assert.throws(() => fillSql('SELECT {capacity} FROM {table}', 'rooms', { name: 'name' }));
});

test('S1 cheat: capacity as TEXT gives B only for "at least 7" (10 < 7 as words): it fails, in plain words', () => {
  const p = S1.steps[2].checks.find((k) => k.kind === 'probe' && /at least 7/.test(k.name)).steps[1];
  assert.equal(judgeProbeRows([{ name: 'B' }], p).ok, false);
  assert.match(judgeProbeRows([{ name: 'B' }], p).why, /10 was treated as words, not a number/);
  assert.ok(judgeProbeRows([{ name: 'B' }, { name: 'A' }], p).ok);
});

test("S2 cheat: the rooms put in twice fails in Priya's words; a typo and a missing room fail; any case and spacing pass", () => {
  const p = S2.steps[0].checks.find((k) => k.kind === 'probe').steps[0];
  const rows = NOTEBOOK_ROOMS.map((r) => ({ ...r }));
  assert.ok(judgeProbeRows(rows, p).ok);
  assert.ok(judgeProbeRows([{ name: ' boardroom ', capacity: 8 }, { name: 'STUDIO', capacity: '4' }, { name: 'Library', capacity: 12 }], p).ok);
  const twice = judgeProbeRows([...rows, ...rows], p);
  assert.equal(twice.ok, false); assert.equal(twice.why, 'Priya counts 6 rooms in the table; she has 3');
  assert.match(judgeProbeRows(rows.slice(0, 2), p).why, /counts 2 rooms/);
  assert.match(judgeProbeRows([rows[0], rows[1], { name: 'Library', capacity: 21 }], p).why, /Library has 21 seats in the table; the notebook says 12/);
  assert.match(judgeProbeRows([rows[0], rows[1], { name: 'Libary', capacity: 12 }], p).why, /Library is not in the table/);
});

test('the notebook: truths are found by content; a pick by position after sorting is another row', () => {
  assert.equal(noteRowKey('bookings', { who: 'Priya Shah', day: 'Mon', from: '10:00' }), 5);
  assert.equal(noteValue({ page: 'rooms', where: { no: 2 }, col: 'name' }), 'Studio');
  assert.equal(sortedRows('bookings')[4].key, 5);
  assert.notEqual(sortedRows('bookings', 'who')[4].key, 5);
  assert.notEqual(sortedRows('rooms', 'seats')[1].key, 2);
  assert.deepEqual(NOTEBOOK_ROOMS, [{ name: 'Boardroom', capacity: 8 }, { name: 'Studio', capacity: 4 }, { name: 'Library', capacity: 12 }]);
});

test('the arc opens the ladder: S0 (O1, O2 on the notebook), S1, S2, then the on-ramp; T06 is retired', () => {
  assert.deepEqual(LADDER.slice(0, 5).map((c) => c.id), ['O1', 'O2', 'S1', 'S2', 'O3']);
  assert.ok(!cardById('T06'));
  for (const id of ['O1', 'O2', 'S1', 'S2']) { assert.ok(cardById(id).world.arc, id); assert.ok(cardById(id).acceptance.length, id); }
  assert.equal(cardById('S1').evidence, false); // a first meeting never counts as evidence
  assert.ok(cardById('S1').steps.slice(0, 2).every((s) => s.on === 'pad') && !cardById('S1').steps[2].on); // scaffold on the pad, the real thing in his world
  assert.equal(cardById('S1').steps[2].starter, '');
  assert.deepEqual(checkLadder(), []);
  const early = LADDER.filter((c) => c.id !== 'S1').map((c, i) => ({ ...c, serve: i + 1, needs: c.needs.filter((n) => n !== 'S1'), uses: c.uses.filter((u) => u !== 'create-table') }));
  assert.ok(checkLadder(early, TUTORIAL).some((b) => /S2: checks the table rooms, which no card before it/.test(b)));
  assert.ok(validateCard({ ...cardById('S2'), acceptance: [] }).some((b) => /acceptance/.test(b)));
  assert.ok(validateCard({ ...cardById('T01'), steps: [{ ...cardById('T01').steps[0], checks: [{ kind: 'schema', table: 'rooms', roles: 'room' }] }] }).some((b) => /belong to product-arc cards/.test(b)));
});

test('saves: a life from before the arc keeps its spells, credit and home; its company starts empty and is rebuilt by the arc', () => {
  const NOW = Date.UTC(2026, 9, 4, 12);
  const old = {
    v: 1, startedMs: NOW - 1e9, highMs: NOW, tutorial: { done: true, step: 7, skipped: [] }, cards: { O1: { startedMs: NOW, learnSeen: true, step: 0 } },
    solves: ['O1', 'O2', 'O3', 'T06'].map((card) => ({ card, atMs: NOW - 1000, help: 'clean', unaided: card === 'T06', lang: 'sql', xp: card === 'T06' ? 10 : 0 })),
    days: {}, spells: { 'select-all': { langs: ['sql'], written: true, lastMs: NOW - 1000, stability: 3, forms: {} } }, home: { balance: 0 },
  };
  const life = cleanLife(old, NOW);
  assert.deepEqual(life.solves.map((s) => s.card), ['O1', 'O2', 'O3', 'T06']);
  assert.equal(life.solves.reduce((n, s) => n + s.xp, 0), 10);
  assert.deepEqual(life.spells, old.spells);
  assert.deepEqual(life.arc, { company: null, log: [], marks: {} });
  assert.equal(nextCardId(LADDER, life), 'S1'); // his world is rebuilt: the arc serves the stages he has not done
  const solved = new Set(life.solves.map((s) => s.card));
  assert.ok(heldConcept(cardById('S2'), solved)); // insert was learnt on T06: S2 comes as recall, not teaching
  assert.ok(!heldConcept(cardById('S1'), solved));
  const kept = cleanLife({ ...old, arc: { company: '  Harbour Desk Ltd ', log: [{ sql: 'CREATE TABLE rooms (id int);' }, { sql: 'SELECT 1' }], marks: { S1: 0, S2: 9, bad: -1 } } }, NOW);
  assert.deepEqual(kept.arc, { company: 'Harbour Desk Ltd', log: [{ sql: 'CREATE TABLE rooms (id int);', ddl: true, card: null, atMs: null }], marks: { S1: 0, S2: 1 } });
  assert.deepEqual(freshLife(NOW).arc, { company: null, log: [], marks: {} });
});
