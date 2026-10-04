import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_KEYS, saveKeysIn, hasSave, clearSave } from './saves.js';

function store(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

test('the save keys cover the life record and the older spell store', () => {
  assert.ok(SAVE_KEYS.includes('grimoire.life.siso.v1'));
  assert.ok(SAVE_KEYS.includes('grimoire.spells.v1'));
});

test('no storage, an empty one, or only settings: no save', () => {
  assert.equal(hasSave(null), false);
  assert.equal(hasSave(store()), false);
  assert.equal(hasSave(store({ 'grimoire.audio.v1': '{"master":1}', 'grimoire.theme.v1': '{}', 'grimoire.play.windows.v1': '{"a":1}' })), false);
});

test('an empty or corrupt record is no save; a real one is', () => {
  assert.equal(hasSave(store({ 'grimoire.spells.v1': '{}' })), false);
  assert.equal(hasSave(store({ 'grimoire.life.siso.v1': 'not json' })), false);
  assert.equal(hasSave(store({ 'grimoire.spells.v1': '{"select":{"r":1}}' })), true);
  assert.equal(hasSave(store({ 'grimoire.life.siso.v1': '{"v":1,"tutorial":{"done":false}}' })), true);
  assert.equal(hasSave(store({ 'grimoire.life.siso.v2': '{"v":2}' })), true, 'a later version counts too');
});

test('clearing removes every save key and keeps the settings', () => {
  const s = store({ 'grimoire.life.siso.v1': '{"v":1}', 'grimoire.life.siso.v2': '{"v":2}', 'grimoire.spells.v1': '{"a":1}',
    'grimoire.audio.v1': '{"master":0.5}', 'grimoire.theme.v1': '{}', 'grimoire.play.windows.v1': '{}' });
  const gone = clearSave(s);
  assert.deepEqual(gone.sort(), ['grimoire.life.siso.v1', 'grimoire.life.siso.v2', 'grimoire.spells.v1']);
  assert.deepEqual(Object.keys(s.dump()).sort(), ['grimoire.audio.v1', 'grimoire.play.windows.v1', 'grimoire.theme.v1']);
  assert.equal(hasSave(s), false);
  assert.deepEqual(saveKeysIn(s), []);
});

test('a storage that throws is treated as empty', () => {
  const bad = { get length() { throw new Error('blocked'); }, key() { throw new Error('blocked'); }, getItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(hasSave(bad), false);
  assert.deepEqual(clearSave(bad), []);
});

test('the sync backup keys are not a save: no Continue from a backup alone, and the exact keys are listed apart', () => {
  const s = store({ 'grimoire.life.siso.v1.backup': '{"v":1,"solves":[1]}', 'grimoire.life.siso.v1.backup.at': '5', 'grimoire.spells.v1.backup': '{"a":1}' });
  assert.deepEqual(saveKeysIn(s), []);
  assert.equal(hasSave(s), false);
  assert.deepEqual(clearSave(s), []);
  assert.equal(s.getItem('grimoire.life.siso.v1.backup') != null, true);
});
