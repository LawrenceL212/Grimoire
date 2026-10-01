import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TICKET, outcome } from './ticket.js';

const rooms = [{ id: 1, name: 'Room 1' }, { id: 2, name: 'Room 2' }, { id: 3, name: 'Room 3' }];
const W = { rooms, people: [], bookings: [] };
const t = { start_at: '2026-01-01T08:30:00Z', end_at: '2026-01-01T09:30:00Z' };

test('the ticket is a symptom in Bea\'s words, not an instruction', () => {
  assert.match(TICKET.symptom, /someone's already sitting there/);
  assert.doesNotMatch(TICKET.symptom, /delete|update|sql|booking 21/i);
});

test('resolved: Bea answers about what really happened, and the recap is two lines', () => {
  const pass = { passed: true, results: [] };
  const removed = outcome({ events: [{ type: 'booking-removed', bookingId: 21, roomId: 1 }], grade: pass, before: W, after: W, lang: 'php', xp: 10 });
  assert.equal(removed.resolved, true);
  assert.match(removed.reply, /book another slot/);
  assert.equal(removed.recap.length, 2);
  assert.match(removed.recap[0], /cancelled the newer booking \(21\) with PHP/);
  assert.match(removed.credit, /\+10 XP/);
  const moved = outcome({ events: [{ type: 'booking-moved', bookingId: 21, roomId: 2, fromRoomId: 1, toRoomId: 2, from: t, to: t }], grade: pass, before: W, after: W, xp: 0 });
  assert.match(moved.reply, /^Room 2\?/);
  assert.match(moved.credit, /No XP this time/);
  const later = outcome({ events: [{ type: 'booking-retimed', bookingId: 21, roomId: 1, from: t, to: { start_at: '2026-01-02T08:00:00Z', end_at: '2026-01-02T09:00:00Z' } }], grade: pass, before: W, after: W });
  assert.match(later.reply, /Fri 2 Jan 08:00 in Room 1/);
});

test('not resolved: an honest note from the failed checks and the diff', () => {
  const grade = { passed: false, results: [{ name: 'no room is double-booked', ok: false, detail: '2' }, { name: 'the original 20 bookings are untouched', ok: true, detail: '20' }] };
  const o = outcome({ events: [{ type: 'clash-started', bookingId: 3, otherId: 21, roomId: 3 }], grade, before: W, after: W });
  assert.equal(o.resolved, false);
  assert.equal(o.note, 'Room 3 is double-booked now.');
  const cheat = outcome({ events: [], grade: { passed: false, results: [{ name: 'the original 20 bookings are untouched', ok: false, detail: '0' }] }, before: W, after: W });
  assert.match(cheat.note, /Only 0 of the 20 bookings/);
});

test('the recap says what happened to the earlier bookings from the diff, not by assumption', () => {
  const pass = { passed: true, results: [] };
  const clean = outcome({ events: [{ type: 'booking-removed', bookingId: 21, roomId: 1 }], grade: pass, before: W, after: W });
  assert.match(clean.recap[0], /Every booking that was there first is as it was/);
  const shifted = outcome({ events: [{ type: 'booking-retimed', bookingId: 4, roomId: 1, from: t, to: t }, { type: 'booking-retimed', bookingId: 1, roomId: 1, from: t, to: t }], grade: pass, before: W, after: W });
  assert.match(shifted.recap[0], /changed 2 of the bookings that were there first \(1, 4\)/);
  assert.doesNotMatch(shifted.recap[0], /as it was/);
});

test('a pass that changed booking 1 person (no diff event) must not claim the originals are untouched', () => {
  const pass = { passed: true, results: [] };
  const row = (id, person) => ({ id, room_id: 1, person_id: person, ...t });
  const before = { rooms, people: [{ id: 1, name: 'A' }], bookings: [row(1, 1), row(21, 2)] };
  const after = { rooms, people: [{ id: 1, name: 'B' }], bookings: [row(1, 9), row(21, 2)] };
  const o = outcome({ events: [{ type: 'booking-removed', bookingId: 21, roomId: 1 }], grade: pass, before, after });
  assert.doesNotMatch(o.recap[0], /as it was/);
  assert.match(o.recap[0], /changed 1 of the bookings that were there first \(1\)/);
  assert.match(o.recap[0], /rows in 1 people/);
});
