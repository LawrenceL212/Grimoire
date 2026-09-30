import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveState, recordSolve, creditFor } from './state.js';

const b = (id, room_id, start, end, day = '01') => ({ id, room_id, person_id: 1, start_at: `2026-01-${day}T${start}:00Z`, end_at: `2026-01-${day}T${end}:00Z` });
const PASS = { passed: true, results: [] }, FAIL = { passed: false, results: [] };

test('counters come from the world: £40 a booking on the timetable day, 4.8 less 0.3 per clashing pair', () => {
  const w = { bookings: [b(1, 1, '08:00', '09:00'), b(2, 1, '08:30', '09:30'), b(3, 2, '08:00', '09:00'), b(4, 3, '08:00', '09:00', '02')] };
  assert.deepEqual(deriveState(w, FAIL, {}), { bookings: 3, revenue: 120, reputation: 4.5, clashes: 1, openTickets: 1, xp: 0, level: 1 });
});

test('reputation counts clashing pairs: three bookings on one slot are three pairs', () => {
  const w = { bookings: [b(1, 1, '08:00', '09:00'), b(2, 1, '08:00', '09:00'), b(3, 1, '08:00', '09:00')] };
  const s = deriveState(w, FAIL, {});
  assert.equal(s.clashes, 3);
  assert.equal(s.reputation, 3.9);
});

test('reputation never goes below 0', () => {
  const w = { bookings: Array.from({ length: 8 }, (_, i) => b(i + 1, 1, '08:00', '09:00')) }; // 28 pairs
  assert.equal(deriveState(w, FAIL, {}).reputation, 0);
});

test('a passing grade closes the ticket; no grade: the ticket is open while a room clashes', () => {
  const clean = { bookings: [b(1, 1, '08:00', '09:00')] };
  assert.equal(deriveState(clean, PASS, {}).openTickets, 0);
  assert.equal(deriveState(clean, FAIL, {}).openTickets, 1);
  assert.equal(deriveState(clean, null, {}).openTickets, 0);
  assert.equal(deriveState({ bookings: [b(1, 1, '08:00', '09:00'), b(2, 1, '08:00', '09:00')] }, null, {}).openTickets, 1);
});

test('XP: +10 for the first clean solve of a ticket, never again for that ticket', () => {
  let h = {};
  assert.equal(creditFor(h, 'double-booking-1', { clean: true }), 10);
  h = recordSolve(h, 'double-booking-1', { clean: true });
  assert.equal(deriveState({ bookings: [] }, PASS, h).xp, 10);
  assert.equal(creditFor(h, 'double-booking-1', { clean: true }), 0);
  h = recordSolve(h, 'double-booking-1', { clean: true });
  assert.equal(deriveState({ bookings: [] }, PASS, h).xp, 10);
  assert.equal(h.solves.length, 2);
});

test('a solve after the worked example resolves but earns nothing, and a later clean solve of it earns nothing either', () => {
  let h = recordSolve({}, 't', { clean: false });
  assert.equal(deriveState({ bookings: [] }, PASS, h).xp, 0);
  assert.equal(creditFor(h, 't', { clean: true }), 0);
  h = recordSolve(h, 't', { clean: true });
  assert.equal(deriveState({ bookings: [] }, PASS, h).xp, 0);
});

test('levels: one every 100 XP; recordSolve does not change the history it is given', () => {
  const h = { solves: Array.from({ length: 23 }, (_, i) => ({ ticket: `t${i}`, clean: true })) };
  const s = deriveState({ bookings: [] }, PASS, h);
  assert.equal(s.xp, 230);
  assert.equal(s.level, 3);
  const h2 = recordSolve(h, 'new', { clean: true });
  assert.equal(h.solves.length, 23);
  assert.equal(h2.solves.length, 24);
});
