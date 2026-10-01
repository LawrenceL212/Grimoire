/* The Grimoire (game/play/grimoire.js, spells.js): a spell not met is a blank page; met, it is listed but UNWRITTEN
   (pencil outline) until cast unaided, and help never writes it in; written, its ink follows the memory meter (fresh
   full, fading faded, due very faint with "re-ink soon") and says how long it is kept; only the forms introduced so
   far are shown, each by its drone; the contents carry a meter per drone; the HUD button opens it, Esc and the close
   button shut it, the pages turn (with a leaf) and the folio follows; on a phone it is one page at a time and fits
   the screen. Optional: SHOT=dir saves screenshots. */
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const SHOT = process.env.SHOT || null;
const { page, errors, close } = await openGame('game/play/index.html?ticket=double-booking-1', { context: { viewport: { width: 1280, height: 800 } } });
try {
  await page.waitForSelector('#hud-grimoire', { timeout: 30000 });
} catch (e) {
  t.check('the play page shows the Grimoire button', false, String(e).split('\n')[0]);
  await close(); t.finish();
}

const r = await page.evaluate(async () => {
  const S = await import('./spells.js');
  const G = await import('./grimoire.js');
  const DAY = 86400000, NOW = Date.UTC(2026, 9, 1, 12);
  let now = NOW;
  const store = S.createSpellStore({ storage: S.memoryStorage(), now: () => now });
  const g = G.createGrimoire({ store, now: () => now });
  await g.ready;
  const out = {};
  const idx = S.SPELLS.findIndex((s) => s.id === 'where') + 1;
  const look = () => {
    g.open(); g.show(idx, { animate: false });
    const p = g.el.querySelector('[data-spell="where"]');
    const name = p.querySelector('.gm-name');
    const cs = name ? getComputedStyle(name) : null;
    return {
      status: p.dataset.status, forms: [...p.querySelectorAll('.gm-form')].map((f) => f.dataset.lang),
      drones: [...p.querySelectorAll('.gm-by b')].map((b) => b.textContent),
      nameOpacity: cs ? Number(cs.opacity) : null, stroke: cs ? parseFloat(cs.webkitTextStrokeWidth || '0') : 0, transparent: cs ? cs.color === 'rgba(0, 0, 0, 0)' : false,
      seal: p.querySelector('.gm-seal')?.textContent || null, sealText: p.querySelector('.gm-seal') ? p.querySelector('.gm-seal').textContent + getComputedStyle(p.querySelector('.gm-seal'), '::after').content : '', status_line: p.querySelector('.gm-status')?.textContent || p.textContent.trim(),
      text: p.textContent,
    };
  };
  out.unknown = look();
  store.introduce('where', ['sql']);
  out.unwritten = look();
  store.recordCast('where', { lang: 'sql', outcome: 'exposure', nowMs: now });
  out.assisted = look();
  store.recordCast('where', { lang: 'sql', unaided: true, nowMs: now });
  out.fresh = look();
  now = NOW + 0.67 * DAY; out.fading = look();
  now = NOW + 3 * DAY; out.due = look();
  now = NOW;
  store.introduce('where', ['js']);
  out.twoForms = look();
  now = NOW + DAY; store.recordCast('where', { lang: 'sql', unaided: true, nowMs: now }); // a second unaided cast, a day later, lasts longer
  out.stronger = look();
  // the contents: one meter per drone
  g.show(0, { animate: false });
  out.meters = [...g.el.querySelectorAll('.gm-meter')].map((m) => ({ lang: m.dataset.lang, who: m.querySelector('.gm-meter-who b').textContent, note: m.querySelector('.gm-meter-note').textContent }));
  out.toc = [...g.el.querySelectorAll('.gm-toc')].map((b) => b.className.match(/is-(\w+)/)[1]);
  out.spells = S.SPELLS.map((s) => s.id);
  out.everyFormHasAllThree = S.SPELLS.every((s) => ['sql', 'js', 'php'].every((l) => typeof s.forms[l] === 'string' && s.forms[l].length > 0));
  g.dispose();
  return out;
});

t.check('the opening chapter\'s spells are there, in the ladder\'s order, each with SQL, JavaScript and PHP forms', ['table-row', 'select-all', 'where', 'order-by', 'insert', 'update', 'delete', 'overlap'].every((id) => r.spells.includes(id)) && r.spells.indexOf('select-all') < r.spells.indexOf('where') && r.spells.indexOf('where') < r.spells.indexOf('overlap') && r.everyFormHasAllThree, r.spells.join(','));
t.check('a spell not met yet is a blank page (no name, no forms)', r.unknown.status === 'unknown' && r.unknown.forms.length === 0 && !r.unknown.text.includes('Choose the rows'), JSON.stringify({ s: r.unknown.status, f: r.unknown.forms }));
t.check('met but never cast: listed and UNWRITTEN, in pencil outline', r.unwritten.status === 'unwritten' && r.unwritten.seal === 'UNWRITTEN' && r.unwritten.stroke > 0 && r.unwritten.transparent && /cast it on your own/.test(r.unwritten.status_line), JSON.stringify(r.unwritten));
t.check('a cast with help does not write it in', r.assisted.status === 'unwritten' && /with help/.test(r.assisted.status_line), JSON.stringify({ s: r.assisted.status, line: r.assisted.status_line }));
t.check('cast unaided: WRITTEN in full ink, fresh, kept about 3 days', r.fresh.status === 'fresh' && r.fresh.seal === 'WRITTEN' && r.fresh.nameOpacity === 1 && r.fresh.stroke === 0 && /Kept about 3 days/.test(r.fresh.status_line), JSON.stringify(r.fresh));
t.check('the ink follows the meter: fresh > fading > due, and a due spell stays readable and says "re-ink soon"', r.fresh.nameOpacity > r.fading.nameOpacity && r.fading.nameOpacity > r.due.nameOpacity && r.fading.status === 'fading' && r.due.status === 'due' && /re-ink soon/.test(r.due.status_line) && r.due.nameOpacity >= 0.5 && /RE-INK SOON/.test(r.due.sealText), JSON.stringify({ fresh: r.fresh.nameOpacity, fading: r.fading.nameOpacity, due: r.due.nameOpacity, line: r.due.status_line }));
t.check('only the introduced forms are shown, each by its drone (Sequel for SQL, Jay for JavaScript)', JSON.stringify(r.fresh.forms) === '["sql"]' && JSON.stringify(r.twoForms.forms) === '["sql","js"]' && JSON.stringify(r.twoForms.drones) === '["Sequel","Jay"]', JSON.stringify({ one: r.fresh.forms, two: r.twoForms.forms, drones: r.twoForms.drones }));
t.check('a second unaided cast a day later keeps it longer (the gain depends on the recall)', /Kept about 11 days/.test(r.stronger.status_line), r.stronger.status_line);
t.check('the contents list every spell and show a meter per drone (Sequel, Jay, Hex)', r.toc.length === r.spells.length && JSON.stringify(r.meters.map((m) => m.who)) === '["Sequel","Jay","Hex"]' && /1 of 1 written/.test(r.meters[0].note) && /0 of 1 written/.test(r.meters[1].note), JSON.stringify(r.meters));

// ---- the HUD button opens it; turning; closing
await page.evaluate(() => {
  const DAY = 86400000, now = Date.now();
  // the spells live in the life's one record (progress.js), which the page's book reads
  const spells = ({
    'table-row': { langs: ['sql'], written: true, lastMs: now - 0.2 * DAY, stability: 3, forms: { sql: { written: true, lastMs: now - 0.2 * DAY, stability: 3 } } },
    'id-link': { langs: ['sql'], written: true, lastMs: now - 1.0 * DAY, stability: 3, forms: { sql: { written: true, lastMs: now - 1.0 * DAY, stability: 3 } } },
    'select-all': { langs: ['sql', 'js', 'php'], written: true, lastMs: now - 0.1 * DAY, stability: 7.5, forms: { sql: { written: true, lastMs: now - 0.1 * DAY, stability: 7.5 }, js: { written: true, lastMs: now - 0.5 * DAY, stability: 3 } } },
    'select-columns': { langs: ['sql'], written: true, lastMs: now - 4 * DAY, stability: 3, forms: { sql: { written: true, lastMs: now - 4 * DAY, stability: 3 } } },
    where: { langs: ['sql'], written: false, lastMs: null, stability: 3, forms: {} },
  });
  localStorage.setItem('grimoire.life.siso.v1', JSON.stringify({ v: 1, startedMs: now, tutorial: { done: true, step: 0, skipped: [] }, cards: {}, solves: [], days: {}, spells }));
});
// the default store reads storage once, on first use: reload so the seeded state is what it reads
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#hud-grimoire', { timeout: 30000 });
await page.click('#hud-grimoire');
await page.waitForSelector('.gm-book-overlay.is-open', { timeout: 5000 });
const opened = await page.evaluate(() => {
  const o = document.querySelector('.gm-book-overlay');
  return { visible: !o.hidden && getComputedStyle(o).display !== 'none', pages: o.querySelectorAll('.gm-spread > .gm-page').length, folio: o.querySelector('.gm-folio').textContent, focus: document.activeElement?.className,
    expanded: document.getElementById('hud-grimoire').getAttribute('aria-expanded'), spreadLive: o.querySelector('.gm-spread').getAttribute('aria-live'), folioLive: o.querySelector('.gm-folio').getAttribute('aria-live'),
    tocLabels: [...o.querySelectorAll('.gm-toc')].slice(0, 5).map((b) => b.getAttribute('aria-label')) };
});
t.check('the HUD button opens the book: a two-page spread on a desktop, the contents first', opened.visible && opened.pages === 2 && /Pages 1–2 of/.test(opened.folio) && opened.focus === 'gm-close', JSON.stringify(opened));
t.check('a11y: the HUD button says the book is open (aria-expanded), only the folio is announced on a turn', opened.expanded === 'true' && opened.spreadLive === null && opened.folioLive === 'polite', JSON.stringify(opened));
t.check('a11y: each contents entry says its ink status in words, not only by opacity', /fresh ink/.test(opened.tocLabels[0]) && /fading/.test(opened.tocLabels[1]) && /not written yet/.test(opened.tocLabels[4]), JSON.stringify(opened.tocLabels));
await page.click('.gm-next');
const turned = await page.evaluate(() => ({ leaf: !!document.querySelector('.gm-leaf'), folio: document.querySelector('.gm-folio').textContent, spells: [...document.querySelectorAll('.gm-spread > .gm-page:not(.gm-leaf)')].map((p) => p.dataset.spell + ':' + p.dataset.status) }));
t.check('Next turns the page (a leaf swings over) and the folio follows', turned.leaf && /Pages 3–4 of/.test(turned.folio) && turned.spells.join() === 'id-link:fading,select-all:fresh', JSON.stringify(turned));
await page.waitForTimeout(900);
if (SHOT) await page.screenshot({ path: `${SHOT}/task-14a-grimoire.png` });
await page.keyboard.press('ArrowLeft');
const back = await page.evaluate(() => document.querySelector('.gm-folio').textContent);
await page.keyboard.press('Escape');
const shut = await page.evaluate(() => ({ hidden: document.querySelector('.gm-book-overlay').hidden, focus: document.activeElement?.id, expanded: document.getElementById('hud-grimoire').getAttribute('aria-expanded') }));
t.check('Left turns back; Esc closes it and gives the focus back to the HUD button', /Pages 1–2 of/.test(back) && shut.hidden && shut.focus === 'hud-grimoire' && shut.expanded === 'false', JSON.stringify({ back, shut }));
await page.click('#hud-grimoire');
await page.waitForSelector('.gm-book-overlay.is-open');
await page.click('.gm-close');
const shut2 = await page.evaluate(() => document.querySelector('.gm-book-overlay').hidden);
t.check('the close button closes it', shut2 === true, String(shut2));

// ---- a phone: one page at a time, inside the screen, readable
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
await page.click('#hud-grimoire');
await page.waitForSelector('.gm-book-overlay.is-open');
await page.evaluate(() => { const s = [...document.querySelectorAll('.gm-toc')].find((b) => b.textContent.includes('Ask for everything')); s && s.click(); });
await page.waitForTimeout(700);
const phone = await page.evaluate(() => {
  const book = document.querySelector('.gm-book').getBoundingClientRect();
  const p = document.querySelector('.gm-spread > .gm-page:not(.gm-leaf)');
  const pr = p.getBoundingClientRect();
  const code = p.querySelector('pre');
  return { book: { l: book.left, r: book.right, t: book.top, b: book.bottom }, pages: document.querySelectorAll('.gm-spread > .gm-page:not(.gm-leaf)').length, pageW: pr.width,
    spell: p.dataset.spell, forms: [...p.querySelectorAll('.gm-form')].map((f) => f.dataset.lang), codePx: code ? parseFloat(getComputedStyle(code).fontSize) : 0,
    codeOverflow: code ? code.scrollWidth > code.clientWidth + 1 : true, scrollW: document.documentElement.scrollWidth, folio: document.querySelector('.gm-folio').textContent };
});
if (SHOT) await page.screenshot({ path: `${SHOT}/task-14a-grimoire-phone.png` });
t.check('phone: one page at a time, the book inside the screen, code readable without sideways scrolling', phone.pages === 1 && phone.book.l >= 0 && phone.book.r <= 390.5 && phone.book.b <= 844.5 && phone.pageW >= 300 && phone.codePx >= 12 && !phone.codeOverflow && phone.scrollW <= 390 && /Page 4 of/.test(phone.folio), JSON.stringify(phone));
t.check('phone: a spell with three introduced forms shows all three (SQL, JavaScript, PHP)', phone.spell === 'select-all' && JSON.stringify(phone.forms) === '["sql","js","php"]', JSON.stringify(phone.forms));
t.check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await close();
t.finish();
