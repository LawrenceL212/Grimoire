/* The booking business. Kept deliberately small: three tables, the shape every
   later problem grows from. Timestamps are timestamptz and the session runs in
   UTC, so a learner sees the same instants everywhere. */
export const SCHEMA = `
CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL
);
CREATE TABLE people (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer'
);
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  person_id INTEGER NOT NULL REFERENCES people(id),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  CHECK (end_at > start_at)
);`;

/* Deterministic: arithmetic only, no random() and no now(). Booking g goes to
   room 1 + g % rooms and starts (g / rooms) hours after 08:00 on 2026-01-01, so
   consecutive bookings in one room never overlap. The base world has no clashes;
   a problem adds its own. */
export function seedSql({ rooms = 3, people = 5, bookings = 20 } = {}) {
  return `
INSERT INTO rooms (name, capacity)
  SELECT 'Room ' || g, 4 + (g % 6) FROM generate_series(1, ${rooms}) g;
INSERT INTO people (name, role)
  SELECT 'Person ' || g, CASE WHEN g % 10 = 0 THEN 'staff' ELSE 'customer' END
  FROM generate_series(1, ${people}) g;
INSERT INTO bookings (room_id, person_id, start_at, end_at)
  SELECT 1 + (g % ${rooms}), 1 + (g % ${people}),
         TIMESTAMPTZ '2026-01-01 08:00+00' + (g / ${rooms}) * interval '1 hour',
         TIMESTAMPTZ '2026-01-01 08:00+00' + (g / ${rooms}) * interval '1 hour' + interval '1 hour'
  FROM generate_series(0, ${bookings} - 1) g;`;
}
