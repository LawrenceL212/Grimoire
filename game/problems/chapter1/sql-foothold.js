// The SQL foothold T01-T17 (learning design, section 8, #6-#17), each climbing the learn loop: understand
// (Learn card and a live demo), watch (L0), change one token (L1), change one line (L2), then a blank editor.
import { PRIYA, SAM, ALL_STAGES } from './people.js';

const ROOMS_BUT = (name) => `SELECT id, name, capacity FROM rooms WHERE name <> '${name}' ORDER BY id`;

export const T01 = {
  id: 'T01', serve: 6, position: '#6', title: 'The whole rooms list', act: 1,
  from: PRIYA, says: "Now I've put the rooms in, can you show me the whole rooms list yourself?",
  kind: 'question', cause: 'report or question', grading: 'query',
  concept: 'write-query', newConcept: 1, teaches: ['write-query'], uses: ['query', 'table-row'], needs: ['O3'], revisits: ['O3'],
  languages: ['sql'], world: { stage: [] },
  learnCard: {
    title: 'Your first query',
    lines: [
      'You can write a whole query yourself: SELECT * FROM, a table\'s name, then ;.',
      'SELECT says what to show; FROM says where from.',
      'The tables here are rooms, people and bookings.',
    ],
    example: { lang: 'sql', code: 'SELECT * FROM people;', note: 'The people table: everyone the business knows.' },
  },
  workedExample: { lang: 'sql', code: 'SELECT * FROM people;', note: 'A whole table, asked for by name.' },
  hints: ['Which table holds what Priya wants?', 'Reading a whole table: SELECT * FROM a table.', 'select-all'],
  spells: { teach: ['select-all'], recall: [] },
  steps: [
    { objective: 'Run it, and watch the people light up.', level: 'L0', lang: 'sql', starter: 'SELECT * FROM people;',
      checks: [{ kind: 'rows', name: 'everyone came back', truth: 'SELECT * FROM people', exactColumns: true }] },
    { objective: 'Change one word so it shows the rooms.', level: 'L1', lang: 'sql', starter: 'SELECT * FROM people;',
      checks: [{ kind: 'rows', name: 'every room came back', truth: 'SELECT * FROM rooms', exactColumns: true }] },
    { objective: 'Priya: "And the bookings?" Type the whole query for the bookings.', level: 'L2', lang: 'sql', starter: '',
      checks: [{ kind: 'rows', name: 'every booking came back', truth: 'SELECT * FROM bookings', exactColumns: true }] },
  ],
  cheats: [{ name: 'a made-up answer', step: 2, lang: 'sql', code: "SELECT 'Boardroom';" }, { name: 'the wrong table', step: 1, lang: 'sql', code: 'SELECT * FROM people;' }],
  reference: [{ step: 0, lang: 'sql', code: 'SELECT * FROM people;' }, { step: 1, lang: 'sql', code: 'SELECT * FROM rooms;' }, { step: 2, lang: 'sql', code: 'SELECT * FROM bookings;' }],
  recap: ['You asked the database for whole tables yourself.', 'SELECT says what, FROM says where.'],
  evidence: false, timeMinutes: 2,
};

export const T02 = {
  id: 'T02', serve: 7, position: '#7', title: 'Only what the website needs', act: 1,
  from: PRIYA, says: "For the website I only want each room's name and how many it seats. Nothing else, it looks messy.",
  kind: 'question', cause: 'client feature request', grading: 'query',
  concept: 'select-columns', newConcept: 1, teaches: ['select-columns'], uses: ['write-query'], needs: ['T01'], revisits: ['T01'],
  languages: ['sql'], world: { stage: [] },
  learnCard: {
    title: 'Choosing columns',
    lines: ['Instead of *, list the columns you want.', 'A comma separates them: id, name.', 'The rows stay the same; only the columns change.'],
    example: { lang: 'sql', code: 'SELECT id, name FROM rooms;', note: 'Every room, two columns each.' },
  },
  workedExample: { lang: 'sql', code: 'SELECT name, role FROM people;', note: 'A sibling: two columns of people.' },
  hints: ['The website wants two things about each room.', 'Choosing columns.', 'select-columns'],
  spells: { teach: ['select-columns'], recall: [] },
  steps: [{ objective: 'Show only room names and seats.', level: 'L1', lang: 'sql', starter: 'SELECT * FROM rooms;',
    checks: [{ kind: 'rows', name: 'every room, with just its name and seats', truth: 'SELECT name, capacity FROM rooms', exactColumns: true }] }],
  cheats: [{ name: 'every column (the messy list)', lang: 'sql', code: 'SELECT * FROM rooms;' }],
  reference: [{ step: 0, lang: 'sql', code: 'SELECT name, capacity FROM rooms;' }],
  recap: ['You chose columns instead of taking them all.', 'A comma separates the columns you want.'],
  evidence: true, timeMinutes: 1,
};

export const T03 = {
  id: 'T03', serve: 8, position: '#8', title: 'The Boardroom on the phone', act: 1,
  from: PRIYA, says: "How many does the Boardroom seat again? I've a client on the phone.",
  kind: 'question', cause: 'report or question', grading: 'query',
  concept: 'where', newConcept: 1, teaches: ['where'], uses: ['select-columns'], needs: ['T02'], revisits: ['T02', 'O4'],
  languages: ['sql'], world: { stage: [] },
  learnCard: {
    title: 'Choosing rows',
    lines: ['WHERE keeps only the rows that match.', "Text goes in single quotes: 'Studio'.", "Here = means 'is equal to': it compares."],
    example: { lang: 'sql', code: "SELECT * FROM rooms WHERE name = 'Studio';", note: 'Only the Studio comes back.' },
  },
  workedExample: { lang: 'sql', code: "SELECT role FROM people WHERE name = 'Jo Bell';", note: 'A sibling: one fact about one person.' },
  hints: ['You only want one room.', 'Filtering rows.', 'where'],
  spells: { teach: ['where'], recall: [] },
  steps: [{ objective: "Find the Boardroom's seats.", level: 'L2', lang: 'sql', starter: 'SELECT capacity FROM rooms',
    checks: [{ kind: 'value', name: "the Boardroom's seats", truth: "SELECT capacity FROM rooms WHERE name = 'Boardroom'" }] }],
  cheats: [{ name: 'the number read off the screen', lang: 'sql', code: 'SELECT 8;' }],
  reference: [{ step: 0, lang: 'sql', code: "SELECT capacity FROM rooms WHERE name = 'Boardroom';" }],
  recap: ['You picked one row by a fact about it.', "WHERE name = 'Boardroom' kept only that row."],
  pattern: 'Find by key', evidence: true, timeMinutes: 2,
};

export const T04 = {
  id: 'T04', serve: 9, position: '#9', title: 'Ten, not eight', act: 1,
  from: PRIYA, says: 'I got the Boardroom wrong. It seats ten, not eight. Can you put it right?',
  kind: 'bug', cause: 'messy real-world input', grading: 'one-off',
  concept: 'update', newConcept: 1, teaches: ['update'], uses: ['where'], needs: ['T03'], revisits: ['T03'],
  languages: ['sql'], world: { stage: [] },
  learnCard: {
    title: 'Changing a value',
    lines: [
      'UPDATE changes values in rows that are already there.',
      "In SET capacity = 5, = means 'becomes': it stores.",
      "In WHERE name = 'Studio', = means 'is equal to': it compares.",
      'Without WHERE, every row would change.',
    ],
    example: { lang: 'sql', code: "UPDATE rooms SET capacity = 5 WHERE name = 'Studio';", note: 'Watch the Studio change; then the office is put back as it was.' },
  },
  workedExample: { lang: 'sql', code: "UPDATE people SET role = 'staff' WHERE name = 'Jo Bell';", note: "A sibling: one person's role changed by name." },
  hints: ['Only one room is wrong.', 'Changing existing rows, and choosing which.', 'update'],
  spells: { teach: ['update'], recall: [] },
  steps: [{ objective: "Correct the Boardroom's seats.", level: 'L2', lang: 'sql', starter: 'UPDATE rooms',
    checks: [
      { kind: 'world', name: 'the Boardroom seats 10', sql: "SELECT capacity FROM rooms WHERE name = 'Boardroom'", expect: { equals: 10 } },
      { kind: 'unchanged', name: 'every other room is as it was', sql: ROOMS_BUT('Boardroom') },
      { kind: 'world', name: 'still three rooms', sql: 'SELECT count(*) FROM rooms', expect: { equals: 3 } },
    ] }],
  cheats: [{ name: 'every room set to 10', lang: 'sql', code: 'UPDATE rooms SET capacity = 10;' }],
  reference: [{ step: 0, lang: 'sql', code: "UPDATE rooms SET capacity = 10 WHERE name = 'Boardroom';" }],
  recap: ['You changed one value in one row.', 'The WHERE decided which row; without it, every room would have changed.'],
  evidence: true, timeMinutes: 2,
};

export const T06 = {
  id: 'T06', serve: 10, position: '#10', title: 'The Garden Room', act: 1,
  from: PRIYA, says: "We've just fitted out the Garden Room, six seats. It isn't showing on the system.",
  kind: 'feature', cause: 'client feature request', grading: 'one-off',
  concept: 'insert', newConcept: 1, teaches: ['insert'], uses: ['table-row', 'id-link'], needs: ['T04'], revisits: ['T04', 'O2'],
  languages: ['sql'], world: { stage: ['boardroom10'] },
  learnCard: {
    title: 'Adding a row',
    lines: [
      'INSERT INTO adds a new row to a table.',
      'The first brackets list the columns; VALUES gives what goes in them, in the same order.',
      "You don't give an id: the database gives the new row the next number.",
    ],
    example: { lang: 'sql', code: "INSERT INTO people (name) VALUES ('Ravi Patel');", note: 'A new person, number 6. Then the office is put back as it was.' },
  },
  workedExample: { lang: 'sql', code: "INSERT INTO people (name, role) VALUES ('Mia Wong', 'customer');", note: 'A sibling: a new person with two columns given.' },
  hints: ["The room doesn't exist yet.", 'Adding rows.', 'insert'],
  spells: { teach: ['insert'], recall: [] },
  steps: [{ objective: 'Add the Garden Room.', level: 'L2', lang: 'sql', starter: 'INSERT INTO rooms',
    checks: [
      { kind: 'world', name: 'one Garden Room with six seats', sql: "SELECT count(*) FROM rooms WHERE name = 'Garden Room' AND capacity = 6", expect: { equals: 1 } },
      { kind: 'world', name: 'exactly one room more', sql: 'SELECT count(*) FROM rooms', expect: { equals: 4 } },
      { kind: 'unchanged', name: 'the rooms that were there are as they were', sql: 'SELECT id, name, capacity FROM rooms WHERE id <= 3 ORDER BY id' },
    ] }],
  cheats: [
    { name: 'added twice', lang: 'sql', code: "INSERT INTO rooms (name, capacity) VALUES ('Garden Room', 6);\nINSERT INTO rooms (name, capacity) VALUES ('Garden Room', 6);" },
    { name: 'the Studio renamed', lang: 'sql', code: "UPDATE rooms SET name = 'Garden Room', capacity = 6 WHERE name = 'Studio';" },
  ],
  reference: [{ step: 0, lang: 'sql', code: "INSERT INTO rooms (name, capacity) VALUES ('Garden Room', 6);" }],
  recap: ['You added a row; the database gave it its own id.', 'The brackets held the columns, VALUES held what went in them.'],
  evidence: true, timeMinutes: 2,
};

export const T08 = {
  id: 'T08', serve: 11, position: '#11', title: 'Biggest first', act: 1,
  from: PRIYA, says: 'Can the room list come out biggest first? People always ask for the big rooms.',
  kind: 'feature', cause: 'client feature request', grading: 'query',
  concept: 'order-by', newConcept: 1, teaches: ['order-by'], uses: ['select-columns', 'look-up'], needs: ['T02', 'O5'], revisits: ['T01', 'T02'],
  languages: ['sql'], world: { stage: ['boardroom10', 'garden'] },
  learnCard: {
    title: 'Sorting',
    lines: ['ORDER BY sorts the answer by a column.', 'Smallest first is the usual order (ASC); DESC turns it round, biggest first.', 'Sorting never changes the table, only the answer.'],
    example: { lang: 'sql', code: 'SELECT name FROM people ORDER BY name;', note: 'Everyone, in name order.' },
  },
  workedExample: { lang: 'sql', code: 'SELECT name, role FROM people ORDER BY name DESC;', note: 'A sibling: people, sorted the other way round.' },
  hints: ["The rows are right, the order isn't.", 'Sorting results.', 'order-by'],
  spells: { teach: ['order-by'], recall: [] },
  steps: [{ objective: 'List the rooms, biggest first.', level: 'L2', lang: 'sql', starter: 'SELECT name, capacity FROM rooms',
    checks: [{ kind: 'rows', name: 'every room, biggest first', truth: 'SELECT name, capacity FROM rooms', sorted: { column: 'capacity', dir: 'desc' } }] }],
  cheats: [{ name: 'the list as it is stored', lang: 'sql', code: 'SELECT name, capacity FROM rooms;' }],
  reference: [{ step: 0, lang: 'sql', code: 'SELECT name, capacity FROM rooms ORDER BY capacity DESC;' }],
  recap: ['You sorted the answer, biggest first.', 'Sorting never changes the table, only the answer.'],
  evidence: true, timeMinutes: 2,
};

export const T10 = {
  id: 'T10', serve: 12, position: '#12', title: 'A team of seven', act: 1,
  from: PRIYA, says: 'A team of seven wants a room on Thursday. Which of ours could take them?',
  kind: 'question', cause: 'report or question', grading: 'query',
  concept: 'compare', newConcept: 1, teaches: ['compare'], uses: ['where'], needs: ['T03'], revisits: ['T03', 'T08'],
  languages: ['sql'], world: { stage: ['boardroom10', 'garden'] },
  learnCard: {
    title: 'Comparing',
    lines: ['In a WHERE you can compare numbers, not only match them.', ">= means 'at least'; > means 'more than'.", "<= is 'at most', < is 'less than', <> is 'not equal'."],
    example: { lang: 'sql', code: 'SELECT name, capacity FROM rooms WHERE capacity > 5;', note: 'The rooms with more than five seats.' },
  },
  workedExample: { lang: 'sql', code: 'SELECT name FROM people WHERE id > 2;', note: 'A sibling: people after the first two.' },
  hints: ['Seven people need at least seven seats.', 'Comparing numbers in a filter.', 'compare'],
  spells: { teach: ['compare'], recall: [] },
  steps: [{ objective: 'Find the rooms that can take seven.', level: 'L2', lang: 'sql', starter: 'SELECT name FROM rooms WHERE capacity',
    checks: [{ kind: 'rows', name: 'the rooms with seven seats or more', truth: 'SELECT name FROM rooms WHERE capacity >= 7' }] }],
  cheats: [{ name: 'more than seven (misses a seven-seater)', lang: 'sql', code: 'SELECT name FROM rooms WHERE capacity > 7;' }],
  reference: [{ step: 0, lang: 'sql', code: 'SELECT name FROM rooms WHERE capacity >= 7;' }],
  recap: ["You filtered with 'at least' instead of 'equals'.", 'Seven seats is enough for seven people: >= keeps it.'],
  pattern: 'Filter rows', evidence: true, timeMinutes: 2,
};

export const T11 = {
  id: 'T11', serve: 13, position: '#13', title: "The Garden Room won't take us", act: 1,
  from: SAM, says: "Your system won't let me book the Garden Room for our eight-person workshop. It must be broken.",
  kind: 'question', cause: 'misunderstanding', grading: 'query',
  concept: 'investigate', newConcept: 1, teaches: ['investigate'], uses: ['where', 'compare'], needs: ['T10'], revisits: ['T03', 'T10'],
  languages: ['sql'], world: { stage: ['boardroom10', 'garden'] },
  learnCard: {
    title: 'Look before you change',
    lines: [
      'Not every report is a bug. Before changing anything, look at what the system knows.',
      'A SELECT changes nothing, so it is always safe to run.',
      'Then reply with evidence: what you found, and what the person can do.',
    ],
    example: { lang: 'sql', code: 'SELECT name, capacity FROM rooms;', note: 'A sibling case, "the Studio won\'t take six": the Studio seats 4, so the system was right to say no.' },
  },
  workedExample: { lang: 'sql', code: 'SELECT name, capacity FROM rooms WHERE capacity >= 6;', note: 'The sibling: the rooms that can take six. The reply: "the Studio seats 4; these rooms fit".' },
  hints: ['Check what the system knows about the Garden Room.', 'Read-only investigation: look before you change.', 'compare'],
  spells: { teach: [], recall: ['where', 'compare'] },
  steps: [
    { objective: 'Find out what the system knows, and which rooms could take eight.', level: 'L3', lang: 'sql', starter: '',
      checks: [
        { kind: 'rows', name: 'your evidence: the rooms that can take eight', truth: 'SELECT * FROM rooms WHERE capacity >= 8' },
        { kind: 'unchanged', name: 'the rooms are as they were', sql: 'SELECT id, name, capacity FROM rooms ORDER BY id' },
      ] },
    { objective: 'Reply to Sam.', level: 'L3', interaction: 'reply', prompt: 'What do you tell Sam?',
      options: [
        { id: 'bug', text: "It's a bug: the booking page is broken. I'll fix it." },
        { id: 'right', text: 'The Garden Room seats 6, fewer than 8: the system was right. The rooms in my answer fit.' },
        { id: 'full', text: 'The Garden Room is already booked all week.' },
      ],
      checks: [
        { kind: 'reply', name: 'the reply names the true cause', answer: 'right' },
        { kind: 'unchanged', name: 'the rooms are as they were', sql: 'SELECT id, name, capacity FROM rooms ORDER BY id' },
      ] },
  ],
  cheats: [
    { name: 'raising the Garden Room to eight seats', step: 0, lang: 'sql', code: "UPDATE rooms SET capacity = 8 WHERE name = 'Garden Room';\nSELECT * FROM rooms WHERE capacity >= 8;" },
    { name: 'calling it a bug', step: 1, answer: { reply: 'bug' } },
  ],
  reference: [{ step: 0, lang: 'sql', code: 'SELECT name, capacity FROM rooms WHERE capacity >= 8;' }, { step: 1, answer: { reply: 'right' } }],
  explain: { question: 'Sam asks: "So why did it say no?"', model: 'The Garden Room seats 6 and the workshop is 8 people, so the system was right to refuse. Nothing is broken. The Boardroom seats 10, so it can take them.', checklist: ['the Garden Room seats 6', '8 is more than 6', 'the system was right', 'a room that fits'] },
  recap: ['You proved the system right before touching anything.', 'The evidence was one read-only query.'],
  pattern: 'Investigate before you change', evidence: true, timeMinutes: 3,
};

export const T13 = {
  id: 'T13', serve: 14, position: '#14', title: 'Friday by mistake', act: 1,
  from: SAM, says: "I booked the Boardroom for Friday by mistake. Can you cancel it? My afternoon one's fine.",
  kind: 'bug', cause: 'messy real-world input', grading: 'one-off',
  concept: 'delete', newConcept: 1, teaches: ['delete'], uses: ['where', 'investigate'], needs: ['T03', 'T04'], revisits: ['T03', 'T04'],
  languages: ['sql'], world: { stage: ['boardroom10', 'garden'] }, showTimetable: true,
  learnCard: {
    title: 'Removing a row',
    lines: [
      'DELETE FROM removes rows, for good.',
      "Find the right row first: list Sam's bookings, or find Friday's block on the timetable and read its id.",
      'Then remove only that row, by its id.',
      'Two dashes, --, start a comment: the database ignores the rest of the line.',
    ],
    example: { lang: 'sql', code: '-- the finding query first: it changes nothing\nSELECT * FROM bookings WHERE person_id = 3;', note: "Jo's bookings: read an id off the answer." },
  },
  workedExample: { lang: 'sql', code: 'DELETE FROM bookings WHERE id = 22;', note: "A sibling: one of Jo's bookings removed by its id (then the office is put back)." },
  hints: ["First find Sam's bookings, then remove only one.", 'Deleting rows by id.', 'delete'],
  spells: { teach: ['delete'], recall: [] },
  steps: [{ objective: "Cancel only Sam's wrong booking.", level: 'L2', lang: 'sql', starter: "-- find Sam's Friday bookings first, then remove only the wrong one\nDELETE FROM bookings",
    checks: [
      { kind: 'world', name: "Sam's Friday Boardroom booking is gone", sql: 'SELECT count(*) FROM bookings WHERE id = 11', expect: { equals: 0 } },
      { kind: 'world', name: "Sam's afternoon booking is still there", sql: 'SELECT count(*) FROM bookings WHERE id = 12', expect: { equals: 1 } },
      { kind: 'unchanged', name: 'every other booking is as it was', sql: 'SELECT * FROM bookings WHERE id <> 11 ORDER BY id' },
    ] }],
  cheats: [{ name: "every booking of Sam's", lang: 'sql', code: 'DELETE FROM bookings WHERE person_id = 2;' }],
  reference: [{ step: 0, lang: 'sql', code: 'DELETE FROM bookings WHERE id = 11;' }],
  recap: ['You looked first, then removed one row by its id.', 'WHERE id = picked exactly one booking.'],
  pattern: 'Find by key', evidence: true, timeMinutes: 2,
};

export const T14 = {
  id: 'T14', serve: 15, position: '#15', title: 'Too many in the Garden Room', act: 1,
  from: SAM, says: "Which of my bookings are in the Garden Room? I think I've got too many.",
  kind: 'question', cause: 'report or question', grading: 'query',
  concept: 'and', newConcept: 1, teaches: ['and'], uses: ['where', 'compare', 'id-link'], needs: ['T03', 'T10'], revisits: ['T03', 'T10', 'O2'],
  languages: ['sql'], world: { stage: ALL_STAGES },
  learnCard: {
    title: 'Both must hold',
    lines: ['AND joins two conditions: a row stays only if both are true.', 'Sam is person 2; the Garden Room is room 4.', 'OR keeps a row if either is true (it is in the Grimoire).'],
    example: { lang: 'sql', code: 'SELECT * FROM bookings WHERE room_id = 1 AND person_id = 4;', note: "Omar's Boardroom bookings only." },
  },
  workedExample: { lang: 'sql', code: 'SELECT name FROM rooms WHERE capacity >= 5 AND capacity <= 8;', note: 'A sibling: rooms between five and eight seats.' },
  hints: ['Two things must both be true.', 'Combining conditions.', 'and'],
  spells: { teach: ['and'], recall: [] },
  steps: [{ objective: "List Sam's Garden Room bookings.", level: 'L2', lang: 'sql', starter: 'SELECT * FROM bookings',
    checks: [{ kind: 'rows', name: "Sam's bookings in the Garden Room", truth: 'SELECT * FROM bookings WHERE person_id = 2 AND room_id = 4' }] }],
  cheats: [{ name: "all of Sam's bookings", lang: 'sql', code: 'SELECT * FROM bookings WHERE person_id = 2;' }],
  reference: [{ step: 0, lang: 'sql', code: 'SELECT * FROM bookings WHERE person_id = 2 AND room_id = 4;' }],
  recap: ['Two conditions, and both had to hold.', "Sam's AND the Garden Room's: only the rows that are both."],
  evidence: true, timeMinutes: 2,
};

const FRI = "start_at >= '2026-01-09 00:00+00' AND start_at < '2026-01-10 00:00+00'";
export const T16 = {
  id: 'T16', serve: 16, position: '#16', title: 'This Friday in the Boardroom', act: 1,
  from: SAM, says: "What's on in the Boardroom this Friday? I'm trying to fit a client in.",
  kind: 'question', cause: 'report or question', grading: 'query',
  concept: 'time-range', newConcept: 1, teaches: ['time-range'], uses: ['and', 'compare', 'where'], needs: ['T14'], revisits: ['T14', 'T10'],
  languages: ['sql'], world: { stage: ALL_STAGES },
  learnCard: {
    title: 'A day of bookings',
    lines: [
      "Times are written like '2026-01-06 00:00+00': the date, the time, and +00 for UTC.",
      'A day runs from midnight up to, but not including, the next midnight.',
      "So Tuesday is start_at >= '2026-01-06 00:00+00' AND start_at < '2026-01-07 00:00+00'.",
    ],
    example: { lang: 'sql', code: "SELECT * FROM bookings WHERE start_at >= '2026-01-06 00:00+00' AND start_at < '2026-01-07 00:00+00';", note: "Tuesday's bookings." },
  },
  workedExample: { lang: 'sql', code: "SELECT * FROM bookings WHERE room_id = 2 AND start_at >= '2026-01-05 00:00+00' AND start_at < '2026-01-06 00:00+00';", note: "A sibling: Monday's bookings in the Studio." },
  hints: ['Friday starts at midnight and ends at the next midnight.', 'Filtering by time.', 'time-range'],
  spells: { teach: ['time-range'], recall: [] },
  steps: [{ objective: "List Friday's Boardroom bookings.", level: 'L2', lang: 'sql', starter: 'SELECT * FROM bookings WHERE room_id = 1',
    checks: [{ kind: 'rows', name: "Friday's Boardroom bookings, and nothing from Saturday", truth: `SELECT * FROM bookings WHERE room_id = 1 AND ${FRI}` }] }],
  cheats: [{ name: 'up to and including midnight on Saturday', lang: 'sql', code: "SELECT * FROM bookings WHERE room_id = 1 AND start_at >= '2026-01-09 00:00+00' AND start_at <= '2026-01-10 00:00+00';" }],
  reference: [{ step: 0, lang: 'sql', code: `SELECT * FROM bookings WHERE room_id = 1 AND ${FRI};` }],
  recap: ["You used 'from midnight up to, but not including, the next midnight' for a day.", "You'll use that shape for every time question."],
  evidence: true, timeMinutes: 3,
};

export const T17 = {
  id: 'T17', serve: 17, position: '#17', title: 'How long have I got?', act: 1,
  from: SAM, says: "When's the next booking in the Boardroom after nine on Monday? I need to know how long I've got.",
  kind: 'question', cause: 'report or question', grading: 'query',
  concept: 'limit', newConcept: 1, teaches: ['limit'], lookupOnly: true, uses: ['order-by', 'time-range', 'look-up', 'and'], needs: ['T08', 'T16', 'O5'], revisits: ['T08', 'T16', 'O5'],
  languages: ['sql'], world: { stage: ALL_STAGES },
  learnCard: null, // learn by look-up: no Learn card (the Grimoire's search is the teacher here)
  workedExample: { lang: 'sql', code: 'SELECT name, capacity FROM rooms ORDER BY capacity LIMIT 1;', note: 'A sibling: the smallest room.' },
  hints: ["Sort by time. Is there a Grimoire word for 'only the first'?", 'Limiting results.', 'limit'],
  spells: { teach: ['limit'], recall: ['and', 'compare', 'order-by', 'select-all', 'time-range', 'where'] },
  steps: [{ objective: 'Find the next Boardroom booking after 9:00 on Monday.', level: 'L3', lang: 'sql', starter: '',
    checks: [{ kind: 'rows', name: 'one row: the next Boardroom booking', truth: "SELECT * FROM bookings WHERE room_id = 1 AND start_at >= '2026-01-05 09:00+00' ORDER BY start_at LIMIT 1" }] }],
  cheats: [{ name: 'the lowest id instead of the earliest time', lang: 'sql', code: "SELECT * FROM bookings WHERE room_id = 1 AND start_at >= '2026-01-05 09:00+00' ORDER BY id LIMIT 1;" }],
  reference: [{ step: 0, lang: 'sql', code: "SELECT * FROM bookings WHERE room_id = 1 AND start_at >= '2026-01-05 09:00+00' ORDER BY start_at LIMIT 1;" }],
  recap: ["You found a tool you hadn't been shown. That's how you'll learn most things at work.", 'Sort, then take the first: ORDER BY start_at LIMIT 1.'],
  pattern: 'Sort and take the top', evidence: true, timeMinutes: 3,
};
