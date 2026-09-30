import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_STABILITY, daysSince, retrievability, statusOf, reviewBy, nextStability,
} from './curve.js';

const DAY = 86400000;

test('daysSince counts whole days and never goes negative', () => {
  assert.equal(daysSince(0, 6 * DAY), 6);
  assert.equal(daysSince(0, DAY - 1), 0);
  assert.equal(daysSince(5 * DAY, 0), 0);
});

test('retrievability is 1 now and falls to 1/e after one stability', () => {
  assert.equal(retrievability(0, 10), 1);
  assert.ok(Math.abs(retrievability(10, 10) - Math.exp(-1)) < 1e-12);
});

test('statusOf uses the fresh and fading thresholds', () => {
  assert.equal(statusOf(0.9), 'fresh');
  assert.equal(statusOf(0.89), 'fading');
  assert.equal(statusOf(0.7), 'fading');
  assert.equal(statusOf(0.69), 'due');
});

test('reviewBy is the moment recall falls to the threshold', () => {
  const last = 1_000_000;
  const at = reviewBy(last, 10, 0.7);
  const elapsedDays = (at - last) / DAY;
  assert.ok(Math.abs(retrievability(elapsedDays, 10) - 0.7) < 1e-9);
});

test('nextStability: clean grows most, assisted grows a little, failed resets', () => {
  assert.equal(nextStability(2, 'clean'), 5);
  assert.ok(Math.abs(nextStability(2, 'assisted') - 2.4) < 1e-12);
  assert.equal(nextStability(8, 'failed'), INITIAL_STABILITY / 2);
  assert.ok(nextStability(4, 'assisted') < nextStability(4, 'clean'));
});

test('stability never drops below the initial floor after a failure', () => {
  assert.ok(nextStability(0.1, 'failed') >= INITIAL_STABILITY / 2);
});
