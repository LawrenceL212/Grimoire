// S6 · Sam's spreadsheet (product arc, section 1; milestone M-C). When the ticket first arrives Tom runs his import
// (arc/scripts.js 'import': other people's code, visible, one INSERT per line of Sam's sheet) through HIS tables,
// so the rest of the week is in his company: no hidden seed. His rules decide what goes in, and the import log says
// so line by line (a booking that ends before it starts goes in unless he has a CHECK: the seed of problem P4; a
// line for the Atrium is skipped, because Tom's script looks rooms up by name). No new idea: he checks the import
// with a query (recall of WHERE, by his own Garden Room's id; checked on his shadow too), then reads Tom's code and
// log to answer what happened to the line that never went in. After it the kept cards T13-T21 run on this data.
import { TOM } from '../chapter1/people.js';

export const S6 = {
  id: 'S6', serve: 18, title: "Sam's spreadsheet", act: 1, stage: 'S6',
  from: TOM, says: "Sam emailed his spreadsheet of this week's bookings, so I wrote a script to load it through your tables (it's below, with its log). Can you check it went in? Sam's worried about the Garden Room.",
  kind: 'question', cause: "other people's code", grading: 'query', arrives: 'import',
  concept: null, newConcept: 0, teaches: [], uses: ['where', 'write-query', 'investigate'], needs: ['S5', 'T11', 'G1'], revisits: ['T03', 'T11'],
  languages: ['sql'], world: { stage: [], arc: true },
  acceptance: [
    "Your query lists exactly the bookings now in the Garden Room (checked on your company and on a second week of data).",
    "You read Tom's script and its log, and say what happened to the line that never went in.",
  ],
  learnCard: null,
  workedExample: { lang: 'sql', code: 'SELECT * FROM bookings WHERE room_id = {room:Studio};', on: 'company', note: 'A sibling, read only: every booking in your Studio, by its id.' },
  hints: ["Which room id is the Garden Room in your rooms table?", 'Choosing rows (where) by the room a booking points at.', 'where'],
  spells: { teach: [], recall: ['where', 'select-all'] },
  steps: [
    { objective: 'List every booking that is now in the Garden Room.', level: 'L3', lang: 'sql', starter: '',
      checks: [{ kind: 'rows', name: 'every Garden Room booking, and nothing else', truth: 'SELECT * FROM bookings WHERE room_id = {room:Garden Room}', columns: ['id'] }] },
    { objective: "Read Tom's script and its log. One line of Sam's sheet never went in: why?", level: 'L3', interaction: 'reply', prompt: 'What do you tell Tom?',
      options: [
        { id: 'atrium', text: 'The Atrium line was skipped: your script only books a room it finds by name, and there is no Atrium in our rooms table. Ask Sam which room he meant.' },
        { id: 'fk', text: 'The database refused it with an error, so the import is broken.' },
        { id: 'lost', text: 'Your script loses a line at random. Run it again.' },
      ],
      checks: [{ kind: 'reply', name: 'the reply names the true cause', answer: 'atrium' }] },
  ],
  cheats: [
    { name: 'every booking, not just the Garden Room', step: 0, lang: 'sql', code: 'SELECT * FROM bookings;' },
    { name: "Sam's bookings instead of the Garden Room's", step: 0, lang: 'sql', code: 'SELECT * FROM bookings WHERE person_id = {person:Sam Fletcher};' },
    { name: 'blaming the database', step: 1, answer: { reply: 'fk' } },
  ],
  reference: [{ step: 0, lang: 'sql', code: 'SELECT * FROM bookings WHERE room_id = {room:Garden Room};' }, { step: 1, answer: { reply: 'atrium' } }],
  recap: ["You checked someone else's import with your own query, and read their code to explain the line that never went in.", 'Every booking in your company came through a script you can read: nothing is invented.'],
  pattern: 'Investigate before you change', evidence: true, timeMinutes: 6,
};
