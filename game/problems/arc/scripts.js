// scripts.js: other people's scripts that put rows into HIS company (product arc S5, S6, T21; milestone M-C).
// Nothing arrives by magic: a colleague runs a script he can read, written for his tables and columns (found by
// role, catalogue.js), and its log says, line by line, what went in and what his database refused, in plain words.
// Only what went in joins his change log (as that colleague's entry), so a replay gives exactly the same rows.
//
// Pure (node-tested), from his catalogue (catalogue.js readCatalogue):
//   SCRIPTS                          { id: { by, when, title, intro } } who runs what, and when
//   buildScript(id, cat) -> { id, by, when, title, intro, lines: [{ label, sql, skipWhy? }] } | { error }
//   scriptText(script)               the whole script as he reads it (a comment per line)
//   loggedSql(script, results)       the lines that went in, as one change-log entry
//   lineVerdict(line, result)        'went in' | 'skipped: ...' | 'refused: ...' in plain words
// With a database:
//   runScript(world, script) -> [{ label, ok, rows, code?, error? }]   each line in its own transaction
import { quoteIdent, resolveRoles, ROOM_ROLES, PERSON_ROLES, BOOKING_ROLES } from '../../world/catalogue.js';
import { FILLER, REFUSED } from '../card.js';
import { MEMBERS, PAPER, SHEET, CLASH, at } from './sheet.js';

export const SCRIPTS = Object.freeze({
  paper: { by: 'Priya', when: 'Sunday night, 21:40', title: "Priya's script: Sam's paper bookings",
    intro: "Priya typed her notebook's bookings and Sam's two paper slips into a script and ran it against your tables. She looked rooms and people up by name; one slip only says \"room 7\", so she typed the 7." },
  import: { by: 'Tom', when: 'Monday, 09:05', title: "Tom's import: Sam's spreadsheet",
    intro: "Tom wrote a script for Sam's spreadsheet: one INSERT per line, looking each room and person up by name. A line whose room is not in your rooms table is skipped. Everything goes through your own tables and rules." },
  clash: { by: 'Priya', when: 'Monday, 08:20', title: "Priya's booking this morning",
    intro: 'Jo rang at twenty past eight and Priya booked her the Boardroom, half past eight to half past nine, straight into your bookings table.' },
});

const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const low = (v) => lit(String(v).trim().toLowerCase());
const idCol = (t) => (t.pk?.length === 1 ? t.columns.find((c) => c.name === t.pk[0]) : null);
/* INSERT INTO t (cols) SELECT exprs [WHERE cond]: values are SQL expressions. A key with no default gets the next
   number by hand, and any other column of his that must be filled gets a plain value of its type (a colleague
   fills what she has to; a column the paper knows nothing about is not her business). */
function insertSelect(t, values, where = null) {
  const cols = Object.keys(values);
  const key = idCol(t);
  const own = key && !cols.includes(key.name) && !key.hasDefault ? key : null;
  const extra = t.columns.filter((c) => !c.nullable && !c.hasDefault && !cols.includes(c.name) && c !== own);
  const names = [...(own ? [own.name] : []), ...cols, ...extra.map((c) => c.name)].map(quoteIdent).join(', ');
  const exprs = [...(own ? [`(SELECT COALESCE(max(${quoteIdent(own.name)}), 0) + 1 FROM ${quoteIdent(t.name)})`] : []), ...cols.map((c) => values[c]), ...extra.map((c) => (FILLER[c.cls] != null ? lit(FILLER[c.cls]) : 'NULL'))];
  return `INSERT INTO ${quoteIdent(t.name)} (${names})\n  SELECT ${exprs.join(', ')}${where ? `\n  WHERE ${where}` : ''};`;
}
const idByName = (t, nameCol, name) => `(SELECT min(id) FROM ${quoteIdent(t.name)} WHERE lower(trim(${quoteIdent(nameCol)})) = ${low(name)})`;

export function buildScript(id, cat) {
  const meta = SCRIPTS[id];
  if (!meta) return { error: `no script ${id}` };
  const R = cat?.tables?.rooms, P = cat?.tables?.people, B = cat?.tables?.bookings;
  if (!R || !P || !B) return { error: 'the rooms, people and bookings tables must all exist first' };
  const rn = resolveRoles(R, ROOM_ROLES).map.name, pm = resolveRoles(P, PERSON_ROLES).map, bm = resolveRoles(B, BOOKING_ROLES);
  if (!rn || !pm.name || bm.missing.length) return { error: 'a table is missing a column the script needs (a room\'s name, a person\'s name, or a booking\'s room_id, person_id, start_at, end_at)' };
  const lines = [];
  const person = (m) => insertSelect(P, { [pm.name]: lit(m.name), ...(pm.role ? { [pm.role]: lit(m.role) } : {}) }, `NOT EXISTS (SELECT 1 FROM ${quoteIdent(P.name)} WHERE lower(trim(${quoteIdent(pm.name)})) = ${low(m.name)})`);
  const booking = (l, where = null) => insertSelect(B, {
    [bm.map.room_id]: typeof l.room === 'number' ? String(l.room) : idByName(R, rn, l.room),
    [bm.map.person_id]: idByName(P, pm.name, l.who),
    [bm.map.start_at]: lit(at(l.day, l.from)), [bm.map.end_at]: lit(at(l.day, l.to)),
  }, where);
  const label = (l) => `${l.who}, ${typeof l.room === 'number' ? `room ${l.room}` : l.room}, ${l.day} ${l.from}-${l.to}`;
  if (id !== 'clash') for (const m of MEMBERS) lines.push({ label: `${m.name} (a member), if not there yet`, sql: person(m), member: true });
  if (id === 'paper') for (const l of PAPER) lines.push({ label: label(l), sql: booking(l) });
  if (id === 'import') {
    for (const l of SHEET) {
      const roomThere = `EXISTS (SELECT 1 FROM ${quoteIdent(R.name)} WHERE lower(trim(${quoteIdent(rn)})) = ${low(l.room)})`;
      lines.push({ label: label(l), sql: booking(l, roomThere), skipWhy: `there is no room called ${l.room} in your rooms table` });
    }
  }
  if (id === 'clash') lines.push({ label: label(CLASH), sql: booking(CLASH) });
  return { id, ...meta, lines };
}

export const scriptText = (s) => s.lines.map((l) => `-- ${l.label}\n${l.sql}`).join('\n');
export const loggedSql = (s, results) => {
  const ok = s.lines.filter((l, i) => results[i]?.ok);
  return ok.length ? `-- ${s.title} (${s.by}, ${s.when})\n${ok.map((l) => l.sql).join('\n')}` : '';
};
export function lineVerdict(line, r) {
  if (!r) return 'not run';
  if (r.ok) return r.rows > 0 ? 'went in' : line.member ? 'already there' : `skipped: ${line.skipWhy || 'nothing to put in'}`;
  return `refused by your database: ${REFUSED[r.code] || 'one of your rules said no'} (it said: "${String(r.error || '').trim()}")`;
}

export async function runScript(world, script) {
  const out = [];
  for (const l of script.lines) {
    await world.exec('BEGIN');
    try {
      const res = await world.exec(l.sql);
      await world.exec('COMMIT');
      out.push({ label: l.label, ok: true, rows: res.reduce((n, x) => n + (x.affectedRows || 0), 0) });
    } catch (e) {
      try { await world.exec('ROLLBACK'); } catch { /* nothing open */ }
      out.push({ label: l.label, ok: false, rows: 0, code: e?.code || null, error: String(e?.message ?? e) });
    }
  }
  return out;
}
