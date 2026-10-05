// the product arc (life.arc: his company and the change log that IS his database) through every road a save travels:
// export / import, Replace and its backup, the cloud sync, and the merge, which must stay commutative, associative and
// idempotent with arcs in it, never splice two logs, never lose a world without saying so and keeping it, and never let a
// log earn anything.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDoc, toDoc, canon, LOG_CHARS } from './doc.js';
import { mergeSaves, mergeDetailed, mergeArc, NOTICE_WORLD_ASIDE } from './merge.js';
import { exportSave, applyImport } from './file.js';
import { localAdapter, restoreBackup, backupSlots, LIFE_BACKUP } from './local.js';
import { createSync, memoryBackend } from './engine.js';
import { append } from '../world/ddl-log.js';
import { xpOf, cleanArc } from '../play/progress.js';
import { earnedOf } from '../play/home-rules.js';
import { device, card, T0, NOW } from './_kit.mjs';

const H = 3600000;
const LIFE = 'grimoire.life.siso.v1';
const merge = (a, b) => mergeSaves(a, b, { now: NOW });
function store() {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => m.delete(k) };
}
const TRUNK = ['CREATE TABLE rooms (id serial PRIMARY KEY, name text NOT NULL)', "INSERT INTO rooms (name) VALUES ('Garden Room')", 'ALTER TABLE rooms ADD COLUMN seats int'];
const BRANCH = { x: ["INSERT INTO rooms (name) VALUES ('Boardroom')", 'CREATE TABLE bookings (id serial PRIMARY KEY)'], y: ["UPDATE rooms SET seats = 8 WHERE id = 1", 'CREATE INDEX ON rooms (name)'] };
const logOf = (sqls, at = T0) => sqls.reduce((l, sql, i) => append(l, sql, { card: 'S2', atMs: at + i }), []);
// a device that played two cards and made his company with the given changes
function withArc(sqls, { company = 'Acme Rooms', marks = { S2: 0 }, variants = {}, choices = {}, solves = ['T02', 'T03'] } = {}) {
  const d = device();
  solves.forEach((id, i) => d.solve(card(id), { at: T0 + (i + 1) * H }));
  d.life = { ...d.life, arc: { company, log: logOf(sqls), marks, scripts: {}, variants, choices } };
  return d;
}

test('ARC: an export carries the arc, and Replace brings it in whole; the backup restores the old world', () => {
  const mine = withArc(TRUNK, { company: 'Old Co', choices: { softDelete: true } });
  const file = withArc([...TRUNK, ...BRANCH.x], { company: 'Acme Rooms', variants: { S5: 'split' }, choices: { softDelete: false } });
  const Sf = store(); localAdapter(Sf, { now: () => NOW }).writeLocal(file.state());
  const ex = exportSave({ readLocal: localAdapter(Sf).readLocal, now: () => NOW });
  assert.ok(ex.ok);
  const sent = JSON.parse(ex.text);
  assert.deepEqual(Object.keys(sent).sort(), ['schema', 'siso', 'updatedAt']);        // the rules' three keys: the arc is inside siso.life
  assert.deepEqual(sent.siso.life.arc, cleanArc(file.life.arc));
  const S = store(); const ad = localAdapter(S, { now: () => NOW });
  ad.writeLocal(mine.state());
  const before = S.getItem(LIFE);
  const r = applyImport(ex.text, { mode: 'replace', confirmed: true, readLocal: ad.readLocal, writeLocal: ad.writeLocal, now: () => NOW });
  assert.ok(r.ok && r.changed);
  const live = JSON.parse(S.getItem(LIFE));
  assert.deepEqual(live.arc, cleanArc(file.life.arc));
  assert.equal(live.arc.log.length, TRUNK.length + BRANCH.x.length);
  assert.equal(S.getItem(LIFE_BACKUP), before);
  assert.ok(restoreBackup({ storage: S, now: () => NOW }).ok);
  assert.deepEqual(JSON.parse(S.getItem(LIFE)).arc, mine.life.arc);
});

test('ARC: an import Merge keeps the log that extends the other, with its marks, scripts, variants and choices', () => {
  const behind = withArc(TRUNK);
  const ahead = withArc([...TRUNK, ...BRANCH.x], { marks: { S2: 0, S3: 3 }, variants: { S5: 'split' }, choices: { softDelete: true } });
  const S = store(); const ad = localAdapter(S, { now: () => NOW });
  ad.writeLocal(behind.state());
  const Sf = store(); localAdapter(Sf, { now: () => NOW }).writeLocal(ahead.state());
  const text = exportSave({ readLocal: localAdapter(Sf).readLocal, now: () => NOW }).text;
  const r = applyImport(text, { readLocal: ad.readLocal, writeLocal: ad.writeLocal, now: () => NOW });
  assert.ok(r.ok && r.changed);
  assert.ok(!r.notices.includes(NOTICE_WORLD_ASIDE));                            // nothing was lost: the file only went further
  assert.deepEqual(JSON.parse(S.getItem(LIFE)).arc, cleanArc(ahead.life.arc));
  // and the other way round: this device is ahead, the file behind: nothing changes
  const r2 = applyImport(exportSave({ readLocal: localAdapter((() => { const s = store(); localAdapter(s, { now: () => NOW }).writeLocal(behind.state()); return s; })()).readLocal, now: () => NOW }).text,
    { readLocal: ad.readLocal, writeLocal: ad.writeLocal, now: () => NOW });
  assert.ok(r2.ok && !r2.changed);
});

test('ARC: an old save without an arc still loads, and merges with one that has it', () => {
  const old = device(); old.solve(card('T02'), { at: T0 + H });
  const raw = JSON.parse(JSON.stringify(old.doc()));
  delete raw.siso.life.arc;
  const r = checkDoc(raw, { now: NOW });
  assert.ok(r.ok);
  assert.deepEqual(r.doc.siso.life.arc, cleanArc(null));
  const m = mergeDetailed(raw, withArc(TRUNK).doc(), { now: NOW });
  assert.equal(m.doc.siso.life.arc.log.length, TRUNK.length);
  assert.equal(m.aside, null);
  assert.ok(!m.notices.includes(NOTICE_WORLD_ASIDE));
});

test('ARC: diverging logs: one is kept whole (never spliced), the same one whichever way round, with a notice and the loser named', () => {
  const X = withArc([...TRUNK, ...BRANCH.x], { company: 'X Rooms' }).doc(), Y = withArc([...TRUNK, ...BRANCH.y], { company: 'Y Rooms' }).doc();
  const a = mergeDetailed(X, Y, { now: NOW }), b = mergeDetailed(Y, X, { now: NOW });
  assert.equal(canon(a.doc), canon(b.doc));
  const kept = a.doc.siso.life.arc;
  assert.ok([X, Y].some((d) => canon(d.siso.life.arc) === canon(kept)), 'the winner is one whole arc, company and all');
  assert.ok(a.notices.includes(NOTICE_WORLD_ASIDE) && b.notices.includes(NOTICE_WORLD_ASIDE));
  const xWon = canon(kept) === canon(X.siso.life.arc);
  assert.equal(a.aside, xWon ? 'b' : 'a');
  assert.equal(b.aside, xWon ? 'a' : 'b');
  // a longer diverging log always wins over a shorter one
  const Z = withArc([...TRUNK, ...BRANCH.y, 'DROP INDEX rooms_name_idx']).doc();
  assert.equal(merge(X, Z).siso.life.arc.log.length, TRUNK.length + 3);
});

test('ARC: equal logs are joined: a company over none, the earliest mark, every variant and choice', () => {
  const p = cleanArc({ company: null, log: logOf(TRUNK), marks: { S2: 1, S3: 3 }, variants: { S5: 'split' } });
  const q = cleanArc({ company: 'Acme', log: logOf(TRUNK), marks: { S2: 0 }, choices: { softDelete: true } });
  const j = mergeArc(p, q);
  assert.equal(j.aside, null);
  assert.deepEqual(j.arc, { company: 'Acme', log: logOf(TRUNK), marks: { S2: 0, S3: 3 }, scripts: {}, variants: { S5: 'split' }, choices: { softDelete: true } });
  assert.deepEqual(mergeArc(q, p).arc, j.arc);
  assert.deepEqual(mergeArc(j.arc, j.arc).arc, j.arc);
});

test('ARC: a forged or oversized log earns nothing, is cleaned entry by entry, and is cut to a prefix that fits', () => {
  const honest = device().doc();
  const forged = JSON.parse(JSON.stringify(honest));
  forged.siso.life.arc = {
    company: 'Forged', marks: { __proto__: 5, S2: 99 }, scripts: {}, variants: {}, choices: {},
    log: [{ sql: TRUNK[0], ddl: false, card: 'T03', atMs: T0 }, { sql: 'SELECT 1' }, { sql: 42 }, null, { sql: TRUNK[1], by: '<script>' }],
  };
  forged.siso.life.arc.marks = JSON.parse('{"__proto__": 5, "S2": 99}');
  const r = checkDoc(forged, { now: NOW });
  assert.ok(r.ok);
  const arc = r.doc.siso.life.arc;
  assert.deepEqual(arc.log.map((e) => e.sql), [TRUNK[0], TRUNK[1]]);           // the read-only and broken entries are gone
  assert.equal(arc.log[0].ddl, true);                                              // recomputed, never trusted
  assert.equal('by' in arc.log[1], false);
  assert.deepEqual(Object.keys(arc.marks), ['S2']);
  assert.equal(arc.marks.S2, 2);                                                   // a mark never past the end of the log
  assert.equal(xpOf(r.doc.siso.life), 0); assert.equal(earnedOf(r.doc.siso.life.solves), 0);
  assert.equal(r.doc.siso.life.home.balance, 0);
  // a merge with the forged log keeps the credit of the solves only
  const real = withArc([], { solves: ['T02'] }).doc();
  const m = merge(real, r.doc);
  assert.equal(xpOf(m.siso.life), xpOf(real.siso.life));
  assert.equal(m.siso.life.home.balance, real.siso.life.home.balance);
  // oversized: the longest prefix within LOG_CHARS is kept, with a notice; this device's own save still travels (toDoc)
  const big = 'INSERT INTO rooms (name) VALUES (\'' + 'x'.repeat(19000) + '\')';
  const n = Math.ceil(LOG_CHARS / big.length) + 3;
  const d = withArc([]); d.life = { ...d.life, arc: { ...d.life.arc, log: Array.from({ length: n }, (_, i) => ({ sql: big, card: 'S2', atMs: T0 + i })) } };
  const doc = toDoc(d.state(), { now: NOW });
  assert.ok(doc, 'an over-long log does not stop the save from travelling');
  const total = doc.siso.life.arc.log.reduce((c, e) => c + e.sql.length, 0);
  assert.ok(total <= LOG_CHARS && doc.siso.life.arc.log.length === Math.floor(LOG_CHARS / big.length));
});

test('ARC: cloud sync: the device behind catches up; a device whose world lost keeps it in the ASIDE slot, untouched by later syncs', async () => {
  const cloud = memoryBackend();
  const mk = (d) => { const S = store(); const ad = localAdapter(S, { now: () => NOW }); ad.writeLocal(d.state()); return { S, ad, sync: createSync({ backend: cloud, readLocal: ad.readLocal, writeLocal: ad.writeLocal, now: () => NOW, listen: false }) }; };
  const A = mk(withArc([...TRUNK, ...BRANCH.x], { company: 'X Rooms' }));
  await A.sync.start();
  assert.equal(cloud.doc.siso.life.arc.log.length, 5);
  const B = mk(withArc(TRUNK.slice(0, 1)));                                   // behind: its log is a prefix of the cloud's
  await B.sync.start();
  assert.equal(JSON.parse(B.S.getItem(LIFE)).arc.log.length, 5);
  assert.equal(backupSlots(B.S).aside, null);                                  // nothing was set aside
  // C diverged: whichever world wins, the losing device keeps its own in the aside slot
  const cDev = withArc([...TRUNK, ...BRANCH.y], { company: 'Y Rooms' });
  const C = mk(cDev);
  const notes = []; C.sync.onNotice((n) => notes.push(n));
  await C.sync.start();
  assert.ok(notes.includes(NOTICE_WORLD_ASIDE));
  const cloudArc = cloud.doc.siso.life.arc;
  const cLost = cloudArc.company === 'X Rooms';
  assert.equal(JSON.parse(C.S.getItem(LIFE)).arc.company, cloudArc.company);  // C now has the cloud's (merged) world
  if (cLost) {
    const kept = JSON.parse(C.S.getItem('grimoire.life.siso.v1.asidebackup'));
    assert.deepEqual(kept.arc, cleanArc(cDev.life.arc));
  }
  await A.sync.syncNow();                                                     // A converges on the same world
  assert.equal(canon(JSON.parse(A.S.getItem(LIFE)).arc), canon(cloudArc));
  if (!cLost) assert.deepEqual(JSON.parse(A.S.getItem('grimoire.life.siso.v1.asidebackup')).arc.company, 'X Rooms');
  // the losing world survives later syncs that change the save (they go to the AUTO slot)
  const loser = cLost ? C : A;
  const asideBefore = loser.S.getItem('grimoire.life.siso.v1.asidebackup');
  const extra = withArc([], { solves: ['T04'] });
  await mk(extra).sync.start();
  await loser.sync.syncNow();
  assert.equal(loser.S.getItem('grimoire.life.siso.v1.asidebackup'), asideBefore);
  assert.ok(restoreBackup({ storage: loser.S, slot: 'aside', now: () => NOW }).ok);
  assert.equal(JSON.parse(loser.S.getItem(LIFE)).arc.company, cLost ? 'Y Rooms' : 'X Rooms');
});

// ---- the three-way fuzz, with arcs: random trunks, extensions and diverging branches
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const POOL_SQL = [...TRUNK, ...BRANCH.x, ...BRANCH.y, 'DROP TABLE bookings', "INSERT INTO rooms (name) VALUES ('Lab 2')", 'TRUNCATE rooms'];
function randomArcDevice(r, k) {
  const d = device(T0 + Math.floor(r() * 5) * H);
  const ids = ['T02', 'T03', 'T04', 'G1', 'T08'];
  // every solve its own time (two solves of one card at one moment are the documented forged-collision corner, merge.js (b))
  for (let i = 0, n = Math.floor(r() * 4); i < n; i++) {
    d.solve(card(ids[Math.floor(r() * ids.length)]), { at: T0 + Math.floor(r() * 40) * H + k + i * 1000, help: ['clean', 'nudged', 'guided'][Math.floor(r() * 3)], casts: r() < 0.5 ? ['where'] : [] });
  }
  if (r() < 0.4) d.buy(['desk-lamp', 'plant-small', 'poster'][Math.floor(r() * 3)]);
  if (r() < 0.85) {
    // a shared trunk of random length, then (often) a branch of its own: prefixes, equal logs and divergence all happen
    const sqls = TRUNK.slice(0, Math.floor(r() * (TRUNK.length + 1)));
    if (r() < 0.6) for (let i = 0, n = 1 + Math.floor(r() * 3); i < n; i++) sqls.push(POOL_SQL[Math.floor(r() * POOL_SQL.length)]);
    const cards = ['S2', 'S3', 'S4', 'S5'];
    const marks = {}, variants = {}, choices = {};
    for (const c of cards) { if (r() < 0.4) marks[c] = Math.floor(r() * (sqls.length + 1)); if (r() < 0.2) variants[c] = ['split', 'merged'][Math.floor(r() * 2)]; }
    if (r() < 0.3) choices.softDelete = r() < 0.5;
    d.life = { ...d.life, arc: { company: r() < 0.3 ? null : ['Acme', 'Bloom', 'Cedar'][Math.floor(r() * 3)], log: logOf(sqls, T0 + (r() < 0.5 ? 0 : 7)), marks, scripts: {}, variants, choices } };
  }
  return d.doc();
}
test('ARC fuzz: with arcs (prefixes, equal and diverging logs) the merge is commutative, associative, idempotent; the log is always a whole input log; credit ignores the arc', () => {
  const r = rng(424242);
  const pool = Array.from({ length: 50 }, (_, k) => randomArcDevice(r, k));
  const same = (x, y) => canon(x) === canon(y);
  const noArc = (d) => { const c = structuredClone(d); delete c.siso.life.arc; return c; };
  let diverged = 0, extended = 0;
  for (let n = 0; n < 3000; n++) {
    const [A, B, Cc] = [0, 0, 0].map(() => pool[Math.floor(r() * pool.length)]);
    const det = mergeDetailed(A, B, { now: NOW });
    const ab = det.doc;
    assert.ok(same(ab, merge(B, A)), `commutative at ${n}`);
    const x = merge(ab, Cc), y = merge(A, merge(B, Cc)), z = merge(merge(A, Cc), B);
    assert.ok(same(x, y), `(AB)C vs A(BC) at ${n}`);
    assert.ok(same(x, z), `(AB)C vs (AC)B at ${n}`);
    assert.ok(same(merge(ab, ab), ab), `idempotent at ${n}`);
    const logs = [A, B].map((d) => canon(d.siso.life.arc.log));
    assert.ok(logs.includes(canon(ab.siso.life.arc.log)), `never a spliced log at ${n}`);
    const [la, lb] = [A, B].map((d) => d.siso.life.arc.log);
    const pre = (p, l) => p.length <= l.length && canon(p) === canon(l.slice(0, p.length));
    if (!pre(la, lb) && !pre(lb, la)) { diverged++; assert.ok(det.notices.includes(NOTICE_WORLD_ASIDE) && det.aside, `divergence reported at ${n}`); }
    else { if (la.length !== lb.length) extended++; assert.equal(det.aside, null, `no divergence at ${n}`); assert.equal(ab.siso.life.arc.log.length, Math.max(la.length, lb.length)); }
    // the arc changes nothing about credit: the same merge without arcs has the same solves, home and spells
    const plain = merge(noArc(A), noArc(B));
    assert.equal(canon({ ...ab.siso.life, arc: null }), canon({ ...plain.siso.life, arc: null }), `credit independent of the arc at ${n}`);
    assert.equal(canon(ab.siso.spells), canon(plain.siso.spells));
  }
  assert.ok(diverged > 100 && extended > 100, `the fuzz exercised both cases (${diverged} diverged, ${extended} extended)`);
});
