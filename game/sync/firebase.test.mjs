import test from 'node:test';
import assert from 'node:assert/strict';
import { firebaseBackend, mapError } from './firebase.js';
import { createSync } from './engine.js';
import { fromDoc } from './doc.js';
import { xpOf } from '../play/progress.js';
import { device, card, T0, NOW } from './_kit.mjs';

const H = 3600000;
// a fake Firestore: documents in a Map; transact reads, runs fn, writes (and can inject a concurrent write first)
function fakeStore({ fail = null } = {}) {
  const docs = new Map();
  const s = {
    docs, writes: [], beforeTx: null,
    async read(p) { if (fail) throw fail; return docs.has(p.join('/')) ? structuredClone(docs.get(p.join('/'))) : null; },
    async transact(p, fn) {
      if (fail) throw fail;
      s.beforeTx?.(); s.beforeTx = null;
      const next = fn(docs.has(p.join('/')) ? structuredClone(docs.get(p.join('/'))) : null);
      if (next) { docs.set(p.join('/'), structuredClone(next)); s.writes.push(next); }
    },
  };
  return s;
}
const A = () => { const d = device(); d.solve(card('c1'), { at: T0 + H }); return d; };
const B = () => { const d = device(); d.solve(card('c2'), { at: T0 + 2 * H }); return d; };

test('pull of a missing document is null', async () => {
  const b = firebaseBackend('u1', { store: fakeStore(), now: () => NOW });
  assert.equal(await b.pull(), null);
});

test('push writes exactly schema, updatedAt and siso, at games/{uid}', async () => {
  const st = fakeStore();
  await firebaseBackend('u1', { store: st, now: () => NOW }).push(A().doc());
  assert.deepEqual([...st.docs.keys()], ['games/u1']);
  const w = st.writes[0];
  assert.deepEqual(Object.keys(w).sort(), ['schema', 'siso', 'updatedAt']);
  assert.equal(w.schema, 1);
  assert.ok(Number.isInteger(w.updatedAt) || typeof w.updatedAt === 'number');
  assert.ok(w.siso && typeof w.siso === 'object');
  assert.equal(JSON.stringify(w).includes('undefined'), false);
  const back = await firebaseBackend('u1', { store: st, now: () => NOW }).pull();
  assert.deepEqual(Object.keys(back).sort(), ['schema', 'siso', 'updatedAt']);
});

test('a document with extra keys is pulled and pushed with only the three', async () => {
  const st = fakeStore();
  const d = A().doc();
  st.docs.set('games/u1', { ...d, extra: 1, uid: 'x' });
  const b = firebaseBackend('u1', { store: st, now: () => NOW });
  assert.deepEqual(Object.keys(await b.pull()).sort(), ['schema', 'siso', 'updatedAt']);
  await b.push(B().doc());
  assert.deepEqual(Object.keys(st.writes[0]).sort(), ['schema', 'siso', 'updatedAt']);
});

test('push merges a concurrent remote change instead of overwriting it', async () => {
  const st = fakeStore();
  const b = firebaseBackend('u1', { store: st, now: () => NOW });
  const a = A(), bb = B();
  st.beforeTx = () => st.docs.set('games/u1', structuredClone(bb.doc())); // another device writes between our pull and push
  await b.push(a.doc());
  const out = fromDoc(st.docs.get('games/u1'), { now: NOW });
  assert.ok(out.ok);
  assert.deepEqual(out.state.life.solves.map((s) => s.card).sort(), ['c1', 'c2']);
  assert.equal(xpOf(out.state.life), 20);
});

test('a corrupt remote document does not block a push', async () => {
  const st = fakeStore();
  st.docs.set('games/u1', { schema: 99, junk: true });
  await firebaseBackend('u1', { store: st, now: () => NOW }).push(A().doc());
  assert.equal(st.docs.get('games/u1').schema, 1);
});

test('error mapping is plain English', () => {
  assert.equal(mapError({ code: 'auth/wrong-password' }), 'Wrong email or password');
  assert.equal(mapError({ code: 'auth/invalid-credential' }), 'Wrong email or password');
  assert.equal(mapError({ code: 'auth/email-already-in-use' }), 'That email is already in use');
  assert.equal(mapError({ code: 'auth/weak-password' }), 'Password must be at least 6 characters');
  assert.match(mapError({ code: 'auth/network-request-failed' }), /^No connection: your game is saved on this device and will sync later/);
  assert.match(mapError({ code: 'unavailable' }), /^No connection/);
  assert.match(mapError(new TypeError('Failed to fetch')), /^No connection/);
  assert.match(mapError({ code: 'something/odd' }), /safe on this device/);
  assert.match(mapError(null), /safe on this device/);
});

test('fail soft: store errors reject with a plain message and never leak the raw error; the engine turns them into a status', async () => {
  const err = Object.assign(new Error('raw internal 503 secret'), { code: 'unavailable' });
  const b = firebaseBackend('u1', { store: fakeStore({ fail: err }), now: () => NOW });
  await assert.rejects(b.pull(), (e) => /^No connection/.test(e.message) && !/secret/.test(e.message));
  await assert.rejects(b.push(A().doc()), (e) => /^No connection/.test(e.message));
  const d = A();
  const sync = createSync({ backend: b, readLocal: () => d.state(), writeLocal: () => {}, now: () => NOW, listen: false, isOnline: () => true, setTimer: () => 0, clearTimer: () => {} });
  const r = await sync.syncNow();
  assert.equal(r.ok, false);
  assert.equal(sync.status(), 'error');
});

test('the engine over the backend: two devices converge through the cloud', async () => {
  const st = fakeStore();
  const mk = (d) => { let state = d.state(); return { sync: createSync({ backend: firebaseBackend('u1', { store: st, now: () => NOW }), readLocal: () => state, writeLocal: (s) => { state = s; }, now: () => NOW, listen: false, setTimer: () => 0, clearTimer: () => {} }), get: () => state }; };
  const x = mk(A()), y = mk(B());
  await x.sync.syncNow(); await y.sync.syncNow(); await x.sync.syncNow();
  assert.deepEqual(x.get().life.solves.map((s) => s.card).sort(), ['c1', 'c2']);
  assert.deepEqual(y.get().life.solves.map((s) => s.card).sort(), ['c1', 'c2']);
});
