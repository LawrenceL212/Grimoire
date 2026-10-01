// spells.js: the spells of the Grimoire (the game's name for its concepts and patterns) for the opening chapter
// of the SISO world, and the learner's state for each, behind one small interface.
//
//   SPELLS                 [{ id, name, line, meets, keywords, forms: { sql, js, php } }] in the ladder's order
//                          (learning design, sections 3 and 8). meets: the ticket that first teaches it in each
//                          language; keywords: what a learner might search for ("sort", "only some") in the
//                          look-up. The forms use the world's real columns (room_id, person_id, start_at, end_at).
//   LANGS                  { sql, js, php } -> { name, drone (persona id), droneName, ring (palette key) }
//   createSpellStore({ storage?, key?, now? }) -> store
//     .getSpellState(id, nowMs?) -> { introduced, langs, written, lastMs, stability, assisted, forms }
//          introduced: met at all (langs: the languages whose form has been introduced, in SQL, JS, PHP order);
//          written: cast unaided at least once, with a real time of casting (never one in the future);
//          lastMs / stability: the memory meter's inputs (game/memory); assisted: the last cast needed help;
//          forms: { [lang]: { written, lastMs, stability } } for the languages cast so far (per-drone meters)
//     .introduce(id, langs)  marks forms as introduced (a Learn card or worked example was seen); null for an
//          unknown spell or language
//     .recordCast(id, { lang, unaided, outcome, nowMs })   a cast (a solve that used the spell). FAILS CLOSED:
//          only a positive `unaided: true` (no hint past a nudge, no worked example, a fresh problem: the caller
//          derives it from the real progression) writes the spell in ink and strengthens it. Anything else is
//          exposure: it never writes an unwritten spell; on a written one a guided cast keeps the stability and
//          an exposure (outcome 'exposure', the default) cuts it to max(1, 0.3 S), as the learning design's
//          credit table says. null for an unknown spell or language.
//     .set(id, state) / .clear() / .all()   for tests and for the progression, which feeds real progress
//   Stored state is never trusted: every field is checked (known spells and languages, finite numbers, a time of
//   casting that is not in the future, a positive stability); anything else falls back to "not met".
//   getSpellState(id), introduce, recordCast: the same on the default store. The play page makes the default the
//          life's own store (setDefaultStore); without one it is localStorage 'grimoire.spells.v1', wrapped in
//          try/catch: with storage off the state lives in memory for the session.
//   inkOf(state, nowMs) -> { status, opacity, keptDays, line, r }   how the page is inked:
//          'unknown' (not met: a blank page), 'unwritten' (faint pencil outline), or the meter's 'fresh' (full ink),
//          'fading' (faded ink) and 'due' (faint but readable, marked "re-ink soon"); keptDays: about how long it is
//          kept (stability)
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
    keywords: ['table', 'row', 'column', 'record', 'timetable'],
    forms: { sql: '-- the bookings table: one row per booking\n-- id | room_id | person_id | start_at\n--  7 |       2 |         1 | Mon 10:00', js: "world.bookings[0]\n// { id: 1, room_id: 1, person_id: 1, start_at: '...' }", php: "$row['room_id']   // one column of one row" } },
  { id: 'id-link', name: 'Linking by id', line: 'Every row has its own id; another row points at it by keeping that number.', meets: { sql: 'O2', js: 'T05', php: 'T07' },
    keywords: ['id', 'link', 'points', 'foreign key', 'which room'],
    forms: { sql: 'SELECT name FROM rooms WHERE id = 2;', js: 'world.rooms.find((r) => r.id === booking.room_id)', php: "$stmt = $pdo->prepare('SELECT name FROM rooms WHERE id = ?');\n$stmt->execute([$booking['room_id']]);" } },
  { id: 'select-all', name: 'Ask for everything', line: 'Show every column of every row in a table.', meets: { sql: 'O3', js: 'T05', php: 'O8' },
    keywords: ['select', 'show', 'all', 'everything', 'list', 'query', 'from', '*'],
    forms: { sql: 'SELECT * FROM rooms;', js: 'world.rooms', php: "$rooms = $pdo->query('SELECT * FROM rooms')->fetchAll();" } },
  { id: 'select-columns', name: 'Choose the columns', line: 'Ask only for the columns you need, separated by commas.', meets: { sql: 'T02', js: 'T09', php: 'T15' },
    keywords: ['columns', 'only', 'some columns', 'comma', 'fields'],
    forms: { sql: 'SELECT name, capacity FROM rooms;', js: 'world.rooms.map((r) => ({ name: r.name, capacity: r.capacity }))', php: "$pdo->query('SELECT name, capacity FROM rooms')->fetchAll();" } },
  { id: 'where', name: 'Choose the rows', line: "Keep only the rows that match. Here = means 'is equal to'.", meets: { sql: 'T03', js: 'T12', php: 'T07' },
    keywords: ['where', 'filter', 'only some', 'find', 'which', 'match', 'equal', 'quotes'],
    forms: { sql: "SELECT * FROM rooms\nWHERE name = 'Studio';", js: "world.rooms.filter((r) => r.name === 'Studio')", php: "$stmt = $pdo->prepare('SELECT * FROM rooms WHERE name = ?');\n$stmt->execute(['Studio']);" } },
  { id: 'update', name: 'Change a value', line: "Change a value in the rows you pick. In SET, = means 'becomes'.", meets: { sql: 'T04' },
    keywords: ['update', 'change', 'set', 'correct', 'fix a value', 'edit'],
    forms: { sql: "UPDATE rooms SET capacity = 5\nWHERE name = 'Studio';", js: 'room.capacity = 5;', php: "$pdo->prepare('UPDATE rooms SET capacity = ? WHERE name = ?')\n    ->execute([5, 'Studio']);" } },
  { id: 'insert', name: 'Add a row', line: 'Add a new row: the brackets list the columns, then their values.', meets: { sql: 'T06' },
    keywords: ['insert', 'add', 'new row', 'create', 'values'],
    forms: { sql: "INSERT INTO people (name)\nVALUES ('Jo Bell');", js: "world.people.push({ name: 'Jo Bell', role: 'customer' });", php: "$pdo->prepare('INSERT INTO people (name) VALUES (?)')\n    ->execute(['Jo Bell']);" } },
  { id: 'order-by', name: 'Sort the rows', line: 'Put the answer in order; DESC turns it round (biggest first).', meets: { sql: 'T08' },
    keywords: ['sort', 'order', 'order by', 'biggest first', 'alphabetical', 'asc', 'desc', 'name order'],
    forms: { sql: 'SELECT * FROM rooms\nORDER BY name;', js: '[...world.rooms].sort((a, b) => a.name.localeCompare(b.name))', php: "$pdo->query('SELECT * FROM rooms ORDER BY name')->fetchAll();" } },
  { id: 'compare', name: 'Compare', line: 'Bigger, smaller, at least, at most, not equal: < > >= <= <>.', meets: { sql: 'T10', js: 'T12' },
    keywords: ['compare', 'at least', 'more than', 'less than', 'bigger', 'smaller', '>=', '<='],
    forms: { sql: 'SELECT * FROM rooms\nWHERE capacity >= 8;', js: 'world.rooms.filter((r) => r.capacity >= 8)', php: "if ($room['capacity'] >= 8) { /* ... */ }" } },
  { id: 'delete', name: 'Remove a row', line: 'Remove the rows you pick. Find the right id first.', meets: { sql: 'T13' },
    keywords: ['delete', 'remove', 'cancel', 'get rid of'],
    forms: { sql: 'DELETE FROM bookings WHERE id = 12;', js: 'world.bookings = world.bookings.filter((b) => b.id !== 12);', php: "$pdo->prepare('DELETE FROM bookings WHERE id = ?')->execute([12]);" } },
  { id: 'and', name: 'Both must hold', line: 'Keep a row only when both conditions are true.', meets: { sql: 'T14' },
    keywords: ['and', 'both', 'or', 'two conditions', 'combine'],
    forms: { sql: 'SELECT * FROM bookings\nWHERE room_id = 2 AND person_id = 1;', js: 'b.room_id === 2 && b.person_id === 1', php: "if ($b['room_id'] === 2 && $b['person_id'] === 1) { /* ... */ }" } },
  { id: 'time-range', name: 'A day of bookings', line: 'A day runs from midnight up to, not including, the next midnight.', meets: { sql: 'T16' },
    keywords: ['time', 'date', 'day', 'today', 'between', 'midnight', 'timestamp'],
    forms: { sql: "SELECT * FROM bookings\nWHERE start_at >= '2026-01-06 00:00+00'\n  AND start_at <  '2026-01-07 00:00+00';", js: "b.start_at >= '2026-01-06T00:00:00Z' && b.start_at < '2026-01-07T00:00:00Z'", php: "$b['start_at'] >= '2026-01-06T00:00:00Z' && $b['start_at'] < '2026-01-07T00:00:00Z'" } },
  { id: 'limit', name: 'Only the first few', line: 'Keep just the first rows of the answer.', meets: { sql: 'T17' },
    keywords: ['limit', 'first', 'top', 'only one', 'next', 'smallest', 'earliest'],
    forms: { sql: 'SELECT * FROM bookings\nORDER BY start_at LIMIT 3;', js: 'sorted.slice(0, 3)', php: "$pdo->query('SELECT * FROM bookings ORDER BY start_at LIMIT 3')->fetchAll();" } },
  { id: 'js-variable', name: 'A named box', line: 'A program runs top to bottom; a variable is a named box that holds a value.', meets: { js: 'O6' },
    keywords: ['program', 'variable', 'const', 'return', 'javascript', 'box'],
    forms: { sql: '-- SQL has no boxes like this: a query is one question', js: 'const seats = 10 + 4;\nreturn seats;', php: '$seats = 10 + 4;\necho $seats;' } },
  { id: 'php-query', name: 'Ask from PHP', line: 'PHP sends SQL you already know to the database through $pdo.', meets: { php: 'O8' },
    keywords: ['php', '$pdo', 'query', 'echo', 'fetchcolumn', 'server'],
    forms: { sql: 'SELECT count(*) FROM rooms;', js: '// JavaScript in this office reads world.rooms directly', php: "$n = $pdo->query('SELECT count(*) FROM rooms')->fetchColumn();\necho 'Rooms: ' . $n;" } },
  { id: 'overlap', name: 'Two times overlap', line: 'Two bookings in one room clash when each starts before the other ends.', meets: { sql: 'T19' },
    keywords: ['overlap', 'clash', 'free', 'double booking', 'busy', 'conflict'],
    forms: { sql: "SELECT * FROM bookings\nWHERE room_id = 1\n  AND start_at < '2026-01-08 15:00+00'\n  AND '2026-01-08 14:00+00' < end_at;", js: 'a.room_id === b.room_id && a.start_at < b.end_at && b.start_at < a.end_at', php: "$a['start_at'] < $b['end_at'] && $b['start_at'] < $a['end_at']" } },
]);
export const spellById = (id) => SPELLS.find((s) => s.id === id) || null;
const KNOWN = new Set(SPELLS.map((s) => s.id));
export const isSpell = (id) => KNOWN.has(id);
export const isLang = (l) => ORDER.includes(l);

// ---------------------------------------------------------------- storage (try/catch: never throws)
function safeStorage() {
  try { const s = globalThis.localStorage; const k = '__grimoire_probe'; s.setItem(k, '1'); s.removeItem(k); return s; } catch { return null; }
}
function memoryStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
export { memoryStorage };

const MAX_STABILITY = 3650; // ten years: anything above is not a real memory, it is corrupt data
const blank = () => ({ langs: [], written: false, lastMs: null, stability: INITIAL_STABILITY, assisted: false, forms: {} });
const goodStability = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MAX_STABILITY ? v : INITIAL_STABILITY);
const goodTime = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

// one stored record, checked field by field (unknown or broken fields fall back to "not met")
function clean(rec) {
  const r = blank();
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return r;
  if (Array.isArray(rec.langs)) r.langs = ORDER.filter((l) => rec.langs.includes(l));
  r.lastMs = goodTime(rec.lastMs);
  r.written = rec.written === true && r.lastMs !== null;
  r.stability = goodStability(rec.stability);
  r.assisted = rec.assisted === true;
  if (rec.forms && typeof rec.forms === 'object' && !Array.isArray(rec.forms)) {
    for (const l of ORDER) {
      const f = rec.forms[l];
      if (!f || typeof f !== 'object') continue;
      const lastMs = goodTime(f.lastMs);
      r.forms[l] = { written: f.written === true && lastMs !== null, lastMs, stability: goodStability(f.stability) };
    }
  }
  return r;
}

export function createSpellStore({ storage, key = 'grimoire.spells.v1', now = Date.now } = {}) {
  const S = storage === undefined ? (safeStorage() || memoryStorage()) : (storage || memoryStorage());
  let data = {};
  try {
    const raw = JSON.parse(S.getItem(key) || 'null');
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) for (const id of Object.keys(raw)) if (KNOWN.has(id)) data[id] = clean(raw[id]);
  } catch { data = {}; }
  const save = () => { try { S.setItem(key, JSON.stringify(data)); } catch { /* storage full or off: keep it in memory */ } };
  const raw = (id) => clean(data[id]);
  function getSpellState(id, nowMs = now()) {
    const r = KNOWN.has(id) ? raw(id) : blank();
    const langs = ORDER.filter((l) => r.langs.includes(l));
    // a time of casting in the future (a changed clock, or a forged store) does not count as written
    const real = (t) => t !== null && t <= nowMs;
    const forms = {};
    for (const [l, f] of Object.entries(r.forms)) forms[l] = { ...f, written: f.written && real(f.lastMs) };
    const written = r.written && real(r.lastMs);
    return { introduced: langs.length > 0, langs, written, lastMs: written ? r.lastMs : (real(r.lastMs) ? r.lastMs : null), stability: r.stability, assisted: r.assisted, forms };
  }
  function introduce(id, langs = ['sql']) {
    const want = [].concat(langs);
    if (!KNOWN.has(id) || !want.length || !want.every(isLang)) return null;
    const r = raw(id);
    r.langs = ORDER.filter((l) => r.langs.includes(l) || want.includes(l));
    data[id] = r; save();
    return getSpellState(id);
  }
  function recordCast(id, { lang = 'sql', unaided = false, outcome = 'exposure', nowMs = now() } = {}) {
    if (!KNOWN.has(id) || !isLang(lang) || !Number.isFinite(nowMs)) return null;
    const r = raw(id);
    if (!r.langs.includes(lang)) r.langs = ORDER.filter((l) => r.langs.includes(l) || l === lang);
    const f = { written: false, lastMs: null, stability: INITIAL_STABILITY, ...(r.forms[lang] || {}) };
    if (unaided === true) { // the only path that writes: a positive signal from the progression
      r.stability = r.written ? Math.min(MAX_STABILITY, nextStability(r.stability, 'clean')) : INITIAL_STABILITY;
      f.stability = f.written ? Math.min(MAX_STABILITY, nextStability(f.stability, 'clean')) : INITIAL_STABILITY;
      r.written = f.written = true; r.lastMs = f.lastMs = nowMs;
      r.assisted = false;
    } else {
      // help never writes a spell in. On a written one: guided keeps what is kept; exposure (the worked example,
      // or a failure) cuts it so the spell comes back soon (learning design, section 1, the credit table)
      if (r.written) {
        if (outcome !== 'guided') r.stability = Math.max(1, 0.3 * r.stability);
        r.lastMs = nowMs;
        if (f.written) { if (outcome !== 'guided') f.stability = Math.max(1, 0.3 * f.stability); f.lastMs = nowMs; }
      }
      r.assisted = true;
    }
    r.forms[lang] = f;
    data[id] = r; save();
    return getSpellState(id, nowMs);
  }
  return {
    getSpellState, introduce, recordCast,
    set(id, state) {
      if (!KNOWN.has(id)) return null;
      data[id] = clean({ ...state, langs: [...(state.langs || (state.introduced ? ['sql'] : []))] }); save(); return getSpellState(id);
    },
    clear() { data = {}; save(); },
    all() { return SPELLS.map((s) => ({ spell: s, state: getSpellState(s.id) })); },
  };
}

let DEFAULT = null;
export const defaultStore = () => (DEFAULT ??= createSpellStore());
// the play page hands the life's own store over, so the HUD's book shows this life's progress
export const setDefaultStore = (store) => { DEFAULT = store; return store; };
export const getSpellState = (id, nowMs) => defaultStore().getSpellState(id, nowMs);
export const introduce = (id, langs) => defaultStore().introduce(id, langs);
export const recordCast = (id, opts) => defaultStore().recordCast(id, opts);

// ---------------------------------------------------------------- the ink
// a due spell stays readable (its status is said in words and by a hatched page, not only by fading)
export const INK = Object.freeze({ fresh: 1, fading: 0.78, due: 0.58, unwritten: 0.5 });
export const INK_WORDS = Object.freeze({ unknown: 'not met yet', unwritten: 'not written yet (pencil)', fresh: 'written, fresh ink', fading: 'written, the ink is fading', due: 'written, very faint: re-ink soon' });
export function inkOf(state, nowMs = Date.now()) {
  if (!state || !state.introduced) return { status: 'unknown', opacity: 0, keptDays: 0, line: 'Not met yet.', r: 0 };
  if (!state.written || state.lastMs == null || !Number.isFinite(state.lastMs) || state.lastMs > nowMs) {
    return { status: 'unwritten', opacity: INK.unwritten, keptDays: 0, r: 0,
      line: state.assisted ? 'Cast with help: cast it on your own to write it in.' : 'Not written yet: cast it on your own to write it in.' };
  }
  const stability = goodStability(state.stability);
  const m = describeSkill({ name: '', lang: '', lastMs: state.lastMs, stability }, nowMs);
  const keptDays = Math.max(1, Math.round(stability));
  const kept = `Kept about ${keptDays} day${keptDays === 1 ? '' : 's'}`;
  const line = m.status === 'fresh' ? `${kept} · fresh ink`
    : m.status === 'fading' ? `${kept} · the ink is fading`
      : `${kept} · very faint: re-ink soon`;
  return { status: m.status, opacity: INK[m.status], keptDays, line, r: m.r };
}
