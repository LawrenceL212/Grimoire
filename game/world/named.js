/* The opening chapter's world: the named seed of the learning design (section 4). The rooms and people
   of the story (the Boardroom, the Studio, the Library; Priya, Sam...) replace Phase 1's "Room 1" and
   "Person 1"; a week of bookings, Monday 5 to Friday 9 January 2026, none clashing.

   A ticket in the chapter starts from this world as the earlier tickets left it, as stage flags:
     boardroom10   T04 is done: the Boardroom seats 10, not 8
     garden        T06 is done: the Garden Room (6 seats) exists, and people have booked it since
     samFridayGone T13 is done: Sam's mistaken Friday Boardroom booking (11) is cancelled
   Any valid fix of those one-off tickets leaves the same facts, so the next ticket can rely on them.

   The SHADOW world is the hidden second world answers are also checked on (section 4, "outcome grading,
   twice"): the named rooms and people keep their ids and names, while capacities, bookings, unnamed
   people and row counts differ, and it holds the traps the cheats fall into (a 7-seater, a booking at
   exactly midnight on Saturday, one that ends exactly when an hour starts...). Typing an answer read off
   the screen passes the real world and fails the shadow one.

   Deterministic: plain VALUES, explicit ids, no random() and no now(). Times are UTC. */

export const WEEK = { monday: '2026-01-05', friday: '2026-01-09' };
export const CLOCK = '2026-01-05T10:15:00Z'; // the office clock for the chapter: Monday, mid-morning
export const ROOM = { boardroom: 1, studio: 2, library: 3, garden: 4 };
export const PERSON = { priya: 1, sam: 2, jo: 3, omar: 4, lena: 5 };
export const STAGES = ['boardroom10', 'garden', 'samFridayGone'];

const PEOPLE = [
  [1, 'Priya Shah', 'staff'], [2, 'Sam Fletcher', 'customer'], [3, 'Jo Bell', 'customer'],
  [4, 'Omar Haddad', 'customer'], [5, 'Lena Novak', 'customer'],
];
const SHADOW_PEOPLE = [...PEOPLE, [6, 'Ravi Patel', 'customer'], [7, 'Mia Wong', 'customer']];

// [id, room_id, person_id, day (5..10 = Mon 5 .. Sat 10 Jan), 'HH:MM' start, 'HH:MM' end]
const BASE = [
  [1, 1, 4, 5, '08:00', '09:00'],
  [2, 3, 3, 5, '09:00', '11:00'],
  [3, 2, 5, 6, '09:00', '10:00'],
  [4, 1, 4, 9, '11:00', '12:00'],
  [5, 2, 1, 5, '10:00', '11:00'], // Priya's Monday ten o'clock (O1)
  [6, 3, 2, 6, '13:00', '14:00'],
  [7, 2, 2, 7, '10:00', '11:00'], // booking 7 is in room 2 (O2)
  [8, 1, 5, 5, '11:00', '12:30'], // the next Boardroom booking after nine on Monday (T17)
  [9, 1, 3, 8, '13:30', '14:30'], // overlaps Thursday 14:00-15:00 (T19)
  [10, 3, 1, 7, '15:00', '16:00'],
  [11, 1, 2, 9, '09:00', '10:00'], // Sam's mistaken Friday Boardroom booking (T13)
  [12, 2, 2, 9, '14:00', '15:00'], // Sam's Friday afternoon one, which is fine
  [13, 1, 2, 5, '14:00', '15:00'],
  [14, 1, 4, 8, '15:00', '16:00'], // starts exactly at 15:00 on Thursday: touches, does not overlap
  [15, 3, 5, 8, '10:00', '11:00'],
  [16, 1, 5, 9, '16:00', '17:00'],
  [17, 2, 3, 8, '09:00', '10:00'],
  [18, 3, 4, 9, '10:00', '11:00'],
  [19, 1, 1, 6, '10:00', '11:00'],
  [20, 2, 4, 5, '15:00', '16:00'],
];
const GARDEN = [ // booked after the Garden Room opened (T06)
  [21, 4, 2, 6, '10:00', '11:00'],
  [22, 4, 3, 7, '11:00', '12:00'],
  [23, 4, 2, 8, '15:00', '16:00'],
];
const SHADOW_BASE = [
  [1, 1, 6, 6, '08:00', '09:00'], // a Boardroom booking after nine on Monday with a lower id than the answer
  [2, 1, 4, 5, '08:30', '09:15'],
  [3, 2, 1, 5, '10:00', '11:00'],
  [4, 1, 7, 8, '23:00', '23:30'], // Thursday night, not Friday
  [5, 1, 2, 5, '10:30', '11:00'], // the next Boardroom booking after nine on Monday
  [6, 1, 5, 10, '00:00', '01:00'], // exactly midnight, Saturday: not Friday
  [7, 1, 3, 8, '13:30', '14:15'], // straddles 14:00 on Thursday
  [8, 1, 6, 8, '13:00', '16:00'], // encloses the whole hour
  [9, 1, 2, 8, '12:00', '14:00'], // ends exactly at 14:00: does not overlap
  [10, 1, 7, 8, '15:00', '15:30'], // starts exactly at 15:00: does not overlap
  [11, 1, 4, 9, '08:00', '09:00'],
  [12, 3, 2, 9, '09:00', '10:00'],
  [13, 1, 1, 9, '13:00', '14:00'],
  [14, 2, 2, 7, '09:00', '10:00'],
  [15, 3, 6, 6, '14:00', '15:00'],
  [16, 1, 5, 5, '13:00', '14:00'],
];
const SHADOW_GARDEN = [
  [17, 4, 2, 5, '09:00', '10:00'],
  [18, 4, 6, 6, '11:00', '12:00'],
  [19, 4, 2, 7, '14:00', '15:00'],
];

const ts = (day, hm) => `2026-01-${String(day).padStart(2, '0')}T${hm}:00Z`;
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

/* The rows of the world at a stage, as plain data (the SQL below inserts exactly these). */
export function namedRows({ shadow = false, stage = [] } = {}) {
  const has = (f) => stage.includes(f);
  const rooms = shadow
    ? [[1, 'Boardroom', 12], [2, 'Studio', 7], [3, 'Library', 4]] // the smallest room for five is the Studio here, the Library or the Garden Room for real (T18)
    : [[1, 'Boardroom', has('boardroom10') ? 10 : 8], [2, 'Studio', 4], [3, 'Library', 6]];
  if (has('garden')) rooms.push([4, 'Garden Room', shadow ? 9 : 6]);
  const people = shadow ? SHADOW_PEOPLE : PEOPLE;
  let bookings = shadow ? [...SHADOW_BASE] : [...BASE];
  if (has('garden')) bookings.push(...(shadow ? SHADOW_GARDEN : GARDEN));
  if (!shadow && has('samFridayGone')) bookings = bookings.filter((b) => b[0] !== 11);
  return {
    rooms: rooms.map(([id, name, capacity]) => ({ id, name, capacity })),
    people: people.map(([id, name, role]) => ({ id, name, role })),
    bookings: bookings.map(([id, room_id, person_id, day, a, b]) => ({ id, room_id, person_id, start_at: ts(day, a), end_at: ts(day, b) })),
  };
}

export function namedSeedSql(opts = {}) {
  const { rooms, people, bookings } = namedRows(opts);
  const seq = (t, rows) => `SELECT setval(pg_get_serial_sequence('${t}', 'id'), ${Math.max(1, ...rows.map((r) => r.id))}, ${rows.length > 0});`;
  return [
    `INSERT INTO rooms (id, name, capacity) VALUES ${rooms.map((r) => `(${r.id}, ${q(r.name)}, ${r.capacity})`).join(', ')};`,
    `INSERT INTO people (id, name, role) VALUES ${people.map((p) => `(${p.id}, ${q(p.name)}, ${q(p.role)})`).join(', ')};`,
    `INSERT INTO bookings (id, room_id, person_id, start_at, end_at) VALUES ${bookings.map((b) => `(${b.id}, ${b.room_id}, ${b.person_id}, ${q(b.start_at)}, ${q(b.end_at)})`).join(', ')};`,
    seq('rooms', rooms), seq('people', people), seq('bookings', bookings),
  ].join('\n');
}

/* The product arc (milestone M-B): the shadow of HIS company. His world holds only what he typed (Priya's rooms,
   through his own columns), so its shadow is built from his change log (the same tables, his rules), with his rows
   set aside and these put in through his columns instead: each of his rooms keeps its id and its name (cards ask
   about the Boardroom by name, and a link points at the same id on both worlds), while the seats change, and two
   rooms he does not have are added. The traps the cheats fall into live here: a 7-seater ("more than 7" misses
   it), a Boardroom that does not seat 8 or 10 (a number read off the screen), a room order no sort can fake. */
export const ARC_SHADOW_SEATS = Object.freeze({ boardroom: 12, studio: 7, library: 4, 'garden room': 9 });
export const ARC_SHADOW_EXTRA = Object.freeze([{ name: 'Attic', capacity: 3 }, { name: 'Loft', capacity: 16 }]);
const key = (s) => String(s ?? '').trim().toLowerCase();
export function arcShadowRooms(real = []) {
  const rows = real.map((r) => ({ id: r.id, name: r.name, capacity: ARC_SHADOW_SEATS[key(r.name)] ?? ((Number(r.capacity) || 1) * 3) % 17 + 2 }));
  let next = Math.max(0, ...real.map((r) => Number(r.id) || 0));
  for (const x of ARC_SHADOW_EXTRA) if (!rows.some((r) => key(r.name) === key(x.name))) rows.push({ id: ++next, ...x });
  return rows;
}

/* Milestone M-C: the shadow of HIS people and bookings. His people keep their ids and names (a card asks about Sam
   by name, and his id resolves the same on both worlds); the named shadow's two extra members (Ravi, Mia) get new
   ids. The shadow week (SHADOW_BASE and SHADOW_GARDEN above: the traps T16, T17 and T19's cheats fall into) is put
   in by NAME: each booking's room and person are looked up among the shadow rooms and people, so it points at his
   ids. A booking whose room or person the shadow does not have is left out. */
export function arcShadowPeople(real = []) {
  const named = namedRows({ shadow: true, stage: ['garden'] }).people;
  const rows = real.map((p) => ({ id: p.id, name: p.name, role: named.find((n) => key(n.name) === key(p.name))?.role ?? 'customer' }));
  let next = Math.max(0, ...real.map((p) => Number(p.id) || 0));
  for (const n of named) if (!rows.some((r) => key(r.name) === key(n.name))) rows.push({ id: ++next, name: n.name, role: n.role });
  return rows;
}
export function arcShadowBookings(rooms = [], people = []) {
  const w = namedRows({ shadow: true, stage: ['garden'] });
  const nameOf = (list, id) => list.find((x) => x.id === id)?.name;
  const idOf = (list, name) => list.find((x) => key(x.name) === key(name))?.id;
  const out = [];
  for (const b of w.bookings) {
    const room_id = idOf(rooms, nameOf(w.rooms, b.room_id)), person_id = idOf(people, nameOf(w.people, b.person_id));
    if (room_id != null && person_id != null) out.push({ id: b.id, room_id, person_id, start_at: b.start_at, end_at: b.end_at });
  }
  return out;
}
