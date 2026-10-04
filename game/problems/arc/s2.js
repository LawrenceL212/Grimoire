// S2 · The three rooms (product arc, section 1): Priya's rooms go into HIS rooms table, through his columns.
// INSERT's first meeting moves here (T06 is retired). The truth is the notebook (Boardroom 8, Studio 4,
// Library 12), compared by name (trimmed, any case) and seats; the count must be exactly hers, so running the
// insert twice fails in Priya's words. Fixing it is his: DELETE (a free look-up) or Reset to the stage start.
import { PRIYA } from '../chapter1/people.js';
import { NOTEBOOK_ROOMS } from './notebook.js';

const SHIFTS = "CREATE TABLE shifts (id SERIAL PRIMARY KEY, day TEXT, hours INTEGER);\nINSERT INTO shifts (day, hours) VALUES ('Monday', 6), ('Friday', 8);";

export const S2 = {
  id: 'S2', serve: 4, title: 'The three rooms', act: 1, stage: 'S2',
  from: PRIYA, says: 'The cabinet is there, but it is empty. Put my three rooms in: Boardroom 8, Studio 4, Library 12.',
  kind: 'feature', cause: 'client feature request', grading: 'one-off',
  concept: 'insert', newConcept: 1, teaches: ['insert'], uses: ['table-row', 'create-table'], needs: ['S1'], revisits: ['S1', 'O2'],
  languages: ['sql'], world: { stage: [], arc: true }, showNotebook: 'rooms', adds: { rooms: ['Boardroom', 'Studio', 'Library'] },
  acceptance: [
    "Your rooms table holds exactly Priya's rooms: one row each for the Boardroom, the Studio and the Library.",
    'Each with the seats in her notebook (8, 4 and 12). Names are compared without caring about capitals or spaces at the ends.',
  ],
  learnCard: {
    title: 'Adding rows',
    lines: [
      'INSERT INTO adds new rows to a table.',
      'The first brackets list the columns; VALUES gives what goes in them, in the same order.',
      'Several rows can go in at once: (..), (..), separated by commas.',
      "You don't give an id: the database gives each new row the next number.",
    ],
    example: { lang: 'sql', code: SHIFTS, note: "On the practice pad: a shifts table, then two shifts in it. Your company's database is not touched." },
  },
  workedExample: { lang: 'sql', code: SHIFTS, note: 'Two rows in one INSERT: the columns once, then one bracket of values per row.' },
  hints: ['Three rooms in the notebook: three rows.', 'insert: the columns in brackets, then VALUES, one bracket per row.', 'insert'],
  spells: { teach: ['insert'], recall: [] },
  steps: [{
    objective: "Put Priya's three rooms into your rooms table.", level: 'L3', lang: 'sql', starter: '',
    checks: [
      { kind: 'schema', name: 'the rooms table is still there', table: 'rooms', roles: 'room' },
      { kind: 'probe', name: "exactly Priya's three rooms, with their seats", table: 'rooms', roles: 'room',
        steps: [{ query: 'SELECT {name} AS name, {capacity} AS capacity FROM {table}', equal: NOTEBOOK_ROOMS, key: 'name',
          why: "the rooms are not Priya's", whyCount: 'Priya counts {n} rooms in the table; she has {want}', whyMissing: '{key} is not in the table (or is spelt differently)', whyValue: 'the {key} has {got} seats in the table; the notebook says {want}' }] },
    ],
  }],
  cheats: [
    { name: 'the rooms put in twice', lang: 'sql', code: "INSERT INTO rooms (name, capacity) VALUES ('Boardroom', 8), ('Studio', 4), ('Library', 12);\nINSERT INTO rooms (name, capacity) VALUES ('Boardroom', 8), ('Studio', 4), ('Library', 12);" },
    { name: 'only two rooms', lang: 'sql', code: "INSERT INTO rooms (name, capacity) VALUES ('Boardroom', 8), ('Studio', 4);" },
    { name: "the Library's seats mistyped", lang: 'sql', code: "INSERT INTO rooms (name, capacity) VALUES ('Boardroom', 8), ('Studio', 4), ('Library', 21);" },
  ],
  reference: [{ step: 0, lang: 'sql', code: "INSERT INTO rooms (name, capacity) VALUES ('Boardroom', 8), ('Studio', 4), ('Library', 12);" }],
  recap: ["You added rows through your own columns: the database gave each room its id.", 'The office now has as many rooms as your table, and no more.'],
  pattern: 'Add rows', evidence: true, timeMinutes: 8,
};
