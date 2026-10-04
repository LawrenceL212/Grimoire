import test from 'node:test';
import assert from 'node:assert/strict';
import { exportSave, previewImport, applyImport, localSummary, fileTooBig } from './file.js';
import { localAdapter, restoreBackup, backupInfo, LIFE_BACKUP, SPELLS_BACKUP, BACKUP_AT } from './local.js';
import { MAX_BYTES } from './doc.js';
import { device, card, T0, NOW } from './_kit.mjs';

const LIFE = 'grimoire.life.siso.v1';
const H = 3600000;
function store(init = {}) {
  const m = new Map(Object.entries(init));
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { if (store.deny?.test(k)) throw new Error('quota'); m.set(k, String(v)); }, removeItem: (k) => m.delete(k) };
}
const played = (...ids) => { const d = device(); ids.forEach((id, i) => d.solve(card(id), { at: T0 + (i + 1) * H, casts: id === 'T03' ? ['where'] : [] })); return d; };
const save = (S, d) => localAdapter(S, { now: () => NOW }).writeLocal(d.state());
const exportOf = (d) => { const S = store(); save(S, d); return exportSave({ readLocal: localAdapter(S).readLocal, now: () => NOW }).text; };
const xp = (S) => JSON.parse(S.getItem(LIFE)).solves.reduce((n, s) => n + s.xp, 0);

test('CRITICAL 2: Replace keeps the previous save as a backup, and restoreBackup brings it back (and can be undone)', () => {
  const S = store(); save(S, played('T02', 'T03', 'T04'));
  const before = S.getItem(LIFE);
  const file = exportOf(played('T06'));
  const r = applyImport(file, { mode: 'replace', confirmed: true, readLocal: localAdapter(S, { now: () => NOW }).readLocal, writeLocal: localAdapter(S, { now: () => NOW }).writeLocal, now: () => NOW });
  assert.ok(r.ok && r.changed);
  assert.equal(xp(S), 10);
  assert.equal(S.getItem(LIFE_BACKUP), before);                  // the raw previous save, untouched
  assert.equal(S.getItem(BACKUP_AT), String(NOW));
  assert.ok(backupInfo(S));
  const live = S.getItem(LIFE);
  assert.ok(restoreBackup({ storage: S, now: () => NOW }).ok);
  assert.equal(S.getItem(LIFE), before);
  assert.equal(S.getItem(LIFE_BACKUP), live);                    // the restore is itself undoable
  assert.ok(restoreBackup({ storage: S }).ok);
  assert.equal(S.getItem(LIFE), live);
  assert.equal(restoreBackup({ storage: store() }).ok, false);
});

test('CRITICAL 2: a merge that changes the save is backed up; one that changes nothing is not', () => {
  const S = store(); const ad = localAdapter(S, { now: () => NOW });
  save(S, played('T02'));
  const same = exportOf(played('T02'));
  const r0 = applyImport(same, { readLocal: ad.readLocal, writeLocal: ad.writeLocal, now: () => NOW });
  assert.ok(r0.ok && !r0.changed);
  assert.equal(S.getItem(LIFE_BACKUP), null);
  const before = S.getItem(LIFE);
  const r1 = applyImport(exportOf(played('T04')), { readLocal: ad.readLocal, writeLocal: ad.writeLocal, now: () => NOW });
  assert.ok(r1.ok && r1.changed);
  assert.equal(S.getItem(LIFE_BACKUP), before);
});

test('CRITICAL 2: an unreadable local save is backed up before it is overwritten, also by the engine path (writeLocal)', () => {
  const S = store({ [LIFE]: '{ this is not json', 'grimoire.spells.v1': '{"where":{"written":true}}' });
  const ad = localAdapter(S, { now: () => NOW });
  assert.equal(ad.readLocal(), null);
  const r = applyImport(exportOf(played('T03')), { readLocal: ad.readLocal, writeLocal: ad.writeLocal, now: () => NOW });
  assert.ok(r.ok);
  assert.equal(S.getItem(LIFE_BACKUP), '{ this is not json');
  assert.equal(S.getItem(SPELLS_BACKUP), '{"where":{"written":true}}');
  const S2 = store({ [LIFE]: 'garbage' });
  assert.equal(localAdapter(S2).writeLocal(played('T02').state()), true);
  assert.equal(S2.getItem('grimoire.life.siso.v1.autobackup'), 'garbage'); // an engine write goes to the AUTO slot
});

test('CRITICAL 2: if the backup cannot be stored, nothing is overwritten', () => {
  const S = store(); save(S, played('T02'));
  const before = S.getItem(LIFE);
  store.deny = /backup/;
  try { assert.equal(localAdapter(S).writeLocal(played('T03').state()), false); } finally { store.deny = null; }
  assert.equal(S.getItem(LIFE), before);
});

test('a bad or tampered file writes nothing and makes no backup', () => {
  const S = store(); save(S, played('T02')); const before = JSON.stringify([...Array(S.length)].map((_, i) => S.key(i)));
  const live = S.getItem(LIFE); const ad = localAdapter(S);
  for (const bad of ['{', '', '[]', '{"schema":3}', JSON.stringify({ schema: 1, siso: { life: { v: 1 } } })]) {
    const r = applyImport(bad, { mode: 'merge', readLocal: ad.readLocal, writeLocal: ad.writeLocal });
    assert.equal(r.ok, false);
  }
  assert.equal(applyImport(exportOf(played('T03')), { mode: 'replace', readLocal: ad.readLocal, writeLocal: ad.writeLocal }).ok, false); // not confirmed
  assert.equal(S.getItem(LIFE), live);
  assert.equal(JSON.stringify([...Array(S.length)].map((_, i) => S.key(i))), before);
});

test('the size cap is on bytes: a multi-byte file under the character cap is refused, and File.size is checked first', () => {
  const text = JSON.stringify({ schema: 1, pad: '€'.repeat(Math.ceil(MAX_BYTES / 3) + 10) });
  assert.ok(text.length < MAX_BYTES);
  assert.equal(previewImport(text).ok, false);
  assert.match(previewImport(text).error, /too large/);
  assert.equal(fileTooBig(MAX_BYTES + 1), true);
  assert.equal(fileTooBig(MAX_BYTES), false);
  assert.equal(fileTooBig(undefined), true);
});

test('localSummary matches the file summary shape; merge reports notices', () => {
  const S = store(); save(S, played('T02', 'T03'));
  const sum = localSummary({ readLocal: localAdapter(S).readLocal, now: () => NOW });
  assert.deepEqual(Object.keys(sum).sort(), ['balance', 'daysInBusiness', 'solves', 'spells']);
  assert.equal(sum.solves, 2); assert.equal(sum.balance, 80);
  assert.equal(localSummary({ readLocal: () => null }), null);
  const r = applyImport(exportOf(played('T04')), { readLocal: localAdapter(S).readLocal, writeLocal: localAdapter(S).writeLocal, now: () => NOW });
  assert.ok(Array.isArray(r.notices));
});

// ---- round 2: two backup slots
import { backupNow, backupSlots, SLOTS } from './local.js';
import { createSync, memoryBackend } from './engine.js';
import { hasSave, saveKeysIn } from '../title/saves.js';
const AUTO = 'grimoire.life.siso.v1.autobackup';

test('SLOTS: the manual slot survives any number of engine writes after a Replace; the auto slot takes the engine writes', async () => {
  const S = store(); const clockNow = () => NOW;
  const ad = localAdapter(S, { now: clockNow });
  save(S, played('T02', 'T03', 'T04'));
  const original = S.getItem(LIFE);
  // a (wrong) Replace by the player: the manual slot keeps the original
  const r = applyImport(exportOf(played('T06')), { mode: 'replace', confirmed: true, readLocal: ad.readLocal, writeLocal: ad.writeLocal, now: clockNow });
  assert.ok(r.ok);
  assert.equal(S.getItem(LIFE_BACKUP), original);
  // three engine writes, each bringing something new from the cloud
  for (const [i, id] of ['T08', 'T10', 'T11'].entries()) {
    const other = played(id); const cloud = memoryBackend({ doc: other.doc() });
    const sync = createSync({ backend: cloud, readLocal: ad.readLocal, writeLocal: (st) => ad.writeLocal(st), now: clockNow, listen: false, setTimer: () => 1, clearTimer: () => {} });
    await sync.start();
    assert.equal(sync.status(), 'synced', `engine write ${i}`);
  }
  assert.equal(S.getItem(LIFE_BACKUP), original, 'the manual slot is untouched by the engine');
  assert.ok(S.getItem(AUTO), 'the engine wrote to the auto slot');
  assert.notEqual(S.getItem(AUTO), original);
  const live = S.getItem(LIFE);
  assert.ok(restoreBackup({ storage: S, now: clockNow }).ok);          // default slot: manual
  assert.equal(S.getItem(LIFE), original);
  assert.equal(S.getItem(LIFE_BACKUP), live);                           // undoable
  const slots = backupSlots(S);
  assert.ok(slots.manual && slots.auto && slots.manual.at === NOW);
  // restoring the auto slot is its own undoable swap
  const beforeAuto = S.getItem(LIFE), autoRaw = S.getItem(AUTO);
  assert.ok(restoreBackup({ storage: S, slot: 'auto' }).ok);
  assert.equal(S.getItem(LIFE), autoRaw);
  assert.equal(S.getItem(AUTO), beforeAuto);
});

test('backupNow copies the live life and spells into a slot (manual by default); false when nothing is live or storage refuses', () => {
  const S = store({ 'grimoire.spells.v1': '{"a":1}' });
  assert.equal(backupNow(S), false);
  save(S, played('T02'));
  const live = S.getItem(LIFE);
  assert.equal(backupNow(S, { now: () => 77 }), true);
  assert.equal(S.getItem(LIFE_BACKUP), live);
  assert.equal(S.getItem(SPELLS_BACKUP), '{"a":1}');
  assert.equal(S.getItem(BACKUP_AT), '77');
  assert.equal(backupNow(S, { slot: 'auto', now: () => 78 }), true);
  assert.equal(S.getItem(AUTO), live);
  assert.equal(S.getItem(SLOTS.auto.at), '78');
  store.deny = /backup/;
  try { assert.equal(backupNow(S), false); } finally { store.deny = null; }
});

test('saves.js ignores every backup key: they make no Continue and are not cleared as a save', () => {
  const S = store({ [LIFE_BACKUP]: '{"v":1}', [BACKUP_AT]: '1', [AUTO]: '{"v":1}', [`${AUTO}.at`]: '1', 'grimoire.spells.v1.autobackup': '{}' });
  assert.deepEqual(saveKeysIn(S), []);
  assert.equal(hasSave(S), false);
});

test('localSummary says an unreadable save is unreadable, not "no game yet"', async () => {
  const { describeSummary } = await import('./file.js');
  const S = store({ [LIFE]: '{ broken' });
  const s = localSummary({ readLocal: localAdapter(S).readLocal, storage: S });
  assert.deepEqual(s, { unreadable: true });
  assert.equal(describeSummary(s), 'unreadable save (a backup will be kept)');
  assert.equal(describeSummary(localSummary({ readLocal: () => null, storage: store() })), 'no game yet');
});
