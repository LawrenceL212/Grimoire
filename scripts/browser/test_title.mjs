/* The title screen at the site root (Task 14): GRIMOIRE with Start over the office; a fresh profile's Start plays the
   intro and then opens the office; with a save, Continue goes straight to the office; New game asks first and clears
   only the save keys; Settings changes the volume and the colour preset; Watch intro comes back to the title; the old
   Library loads at library.html with no failed requests of its own and its "Back to Grimoire" link points to ./;
   game/index.html lands on the title; the office drifts, and holds still under reduced motion; it fits 390 px; no
   page errors on the title. */
import { openGame, makeReporter, BASE } from './game_lib.mjs';

const t = makeReporter();
const ROOT = new URL(BASE).pathname; // '/' locally, '/Grimoire/' when published
const LIFE = 'grimoire.life.siso.v1';
const SAVE = JSON.stringify({ v: 1, startedMs: Date.now(), tutorial: { done: true, step: 3, skipped: [] }, cards: {}, solves: [], days: {}, spells: {} });
const ready = (page) => page.waitForFunction(() => window.__title && window.__title.ready && window.__title.scene !== 'pending', null, { timeout: 60000 });
const pathOf = (page) => new URL(page.url()).pathname;

// ---- the title, a fresh profile: Start -> the intro -> the office
{
  const { page, errors, close } = await openGame('', { context: { viewport: { width: 1280, height: 720 } } });
  await ready(page);
  const s = await page.evaluate(() => ({ logo: document.getElementById('logo').textContent, start: document.getElementById('start').textContent, visible: !!document.getElementById('start').offsetParent,
    scene: window.__title.scene, save: window.__title.hasSave, href: document.getElementById('start').getAttribute('href'), more: document.getElementById('more-lives').textContent,
    lib: document.getElementById('old-library').getAttribute('href'), buttons: [...document.querySelectorAll('#menu .btn')].map((b) => b.textContent.trim()) }));
  t.check('the root shows the GRIMOIRE title with Start over the office', s.logo === 'GRIMOIRE' && s.start === 'Start' && s.visible && s.scene === 'on' && !s.save, JSON.stringify(s));
  t.check('the menu: Start, New game, Settings, Watch intro, the old Library; one "More lives coming later" line',
    ['Start', 'New game', 'Settings', 'Watch intro'].every((b) => s.buttons.includes(b)) && s.lib === 'library.html' && /More lives coming later/.test(s.more),JSON.stringify(s.buttons));
  const next = new URLSearchParams(s.href.split('?')[1] || '').get('next');
  t.check('every link is relative; Start passes the intro an on-site path to the office', /^game\/intro\/index\.html\?next=/.test(s.href) && next === `${ROOT}game/play/index.html`, s.href);
  const watch = await page.getAttribute('#watch-intro', 'href');
  t.check('Watch intro comes back to the title', new URLSearchParams(watch.split('?')[1]).get('next') === ROOT, watch);
  const d0 = await page.evaluate(() => window.__title.drift());
  await page.waitForTimeout(1500);
  const d1 = await page.evaluate(() => window.__title.drift());
  t.check('the office drifts gently behind the title', Math.abs(d1 - d0) > 1e-4 && Math.abs(d1) < 0.2, `${d0} -> ${d1}`);
  await page.waitForFunction(() => typeof window.__title.music === 'function', null, { timeout: 15000 });
  const m0 = await page.evaluate(() => window.__title.music());
  await page.click('#open-settings');
  await page.waitForFunction(() => window.__title.music().playing === true, null, { timeout: 8000 }).catch(() => {});
  const m1 = await page.evaluate(() => window.__title.music());
  await page.click('#settings-done');
  t.check('title music: nothing before a gesture, then the normal mood', m0.playing === false && m1.playing === true && m1.mood === 'normal', JSON.stringify({ m0, m1 }));
  t.check('no page errors on the title', errors.length === 0, errors.join(' | '));

  await page.click('#start');
  await page.waitForURL(/game\/intro\/index\.html/, { timeout: 15000 });
  await page.waitForFunction(() => window.__intro && window.__intro.ready === true, null, { timeout: 60000 });
  t.check('a fresh profile\'s Start plays the intro', /game\/intro\/index\.html\?next=/.test(page.url()), page.url());
  await page.evaluate(() => window.__intro.skip());
  await page.waitForURL(/game\/play\/index\.html/, { timeout: 15000, waitUntil: 'commit' }).catch(() => {});
  t.check('at the end of the intro it opens the office', pathOf(page) === `${ROOT}game/play/index.html`, page.url());
  await close();
}

// ---- Continue goes straight to the office; New game asks, and clears only the save
{
  const { page, errors, close } = await openGame('', { context: { viewport: { width: 1280, height: 720 } } });
  await page.evaluate(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('grimoire.spells.v1', '{"select":{"r":1}}'); localStorage.setItem('grimoire.audio.v1', JSON.stringify({ master: 0.42, music: 0.3, effects: 0.6, muted: false, calm: false })); }, [LIFE, SAVE]);
  await page.reload();
  await ready(page);
  const c = await page.evaluate(() => ({ text: document.getElementById('start').textContent, href: document.getElementById('start').getAttribute('href'), save: window.__title.hasSave }));
  t.check('with a SISO save, Start becomes Continue and points straight at the office', c.text === 'Continue' && c.href === 'game/play/index.html' && c.save, JSON.stringify(c));

  // Settings: volume, mute and the colour preset are saved where the game reads them
  await page.click('#open-settings');
  await page.waitForSelector('#settings[open]');
  const presets = await page.$$eval('#preset option', (o) => o.map((x) => x.value));
  const vol0 = await page.inputValue('#vol-master');
  await page.locator('#vol-master').fill('25');
  await page.check('#mute');
  await page.selectOption('#preset', 'Night lab');
  await page.click('#settings-done'); // closing the settings writes the (coalesced) audio settings at once
  const st = await page.evaluate(() => ({ audio: JSON.parse(localStorage.getItem('grimoire.audio.v1')), theme: JSON.parse(localStorage.getItem('grimoire.theme.v1') || 'null') }));
  t.check('Settings: the volume and mute go to the audio settings; the colour presets are offered and applied',
    vol0 === '42' && st.audio.master === 0.25 && st.audio.muted === true && presets.includes('Warm dusk') && presets.includes('Night lab') && st.theme && st.theme.light.dusk === 1,
    JSON.stringify({ vol0, audio: st.audio, presets, dusk: st.theme?.light?.dusk }));

  // New game: Cancel keeps the save
  await page.click('#new-game');
  await page.waitForSelector('#confirm-new[open]');
  t.check('New game asks before clearing a save', await page.isVisible('#confirm-clear'));
  await page.click('#confirm-cancel');
  await page.waitForTimeout(200);
  const kept = await page.evaluate((k) => ({ life: !!localStorage.getItem(k), url: location.pathname }), LIFE);
  t.check('"Keep my save" keeps it and stays on the title', kept.life && kept.url === ROOT, JSON.stringify(kept));

  // New game: confirm clears the save keys (and keeps the settings), then the intro plays
  await page.click('#new-game');
  await page.waitForSelector('#confirm-new[open]');
  await Promise.all([page.waitForURL(/game\/intro\/index\.html/, { timeout: 15000, waitUntil: 'commit' }), page.click('#confirm-clear')]);
  const after = await page.evaluate((k) => ({ life: localStorage.getItem(k), spells: localStorage.getItem('grimoire.spells.v1'), audio: !!localStorage.getItem('grimoire.audio.v1'), theme: !!localStorage.getItem('grimoire.theme.v1') }), LIFE);
  t.check('confirming clears the SISO save (life and spells) and keeps the sound and colour settings', after.life === null && after.spells === null && after.audio && after.theme, JSON.stringify(after));
  t.check('then the intro plays, leading to the office', /game\/intro\/index\.html\?next=/.test(page.url()) && new URL(page.url()).searchParams.get('next') === `${ROOT}game/play/index.html`, page.url());
  t.check('no page errors on the title with a save', errors.filter((e) => !/intro/i.test(e)).length === 0, errors.join(' | '));

  // Continue: straight to the office, no intro
  await page.goto(BASE);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [LIFE, SAVE]);
  await page.reload();
  await ready(page);
  const seen = [];
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) seen.push(new URL(f.url()).pathname); });
  await page.click('#start');
  await page.waitForURL(/game\/play\/index\.html/, { timeout: 15000, waitUntil: 'commit' });
  t.check('Continue goes straight to the office (no intro)', seen.every((p) => !/intro/.test(p)) && pathOf(page) === `${ROOT}game/play/index.html`, JSON.stringify(seen));
  await close();
}

// ---- the old Library at library.html: no failed requests of its own; its link back to Grimoire
{
  const failed = [];
  const { page, errors, close } = await openGame('library.html', {
    context: { viewport: { width: 1280, height: 720 } },
    beforeGoto: async (p) => {
      p.on('requestfailed', (r) => { if (r.url().startsWith(BASE)) failed.push(`${r.url()} ${r.failure()?.errorText}`); });
      p.on('response', (r) => { if (r.url().startsWith(BASE) && r.status() >= 400) failed.push(`${r.url()} ${r.status()}`); });
    },
  });
  const idx = await page.waitForResponse((r) => r.url().startsWith(`${BASE}content/index.json`), { timeout: 30000 }).catch(() => null);
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const lib = await page.evaluate(() => ({ title: document.title, link: document.getElementById('newGameLink')?.getAttribute('href'), text: document.getElementById('newGameLink')?.textContent, runTests: typeof window.__runTests }));
  t.check('library.html loads the old app (its content index arrives)', !!idx && idx.status() === 200 && lib.runTests === 'function', JSON.stringify({ status: idx?.status(), ...lib }));
  t.check('no 404s or failed requests for the old app\'s own files', failed.length === 0, failed.join(' | '));
  t.check('the old app\'s "Back to Grimoire" link points to ./', lib.link === './' && /Back to Grimoire/.test(lib.text), JSON.stringify(lib));
  await page.click('#newGameLink');
  await page.waitForURL((u) => u.pathname === ROOT, { timeout: 15000 }).catch(() => {});
  t.check('and it lands on the title', pathOf(page) === ROOT, page.url());
  t.check('no page errors in the old app', errors.length === 0, errors.join(' | '));
  await close();
}

// ---- game/index.html lands on the title
{
  const { page, close } = await openGame('game/index.html');
  await page.waitForURL((u) => u.pathname === ROOT, { timeout: 15000 }).catch(() => {});
  t.check('game/index.html redirects to the title', pathOf(page) === ROOT, page.url());
  await close();
}

// ---- a phone at 390 px, with reduced motion
{
  const { page, errors, close } = await openGame('', { context: { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true } });
  await ready(page);
  const p = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [...document.querySelectorAll('#logo, #menu .btn, #old-library, .life')].filter((e) => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > vw + 1; }).map((e) => e.id || e.className);
    return { scroll: document.documentElement.scrollWidth - vw, out, rm: window.__title.reducedMotion, start: document.getElementById('start').getBoundingClientRect().height };
  });
  t.check('at 390 px nothing spills sideways and the buttons are tappable', p.scroll <= 0 && p.out.length === 0 && p.start >= 44, JSON.stringify(p));
  const r0 = await page.evaluate(() => (window.__title.drift ? window.__title.drift() : 0));
  await page.waitForTimeout(1200);
  const r1 = await page.evaluate(() => (window.__title.drift ? window.__title.drift() : 0));
  t.check('reduced motion: the office holds still', p.rm && r0 === 0 && r1 === 0, `${r0} ${r1}`);
  t.check('no page errors on a phone', errors.length === 0, errors.join(' | '));
  await close();
}

t.finish();
