import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffWorlds, clashPairs, overlaps, rowChanges, describeRows } from './bridge.js';

const b = (id, room_id, start, end, day = '01') => ({ id, room_id, person_id: 1, start_at: `2026-01-${day}T${start}:00Z`, end_at: `2026-01-${day}T${end}:00Z` });
const world = (...bookings) => ({ rooms: [{ id: 1 }, { id: 2 }, { id: 3 }], people: [], bookings });
// the double-booking-1 shape: 1 and 21 overlap in Room 1, 2 runs in Room 2
const B1 = b(1, 1, '08:00', '09:00'), B2 = b(2, 2, '08:00', '09:00'), B21 = b(21, 1, '08:30', '09:30');
const clashWorld = world(B1, B2, B21);

test('the overlap rule is NO_OVERLAP_SQL: same room, a.start < b.end and b.start < a.end', () => {
  assert.equal(overlaps(B1, B21), true);
  assert.equal(overlaps(B1, B2), false); // another room
  assert.equal(overlaps(B1, b(5, 1, '09:00', '10:00')), false); // back to back
  assert.equal(overlaps(B1, { ...B1, id: 7, start_at: '2026-01-01T08:59:00.000Z' }), true); // times compared as instants, not text
  assert.deepEqual(clashPairs(clashWorld.bookings), [{ a: 1, b: 21, roomId: 1 }]);
});

test('no change: no events', () => {
  assert.deepEqual(diffWorlds(clashWorld, structuredClone(clashWorld)), []);
});

test('a booking removed clears its clash', () => {
  assert.deepEqual(diffWorlds(clashWorld, world(B1, B2)), [
    { type: 'booking-removed', bookingId: 21, roomId: 1 },
    { type: 'clash-cleared', bookingId: 1, otherId: 21, roomId: 1 },
  ]);
});

test('a booking added into a busy slot starts a clash', () => {
  assert.deepEqual(diffWorlds(world(B1, B2), clashWorld), [
    { type: 'booking-added', bookingId: 21, roomId: 1 },
    { type: 'clash-started', bookingId: 1, otherId: 21, roomId: 1 },
  ]);
});

test('a booking moved between rooms: the old clash clears and a new one starts', () => {
  const moved = { ...B21, room_id: 2 };
  assert.deepEqual(diffWorlds(clashWorld, world(B1, B2, moved)), [
    { type: 'booking-moved', bookingId: 21, roomId: 2, fromRoomId: 1, toRoomId: 2, from: { start_at: B21.start_at, end_at: B21.end_at }, to: { start_at: B21.start_at, end_at: B21.end_at } },
    { type: 'clash-cleared', bookingId: 1, otherId: 21, roomId: 1 },
    { type: 'clash-started', bookingId: 2, otherId: 21, roomId: 2 },
  ]);
});

test('a booking moved to an empty room clears the clash with nothing new', () => {
  const moved = { ...B21, room_id: 3 };
  assert.deepEqual(diffWorlds(clashWorld, world(B1, B2, moved)).map((e) => e.type), ['booking-moved', 'clash-cleared']);
});

test('a booking retimed within its room', () => {
  const later = { ...B21, start_at: '2026-01-02T08:00:00Z', end_at: '2026-01-02T09:00:00Z' };
  assert.deepEqual(diffWorlds(clashWorld, world(B1, B2, later)), [
    { type: 'booking-retimed', bookingId: 21, roomId: 1, from: { start_at: B21.start_at, end_at: B21.end_at }, to: { start_at: later.start_at, end_at: later.end_at } },
    { type: 'clash-cleared', bookingId: 1, otherId: 21, roomId: 1 },
  ]);
});

test('the same instant written another way is not a retime', () => {
  const same = { ...B21, start_at: '2026-01-01T08:30:00.000Z' };
  assert.deepEqual(diffWorlds(clashWorld, world(B1, B2, same)), []);
});

test('the order is fixed: removed, moved, retimed, added (by id), then cleared, started (by pair)', () => {
  const before = world(B1, B2, B21, b(4, 3, '10:00', '11:00'), b(5, 3, '12:00', '13:00'));
  const after = world(b(1, 1, '09:30', '10:30'), { ...B2, room_id: 3 }, b(22, 2, '08:00', '09:00'), b(9, 1, '10:00', '11:00'), b(5, 3, '12:00', '13:00'));
  const got = diffWorlds(before, after);
  assert.deepEqual(got.map((e) => `${e.type}:${e.bookingId}${e.otherId ? '-' + e.otherId : ''}`), [
    'booking-removed:4', 'booking-removed:21',
    'booking-moved:2',
    'booking-retimed:1',
    'booking-added:9', 'booking-added:22',
    'clash-cleared:1-21',
    'clash-started:1-9',
  ]);
  assert.deepEqual(diffWorlds(before, after), got); // deterministic
});

test('a clash between the same two bookings that changes room is cleared in one and started in the other', () => {
  const before = world(B1, B21);
  const after = world({ ...B1, room_id: 2 }, { ...B21, room_id: 2 });
  assert.deepEqual(diffWorlds(before, after).filter((e) => e.type.startsWith('clash')), [
    { type: 'clash-cleared', bookingId: 1, otherId: 21, roomId: 1 },
    { type: 'clash-started', bookingId: 1, otherId: 21, roomId: 2 },
  ]);
});

test('missing lists are empty worlds', () => {
  assert.deepEqual(diffWorlds({}, world(B1)), [{ type: 'booking-added', bookingId: 1, roomId: 1 }]);
  assert.deepEqual(diffWorlds(world(B1), {}), [{ type: 'booking-removed', bookingId: 1, roomId: 1 }]);
});

test('rowChanges sees every table and column, so a change with no scene event is still a change', () => {
  const w = { rooms: [{ id: 1, name: 'Room 1', capacity: 5 }], people: [{ id: 1, name: 'Ann', role: 'customer' }], bookings: [B1] };
  assert.deepEqual(rowChanges(w, structuredClone(w)), []);
  assert.deepEqual(rowChanges(w, { ...w, bookings: [{ ...B1, start_at: '2026-01-01T08:00:00.000Z' }] }), []); // same instant
  const renamed = { ...w, rooms: [{ id: 1, name: 'Room One', capacity: 5 }] };
  assert.deepEqual(rowChanges(w, renamed), [{ table: 'rooms', added: 0, removed: 0, changed: 1 }]);
  assert.deepEqual(diffWorlds(w, renamed), []);
  const other = { ...w, bookings: [{ ...B1, person_id: 3 }], people: [...w.people, { id: 2, name: 'Bo', role: 'customer' }] };
  const ch = rowChanges(w, other);
  assert.deepEqual(ch, [{ table: 'people', added: 1, removed: 0, changed: 0 }, { table: 'bookings', added: 0, removed: 0, changed: 1 }]);
  assert.equal(describeRows(ch), '1 row in people added, 1 row in bookings changed');
});
