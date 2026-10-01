// spells.js: the spells of the Grimoire (the game's name for its concepts and patterns) for the opening chapter
// of the SISO world, and the learner's state for each, behind one small interface.
//
//   SPELLS                 [{ id, name, line, meets, forms: { sql, js, php } }] in the ladder's order (learning design,
//                          sections 3 and 8: the on-ramp O1-O3, then the first SQL tickets, then the overlap of
//                          two time ranges, which the double-booking ticket needs). meets: the ticket that first
//                          teaches it in each language.
//   LANGS                  { sql, js, php } -> { name, drone (persona id), droneName, ring (palette key) }
//   createSpellStore({ storage?, key? }) -> store
//     .getSpellState(id) -> { introduced, langs, written, lastMs, stability, assisted, forms }
//          introduced: met at all (langs: the languages whose form has been introduced, in SQL, JS, PHP order);
//          written: cast unaided at least once (honest progression: help never writes a spell in);
//          lastMs / stability: the memory meter's inputs (game/memory); assisted: the last cast needed help;
//          forms: { [lang]: { written, lastMs, stability } } for the languages cast so far (per-drone meters)
//     .introduce(id, langs)  marks forms as introduced (a Learn card or worked example was seen)
//     .recordCast(id, { lang, assisted = false, nowMs = Date.now() })   a cast (a solve that used the spell):
//          unaided writes the spell (and that form) in ink and strengthens it (curve.js nextStability 'clean');
//          assisted re-inks a written spell a little ('assisted') but never writes an unwritten one
//     .set(id, state) / .clear() / .all()   for tests and for Task 15, which feeds real progress
//   getSpellState(id), introduce, recordCast: the same on the default store (localStorage 'grimoire.spells.v1',
//          wrapped in try/catch: with storage off the state lives in memory for the session)
//   inkOf(state, nowMs) -> { status, opacity, keptDays, line, r }   how the page is inked:
//          'unknown' (not met: a blank page), 'unwritten' (faint pencil outline), or the meter's 'fresh' (full ink),
//          'fading' (faded ink) and 'due' (very faint, "re-ink soon"); keptDays: about how long it is kept (stability)
import { describeSkill } from '../memory/meter.js';
import { INITIAL_STABILITY, nextStability } from '../memory/curve.js';

export const LANGS = Object.freeze({
  sql: { name: 'SQL', drone: 'sequel', droneName: 'Sequel', ring: 'droneSequelRing' },
  js: { name: 'JavaScript', drone: 'jay', droneName: 'Jay', ring: 'droneJayRing' },
  php: { name: 'PHP', drone: 'hex', droneName: 'Hex', ring: 'droneHexRing' },
});
const ORDER = ['sql', 'js', 'php'];

export const SPELLS = Object.freeze([
  { id: 'table-row', name: 'Table and row', line: 'A table holds one kind of thing: each row is one of them, each column one fact about it.', meets: { sql: 'O1', js: 'T05', php: 'T15' },
    forms: { sql: "-- the bookings table: one row per booking\n-- id | room   | person | starts\n--  7 | Room 2 | Priya  | 10:00", js: "world.bookings[0]\n// { id: 7, room: 'Room 2', person: 'Priya', ... }", php: "$row['room']   // one column of one row" } },
  { id: 'id-link', name: 'Linking by id', line: 'Every row has its own id; another row points at it by keeping that number.', meets: { sql: 'O2', js: 'T05', php: 'T07' },
    forms: { sql: 'SELECT name FROM rooms WHERE id = 2;', js: 'world.rooms.find((r) => r.id === booking.room_id)', php: "$stmt = $pdo->prepare('SELECT name FROM rooms WHERE id = ?');\n$stmt->execute([$booking['room_id']]);" } },
  { id: 'select-all', name: 'Ask for everything', line: 'Show every column of every row in a table.', meets: { sql: 'O3', js: 'T05', php: 'O8' },
    forms: { sql: 'SELECT * FROM rooms;', js: 'world.rooms', php: "$rooms = $pdo->query('SELECT * FROM rooms')->fetchAll();" } },
  { id: 'select-columns', name: 'Choose the columns', line: 'Ask only for the columns you need, separated by commas.', meets: { sql: 'T02', js: 'T09', php: 'T15' },
    forms: { sql: 'SELECT name, capacity FROM rooms;', js: 'world.rooms.map((r) => ({ name: r.name, capacity: r.capacity }))', php: "$pdo->query('SELECT name, capacity FROM rooms')->fetchAll();" } },
  { id: 'where', name: 'Choose the rows', line: "Keep only the rows that match. Here = means 'is equal to'.", meets: { sql: 'T03', js: 'T12', php: 'T07' },
    forms: { sql: "SELECT * FROM bookings\nWHERE room = 'Room 1';", js: "world.bookings.filter((b) => b.room === 'Room 1')", php: "$stmt = $pdo->prepare('SELECT * FROM bookings WHERE room = ?');\n$stmt->execute(['Room 1']);" } },
  { id: 'update', name: 'Change a value', line: "Change a value in the rows you pick. In SET, = means 'becomes'.", meets: { sql: 'T04' },
    forms: { sql: "UPDATE rooms SET capacity = 10\nWHERE name = 'Boardroom';", js: 'room.capacity = 10;', php: "$pdo->prepare('UPDATE rooms SET capacity = ? WHERE name = ?')\n    ->execute([10, 'Boardroom']);" } },
  { id: 'insert', name: 'Add a row', line: 'Add a new row: the brackets list the columns, then their values.', meets: { sql: 'T06' },
    forms: { sql: "INSERT INTO rooms (name, capacity)\nVALUES ('Garden Room', 6);", js: "world.rooms.push({ name: 'Garden Room', capacity: 6 });", php: "$pdo->prepare('INSERT INTO rooms (name, capacity) VALUES (?, ?)')\n    ->execute(['Garden Room', 6]);" } },
  { id: 'order-by', name: 'Sort the rows', line: 'Put the answer in order; DESC turns it round.', meets: { sql: 'T08' },
    forms: { sql: 'SELECT * FROM rooms\nORDER BY name;', js: '[...world.rooms].sort((a, b) => a.name.localeCompare(b.name))', php: "$pdo->query('SELECT * FROM rooms ORDER BY name')->fetchAll();" } },
  { id: 'compare', name: 'Compare', line: 'Bigger, smaller, at least, at most, not equal: < > >= <= <>.', meets: { sql: 'T10', js: 'T12' },
    forms: { sql: 'SELECT * FROM rooms\nWHERE capacity >= 8;', js: 'world.rooms.filter((r) => r.capacity >= 8)', php: "if ($room['capacity'] >= 8) { /* ... */ }" } },
  { id: 'delete', name: 'Remove a row', line: 'Remove the rows you pick. Find the right id first.', meets: { sql: 'T13' },
    forms: { sql: 'DELETE FROM bookings WHERE id = 12;', js: 'world.bookings = world.bookings.filter((b) => b.id !== 12);', php: "$pdo->prepare('DELETE FROM bookings WHERE id = ?')->execute([12]);" } },
  { id: 'and', name: 'Both must hold', line: 'Keep a row only when both conditions are true.', meets: { sql: 'T14' },
    forms: { sql: "SELECT * FROM bookings\nWHERE room = 'Room 2' AND person = 'Priya';", js: "b.room === 'Room 2' && b.person === 'Priya'", php: "if ($b['room'] === 'Room 2' && $b['person'] === 'Priya') { /* ... */ }" } },
  { id: 'limit', name: 'Only the first few', line: 'Keep just the first rows of the answer.', meets: { sql: 'T17' },
    forms: { sql: 'SELECT * FROM bookings\nORDER BY starts LIMIT 3;', js: 'sorted.slice(0, 3)', php: "$pdo->query('SELECT * FROM bookings ORDER BY starts LIMIT 3')->fetchAll();" } },
  { id: 'overlap', name: 'Two times overlap', line: 'Two bookings in one room clash when each starts before the other ends.', meets: { sql: 'T52' },
    forms: { sql: 'SELECT a.id, b.id FROM bookings a\nJOIN bookings b ON a.room = b.room AND a.id < b.id\nWHERE a.starts < b.ends AND b.starts < a.ends;', js: 'a.room === b.room && a.starts < b.ends && b.starts < a.ends', php: "$a['starts'] < $b['ends'] && $b['starts'] < $a['ends']" } },
]);
export const spellById = (id) => SPELLS.find((s) => s.id === id) || null;

// ---------------------------------------------------------------- storage (try/catch: never throws)
function safeStorage() {
  try { const s = globalThis.localStorage; const k = '__grimoire_probe'; s.setItem(k, '1'); s.removeItem(k); return s; } catch { return null; }
}
function memoryStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
export { memoryStorage };

const blank = () => ({ langs: [], written: false, lastMs: null, stability: INITIAL_STABILITY, assisted: false, forms: {} });

export function createSpellStore({ storage, key = 'grimoire.spells.v1' } = {}) {
  const S = storage === undefined ? (safeStorage() || memoryStorage()) : (storage || memoryStorage());
  let data = {};
  try { const raw = JSON.parse(S.getItem(key) || 'null'); if (raw && typeof raw === 'object') data = raw; } catch { data = {}; }
  const save = () => { try { S.setItem(key, JSON.stringify(data)); } catch { /* storage full or off: keep it in memory */ } };
  const raw = (id) => ({ ...blank(), ...(data[id] || {}) });
  function getSpellState(id) {
    const r = raw(id);
    const langs = ORDER.filter((l) => r.langs.includes(l));
    return { introduced: langs.length > 0, langs, written: !!r.written, lastMs: r.lastMs, stability: r.stability, assisted: !!r.assisted, forms: { ...r.forms } };
  }
  function introduce(id, langs = ['sql']) {
    const r = raw(id);
    r.langs = ORDER.filter((l) => r.langs.includes(l) || [].concat(langs).includes(l));
    data[id] = r; save();
    return getSpellState(id);
  }
  function recordCast(id, { lang = 'sql', assisted = false, nowMs = Date.now() } = {}) {
    const r = raw(id);
    if (!r.langs.includes(lang)) r.langs = ORDER.filter((l) => r.langs.includes(l) || l === lang);
    const f = { written: false, lastMs: null, stability: INITIAL_STABILITY, ...(r.forms[lang] || {}) };
    if (!assisted) {
      r.stability = r.written ? nextStability(r.stability, 'clean') : INITIAL_STABILITY;
      f.stability = f.written ? nextStability(f.stability, 'clean') : INITIAL_STABILITY;
      r.written = f.written = true; r.lastMs = f.lastMs = nowMs;
    } else if (r.written) { // help re-inks a written spell a little; it never writes one in
      r.stability = nextStability(r.stability, 'assisted'); r.lastMs = nowMs;
      if (f.written) { f.stability = nextStability(f.stability, 'assisted'); f.lastMs = nowMs; }
    }
    r.assisted = !!assisted;
    r.forms[lang] = f;
    data[id] = r; save();
    return getSpellState(id);
  }
  return {
    getSpellState, introduce, recordCast,
    set(id, state) { data[id] = { ...blank(), ...state, langs: [...(state.langs || (state.introduced ? ['sql'] : []))] }; save(); return getSpellState(id); },
    clear() { data = {}; save(); },
    all() { return SPELLS.map((s) => ({ spell: s, state: getSpellState(s.id) })); },
  };
}

let DEFAULT = null;
export const defaultStore = () => (DEFAULT ??= createSpellStore());
export const getSpellState = (id) => defaultStore().getSpellState(id);
export const introduce = (id, langs) => defaultStore().introduce(id, langs);
export const recordCast = (id, opts) => defaultStore().recordCast(id, opts);

// ---------------------------------------------------------------- the ink
export const INK = Object.freeze({ fresh: 1, fading: 0.55, due: 0.22, unwritten: 0.5 });
export function inkOf(state, nowMs = Date.now()) {
  if (!state || !state.introduced) return { status: 'unknown', opacity: 0, keptDays: 0, line: 'Not met yet.', r: 0 };
  if (!state.written || state.lastMs == null) {
    return { status: 'unwritten', opacity: INK.unwritten, keptDays: 0, r: 0,
      line: state.assisted ? 'Cast with help: cast it on your own to write it in.' : 'Not written yet: cast it on your own to write it in.' };
  }
  const m = describeSkill({ name: '', lang: '', lastMs: state.lastMs, stability: state.stability }, nowMs);
  const keptDays = Math.max(1, Math.round(state.stability));
  const kept = `Kept about ${keptDays} day${keptDays === 1 ? '' : 's'}`;
  const line = m.status === 'fresh' ? `${kept} · fresh ink`
    : m.status === 'fading' ? `${kept} · the ink is fading`
      : `${kept} · very faint: re-ink soon`;
  return { status: m.status, opacity: INK[m.status], keptDays, line, r: m.r };
}
