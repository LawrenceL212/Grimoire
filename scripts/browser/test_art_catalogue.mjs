/* Art catalogue: every registered asset, in every theme preset, builds cleanly
   within its footprint and triangle budget; the review page works. */
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame('game/art/catalogue.html', { context: { viewport: { width: 1280, height: 800 } } });
try {
  await page.waitForFunction(() => window.__catalogue && window.__catalogue.ready === true, null, { timeout: 30000 });
} catch (e) {
  t.check('the catalogue signals ready', false, String(e).split('\n')[0]);
  await close();
  t.finish(); // exits the process with status 1: nothing below runs
  process.exit(1);
}
t.check('the catalogue signals ready', true);

// ---- every asset x every preset: our own checks, straight from the registry ----
const r = await page.evaluate(async () => {
  const reg = await import('./registry.js');
  await import('./index.js');
  const th = await import('../engine/theme.js');
  const assets = reg.list();
  const rows = [];
  for (const preset of Object.keys(th.PRESETS)) {
    th.applyPreset(preset);
    for (const a of assets) {
      const row = { preset, id: a.id, category: a.category, tiles: a.tiles, budget: a.budget };
      try {
        const o = reg.make(a.id, {});
        const m = reg.measure(o);
        Object.assign(row, { assetId: o.userData.assetId, triangles: m.triangles, outlineTriangles: m.outlineTriangles, hasNaN: m.hasNaN, bbox: m.bbox, bounds: m.bounds, drawables: m.drawables });
      } catch (e) { row.error = String(e && e.stack || e); }
      rows.push(row);
    }
  }
  th.resetTheme();
  return { presets: Object.keys(th.PRESETS), assets, rows };
});

t.check('the registry lists at least one asset', r.assets.length > 0, String(r.assets.length));
t.check('all four presets are exercised', r.presets.length === 4, r.presets.join(', '));
const TOL = 1.05, EPS = 1e-6;
const bad = { build: [], id: [], nan: [], budget: [], footprint: [], height: [], empty: [] };
for (const row of r.rows) {
  const tag = `${row.id}@${row.preset}`;
  if (row.error) { bad.build.push(`${tag}: ${row.error.split('\n')[0]}`); continue; }
  if (row.assetId !== row.id) bad.id.push(tag);
  if (row.hasNaN !== false) bad.nan.push(tag);
  const meshTris = row.triangles - row.outlineTriangles; // budgets exclude outline hulls (ruling P2-4)
  if (!(meshTris <= row.budget)) bad.budget.push(`${tag} ${meshTris}/${row.budget}`);
  if (!row.bounds || row.drawables === 0) { bad.empty.push(tag); continue; }
  const [w, d] = row.tiles;
  const hx = (w / 2) * TOL + EPS, hz = (d / 2) * TOL + EPS;
  const { min, max } = row.bounds;
  if (row.bbox.w > w * TOL + EPS || row.bbox.d > d * TOL + EPS || min[0] < -hx || max[0] > hx || min[2] < -hz || max[2] > hz) {
    bad.footprint.push(`${tag} ${row.bbox.w.toFixed(2)}x${row.bbox.d.toFixed(2)} in ${w}x${d}, x ${min[0].toFixed(2)}..${max[0].toFixed(2)} z ${min[2].toFixed(2)}..${max[2].toFixed(2)}`);
  }
  if (row.category !== 'structure' && !(row.bbox.h < 3.2)) bad.height.push(`${tag} h=${row.bbox.h.toFixed(2)}`);
}
t.check('every asset builds in every preset', bad.build.length === 0, bad.build.slice(0, 5).join(' | '));
t.check('make() stamps userData.assetId', bad.id.length === 0, bad.id.slice(0, 5).join(', '));
t.check('no asset has NaN geometry', bad.nan.length === 0, bad.nan.slice(0, 5).join(', '));
t.check('every asset draws something', bad.empty.length === 0, bad.empty.slice(0, 5).join(', '));
t.check('every asset is within its triangle budget (mesh triangles, outline hulls excluded)', bad.budget.length === 0, bad.budget.slice(0, 5).join(', '));
t.check('every asset fits its footprint, centred on the origin (5% tolerance)', bad.footprint.length === 0, bad.footprint.slice(0, 5).join(' | '));
t.check('every non-structure asset is under 3.2 units tall', bad.height.length === 0, bad.height.slice(0, 5).join(', '));
t.note('checked', `${r.assets.length} assets x ${r.presets.length} presets = ${r.rows.length} builds`);

// ---- the page itself ----
const ui = await page.evaluate(async () => {
  const reg = await import('./registry.js');
  const out = {};
  const cards = [...document.querySelectorAll('[data-asset]')];
  out.cardCount = cards.length;
  out.total = reg.list().length;
  out.labelled = cards.every((c) => c.textContent.includes(c.dataset.asset) && /\d/.test(c.querySelector('[data-tris]')?.textContent || '') && /\d/.test(c.querySelector('[data-foot]')?.textContent || ''));
  out.presetOptions = [...document.querySelectorAll('#preset option:not([disabled])')].map((o) => o.value);
  // thumbnails were actually drawn (some non-transparent pixel in the first card)
  await new Promise((res) => setTimeout(res, 600));
  const cv = cards[0]?.querySelector('canvas');
  if (cv) {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let lit = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) lit++;
    out.thumbPixels = lit;
  }
  // filter by category, then sector
  const cat = document.getElementById('category');
  const first = reg.list()[0];
  cat.value = first.category; cat.dispatchEvent(new Event('change'));
  out.catShown = cards.filter((c) => !c.hidden).map((c) => c.dataset.asset);
  out.catExpected = reg.list({ category: first.category }).map((a) => a.id);
  cat.value = ''; cat.dispatchEvent(new Event('change'));
  const sec = document.getElementById('sector');
  const secVal = reg.list().at(-1).sector;
  sec.value = secVal; sec.dispatchEvent(new Event('change'));
  out.secShown = cards.filter((c) => !c.hidden).map((c) => c.dataset.asset);
  out.secExpected = reg.list({ sector: secVal }).map((a) => a.id);
  sec.value = ''; sec.dispatchEvent(new Event('change'));
  out.allBack = cards.every((c) => !c.hidden);
  // preset switcher drives the theme
  const th = await import('../engine/theme.js');
  const sel = document.getElementById('preset');
  sel.value = 'Night lab'; sel.dispatchEvent(new Event('change'));
  out.presetApplied = th.get('palette.bg') === th.PRESETS['Night lab'].palette.bg;
  th.applyPreset('Bright day');
  out.selectFollows = sel.value === 'Bright day';
  th.set('palette.gold', '#123456');
  out.customShown = sel.value === '';
  sel.value = 'Warm dusk'; sel.dispatchEvent(new Event('change'));
  return out;
});
t.check('one labelled card per asset (id, triangles, footprint)', ui.cardCount === ui.total && ui.labelled === true, `${ui.cardCount}/${ui.total} labelled=${ui.labelled}`);
t.check('the thumbnails are drawn', ui.thumbPixels > 100, String(ui.thumbPixels));
t.check('the category filter shows exactly that category', JSON.stringify(ui.catShown) === JSON.stringify(ui.catExpected), `${ui.catShown} vs ${ui.catExpected}`);
t.check('the sector filter shows exactly that sector', JSON.stringify(ui.secShown) === JSON.stringify(ui.secExpected), `${ui.secShown} vs ${ui.secExpected}`);
t.check('clearing the filters shows every card again', ui.allBack === true);
t.check('the preset switcher lists the four presets and applies one', ui.presetOptions.length === 4 && ui.presetApplied === true, ui.presetOptions.join(', '));
t.check('the Look select follows the theme (a preset, or Custom after a tweak)', ui.selectFollows === true && ui.customShown === true, JSON.stringify({ f: ui.selectFollows, c: ui.customShown }));

// ---- close-up: click a card, a fresh stage, orbit, close ----
const firstId = await page.evaluate(() => document.querySelector('[data-asset]').dataset.asset);
await page.click(`[data-asset="${firstId}"] button.open`);
await page.waitForFunction(() => document.getElementById('closeup').open, null, { timeout: 5000 });
const cu = await page.evaluate(async () => {
  await new Promise((res) => setTimeout(res, 300));
  const d = document.getElementById('closeup');
  const cv = d.querySelector('canvas');
  const s = window.__catalogue.closeup;
  const p0 = s.camera.position.clone();
  const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, bubbles: true }));
  ev('pointerdown', 100, 100); ev('pointermove', 180, 120); ev('pointerup', 180, 120);
  return { title: d.querySelector('h2').textContent, hasCanvas: !!cv, frames: s.frames, orbited: s.camera.position.distanceTo(p0) > 0.01, id: s.id,
    aspect: s.camera.aspect, box: cv.clientWidth / cv.clientHeight };
});
t.check('the close-up camera matches its canvas shape', Math.abs(cu.aspect - cu.box) < 0.02, `${cu.aspect} vs ${cu.box}`);
t.check('clicking a card opens the close-up for that asset', cu.hasCanvas && cu.title.includes(firstId) && cu.id === firstId, JSON.stringify({ title: cu.title, id: cu.id }));
t.check('the close-up renders and orbits', cu.frames > 2 && cu.orbited === true, JSON.stringify(cu));
await page.keyboard.press('Escape');
const closed = await page.evaluate(async () => {
  await new Promise((res) => setTimeout(res, 100));
  return { open: document.getElementById('closeup').open, canvases: document.querySelectorAll('#closeup canvas').length, stage: window.__catalogue.closeup };
});
t.check('Escape closes the close-up and releases its canvas', closed.open === false && closed.canvases === 0 && closed.stage === null, JSON.stringify(closed));
// a second open gets a fresh canvas (dispose kills the old context)
await page.click(`[data-asset="${firstId}"] button.open`);
const again = await page.evaluate(async () => { await new Promise((res) => setTimeout(res, 300)); return window.__catalogue.closeup?.frames || 0; });
t.check('reopening the close-up works (fresh canvas)', again > 2, String(again));
await page.keyboard.press('Escape');

// ---- phone width ----
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
const phone = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
t.check('no horizontal scroll at 390 px', phone.sw <= phone.cw, `scrollWidth ${phone.sw}, clientWidth ${phone.cw}`);

const stats = await page.evaluate(() => window.__catalogue.stats());
t.note('grid frame work (headless)', JSON.stringify(stats));
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();

// ---- the catalogue flags broken assets (test-only fixtures via ?test-bad=1) ----
{
  const g = await openGame('game/art/catalogue.html?test-bad=1', { context: { viewport: { width: 1280, height: 800 } } });
  await g.page.waitForFunction(() => window.__catalogue && window.__catalogue.ready === true, null, { timeout: 30000 });
  const b = await g.page.evaluate(() => {
    const card = (id) => {
      const c = document.querySelector(`[data-asset="${id}"]`);
      return c && { bad: c.classList.contains('bad'), warn: !c.querySelector('.warn').hidden, text: c.querySelector('.problems').textContent };
    };
    return {
      over: card('test-bad-over-budget'), nan: card('test-bad-nan'), big: card('test-bad-oversized'),
      good: ['sample-crate', 'sample-bench', 'sample-pillar'].map(card),
      summary: document.getElementById('summary').textContent,
    };
  });
  t.check('an over-budget asset shows the bad state with an over-budget warning', !!(b.over?.bad && b.over.warn && /over budget: \d+ of 50/.test(b.over.text)), JSON.stringify(b.over));
  t.check('a NaN asset shows the bad state with a NaN warning', !!(b.nan?.bad && b.nan.warn && /NaN/.test(b.nan.text)), JSON.stringify(b.nan));
  t.check('an oversized, off-centre asset shows the bad state with a footprint warning', !!(b.big?.bad && b.big.warn && /outside its 1x1 footprint/.test(b.big.text)), JSON.stringify(b.big));
  t.check('the good samples are not flagged', b.good.every((c) => c && !c.bad && !c.warn), JSON.stringify(b.good));
  t.check('the summary says 3 need attention', /\b3 need attention\b/.test(b.summary), b.summary);
  const reason = await g.page.evaluate(async () => {
    const c = document.querySelector('[data-asset="test-raised-budget"]');
    window.__catalogue.open('test-raised-budget');
    await new Promise((res) => setTimeout(res, 200));
    const out = { bad: c.classList.contains('bad'), note: document.querySelector('#cu-problems [data-reason]')?.textContent || '' };
    window.__catalogue.close();
    return out;
  });
  t.check('a raised budget with a reason is not flagged, and the close-up shows the reason', reason.bad === false && /test fixture: a raised budget with its reason/.test(reason.note), JSON.stringify(reason));
  // the fixtures build fresh (uncached) geometry on every build: preset rebuilds must free the old ones
  const mem = await g.page.evaluate(async () => {
    const th = await import('../engine/theme.js');
    const wait = () => new Promise((res) => setTimeout(res, 250));
    await wait();
    const before = window.__catalogue.gpuMemory();
    for (const p of ['Night lab', 'Bright day', 'Cozy paper', 'Warm dusk', 'Night lab', 'Warm dusk']) { th.applyPreset(p); await wait(); }
    return { before, after: window.__catalogue.gpuMemory() };
  });
  t.check('preset rebuilds free the old geometry (no GPU growth over 6 switches)', mem.after.geometries <= mem.before.geometries && mem.before.geometries > 0, JSON.stringify(mem));
  t.check('no page errors with the broken fixtures', g.errors.length === 0, g.errors.join(' | '));
  await g.close();
}

// ---- 12 ms/frame with the catalogue loaded (?stress=60 adds 60 clones) ----
{
  const g = await openGame('game/art/catalogue.html?stress=60', { context: { viewport: { width: 1280, height: 720 } } });
  await g.page.waitForFunction(() => window.__catalogue && window.__catalogue.ready === true, null, { timeout: 30000 });
  await g.page.waitForTimeout(4000); // the stats window is the last 240 frames: past the warm-up shader compiles
  const s = await g.page.evaluate(() => window.__catalogue.stats());
  t.check('stress mode registers 60 clones', s.total === 63, String(s.total));
  t.check('grid work p95 under 12 ms with 63 assets (CPU proxy: JS time in the frame callback, incl. render submission)',
    s.frames >= 100 && s.workP95 < 12, JSON.stringify(s));
  t.check('no page errors in stress mode', g.errors.length === 0, g.errors.join(' | '));
  await g.close();
}
t.finish();
