import { NO_OVERLAP_SQL } from './check.js';

/* Booking 21 clashes with booking 1 in Room 1 from 08:30. The first booking
   stands, so any answer that removes or moves the newer one is valid. */
export const doubleBooking1 = {
  id: 'double-booking-1',
  title: 'Two people, one room',
  goal: 'Room 1 is double-booked from 08:30. The first booking stands. Sort out the newer one.',
  languages: ['sql', 'js', 'php'],
  world: { rooms: 3, people: 5, bookings: 20 },
  setup: `INSERT INTO bookings (room_id, person_id, start_at, end_at)
          VALUES (1, 2, '2026-01-01T08:30:00Z', '2026-01-01T09:30:00Z');`,
  checks: [
    { name: 'no room is double-booked', sql: NO_OVERLAP_SQL, expect: { equals: 0 } },
    { name: 'the original 20 bookings are untouched',
      sql: 'SELECT count(*)::int AS n FROM bookings WHERE id <= 20', expect: { equals: 20 } },
  ],
  reference: {
    sql: 'DELETE FROM bookings WHERE id = 21;',
    js: 'world.bookings = world.bookings.filter((b) => b.id !== 21);',
    php: "$pdo->exec('DELETE FROM bookings WHERE id = 21');",
  },
  alternates: [
    { lang: 'sql', name: 'move the newer booking to another day',
      code: "UPDATE bookings SET start_at = '2026-01-02T08:00:00Z', end_at = '2026-01-02T09:00:00Z' WHERE id = 21;" },
    { lang: 'js', name: 'move the newer booking to another day',
      code: "const b = world.bookings.find((x) => x.id === 21); b.start_at = '2026-01-02T08:00:00Z'; b.end_at = '2026-01-02T09:00:00Z';" },
  ],
  cheats: [
    { lang: 'sql', name: 'delete every booking', code: 'DELETE FROM bookings;' },
    { lang: 'js', name: 'empty the bookings list', code: 'world.bookings = [];' },
  ],
};
