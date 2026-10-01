// The on-ramp O1-O5 (learning design, section 3): what the tools ARE, before any typing from memory.
// None of it counts as evidence; each takes about a minute.
import { PRIYA } from './people.js';

export const O1 = {
  id: 'O1', serve: 1, position: '#1', title: 'The timetable is a table', act: 1,
  from: PRIYA, says: "I've put our first bookings in. Can you find mine? It's the one at ten on Monday.",
  kind: 'onramp', cause: 'report or question', grading: 'interact',
  concept: 'table-row', newConcept: 1, teaches: ['table-row'], uses: [], needs: [], revisits: [],
  languages: ['sql'], world: { stage: [] }, showTimetable: true,
  learnCard: {
    title: 'Tables, rows and columns',
    lines: [
      'Everything the business knows lives in tables.',
      'The timetable you see IS the bookings table: each block is one row.',
      'Each fact about a booking (its room, its person, when it starts and ends) is a column.',
      'Click a block and its row opens, every column labelled.',
    ],
    example: { show: 'pick', id: 1, note: 'Booking 1: the Boardroom at 08:00 on Monday, one row of the bookings table.' },
  },
  workedExample: { show: 'pick', id: 3, note: 'Any block opens as its row: booking 3 is the Studio, Tuesday at nine.' },
  hints: ['Monday is the first column of the timetable.', 'Rows and blocks are the same thing: one booking is one row.', 'table-row'],
  spells: { teach: ['table-row'], recall: [] },
  steps: [{
    objective: "Find Priya's booking: click it on the timetable.", level: 'L0', interaction: 'pick',
    checks: [{ kind: 'pick', name: "Priya's Monday ten o'clock booking is the one picked",
      truth: "SELECT b.id FROM bookings b JOIN people p ON p.id = b.person_id WHERE p.name = 'Priya Shah' AND b.start_at = '2026-01-05 10:00+00'" }],
  }],
  cheats: [{ name: "Priya's other booking (Wednesday)", answer: { picked: 10 } }, { name: 'any Monday ten o\'clock block', answer: { picked: 2 } }],
  reference: [{ step: 0, answer: { picked: 5 } }],
  recap: ["You found one row in a table: Priya's booking, the Studio on Monday at ten.", "Every question you'll answer is 'which rows?' and 'which columns?'."],
  pattern: 'Find by key (preview)', evidence: false, timeMinutes: 1,
};

export const O2 = {
  id: 'O2', serve: 2, position: '#2', title: 'Numbers that point', act: 1,
  from: PRIYA, says: 'Which room is booking 7 in? The table just says 2.',
  kind: 'onramp', cause: 'report or question', grading: 'interact',
  concept: 'id-link', newConcept: 1, teaches: ['id-link'], uses: ['table-row'], needs: ['O1'], revisits: ['O1'],
  languages: ['sql'], world: { stage: [] }, showTimetable: true,
  learnCard: {
    title: 'Ids that point',
    lines: [
      'Every row has an id: its own number, never shared with another row.',
      "In a booking, room_id = 2 means 'the room whose id is 2'.",
      'That room lives in another table, rooms. Follow the number to find its name.',
    ],
    example: { show: 'pick', id: 3, follow: 'person_id', note: "Booking 3's person_id is 5. Follow it: row 5 of people is Lena Novak." },
  },
  workedExample: { show: 'pick', id: 3, follow: 'person_id', note: "Follow booking 3's person_id to the people table." },
  hints: ['The answer is in another table.', 'An id points at a row elsewhere: room_id points at a row of rooms.', 'id-link'],
  spells: { teach: ['id-link'], recall: [] },
  steps: [{
    objective: "Follow booking 7's room_id, and say which room it is.", level: 'L0', interaction: 'choice',
    prompt: 'Which room is booking 7 in?', options: 'SELECT name FROM rooms ORDER BY id',
    checks: [{ kind: 'choice', name: 'the room booking 7 points at',
      truth: 'SELECT r.name FROM bookings b JOIN rooms r ON r.id = b.room_id WHERE b.id = 7' }],
  }],
  cheats: [{ name: 'room 1 (the first room)', answer: { choice: 'Boardroom' } }],
  reference: [{ step: 0, answer: { choice: 'Studio' } }],
  recap: ['You followed an id from one table to another: room_id 2 is the Studio.', 'Later a query will do this for thousands of rows at once.'],
  pattern: 'Look up across two tables (preview)', evidence: false, timeMinutes: 1,
};

export const O3 = {
  id: 'O3', serve: 3, position: '#3', title: 'Asking a question', act: 1,
  from: PRIYA, says: "Clicking is fine for three rooms. What happens when we've a hundred?",
  kind: 'onramp', cause: 'report or question', grading: 'query',
  concept: 'query', newConcept: 1, teaches: ['query'], uses: ['table-row'], needs: ['O1'], revisits: ['O1'],
  languages: ['sql'], world: { stage: [] },
  learnCard: {
    title: 'A query is a question',
    lines: [
      "A query is a question typed in SQL, the database's language.",
      'Running it sends it to the database; the answer comes back as rows.',
      "SELECT * FROM rooms; means 'show every column of every row in rooms'.",
      '* means every column. ; ends the question.',
    ],
    example: { lang: 'sql', code: 'SELECT * FROM people;', note: 'Every person comes back, and the ones in the office light up.' },
  },
  workedExample: { lang: 'sql', code: 'SELECT * FROM people;', note: 'The same kind of question, about people.' },
  hints: ['The Run button is under the editor.', 'A query is a question you run.', 'select-all'],
  spells: { teach: ['select-all'], recall: [] },
  steps: [
    { objective: 'Press Run, and see what comes back.', level: 'L0', lang: 'sql', starter: 'SELECT * FROM rooms;',
      checks: [{ kind: 'rows', name: 'every room came back', truth: 'SELECT * FROM rooms', exactColumns: true }] },
    { objective: 'How many rooms came back?', level: 'L0', interaction: 'choice', prompt: 'How many rooms came back?', input: 'number',
      checks: [{ kind: 'choice', name: 'the number of rooms', truth: 'SELECT count(*) FROM rooms' }] },
  ],
  cheats: [{ name: 'a made-up answer instead of the rooms', step: 0, lang: 'sql', code: "SELECT 'Boardroom';" }, { name: 'a wrong count', step: 1, answer: { choice: '4' } }],
  reference: [{ step: 0, lang: 'sql', code: 'SELECT * FROM rooms;' }, { step: 1, answer: { choice: '3' } }],
  recap: ['You sent a question and got rows back: three rooms.', 'Code only does something when you run it.'],
  evidence: false, timeMinutes: 1,
};

export const O4 = {
  id: 'O4', serve: 4, position: '#4', title: 'Reading an error', act: 1,
  from: PRIYA, says: 'I tried to ask about rooms myself and got a red message. What did I do?',
  kind: 'onramp', cause: "other people's code", grading: 'query',
  concept: 'read-error', newConcept: 1, teaches: ['read-error'], uses: ['query'], needs: ['O3'], revisits: ['O3'],
  languages: ['sql'], world: { stage: [] },
  learnCard: {
    title: 'Errors are help',
    lines: [
      'An error is the computer telling you exactly what it could not understand, and roughly where.',
      'Read three things: what (the message), where (the word near it), and what it expected.',
      'Errors are help, not failure.',
    ],
    example: { lang: 'sql', code: 'SELECT * FORM rooms;', note: 'It says: syntax error at or near "FORM". The word it quotes is the one to fix.' },
  },
  workedExample: { lang: 'sql', code: 'SELECT * FROM rooms;', note: 'FORM fixed to FROM: now it runs.' },
  hints: ['Look at the word the message quotes.', 'The spelling of a keyword.', 'select-all'],
  spells: { teach: [], recall: [] },
  steps: [{ objective: "Read the error and fix Priya's query (change one word).", level: 'L1', lang: 'sql', starter: 'SELEC * FROM rooms;',
    checks: [{ kind: 'rows', name: 'the query runs and returns the rooms', truth: 'SELECT * FROM rooms', exactColumns: true }] }],
  cheats: [{ name: 'a different query that runs', lang: 'sql', code: 'SELECT * FROM people;' }],
  reference: [{ step: 0, lang: 'sql', code: 'SELECT * FROM rooms;' }],
  recap: ['You read an error and fixed the word it pointed at.', 'That habit is half of debugging.'],
  evidence: false, timeMinutes: 1,
};

export const O5 = {
  id: 'O5', serve: 5, position: '#5', title: 'Looking it up', act: 1,
  from: PRIYA, says: "Can the list come out in name order? I don't know if the database can do that.",
  kind: 'onramp', cause: 'client feature request', grading: 'interact',
  concept: 'look-up', newConcept: 1, teaches: ['look-up'], uses: ['query'], needs: ['O3'], revisits: ['O3'],
  languages: ['sql'], world: { stage: [] },
  learnCard: {
    title: 'Look it up',
    lines: [
      "Nobody remembers everything. The Grimoire holds every spell you've met, and lists the ones you haven't found yet.",
      "Look it up by what you want to do, in your own words: 'sort', 'count', 'only some'.",
      'Each entry has a small example you can run on the office.',
    ],
    example: { show: 'lookup', search: 'first', spell: 'limit', note: 'Search "first", open "Only the first few", and press its Run.' },
  },
  workedExample: { show: 'lookup', search: 'first', spell: 'limit', note: 'Search "first", open "Only the first few", and press its Run.' },
  hints: ['Search for what you want to do, in your own words.', "Looking things up: the Grimoire's search.", 'order-by'],
  spells: { teach: [], recall: [] },
  steps: [{ objective: 'Look up how to sort, and run its example.', level: 'L0', interaction: 'lookup',
    checks: [{ kind: 'lookup', name: 'the sorting entry was found and its example run', spell: 'order-by' }] }],
  cheats: [{ name: 'running a different entry', answer: { lookup: 'limit' } }],
  reference: [{ step: 0, answer: { lookup: 'order-by' } }],
  recap: ['You looked something up by what you wanted to do.', "Later you'll look things up after trying from memory first, which is how they stick."],
  evidence: false, timeMinutes: 1,
};
