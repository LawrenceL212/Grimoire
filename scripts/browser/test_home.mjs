/* The home room (game/play/home*.js): Home/Office switch, the shop, edit mode, the honest balance, persistence, phone layout.
   Starts from a saved life whose tutorial is done and whose teaching tickets (O1-T01) are solved, so the next ticket T02 is
   the first evidence card: a practice solve earns nothing, a clean first solve earns the table amount. */
import { openGame, makeReporter } from './game_lib.mjs';
import { ready, current, playCard, nextTicket, settle } from './chapter_lib.mjs';
import { LADDER } from '../../game/problems/ladder.js';
import { EARNINGS } from '../../game/play/home-rules.js';

const t = makeReporter();
const SHOT = process.env.SHOT || null;
const KEY = 'grimoire.life.siso.v1';
const TEACHING = ['O1', 'O2', 'O3', 'O4', 'O5', 'T01'];
const seed = (page) => page.addInitScript(([key, ids]) => {
  if (localStorage.getItem(key)) return; // a reload keeps what the page saved
  const n = Date.now();
  localStorage.setItem(key, JSON.stringify({ v: 1, startedMs: n - 5000, highMs: n, tutorial: { done: true, step: 0, skipped: [] }, cards: {}, days: { '2000-01-01': ids },
    solves: ids.map((id, k) => ({ card: id, atMs: n - 4000 + k, help: 'clean', unaided: false, lang: 'sql', xp: 0, gbp: 0, practice: false })), spells: {} }));
}, [KEY, TEACHING]);
const bal = (page) => page.evaluate(() => window.__play.home.home.balance);
const chip = (page) => page.locator('[data-ctr="balance"] b').innerText();
const msg = (page, id) => page.locator(id).innerText();

const { page, errors, close } = await openGame('game/play/index.html', { context: { viewport: { width: 1280, height: 720 } }, beforeGoto: seed });
try {
  t.check('the play page boots', await ready(page));
  await page.evaluate(() => { window.__play.timeScale = 8; });
  t.check('the first ticket is T02, the first evidence card', (await current(page)).id === 'T02');
  t.check('the balance starts at £0 and the chip says so', await bal(page) === 0 && await chip(page) === '£0');

  // ---- the catalogue matches the art pack
  const tiles = await page.evaluate(async () => {
    const r = await import('./home-rules.js'); const reg = await import('../art/index.js');
    return Object.values(r.CATALOG).filter((d) => { const m = reg.get(d.asset); return !m || m.tiles[0] !== d.tiles[0] || m.tiles[1] !== d.tiles[1]; }).map((d) => d.id);
  });
  t.check('every shop item exists in the art pack with the same footprint', tiles.length === 0, tiles.join(', '));

  // ---- Home / Office
  const mode = () => page.evaluate(() => ({ mode: window.__play.home.mode, office: window.__play.office.map.root.visible, home: window.__play.home.view?.root.visible ?? null, label: document.querySelector('#hud-home').textContent }));
  t.check('starts in the office', (await mode()).mode === 'office' && (await mode()).office === true);
  await page.click('#hud-home'); await page.waitForTimeout(700);
  const m1 = await mode();
  t.check('the Home button switches the scene to the bedroom (and says Office)', m1.mode === 'home' && m1.office === false && m1.home === true && m1.label === 'Office', JSON.stringify(m1));
  t.check('the code and ticket windows stay', await page.locator('#win-code').isVisible() && await page.locator('#win-ticket').isVisible());
  const start = await page.evaluate(() => window.__play.home.home.items.map((i) => i.id).sort());
  t.check('the bedroom starts almost empty: bed, wobbly desk, laptop, apron hook, one sad plant', start.join() === ['apron-hook', 'bed-single', 'desk-wobbly', 'laptop', 'plant-small'].join(), start.join());
  t.check('the 3D room really holds those five', await page.evaluate(() => window.__play.home.view.objects.size) === 5);
  // pan, zoom and orbit still work in the room
  const before = await page.evaluate(() => window.__play.stage.camera.position.toArray());
  await page.mouse.move(700, 300); await page.mouse.down(); await page.mouse.move(760, 320, { steps: 5 }); await page.mouse.up();
  await page.mouse.wheel(0, -300); await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.__play.stage.camera.position.toArray());
  t.check('orbit and zoom still move the camera at home', before.some((v, k) => Math.abs(v - after[k]) > 0.05), JSON.stringify({ before, after }));
  await page.evaluate(() => window.__play.resetView());
  await page.click('#hud-home'); await page.waitForTimeout(700);
  const m2 = await mode();
  t.check('Office brings the office back', m2.mode === 'office' && m2.office === true && m2.home === false && m2.label === 'Home', JSON.stringify(m2));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  t.check('reduced motion: no fade', await page.evaluate(() => getComputedStyle(document.getElementById('home-fade')).display) === 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // ---- the honest balance: a practice solve earns nothing
  await page.evaluate(() => window.__play.chapter.practice()); await ready(page);
  const pc = await current(page);
  t.check('a practice ticket is loaded', pc.practice === true, JSON.stringify(pc));
  const pcard = LADDER.find((c) => c.id === pc.id);
  const pr = await playCard(page, pcard, { cheats: false, t });
  t.check('the practice ticket is solved', pr.solved, JSON.stringify(pr));
  t.check('a practice solve earns £0', await bal(page) === 0 && await chip(page) === '£0', String(await bal(page)));
  // ---- a clean first solve of an evidence card earns the table amount
  await page.evaluate(() => window.__play.chapter.next()); await ready(page);
  const t02 = await current(page);
  t.check('the next ticket is T02', t02.id === 'T02' && !t02.practice, JSON.stringify(t02));
  const sr = await playCard(page, LADDER.find((c) => c.id === 'T02'), { cheats: false, t });
  t.check('T02 is solved cleanly with its reference solution', sr.solved, JSON.stringify(sr));
  t.check(`the first clean solve earns £${EARNINGS.unaidedEvidenceSolve}`, await bal(page) === EARNINGS.unaidedEvidenceSolve && await chip(page) === `£${EARNINGS.unaidedEvidenceSolve}`, await chip(page));
  t.check('the earning is stored in the life record (solve gbp and the home balance)', await page.evaluate((k) => { const l = JSON.parse(localStorage.getItem(k)); return l.home.balance === 40 && l.solves.at(-1).gbp === 40; }, KEY));

  // ---- the shop: not enough money, then enough
  await page.click('#hud-home'); await page.waitForTimeout(600);
  await page.click('#hud-shop');
  t.check('the shop opens and lists prices', await page.locator('#win-shop').isVisible() && await page.locator('#shop-list .hm-row').count() >= 15 && /£20/.test(await page.locator('#shop-list').innerText()));
  await page.click('[data-buy="sofa"]');
  t.check('buying with too little money says how much more is needed, and spends nothing', /£180 more to go/.test(await msg(page, '#shop-msg')) && await bal(page) === 40, await msg(page, '#shop-msg'));
  await page.click('[data-buy="desk-lamp"]');
  t.check('buying with enough money deducts the price (£40 - £20)', await bal(page) === 20 && await chip(page) === '£20', await chip(page));
  t.check('the bought lamp is owned and not yet placed', await page.evaluate(() => { const i = window.__play.home.home.items.find((x) => x.id === 'desk-lamp'); return !!i && i.x === null; }));
  await page.click('[data-buy="poster"]');
  t.check('buying down to exactly £0 works, and a purchase can never go below it', await bal(page) === 0);
  await page.click('[data-buy="plant-small"]');
  t.check('with £0 the next purchase is refused', await bal(page) === 0 && /£20 more to go/.test(await msg(page, '#shop-msg')));

  // ---- edit mode: place, refuse, move, recolour, sell
  await page.click('#hud-edit');
  t.check('Edit opens the edit panel and lists the owned, unplaced things', await page.locator('#win-edit').isVisible() && await page.locator('#edit-unplaced .hm-row').count() === 2);
  const lampUid = await page.evaluate(() => window.__play.home.home.items.find((i) => i.id === 'desk-lamp').uid);
  await page.click(`[data-put="${lampUid}"]`);
  const lamp = await page.evaluate((u) => { const h = window.__play.home; const i = h.home.items.find((x) => x.uid === u); return { x: i.x, z: i.z, selected: h.selected, in3d: h.view.objects.has(u) }; }, lampUid);
  t.check('Place puts the lamp on the desk (desk-top things sit on surfaces) and picks it up', lamp.x !== null && Math.abs(lamp.z + 2) < 0.6 && lamp.selected === lampUid && lamp.in3d, JSON.stringify(lamp));
  await page.keyboard.press('ArrowUp');
  const lampOff = await page.evaluate((u) => window.__play.home.home.items.find((i) => i.uid === u).z, lampUid);
  t.check('an arrow key past the desk edge is refused with a reason', lampOff === lamp.z && /outside the room|needs a desk or a table/.test(await msg(page, '#edit-msg')), `${lamp.z} -> ${lampOff}: ${await msg(page, '#edit-msg')}`);
  await page.keyboard.press('ArrowDown');
  t.check('arrow keys move it along the desk (and do not pan the camera)', await page.evaluate((u) => window.__play.home.home.items.find((i) => i.uid === u).z, lampUid) > lamp.z);

  // a chair, for the floor rules (the page's rules module, with the balance topped up in-session)
  const chairUid = await page.evaluate(async () => {
    const r = await import('./home-rules.js'); const h = window.__play.home;
    h.apply({ ok: true, home: { ...h.home, balance: 500 } });
    const b = r.buy(h.home, 'office-chair'); h.apply(b);
    h.apply(r.place(h.home, b.uid, { x: 0.5, z: -1, rot: 0 }));
    h.edit.select(b.uid);
    return b.uid;
  });
  await page.click('[data-move="0,-1"]');
  t.check('moving a chair into the desk is refused: it overlaps', /overlaps the wobbly desk/.test(await msg(page, '#edit-msg')), await msg(page, '#edit-msg'));
  await page.evaluate(async (u) => { const r = await import('./home-rules.js'); const h = window.__play.home; h.apply(r.place(h.home, u, { x: -2.5, z: 0, rot: 0 })); h.edit.select(u); }, chairUid);
  await page.click('[data-move="0,1"]');
  t.check('moving a chair onto the door tile is refused: it would block the door', /block the door/.test(await msg(page, '#edit-msg')), await msg(page, '#edit-msg'));
  await page.evaluate(async (u) => { const r = await import('./home-rules.js'); const h = window.__play.home; h.apply(r.place(h.home, u, { x: 0.5, z: -1, rot: 0 })); h.edit.select(u); }, chairUid);
  await page.keyboard.press('r');
  const turned = await page.evaluate((u) => window.__play.home.home.items.find((i) => i.uid === u).rot, chairUid);
  t.check('R turns it a quarter', Math.abs(turned - Math.PI / 2) < 1e-6, String(turned));
  // recolour a bed from the palette
  const bedUid = await page.evaluate(() => { const h = window.__play.home; const u = h.home.items.find((i) => i.id === 'bed-single').uid; h.edit.select(u); return u; });
  await page.click('[data-tone="coral"]');
  t.check('recolouring the bed from the palette sticks', await page.evaluate((u) => window.__play.home.home.items.find((i) => i.uid === u).tone, bedUid) === 'coral');
  // sell the chair back at half price
  await page.evaluate((u) => window.__play.home.edit.select(u), chairUid);
  const b0 = await bal(page);
  await page.click('[data-act="sell"]');
  t.check('selling back refunds half the price (£45 -> £22) and the chair is gone', await bal(page) === b0 + 22 && await page.evaluate((u) => !window.__play.home.home.items.some((i) => i.uid === u), chairUid), `${b0} -> ${await bal(page)}`);
  if (SHOT) await page.screenshot({ path: `${SHOT}/task-16-edit.png` });

  // ---- persistence: reload keeps the home (the money injected above for the chair is not earned: take it back out)
  await page.evaluate(() => { const h = window.__play.home; h.apply({ ok: true, home: { ...h.home, balance: 0 } }); });
  const snap = await page.evaluate(() => { const h = window.__play.home.home; return JSON.stringify({ b: h.balance, i: h.items.map((x) => [x.id, x.x, x.z, x.rot, x.tone]) }); });
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page);
  const snap2 = await page.evaluate(() => { const h = window.__play.home.home; return JSON.stringify({ b: h.balance, i: h.items.map((x) => [x.id, x.x, x.z, x.rot, x.tone]) }); });
  t.check('a reload keeps the home: balance, owned things, placements and colours', snap === snap2, `${snap}\n${snap2}`);
  t.check('the chip shows the kept balance', await chip(page) === `£${JSON.parse(snap).b}`);
  await page.click('#hud-home'); await page.waitForTimeout(600);
  t.check('and the room is rebuilt from it', await page.evaluate(() => window.__play.home.view.objects.size) === JSON.parse(snap).i.filter((x) => x[1] !== null).length);
  // a tampered balance is clamped on load
  await page.evaluate((k) => { const l = JSON.parse(localStorage.getItem(k)); l.home.balance = 99999; localStorage.setItem(k, JSON.stringify(l)); }, KEY);
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page);
  t.check('a balance raised by hand is clamped back to what the solves could have earned', await bal(page) <= 40, String(await bal(page)));
} catch (e) {
  t.check('the home test ran to the end', false, String(e?.stack || e).split('\n').slice(0, 4).join(' | '));
}
t.check('no page errors (desktop)', errors.length === 0, errors.slice(0, 3).join(' | '));
await close();

// ---- the phone: 390 px
{
  const ph = await openGame('game/play/index.html', { context: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, beforeGoto: (p) => p.addInitScript(([key]) => {
    const n = Date.now();
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ v: 1, startedMs: n - 5000, highMs: n, tutorial: { done: true, step: 0, skipped: [] }, cards: {}, days: {}, solves: Array.from({ length: 3 }, (_, k) => ({ card: `X${k}`, atMs: n - 3000 + k, help: 'clean', unaided: true, lang: 'sql', xp: 10, gbp: 40, practice: false })), spells: {} }));
  }, [KEY]) });
  try {
    await ready(ph.page);
    await ph.page.evaluate(async () => { const h = window.__play.home; h.apply({ ok: true, home: { ...h.home, balance: 100 } }); });
    await ph.page.click('#hud-home'); await ph.page.waitForTimeout(700);
    await ph.page.click('#hud-shop'); await ph.page.waitForTimeout(300);
    const geo = await ph.page.evaluate(() => { const b = document.querySelector('[data-buy="desk-lamp"]').getBoundingClientRect(); const s = document.getElementById('win-shop').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, iw: innerWidth, bx: b.x, br: b.right, sx: s.x, sr: s.right }; });
    t.check('phone 390 px: no horizontal scroll', geo.sw <= geo.iw, JSON.stringify(geo));
    t.check('phone: the shop fits the width and its Buy buttons are on screen', geo.sx >= 0 && geo.sr <= geo.iw + 0.5 && geo.bx >= 0 && geo.br <= geo.iw + 0.5, JSON.stringify(geo));
    await ph.page.locator('[data-buy="desk-lamp"]').tap();
    t.check('phone: a purchase works by touch', await bal(ph.page) === 80, String(await bal(ph.page)));
    await ph.page.click('#hud-edit');
    const geo2 = await ph.page.evaluate(() => { const e = document.getElementById('win-edit').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, iw: innerWidth, ex: e.x, er: e.right }; });
    t.check('phone: edit mode fits and does not scroll sideways', geo2.sw <= geo2.iw && geo2.ex >= 0 && geo2.er <= geo2.iw + 0.5, JSON.stringify(geo2));
    await ph.page.locator('#edit-unplaced [data-put]').first().tap();
    t.check('phone: Place works by touch (the lamp goes on the desk)', await ph.page.evaluate(() => window.__play.home.home.items.some((i) => i.id === 'desk-lamp' && i.x !== null)));
    if (SHOT) { await ph.page.evaluate(() => scrollTo(0, 0)); await ph.page.screenshot({ path: `${SHOT}/task-16-phone-edit.png` }); }
  } catch (e) { t.check('the phone test ran to the end', false, String(e?.stack || e).split('\n').slice(0, 4).join(' | ')); }
  t.check('no page errors (phone)', ph.errors.length === 0, ph.errors.slice(0, 3).join(' | '));
  await ph.close();
}
t.finish();
