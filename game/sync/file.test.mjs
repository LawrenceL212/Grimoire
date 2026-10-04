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
  assert.equal(S2.getItem(LIFE_BACKUP), 'garbage');
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
