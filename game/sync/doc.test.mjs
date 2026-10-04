import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDoc, toDoc, fromDoc, MAX_BYTES, canon } from './doc.js';
import { device, card, T0, NOW } from './_kit.mjs';

const H = 3600000;
const played = () => { const d = device(); d.solve(card('T03'), { at: T0 + H, casts: ['where'] }); d.help('T04', { hint: 1 }); return d; };

test('toDoc gives exactly the three top-level keys, and fromDoc gives the state back', () => {
  const d = played();
  const doc = toDoc(d.state(), { now: NOW });
  assert.deepEqual(Object.keys(doc).sort(), ['schema', 'siso', 'updatedAt']);
  assert.deepEqual(Object.keys(doc.siso).sort(), ['life', 'spells']);
  assert.equal(doc.schema, 1);
  assert.ok(!('spells' in doc.siso.life));
  const back = fromDoc(doc, { now: NOW });
  assert.ok(back.ok);
  assert.deepEqual(back.state.life.solves, d.life.solves);
  assert.equal(back.state.spells.where.written, true);
  assert.deepEqual(toDoc(back.state, { now: NOW }), doc); // a round trip changes nothing
  assert.deepEqual(JSON.parse(JSON.stringify(doc)), doc);
});

test('rejects a non-object, an unknown schema, a missing game and an oversize doc', () => {
  const good = toDoc(played().state(), { now: NOW });
  for (const bad of [null, 5, 'x', [], {}, { ...good, schema: 2 }, { ...good, schema: undefined }, { schema: 1, siso: {} }, { schema: 1, siso: { life: { v: 2 } } },
    { schema: 1, siso: { life: { v: 1 } } }]) assert.equal(checkDoc(bad, { now: NOW }).ok, false, JSON.stringify(bad)?.slice(0, 40));
  const big = structuredClone(good);
  big.siso.life.cards.pad = { note: 'x'.repeat(MAX_BYTES) };
  assert.equal(checkDoc(big, { now: NOW }).ok, false);
  const cyc = {}; cyc.self = cyc;
  assert.equal(checkDoc(cyc, { now: NOW }).ok, false);
});

test('a tampered doc is clamped by the existing validators', () => {
  const t = JSON.parse(JSON.stringify(toDoc(played().state(), { now: NOW })));
  t.siso.life.solves[0].xp = 1e6;
  t.siso.life.solves.push({ card: 'FUT', atMs: NOW + 1e12, help: 'clean', unaided: true, xp: 10, lang: 'sql' });
  t.siso.life.home.balance = -10; t.siso.life.home.items.push({ uid: 'z', id: 'sofa', tone: null, x: null, z: null, rot: 0 });
  t.siso.life.cards.T03 = { hint: 99, worked: 'yes', evil: 1 };
  t.siso.life.cards['__proto__'] = { hint: 4 };
  t.siso.spells.where.lastMs = NOW + 1e12;
  t.siso.spells.where.stability = 1e12;
  t.siso.spells.notASpell = { written: true, lastMs: T0 };
  t.siso.life.highMs = NOW + 1e12; t.updatedAt = NOW + 1e12; t.evil = true;
  const r = checkDoc(t, { now: NOW });
  assert.ok(r.ok);
  const L = r.doc.siso.life;
  assert.deepEqual(Object.keys(r.doc).sort(), ['schema', 'siso', 'updatedAt']);
  assert.ok(L.solves.length === 1 && L.solves[0].xp <= 10);
  assert.equal(L.home.balance, 0);
  assert.equal(L.home.items.some((i) => i.id === 'sofa'), false);
  assert.equal(L.cards.T03.hint, 4);
  assert.ok(!('evil' in L.cards.T03));
  assert.ok(Object.getPrototypeOf(L.cards) === Object.prototype && !Object.keys(L.cards).includes('__proto__'));
  assert.ok(r.doc.siso.spells.where.lastMs <= NOW + 36 * H); // a time in the future is set back, never kept
  assert.ok(!('notASpell' in r.doc.siso.spells));
  assert.ok(r.doc.updatedAt <= NOW + 36 * H && L.highMs <= NOW + 36 * H);
});

test('toDoc refuses an unusable local state', () => {
  assert.equal(toDoc(null), null);
  assert.equal(toDoc({}), null);
  assert.equal(toDoc({ life: { v: 9 } }), null);
});

test('canon is order-independent', () => {
  assert.equal(canon({ b: 1, a: [1, { d: 1, c: 2 }] }), canon({ a: [1, { c: 2, d: 1 }], b: 1 }));
});
