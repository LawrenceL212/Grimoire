import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSaves } from './merge.js';
import { checkDoc } from './doc.js';
import { xpOf, balanceOf } from '../play/progress.js';
import { earnedOf } from '../play/home-rules.js';
import { device, card, T0, NOW } from './_kit.mjs';

const H = 3600000;
const X = card('X'), Y = card('Y'), Z = card('Z');
const xp = (doc) => xpOf(doc.siso.life);
const merge = (a, b) => mergeSaves(a, b, { now: NOW });
const written = (doc, id) => doc.siso.spells[id]?.written === true;

function pair() {
  const a = device(), b = device();
  a.solve(X, { at: T0 + H, casts: ['where'] });
  a.help('Z', { hint: 2 });
  b.solve(Y, { at: T0 + 2 * H, casts: ['select-all'] });
  b.help('Z', { worked: true });
  return [a, b];
}

test('merge is commutative and idempotent', () => {
  const [a, b] = pair();
  const da = a.doc(), db = b.doc();
  assert.deepEqual(merge(da, db), merge(db, da));
  const m = merge(da, db);
  assert.deepEqual(merge(m, m), m);
  assert.deepEqual(merge(da, da), da);
  assert.deepEqual(merge(m, da), m);
  assert.deepEqual(merge(m, db), m);
});

test('two devices solving different cards merge to the union: no double XP, no double earnings', () => {
  const [a, b] = pair();
  const m = merge(a.doc(), b.doc());
  assert.equal(m.siso.life.solves.length, 2);
  assert.equal(xp(m), xpOf(a.life) + xpOf(b.life)); // different cards: both really earned
  assert.equal(xp(m), 20);
  assert.equal(earnedOf(m.siso.life.solves), 80);
  assert.equal(balanceOf(m.siso.life), 80); // each balance held 40; the merged home holds 80, not 120 and not 40
  assert.ok(written(m, 'where') && written(m, 'select-all'));
});

test('the same card solved on both devices pays once', () => {
  const a = device(), b = device();
  a.solve(X, { at: T0 + 2 * H }); b.solve(X, { at: T0 + H });
  const m = merge(a.doc(), b.doc());
  assert.equal(xp(m), 10);
  assert.equal(earnedOf(m.siso.life.solves), 40);
  assert.equal(balanceOf(m.siso.life), 40);
  assert.equal(m.siso.life.solves.find((s) => s.atMs === T0 + H).xp, 10);
  assert.equal(m.siso.life.solves.find((s) => s.atMs === T0 + 2 * H).xp, 0); // the re-solve earns nothing
});

test('help is sticky across devices (cards: worst hint, worked, codexEarly, furthest step)', () => {
  const a = device(), b = device();
  a.help('X', { hint: 2 }); b.help('X', { worked: true }); b.help('Y', { codexEarly: true });
  const m = merge(a.doc(), b.doc());
  assert.equal(m.siso.life.cards.X.hint, 2);
  assert.equal(m.siso.life.cards.X.worked, true);
  assert.equal(m.siso.life.cards.Y.codexEarly, true);
  const a2 = device(); a2.help('X', { hint: 3 });
  assert.equal(merge(a.doc(), a2.doc()).siso.life.cards.X.hint, 3);
});

test('tutorial: done if either; days and highMs: never lower', () => {
  const a = device(), b = device(T0 + 5 * H);
  a.life.tutorial.done = true; a.life.tutorial.step = 3;
  b.start(X, T0 + 9 * H); a.start(Y, T0 + 9 * H);
  const m = merge(a.doc(), b.doc());
  assert.equal(m.siso.life.tutorial.done, true);
  assert.equal(m.siso.life.tutorial.step, 3);
  assert.equal(m.siso.life.highMs, Math.max(a.life.highMs, b.life.highMs));
  assert.equal(m.siso.life.startedMs, T0);
  assert.deepEqual(Object.values(m.siso.life.days)[0], ['X', 'Y']);
});

test('the same card clean on one device and assisted on the other: the earlier solve decides, never both', () => {
  // assisted first (B at T0+H), clean later (A at T0+2H): assisted credit, and the later clean cannot upgrade it
  let a = device(), b = device();
  a.solve(X, { at: T0 + 2 * H, help: 'clean' }); b.help('X', { hint: 2 }); b.solve(X, { at: T0 + H, help: 'guided' });
  let m = merge(a.doc(), b.doc());
  assert.equal(xp(m), 3);
  assert.equal(earnedOf(m.siso.life.solves), 0);
  assert.equal(balanceOf(m.siso.life), 0);
  assert.equal(m.siso.life.cards.X.hint, 2); // and the help is remembered
  assert.deepEqual(merge(b.doc(), a.doc()), m);
  // clean first (A at T0+H): its credit, once, and never 10 + 3
  a = device(); b = device();
  a.solve(X, { at: T0 + H, help: 'clean' }); b.help('X', { hint: 2 }); b.solve(X, { at: T0 + 2 * H, help: 'guided' });
  m = merge(a.doc(), b.doc());
  assert.equal(xp(m), 10);
  assert.ok(xp(m) <= Math.max(xpOf(a.life), xpOf(b.life)), 'never above the best one device earned');
  assert.equal(earnedOf(m.siso.life.solves), 40);
});

test('spells: written on neither side is never written; written on one side stays; both: later wins, stability never lower', () => {
  const a = device(), b = device();
  a.solve(X, { at: T0 + H, help: 'guided', casts: ['where'] });
  b.solve(Y, { at: T0 + H, help: 'exposure', casts: ['where', 'limit'] });
  let m = merge(a.doc(), b.doc());
  assert.equal(written(m, 'where'), false);
  assert.equal(written(m, 'limit'), false);
  const c = device(); c.solve(Z, { at: T0 + 3 * H, casts: ['where'] });
  m = merge(a.doc(), c.doc());
  assert.equal(written(m, 'where'), true);
  assert.equal(m.siso.spells.where.lastMs, T0 + 3 * H);
  const d1 = device(), d2 = device();
  d1.solve(X, { at: T0 + H, casts: ['where'] });
  d2.solve(Y, { at: T0 + H, casts: ['where'] });
  d2.solve(Z, { at: T0 + 3 * 86400000, casts: ['where'] }); // a recast days later: stability grows
  m = merge(d1.doc(), d2.doc());
  const s1 = d1.doc().siso.spells.where, s2 = d2.doc().siso.spells.where;
  assert.equal(m.siso.spells.where.lastMs, s2.lastMs);
  assert.equal(m.siso.spells.where.stability, Math.max(s1.stability, s2.stability));
});

test('a spell record written on no side cannot be forged into ink by a merge', () => {
  const a = device(), b = device();
  const forged = b.doc();
  forged.siso.spells.where = { langs: ['sql'], written: false, lastMs: T0, stability: 50, assisted: false, forms: { sql: { written: true, lastMs: T0, stability: 50 } } };
  const m = merge(a.doc(), forged);
  assert.equal(written(m, 'where'), false);
  assert.equal(m.siso.spells.where.forms.sql.written, false);
});

test('a demonstration is never merged into ink', () => {
  const a = device(), b = device();
  a.store.recordCast('where', { lang: 'sql', demo: true, nowMs: T0 });
  const m = merge(a.doc(), b.doc());
  assert.equal(written(m, 'where'), false);
  assert.equal(m.siso.spells.where.demo, true);
  b.solve(X, { at: T0 + H, casts: ['where'] });
  const m2 = merge(a.doc(), b.doc());
  assert.equal(written(m2, 'where'), true);
  assert.equal(m2.siso.spells.where.demo, false);
});

test('home: the side with more purchases wins, topped up by earnings it lacked, never above what was earned', () => {
  const a = device(), b = device();
  for (let i = 0; i < 3; i++) a.solve(card('A' + i), { at: T0 + (i + 1) * H }); // 120 pounds
  assert.ok(a.buy('laptop').ok && a.buy('office-chair').ok);                    // spends 105: balance 15
  b.solve(card('B0'), { at: T0 + 9 * H });                                      // 40 pounds
  const m = merge(a.doc(), b.doc());
  const home = m.siso.life.home;
  assert.equal(earnedOf(m.siso.life.solves), 160);
  assert.equal(home.items.filter((i) => !i.starter).length, 2);
  assert.equal(home.balance, 15 + 40);
  assert.deepEqual(merge(b.doc(), a.doc()), m);
  assert.deepEqual(merge(m, m), m);
});

test('a forged home cannot out-earn the solves', () => {
  const a = device(), b = device();
  a.solve(X, { at: T0 + H });
  const forged = b.doc();
  forged.siso.life.home.balance = 1e9;
  forged.siso.life.home.items.push({ uid: 'i99', id: 'sofa', tone: null, x: null, z: null, rot: 0 });
  forged.siso.life.home.seq = 99;
  const m = merge(a.doc(), forged);
  assert.ok(m.siso.life.home.balance <= earnedOf(m.siso.life.solves));
  assert.equal(m.siso.life.home.items.some((i) => i.id === 'sofa'), false);
});

test('null sides: merging with nothing returns the other save; both null is null', () => {
  const [a] = pair();
  assert.deepEqual(merge(a.doc(), null), a.doc());
  assert.deepEqual(merge(null, a.doc()), a.doc());
  assert.equal(merge(null, null), null);
  assert.deepEqual(merge(a.doc(), { schema: 2 }), a.doc()); // an unreadable side adds nothing
});

test('a tampered save is clamped, and the merge of it stays honest', () => {
  const a = device(); a.solve(X, { at: T0 + H });
  const t = JSON.parse(JSON.stringify(a.doc()));
  t.siso.life.solves[0].xp = 99999;
  t.siso.life.solves.push({ card: 'F', atMs: NOW + 400 * 86400000, help: 'clean', unaided: true, xp: 10, lang: 'sql' });
  t.siso.life.solves.push({ card: 'G', atMs: T0 + 2 * H, help: 'clean', unaided: true, xp: 10000, lang: 'sql' });
  t.siso.life.home.balance = -50;
  t.siso.life.unknownKey = 'x'; t.extra = 1;
  t.siso.life.highMs = NOW + 999 * 86400000;
  const c = checkDoc(t, { now: NOW });
  assert.ok(c.ok);
  assert.ok(!('extra' in c.doc) && !('unknownKey' in c.doc.siso.life));
  assert.ok(c.doc.siso.life.highMs <= NOW + 36 * H);
  assert.ok(c.doc.siso.life.solves.every((s) => s.atMs <= NOW + 36 * H));
  assert.ok(xp(c.doc) <= 20);
  assert.equal(c.doc.siso.life.home.balance, 0);
  const m = merge(device().doc(), c.doc);
  assert.ok(xp(m) <= 20);
});
