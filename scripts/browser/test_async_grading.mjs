/* async def returns a coroutine; the harness must await it, or async code can
   never be graded on what it returns. Sync grading must be unaffected.     */
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
const base = join(process.env.LOCALAPPDATA, 'ms-playwright');
const dir = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
const b = await chromium.launch({ executablePath: join(base, dir, 'chrome-win', 'chrome.exe') });
const p = await b.newPage();
await p.goto('http://127.0.0.1:8010/index.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(4000);
const d = { id: 'python', lang: 'python', runtime: 'pyodide', disciplineType: 'language' };
const ch = { id: 'a', type: 'code', fn: 'fetch_all', tests: [
  { input: '[1, 2, 3]', expected: [2, 4, 6] },
  { input: '[]', expected: [] },
  { input: '[5]', expected: [10] } ] };
const good = 'import asyncio\n\nasync def one(x):\n    await asyncio.sleep(0)\n    return x * 2\n\n' +
  'async def fetch_all(xs):\n    return list(await asyncio.gather(*(one(x) for x in xs)))\n';
const wrong = 'import asyncio\n\nasync def fetch_all(xs):\n    return [x * 3 for x in xs]\n';
const sync = 'def fetch_all(xs):\n    return [x * 2 for x in xs]\n';
for (const [name, code, want] of [['correct async', good, true], ['wrong async', wrong, false], ['plain sync still works', sync, true]]) {
  const r = await p.evaluate(async ({ d, ch, code }) => window.__runTests(d, ch, code, ''), { d, ch, code });
  const ok = r.passed === want;
  console.log(`${ok ? 'ok ' : 'XX '} ${name.padEnd(24)} passed=${r.passed}  ${r.results.find((x) => !x.ok)?.actual ?? ''}`);
}
await b.close();
