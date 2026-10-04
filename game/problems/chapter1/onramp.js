// The on-ramp O3-O5 (learning design, section 3; O1 and O2 are in arc/s0.js): what the tools ARE, before any typing from memory.
// None of it counts as evidence; each takes about a minute.
// Since the product arc's M-B they run in S3, on HIS company: his rooms table, the three rows he typed in S2
// (world: { arc: true }); examples on other data run on Sequel's practice pad (a fruit stall and a bookshelf).
import { PRIYA } from './people.js';

// O1 and O2 moved to the product arc's S0 (problems/arc/s0.js): the same ideas, met on Priya's paper notebook.

export const O3 = {
  id: 'O3', serve: 3, position: '#3', title: 'Asking a question', act: 1,
  from: PRIYA, says: "Clicking is fine for three rooms. What happens when we've a hundred?",
  kind: 'onramp', cause: 'report or question', grading: 'query',
  concept: 'query', newConcept: 1, teaches: ['query'], uses: ['table-row'], needs: ['O1'], revisits: ['O1'],
  languages: ['sql'], world: { stage: [], arc: true },
  learnCard: {
    title: 'A query is a question',
    lines: [
      "A query is a question typed in SQL, the database's language.",
      'Running it sends it to the database; the answer comes back as rows.',
      "SELECT * FROM rooms; means 'show every column of every row in rooms'.",
      '* means every column. ; ends the question.',
    ],
    example: { lang: 'sql', code: 'SELECT * FROM fruit;', note: "On Sequel's practice pad: every fruit on the stall comes back, as rows. Your rooms are next, in the editor." },
  },
  workedExample: { lang: 'sql', code: 'SELECT * FROM books;', note: "The same kind of question, about the books on the practice pad." },
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
  languages: ['sql'], world: { stage: [], arc: true },
  learnCard: {
    title: 'Errors are help',
    lines: [
      'An error is the computer telling you exactly what it could not understand, and roughly where.',
      'Read three things: what (the message), where (the word near it), and what it expected.',
      'Errors are help, not failure.',
    ],
    example: { lang: 'sql', code: 'SELECT * FORM fruit;', note: 'It says: syntax error at or near "FORM". The word it quotes is the one to fix.' },
  },
  workedExample: { lang: 'sql', code: 'SELECT * FROM fruit;', note: "FORM fixed to FROM: now it runs (on the practice pad's fruit)." },
  hints: ['Look at the word the message quotes.', 'The spelling of a keyword.', 'select-all'],
  spells: { teach: [], recall: [] },
  steps: [{ objective: "Read the error and fix Priya's query (change one word).", level: 'L1', lang: 'sql', starter: 'SELEC * FROM rooms;',
    checks: [{ kind: 'rows', name: 'the query runs and returns the rooms', truth: 'SELECT * FROM rooms', exactColumns: true }] }],
  cheats: [{ name: 'a different query that runs', lang: 'sql', code: 'SELECT {rooms.name} FROM rooms;' }],
  reference: [{ step: 0, lang: 'sql', code: 'SELECT * FROM rooms;' }],
  recap: ['You read an error and fixed the word it pointed at.', 'That habit is half of debugging.'],
  evidence: false, timeMinutes: 1,
};

export const O5 = {
  id: 'O5', serve: 5, position: '#5', title: 'Looking it up', act: 1,
  from: PRIYA, says: "Can the list come out in name order? I don't know if the database can do that.",
  kind: 'onramp', cause: 'client feature request', grading: 'interact',
  concept: 'look-up', newConcept: 1, teaches: ['look-up'], uses: ['query'], needs: ['O3'], revisits: ['O3'],
  languages: ['sql'], world: { stage: [], arc: true },
  learnCard: {
    title: 'Look it up',
    lines: [
      "Nobody remembers everything. The Grimoire holds every spell you've met, and lists the ones you haven't found yet.",
      "Look it up by what you want to do, in your own words: 'sort', 'count', 'only some'.",
      "Each entry has a small example you can run: in your company it runs on Sequel's practice pad, so nothing of yours changes.",
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
