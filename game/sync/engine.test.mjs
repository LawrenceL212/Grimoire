import test from 'node:test';
import assert from 'node:assert/strict';
import { createSync, memoryBackend } from './engine.js';
import { toDoc, fromDoc, canon } from './doc.js';
import { xpOf } from '../play/progress.js';
import { device, card, T0, NOW } from './_kit.mjs';

const H = 3600000;
// a fake clock: timers fire only when the test advances time
function clock() {
  let t = 0, id = 0; const q = new Map();
  return {
    setTimer: (fn, ms) => { q.set(++id, { at: t + ms, fn }); return id; },
    clearTimer: (i) => q.delete(i),
    pending: () => [...q.values()].map((x) => x.at - t).sort((a, b) => a - b),
    async advance(ms) {
      const end = t + ms;
      for (;;) {
        const next = [...q.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        q.delete(next[0]); t = next[1].at; next[1].fn();
        for (let i = 0; i < 20; i++) await Promise.resolve();
      }
      t = end; for (let i = 0; i < 20; i++) await Promise.resolve();
    },
  };
}
const settle = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };

// a device with its own local save in memory
function phone(d, backend, clk, extra = {}) {
  const box = { state: d.state() };
  const sync = createSync({
    backend, readLocal: () => box.state, writeLocal: (s) => { box.state = s; }, now: () => NOW,
    setTimer: clk.setTimer, clearTimer: clk.clearTimer, listen: false, isOnline: () => !(extra.offline?.v), ...extra,
  });
  return { box, sync, docNow: () => toDoc(box.state, { now: NOW }) };
}

test('no backend: the game just plays, status idle, nothing throws, local untouched', async () => {
  const d = device(); d.solve(card('X'), { at: T0 + H });
  const box = { state: d.state() };
  const sync = createSync({ readLocal: () => box.state, writeLocal: () => { throw new Error('must not write'); }, now: () => NOW, listen: false });
  const seen = []; sync.onStatus((s) => seen.push(s));
  await sync.start(); sync.notifyChange(); await sync.flush();
  assert.deepEqual(seen, ['idle']);
  assert.equal(sync.hasBackend, false);
});

test('two-device simulation converges to the same save, with no double credit', async () => {
  const cloud = memoryBackend(), clk = clock();
  const a = device(), b = device();
  a.solve(card('X'), { at: T0 + H, casts: ['where'] });
  b.solve(card('Y'), { at: T0 + 2 * H, casts: ['select-all'] });
  b.solve(card('X'), { at: T0 + 3 * H });                  // the same card again on B: a re-solve after A's
  const A = phone(a, cloud, clock()), B = phone(b, cloud, clk);
  await A.sync.start();                                     // cloud had nothing: A's save goes up
  assert.ok(cloud.doc);
  await B.sync.start();                                     // B pulls, merges, writes local, pushes
  await A.sync.syncNow();                                   // A picks B's progress up
  assert.equal(canon(A.docNow().siso), canon(B.docNow().siso));
  assert.equal(canon(cloud.doc.siso), canon(A.docNow().siso));
  assert.equal(xpOf(A.box.state.life), 20);
  assert.equal(A.box.state.life.solves.length, 3);
  assert.equal(A.sync.status(), 'synced');
});

test('local is never lowered by a stale remote', async () => {
  const stale = device(); const cloud = memoryBackend({ doc: stale.doc() });
  const a = device(); a.solve(card('X'), { at: T0 + H }); a.solve(card('Y'), { at: T0 + 2 * H });
  const A = phone(a, cloud, clock());
  await A.sync.start();
  assert.equal(xpOf(A.box.state.life), 20);
  assert.equal(xpOf(cloud.doc.siso.life), 20); // and the cloud caught up
});

test('a new device (no local save) takes the cloud save; with nothing anywhere nothing is written', async () => {
  const a = device(); a.solve(card('X'), { at: T0 + H }); a.solve(card('Y'), { at: T0 + 2 * H });
  const cloud = memoryBackend({ doc: a.doc() });
  const box = { state: null };
  const sync = createSync({ backend: cloud, readLocal: () => box.state, writeLocal: (s) => { box.state = s; }, now: () => NOW, listen: false });
  await sync.start();
  assert.equal(xpOf(box.state.life), 20);
  const empty = memoryBackend(); let wrote = 0;
  const s2 = createSync({ backend: empty, readLocal: () => null, writeLocal: () => { wrote++; }, now: () => NOW, listen: false });
  await s2.start();
  assert.equal(wrote, 0); assert.equal(empty.doc, null); assert.equal(s2.status(), 'synced');
});

test('offline, then back online: the progress made offline is pushed', async () => {
  const cloud = memoryBackend(), clk = clock(), off = { v: false };
  const a = device(); a.solve(card('X'), { at: T0 + H });
  const A = phone(a, cloud, clk, { offline: off });
  await A.sync.start();
  assert.equal(A.sync.status(), 'synced');
  off.v = true; cloud.setOnline(false);
  a.solve(card('Y'), { at: T0 + 2 * H }); A.box.state = a.state();
  A.sync.notifyChange();
  await clk.advance(5000);
  assert.equal(A.sync.status(), 'offline');
  assert.equal(xpOf(cloud.doc.siso.life), 10);              // the cloud still has only the first solve
  off.v = false; cloud.setOnline(true);
  await clk.advance(60000);                                  // the retry fires
  assert.equal(A.sync.status(), 'synced');
  assert.equal(xpOf(cloud.doc.siso.life), 20);
});

test('debounce: a burst of changes is one push after 5 s; flush pushes at once', async () => {
  const cloud = memoryBackend(), clk = clock();
  const a = device(); a.solve(card('X'), { at: T0 + H });
  const A = phone(a, cloud, clk);
  await A.sync.start();
  const base = cloud.pushes;
  for (let i = 0; i < 5; i++) { a.solve(card('C' + i), { at: T0 + (i + 2) * H }); A.box.state = a.state(); A.sync.notifyChange(); await clk.advance(1000); }
  assert.equal(cloud.pushes, base);                          // 5 s of quiet has not passed since the last change
  await clk.advance(4001);
  assert.equal(cloud.pushes, base + 1);
  assert.equal(xpOf(cloud.doc.siso.life), 60);
  a.solve(card('LATE'), { at: T0 + 20 * H }); A.box.state = a.state(); A.sync.notifyChange();
  await A.sync.flush();                                      // pagehide: no waiting
  assert.equal(cloud.pushes, base + 2);
  assert.equal(xpOf(cloud.doc.siso.life), 70);
  await clk.advance(10000);
  assert.equal(cloud.pushes, base + 2);                      // the flushed debounce did not fire a second time
});

test('failures retry with backoff 1 s doubling to 60 s, never throw, and recover', async () => {
  const cloud = memoryBackend(), clk = clock();
  const a = device(); a.solve(card('X'), { at: T0 + H });
  const A = phone(a, cloud, clk);
  const seen = []; A.sync.onStatus((s) => seen.push(s));
  cloud.failNext(8);
  await assert.doesNotReject(A.sync.start());
  assert.equal(A.sync.status(), 'error');
  const delays = [];
  for (let i = 0; i < 7; i++) { delays.push(clk.pending()[0]); await clk.advance(clk.pending()[0]); }
  assert.deepEqual(delays, [1000, 2000, 4000, 8000, 16000, 32000, 60000]);
  await clk.advance(60000);
  assert.equal(A.sync.status(), 'synced');
  assert.equal(clk.pending().length, 0);
  assert.ok(seen.includes('error') && seen.includes('syncing') && seen.at(-1) === 'synced');
  assert.ok(cloud.doc);
});

test('a broken backend, a throwing writeLocal and a garbage remote never throw into the caller', async () => {
  const clk = clock(), a = device(); a.solve(card('X'), { at: T0 + H });
  const boom = { pull: () => { throw new Error('sync pull'); }, push: async () => { throw new Error('x'); } };
  const s1 = createSync({ backend: boom, readLocal: () => a.state(), writeLocal: () => {}, now: () => NOW, setTimer: clk.setTimer, clearTimer: clk.clearTimer, listen: false });
  await assert.doesNotReject(s1.start());
  assert.equal(s1.status(), 'error');
  const garbage = { async pull() { return { schema: 99, nope: true }; }, async push() { throw new Error('must not push over garbage'); } };
  const s2 = createSync({ backend: garbage, readLocal: () => a.state(), writeLocal: () => { throw new Error('must not write'); }, now: () => NOW, setTimer: clk.setTimer, clearTimer: clk.clearTimer, listen: false });
  await assert.doesNotReject(s2.start());
  assert.equal(s2.status(), 'error');
  const other = device(); other.solve(card('Y'), { at: T0 + 2 * H });
  const s3 = createSync({ backend: memoryBackend({ doc: other.doc() }), readLocal: () => a.state(), writeLocal: () => { throw new Error('disk full'); }, now: () => NOW, setTimer: clk.setTimer, clearTimer: clk.clearTimer, listen: false });
  await assert.doesNotReject(s3.start());
  assert.equal(s3.status(), 'error');
});

test('progress made while a pull is in flight is not overwritten', async () => {
  const a = device(); a.solve(card('X'), { at: T0 + H });
  const other = device(); other.solve(card('Y'), { at: T0 + 2 * H });
  const box = { state: a.state() };
  let release;
  const slow = { async pull() { await new Promise((r) => { release = r; }); return other.doc(); }, async push() {} };
  const s = createSync({ backend: slow, readLocal: () => box.state, writeLocal: (st) => { box.state = st; }, now: () => NOW, listen: false });
  const run = s.start();
  await settle();
  a.solve(card('Z'), { at: T0 + 3 * H }); box.state = a.state(); // the player solves while we wait
  release(); await run;
  assert.equal(xpOf(box.state.life), 30);
});

test('status events and unsubscribe', async () => {
  const cloud = memoryBackend(), a = device(); a.solve(card('X'), { at: T0 + H });
  const A = phone(a, cloud, clock());
  const seen = []; const off = A.sync.onStatus((s) => seen.push(s));
  await A.sync.start();
  off(); await A.sync.syncNow();
  assert.deepEqual(seen, ['idle', 'syncing', 'synced']);
});
