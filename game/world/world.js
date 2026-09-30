import { PGlite } from 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.8/dist/index.js';
import { SCHEMA, seedSql } from './schema.js';

/* One long-lived PostgreSQL per world. Unlike the app's grader, which builds a
   fresh database per run, the world persists across a learner's runs and can be
   snapshotted and restored, so a problem can start from a known checkpoint. */
export class World {
  constructor(db) { this.db = db; }

  static async create(counts = {}, { loadDataDir } = {}) {
    const db = new PGlite(loadDataDir ? { loadDataDir } : {});
    await db.waitReady;
    await db.exec("SET TIME ZONE 'UTC'");
    const world = new World(db);
    if (!loadDataDir) {
      await db.exec(SCHEMA);
      await db.exec(seedSql(counts));
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
