/* Prove the repository runner grades a Stage 4 task honestly, before any
   floor is written on it.

   The fixture is a small but real package with a genuine boundary bug,
   reported the way a user would report it - by symptom. The runner must not
   merely accept the right answer; it must refuse every plausible wrong one:

     1. the original code fails the hidden checks - the bug is real
     2. the reference fix plus a regression test passes everything
     3. a correct fix with no regression test is refused
     4. a regression test that does not exercise the bug is refused, because
        it passes against the original code too
     5. a "fix" that breaks existing behaviour is caught by the other tests
     6. editing a file the task does not open is refused
     7. two runs in one interpreter do not leak modules into each other -
        Pyodide keeps a single interpreter alive, so a second run could
        otherwise silently test the first run's code

   usage:  npm run serve   then   node scripts/browser/test_repo_runner.mjs    */
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

const PRICING = [
  '"""Line and order pricing for the shop."""',
  '',
  'BULK_THRESHOLD = 10      # orders of this many units or more are "bulk"',
  'BULK_DISCOUNT = 0.10     # ten per cent off a bulk line',
  '',
  '',
  'def line_total(unit_price, quantity):',
  '    """Price one line of an order, applying the bulk discount if earned."""',
  '    if quantity < 0:',
  '        raise ValueError("quantity cannot be negative")',
  '    total = unit_price * quantity',
  '    if quantity > BULK_THRESHOLD:',
  '        total = total * (1 - BULK_DISCOUNT)',
  '    return round(total, 2)',
  '',
].join('\n');

const CART = [
  '"""A shopping cart that prices its lines through shop.pricing."""',
  'from shop.pricing import line_total',
  '',
  '',
  'class Cart:',
  '    def __init__(self):',
  '        self.lines = []',
  '',
  '    def add(self, unit_price, quantity):',
  '        self.lines.append((unit_price, quantity))',
  '',
  '    def total(self):',
  '        return round(sum(line_total(p, q) for p, q in self.lines), 2)',
  '',
].join('\n');

const EXISTING_TESTS = [
  'from shop.cart import Cart',
  'from shop.pricing import line_total',
  '',
  '',
  'def test_single_item():',
  '    assert line_total(2.50, 1) == 2.50',
  '',
  '',
  'def test_large_order_is_discounted():',
  '    assert line_total(1.00, 20) == 18.00',
  '',
  '',
  'def test_cart_sums_its_lines():',
  '    c = Cart()',
  '    c.add(2.00, 3)',
  '    c.add(1.00, 20)',
  '    assert c.total() == 24.00',
  '',
  '',
  'def test_negative_quantity_is_rejected():',
  '    try:',
  '        line_total(1.00, -1)',
  '    except ValueError:',
  '        return',
  '    assert False, "expected ValueError"',
  '',
].join('\n');

const HIDDEN = [
  'from shop.pricing import line_total',
  '',
  '',
  'def test_exactly_the_threshold_is_bulk():',
  '    assert line_total(1.00, 10) == 9.00',
  '',
  '',
  'def test_one_below_the_threshold_is_not_bulk():',
  '    assert line_total(1.00, 9) == 9.00',
  '',
  '',
  'def test_one_above_the_threshold_is_bulk():',
  '    assert line_total(1.00, 11) == 9.90',
  '',
].join('\n');

const challenge = {
  id: 'fixture-repo', type: 'project', layer: 'application',
  repo: {
    files: {
      'shop/__init__.py': '',
      'shop/pricing.py': PRICING,
      'shop/cart.py': CART,
      'tests/test_cart.py': EXISTING_TESTS,
      'README.md': '# shop\n\nRun the tests with `python run_tests.py`.\n',
    },
    editable: ['shop/pricing.py', 'shop/cart.py'],
    hidden: { 'tests/test_hidden_pricing.py': HIDDEN },
    requireRegressionTest: true,
  },
};

const FIXED = PRICING.replace('if quantity > BULK_THRESHOLD:', 'if quantity >= BULK_THRESHOLD:');
const GOOD_TEST = [
  'from shop.pricing import line_total',
  '',
  '',
  'def test_ten_units_get_the_bulk_discount():',
  '    # reported: "ordering exactly 10 does not get the bulk discount"',
  '    assert line_total(1.00, 10) == 9.00',
  '',
].join('\n');
const USELESS_TEST = [
  'from shop.pricing import line_total',
  '',
  '',
  'def test_twenty_units_are_discounted():',
  '    assert line_total(1.00, 20) == 18.00',
  '',
].join('\n');
// Overshoots the boundary, so nine units become bulk too - a hidden check
// must catch it. (An earlier version of this fixture set the threshold to 9
// and kept `>`. For whole-number quantities `> 9` IS `>= 10`, so that was a
// correct fix phrased differently, and the runner rightly passed it: it
// grades behaviour, not text. The fixture was wrong, not the runner.)
const WRONG_FIX = PRICING.replace('if quantity > BULK_THRESHOLD:', 'if quantity >= BULK_THRESHOLD - 1:');

const cases = [
  { name: 'original code is broken (the bug is real)',
    submission: {}, expectPass: false, requireFailOn: 'hidden check' },
  { name: 'reference fix plus regression test passes',
    submission: { 'shop/pricing.py': FIXED, 'tests/test_bulk_boundary.py': GOOD_TEST },
    expectPass: true },
  { name: 'a correct fix with no regression test is refused',
    submission: { 'shop/pricing.py': FIXED },
    expectPass: false, requireFailOn: 'regression test' },
  { name: 'a test that does not exercise the bug is refused',
    submission: { 'shop/pricing.py': FIXED, 'tests/test_bulk_boundary.py': USELESS_TEST },
    expectPass: false, requireFailOn: 'fails on the original' },
  { name: 'a "fix" that breaks the nine-unit case is caught',
    submission: { 'shop/pricing.py': WRONG_FIX, 'tests/test_bulk_boundary.py': GOOD_TEST },
    expectPass: false, requireFailOn: 'one_below_the_threshold' },
  { name: 'editing a file the task does not open is refused',
    submission: { 'shop/pricing.py': FIXED, 'tests/test_bulk_boundary.py': GOOD_TEST,
                  'tests/test_cart.py': '' },
    expectPass: false, requireFailOn: 'scope of the change' },
];

const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

const dungeon = { id: 'python', lang: 'python', runtime: 'pyodide', disciplineType: 'language' };
let bad = 0;
for (const c of cases) {
  const res = await page.evaluate(async ({ dungeon, ch, sub }) =>
    window.__runTests(dungeon, ch, JSON.stringify(sub), ''), { dungeon, ch: challenge, sub: c.submission });
  const failures = res.results.filter((r) => !r.ok).map((r) => `${r.label}: ${r.error || ''}`);
  let ok = res.passed === c.expectPass;
  if (ok && c.requireFailOn) ok = failures.some((f) => f.includes(c.requireFailOn));
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'XX '} ${c.name}`);
  console.log(`      passed=${res.passed}  ${res.results.length} checks` +
    (failures.length ? `  first failure: ${failures[0].slice(0, 110)}` : ''));
}

// the explanation: a professional change arrives with its reasoning
const explained = { ...challenge, repo: { ...challenge.repo,
  files: { ...challenge.repo.files, 'CHANGES.md': '# What changed and why\n\n' },
  editable: [...challenge.repo.editable, 'CHANGES.md'],
  explanation: { file: 'CHANGES.md',
    rubric: { required: ['boundary', 'regression', 'threshold'], minWords: 25 } } } };
const WHY = '# What changed and why\n\nThe bulk discount used a strict comparison, so an ' +
  'order of exactly the threshold quantity missed it - an off-by-one at the boundary. ' +
  'I changed it to include the threshold and added a regression test for ten units.\n';
const fixAndTest = { 'shop/pricing.py': FIXED, 'tests/test_bulk_boundary.py': GOOD_TEST };
const explainCases = [
  { name: 'a fix with no written explanation is refused',
    sub: fixAndTest, expectPass: false, requireFailOn: 'explanation' },
  { name: 'an explanation that misses the point is refused',
    sub: { ...fixAndTest, 'CHANGES.md': '# Changes\n\nFixed the pricing bug. It works now and ' +
           'the tests pass. I tidied a little while I was there as well, nothing major.\n' },
    expectPass: false, requireFailOn: 'does not address' },
  { name: 'a fix with a real explanation passes',
    sub: { ...fixAndTest, 'CHANGES.md': WHY }, expectPass: true },
];
for (const c of explainCases) {
  const res = await page.evaluate(async ({ dungeon, ch, sub }) =>
    window.__runTests(dungeon, ch, JSON.stringify(sub), ''), { dungeon, ch: explained, sub: c.sub });
  const failures = res.results.filter((r) => !r.ok).map((r) => `${r.label}: ${r.error || ''}`);
  let ok = res.passed === c.expectPass;
  if (ok && c.requireFailOn) ok = failures.some((f) => f.includes(c.requireFailOn));
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'XX '} ${c.name}`);
  console.log(`      passed=${res.passed}` + (failures.length ? `  ${failures[0].slice(0, 120)}` : ''));
}

// isolation: the same interpreter, two different versions of one module
const iso = await page.evaluate(async ({ dungeon }) => {
  const mk = (v) => ({ id: 'iso', type: 'project', repo: {
    files: { 'pkg/__init__.py': '', 'pkg/m.py': `VALUE = ${v}\n`,
             'tests/test_v.py': `from pkg.m import VALUE\n\ndef test_value():\n    assert VALUE == ${v}, VALUE\n` } } });
  const a = await window.__runTests(dungeon, mk(1), '{}', '');
  const b = await window.__runTests(dungeon, mk(2), '{}', '');
  return { a: a.passed, b: b.passed, bErr: b.results.find((r) => !r.ok)?.error || null };
}, { dungeon });
const isoOk = iso.a && iso.b;
if (!isoOk) bad++;
console.log(`${isoOk ? 'ok ' : 'XX '} two runs in one interpreter do not leak modules`);
console.log(`      first run passed=${iso.a}, second run passed=${iso.b}${iso.bErr ? '  ' + iso.bErr : ''}`);

console.log(`\n${bad ? bad + ' CASE(S) WRONG' : 'the repository runner grades every case correctly'}`);
if (errs.length) console.log('page errors:', errs.slice(0, 3));
await browser.close();
process.exit(bad ? 1 : 0);
