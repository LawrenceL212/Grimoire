import { SCHEMA, seedSql } from './schema.js';

/* Loaded on demand, not by a static import: if the CDN cannot be reached, the
   failure surfaces from World.create() where the game can report it, instead
   of stopping the whole page's module graph from loading. */
const PGLITE = 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.8/dist/index.js';
// The browser remembers a failed import of a URL, so a retry asks for a new one.
let pglite = null;
let failures = 0;
const loadPGlite = () => (pglite ??= import(failures ? `${PGLITE}?retry=${failures}` : PGLITE)
  .catch((e) => { pglite = null; failures++; throw e; }));

/* One long-lived PostgreSQL per world. Unlike the app's grader, which builds a
   fresh database per run, the world persists across a learner's runs and can be
   snapshotted and restored, so a problem can start from a known checkpoint. */
export class World {
  constructor(db) { this.db = db; }

  // seed: SQL that fills the world instead of seedSql(counts) (the opening chapter's named world, world/named.js)
  static async create(counts = {}, { loadDataDir, seed } = {}) {
    const { PGlite } = await loadPGlite();
    const db = new PGlite(loadDataDir ? { loadDataDir } : {});
    await db.waitReady;
    await db.exec("SET TIME ZONE 'UTC'");
    const world = new World(db);
    if (!loadDataDir) {
      await db.exec(SCHEMA);
      await db.exec(seed ?? seedSql(counts));
    }
    return world;
  }

  async query(sql, params) { return (await this.db.query(sql, params)).rows; }
  async exec(sql) { return this.db.exec(sql); }
  async count(table) { return (await this.query(`SELECT count(*)::int AS n FROM ${table}`))[0].n; }
  async snapshot() { return this.db.dumpDataDir('gzip'); }
  static restore(blob) { return World.create({}, { loadDataDir: blob }); }
  async close() { await this.db.close(); }
}
