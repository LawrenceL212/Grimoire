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
