/* Drive the repository view the way a learner would, in a real browser:
   open the files, find that only the task's files are writable, fix the bug,
   add a regression test through the UI, run the suite, and submit.

   usage:  npm run serve   then   node scripts/browser/test_repo_ui.mjs      */
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const URL = process.env.GRIMOIRE_URL || 'http://127.0.0.1:8010/index.html';
function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!existsSync(base)) return undefined;
  const dir = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  return dir ? join(base, dir, 'chrome-win', 'chrome.exe') : undefined;
}

const PRICING = 'BULK_THRESHOLD = 10\n\n\ndef line_total(unit_price, quantity):\n' +
  '    total = unit_price * quantity\n    if quantity > BULK_THRESHOLD:\n' +
  '        total = total * 0.9\n    return round(total, 2)\n';
const ch = {
  id: 'ui-repo', type: 'project', layer: 'application',
  repo: {
    files: {
      'shop/__init__.py': '',
      'shop/pricing.py': PRICING,
      'tests/test_pricing.py': 'from shop.pricing import line_total\n\n\n' +
        'def test_large_order():\n    assert line_total(1.0, 20) == 18.0\n',
      'README.md': '# shop\n',
    },
    editable: ['shop/pricing.py'],
    hidden: { 'tests/test_hidden.py': 'from shop.pricing import line_total\n\n\n' +
      'def test_ten():\n    assert line_total(1.0, 10) == 9.0\n' },
    requireRegressionTest: true,
  },
};

const browser = await chromium.launch({ executablePath: findChromium() });
const [vw, vh] = (process.env.VIEWPORT || '1280x900').split('x').map(Number);
const page = await browser.newPage({ viewport: { width: vw, height: vh },
  isMobile: vw < 600, hasTouch: vw < 600 });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

// mount the challenge exactly as the runner does: render, then wire
await page.evaluate((ch) => {
  const G = window.__grimoire;
  const host = document.createElement('div');
  host.id = 'probe';
  host.style.cssText = 'position:fixed;inset:0;overflow:auto;background:#1A1410;z-index:9999;padding:16px';
  const ctx = { dungeon: { id: 'python', lang: 'python', runtime: 'pyodide', disciplineType: 'language' },
                level: 'boss', carry: '' };
  host.innerHTML = G.TYPES.project.render(ch, 'probe', ctx);
  document.body.appendChild(host);
  G.TYPES.project.wire(ch, host, ctx);
  window.__probe = { ch, ctx, host };
}, ch);

const step = async (label, fn) => {
  try { const v = await fn(); console.log(`ok  ${label}${v ? '  ' + v : ''}`); return true; }
  catch (e) { console.log(`XX  ${label}  ${e.message}`); return false; }
};
let good = 0, total = 0;
const run = async (label, fn) => { total++; if (await step(label, fn)) good++; };

await run('every visible file is listed, and hidden checks are not', async () => {
  const tabs = await page.$$eval('#probe [data-path]', (els) => els.map((e) => e.dataset.path));
  if (tabs.includes('tests/test_hidden.py')) throw new Error('a hidden test is exposed');
  if (tabs.length !== 4) throw new Error('tabs: ' + tabs.join(', '));
  return tabs.join('  ');
});
await run('the task file opens first and is writable', async () => {
  const ro = await page.$eval('#probe [data-repota]', (t) => t.readOnly);
  const sel = await page.$eval('#probe [aria-selected="true"]', (b) => b.dataset.path);
  if (ro || sel !== 'shop/pricing.py') throw new Error(`selected ${sel}, readOnly ${ro}`);
  return sel;
});
await run('a file the task does not open is read-only', async () => {
  await page.click('#probe [data-path="tests/test_pricing.py"]');
  const ro = await page.$eval('#probe [data-repota]', (t) => t.readOnly);
  if (!ro) throw new Error('tests/test_pricing.py is writable');
});
await run('fixing the bug marks the file as changed', async () => {
  await page.click('#probe [data-path="shop/pricing.py"]');
  await page.$eval('#probe [data-repota]', (t) => {
    t.value = t.value.replace('quantity > BULK_THRESHOLD', 'quantity >= BULK_THRESHOLD');
    t.dispatchEvent(new Event('input'));
  });
  const dirty = await page.$eval('#probe [data-path="shop/pricing.py"]', (b) => !!b.querySelector('.dot'));
  if (!dirty) throw new Error('no changed marker');
});
await run('a regression test can be added through the UI', async () => {
  await page.click('#probe [data-newtest]');
  await page.fill('#probe [data-newname]', 'tests/test_boundary.py');
  await page.click('#probe [data-newok]');
  const sel = await page.$eval('#probe [aria-selected="true"]', (b) => b.dataset.path);
  const ro = await page.$eval('#probe [data-repota]', (t) => t.readOnly);
  if (sel !== 'tests/test_boundary.py' || ro) throw new Error(`selected ${sel}, readOnly ${ro}`);
  await page.$eval('#probe [data-repota]', (t) => {
    t.value = 'from shop.pricing import line_total\n\n\ndef test_ten_units_are_bulk():\n' +
              '    assert line_total(1.0, 10) == 9.0\n';
    t.dispatchEvent(new Event('input'));
  });
  return sel;
});
await run('a badly named test file is refused with a reason', async () => {
  await page.click('#probe [data-newtest]');
  await page.fill('#probe [data-newname]', 'tests/boundary.py');
  await page.click('#probe [data-newok]');
  const msg = await page.$eval('#probe [data-filemeta]', (m) => m.textContent);
  if (!/test_something\.py/.test(msg)) throw new Error('message: ' + msg);
});
await run('"Run the tests" runs the visible suite only', async () => {
  await page.click('#probe [data-runtests]');
  await page.waitForFunction(() => {
    const o = document.querySelector('#probe [data-repoout]');
    return o && !o.hidden && !/Running/.test(o.textContent);
  }, null, { timeout: 120000 });
  const txt = await page.$eval('#probe [data-repoout]', (o) => o.textContent);
  if (/test_hidden/.test(txt)) throw new Error('hidden test ran in the visible suite');
  if (!/2 of 2 passing/.test(txt)) throw new Error(txt.slice(0, 160));
  return '2 of 2 passing';
});
await run('submitting grades the fix, the hidden checks and the regression test', async () => {
  const res = await page.evaluate(async () => {
    const { ch, ctx, host } = window.__probe;
    return window.__grimoire.TYPES.project.grade(ch, host, ctx);
  });
  if (!res.correct) throw new Error('not accepted: ' + JSON.stringify(res.detail));
  return `${res.detail.passed} of ${res.detail.tests} checks`;
});

console.log(`\n${good} of ${total} steps behave as a learner would need`);
if (errs.length) console.log('page errors:', errs.slice(0, 3));
await page.screenshot({ path: process.env.SHOT || 'repo-ui.png' });
await browser.close();
process.exit(good === total && !errs.length ? 0 : 1);
