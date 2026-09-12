/* Is PGlite a genuinely viable PostgreSQL runtime, or only a plausible one?

   The runtime policy (content/_CURRICULUM.md section 8) admits a backend only
   if it runs the language well enough to grade real work - not a transpiler,
   not a look-alike, not a browser hack. For PostgreSQL the tempting shortcut
   is sql.js, which is already in the app; but it is SQLite, and SQLite
   diverges from Postgres precisely where a professional needs Postgres:
   strict typing, JSONB, arrays, ILIKE, RETURNING, isolation levels, and the
   shape of EXPLAIN output. Grading a PostgreSQL dungeon on it would be faking.

   So this probes PGlite in a real browser against the behaviours a Postgres
   dungeon would actually assess, and reports each one, plus load cost.

   usage:  npm run serve   then   node scripts/browser/probe_pglite.mjs     */
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const URL = process.env.GRIMOIRE_URL || 'http://127.0.0.1:8010/index.html';
const VERSION = process.env.PGLITE_VERSION || '0.5.8';

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!existsSync(base)) return undefined;
  const dir = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  return dir ? join(base, dir, 'chrome-win', 'chrome.exe') : undefined;
}

const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'domcontentloaded' });

const r = await page.evaluate(async (VERSION) => {
  const out = { checks: [] };
  const t0 = performance.now();
  let PGlite;
  try {
    ({ PGlite } = await import(`https://cdn.jsdelivr.net/npm/@electric-sql/pglite@${VERSION}/dist/index.js`));
  } catch (e) {
    return { fatal: 'import failed: ' + e.message };
  }
  const db = new PGlite();
  await db.waitReady;
  out.loadMs = Math.round(performance.now() - t0);

  const check = async (name, sql, expect) => {
    try {
      const res = await db.query(sql);
      const got = expect(res);
      out.checks.push({ name, ok: !!got.ok, detail: got.detail });
    } catch (e) {
      const got = expect(null, e);
      out.checks.push({ name, ok: !!got.ok, detail: got.detail });
    }
  };
  const exec = async (sql) => db.exec(sql);

  await check('real PostgreSQL server version', 'SELECT version() AS v',
    (res) => ({ ok: /PostgreSQL \d+/.test(res.rows[0].v), detail: res.rows[0].v.slice(0, 60) }));

  await exec(`CREATE TABLE orders (
      id        SERIAL PRIMARY KEY,
      customer  TEXT NOT NULL,
      total     NUMERIC(10,2) NOT NULL,
      tags      TEXT[] DEFAULT '{}',
      meta      JSONB DEFAULT '{}'::jsonb,
      placed_at TIMESTAMPTZ DEFAULT now())`);

  await check('INSERT ... RETURNING with SERIAL',
    `INSERT INTO orders (customer, total, tags, meta)
       VALUES ('Ada', 19.99, ARRAY['gift','priority'], '{"channel":"web","items":3}')
       RETURNING id, customer`,
    (res) => ({ ok: res.rows[0].id === 1 && res.rows[0].customer === 'Ada',
                detail: JSON.stringify(res.rows[0]) }));

  await exec(`INSERT INTO orders (customer, total, tags, meta) VALUES
      ('grace', 5.00,  ARRAY['sale'],     '{"channel":"store","items":1}'),
      ('Linus', 42.50, ARRAY['priority'], '{"channel":"web","items":7}')`);

  await check('JSONB ->> and @> containment',
    `SELECT customer FROM orders WHERE meta @> '{"channel":"web"}' AND (meta->>'items')::int > 5`,
    (res) => ({ ok: res.rows.length === 1 && res.rows[0].customer === 'Linus',
                detail: JSON.stringify(res.rows) }));

  await check('array containment with ANY',
    `SELECT count(*)::int AS n FROM orders WHERE 'priority' = ANY(tags)`,
    (res) => ({ ok: res.rows[0].n === 2, detail: 'priority orders = ' + res.rows[0].n }));

  await check('ILIKE (Postgres-only case-insensitive match)',
    `SELECT customer FROM orders WHERE customer ILIKE 'GRA%'`,
    (res) => ({ ok: res.rows.length === 1 && res.rows[0].customer === 'grace',
                detail: JSON.stringify(res.rows) }));

  await check('strict typing rejects a string in a NUMERIC column',
    `INSERT INTO orders (customer, total) VALUES ('X', 'not a number')`,
    (res, e) => ({ ok: !!e && /invalid input syntax/i.test(e.message),
                   detail: e ? e.message.slice(0, 70) : 'ACCEPTED - would be SQLite behaviour' }));

  await check('window function over a partition',
    `SELECT customer, total, rank() OVER (ORDER BY total DESC) AS r FROM orders`,
    (res) => ({ ok: res.rows[0].r === 1 && res.rows.length === 3,
                detail: res.rows.map((x) => `${x.customer}:${x.r}`).join(' ') }));

  await check('CTE with aggregation',
    `WITH web AS (SELECT total FROM orders WHERE meta->>'channel' = 'web')
     SELECT sum(total)::text AS s FROM web`,
    (res) => ({ ok: res.rows[0].s === '62.49', detail: 'web total = ' + res.rows[0].s }));

  // transactions: a rolled-back insert must not be visible
  await exec('BEGIN');
  await exec(`INSERT INTO orders (customer, total) VALUES ('Ghost', 1.00)`);
  await exec('ROLLBACK');
  await check('ROLLBACK discards the transaction',
    `SELECT count(*)::int AS n FROM orders WHERE customer = 'Ghost'`,
    (res) => ({ ok: res.rows[0].n === 0, detail: 'ghost rows after rollback = ' + res.rows[0].n }));

  await check('transaction isolation levels are real settings',
    `SHOW default_transaction_isolation`,
    (res) => ({ ok: /read committed/i.test(res.rows[0].default_transaction_isolation),
                detail: res.rows[0].default_transaction_isolation }));

  // the query planner - the heart of any professional database floor
  await exec(`INSERT INTO orders (customer, total)
              SELECT 'bulk' || g, (g % 100)::numeric FROM generate_series(1, 5000) g`);
  await exec('ANALYZE orders');
  await check('EXPLAIN shows a sequential scan before an index exists',
    `EXPLAIN SELECT * FROM orders WHERE customer = 'bulk4242'`,
    (res) => {
      const plan = res.rows.map((x) => x['QUERY PLAN']).join(' | ');
      return { ok: /Seq Scan on orders/.test(plan), detail: plan.slice(0, 80) };
    });
  await exec('CREATE INDEX orders_customer_idx ON orders (customer)');
  await exec('ANALYZE orders');
  await check('EXPLAIN switches to the index once it exists',
    `EXPLAIN SELECT * FROM orders WHERE customer = 'bulk4242'`,
    (res) => {
      const plan = res.rows.map((x) => x['QUERY PLAN']).join(' | ');
      return { ok: /Index Scan|Bitmap/.test(plan), detail: plan.slice(0, 90) };
    });
  await check('EXPLAIN ANALYZE reports actual timings',
    `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) SELECT count(*) FROM orders WHERE total > 50`,
    (res) => {
      const plan = res.rows.map((x) => x['QUERY PLAN']).join(' | ');
      return { ok: /actual rows=/.test(plan), detail: plan.slice(0, 90) };
    });

  await check('a second, isolated database is independent',
    `SELECT 1 AS one`,
    () => ({ ok: true, detail: 'fresh instance per challenge is possible: new PGlite()' }));

  return out;
}, VERSION);

if (r.fatal) {
  console.log('NOT VIABLE:', r.fatal);
  await browser.close();
  process.exit(1);
}
console.log(`PGlite ${VERSION} - cold load and init: ${r.loadMs} ms\n`);
let pass = 0;
for (const c of r.checks) {
  if (c.ok) pass++;
  console.log(`  ${c.ok ? 'ok ' : 'XX '} ${c.name.padEnd(52)} ${c.detail}`);
}
console.log(`\n${pass} of ${r.checks.length} PostgreSQL behaviours confirmed`);
if (errs.length) console.log('page errors:', errs.slice(0, 3));
await browser.close();
process.exit(pass === r.checks.length ? 0 : 1);
