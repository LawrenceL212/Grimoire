// catalogue.js: what the learner's own database looks like, read from PostgreSQL's catalogue (SP1:
// information_schema.columns for columns and types, pg_constraint + pg_get_constraintdef for keys and rules).
// In the product arc the tables are his: the house convention fixes the table, key, link and time names
// (rooms, id, room_id, start_at); the other columns are his choice, so a reader finds them by ROLE (the
// room's name: a text column, preferably called name; its seats: a whole-number column...).
//
// Pure (node-tested):
//   typeClass(dataType)                 'integer' | 'number' | 'text' | 'timestamptz' | 'timestamp' | 'date' | 'boolean' | 'other'
//   resolveRoles(table, roles)          { map: { role: column }, missing: [role] }   roles: { role: { cls: [...], prefer: RegExp } }
//   quoteIdent(name)                    "name" (safe in SQL)
//   ROOM_ROLES                          how a room's name and seats are found in his rooms table
//   PERSON_ROLES, BOOKING_ROLES         the same for people (a name; a role only if he made one) and bookings (the
//                                       house names room_id, person_id, start_at, end_at, found by name only)
//   schemaChoices(cat)                  the decisions in his schema the director will read later (product arc 4.3)
// With a database:
//   readCatalogue(world) -> { tables: { [name]: { name, columns: [{ name, type, cls, nullable, hasDefault, identity }], pk: [col], constraints: [{ name, type, def }] } } }
//                          identity: 'ALWAYS' | 'BY DEFAULT' for an identity column, else null
export function typeClass(t) {
  const s = String(t || '').toLowerCase();
  if (/^(integer|smallint|bigint)$/.test(s)) return 'integer';
  if (/^(numeric|real|double precision|decimal)$/.test(s)) return 'number';
  if (/^(text|character varying|character|varchar|char|citext)$/.test(s)) return 'text';
  if (s === 'timestamp with time zone') return 'timestamptz';
  if (s === 'timestamp without time zone') return 'timestamp';
  if (s === 'date') return 'date';
  if (s === 'boolean') return 'boolean';
  return 'other';
}
export const quoteIdent = (n) => `"${String(n).replace(/"/g, '""')}"`;

export const ROOM_ROLES = Object.freeze({
  name: { cls: ['text'], prefer: /^(name|room_?name|title|label)$/i },
  capacity: { cls: ['integer', 'number'], prefer: /^(capacity|seats|size|places|people|max)/i },
});
// a role marked exact is found by its name only (the house convention fixes it: never "the first text column");
// optional: a table without it still passes (the role reads as empty)
export const PERSON_ROLES = Object.freeze({
  name: { cls: ['text'], prefer: /^(name|full_?name|person_?name)$/i },
  role: { cls: ['text'], prefer: /^role$/i, exact: true, optional: true },
});
// bookings (milestone M-C): the house convention names every column a card needs, so each is found by its name
export const BOOKING_ROLES = Object.freeze({
  room_id: { cls: ['integer'], prefer: /^room_id$/i, exact: true },
  person_id: { cls: ['integer'], prefer: /^person_id$/i, exact: true },
  start_at: { cls: ['timestamptz', 'timestamp'], prefer: /^start_at$/i, exact: true },
  end_at: { cls: ['timestamptz', 'timestamp'], prefer: /^end_at$/i, exact: true },
});

/* Each role takes, in turn: a column with a preferred name and the right type class; else the first column of the
   right class; else a column with a preferred name of any class (so `capacity TEXT` is found, and then judged by
   what it does); else nothing (the role is missing). Key columns (the primary key) never take a role. */
export function resolveRoles(table, roles) {
  const map = {}, missing = [];
  if (!table) return { map, missing: Object.keys(roles) };
  const free = table.columns.filter((c) => !(table.pk || []).includes(c.name));
  const taken = new Set();
  for (const [role, r] of Object.entries(roles)) {
    const open = free.filter((c) => !taken.has(c.name));
    const col = r.exact ? open.find((c) => r.prefer.test(c.name))
      : open.find((c) => r.prefer?.test(c.name) && r.cls.includes(c.cls))
      || open.find((c) => r.cls.includes(c.cls))
      || open.find((c) => r.prefer?.test(c.name));
    if (col) { map[role] = col.name; taken.add(col.name); } else missing.push(role);
  }
  return { map, missing };
}

export async function readCatalogue(world) {
  const cols = await world.query(`SELECT c.table_name AS t, c.column_name AS name, c.data_type AS type, c.is_nullable = 'YES' AS nullable,
      c.column_default IS NOT NULL OR c.is_identity = 'YES' AS has_default, CASE WHEN c.is_identity = 'YES' THEN c.identity_generation END AS ident
    FROM information_schema.columns c JOIN information_schema.tables x ON x.table_schema = c.table_schema AND x.table_name = c.table_name
    WHERE c.table_schema = 'public' AND x.table_type = 'BASE TABLE' ORDER BY c.table_name, c.ordinal_position`);
  const tables = {};
  for (const c of cols) {
    const t = tables[c.t] ??= { name: c.t, columns: [], pk: [], constraints: [] };
    t.columns.push({ name: c.name, type: c.type, cls: typeClass(c.type), nullable: !!c.nullable, hasDefault: !!c.has_default, identity: c.ident || null });
  }
  if (!Object.keys(tables).length) return { tables };
  const cons = await world.query(`SELECT r.relname AS t, k.conname AS name, k.contype AS type, pg_get_constraintdef(k.oid) AS def,
      ARRAY(SELECT a.attname FROM unnest(k.conkey) WITH ORDINALITY u(n, i) JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = u.n ORDER BY u.i)::text[] AS cols,
      f.relname AS ref
    FROM pg_constraint k JOIN pg_class r ON r.oid = k.conrelid JOIN pg_namespace s ON s.oid = r.relnamespace
    LEFT JOIN pg_class f ON f.oid = k.confrelid
    WHERE s.nspname = 'public' AND k.contype <> 'n' ORDER BY r.relname, k.conname`);
  for (const k of cons) {
    const t = tables[k.t];
    if (!t) continue;
    const colsOf = Array.isArray(k.cols) ? k.cols : String(k.cols || '').replace(/[{}]/g, '').split(',').filter(Boolean);
    t.constraints.push({ name: k.name, type: k.type, def: k.def, cols: colsOf, ref: k.ref || null });
    if (k.type === 'p') t.pk = colsOf;
  }
  return { tables };
}

/* Pure: what he decided in his schema (recorded at each arc solve, for later problems: TIMESTAMP without a zone
   triggers P12, no CHECK on the times P4, no link rule S5's branch). Nothing here is graded. */
export function schemaChoices(cat) {
  const b = cat?.tables?.bookings, out = {};
  if (!b) return out;
  const col = (n) => b.columns.find((c) => c.name === n);
  out.timesType = col('start_at')?.cls ?? null;
  const fk = (c, ref) => b.constraints.some((k) => k.type === 'f' && k.ref === ref && k.cols.includes(c));
  out.roomLink = fk('room_id', 'rooms');
  out.personLink = fk('person_id', 'people');
  out.timesCheck = b.constraints.some((k) => k.type === 'c' && /end_at/.test(k.def) && /start_at/.test(k.def));
  return out;
}
