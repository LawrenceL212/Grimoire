import test from 'node:test';
import assert from 'node:assert/strict';
import { describeSkill } from './meter.js';

const DAY = 86400000;
const NOW = Date.UTC(2026, 8, 30); // 2026-09-30

test('a fading skill says when to review', () => {
  const m = describeSkill({ name: 'Overlap detection', lang: 'sql', lastMs: Date.UTC(2026, 8, 28), stability: 10 }, NOW);
  assert.equal(m.status, 'fading');
  assert.equal(m.line, 'last used 2 days ago · fading · review by 2026-10-01');
});

test('a due skill says review now', () => {
  const m = describeSkill({ name: 'Overlap detection', lang: 'sql', lastMs: Date.UTC(2026, 8, 24), stability: 10 }, NOW);
  assert.equal(m.status, 'due');
  assert.equal(m.line, 'last used 6 days ago · due now');
});

test('a skill used today is fresh and singular', () => {
  const m = describeSkill({ name: 'x', lang: 'sql', lastMs: NOW - 1000, stability: 10 }, NOW);
  assert.equal(m.status, 'fresh');
  assert.match(m.line, /^last used today · fresh · review by /);
  const one = describeSkill({ name: 'x', lang: 'sql', lastMs: NOW - DAY, stability: 100 }, NOW);
  assert.match(one.line, /^last used 1 day ago /);
});

test('the curve is a polyline that only falls', () => {
  const m = describeSkill({ name: 'x', lang: 'sql', lastMs: NOW, stability: 5 }, NOW);
  const ys = m.curve.split(' ').map((p) => Number(p.split(',')[1]));
  assert.ok(ys.length > 5);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] >= ys[i - 1]); // SVG y grows downwards
});
