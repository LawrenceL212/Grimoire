// ddl-log.js: the product arc's company database is made only by the learner. Every run of his that changed it
// (a CREATE, an ALTER, an INSERT...) is kept, in order, as one entry; replaying the entries into an empty
// PostgreSQL gives his world back exactly (SP1: same catalogue, same rows, same ids). That log is the save: a PGlite
// dump starts at 4.4 MB, too big to sit next to the life in localStorage.
//
// Pure (node-tested):
//   stripSql(code)            the code without comments and string contents (for shape tests only)
//   isChange(code)            the code can change the database (DDL, DML, setval): worth keeping
//   isDdl(code)               it changes the shape (CREATE / ALTER / DROP / TRUNCATE / COMMENT ON)
//   append(log, sql, meta)    a new log with one more entry { sql, ddl, card, atMs } (a run that changed nothing is not kept)
//   upTo(log, n)              the first n entries (Reset: back to how the database was when a ticket arrived)
//   ddlOf(log)                the entries that changed the shape: the DDL log (a shadow world is built from these)
//   cleanLog(raw)             a stored log, checked entry by entry (anything odd is dropped, never trusted)
// With a database:
//   replay(world, entries) -> { ok, applied, error?, at? }   each entry in its own transaction, as it first ran
//   rebuild(World, entries) -> { world, applied, error?, at? }  an empty world with the entries replayed
//   shadowFromDdl(World, entries) -> world                      the same tables, no rows
export const LOG_LIMITS = Object.freeze({ entries: 2000, chars: 20000 });

export function stripSql(code) {
  return String(code ?? '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, "''")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, 'x');
}
const DDL = /\b(create|alter|drop|truncate|comment\s+on)\b/i;
const DML = /\b(insert\s+into|update\s+\S+\s+set|delete\s+from|merge\s+into|grant|revoke)\b|\b(setval|nextval)\s*\(/i;
export const isDdl = (code) => DDL.test(stripSql(code));
export const isChange = (code) => { const s = stripSql(code); return DDL.test(s) || DML.test(s); };

export function append(log, sql, { card = null, atMs = null } = {}) {
  const list = Array.isArray(log) ? log : [];
  const text = String(sql ?? '');
  if (!text.trim() || !isChange(text) || text.length > LOG_LIMITS.chars || list.length >= LOG_LIMITS.entries) return list;
  return [...list, { sql: text, ddl: isDdl(text), card: typeof card === 'string' ? card : null, atMs: Number.isFinite(atMs) ? atMs : null }];
}
export const upTo = (log, n) => (Array.isArray(log) ? log.slice(0, Math.max(0, Math.min(log.length, Number.isInteger(n) ? n : log.length))) : []);
export const ddlOf = (log) => (Array.isArray(log) ? log.filter((e) => e.ddl) : []);

export function cleanLog(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const e of raw.slice(0, LOG_LIMITS.entries)) {
    if (!e || typeof e !== 'object' || typeof e.sql !== 'string' || !e.sql.trim() || e.sql.length > LOG_LIMITS.chars || !isChange(e.sql)) continue;
    out.push({ sql: e.sql, ddl: isDdl(e.sql), card: typeof e.card === 'string' ? e.card : null, atMs: Number.isFinite(e.atMs) ? e.atMs : null });
  }
  return out;
}

// one entry runs exactly as the learner's run did (runners/sql.js): one transaction, all or nothing
async function runOne(world, sql) {
  await world.exec('BEGIN');
  try { await world.exec(sql); await world.exec('COMMIT'); } catch (e) { try { await world.exec('ROLLBACK'); } catch { /* nothing open */ } throw e; }
}
export async function replay(world, entries) {
  let applied = 0;
  for (const e of entries || []) {
    try { await runOne(world, e.sql); applied++; } catch (err) { return { ok: false, applied, at: applied, error: String(err?.message ?? err) }; }
  }
  return { ok: true, applied };
}
export async function rebuild(World, entries) {
  const world = await World.create({}, { empty: true });
  const r = await replay(world, entries);
  return { world, ...r };
}
export async function shadowFromDdl(World, entries) {
  const world = await World.create({}, { empty: true });
  const r = await replay(world, ddlOf(entries));
  if (!r.ok) throw new Error(`the shadow world could not be built: ${r.error}`);
  return world;
}
