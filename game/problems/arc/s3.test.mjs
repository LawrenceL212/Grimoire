// The product arc, milestone M-B (S3), the parts that need no database: cards templated by HIS names, the ladder's
// rules that no card on his world needs a table or a room he has not made, his shadow's rooms, the practice pad's
// look-up forms, and the probe's own test rows never colliding with his ids (the rooms_pkey report), said in plain
// words. The same against a real PostgreSQL: scripts/browser/test_arc_checks.mjs; played: test_arc_s3.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCard, templatesOf, tablesIn, insertSql, probeRefused, validateCard, PAD_TABLES } from '../card.js';
import { typeClass, resolveRoles, ROOM_ROLES } from '../../world/catalogue.js';
import { arcShadowRooms } from '../../world/named.js';
import { LADDER, cardById, checkLadder, TUTORIAL, RETIRED } from '../ladder.js';
import { SPELLS } from '../../play/spells.js';

const S3 = ['O3', 'O4', 'O5', 'T01', 'T02', 'T03', 'T04', 'G1', 'T08', 'T10', 'T11'];
const NAMES = { cols: { rooms: { name: 'title', capacity: 'Seats' } }, rooms: [{ id: 4, name: 'boardroom ' }, { id: 5, name: 'Studio' }, { id: 6, name: 'Library' }, { id: 7, name: 'Garden Room' }] };
const table = (cols, { pk = ['id'] } = {}) => ({ name: 'rooms', pk, constraints: [], columns: cols.map(([name, type, nullable = true, hasDefault = false, identity = null]) => ({ name, type, cls: typeClass(type), nullable, hasDefault, identity })) });

test('S3 runs on his company: O3 to T11 (with G1, the Garden Room he types in) are arc cards, after S2', () => {
  const ids = LADDER.map((c) => c.id);
  assert.deepEqual(ids.slice(ids.indexOf('O3'), ids.indexOf('T11') + 1), S3);
  for (const id of S3) assert.ok(cardById(id).world.arc, id);
  assert.ok(cardById('T13').world.arc, 'since M-C the cards that need bookings run on his company too');
  assert.deepEqual(checkLadder(), []);
  const g1 = cardById('G1');
  assert.equal(g1.newConcept, 0); assert.deepEqual(g1.spells.recall, ['insert']); assert.equal(g1.evidence, true);
  assert.equal(g1.steps[0].starter, '', 'a recall starts blank');
});

test('a card is resolved by his names: his columns, his ids, his spelling; nothing else is touched', () => {
  const { card, missing } = resolveCard(cardById('T03'), NAMES);
  assert.deepEqual(missing, []);
  assert.equal(card.steps[0].checks[0].truth, `SELECT "Seats" FROM rooms WHERE title = 'boardroom '`);
  assert.equal(card.steps[0].starter, 'SELECT "Seats" FROM rooms');
  assert.equal(card.reference[0].code, `SELECT "Seats" FROM rooms WHERE title = 'boardroom ';`);
  const t8 = resolveCard(cardById('T08'), NAMES).card;
  assert.deepEqual(t8.steps[0].checks[0].columns, ['title', '"Seats"']);
  const tut = resolveCard(TUTORIAL, NAMES).card;
  assert.match(tut.steps.find((s) => s.id === 'change').starter, /WHERE id = 4;/);
  assert.equal(tut.steps.find((s) => s.id === 'change').checks[0].truth, 'SELECT * FROM rooms WHERE id = 5');
  const q = resolveCard({ x: "{roomName:O'Neill}" }, { cols: {}, rooms: [{ id: 1, name: "O'Neill" }] }).card;
  assert.equal(q.x, "O''Neill", 'a name goes into a quoted SQL literal safely');
  const gone = resolveCard(cardById('T03'), { cols: { rooms: { name: 'name' } }, rooms: [] });
  assert.ok(gone.missing.some((m) => /Boardroom/.test(m)) && gone.missing.some((m) => /how many people fit/.test(m)), gone.missing.join());
});

test('the ladder catches a card on his world that needs a table or a room he has not made', () => {
  const t01 = cardById('T01');
  const asksBookings = { ...t01, steps: t01.steps.map((s, i) => (i === 2 ? { ...s, checks: [{ kind: 'rows', name: 'x', truth: 'SELECT * FROM bookings', exactColumns: true }] } : s)) };
  const ladder = LADDER.map((c) => (c.id === 'T01' ? asksBookings : c));
  assert.ok(checkLadder(ladder, TUTORIAL).some((b) => /T01: runs SQL on his company that reads the table bookings/.test(b)));
  const early = LADDER.filter((c) => c.id !== 'G1').map((c, i) => ({ ...c, serve: i + 1, needs: c.needs.filter((n) => n !== 'G1') }));
  assert.ok(checkLadder(early, TUTORIAL).some((b) => /needs the Garden Room in his rooms table/.test(b)));
  const padPeople = LADDER.map((c) => (c.id === 'T02' ? { ...c, workedExample: { lang: 'sql', code: 'SELECT * FROM people;', note: 'x' } } : c));
  assert.ok(checkLadder(padPeople, TUTORIAL).some((b) => /T02: runs SQL on the practice pad that reads people/.test(b)));
  assert.ok(validateCard({ ...RETIRED.T06, says: 'How many does {roomName:Boardroom} seat, please?' }).some((b) => /templates/.test(b)));
  assert.deepEqual(tablesIn("CREATE TABLE shifts (id int); INSERT INTO shifts VALUES (1); SELECT * FROM rooms r JOIN people p ON true -- FROM bookings"), { used: ['rooms', 'people'], made: ['shifts'] });
});

test('every S3 card names only his rooms table (and the pad), and the rooms S2 and G1 put in', () => {
  for (const id of S3) {
    const t = templatesOf(cardById(id));
    for (const k of t.cols) assert.ok(k.startsWith('rooms.'), `${id} ${k}`);
    for (const r of t.rows) assert.ok(['Boardroom', 'Studio', 'Library', 'Garden Room'].includes(r), `${id} ${r}`);
  }
});

test('his shadow: his rooms keep their ids and names, the seats change, two rooms he has not got are added', () => {
  const real = [{ id: 4, name: 'boardroom', capacity: 10 }, { id: 5, name: 'Studio', capacity: 4 }, { id: 6, name: 'Library', capacity: 12 }];
  const sh = arcShadowRooms(real);
  assert.deepEqual(sh.slice(0, 3).map((r) => [r.id, r.name]), real.map((r) => [r.id, r.name]));
  assert.deepEqual(sh.slice(0, 3).map((r) => r.capacity), [12, 7, 4]);
  assert.deepEqual(sh.slice(3).map((r) => r.id), [7, 8]);
  // the traps: a 7-seater (T10's "more than 7"), a Boardroom that is neither 8 nor 10 (T03's number off the screen)
  assert.ok(sh.some((r) => r.capacity === 7) && !real.some((r) => r.capacity === 7));
});

test("the probe's test rows never collide with his ids, whatever his key is (the rooms_pkey report)", () => {
  // Lawrence's table: Create TABLE if not exists Rooms(id int PRIMARY KEY, room TEXT, seats INT): no default on id
  const his = table([['id', 'integer', false, false], ['room', 'text'], ['seats', 'integer']]);
  const { map, missing } = resolveRoles(his, ROOM_ROLES);
  assert.deepEqual(missing, []); assert.deepEqual(map, { name: 'room', capacity: 'seats' });
  const sql = insertSql(his, map, [{ name: 'A', capacity: '10' }, { name: 'B', capacity: '8' }, { name: 'C', capacity: '6' }]);
  const ids = [...sql.matchAll(/\+ (\d+) FROM/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['1001', '1002', '1003'], sql);
  assert.match(sql, /^INSERT INTO "rooms" \("id", "room", "seats"\) VALUES \(\(SELECT COALESCE\(max\("id"\), 0\) \+ 1001 FROM "rooms"\)/);
  assert.doesNotMatch(sql, /OVERRIDING/);
  // GENERATED ALWAYS AS IDENTITY takes an explicit id only with OVERRIDING SYSTEM VALUE
  assert.match(insertSql(table([['id', 'integer', false, true, 'ALWAYS'], ['name', 'text'], ['capacity', 'integer']]), { name: 'name', capacity: 'capacity' }, [{ name: 'A', capacity: 1 }]), /OVERRIDING SYSTEM VALUE VALUES/);
  assert.doesNotMatch(insertSql(table([['id', 'integer', false, true, 'BY DEFAULT'], ['name', 'text'], ['capacity', 'integer']]), { name: 'name', capacity: 'capacity' }, [{ name: 'A', capacity: 1 }]), /OVERRIDING/);
  // a text key he fills himself gets distinct test keys
  assert.match(insertSql(table([['id', 'text', false], ['name', 'text'], ['capacity', 'integer']]), { name: 'name', capacity: 'capacity' }, [{ name: 'A', capacity: 1 }, { name: 'B', capacity: 2 }]), /'test-1'.*'test-2'/);
});

test('a refused probe is said in plain words: what was tried, that nothing of his changed, what to do, then the database', () => {
  const why = probeRefused({ tried: 'save three test rooms in it (10, 8 and 6 seats)', why: 'x' }, '23505', 'duplicate key value violates unique constraint "rooms_pkey"');
  assert.match(why, /^To check your rooms table, the game tried to save three test rooms/);
  assert.match(why, /nothing of yours was changed/);
  assert.match(why, /must be different on every row/);
  assert.match(why, /Fix the table/);
  assert.ok(why.indexOf('The database said') > why.indexOf('Fix the table'), 'the raw error comes last');
  assert.match(probeRefused({ why: 'y' }, '22001', 'value too long for type character varying(3)'), /too short for that text/);
});

test('every look-up example has a form for the practice pad that reads only the pad (no error on an empty company)', () => {
  for (const s of SPELLS) {
    const code = s.forms.pad || s.forms.sql;
    for (const t of tablesIn(code).used) assert.ok(PAD_TABLES.includes(t), `${s.id}: ${t}`);
  }
});
