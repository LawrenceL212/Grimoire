// S0 · The notebook (product arc, section 1). The on-ramp's first two ideas, re-hosted on Priya's paper notebook:
// the company has no database yet, so a table and a row are met on paper first (O1: table-row), then a number
// that points at another page (O2: id-link). Same ids, concepts and evidence rules as before (interact grading;
// scaffolded, never evidence). The truth is the notebook's content: the grid can be re-sorted, so a pick by
// position is not a pick by meaning.
import { PRIYA } from '../chapter1/people.js';

export const O1 = {
  id: 'O1', serve: 1, position: '#1', title: 'Everything we have', act: 1, stage: 'S0',
  from: PRIYA, says: "This is everything we've got: three rooms and the bookings, in my notebook. Sam wants to try us. Can you find mine first? It's the one at ten on Monday.",
  kind: 'onramp', cause: 'report or question', grading: 'interact',
  concept: 'table-row', newConcept: 1, teaches: ['table-row'], uses: [], needs: [], revisits: [],
  languages: ['sql'], world: { stage: [], arc: true }, showNotebook: 'bookings',
  acceptance: ["The cell you click is the one that says which room Priya's Monday ten o'clock booking is in.", 'Found by what the line says: the page can be sorted, so the fifth line is not always the same booking.'],
  learnCard: {
    title: 'Tables, rows and columns',
    lines: [
      "Priya's notebook is already a table: each page holds one kind of thing.",
      'Each line of the Bookings page is one booking: one row.',
      'Each heading (Who, Room, Day, From, To) is one fact about it: a column.',
      'A database keeps exactly this, so it can answer questions about it.',
    ],
    example: { show: 'note', page: 'bookings', row: 1, note: 'Line 1: Omar, room 1, Monday from 08:00 to 09:00. One row; six columns.' },
  },
  workedExample: { show: 'note', page: 'bookings', row: 3, note: 'Any line is a row: line 3 is Lena on Tuesday at nine, in room 2.' },
  hints: ['Monday, ten o\'clock, and her name: all three are on the line you want.', 'A row is one booking; a column is one fact about it.', 'table-row'],
  spells: { teach: ['table-row'], recall: [] },
  steps: [{
    objective: "In the notebook, click the cell that says which room Priya's Monday ten o'clock booking is in.", level: 'L0', interaction: 'cell',
    checks: [{ kind: 'cell', name: "the room of Priya's Monday ten o'clock booking", page: 'bookings', where: { who: 'Priya Shah', day: 'Mon', from: '10:00' }, cols: ['room'] }],
  }],
  cheats: [
    { name: "Priya's other booking (Wednesday)", answer: { cell: { page: 'bookings', row: 10, col: 'room' } } },
    { name: 'the fifth line, after the page is sorted by name', answer: { cell: { page: 'bookings', sort: 'who', at: 4, col: 'room' } } },
  ],
  reference: [{ step: 0, answer: { cell: { page: 'bookings', row: 5, col: 'room' } } }],
  recap: ["You found one row (Priya's booking) and one column of it (its room).", "Every question you'll ask the database is 'which rows?' and 'which columns?'."],
  pattern: 'Find by key (preview)', evidence: false, timeMinutes: 2,
};

export const O2 = {
  id: 'O2', serve: 2, position: '#2', title: 'Room 2', act: 1, stage: 'S0',
  from: PRIYA, says: "My bookings page just says 'room 2' for Sam's Wednesday. Which room is that?",
  kind: 'onramp', cause: 'report or question', grading: 'interact',
  concept: 'id-link', newConcept: 1, teaches: ['id-link'], uses: ['table-row'], needs: ['O1'], revisits: ['O1'],
  languages: ['sql'], world: { stage: [], arc: true }, showNotebook: 'rooms',
  acceptance: ["You click, on the Rooms page, the room that Sam's 'room 2' means.", 'The Rooms page can be sorted: the second line is not always room 2.'],
  learnCard: {
    title: 'Numbers that point',
    lines: [
      'Priya gave every room its own number, written in the No. column, never shared.',
      "On the Bookings page, 'room 2' means 'the room whose number is 2'.",
      'That room lives on another page. Follow the number to find its name.',
    ],
    example: { show: 'note', page: 'rooms', row: 3, note: "Room 3 is the Library: Jo's Monday booking (line 2) says room 3, so it is in the Library." },
  },
  workedExample: { show: 'note', page: 'rooms', row: 1, note: "Omar's line 1 says room 1: follow it to the Rooms page, number 1, the Boardroom." },
  hints: ['The answer is on the other page.', 'A number that points: room 2 is the room numbered 2, wherever it sits on the page.', 'id-link'],
  spells: { teach: ['id-link'], recall: [] },
  steps: [{
    objective: "Open the Rooms page and click the room that 'room 2' points at.", level: 'L0', interaction: 'cell',
    checks: [{ kind: 'cell', name: "the room Sam's booking points at", page: 'rooms', where: { no: 2 }, cols: ['no', 'name', 'seats'] }],
  }],
  cheats: [
    { name: 'the first room (the Boardroom)', answer: { cell: { page: 'rooms', row: 1, col: 'name' } } },
    { name: 'the second line, after the page is sorted by seats', answer: { cell: { page: 'rooms', sort: 'seats', at: 1, col: 'name' } } },
  ],
  reference: [{ step: 0, answer: { cell: { page: 'rooms', row: 2, col: 'name' } } }],
  recap: ['You followed a number from one page to another: room 2 is the Studio.', 'A database links its tables the same way, by an id.'],
  pattern: 'Look up across two tables (preview)', evidence: false, timeMinutes: 2,
};
