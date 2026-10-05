// sheet.js: Sam's week of bookings, as it reaches his company (product arc S5-S6, milestone M-C). There is no
// hidden seed: every booking in his database is typed in by a named colleague through a script he can read (S5:
// Priya types her notebook and Sam's paper slips; S6: Tom loads Sam's spreadsheet), and the scripts go through HIS
// tables and columns (arc/scripts.js). This file is the paper and the spreadsheet: plain data.
//
//   WEEK                       Monday 5 to Friday 9 January 2026 (UTC = London time in January)
//   MEMBERS                    [{ name, role }] the people of Priya's notebook and Sam's sheet
//   PAPER                      Priya's 14 lines: her notebook's 12 bookings, then Sam's two paper slips (one says
//                              "room 7": there is no room 7)
//   SHEET                      Sam's spreadsheet: the rest of the week, plus two messy lines (a room called Atrium
//                              that does not exist, and a booking that ends before it starts)
//   CLASH                      the booking Priya makes on T21's morning (Jo, the Boardroom, 08:30-09:30 on Monday)
//   BOOKING_KEYS               the bookings cards talk about, by content: { key: { person, room?, start } }
//                              ({booking:key} in a card resolves to HIS id for that booking, card.js resolveCard)
//   at(day, 'HH:MM')           '2026-01-0D HH:MM+00' (a SQL literal his TIMESTAMPTZ or TIMESTAMP column accepts)
//   iso(day, 'HH:MM')          the same moment as ISO-8601 UTC
//   weekRows()                 every booking line of PAPER, SHEET and CLASH as { key?, who, room, start, end }
//                              (node-tested: none of them clash, except CLASH with Omar's Monday 08:00)
export const WEEK = Object.freeze({ monday: '2026-01-05', friday: '2026-01-09' });
const DAY = { Mon: 5, Tue: 6, Wed: 7, Thu: 8, Fri: 9 };
const d2 = (day) => String(DAY[day] ?? day).padStart(2, '0');
export const at = (day, hm) => `2026-01-${d2(day)} ${hm}+00`;
export const iso = (day, hm) => `2026-01-${d2(day)}T${hm}:00Z`;

export const MEMBERS = Object.freeze([
  { name: 'Priya Shah', role: 'staff' }, { name: 'Sam Fletcher', role: 'customer' }, { name: 'Jo Bell', role: 'customer' },
  { name: 'Omar Haddad', role: 'customer' }, { name: 'Lena Novak', role: 'customer' },
]);

// [who, room (a name, or Priya's number when that is all the paper says), day, from, to, key?]
const line = ([who, room, day, from, to, key]) => Object.freeze({ who, room, day, from, to, ...(key ? { key } : {}) });
export const PAPER = Object.freeze([
  ['Omar Haddad', 'Boardroom', 'Mon', '08:00', '09:00', 'omar-mon-board'],
  ['Jo Bell', 'Library', 'Mon', '09:00', '11:00'],
  ['Lena Novak', 'Studio', 'Tue', '09:00', '10:00'],
  ['Omar Haddad', 'Boardroom', 'Fri', '11:00', '12:00'],
  ['Priya Shah', 'Studio', 'Mon', '10:00', '11:00'],
  ['Sam Fletcher', 'Library', 'Tue', '13:00', '14:00'],
  ['Sam Fletcher', 'Studio', 'Wed', '10:00', '11:00'],
  ['Lena Novak', 'Boardroom', 'Mon', '11:00', '12:30'],
  ['Jo Bell', 'Boardroom', 'Thu', '13:30', '14:30'],
  ['Priya Shah', 'Library', 'Wed', '15:00', '16:00'],
  ['Sam Fletcher', 'Studio', 'Fri', '14:00', '15:00', 'sam-fri-studio'],
  ['Omar Haddad', 'Library', 'Thu', '10:00', '11:00'],
  // Sam's two paper slips
  ['Sam Fletcher', 'Boardroom', 'Fri', '09:00', '10:00', 'sam-fri-board'],
  ['Sam Fletcher', 7, 'Wed', '16:30', '17:30', 'sam-room7'],
].map(line));

export const SHEET = Object.freeze([
  ['Sam Fletcher', 'Boardroom', 'Mon', '14:00', '15:00'],
  ['Omar Haddad', 'Boardroom', 'Thu', '15:00', '16:00'], // starts exactly at three on Thursday: touches T19's hour
  ['Lena Novak', 'Library', 'Tue', '15:00', '16:00'],
  ['Lena Novak', 'Boardroom', 'Fri', '16:00', '17:00'],
  ['Jo Bell', 'Studio', 'Thu', '09:00', '10:00'],
  ['Omar Haddad', 'Library', 'Fri', '10:00', '11:00'],
  ['Priya Shah', 'Boardroom', 'Tue', '10:00', '11:00'],
  ['Omar Haddad', 'Studio', 'Mon', '15:00', '16:00'],
  ['Sam Fletcher', 'Garden Room', 'Tue', '10:00', '11:00'],
  ['Jo Bell', 'Garden Room', 'Wed', '11:00', '12:00'],
  ['Sam Fletcher', 'Garden Room', 'Thu', '15:00', '16:00'],
  ['Omar Haddad', 'Atrium', 'Thu', '09:00', '10:00'], // messy: there is no Atrium
  ['Jo Bell', 'Studio', 'Wed', '17:00', '16:00'], // messy: it ends before it starts (the seed of problem P4)
].map(line));

export const CLASH = line(['Jo Bell', 'Boardroom', 'Mon', '08:30', '09:30', 'jo-clash']);

export const BOOKING_KEYS = Object.freeze(Object.fromEntries([...PAPER, ...SHEET, CLASH].filter((l) => l.key)
  .map((l) => [l.key, Object.freeze({ person: l.who, ...(typeof l.room === 'string' ? { room: l.room } : {}), start: iso(l.day, l.from) })])));

export const weekRows = () => [...PAPER, ...SHEET, CLASH].map((l) => ({ key: l.key, who: l.who, room: l.room, start: iso(l.day, l.from), end: iso(l.day, l.to) }));
