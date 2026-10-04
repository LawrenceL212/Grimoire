/* Step 1 of cloud sync: the save file. From the title screen's Settings: "Export my game" downloads
   grimoire-save-YYYY-MM-DD.json; wiping the device and "Import a game" brings back the same progress (merge); a corrupt
   or tampered file shows an error and changes nothing; Replace asks first and Cancel changes nothing; the Settings
   additions fit 390 px; no page errors. */
import { readFileSync } from 'fs';
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const LIFE = 'grimoire.life.siso.v1';
const ready = (page) => page.waitForFunction(() => window.__title && window.__title.ready, null, { timeout: 60000 });

// a played save, built with the game's real progression code inside the page
async function play(page) {
  await page.evaluate(async (key) => {
    const P = await import('./game/play/progress.js');
    const S = await import('./game/play/spells.js');
    let life = P.freshLife(Date.now() - 3 * 86400000);
    const store = S.createSpellStore({ storage: S.memoryStorage(), key: 's' });
    let at = Date.now() - 2 * 86400000;
    for (const [id, casts] of [['T1', ['where']], ['T2', ['select-all']], ['T3', ['limit']]]) {
      const r = P.recordSolve(life, { id, evidence: true, newConcept: true }, { help: 'clean', casts, nowMs: at += 3600000 });
      life = r.life;
      for (const s of r.spells) store.recordCast(s.id, { lang: 'sql', unaided: s.unaided, outcome: s.outcome, nowMs: at });
    }
    life = P.noteHelp(life, 'T4', { hint: 2 });
    const spells = {};
    for (const { spell } of store.all()) { const st = store.getSpellState(spell.id); if (st.introduced) spells[spell.id] = { langs: st.langs, written: st.written, demo: st.demo, lastMs: st.lastMs, stability: st.stability, assisted: st.assisted, forms: st.forms }; }
    localStorage.setItem(key, JSON.stringify({ ...life, spells }));
  }, LIFE);
}
const snapshot = (page) => page.evaluate((k) => JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map((x) => [x, localStorage.getItem(x)])) ), LIFE);
const progress = (page) => page.evaluate((k) => { const l = JSON.parse(localStorage.getItem(k) || 'null'); return l && { solves: l.solves.map((s) => `${s.card}:${s.xp}:${s.gbp}`), xp: l.solves.reduce((n, s) => n + s.xp, 0), balance: l.home.balance, spells: Object.entries(l.spells).filter(([, r]) => r.written).map(([id]) => id).sort(), card4: l.cards.T4?.hint }; }, LIFE);
const openSettings = async (page) => { await page.click('#open-settings'); await page.waitForSelector('#settings[open]'); };
const pick = (page, name, text) => page.setInputFiles('#import-file', { name, mimeType: 'application/json', buffer: Buffer.from(text) });

{
  const { page, errors, close } = await openGame('', { context: { viewport: { width: 1280, height: 800 }, acceptDownloads: true } });
  await ready(page);
  await play(page);
  await page.reload(); await ready(page);
  const before = await progress(page);
  t.check('a played save exists (3 solves, 30 XP, 3 spells written, hint 2 on a card)', before.solves.length === 3 && before.xp === 30 && before.balance === 120 && before.spells.length === 3 && before.card4 === 2, JSON.stringify(before));

  // ---- export
  await openSettings(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-save')]);
  const name = dl.suggestedFilename();
  const text = readFileSync(await dl.path(), 'utf8');
  const doc = JSON.parse(text);
  t.check('Export my game downloads grimoire-save-YYYY-MM-DD.json', /^grimoire-save-\d{4}-\d\d-\d\d\.json$/.test(name), name);
  t.check('the file is the portable document: exactly schema, updatedAt and siso { life, spells }', Object.keys(doc).sort().join() === 'schema,siso,updatedAt' && Object.keys(doc.siso).sort().join() === 'life,spells' && doc.schema === 1, Object.keys(doc).join());
  t.check('the export message says what was saved', /grimoire-save-/.test(await page.textContent('#import-msg')));
  await page.click('#settings-done');

  // ---- wipe, then import (merge) gets the same progress back
  await page.evaluate((k) => localStorage.removeItem(k), LIFE);
  await page.reload(); await ready(page);
  t.check('after the wipe the title offers Start again', (await page.textContent('#start')) === 'Start');
  await openSettings(page);
  await pick(page, name, text);
  await page.waitForSelector('#import-choices:not([hidden])');
  const msg = await page.textContent('#import-msg');
  t.check('the preview shows days in business, tickets, spells and balance', /3 tickets solved/.test(msg) && /3 spells written/.test(msg) && /£120/.test(msg) && /day/.test(msg), msg);
  t.check('Merge is offered first and marked recommended; Replace is there too', /Merge \(recommended\)/.test(await page.textContent('#import-merge')) && await page.isVisible('#import-replace'));
  t.check('nothing is written until a choice is made', (await progress(page)) === null);
  await page.click('#import-merge');
  const after = await progress(page);
  t.check('Import (merge) brings back the same progress, spells, balance and the help on a card', JSON.stringify(after) === JSON.stringify(before), JSON.stringify({ before, after }));
  await page.click('#settings-done'); await page.waitForTimeout(100);
  t.check('the title now says Continue', (await page.textContent('#start')) === 'Continue');

  // ---- merging the same file again changes nothing
  await openSettings(page);
  const snap1 = await snapshot(page);
  await pick(page, name, text); await page.waitForSelector('#import-choices:not([hidden])'); await page.click('#import-merge');
  t.check('importing the same file again changes nothing', (await snapshot(page)) === snap1 && /Nothing to change/.test(await page.textContent('#import-msg')));

  // ---- bad files: an error, and nothing changes
  const bads = [
    ['corrupt json', '{"schema":1,"siso":{"life":'],
    ['not a save', JSON.stringify({ hello: 'world' })],
    ['unknown schema', JSON.stringify({ ...doc, schema: 7 })],
    ['empty', '   '],
    ['an array', '[1,2,3]'],
    ['oversize', JSON.stringify({ ...doc, junk: 'x'.repeat(700000) })],
  ];
  for (const [what, body] of bads) {
    await pick(page, 'bad.json', body);
    await page.waitForFunction(() => document.getElementById('import-msg').textContent.length > 0 && document.getElementById('import-choices').hidden);
    const m = await page.textContent('#import-msg');
    t.check(`a bad file (${what}) shows an error and changes nothing`, /Nothing was changed/.test(m) && !(await page.isVisible('#import-choices')) && (await snapshot(page)) === snap1, m);
  }

  // ---- a tampered file is clamped, never trusted
  const forged = JSON.parse(text);
  forged.siso.life.solves[0].xp = 99999; forged.siso.life.home.balance = 1e9; forged.siso.life.highMs = Date.now() + 9e12;
  forged.siso.life.solves.push({ card: 'FUT', atMs: Date.now() + 9e12, help: 'clean', unaided: true, xp: 10, lang: 'sql' });
  await page.evaluate((k) => localStorage.removeItem(k), LIFE);
  await pick(page, 'forged.json', JSON.stringify(forged));
  await page.waitForSelector('#import-choices:not([hidden])'); await page.click('#import-merge');
  const forgedIn = await progress(page);
  t.check('a tampered file is clamped by the real validators (XP, balance, a future solve)', forgedIn.xp === 30 && forgedIn.balance === 120 && forgedIn.solves.length === 3, JSON.stringify(forgedIn));

  // ---- replace needs a confirm; cancel changes nothing
  await page.evaluate(async (k) => {
    const P = await import('./game/play/progress.js');
    localStorage.setItem(k, JSON.stringify(P.freshLife(Date.now())));
  }, LIFE);
  const snap2 = await snapshot(page);
  await pick(page, name, text); await page.waitForSelector('#import-choices:not([hidden])');
  await page.click('#import-replace');
  t.check('Replace asks to confirm first', await page.isVisible('#import-replace-yes') && (await snapshot(page)) === snap2);
  await page.click('#import-cancel');
  t.check('Cancel keeps what is on the device', (await snapshot(page)) === snap2);
  await pick(page, name, text); await page.waitForSelector('#import-choices:not([hidden])');
  await page.click('#import-replace'); await page.click('#import-replace-yes');
  t.check('confirmed Replace makes this device the file', JSON.stringify(await progress(page)) === JSON.stringify(before));
  t.check('no page errors', errors.length === 0, errors.join(' | '));
  await close();
}

// ---- 390 px: the Settings additions fit
{
  const { page, errors, close } = await openGame('', { context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } });
  await ready(page);
  await play(page);
  await page.reload(); await ready(page);
  await openSettings(page);
  const exportText = await page.evaluate(async () => (await import('./game/sync/file.js')).exportSave().text);
  await pick(page, 'x.json', exportText);
  await page.waitForSelector('#import-choices:not([hidden])');
  await page.click('#import-replace');
  const fit = await page.evaluate(() => {
    const dlg = document.getElementById('settings').getBoundingClientRect();
    const els = ['export-save', 'import-save', 'import-cancel', 'import-replace-yes', 'import-msg'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { id, l: r.left, r: r.right, w: r.width, vis: !!document.getElementById(id).offsetParent }; });
    return { dlg: { l: dlg.left, r: dlg.right }, els, scrollW: document.documentElement.scrollWidth, innerW: innerWidth, dlgScroll: document.getElementById('settings').scrollWidth - document.getElementById('settings').clientWidth };
  });
  t.check('at 390 px the dialog fits the screen with no sideways scroll', fit.dlg.l >= 0 && fit.dlg.r <= 390 && fit.scrollW <= fit.innerW && fit.dlgScroll <= 0, JSON.stringify(fit));
  t.check('every new control sits inside the dialog and is big enough to tap', fit.els.every((e) => e.vis && e.l >= fit.dlg.l - 1 && e.r <= fit.dlg.r + 1 && e.w >= 100), JSON.stringify(fit.els));
  t.check('no page errors at 390 px', errors.length === 0, errors.join(' | '));
  await close();
}
t.finish();
