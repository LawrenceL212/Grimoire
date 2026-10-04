/* How JavaScript and PHP see the PostgreSQL world, and how their changes get
   back. Both languages get the same three tables. Timestamps cross the boundary
   as ISO-8601 UTC text so neither side depends on a time zone. */
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

const ISO = (c) => `to_char(${c} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ${c}`;
const SELECTS = {
  rooms: 'SELECT id, name, capacity FROM rooms ORDER BY id',
  people: 'SELECT id, name, role FROM people ORDER BY id',
  bookings: `SELECT id, room_id, person_id, ${ISO('start_at')}, ${ISO('end_at')} FROM bookings ORDER BY id`,
};
const ORDER = ['rooms', 'people', 'bookings']; // parents before children

export async function toObjects(world) {
  const out = {};
  for (const t of ORDER) out[t] = await world.query(SELECTS[t]);
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
