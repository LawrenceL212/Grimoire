/* Execute every reference solution in a set of floor fragments through the
   REAL runner in a real browser - Pyodide for Python, the sandboxed worker for
   JavaScript - before the dungeon is assembled.

   A structural validator can only say a challenge is well formed. Only this
   can say its reference solution passes its own tests in the runtime the
   learner will actually use. An author's local CPython run proves the Python
   is right; it proves nothing about whether the runner grades it.

   These harnesses used to live in a temp directory and were lost on restart.
   They carry the project's quality bar, so they live here now.

   usage:
     npm run serve                                  (in another terminal)
     node scripts/browser/verify_fragments.mjs <dungeonId> <file.json>...

   env:
     GRIMOIRE_URL      default http://127.0.0.1:8010/index.html
     CHROMIUM_PATH     default the ms-playwright chromium under LOCALAPPDATA   */
import { chromium } from 'playwright-core';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const URL = process.env.GRIMOIRE_URL || 'http://127.0.0.1:8010/index.html';

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!existsSync(base)) return undefined;
  const dir = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  return dir ? join(base, dir, 'chrome-win', 'chrome.exe') : undefined;
}

const [id, ...files] = process.argv.slice(2);
if (!id || !files.length) {
  console.error('usage: node scripts/browser/verify_fragments.mjs <dungeonId> <file.json>...');
  process.exit(2);
}

const meta = JSON.parse(readFileSync(join(ROOT, 'content', '_floors', `${id}-meta.json`), 'utf8'));
const floors = files.map((f) => JSON.parse(readFileSync(f, 'utf8'))).sort((a, b) => a.n - b.n);
const dungeon = { ...meta, floors };

const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage();
const pageErrs = [];
page.on('pageerror', (e) => pageErrs.push(e.message));
try {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
} catch (e) {
  console.error(`cannot reach ${URL} - is the server running? (npm run serve)`);
  await browser.close();
  process.exit(2);
}
await page.waitForTimeout(4000);

const report = await page.evaluate(async (dungeon) => {
  const runTests = window.__runTests;
  if (!runTests) return { fatal: 'window.__runTests is not exported by index.html' };
  const out = { executed: 0, cases: 0, wholeProgram: 0, fnBased: 0, failures: [] };
  const items = [];
  for (const fl of dungeon.floors) {
    for (const s of fl.lesson?.sections || []) {
      const cp = s.checkpoint;
      if (cp && ['code', 'debug'].includes(cp.type) && cp.tests) {
        items.push({ floor: fl.n, stage: 'checkpoint', ch: cp });
      }
    }
    for (const st of fl.sequence || []) {
      if (st === 'lesson') continue;
      for (const ch of fl[st] || []) {
        if (['code', 'debug', 'design', 'project'].includes(ch.type) && (ch.tests || ch.repo)) {
          items.push({ floor: fl.n, stage: st, ch });
        }
      }
    }
  }
  for (const it of items) {
    const ch = it.ch;
    if (!ch.solution) {
      out.failures.push({ floor: it.floor, id: ch.id, stage: it.stage, why: 'no reference solution' });
      continue;
    }
    out.executed++;
    if (ch.repo) {
      // A repository task is only a task if the ORIGINAL code is broken. A
      // boss whose "bug" already passes every check would reward a learner
      // for changing nothing, so prove the bug first, then the fix.
      out.repos = (out.repos || 0) + 1;
      // Ask it with the regression-test requirement switched OFF. With it on,
      // submitting nothing always fails the regression check, so this would
      // report "broken" for every repository whether or not the code is.
      const asShipped = { ...ch, repo: { ...ch.repo, requireRegressionTest: false } };
      const before = await runTests(dungeon, asShipped, '{}', '');
      out.cases += before.results.length;
      if (before.unavailable) {
        out.failures.push({ floor: it.floor, id: ch.id, stage: it.stage, why: 'runtime unavailable' });
        continue;
      }
      if (before.passed) {
        out.failures.push({ floor: it.floor, id: ch.id, stage: it.stage, mode: 'repository',
          why: 'the ORIGINAL repository already passes every check - there is no bug to fix' });
        continue;
      }
    } else if (ch.fn) out.fnBased++; else out.wholeProgram++;
    let res;
    try {
      res = await runTests(dungeon, ch, ch.solution, '');
    } catch (e) {
      out.failures.push({ floor: it.floor, id: ch.id, stage: it.stage, why: 'runner threw: ' + e.message });
      continue;
    }
    out.cases += res.results.length;
    if (res.unavailable) {
      out.failures.push({ floor: it.floor, id: ch.id, stage: it.stage, why: 'runtime unavailable' });
    } else if (!res.passed) {
      out.failures.push({
        floor: it.floor, id: ch.id, stage: it.stage,
        mode: ch.repo ? 'repository' : ch.fn ? 'fn' : 'whole-program',
        detail: res.results.filter((r) => !r.ok).slice(0, 2).map((r) =>
          `${r.label}: got ${JSON.stringify(r.actual)} want ${JSON.stringify(r.expected)}` +
          (r.error ? ` err=${String(r.error).slice(0, 160)}` : '')),
      });
    }
  }
  return out;
}, dungeon);

if (report.fatal) {
  console.error(report.fatal);
  await browser.close();
  process.exit(2);
}
console.log(`floors             : ${floors.map((f) => f.n).join(', ')}`);
console.log(`solutions executed : ${report.executed}  (${report.wholeProgram} whole-program, ${report.fnBased} fn-based, ${report.repos || 0} repository)`);
console.log(`test cases         : ${report.cases}`);
console.log(`failures           : ${report.failures.length}`);
for (const f of report.failures.slice(0, 15)) {
  console.log(`   floor ${f.floor} ${f.id} [${f.mode || ''} ${f.stage || ''}] ${f.why || ''}`);
  (f.detail || []).forEach((d) => console.log(`      ${d}`));
}
if (pageErrs.length) console.log(`page errors: ${pageErrs.length}`, pageErrs.slice(0, 2));
await browser.close();
process.exit(report.failures.length ? 1 : 0);
