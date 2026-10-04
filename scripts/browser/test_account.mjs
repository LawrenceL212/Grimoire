/* Step 2 of cloud sync: accounts. The Firebase CDN modules are STUBBED with route interception (fake users and a fake
   Firestore kept in localStorage), so no real account is ever used or created. Checks: a guest sees the guest note and
   loads no Firebase at all; wrong password shows a plain error; sign in merges the guest save with the cloud save (after
   the choice, since a guest game meets a cloud game); another account's save defaults to the safe choice (backup
   downloaded, cloud game kept); sign out keeps the local game; offline shows the offline chip; the play page applies a
   pulled merge before it loads the life, and a slow cloud never blocks play; Forgot password; 390 px layout; no errors. */
import { readFileSync } from 'fs';
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const LIFE = 'grimoire.life.siso.v1';
const HINT = 'grimoire.sync.hint.v1', LAST = 'grimoire.sync.lastUid.v1', BACKUP = 'grimoire.life.siso.v1.backup';
const ready = (page) => page.waitForFunction(() => window.__title && window.__title.ready, null, { timeout: 60000 });

const APP = 'export const initializeApp = (c) => ({ c });';
const AUTH = `
const U = () => JSON.parse(localStorage.getItem('stub.users') || '{}');
const cur = () => JSON.parse(localStorage.getItem('stub.user') || 'null');
const off = () => localStorage.getItem('stub.offline') === '1';
export const getAuth = () => ({});
export function onAuthStateChanged(a, cb) { setTimeout(() => cb(cur()), 0); return () => {}; }
export async function signInWithEmailAndPassword(a, e, p) {
  if (off()) throw { code: 'auth/network-request-failed' };
  const u = U()[e]; if (!u || u.pw !== p) throw { code: 'auth/invalid-credential' };
  localStorage.setItem('stub.user', JSON.stringify({ uid: u.uid, email: e })); return { user: { uid: u.uid, email: e } };
}
export async function createUserWithEmailAndPassword(a, e, p) {
  if (off()) throw { code: 'auth/network-request-failed' };
  const us = U(); if (us[e]) throw { code: 'auth/email-already-in-use' }; if (p.length < 6) throw { code: 'auth/weak-password' };
  us[e] = { pw: p, uid: 'uid-' + e.split('@')[0] }; localStorage.setItem('stub.users', JSON.stringify(us));
  localStorage.setItem('stub.user', JSON.stringify({ uid: us[e].uid, email: e })); return { user: { uid: us[e].uid, email: e } };
}
export async function signOut() { localStorage.removeItem('stub.user'); }
export async function sendPasswordResetEmail(a, e) { localStorage.setItem('stub.reset', e); }
`;
const FS = `
const off = () => localStorage.getItem('stub.offline') === '1';
const wait = () => new Promise((r) => setTimeout(r, Number(localStorage.getItem('stub.delay') || 0)));
const key = (p) => 'stub.cloud.' + p;
export const getFirestore = () => ({});
export const doc = (db, ...path) => ({ p: path.join('/') });
const snap = (raw) => ({ exists: () => raw != null, data: () => JSON.parse(raw) });
export async function getDoc(r) { await wait(); if (off()) throw { code: 'unavailable' }; return snap(localStorage.getItem(key(r.p))); }
export async function runTransaction(db, fn) {
  await wait(); if (off()) throw { code: 'unavailable' };
  const tx = { get: async (r) => snap(localStorage.getItem(key(r.p))), set: (r, d) => { const ks = Object.keys(d).sort().join(); if (ks !== 'schema,siso,updatedAt') throw { code: 'permission-denied' }; localStorage.setItem(key(r.p), JSON.stringify(d)); } };
  return fn(tx);
}
`;
async function stub(page, hits) {
  await page.route('https://www.gstatic.com/firebasejs/10.12.0/*.js', (route) => {
    const f = route.request().url().split('/').pop();
    hits.push(f);
    route.fulfill({ contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: f === 'firebase-app.js' ? APP : f === 'firebase-auth.js' ? AUTH : FS });
  });
}
const buildLife = `
  const P = await import('./game/play/progress.js');
  let life = P.freshLife(Date.now() - 5 * 86400000), at = Date.now() - 4 * 86400000;
  for (const id of cards) life = P.recordSolve(life, { id, evidence: true, newConcept: true }, { help: 'clean', casts: [], nowMs: (at += 3600000) }).life;
`;
const putLocal = (page, cards) => page.evaluate(`(async () => { const cards = ${JSON.stringify(cards)}; ${buildLife} localStorage.setItem('grimoire.life.siso.v1', JSON.stringify({ ...life, spells: {} })); })()`);
const putCloud = (page, uid, cards) => page.evaluate(`(async () => { const cards = ${JSON.stringify(cards)}; ${buildLife} const D = await import('./game/sync/doc.js'); localStorage.setItem('stub.cloud.games/${uid}', JSON.stringify(D.toDoc({ life, spells: {} }))); })()`);
const seedUsers = (page) => page.evaluate(() => localStorage.setItem('stub.users', JSON.stringify({ 'ann@example.test': { pw: 'stub-pass-ann', uid: 'uid-ann' }, 'bob@example.test': { pw: 'stub-pass-bob', uid: 'uid-bob' } })));
const solves = (page, key = LIFE) => page.evaluate((k) => { const l = JSON.parse(localStorage.getItem(k) || 'null'); return l ? [...new Set(l.solves.map((s) => s.card))].sort().join() : null; }, key);
const cloud = (page, uid) => page.evaluate((u) => { const d = JSON.parse(localStorage.getItem('stub.cloud.games/' + u) || 'null'); return d ? d.siso.life.solves.map((s) => s.card).sort().join() : null; }, uid);
const ls = (page, k) => page.evaluate((x) => localStorage.getItem(x), k);
const openSettings = async (page) => { await page.click('#open-settings'); await page.waitForSelector('#settings[open]'); };
const signInAs = async (page, email, pw, create = false) => {
  await page.click(create ? '#acct-create' : '#acct-signin');
  await page.fill('#acct-email', email); await page.fill('#acct-pass', pw);
  await page.click('#acct-submit');
};
const fits = (page) => page.evaluate(() => { const d = document.querySelector('#settings'); const r = d.getBoundingClientRect(); return document.documentElement.scrollWidth <= innerWidth && r.left >= 0 && r.right <= innerWidth + 0.5 && d.scrollWidth <= d.clientWidth + 1; });
const VIEW = { viewport: { width: 1280, height: 800 }, acceptDownloads: true };

// ================= 1. a guest: no Firebase at all
{
  const hits = [];
  const { page, errors, close } = await openGame('', { context: VIEW, beforeGoto: (p) => stub(p, hits) });
  await ready(page);
  await openSettings(page);
  t.check('a guest sees the guest note and Sign in / Create account', /saved on this device only/.test(await page.textContent('#acct-guest')) && await page.isVisible('#acct-signin') && await page.isVisible('#acct-create'));
  t.check('a guest loads no Firebase module (not on load, not on opening Settings)', hits.length === 0, hits.join());
  await page.click('#acct-signin');
  await page.waitForTimeout(500);
  t.check('opening the sign-in form is what loads the SDK', hits.length === 3, hits.join());
  t.check('the form has labelled email and password inputs with the right types and autocomplete', await page.evaluate(() => {
    const e = document.querySelector('#acct-email'), p = document.querySelector('#acct-pass');
    return e.type === 'email' && e.autocomplete === 'email' && p.type === 'password' && p.autocomplete === 'current-password' && !!document.querySelector('label[for=acct-email]') && !!document.querySelector('label[for=acct-pass]') && document.querySelector('#acct-error').getAttribute('role') === 'alert';
  }));
  await page.fill('#acct-email', 'ann@example.test');
  await page.click('#acct-forgot');
  await page.waitForFunction(() => document.querySelector('#acct-reset-msg').textContent.length > 0);
  t.check('Forgot password says a link is on its way, whoever the email is', /If that email has an account, a reset link is on its way\./.test(await page.textContent('#acct-reset-msg')) && (await ls(page, 'stub.reset')) === 'ann@example.test');
  t.check('no page errors (guest)', errors.length === 0, errors.join('|'));
  await close();
}

// ================= 2. wrong password, then sign in merges guest + cloud (after the choice), sign out keeps the game
{
  const hits = [];
  const { page, errors, close } = await openGame('', { context: VIEW, beforeGoto: (p) => stub(p, hits) });
  await ready(page);
  await seedUsers(page); await putLocal(page, ['O1']); await putCloud(page, 'uid-ann', ['O2']);
  await page.reload(); await ready(page);
  await openSettings(page);
  await signInAs(page, 'ann@example.test', 'wrong-pass');
  await page.waitForFunction(() => document.querySelector('#acct-error').textContent.length > 0);
  t.check('a wrong password shows "Wrong email or password" in the alert line', (await page.textContent('#acct-error')) === 'Wrong email or password');
  t.check('the local game is untouched by a failed sign in', (await solves(page)) === 'O1' && !(await ls(page, HINT)));
  await page.fill('#acct-pass', 'stub-pass-ann'); await page.keyboard.press('Enter');
  await page.waitForSelector('#acct-choice:not([hidden])');
  t.check('a guest game meeting a cloud game asks first (nothing merged yet)', (await solves(page)) === 'O1' && (await cloud(page, 'uid-ann')) === 'O2');
  t.check('the safe choice is the primary one and has focus', await page.evaluate(() => document.activeElement.id === 'acct-keep' && document.querySelector('#acct-keep').classList.contains('primary')));
  await page.click('#acct-merge');
  await page.waitForSelector('#acct-in:not([hidden])');
  await page.waitForFunction(() => document.querySelector('.sync-chip') && document.querySelector('.sync-chip').dataset.status === 'synced', null, { timeout: 15000 });
  t.check('merging puts both games on this device and in the cloud', (await solves(page)) === 'O1,O2' && (await cloud(page, 'uid-ann')) === 'O1,O2', `${await solves(page)} / ${await cloud(page, 'uid-ann')}`);
  t.check('it shows the email and the sync chip', (await page.textContent('#acct-who')) === 'ann@example.test' && /Saved to the cloud/.test(await page.textContent('#acct-chip-slot')));
  t.check('the pre-merge save is kept for one undo; the last uid and a sign-in hint are stored', (await solves(page, BACKUP)) === 'O1' && (await ls(page, LAST)) === 'uid-ann' && (await ls(page, HINT)) === '1');
  t.check('the cloud document has exactly schema, updatedAt, siso', await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('stub.cloud.games/uid-ann'))).sort().join() === 'schema,siso,updatedAt'));
  await page.setViewportSize({ width: 390, height: 780 });
  t.check('the signed-in panel fits 390 px', await fits(page));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.click('#acct-sync'); await page.waitForFunction(() => /In sync/.test(document.querySelector('#acct-msg').textContent), null, { timeout: 15000 });
  t.check('Sync now reports in sync', true);
  await page.click('#acct-signout');
  await page.waitForSelector('#acct-out:not([hidden])');
  t.check('sign out keeps the local game, says so, stops syncing and forgets the hint', (await solves(page)) === 'O1,O2' && /still on this device/.test(await page.textContent('#acct-msg')) && !(await ls(page, HINT)) && !(await ls(page, 'stub.user')));
  await page.click('#acct-restore');
  t.check('Restore the save from before the last sync works (one level of undo)', /Restored/.test(await page.textContent('#acct-msg')) && (await solves(page)) === 'O1', `${await solves(page)} | ${await page.textContent('#acct-msg')}`);
  t.check('no page errors (sign in)', errors.length === 0, errors.join('|'));
  await close();
}

// ================= 3. another account's save: the default keeps both safe
{
  const hits = [];
  const { page, errors, close } = await openGame('', { context: VIEW, beforeGoto: (p) => stub(p, hits) });
  await ready(page);
  await seedUsers(page); await putLocal(page, ['O1']); await putCloud(page, 'uid-bob', ['O3']);
  await page.evaluate((k) => localStorage.setItem(k, 'uid-ann'), LAST);
  await page.reload(); await ready(page);
  await openSettings(page);
  await page.setViewportSize({ width: 390, height: 780 });
  await signInAs(page, 'bob@example.test', 'stub-pass-bob');
  await page.waitForSelector('#acct-choice:not([hidden])');
  t.check('the choice names the situation in plain words and fits 390 px', /another account \(or a guest game\)/.test(await page.textContent('#acct-choice-msg')) && await fits(page));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#acct-keep')]);
  const file = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  t.check('the default downloads the local game as a backup file', /^grimoire-save-/.test(dl.suggestedFilename()) && file.siso.life.solves.map((s) => s.card).join() === 'O1');
  await page.waitForSelector('#acct-in:not([hidden])');
  t.check('the cloud game is kept and the local one set aside (also kept under the backup key)', (await solves(page)) === 'O3' && (await cloud(page, 'uid-bob')) === 'O3' && (await solves(page, BACKUP)) === 'O1');
  t.check('the message says where the old game went', /downloaded as grimoire-save-/.test(await page.textContent('#acct-msg')));
  t.check('no page errors (other account)', errors.length === 0, errors.join('|'));
  await close();
}

// ================= 4. creating an account: plain errors; a game and an empty cloud upload with no question; offline chip
{
  const { page, errors, close } = await openGame('', { context: VIEW, beforeGoto: (p) => stub(p, []) });
  await ready(page);
  await seedUsers(page); await putLocal(page, ['O1']);
  await page.reload(); await ready(page);
  await openSettings(page);
  await signInAs(page, 'ann@example.test', 'stub-pass-ann', true);
  await page.waitForFunction(() => document.querySelector('#acct-error').textContent.length > 0);
  t.check('creating an account with a used email says so plainly', (await page.textContent('#acct-error')) === 'That email is already in use');
  await page.fill('#acct-email', 'new@example.test'); await page.fill('#acct-pass', '123');
  await page.click('#acct-submit');
  await page.waitForFunction(() => /6 characters/.test(document.querySelector('#acct-error').textContent));
  t.check('a short password says so plainly', (await page.textContent('#acct-error')) === 'Password must be at least 6 characters');
  await page.fill('#acct-pass', 'stub-pass-new'); await page.click('#acct-submit');
  await page.waitForSelector('#acct-in:not([hidden])');
  await page.waitForFunction(() => document.querySelector('.sync-chip')?.dataset.status === 'synced', null, { timeout: 15000 });
  t.check('a guest game and an empty new cloud: no question, the game is uploaded', (await cloud(page, 'uid-new')) === 'O1' && (await solves(page)) === 'O1');
  await page.context().setOffline(true);
  await page.waitForFunction(() => document.querySelector('.sync-chip')?.dataset.status === 'offline', null, { timeout: 5000 });
  t.check('offline: the chip shows offline and the local game is untouched', /Offline/.test(await page.textContent('#acct-chip-slot')) && (await solves(page)) === 'O1');
  await page.context().setOffline(false);
  t.check('no page errors (create)', errors.length === 0, errors.join('|'));
  await close();
}

// ================= 5. the play page: pull before the life loads; slow or failing clouds never block play
async function signedInDevice(local, remote) {
  const o = await openGame('', { context: VIEW, beforeGoto: (p) => stub(p, []) });
  await ready(o.page);
  await seedUsers(o.page); await putLocal(o.page, local); await putCloud(o.page, 'uid-ann', remote);
  await o.page.evaluate(([h, l]) => { localStorage.setItem(h, '1'); localStorage.setItem(l, 'uid-ann'); localStorage.setItem('stub.user', JSON.stringify({ uid: 'uid-ann', email: 'ann@example.test' })); }, [HINT, LAST]);
  return o;
}
const playReady = (page, ms = 60000) => page.waitForFunction(() => window.__play && window.__play.ready, null, { timeout: ms });
const toPlay = (page) => page.goto(new URL('game/play/index.html', page.url()).href, { waitUntil: 'domcontentloaded' });
{
  const { page, errors, close } = await signedInDevice(['O1'], ['O1', 'O2']);
  await toPlay(page);
  await playReady(page);
  t.check('the play page applied the pulled merge before loading its life', (await solves(page)) === 'O1,O2', await solves(page));
  t.check('no "reload" toast (it was applied in time) and the sync hook is installed', !(await page.$('.sync-toast')) && await page.evaluate(() => typeof window.__sync?.notifyLocalChange === 'function'));
  await page.waitForFunction(() => document.querySelector('#hud .sync-chip')?.dataset.status === 'synced', null, { timeout: 15000 });
  t.check('the sync chip is in the HUD and says saved', /Saved to the cloud/.test(await page.textContent('#hud .sync-chip')));
  t.check('no page errors (play)', errors.length === 0, errors.join('|'));
  await close();
}
{
  const { page, errors, close } = await signedInDevice(['O1'], ['O1', 'O2']);
  const saved = await ls(page, LIFE);
  const f0 = Date.now();
  await toPlay(page); await playReady(page);
  const fast = Date.now() - f0;
  await page.evaluate(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('stub.delay', '7000'); }, [LIFE, saved]);
  const t0 = Date.now();
  await page.reload();
  await playReady(page);
  const took = Date.now() - t0;
  t.check('a slow cloud (7 s) holds play back by about 3 seconds at most', took - fast < 4500, `${took} ms against ${fast} ms with a fast cloud`);
  t.check('play started on the local game', (await solves(page)) === 'O1');
  await page.waitForSelector('.sync-toast', { timeout: 25000 });
  t.check('what arrives later is not forced in: a toast says a newer game is ready', /newer game from another device is ready: reload to use it/.test(await page.textContent('.sync-toast')) && (await solves(page)) === 'O1');
  await page.evaluate(() => localStorage.setItem('stub.delay', '0'));
  await page.reload(); await playReady(page);
  t.check('the next load applies it', (await solves(page)) === 'O1,O2');
  t.check('no page errors (slow cloud)', errors.length === 0, errors.join('|'));
  await close();
}
{
  const { page, errors, close } = await signedInDevice(['O1'], ['O1', 'O2']);
  await page.evaluate(() => localStorage.setItem('stub.offline', '1'));
  await toPlay(page);
  await playReady(page);
  t.check('with the cloud failing, the game is playable on the local save', (await solves(page)) === 'O1');
  await page.setViewportSize({ width: 390, height: 780 });
  t.check('the HUD (with the chip) does not overflow at 390 px', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  t.check('no page errors (cloud failing)', errors.length === 0, errors.join('|'));
  await close();
}
t.finish();
