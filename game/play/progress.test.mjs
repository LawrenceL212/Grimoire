// progress.js: honest progression through the opening chapter, per life, under one key.
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshLife, cleanLife, helpOf, nextCardId, paceCheck, startCard, recordSolve, xpOf, createLife, dayKey, CREDIT, HINT_COST, LIFE_KEY } from './progress.js';
import { LADDER, cardById, DAILY_CAP } from '../problems/ladder.js';
import { memoryStorage } from './spells.js';

const DAY = 86400000, NOW = new Date(2026, 9, 1, 19, 0).getTime();

test('a fresh life starts at the tutorial, then the first ladder card (O1, not the double booking)', () => {
  const life = freshLife(NOW);
  assert.equal(life.tutorial.done, false);
  assert.equal(nextCardId(LADDER, life), 'O1');
});

test('help maps to the credit table: clean, nudged, guided, exposure', () => {
  assert.equal(helpOf({}), 'clean');
  assert.equal(helpOf({ hint: 1 }), 'nudged');
  assert.equal(helpOf({ codexEarly: true }), 'nudged');
  assert.equal(helpOf({ hint: 2 }), 'guided');
  assert.equal(helpOf({ hint: 3 }), 'guided');
  assert.equal(helpOf({ worked: true }), 'exposure');
  assert.equal(helpOf({ hint: 1, worked: true }), 'exposure');
  assert.deepEqual(HINT_COST.map((h) => h.level), [1, 2, 3, 4]);
  assert.ok(CREDIT.clean > CREDIT.nudged && CREDIT.nudged > CREDIT.guided && CREDIT.guided > CREDIT.exposure);
});

test('a spell is written only on an unaided first solve of a card that can count as evidence', () => {
  let life = freshLife(NOW);
  const t17 = cardById('T17');
  let r = recordSolve(life, t17, { help: 'clean', casts: ['order-by', 'where'], nowMs: NOW });
  assert.ok(r.spells.every((s) => s.unaided === true && s.outcome === 'clean'));
  assert.equal(r.xp, CREDIT.clean);
  life = r.life;
  r = recordSolve(life, t17, { help: 'clean', casts: ['order-by'], nowMs: NOW + 1000 }); // a re-solve: not fresh
  assert.equal(r.spells[0].unaided, false);
  assert.equal(r.xp, 0);
  r = recordSolve(freshLife(NOW), t17, { help: 'exposure', casts: ['order-by'], nowMs: NOW }); // the worked example
  assert.equal(r.spells[0].unaided, false);
  assert.equal(r.spells[0].outcome, 'exposure');
  assert.equal(r.life.solves[0].assisted, true);
  r = recordSolve(freshLife(NOW), t17, { help: 'guided', casts: ['order-by'], nowMs: NOW });
  assert.equal(r.spells[0].unaided, false);
  assert.equal(r.spells[0].outcome, 'guided');
  r = recordSolve(freshLife(NOW), cardById('O4'), { help: 'clean', casts: ['select-all'], nowMs: NOW }); // scaffolded on-ramp
  assert.equal(r.spells[0].unaided, false);
  r = recordSolve(freshLife(NOW), t17, { help: 'nudged', casts: ['order-by'], nowMs: NOW });
  assert.equal(r.spells[0].unaided, true);
  assert.equal(r.xp, CREDIT.nudged);
});

test('progress moves in ladder order; solves and timestamps are kept with their assisted flag', () => {
  let life = freshLife(NOW);
  for (const id of ['O1', 'O2', 'S1']) life = recordSolve(life, cardById(id), { help: id === 'O2' ? 'exposure' : 'clean', nowMs: NOW }).life;
  assert.equal(nextCardId(LADDER, life), 'S2');
  assert.deepEqual(life.solves.map((s) => [s.card, s.assisted, s.atMs]), [['O1', false, NOW], ['O2', true, NOW], ['S1', false, NOW]]);
  const practice = recordSolve(life, cardById('O1'), { help: 'clean', nowMs: NOW, practice: true });
  assert.equal(practice.xp, 0);
  assert.equal(xpOf(practice.life), xpOf(life));
});

test('the pace rule: at most DAILY_CAP new concepts a calendar day, with an honest message; tomorrow opens again', () => {
  let life = freshLife(NOW);
  const cards = LADDER.filter((c) => c.newConcept).slice(0, DAILY_CAP + 1);
  for (const c of cards.slice(0, DAILY_CAP)) {
    assert.equal(paceCheck(c, life, NOW, DAILY_CAP).ok, true);
    life = startCard(life, c, NOW);
  }
  const over = paceCheck(cards[DAILY_CAP], life, NOW, DAILY_CAP);
  assert.equal(over.ok, false);
  assert.match(over.message, /new ideas today/);
  assert.match(over.message, /tomorrow/);
  assert.equal(paceCheck(cards[0], life, NOW, DAILY_CAP).ok, true, 'a card already started is never blocked');
  assert.equal(paceCheck(cardById('T18'), life, NOW, DAILY_CAP).ok, true, 'a checkpoint teaches nothing new');
  assert.equal(paceCheck(cards[DAILY_CAP], life, NOW + DAY, DAILY_CAP).ok, true);
  assert.deepEqual(life.days[dayKey(NOW)], cards.slice(0, DAILY_CAP).map((c) => c.id));
});

test('a stored life is validated; corrupt data falls back to a fresh life, never throws', () => {
  assert.deepEqual(cleanLife(null, NOW), freshLife(NOW));
  assert.deepEqual(cleanLife({ v: 2 }, NOW), freshLife(NOW));
  const l = cleanLife({ v: 1, startedMs: NOW, tutorial: { done: true, step: -3 }, solves: [{ card: 'O1', atMs: NOW, help: 'clean' }, { card: 'O2', atMs: 'x', help: 'clean' }, { card: 'O3', atMs: NOW, help: 'cheated' }], days: { nope: ['O1'], '2026-10-01': ['O1', 5] } }, NOW);
  assert.equal(l.tutorial.done, true);
  assert.equal(l.tutorial.step, 0);
  assert.deepEqual(l.solves.map((s) => s.card), ['O1']);
  assert.deepEqual(l.days, { '2026-10-01': ['O1'] });
});

test('createLife persists everything (spells included) under one key, and Continue reads it back', () => {
  const mem = memoryStorage();
  const a = createLife({ storage: mem, now: () => NOW });
  assert.equal(a.existed, false);
  a.life = recordSolve(startCard(a.life, cardById('O1'), NOW), cardById('O1'), { nowMs: NOW }).life;
  a.spellStore.introduce('table-row', ['sql']);
  a.spellStore.recordCast('where', { lang: 'sql', unaided: true, nowMs: NOW });
  const keys = [];
  const spy = { getItem: (k) => mem.getItem(k), setItem: (k, v) => { keys.push(k); mem.setItem(k, v); }, removeItem: (k) => mem.removeItem(k) };
  const b = createLife({ storage: spy, now: () => NOW });
  assert.equal(b.existed, true);
  assert.equal(nextCardId(LADDER, b.life), 'O2');
  assert.equal(b.spellStore.getSpellState('where').written, true);
  assert.equal(b.spellStore.getSpellState('table-row').introduced, true);
  b.spellStore.introduce('update', ['sql']);
  assert.deepEqual([...new Set(keys)], [LIFE_KEY]);
  b.reset();
  assert.equal(b.spellStore.getSpellState('where').written, false);
  const broken = createLife({ storage: { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } }, now: () => NOW });
  assert.equal(broken.life.tutorial.done, false);
  broken.save();
});

// ---- review round 1: honesty leaks
import { noteHelp, helpSoFar, effectiveNow, touch } from './progress.js';

test('the help used on a card is kept in the record and never lowered', () => {
  let life = startCard(freshLife(NOW), cardById('T11'), NOW);
  life = noteHelp(life, 'T11', { hint: 4, worked: true });
  life = noteHelp(life, 'T11', { hint: 1 });
  const back = cleanLife(JSON.parse(JSON.stringify(life)), NOW);
  assert.deepEqual(helpSoFar(back, 'T11'), { hint: 4, worked: true, codexEarly: false });
  assert.equal(helpOf(helpSoFar(back, 'T11')), 'exposure');
  life = noteHelp(life, 'T17', { codexEarly: true });
  assert.equal(helpOf(helpSoFar(life, 'T17')), 'nudged');
});

test('a practice solve casts nothing; a teaching ticket earns no XP', () => {
  let life = recordSolve(freshLife(NOW), cardById('T17'), { help: 'clean', casts: ['where'], nowMs: NOW }).life;
  const p = recordSolve(life, cardById('T17'), { help: 'clean', casts: ['where', 'order-by'], nowMs: NOW, practice: true });
  assert.deepEqual(p.spells, []);
  for (const id of ['O1', 'O6', 'T01']) assert.equal(recordSolve(freshLife(NOW), cardById(id), { help: 'clean', nowMs: NOW }).xp, 0, id);
  assert.equal(recordSolve(freshLife(NOW), cardById('T02'), { help: 'clean', nowMs: NOW }).xp, CREDIT.clean);
});

test('the clock never goes backwards: setting it back opens no fresh daily cap', () => {
  let life = freshLife(NOW);
  const cards = LADDER.filter((c) => c.newConcept).slice(0, DAILY_CAP + 1);
  for (const c of cards.slice(0, DAILY_CAP)) life = startCard(life, c, NOW);
  assert.equal(paceCheck(cards[DAILY_CAP], life, NOW - DAY, DAILY_CAP).ok, false);
  assert.equal(effectiveNow(life, NOW - 3 * DAY), NOW);
  assert.equal(touch(life, NOW + 5).highMs, NOW + 5);
});

test('stored XP is clamped to the credit table, solves dated in the future are dropped, only a first solve pays', () => {
  const l = cleanLife({ v: 1, startedMs: NOW, highMs: NOW, solves: [
    { card: 'T02', atMs: NOW, help: 'clean', xp: 500 },
    { card: 'T02', atMs: NOW, help: 'clean', xp: 10 },
    { card: 'T03', atMs: NOW, help: 'guided', xp: 10 },
    { card: 'T04', atMs: NOW + 9 * DAY, help: 'clean', xp: 10 },
  ] }, NOW);
  assert.deepEqual(l.solves.map((s) => [s.card, s.xp]), [['T02', 10], ['T02', 0], ['T03', CREDIT.guided]]);
});
