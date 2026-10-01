// spells.js: the honest progression of a spell (met, unwritten, written by an unaided cast only) and its ink.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SPELLS, LANGS, createSpellStore, memoryStorage, inkOf, INK } from './spells.js';

const DAY = 86400000, NOW = Date.UTC(2026, 9, 1);

test('every spell has a name, a line, keywords and all three forms; every language has its drone', () => {
  assert.ok(SPELLS.length >= 10);
  for (const s of SPELLS) {
    for (const l of ['sql', 'js', 'php']) assert.ok(s.name && s.line && s.forms[l], `${s.id} ${l}`);
    assert.ok(Array.isArray(s.keywords) && s.keywords.length, `${s.id} keywords`);
  }
  assert.deepEqual(Object.values(LANGS).map((l) => l.droneName), ['Sequel', 'Jay', 'Hex']);
});

test('the SQL forms use the real world\'s columns (room_id, start_at), not made-up ones', () => {
  for (const s of SPELLS) assert.doesNotMatch(s.forms.sql, /\broom\s*=|\bstarts\b|\bends\b|\bperson\s*=/, s.id);
});

test('not met, met (unwritten), help never writes it, only a positive unaided signal does', () => {
  const st = createSpellStore({ storage: memoryStorage(), now: () => NOW });
  assert.equal(inkOf(st.getSpellState('where'), NOW).status, 'unknown');
  st.introduce('where', ['sql']);
  assert.equal(inkOf(st.getSpellState('where'), NOW).status, 'unwritten');
  st.recordCast('where', { lang: 'sql', outcome: 'exposure', nowMs: NOW });
  assert.equal(st.getSpellState('where').written, false);
  st.recordCast('where', { lang: 'sql', nowMs: NOW }); // no flag at all: fails closed (exposure only)
  assert.equal(st.getSpellState('where').written, false);
  st.recordCast('where', { lang: 'sql', unaided: 'yes', nowMs: NOW }); // only true itself counts
  assert.equal(st.getSpellState('where').written, false);
  st.recordCast('where', { lang: 'sql', unaided: true, nowMs: NOW });
  const s = st.getSpellState('where');
  assert.equal(s.written, true);
  assert.equal(s.forms.sql.written, true);
  assert.equal(inkOf(s, NOW).status, 'fresh');
});

test('on a written spell, guided keeps the stability and exposure cuts it (credit table)', () => {
  const st = createSpellStore({ storage: memoryStorage(), now: () => NOW });
  st.recordCast('delete', { lang: 'sql', unaided: true, nowMs: NOW });
  st.recordCast('delete', { lang: 'sql', unaided: true, nowMs: NOW + DAY });
  const S1 = st.getSpellState('delete', NOW + DAY).stability;
  assert.ok(S1 > 3 * 3 && S1 <= 12, String(S1)); // recalled a day later: the gain depends on the recall
  st.recordCast('delete', { lang: 'sql', outcome: 'guided', nowMs: NOW + 2 * DAY });
  assert.equal(st.getSpellState('delete', NOW + 2 * DAY).stability, S1);
  st.recordCast('delete', { lang: 'sql', outcome: 'exposure', nowMs: NOW + 3 * DAY });
  assert.ok(Math.abs(st.getSpellState('delete', NOW + 3 * DAY).stability - 0.3 * S1) < 1e-9);
  assert.equal(st.getSpellState('delete', NOW + 3 * DAY).written, true); // help never un-writes either
});

test('the ink fades with the meter, stays readable when due, and says how long it is kept', () => {
  const s = { introduced: true, langs: ['sql'], written: true, lastMs: NOW, stability: 3 };
  assert.equal(inkOf(s, NOW).opacity, INK.fresh);
  assert.equal(inkOf(s, NOW + 0.67 * DAY).opacity, INK.fading);
  const due = inkOf(s, NOW + 3 * DAY);
  assert.equal(due.opacity, INK.due);
  assert.ok(INK.due >= 0.5 && INK.due < INK.fading && INK.fading < INK.fresh);
  assert.match(due.line, /re-ink soon/);
  assert.match(inkOf(s, NOW).line, /Kept about 3 days/);
});

test('introduced languages come back in SQL, JavaScript, PHP order; storage survives a new store', () => {
  const mem = memoryStorage();
  const a = createSpellStore({ storage: mem });
  a.introduce('select-all', ['php']); a.introduce('select-all', ['sql']);
  assert.deepEqual(createSpellStore({ storage: mem }).getSpellState('select-all').langs, ['sql', 'php']);
});

test('unknown spells and languages are refused, not stored', () => {
  const mem = memoryStorage();
  const st = createSpellStore({ storage: mem });
  assert.equal(st.introduce('no-such-spell', ['sql']), null);
  assert.equal(st.introduce('where', ['cobol']), null);
  assert.equal(st.recordCast('no-such-spell', { lang: 'sql', unaided: true }), null);
  assert.equal(st.recordCast('where', { lang: 'cobol', unaided: true }), null);
  assert.equal(st.getSpellState('where').introduced, false);
  assert.equal(mem.getItem('grimoire.spells.v1'), null);
});

test('stored state is validated: corrupt, forged or future records fall back safely', () => {
  const mem = memoryStorage();
  mem.setItem('grimoire.spells.v1', JSON.stringify({
    where: { langs: 'sql', written: true, lastMs: 'yesterday', stability: -4, forms: 7 },
    update: { langs: ['sql', 'cobol'], written: true, lastMs: NOW + 5 * DAY, stability: 3, forms: { sql: { written: true, lastMs: NOW + 5 * DAY, stability: 3 } } },
    delete: { langs: ['sql'], written: true, lastMs: NOW - DAY, stability: Infinity, forms: {} },
    'not-a-spell': { langs: ['sql'], written: true, lastMs: NOW, stability: 3 },
  }));
  const st = createSpellStore({ storage: mem, now: () => NOW });
  const w = st.getSpellState('where');
  assert.equal(w.written, false); assert.deepEqual(w.langs, []); assert.equal(w.stability, 3);
  const u = st.getSpellState('update');
  assert.deepEqual(u.langs, ['sql']);
  assert.equal(u.written, false, 'a cast dated in the future is not written');
  assert.equal(u.forms.sql.written, false);
  assert.equal(inkOf(u, NOW).status, 'unwritten');
  assert.equal(st.getSpellState('delete').stability, 3, 'an infinite stability falls back');
  assert.equal(st.all().length, SPELLS.length);
  mem.setItem('grimoire.spells.v1', '{not json');
  assert.equal(createSpellStore({ storage: mem }).getSpellState('where').introduced, false);
  mem.setItem('grimoire.spells.v1', '[1,2,3]');
  assert.equal(createSpellStore({ storage: mem }).getSpellState('where').introduced, false);
});

test('broken storage never throws', () => {
  const bad = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); }, removeItem() {} };
  const st = createSpellStore({ storage: bad });
  st.recordCast('where', { lang: 'sql', unaided: true, nowMs: NOW });
  assert.equal(st.getSpellState('where', NOW).written, true);
});

// ---- review round 1
test('a same-day recast barely changes what is kept (x1.1 at most); a recall days later gains more', () => {
  const st = createSpellStore({ storage: memoryStorage(), now: () => NOW });
  st.recordCast('where', { lang: 'sql', unaided: true, nowMs: NOW });
  st.recordCast('where', { lang: 'sql', unaided: true, nowMs: NOW + 3600000 });
  assert.ok(Math.abs(st.getSpellState('where', NOW + DAY).stability - 3.3) < 1e-9, String(st.getSpellState('where', NOW + DAY).stability));
  const b = createSpellStore({ storage: memoryStorage(), now: () => NOW });
  b.recordCast('delete', { lang: 'sql', unaided: true, nowMs: NOW });
  b.recordCast('delete', { lang: 'sql', unaided: true, nowMs: NOW + 2 * DAY });
  const s = b.getSpellState('delete', NOW + 2 * DAY).stability;
  assert.ok(s > 3 * 3 && s <= 12, String(s)); // R = e^(-2/3): g = e^(2(1-R)), S x min(4, 1 + 1.5 g)
});

test('the tutorial demonstration is flagged: written for the moment, never counted, the first real cast writes it', () => {
  const st = createSpellStore({ storage: memoryStorage(), now: () => NOW });
  st.recordCast('select-all', { lang: 'sql', demo: true, nowMs: NOW });
  const d = st.getSpellState('select-all', NOW);
  assert.equal(d.demo, true);
  assert.equal(d.written, false, 'a demonstration is not a written spell');
  assert.equal(inkOf(d, NOW).status, 'demo');
  assert.match(inkOf(d, NOW).line, /Demonstration/);
  st.recordCast('select-all', { lang: 'sql', unaided: true, nowMs: NOW + 2 * DAY });
  const w = st.getSpellState('select-all', NOW + 2 * DAY);
  assert.equal(w.written, true); assert.equal(w.demo, false);
  assert.equal(w.stability, 3, 'the first real cast is the first write');
});
