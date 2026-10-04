// S3 · Asking the database (product arc, section 1; milestone M-B). The kept on-ramp and SQL foothold cards (O3,
// O4, O5, T01, T02, T03, T04, T08, T10, and T11) run on HIS rooms table (chapter1/*, templated by his column and
// row names); this file holds the one new piece S3 needs: the Garden Room, the "new room" event the design gives
// T06's old content (section 4.1). Priya hands him one more row and HE types it in: a recall of insert, unaided,
// so it can be evidence. It comes after T04 and before T08, where T06 was, so the sorting and comparing cards and
// T11 ("the Garden Room won't take us") have the fourth room they talk about, in his table, put there by him.
import { PRIYA } from '../chapter1/people.js';

export const G1 = {
  id: 'G1', serve: 10, title: 'The Garden Room', act: 1,
  from: PRIYA, says: "We've just fitted out the Garden Room: six seats, by the back door. It isn't on the system yet.",
  kind: 'feature', cause: 'client feature request', grading: 'one-off',
  concept: null, newConcept: 0, teaches: [], uses: ['insert', 'table-row'], needs: ['S2', 'T04'], revisits: ['S2'],
  languages: ['sql'], world: { stage: [], arc: true }, adds: { rooms: ['Garden Room'] },
  learnCard: null,
  workedExample: { lang: 'sql', code: "INSERT INTO fruit (name, colour, price, stock) VALUES ('kiwi', 'green', 0.40, 12);\nSELECT * FROM fruit;", note: 'A sibling on the practice pad: one new fruit, through its columns. The database gives it its id.' },
  hints: ["The room isn't in your table yet.", 'Adding a row (you have done it before, in S2).', 'insert'],
  spells: { teach: [], recall: ['insert'] },
  steps: [{ objective: 'Put the Garden Room (six seats) into your rooms table.', level: 'L3', lang: 'sql', starter: '',
    checks: [
      { kind: 'world', name: 'one Garden Room with six seats', sql: "SELECT count(*) FROM rooms WHERE lower(trim({rooms.name})) = 'garden room' AND {rooms.capacity} = 6", expect: { equals: 1 } },
      { kind: 'world', name: 'exactly one room more (four in all)', sql: 'SELECT count(*) FROM rooms', expect: { equals: 4 } },
      { kind: 'unchanged', name: 'the rooms that were there are as they were', sql: "SELECT id, {rooms.name}, {rooms.capacity} FROM rooms WHERE lower(trim({rooms.name})) <> 'garden room' ORDER BY id" },
    ] }],
  cheats: [
    { name: 'added twice', lang: 'sql', code: "INSERT INTO rooms ({rooms.name}, {rooms.capacity}) VALUES ('Garden Room', 6);\nINSERT INTO rooms ({rooms.name}, {rooms.capacity}) VALUES ('Garden Room', 6);" },
    { name: 'the Studio renamed', lang: 'sql', code: "UPDATE rooms SET {rooms.name} = 'Garden Room', {rooms.capacity} = 6 WHERE {rooms.name} = '{roomName:Studio}';" },
  ],
  reference: [{ step: 0, lang: 'sql', code: "INSERT INTO rooms ({rooms.name}, {rooms.capacity}) VALUES ('Garden Room', 6);" }],
  recap: ['You added a room from memory: the database gave it the next id.', 'The office has a fourth room now, because your table does.'],
  pattern: 'Add rows', evidence: true, timeMinutes: 2,
};
