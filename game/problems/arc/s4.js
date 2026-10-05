// S4 · People and bookings (product arc, section 1; milestone M-C). Sam's members and their bookings need a place:
// HIS people and bookings tables, from a blank editor. people is a recall of create-table (S1), unaided, so it can be
// evidence; the one new idea is the timestamp type: a moment stored as a moment, not as words. The acceptance reads
// the catalogue (the house names: an id key, room_id, person_id, start_at, end_at) and then PROBES behaviour inside
// a rolled-back transaction: a test room, a test person, and two bookings (9:00-10:00 and 10:00-11:00) through his
// columns; "the bookings that start before 10:30" must be both, and each must last one hour. Times kept as TEXT
// fail ('10:00' sorts before '9:00' as words, and words cannot be subtracted); a DATE fails (no time of day);
// TIMESTAMP without a zone passes and is recorded (it is the seed of problem P12). REFERENCES now is his choice:
// with it, S5 arrives as its friendlier twin.
import { PRIYA } from '../chapter1/people.js';

const PEOPLE = { kind: 'schema', name: 'a people table: a key called id, and a column for the name', table: 'people', roles: 'person' };
const BOOKINGS = { kind: 'schema', name: 'a bookings table: id, room_id, person_id, start_at, end_at', table: 'bookings', roles: 'booking' };
const MON = (hm) => `2026-01-05 ${hm}`;
const TWO = {
  kind: 'probe', name: "times work as times: 9:00 comes before 10:30, and 9:00 to 10:00 is one hour", table: 'bookings', roles: 'booking', empty: true,
  steps: [
    { into: 'rooms', roles: 'room', as: 'room', insert: [{ name: 'Test room', capacity: 4 }], tried: 'save a test room in your rooms table', why: 'a test room could not be saved' },
    { into: 'people', roles: 'person', as: 'person', insert: [{ name: 'Test Person' }], tried: 'save a test person (just a name) in your people table', why: 'a test person could not be saved' },
    { insert: [{ room_id: '@room', person_id: '@person', start_at: MON('9:00'), end_at: MON('10:00') }, { room_id: '@room', person_id: '@person', start_at: MON('10:00'), end_at: MON('11:00') }],
      tried: 'save two test bookings for that room and person (Monday 9:00-10:00 and 10:00-11:00)', why: 'two test bookings could not be saved' },
    { query: `SELECT count(*)::int AS n FROM {table} WHERE {start_at} < '${MON('10:30')}'`, values: { n: [2] },
      why: 'asked for the bookings that start before 10:30 (one at 9:00, one at 10:00), it did not find both: ten o\'clock came before nine, so the times are kept as words, not as moments',
      whyError: 'asked for the bookings that start before 10:30, your table could not compare its start times with a moment',
      whyByType: { role: 'start_at', date: 'asked for the bookings that start before 10:30 (one at 9:00, one at 10:00), it did not find both: a DATE keeps only the day, so the time of day is lost' } },
    { query: "SELECT ({end_at} - {start_at}) = interval '1 hour' AS one_hour FROM {table}", values: { one_hour: [true, true] },
      why: 'a booking from 9:00 to 10:00 did not come out one hour long (end minus start): the time of day is not being kept',
      whyError: 'asked how long a 9:00 to 10:00 booking lasts (end minus start), your table could not say: words cannot be subtracted, moments can' },
  ],
};
const EXAMPLE = "CREATE TABLE shifts_worked (\n  id SERIAL PRIMARY KEY,\n  started_at TIMESTAMPTZ,\n  ended_at TIMESTAMPTZ\n);\nINSERT INTO shifts_worked (started_at, ended_at) VALUES ('2026-01-05 9:00', '2026-01-05 17:30');\nSELECT ended_at - started_at AS worked FROM shifts_worked;";
const LEARN = "SELECT TIMESTAMPTZ '2026-01-05 17:30' - TIMESTAMPTZ '2026-01-05 9:00' AS worked,\n       '10:00' < '9:00' AS as_words_ten_comes_first;";
const REFERENCE = 'CREATE TABLE people (\n  id SERIAL PRIMARY KEY,\n  name TEXT NOT NULL\n);\nCREATE TABLE bookings (\n  id SERIAL PRIMARY KEY,\n  room_id INTEGER NOT NULL,\n  person_id INTEGER NOT NULL,\n  start_at TIMESTAMPTZ NOT NULL,\n  end_at TIMESTAMPTZ NOT NULL\n);';

export const S4 = {
  id: 'S4', serve: 16, title: 'People and bookings', act: 1, stage: 'S4',
  from: PRIYA, says: "Sam sent his members' names and this week's bookings. We need to keep who booked which room, from when to when. Paper can't tell me which booking is first on Monday.",
  kind: 'feature', cause: 'client feature request', grading: 'one-off',
  concept: 'timestamp-type', newConcept: 1, teaches: ['timestamp-type'], uses: ['create-table', 'id-link', 'table-row'], needs: ['S1', 'O2'], revisits: ['S1', 'O2'],
  languages: ['sql'], world: { stage: [], arc: true }, creates: ['people', 'bookings'],
  convention: 'House convention (Priya, as at S1): tables are plural and snake_case, every table has an id key, a link is named <thing>_id (room_id, person_id), times are start_at and end_at. Types, extra columns and rules are your decision.',
  acceptance: [
    'Your company has a people table (an id key and a name) and a bookings table (id, room_id, person_id, start_at, end_at).',
    'A booking from 9:00 to 10:00 and one from 10:00 to 11:00 on Monday can be saved; asked which start before 10:30, the table gives both.',
    'Each of those lasts exactly one hour when you take its start from its end.',
    'Checked by trying it: a test room, person and two bookings go in inside a transaction that is undone, so nothing of yours changes.',
  ],
  learnCard: {
    title: 'A moment is one value',
    lines: [
      'Store the moment, not the words: TIMESTAMPTZ keeps a date and a time of day together, as one value.',
      "A timestamp can be compared, sorted and subtracted: 9:00 comes before 10:00, and 10:00 minus 9:00 is one hour. As words, '10:00' sorts before '9:00'.",
      'TIMESTAMPTZ (with time zone) stores the exact moment; plain TIMESTAMP keeps only the clock reading, not whose clock.',
      "A link column is a whole number that keeps the other row's id: room_id, person_id.",
    ],
    example: { lang: 'sql', code: LEARN, note: "On Sequel's practice pad: two moments subtracted give 8 hours 30 minutes; the same times as words put ten o'clock first." },
  },
  workedExample: { lang: 'sql', code: EXAMPLE, note: 'A table with two moments in it: TIMESTAMPTZ for each, and the length worked out by subtracting. Same idea, different data.' },
  hints: ['Which booking is first on Monday? Your table must be able to tell, and say how long each one is.', 'timestamp-type: a moment kept as TIMESTAMPTZ, not as TEXT.', 'timestamp-type'],
  spells: { teach: ['timestamp-type'], recall: ['create-table'] },
  steps: [{ objective: "Make the people table and the bookings table in your company's database.", level: 'L3', lang: 'sql', starter: '',
    checks: [PEOPLE, BOOKINGS, TWO] }],
  cheats: [
    { name: 'the times kept as words (start_at TEXT)', lang: 'sql', code: 'CREATE TABLE people (id SERIAL PRIMARY KEY, name TEXT);\nCREATE TABLE bookings (id SERIAL PRIMARY KEY, room_id INTEGER, person_id INTEGER, start_at TEXT, end_at TEXT);' },
    { name: 'only the day (start_at DATE)', lang: 'sql', code: 'CREATE TABLE people (id SERIAL PRIMARY KEY, name TEXT);\nCREATE TABLE bookings (id SERIAL PRIMARY KEY, room_id INTEGER, person_id INTEGER, start_at DATE, end_at DATE);' },
    { name: 'the links named in his own way (room, who)', lang: 'sql', code: 'CREATE TABLE people (id SERIAL PRIMARY KEY, name TEXT);\nCREATE TABLE bookings (id SERIAL PRIMARY KEY, room INTEGER, who INTEGER, start_at TIMESTAMPTZ, end_at TIMESTAMPTZ);' },
    { name: 'no people table', lang: 'sql', code: 'CREATE TABLE bookings (id SERIAL PRIMARY KEY, room_id INTEGER, person_id INTEGER, start_at TIMESTAMPTZ, end_at TIMESTAMPTZ);' },
  ],
  reference: [{ step: 0, lang: 'sql', code: REFERENCE }],
  recap: ['You made two tables from memory, and kept times as moments: TIMESTAMPTZ.', 'Moments compare, sort and subtract as times; words would put ten o\'clock before nine.'],
  pattern: 'Store the moment, show the local time', evidence: true, timeMinutes: 15,
};
