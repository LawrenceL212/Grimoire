import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarise, clashingRooms } from './hud.js';

const b = (id, room_id, start, end) => ({ id, room_id, person_id: 1, start_at: `2026-01-01T${start}:00Z`, end_at: `2026-01-01T${end}:00Z` });

test('counters read the world: £40 a booking on the day, 0.3 off 4.8 per clash', () => {
  const world = { bookings: [b(1, 1, '08:00', '09:00'), b(2, 1, '08:30', '09:30'), b(3, 2, '08:00', '09:00'), { ...b(4, 3, '08:00', '09:00'), start_at: '2026-01-02T08:00:00Z', end_at: '2026-01-02T09:00:00Z' }] };
  assert.deepEqual(summarise(world, { openTickets: 1, xp: 0 }), { bookings: 3, revenue: 120, reputation: 4.5, clashes: 1, openTickets: 1, xp: 0, level: 1 });
  assert.deepEqual([...clashingRooms(world)], [1]);
});

test('back-to-back bookings do not clash; XP makes levels', () => {
  const world = { bookings: [b(1, 1, '08:00', '09:00'), b(2, 1, '09:00', '10:00')] };
  const s = summarise(world, { xp: 230 });
  assert.equal(s.clashes, 0);
  assert.equal(s.reputation, 4.8);
  assert.equal(s.level, 3);
  assert.equal(clashingRooms(world).size, 0);
});
