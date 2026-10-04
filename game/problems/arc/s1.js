// S1 · Somewhere to keep the rooms (product arc, section 1): the company's first table, and SQL's first meeting.
// Step by step (the first SQL stage keeps its scaffold): a one-word change and a one-line change on Sequel's
// practice pad (nothing there is kept), then the real table, from a blank editor, in the company database. The
// goal and the acceptance are shown, never the table: any table that does the job passes (extra columns,
// VARCHAR or TEXT, SERIAL or IDENTITY, NOT NULL or not). The acceptance reads the catalogue and then PROBES the
// table's behaviour inside a rolled-back transaction, so a table that only looks right fails.
import { PRIYA } from '../chapter1/people.js';

const SCHEMA = { kind: 'schema', name: 'a rooms table, a key called id, a column for the name and one for the seats', table: 'rooms', roles: 'room' };
const BOARDROOM = {
  kind: 'probe', name: "Priya's Boardroom (8 seats) can be kept and read back", table: 'rooms', roles: 'room', empty: true,
  steps: [
    { insert: [{ name: 'Boardroom', capacity: 8 }], why: "the Boardroom with 8 seats could not be saved" },
    { query: 'SELECT {name} AS name, {capacity} AS capacity FROM {table}', equal: [{ name: 'Boardroom', capacity: 8 }], why: 'the Boardroom did not come back as it went in' },
  ],
};
const SEVEN = {
  kind: 'probe', name: "Sam's question works: rooms seating at least 7", table: 'rooms', roles: 'room', empty: true,
  steps: [
    { insert: [{ name: 'A', capacity: '10' }, { name: 'B', capacity: '8' }, { name: 'C', capacity: '6' }], why: 'three test rooms (10, 8 and 6 seats) could not be saved' },
    { query: "SELECT {name} AS name FROM {table} WHERE {capacity} >= '7'", values: { name: ['A', 'B'] }, why: 'asked for the rooms seating at least 7 (of 10, 8 and 6), it gave the wrong ones: 10 was treated as words, not a number' },
  ],
};
const SHIFTS = 'CREATE TABLE shifts (id SERIAL PRIMARY KEY, day TEXT, hours INTEGER);';

export const S1 = {
  id: 'S1', serve: 3, title: 'Somewhere to keep the rooms', act: 1, stage: 'S1',
  from: PRIYA, says: "Sam's first question will be 'which rooms have you got, and how many people fit?'. Paper can't answer him at midnight. Make a place for that.",
  kind: 'feature', cause: 'client feature request', grading: 'one-off',
  concept: 'create-table', newConcept: 1, teaches: ['create-table'], uses: ['table-row'], needs: ['O1', 'O2'], revisits: ['O1'],
  languages: ['sql'], world: { stage: [], arc: true }, creates: ['rooms'], showNotebook: 'rooms',
  convention: 'House convention (Priya, once): tables are plural and snake_case, every table has an id key, a link is named <thing>_id, times are start_at and end_at. Everything else is your decision.',
  acceptance: [
    'The company database has a table called rooms, with a key column called id.',
    "Priya's Boardroom (8 seats) can be saved in it and read back.",
    "Sam's question works: asked for the rooms seating at least 7, of rooms with 10, 8 and 6 seats, it gives the 10 and the 8.",
    'Checked by trying it: test rooms go in inside a transaction that is undone, so nothing of yours changes.',
  ],
  learnCard: {
    title: 'A table is declared before it holds anything',
    lines: [
      'CREATE TABLE gives a table its name, then its columns in brackets, separated by commas.',
      "A column's TYPE decides what it will accept: TEXT for words, INTEGER for whole numbers.",
      'SERIAL PRIMARY KEY gives every row its own number, the id, without you typing it.',
      'The example makes a table for shifts on the practice pad (nothing there is kept).',
    ],
    example: { lang: 'sql', code: SHIFTS, note: "Sequel's practice pad now has an empty shifts table: a day in words, the hours as a whole number." },
  },
  workedExample: { lang: 'sql', code: SHIFTS, note: 'A table for waiting shifts: a name, then each column with its type. Same shape, different data.' },
  hints: ['Sam asks two things about each room.', 'create-table: a name for the table, then a name and a type for each column.', 'create-table'],
  spells: { teach: ['create-table'], recall: [] },
  steps: [
    { objective: "On Sequel's practice pad: change one word so the table is called rooms, and run it.", level: 'L1', lang: 'sql', on: 'pad', starter: SHIFTS,
      checks: [{ kind: 'schema', name: 'the pad has a rooms table with an id key', table: 'rooms', roles: 'room' }] },
    { objective: "Still on the pad: fill in the two columns Sam asks about, a room's name and how many people fit.", level: 'L2', lang: 'sql', on: 'pad',
      starter: 'CREATE TABLE rooms (\n  id SERIAL PRIMARY KEY\n  -- a comma, then the name column and its type; a comma, then the seats column and its type\n);',
      checks: [SCHEMA, BOARDROOM, SEVEN] },
    { objective: "Now for real: make the rooms table in the company's database, from a blank editor.", level: 'L3', lang: 'sql', starter: '',
      checks: [SCHEMA, BOARDROOM, SEVEN] },
  ],
  cheats: [
    { name: 'the seats kept as words (capacity TEXT)', step: 2, lang: 'sql', code: 'CREATE TABLE rooms (id SERIAL PRIMARY KEY, name TEXT, capacity TEXT);' },
    { name: 'no key column', step: 2, lang: 'sql', code: 'CREATE TABLE rooms (name TEXT, capacity INTEGER);' },
    { name: 'the practice table, unchanged', step: 0, lang: 'sql', code: SHIFTS },
  ],
  reference: [
    { step: 0, lang: 'sql', code: 'CREATE TABLE rooms (id SERIAL PRIMARY KEY, day TEXT, hours INTEGER);' },
    { step: 1, lang: 'sql', code: 'CREATE TABLE rooms (\n  id SERIAL PRIMARY KEY,\n  name TEXT,\n  capacity INTEGER\n);' },
    { step: 2, lang: 'sql', code: 'CREATE TABLE rooms (\n  id SERIAL PRIMARY KEY,\n  name TEXT NOT NULL,\n  capacity INTEGER NOT NULL\n);' },
  ],
  recap: ['You declared a table: its name, then each column with a type.', 'The type made 10 a number, so "at least 7" means what Sam means.'],
  pattern: 'Declare before you store', evidence: false, timeMinutes: 12,
};
