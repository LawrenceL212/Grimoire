// spells.js: the honest progression of a spell (met, unwritten, written by an unaided cast only) and its ink.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SPELLS, LANGS, createSpellStore, memoryStorage, inkOf, INK } from './spells.js';

const DAY = 86400000, NOW = Date.UTC(2026, 9, 1);

test('every spell has a name, a line and all three forms; every language has its drone', () => {
  assert.ok(SPELLS.length >= 10);
  for (const s of SPELLS) for (const l of ['sql', 'js', 'php']) assert.ok(s.name && s.line && s.forms[l], `${s.id} ${l}`);
  assert.deepEqual(Object.values(LANGS).map((l) => l.droneName), ['Sequel', 'Jay', 'Hex']);
});

test('not met, met (unwritten), help never writes it, an unaided cast does', () => {
  const st = createSpellStore({ storage: memoryStorage() });
  assert.equal(inkOf(st.getSpellState('where'), NOW).status, 'unknown');
  st.introduce('where', ['sql']);
  assert.equal(inkOf(st.getSpellState('where'), NOW).status, 'unwritten');
  st.recordCast('where', { lang: 'sql', assisted: true, nowMs: NOW });
  assert.equal(st.getSpellState('where').written, false);
  st.recordCast('where', { lang: 'sql', nowMs: NOW });
  const s = st.getSpellState('where');
  assert.equal(s.written, true);
  assert.equal(s.forms.sql.written, true);
  assert.equal(inkOf(s, NOW).status, 'fresh');
});

test('the ink fades with the meter and says how long it is kept', () => {
  const s = { introduced: true, langs: ['sql'], written: true, lastMs: NOW, stability: 3 };
  assert.equal(inkOf(s, NOW).opacity, INK.fresh);
  assert.equal(inkOf(s, NOW + 0.67 * DAY).opacity, INK.fading);
  const due = inkOf(s, NOW + 3 * DAY);
  assert.equal(due.opacity, INK.due);
  assert.match(due.line, /re-ink soon/);
  assert.match(inkOf(s, NOW).line, /Kept about 3 days/);
});

test('introduced languages come back in SQL, JavaScript, PHP order; storage survives a new store', () => {
  const mem = memoryStorage();
  const a = createSpellStore({ storage: mem });
  a.introduce('select-all', ['php']); a.introduce('select-all', ['sql']);
  assert.deepEqual(createSpellStore({ storage: mem }).getSpellState('select-all').langs, ['sql', 'php']);
});

test('broken storage never throws', () => {
  const bad = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); }, removeItem() {} };
  const st = createSpellStore({ storage: bad });
  st.recordCast('where', { lang: 'sql', nowMs: NOW });
  assert.equal(st.getSpellState('where').written, true);
});
