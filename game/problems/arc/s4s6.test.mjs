// The product arc, milestone M-C (S4-S6 and the kept cards after them), the parts that need no database: the ladder
// (every card after S2 on his world; a person or booking a card names was put in by an earlier card's script), Sam's
// week (no clash but T21's), the colleagues' scripts written for HIS columns, the templates {person:..} and
// {booking:..}, S5's variant, the views by role, the shadow by name, and saves. The same against a real PostgreSQL:
// scripts/browser/test_arc_checks.mjs; played from a new save: scripts/browser/test_arc_s4s6.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCard, templatesOf, validateCard, variantFor, withVariant, bookingFor, tablesIn } from '../card.js';
import { typeClass, resolveRoles, BOOKING_ROLES, PERSON_ROLES, schemaChoices } from '../../world/catalogue.js';
import { selectFor } from '../../world/views.js';
import { arcShadowRooms, arcShadowPeople, arcShadowBookings } from '../../world/named.js';
import { LADDER, cardById, checkLadder, TUTORIAL } from '../ladder.js';
import { PAPER, SHEET, CLASH, BOOKING_KEYS, weekRows } from './sheet.js';
import { NOTEBOOK } from './notebook.js';
import { buildScript, loggedSql, lineVerdict, scriptText } from './scripts.js';
import { cleanArc } from '../../play/progress.js';
import { append, cleanLog } from '../../world/ddl-log.js';

const col = ([name, type, nullable = true, hasDefault = false, identity = null]) => ({ name, type, cls: typeClass(type), nullable, hasDefault, identity });
const table = (name, cols, constraints = []) => ({ name, pk: ['id'], constraints, columns: cols.map(col) });
// his own names: rooms (title, seats), people (full_name, an email he must fill), bookings with a notes column he made required
const CAT = { tables: {
  rooms: table('rooms', [['id', 'integer', false, true], ['title', 'text'], ['seats', 'integer']]),
  people: table('people', [['id', 'integer', false, false], ['full_name', 'text', false], ['email', 'text', false]]),
  bookings: table('bookings', [['id', 'integer', false, true], ['room_id', 'integer'], ['person_id', 'integer'], ['start_at', 'timestamp with time zone'], ['end_at', 'timestamp with time zone'], ['notes', 'text', false]],
    [{ name: 'bookings_room_id_fkey', type: 'f', def: 'FOREIGN KEY (room_id) REFERENCES rooms(id)', cols: ['room_id'], ref: 'rooms' }]),
} };
const M_C = ['S4', 'S5', 'S6', 'T13', 'T14', 'T16', 'T17', 'O6', 'O7', 'O8', 'T18', 'T19', 'T21'];

test('M-C: S4, S5, S6 come after S3, and every card after S2 runs on his company; the ladder is sound', () => {
  const ids = LADDER.map((c) => c.id);
  assert.deepEqual(ids.slice(ids.indexOf('S4')), M_C);
  assert.equal(ids.indexOf('S4'), ids.indexOf('T11') + 1);
  for (const c of LADDER.slice(ids.indexOf('S2') + 1)) assert.ok(c.world.arc, `${c.id} runs on his world`);
  assert.deepEqual(checkLadder(), []);
  for (const id of M_C) assert.deepEqual(validateCard(cardById(id)), [], id);
  assert.deepEqual(cardById('S4').creates, ['people', 'bookings']);
  assert.equal(cardById('S4').evidence, true, 'people is a recall of create-table');
  assert.deepEqual(cardById('S4').spells.recall, ['create-table']);
  for (const id of ['S4', 'S5']) assert.equal(cardById(id).newConcept, 1, id);
  assert.equal(cardById('S6').newConcept, 0, 'the import brings no new idea');
});

test('the ladder refuses a seeded card after S2, and a booking or a person no earlier script put in', () => {
  const seeded = LADDER.map((c) => (c.id === 'T14' ? { ...c, world: { stage: [] } , learnCard: { ...c.learnCard, lines: ['a', 'b', 'c'] }, steps: c.steps.map((s) => ({ ...s, checks: [{ kind: 'rows', truth: 'SELECT 1' }] })), cheats: [{ name: 'x', code: 'SELECT 2' }], reference: [{ step: 0, code: 'SELECT 1' }] } : c));
  assert.ok(checkLadder(seeded, TUTORIAL).some((b) => /T14: comes after S2 but starts from a seeded world/.test(b)));
  const early = LADDER.map((c) => (c.id === 'T13' ? { ...c, steps: c.steps.map((s) => ({ ...s, checks: [...s.checks, { kind: 'world', name: 'x', sql: 'SELECT count(*) FROM bookings WHERE id = {booking:jo-clash}', expect: { equals: 0 } }] })) } : c));
  assert.ok(checkLadder(early, TUTORIAL).some((b) => /T13: needs the booking jo-clash/.test(b)));
  const nobody = LADDER.map((c) => (c.id === 'T14' ? { ...c, says: 'Where is {person:Ravi Patel} booked this week?' } : c));
  assert.ok(checkLadder(nobody, TUTORIAL).some((b) => /T14: needs Ravi Patel in his people table/.test(b)));
  // S5's variant adds no room-7 booking (the database refused it), so nothing after S5 may count on that booking
  const after = LADDER.map((c) => (c.id === 'T14' ? { ...c, says: 'And the slip, {booking:sam-room7}?' } : c));
  assert.ok(checkLadder(after, TUTORIAL).some((b) => /T14: needs the booking sam-room7/.test(b)));
  assert.deepEqual(tablesIn("SELECT count(*) FROM pg_constraint c JOIN pg_class r ON true JOIN information_schema.tables t ON true").used, []);
});

test("Sam's week: Priya's paper is her notebook plus two slips; nothing clashes except T21's morning booking", () => {
  const nb = NOTEBOOK.pages.bookings.rows, rooms = NOTEBOOK.pages.rooms.rows;
  assert.equal(PAPER.length, 14);
  for (const [i, r] of nb.entries()) {
    const p = PAPER[i];
    assert.deepEqual([p.who, p.room, p.day, p.from, p.to], [r.who, rooms.find((x) => x.no === r.room).name, r.day, r.from, r.to], `line ${r.line}`);
  }
  assert.equal(PAPER.filter((p) => typeof p.room === 'number').length, 1, 'exactly one slip says room 7');
  const rows = weekRows().filter((r) => typeof r.room === 'string' && r.room !== 'Atrium');
  const clash = [];
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i], b = rows[j];
    if (a.room === b.room && Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end) && a.start < a.end && b.start < b.end) clash.push([a.key || a.start, b.key || b.start]);
  }
  assert.deepEqual(clash, [['omar-mon-board', 'jo-clash']]);
  assert.ok(SHEET.some((l) => l.room === 'Atrium') && SHEET.some((l) => l.to < l.from), 'the sheet is messy: an Atrium, and an end before a start');
  for (const k of Object.keys(BOOKING_KEYS)) assert.ok(BOOKING_KEYS[k].person && BOOKING_KEYS[k].start, k);
  assert.equal(CLASH.key, 'jo-clash');
});

test("a colleague's script is written for HIS columns: his names, his required columns, a key with no default", () => {
  const paper = buildScript('paper', CAT);
  const text = scriptText(paper);
  assert.ok(!paper.error, paper.error);
  assert.equal(paper.lines.length, 5 + 14);
  assert.match(text, /INSERT INTO "people" \("id", "full_name", "email"\)/, 'the key without a default is counted by hand, the email he made required is filled');
  assert.match(text, /\(SELECT COALESCE\(max\("id"\), 0\) \+ 1 FROM "people"\)/);
  assert.match(text, /WHERE lower\(trim\("title"\)\) = 'boardroom'/, 'rooms are looked up by HIS name column');
  assert.match(text, /"notes"/, 'his required notes column gets a plain value');
  assert.match(paper.lines.find((l) => /room 7/.test(l.label)).sql, /SELECT 7, /, 'the slip that says room 7 is typed as 7');
  const imp = buildScript('import', CAT);
  const atrium = imp.lines.find((l) => /Atrium/.test(l.label));
  assert.match(atrium.sql, /WHERE EXISTS \(SELECT 1 FROM "rooms" WHERE lower\(trim\("title"\)\) = 'atrium'\)/);
  assert.equal(lineVerdict(atrium, { ok: true, rows: 0 }), 'skipped: there is no room called Atrium in your rooms table');
  assert.match(lineVerdict(paper.lines[10], { ok: false, code: '23503', error: 'insert or update on table "bookings" violates foreign key constraint' }), /^refused by your database: a link column points at a row that does not exist \(it said: "insert or update/);
  assert.equal(lineVerdict(paper.lines[0], { ok: true, rows: 0 }), 'already there');
  const clash = buildScript('clash', CAT);
  assert.equal(clash.lines.length, 1);
  const logged = loggedSql(paper, paper.lines.map((l, i) => ({ ok: i !== 18, rows: 1 })));
  assert.ok(logged.startsWith("-- Priya's script") && !logged.includes('SELECT 7,'), 'only what went in joins his log');
  assert.ok(buildScript('paper', { tables: { rooms: CAT.tables.rooms } }).error, 'no script before his tables exist');
  // the log keeps whose entry it was
  const log = append([], logged, { card: 'S5', atMs: 1, by: 'Priya' });
  assert.equal(log[0].by, 'Priya');
  assert.equal(cleanLog([{ ...log[0], by: '<script>' }])[0].by, undefined);
});

test('templates: {person:..} is his id for that person, {booking:..} his booking by content (person, room, start)', () => {
  const names = { cols: { rooms: { name: 'title', capacity: 'seats' } }, rooms: [{ id: 11, name: 'Boardroom' }, { id: 12, name: 'Studio' }],
    people: [{ id: 7, name: 'sam fletcher ' }, { id: 8, name: 'Jo Bell' }],
    bookings: [{ id: 40, room_id: 11, person_id: 7, start_at: '2026-01-09T09:00:00Z' }, { id: 41, room_id: 12, person_id: 7, start_at: '2026-01-09T14:00:00Z' }, { id: 42, room_id: 99, person_id: 7, start_at: '2026-01-07T16:30:00Z' }] };
  const { card, missing } = resolveCard(cardById('T13'), names);
  assert.deepEqual(missing, []);
  assert.equal(card.reference[0].code, 'DELETE FROM bookings WHERE id = 40;');
  assert.equal(card.steps[0].checks[1].sql, 'SELECT count(*) FROM bookings WHERE id = 41');
  assert.equal(card.cheats[0].code, 'DELETE FROM bookings WHERE person_id = 7;');
  assert.equal(bookingFor('sam-room7', names).id, 42, 'a key with no room is matched by person and start');
  const gone = resolveCard(cardById('T13'), { ...names, bookings: [] });
  assert.ok(gone.missing.some((m) => /Sam Fletcher's booking at 09:00 on Friday in your bookings table/.test(m)), gone.missing.join());
  assert.ok(templatesOf(cardById('T21')).bookings.has('jo-clash'));
});

test("S5's variant: a bookings table that already links room_id to rooms gets the reply ticket, with the same checks", () => {
  const s5 = cardById('S5');
  assert.equal(variantFor(s5, CAT), 'refused');
  const noLink = { tables: { ...CAT.tables, bookings: { ...CAT.tables.bookings, constraints: [] } } };
  assert.equal(variantFor(s5, noLink), null);
  const v = withVariant(s5, 'refused');
  assert.equal(v.steps[0].interaction, 'reply');
  assert.ok(!('variants' in v) && v.variant === 'refused');
  assert.deepEqual(v.teaches, ['foreign-key'], 'both branches teach the same idea');
  const kinds = (c) => c.steps.flatMap((s) => s.checks.map((k) => k.kind)).filter((k) => k !== 'reply' && k !== 'unchanged').sort();
  assert.deepEqual(kinds(v), kinds(s5), 'both branches are held to the same acceptance');
  assert.deepEqual(validateCard(s5), []);
});

test('roles by the house names: a booking column is found by its name only; a person needs no role column', () => {
  const b = CAT.tables.bookings;
  assert.deepEqual(resolveRoles(b, BOOKING_ROLES), { map: { room_id: 'room_id', person_id: 'person_id', start_at: 'start_at', end_at: 'end_at' }, missing: [] });
  const odd = table('bookings', [['id', 'integer'], ['room', 'integer'], ['who', 'integer'], ['start_at', 'text'], ['end_at', 'text']]);
  assert.deepEqual(resolveRoles(odd, BOOKING_ROLES), { map: { start_at: 'start_at', end_at: 'end_at' }, missing: ['room_id', 'person_id'] }, 'never "the first whole-number column"');
  assert.deepEqual(resolveRoles(CAT.tables.people, PERSON_ROLES), { map: { name: 'full_name' }, missing: ['role'] }, 'an email is not a role');
  assert.equal(selectFor('people', CAT.tables.people), 'SELECT id, "full_name" AS name, NULL AS role FROM people ORDER BY id');
  assert.match(selectFor('bookings', table('bookings', [['id', 'integer'], ['room_id', 'integer'], ['person_id', 'integer'], ['start_at', 'timestamp without time zone'], ['end_at', 'timestamp without time zone']])), /to_char\("start_at" AT TIME ZONE 'UTC'/);
  assert.equal(selectFor('rooms', CAT.tables.rooms), 'SELECT id, "title" AS name, "seats" AS capacity FROM rooms ORDER BY id');
  assert.deepEqual(schemaChoices(CAT), { timesType: 'timestamptz', roomLink: true, personLink: false, timesCheck: false });
  assert.deepEqual(schemaChoices({ tables: {} }), {});
});

test("his shadow: his people keep their ids by name, two shadow members join, the shadow week points at his ids", () => {
  const rooms = arcShadowRooms([{ id: 11, name: 'Boardroom', capacity: 10 }, { id: 12, name: 'Studio', capacity: 4 }, { id: 13, name: 'Library', capacity: 12 }, { id: 14, name: 'garden room', capacity: 6 }]);
  const people = arcShadowPeople([{ id: 21, name: 'Sam Fletcher' }, { id: 22, name: 'Priya Shah' }]);
  assert.deepEqual(people.map((p) => [p.id, p.name]).slice(0, 2), [[21, 'Sam Fletcher'], [22, 'Priya Shah']]);
  assert.ok(people.some((p) => p.name === 'Ravi Patel' && p.id > 22));
  const week = arcShadowBookings(rooms, people);
  assert.ok(week.length > 0 && week.every((b) => rooms.some((r) => r.id === b.room_id) && people.some((p) => p.id === b.person_id)));
  assert.ok(week.some((b) => b.room_id === 11 && b.start_at === '2026-01-10T00:00:00Z'), "the Saturday-midnight trap is in his Boardroom");
  assert.ok(week.some((b) => b.room_id === 14), 'his Garden Room (any spelling) has shadow bookings');
});

test('saves: the arc keeps scripts, variants and choices; anything odd is dropped; an M-B save loads unchanged', () => {
  const a = cleanArc({ company: 'X', log: [], marks: {}, scripts: { S5: { title: 'T', by: 'Priya', when: 'w', intro: 'i', text: 'INSERT', lines: [{ label: 'a', verdict: 'went in', ok: true }, 'junk'] }, bad: 7 },
    variants: { S5: 'refused', T13: 'DROP TABLE' }, choices: { timesType: 'timestamptz', roomLink: true, 'x y': 1 } });
  assert.deepEqual(a.scripts.S5.lines, [{ label: 'a', verdict: 'went in', ok: true }]);
  assert.ok(!('bad' in a.scripts));
  assert.deepEqual(a.variants, { S5: 'refused' });
  assert.deepEqual(a.choices, { timesType: 'timestamptz', roomLink: true });
  const old = cleanArc({ company: 'Harbour Desk', log: [{ sql: 'CREATE TABLE rooms (id serial primary key)', card: 'S1' }], marks: { S1: 0 } });
  assert.deepEqual([old.company, old.log.length, old.scripts, old.variants, old.choices], ['Harbour Desk', 1, {}, {}, {}]);
});
