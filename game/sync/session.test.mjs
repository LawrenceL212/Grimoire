import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, KEYS } from './session.js';
import { memoryBackend } from './engine.js';
import { localAdapter } from './local.js';
import { firebaseBackend, mapError } from './firebase.js';
import { device, card, T0, NOW } from './_kit.mjs';
import { LIFE_KEY } from '../play/progress.js';

const H = 3600000;
function mapStorage() {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null };
}
const dev = (id, at) => { const d = device(); d.solve(card(id), { at }); return d; };
const put = (storage, d) => localAdapter(storage).writeLocal(d.state());
const ids = (doc) => [...new Set(doc.siso.life.solves.map((s) => s.card))].sort().join();
const idsLocal = (storage) => { const l = JSON.parse(storage.getItem(LIFE_KEY)); return [...new Set(l.solves.map((s) => s.card))].sort().join(); };
function rig({ local, remote, goLive = false, writeFails = false } = {}) {
  const storage = mapStorage();
  if (local) put(storage, local);
  const backend = memoryBackend({ doc: remote ? remote.doc() : null, versions: false });
  const toasts = [], timers = [];
  const ad = localAdapter(storage);
  const la = writeFails ? { readLocal: ad.readLocal, writeLocal: () => false } : ad;
  const fb = { firebaseBackend: () => backend, signOutNow: async () => ({ ok: true }) };
  const s = createSession({ fb, storage, local: la, onToast: (m) => toasts.push(m), now: () => NOW, engineOptions: { listen: false, setTimer: (f, ms) => { timers.push(ms); return timers.length; }, clearTimer: () => {}, isOnline: () => true } });
  if (goLive) s.goLive();
  return { s, storage, backend, toasts, timers };
}

test('a cloud merge arriving while the page is live is PUSHED, held locally, shown as "held" and never retried', async () => {
  const r = rig({ local: dev('O1', T0 + H), remote: dev('O2', T0 + 2 * H), goLive: true });
  const seen = []; r.s.source.onStatus((st) => seen.push(st));
  const res = await r.s.start({ uid: 'u1', email: 'a@x.test' });
  assert.equal(res.ok, true);
  assert.equal(ids(r.backend.doc), 'O1,O2');           // the merge reached the cloud
  assert.equal(idsLocal(r.storage), 'O1');              // the page's own save was not touched
  assert.deepEqual(r.toasts, ['A newer game from another device is ready: reload to use it']);
  assert.equal(r.s.engine().status(), 'synced');
  assert.equal(seen.at(-1), 'held');
  assert.equal(r.timers.length, 0, 'no retry timer');
  await r.s.syncNow();
  assert.equal(r.toasts.length, 1, 'one toast per page');
  assert.equal(r.timers.length, 0);
});

test('before the page is live, the merge is written locally and the status is plain synced', async () => {
  const r = rig({ local: dev('O1', T0 + H), remote: dev('O2', T0 + 2 * H) });
  const res = await r.s.start({ uid: 'u1' });
  assert.equal(res.ok, true);
  assert.equal(idsLocal(r.storage), 'O1,O2');
  assert.equal(r.toasts.length, 0);
  assert.equal(r.storage.getItem(KEYS.lastUid), 'u1');
});

test('the first engine success sets lastUid even when the first connect was offline', async () => {
  const r = rig({ remote: dev('O2', T0 + 2 * H) });
  r.backend.setOnline(false);
  const res = await r.s.start({ uid: 'u1' });
  assert.equal(res.ok, false);
  assert.equal(r.storage.getItem(KEYS.lastUid), null);
  r.backend.setOnline(true);
  await r.s.syncNow();
  assert.equal(r.storage.getItem(KEYS.lastUid), 'u1');
});

test('the choice says whether the cloud has a game; "aside" is refused when it has none', async () => {
  const empty = rig({ local: dev('O1', T0 + H) });
  const a = await empty.s.connect({ uid: 'u1' });
  assert.equal(a.needsChoice, undefined, 'a guest game and an empty cloud: no question');
  const other = rig({ local: dev('O1', T0 + H) });
  other.storage.setItem(KEYS.lastUid, 'uOther');
  const q = await other.s.connect({ uid: 'u1' });
  assert.equal(q.needsChoice, true); assert.equal(q.hasCloud, false);
  const bad = await other.s.connect({ uid: 'u1' }, 'aside');
  assert.equal(bad.ok, false);
  assert.equal(idsLocal(other.storage), 'O1', 'nothing wiped');
  assert.equal(other.backend.doc, null);
  const full = rig({ local: dev('O1', T0 + H), remote: dev('O2', T0 + 2 * H) });
  const q2 = await full.s.connect({ uid: 'u1' });
  assert.equal(q2.needsChoice, true); assert.equal(q2.hasCloud, true);
});

test('aside: a failed local write returns ok:false before lastUid is set or the engine starts', async () => {
  const r = rig({ local: dev('O1', T0 + H), remote: dev('O2', T0 + 2 * H), writeFails: true });
  const res = await r.s.connect({ uid: 'u1' }, 'aside');
  assert.equal(res.ok, false);
  assert.match(res.error, /could not store|device/i);
  assert.equal(r.storage.getItem(KEYS.lastUid), null);
  assert.equal(r.s.engine(), null);
  assert.equal(idsLocal(r.storage), 'O1');
});

test('aside with a cloud game keeps the cloud game and the old one in the backup', async () => {
  const r = rig({ local: dev('O1', T0 + H), remote: dev('O2', T0 + 2 * H) });
  const res = await r.s.connect({ uid: 'u1' }, 'aside');
  assert.equal(res.ok, true);
  assert.ok(res.backupFile);
  assert.equal(idsLocal(r.storage), 'O2');
  assert.equal(JSON.parse(r.storage.getItem('grimoire.life.siso.v1.backup')).solves[0].card, 'O1');
});

test('restoreBackup is the one in local.js (swaps, so it can be undone)', async () => {
  const r = rig({ local: dev('O1', T0 + H), remote: dev('O2', T0 + 2 * H) });
  await r.s.connect({ uid: 'u1' }, 'aside');
  assert.equal(r.s.restoreBackup().ok, true);
  assert.equal(idsLocal(r.storage), 'O1');
  assert.equal(r.s.restoreBackup().ok, true);
});

test('a transaction on a corrupt remote document throws instead of overwriting it', async () => {
  const docs = new Map([['games/u1', { schema: 99 }]]);
  const store = { read: async () => null, transact: async (p, fn) => { const n = fn(docs.get(p.join('/'))); if (n) docs.set(p.join('/'), n); } };
  await assert.rejects(firebaseBackend('u1', { store, now: () => NOW }).push(dev('O1', T0 + H).doc()), /could not be read/);
  assert.equal(docs.get('games/u1').schema, 99);
});

test('mapError: the word "import" is not offline; permission-denied mentions the rules', () => {
  assert.match(mapError(new Error('cannot import the thing')), /safe on this device/);
  assert.match(mapError({ code: 'permission-denied' }), /rules are published/);
});
