/* How JavaScript and PHP see the PostgreSQL world, and how their changes get
   back. Both languages get the same three tables. Timestamps cross the boundary
   as ISO-8601 UTC text so neither side depends on a time zone. */
import { readCatalogue, resolveRoles, quoteIdent, ROOM_ROLES, PERSON_ROLES, BOOKING_ROLES } from './catalogue.js';
export const TABLES = {
  rooms: { id: 'INTEGER PRIMARY KEY', name: 'TEXT', capacity: 'INTEGER' },
  people: { id: 'INTEGER PRIMARY KEY', name: 'TEXT', role: 'TEXT' },
  bookings: {
    id: 'INTEGER PRIMARY KEY', room_id: 'INTEGER', person_id: 'INTEGER',
    start_at: 'TEXT', end_at: 'TEXT',
  },
};

export const LIMITS = Object.freeze({ rowsPerTable: 5000, stringChars: 500, keysPerRow: 50 });

/* What a learner's answer may put into the world: at most 5,000 rows per table, strings of at most 500
   characters, finite numbers, no nested values. Unknown tables and keys are dropped. Returns { world } with the
   cleaned copy, or { error } in plain words; it never throws. host.js carries a copy of this check (it cannot
   import modules), so keep the two in step. */
export function sanitizeWorld(objects) {
  if (objects === null || typeof objects !== 'object' || Array.isArray(objects)) return { error: 'Your code must leave `world` as an object of tables.' };
  const world = {};
  for (const t of Object.keys(TABLES)) {
    const rows = objects[t];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) return { error: `world.${t} must be a list of rows.` };
    if (rows.length > LIMITS.rowsPerTable) return { error: `Your code returned too many rows (limit ${LIMITS.rowsPerTable.toLocaleString('en-US')} per table).` };
    const cols = Object.keys(TABLES[t]);
    const clean = [];
    for (const row of rows) {
      if (row === null || typeof row !== 'object' || Array.isArray(row)) return { error: `Every row in world.${t} must be an object.` };
      let keys = 0;
      for (const _k in row) if (++keys > LIMITS.keysPerRow) return { error: `A row in world.${t} has too many fields.` };
      const o = {};
      for (const c of cols) {
        const v = Object.hasOwn(row, c) ? row[c] : undefined;
        if (v === undefined || v === null) continue;
        if (typeof v === 'string') { if (v.length > LIMITS.stringChars) return { error: `A text value in world.${t} is longer than ${LIMITS.stringChars} characters.` }; }
        else if (typeof v === 'number') { if (!Number.isFinite(v)) return { error: `A number in world.${t} is not finite.` }; }
        else return { error: `A value in world.${t}.${c} is not text or a number.` };
        o[c] = v;
      }
      clean.push(o);
    }
    world[t] = clean;
  }
  return { world };
}

// a moment as ISO-8601 UTC text, whether his column keeps the zone (TIMESTAMPTZ) or not (TIMESTAMP is read as UTC,
// the session's zone, which is how every script and probe of the game writes it)
const ISO = (expr, as) => `to_char(${expr} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ${as}`;
const ORDER = ['rooms', 'people', 'bookings']; // parents before children

/* The world as objects, always under the house names (rooms: id, name, capacity; people: id, name, role; bookings:
   id, room_id, person_id, start_at, end_at), so the office, bridge.js, JavaScript and PHP read any world the same
   way. The seeded worlds have exactly SCHEMA's columns. The product arc's world is the learner's own (PC-4, the
   read side): a table may not exist yet (no rows), and his columns are found by role (catalogue.js): the room's
   name is his text column and its seats his whole-number column, whatever he called them; a person's role only if
   he made one; a booking's columns by the house names. A missing column reads as null. */
const STANDARD = { rooms: ['id', 'name', 'capacity'], people: ['id', 'name', 'role'], bookings: ['id', 'room_id', 'person_id', 'start_at', 'end_at'] };
const ROLES_OF = { rooms: ROOM_ROLES, people: PERSON_ROLES, bookings: BOOKING_ROLES };
const TIMES = new Set(['timestamptz', 'timestamp']);
export function selectFor(t, table) {
  if (!table.columns.some((c) => c.name === 'id')) return null;
  const cls = Object.fromEntries(table.columns.map((c) => [c.name, c.cls]));
  const { map } = resolveRoles(table, ROLES_OF[t]);
  const parts = ['id'];
  for (const role of STANDARD[t].slice(1)) {
    const col = map[role];
    if (!col) parts.push(`NULL AS ${role}`);
    else if (TIMES.has(cls[col])) parts.push(ISO(quoteIdent(col), role));
    else parts.push(col === role ? role : `${quoteIdent(col)} AS ${role}`);
  }
  return `SELECT ${parts.join(', ')} FROM ${t} ORDER BY id`;
}
export async function toObjects(world) {
  // the catalogue first: a query on a table that is not there would abort a transaction this runs inside
  const cat = await readCatalogue(world);
  const out = {};
  for (const t of ORDER) {
    const sql = cat.tables[t] ? selectFor(t, cat.tables[t]) : null;
    out[t] = sql ? await world.query(sql) : [];
  }
  return out;
}

/* Replace the world's rows with the given objects, in one transaction. Rows
   without an id get the next one. Any failure (a foreign key, a CHECK) rolls
   everything back so a bad answer can never half-change the world. */
export async function applyObjects(world, objects) {
  const checked = sanitizeWorld(objects);
  if (checked.error) throw new Error(checked.error);
  objects = checked.world;
  await world.exec('BEGIN');
  try {
    await world.exec('TRUNCATE bookings, people, rooms RESTART IDENTITY');
    for (const t of ORDER) {
      const rows = objects[t] || [];
      const cols = Object.keys(TABLES[t]);
      let nextId = 1 + rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
      const marks = cols.map((_, i) => `$${i + 1}`).join(', ');
      for (const row of rows) {
        const values = cols.map((c) => (c === 'id' ? (row.id ?? nextId++) : (row[c] ?? null)));
        await world.db.query(`INSERT INTO ${t} (${cols.join(', ')}) VALUES (${marks})`, values);
      }
      await world.exec(
        `SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT max(id) FROM ${t}), 1), ` +
        `(SELECT count(*) > 0 FROM ${t}))`);
    }
    await world.exec('COMMIT');
  } catch (e) {
    await world.exec('ROLLBACK');
    throw e;
  }
}
