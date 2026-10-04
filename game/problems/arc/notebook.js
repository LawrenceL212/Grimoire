// notebook.js: Priya's paper notebook, the whole business on Day 0 (product arc, S0). It is not a database: it is
// the paper the learner's database replaces, so it lives here as plain data and is drawn as a grid
// (play/notebook.js). Two pages: the rooms, numbered by Priya, and the bookings, which point at a room by its
// number ("room 2"). Cards take their truths from it by CONTENT (a row is found by what it says, never by where it
// sits on the page): the grid can be re-sorted, so picking "the fifth line" is not knowing which line.
//
//   NOTEBOOK                       { pages: { rooms, bookings } }, each { title, columns: [{ id, label }], rows, sorts }
//   noteRowKey(page, where)        the key of the one row whose fields equal `where` (null if none or several)
//   noteValue({ page, where, col }) that row's value in col
//   sortedRows(page, sort)         the rows in the order shown (sort: a column id, or null for as written)
//   NOTEBOOK_ROOMS                 [{ name, capacity }] the rooms as Priya wrote them (S2's truth)
const ROOMS = [
  { key: 1, no: 1, name: 'Boardroom', seats: 8 },
  { key: 2, no: 2, name: 'Studio', seats: 4 },
  { key: 3, no: 3, name: 'Library', seats: 12 },
];
// [line, who, room number, day, from, to] in the order Priya wrote them
const LINES = [
  [1, 'Omar Haddad', 1, 'Mon', '08:00', '09:00'],
  [2, 'Jo Bell', 3, 'Mon', '09:00', '11:00'],
  [3, 'Lena Novak', 2, 'Tue', '09:00', '10:00'],
  [4, 'Omar Haddad', 1, 'Fri', '11:00', '12:00'],
  [5, 'Priya Shah', 2, 'Mon', '10:00', '11:00'], // Priya's own, Monday at ten (O1)
  [6, 'Sam Fletcher', 3, 'Tue', '13:00', '14:00'],
  [7, 'Sam Fletcher', 2, 'Wed', '10:00', '11:00'], // "room 2" (O2)
  [8, 'Lena Novak', 1, 'Mon', '11:00', '12:30'],
  [9, 'Jo Bell', 1, 'Thu', '13:30', '14:30'],
  [10, 'Priya Shah', 3, 'Wed', '15:00', '16:00'], // Priya's other one
  [11, 'Sam Fletcher', 2, 'Fri', '14:00', '15:00'],
  [12, 'Omar Haddad', 3, 'Thu', '10:00', '11:00'],
];
export const NOTEBOOK = Object.freeze({
  owner: 'Priya Shah',
  pages: {
    rooms: {
      title: 'Rooms', columns: [{ id: 'no', label: 'No.' }, { id: 'name', label: 'Room' }, { id: 'seats', label: 'Seats' }],
      rows: ROOMS, sorts: [{ col: 'seats', label: 'Sort by seats' }],
    },
    bookings: {
      title: 'Bookings', columns: [{ id: 'line', label: '#' }, { id: 'who', label: 'Who' }, { id: 'room', label: 'Room' }, { id: 'day', label: 'Day' }, { id: 'from', label: 'From' }, { id: 'to', label: 'To' }],
      rows: LINES.map(([line, who, room, day, from, to]) => ({ key: line, line, who, room, day, from, to })),
      sorts: [{ col: 'who', label: 'Sort by name' }],
    },
  },
});
export const NOTEBOOK_ROOMS = Object.freeze(ROOMS.map((r) => ({ name: r.name, capacity: r.seats })));

export function noteRowKey(page, where = {}) {
  const rows = NOTEBOOK.pages[page]?.rows || [];
  const hits = rows.filter((r) => Object.entries(where).every(([k, v]) => String(r[k]) === String(v)));
  return hits.length === 1 ? hits[0].key : null;
}
export function noteValue({ page, where, col }) {
  const key = noteRowKey(page, where);
  const row = NOTEBOOK.pages[page]?.rows.find((r) => r.key === key);
  return row ? row[col] : null;
}
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export function sortedRows(page, sort = null) {
  const rows = [...(NOTEBOOK.pages[page]?.rows || [])];
  if (!sort) return rows;
  const key = (r) => (sort === 'day' ? DAYS.indexOf(r.day) : r[sort]);
  return rows.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) || a.key - b.key; });
}
