// tests for the review fixes: a forged save cannot mint credit; purchases survive a merge; the home winner is a total
// order (associative merge); spell stability is never mixed between records; a fast clock loses no solves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDoc, canon, SKEW_MS } from './doc.js';
import { mergeSaves, mergeDetailed, NOTICE_SPENT, NOTICE_SET_ASIDE } from './merge.js';
import { xpOf } from '../play/progress.js';
import { earnedOf, priceOf } from '../play/home-rules.js';
import { LADDER, DAILY_CAP } from '../problems/ladder.js';
import { device, card, T0, NOW } from './_kit.mjs';

const H = 3600000, DAY = 86400000;
const merge = (a, b) => mergeSaves(a, b, { now: NOW });
const C = (id) => card(id);

test('CRITICAL 1: a forged save cannot mint credit (fake ids, a huge balance, unbacked ink, teaching tickets, pace)', () => {
  const base = JSON.parse(JSON.stringify(device().doc()));
  const L = base.siso.life;
  for (let i = 0; i < 1500; i++) L.solves.push({ card: `fake-${i}`, atMs: T0 + i, help: 'clean', unaided: true, xp: 10, lang: 'sql' });
  for (let i = 0; i < 60; i++) L.solves.push({ card: 'T02', atMs: T0 + 10 + i, help: 'clean', unaided: true, xp: 10, lang: 'sql' }); // the same card again and again
  L.solves.push({ card: 'O1', atMs: T0 + 5000, help: 'clean', unaided: true, xp: 10, lang: 'sql' }); // a teaching ticket
  L.highMs = T0 + 1e7;
  L.home.balance = 99999999;
  L.home.items.push({ uid: 'i77', id: 'sofa', tone: null, x: null, z: null, rot: 0 }); L.home.seq = 77;
  L.cards.fake = { hint: 0 };
  L.days['2026-10-01'] = ['T02', 'T03', 'T04', 'G1', 'T08', 'T10', 'T11', 'fake'];
  base.siso.spells = { limit: { langs: ['sql'], written: true, lastMs: T0 + H, stability: 3000, assisted: false, forms: { sql: { written: true, lastMs: T0 + H, stability: 3000 } } },
    where: { langs: ['sql'], written: true, lastMs: T0 + H, stability: 30, assisted: false, forms: {} } };
  const r = checkDoc(base, { now: NOW });
  assert.ok(r.ok);
  const out = r.doc.siso.life;
  assert.ok(out.solves.every((s) => LADDER.some((c) => c.id === s.card)), 'only real cards');
  assert.equal(out.solves.filter((s) => s.card === 'T02' && !s.practice).length, 4); // one real solve plus the extras that are kept
  assert.equal(xpOf(out), 10);                                 // T02 once; the teaching ticket and the fakes pay nothing
  assert.equal(earnedOf(out.solves), 40);
  assert.ok(out.home.balance <= 40);
  assert.equal(out.home.items.some((i) => i.id === 'sofa'), false);
  assert.ok(Object.values(out.days).every((ids) => ids.length <= DAILY_CAP && !ids.includes('fake')));
  assert.equal(r.doc.siso.spells.limit.written, false);       // no solve at or after the card that teaches it
  assert.equal(r.doc.siso.spells.limit.forms.sql.written, false);
  assert.equal(r.doc.siso.spells.where.written, false);       // T02 is before the card that teaches where
  assert.ok(!('fake' in out.cards));
});

test('CRITICAL 1: ink needs a real unaided solve at or after the teaching card; a guided solve does not back it', () => {
  const a = device();
  a.solve(C('T03'), { at: T0 + H, casts: ['where'] });
  assert.equal(a.doc().siso.spells.where.written, true);
  const g = device();
  g.solve(C('T03'), { at: T0 + H, casts: ['where'], help: 'guided' });
  const forged = a.doc(); forged.siso.life = g.doc().siso.life;     // ink from a, solves from a guided player
  const r = checkDoc(forged, { now: NOW });
  assert.equal(r.doc.siso.spells.where.written, false);
  assert.equal(r.doc.siso.spells.where.langs.includes('sql'), true); // exposure kept
});

test('IMPORTANT 3: purchases are never deleted when merged earnings fall; the balance floors at 0 and a notice says so', () => {
  const a = device(), b = device();
  a.solve(C('T03'), { at: T0 + 2 * H });
  assert.ok(a.buy('bedside-table').ok);                           // 35 of the 40 earned
  b.help('T03', { hint: 2 }); b.solve(C('T03'), { at: T0 + H, help: 'guided' }); // the earlier, guided solve
  const r = mergeDetailed(a.doc(), b.doc(), { now: NOW });
  const home = r.doc.siso.life.home;
  assert.equal(earnedOf(r.doc.siso.life.solves), 0);
  assert.ok(home.items.some((i) => i.id === 'bedside-table'));
  assert.equal(home.balance, 0);
  assert.ok(r.notices.includes(NOTICE_SPENT));
  assert.deepEqual(checkDoc(r.doc, { now: NOW }).doc, r.doc);     // the merged doc is stable under the gate
  assert.deepEqual(mergeDetailed(b.doc(), a.doc(), { now: NOW }).doc, r.doc);
});

test('MINOR: a purchase on the losing device is set aside and the notice says its money came back', () => {
  const a = device(), b = device();
  for (const id of ['T02', 'T03', 'T04']) { a.solve(C(id), { at: T0 + H }); }
  a.buy('laptop'); a.buy('desk-lamp');
  b.solve(C('G1'), { at: T0 + 2 * H }); b.buy('plant-small');
  const r = mergeDetailed(a.doc(), b.doc(), { now: NOW });
  assert.ok(r.notices.includes(NOTICE_SET_ASIDE));
  assert.ok(!r.doc.siso.life.home.items.some((i) => i.id === 'plant-small' && !i.starter));
  assert.equal(r.doc.siso.life.home.balance, 160 - 80);          // 4 solves earned, only the winner's 80 spent
});

// ---- IMPORTANT 4: a fuzz over triples
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
function randomDevice(r, k) {
  const d = device(T0 + Math.floor(r() * 5) * H);
  const ids = ['T02', 'T03', 'T04', 'G1', 'T08', 'T10', 'T11'];
  const n = Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const id = ids[Math.floor(r() * ids.length)];
    const help = ['clean', 'clean', 'nudged', 'guided', 'exposure'][Math.floor(r() * 5)];
    const casts = r() < 0.6 ? [['where'], ['select-all'], ['compare', 'where'], ['order-by']][Math.floor(r() * 4)] : [];
    if (r() < 0.3) d.help(id, { hint: Math.floor(r() * 5), codexEarly: r() < 0.3 });
    d.solve(C(id), { at: T0 + Math.floor(r() * 40) * H + k, help, casts, practice: r() < 0.1 });
    if (r() < 0.25) d.start(C(id), T0 + Math.floor(r() * 3) * DAY);
  }
  const shop = ['laptop', 'desk-lamp', 'office-chair', 'plant-small', 'poster'];
  for (let i = 0; i < 3; i++) if (r() < 0.5) d.buy(shop[Math.floor(r() * shop.length)]);
  return d.doc();
}
test('IMPORTANT 4: (AB)C, A(BC), (AC)B and the swapped orders agree on 5000 random triples; merge is idempotent', () => {
  const r = rng(12345);
  const pool = Array.from({ length: 60 }, (_, k) => randomDevice(r, k));
  const same = (x, y) => canon(x) === canon(y);
  for (let n = 0; n < 5000; n++) {
    const [A, B, Cc] = [0, 0, 0].map(() => pool[Math.floor(r() * pool.length)]);
    const ab = merge(A, B);
    assert.ok(same(ab, merge(B, A)), `commutative at ${n}`);
    const x = merge(ab, Cc), y = merge(A, merge(B, Cc)), z = merge(merge(A, Cc), B);
    assert.ok(same(x, y), `(AB)C vs A(BC) at ${n}`);
    assert.ok(same(x, z), `(AB)C vs (AC)B at ${n}`);
    assert.ok(same(merge(ab, ab), ab), `idempotent at ${n}`);
  }
});

test('IMPORTANT 4: identical seq, stamp and items from two devices still merge commutatively', () => {
  const a = device(), b = device();
  a.solve(C('T03'), { at: T0 + H }); b.solve(C('T04'), { at: T0 + H });
  a.buy('laptop'); b.buy('laptop');
  assert.equal(canon(merge(a.doc(), b.doc())), canon(merge(b.doc(), a.doc())));
});

test('IMPORTANT 5: both written: the whole later record wins (never a stability from the other); assisted is ORed', () => {
  const mk = (build) => { const d = device(); d.solve(C('T03'), { at: T0 + H, casts: ['where'] }); build(d); return d.doc(); };
  const cast = (d, at, o = {}) => d.store.recordCast('where', { lang: 'sql', unaided: true, outcome: 'clean', nowMs: at, ...o });
  // X: unaided, recast days apart (high stability), early. Y: one later cast that needed help (assisted)
  const X = mk((d) => { cast(d, T0 + 3 * DAY); cast(d, T0 + 9 * DAY); });
  const Y = mk((d) => { cast(d, T0 + 12 * DAY, { unaided: false, outcome: 'guided' }); });
  const sx = X.siso.spells.where, sy = Y.siso.spells.where;
  assert.ok(sx.stability > sy.stability && sy.assisted === true && sx.assisted === false);
  const m = merge(X, Y).siso.spells.where;
  assert.equal(m.lastMs, sy.lastMs);
  assert.equal(m.stability, sy.stability);           // its own stability: never X's paired with Y's lastMs
  assert.equal(m.assisted, true);                    // help is never forgotten
  assert.deepEqual(merge(Y, X).siso.spells.where, m);
  // the later record unaided, the other assisted with a larger stability: still the later record whole, assisted ORed
  const P = mk((d) => { cast(d, T0 + 3 * DAY); cast(d, T0 + 9 * DAY); cast(d, T0 + 10 * DAY, { unaided: false, outcome: 'guided' }); });
  const Q = mk((d) => { cast(d, T0 + 12 * DAY); });
  const sp = P.siso.spells.where, sq = Q.siso.spells.where;
  assert.ok(sp.assisted && sp.stability > sq.stability);
  const m2 = merge(P, Q).siso.spells.where;
  assert.equal(m2.lastMs, sq.lastMs);
  assert.equal(m2.stability, sq.stability);
  assert.equal(m2.assisted, true);
  assert.deepEqual(merge(Q, P), merge(P, Q));
});

test('IMPORTANT 7: a clock far ahead sets solve times back to the ceiling instead of deleting the solves', () => {
  const a = device();
  a.solve(C('T03'), { at: NOW + 100 * DAY, casts: ['where'] });
  a.life = { ...a.life, highMs: NOW + 100 * DAY };
  const fast = a.doc({ now: NOW + 200 * DAY });
  fast.siso.spells.where = { langs: ['sql'], written: true, lastMs: NOW + 100 * DAY, stability: 3, assisted: false, forms: {} };
  const r = checkDoc(fast, { now: NOW });
  assert.ok(r.ok);
  assert.equal(r.doc.siso.life.solves.length, 1);
  assert.equal(r.doc.siso.life.solves[0].atMs, NOW + SKEW_MS);
  assert.equal(xpOf(r.doc.siso.life), 10);
  assert.ok(r.notices.some((n) => /clock was ahead/.test(n)));
  assert.equal(r.doc.siso.spells.where.written, true);
  const b = device(); b.solve(C('T04'), { at: T0 + H });
  const m = mergeDetailed(fast, b.doc(), { now: NOW });
  assert.equal(xpOf(m.doc.siso.life), 20);
  assert.ok(m.notices.length >= 1);
});

// ---- round 2
import { createSync, memoryBackend } from './engine.js';

test('R2 ink: only the last card solved clean does not keep every spell written', () => {
  const d = device();
  d.solve(C('T21'), { at: T0 + H });                       // the last card of the ladder, clean
  const forged = JSON.parse(JSON.stringify(d.doc()));
  const rec = { langs: ['sql'], written: true, lastMs: T0 + H, stability: 20, assisted: false, forms: { sql: { written: true, lastMs: T0 + H, stability: 20 } } };
  forged.siso.spells = Object.fromEntries(['table-row', 'id-link', 'select-all', 'select-columns', 'where', 'update', 'insert', 'order-by', 'compare', 'delete', 'and', 'time-range', 'limit', 'js-variable', 'php-query', 'overlap'].map((id) => [id, structuredClone(rec)]));
  const out = checkDoc(forged, { now: NOW }).doc.siso.spells;
  const ink = Object.entries(out).filter(([, r]) => r.written).map(([id]) => id);
  assert.deepEqual(ink, ['delete']);                       // T21 recalls delete: a real solve of a card that recalls it, and clean
  for (const [id, r] of Object.entries(out)) if (!r.written) assert.ok(r.langs.includes('sql'), `${id} keeps its exposure`);
});

test('R2 ink: a spell needs a solve of a card that teaches or recalls it, and a clean one at that card or later', () => {
  const guidedThenLater = device();
  guidedThenLater.solve(C('T03'), { at: T0 + H, help: 'guided', casts: ['where'] });   // where's card, but only guided
  const sp = (id) => ({ langs: ['sql'], written: true, lastMs: T0 + H, stability: 3, assisted: false, forms: {} });
  const mk = (d) => { const f = JSON.parse(JSON.stringify(d.doc())); f.siso.spells = { where: sp(), update: sp() }; return checkDoc(f, { now: NOW }).doc.siso.spells; };
  assert.equal(mk(guidedThenLater).where.written, false);  // nothing clean at T03 or later
  guidedThenLater.solve(C('T04'), { at: T0 + 2 * H });     // a clean solve LATER on the ladder
  const s2 = mk(guidedThenLater);
  assert.equal(s2.where.written, true);                    // backed: where's card solved (guided) and a clean solve after it
  assert.equal(s2.update.written, true);
  const cleanOnlyBefore = device();
  cleanOnlyBefore.solve(C('T02'), { at: T0 + H }); cleanOnlyBefore.solve(C('T03'), { at: T0 + 2 * H, help: 'guided' });
  assert.equal(mk(cleanOnlyBefore).where.written, false);  // the clean solve came before where's card on the ladder
});

function mutate(r, doc) {
  const d = JSON.parse(JSON.stringify(doc));
  const L = d.siso.life, pick = (a) => a[Math.floor(r() * a.length)];
  const k = Math.floor(r() * 7);
  if (k === 0 && L.solves.length) pick(L.solves).xp = pick([-5, 999, 10.5]);
  if (k === 1) L.home.balance = pick([-10, 1e9, 55.5]);
  if (k === 2) L.solves.push({ card: pick(['T02', 'T03', 'T04', 'nope', 'O1']), atMs: pick([T0 + 7 * H, NOW + 9e12, T0 + H]), help: pick(['clean', 'guided', 'x']), unaided: true, xp: 10, lang: 'sql' });
  if (k === 3) d.siso.spells.where = { langs: ['sql'], written: true, lastMs: pick([T0 + H, NOW + 9e13]), stability: pick([3, 1e9]), assisted: false, forms: { sql: { written: true, lastMs: T0 + H, stability: 5 } } };
  if (k === 4) L.home.items.push({ uid: 'z' + Math.floor(r() * 5), id: pick(['sofa', 'laptop', 'rug', 'nonsense']), tone: null, x: null, z: null, rot: 0 });
  if (k === 5) L.cards.T03 = { hint: pick([9, -1]), worked: 'y', step: -3 };
  if (k === 6) d.siso.life.highMs = pick([NOW + 9e12, 5, 'x']);
  return d;
}
// the balance is carried as slack and floored at 0 when earnings fall below spending (merge.js): there the exact figure is lost,
// so across different groupings the balance may differ (always within 0..earned-worth); everything else must be identical
const noBalance = (d) => { const c = structuredClone(d); c.siso.life.home.balance = 0; return c; };
test('R2 fuzz with tampering: no minted credit, commutative, idempotent, associative (6000 triples; balance only within bounds)', () => {
  const r = rng(777);
  const pool = Array.from({ length: 50 }, (_, k) => randomDevice(r, k));
  const same = (x, y) => canon(noBalance(x)) === canon(noBalance(y));
  let seen = 0;
  for (let n = 0; n < 6000; n++) {
    const raw = [0, 0, 0].map(() => pool[Math.floor(r() * pool.length)]);
    const [A, B, Cc] = raw.map((d) => (r() < 0.4 ? mutate(r, d) : d)).map((d) => { const c = checkDoc(d, { now: NOW }); return c.ok ? c.doc : pool[0]; });
    const ab = merge(A, B), m = merge(ab, Cc);
    assert.ok(same(ab, merge(B, A)), `commutative at ${n}`);
    assert.ok(same(m, merge(A, merge(B, Cc))), `(AB)C vs A(BC) at ${n}`);
    assert.ok(same(m, merge(merge(A, Cc), B)), `(AB)C vs (AC)B at ${n}`);
    assert.equal(canon(merge(m, m)), canon(m), `idempotent at ${n}`);
    assert.equal(canon(checkDoc(m, { now: NOW }).doc), canon(m), `stable under the gate at ${n}`);
    assert.equal(canon(ab), canon(merge(B, A)), `commutative incl. balance at ${n}`);
    const L = m.siso.life;
    assert.ok(xpOf(L) <= 140 && earnedOf(L.solves) <= 560, `no minted credit at ${n}`);
    assert.ok(L.home.balance <= earnedOf(L.solves));
    assert.ok(L.solves.every((s) => LADDER.some((c) => c.id === s.card)));
    seen++;
  }
  assert.equal(seen, 6000);
});

test('R2 tie-break: solves with the same time are in one order whatever order they arrive in', () => {
  const d = device();
  d.solve(C('T03'), { at: T0 + H }); d.solve(C('T04'), { at: T0 + H }); d.solve(C('T02'), { at: T0 + H });
  const a = JSON.parse(JSON.stringify(d.doc())), b = JSON.parse(JSON.stringify(d.doc()));
  b.siso.life.solves.reverse();
  assert.equal(canon(checkDoc(a, { now: NOW }).doc), canon(checkDoc(b, { now: NOW }).doc));
  assert.equal(canon(merge(a, b)), canon(merge(b, a)));
  assert.equal(canon(merge(a, b)), canon(checkDoc(a, { now: NOW }).doc));
});

test('R2 tie-break: the engine makes no redundant write when local differs only by the order of tied solves', async () => {
  const d = device();
  d.solve(C('T03'), { at: T0 + H }); d.solve(C('T04'), { at: T0 + H });
  const remote = JSON.parse(JSON.stringify(d.doc()));
  const st = d.state(); st.life = { ...st.life, solves: [...st.life.solves].reverse() };
  let writes = 0;
  const s = createSync({ backend: memoryBackend({ doc: remote }), readLocal: () => st, writeLocal: () => { writes++; }, now: () => NOW, listen: false, setTimer: () => 1, clearTimer: () => {} });
  await s.start();
  assert.equal(writes, 0);
  assert.equal(s.status(), 'synced');
});
