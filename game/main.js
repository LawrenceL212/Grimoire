import { toObjects } from './world/views.js';
import { runSolution } from './runners/index.js';
import { startProblem, gradeProblem } from './problems/check.js';
import { doubleBooking1 as problem } from './problems/double-booking-1.js';
import { createTimetable } from './ui/timetable.js';
import { describeSkill, renderMeter } from './memory/meter.js';
import { INITIAL_STABILITY } from './memory/curve.js';

const LANGS = { sql: 'SQL', js: 'JavaScript', php: 'PHP' };
const STARTERS = {
  sql: '-- write SQL here\n',
  js: '// `world.bookings` is an array. Change it, then run.\n',
  php: '// `$pdo` is connected to a SQLite copy of the world.\n',
};
const DEMO_NOTE = 'Demo values: the real skill log arrives in a later phase.';
const NOT_READY = 'The game is not ready yet.';
const PHP_NOTE = 'PHP works on a SQLite copy of the world, and your changes are written back. An endless loop in PHP freezes this page for now, so reload if that happens.';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, text) => {
  const n = document.createElement(tag);
  Object.assign(n, props);
  if (text !== undefined) n.textContent = text;
  return n;
};

const app = $('app');
const header = el('header', { className: 'hud' });
header.append(el('h1', {}, 'Grimoire: Open for Business'), el('div', { className: 'quest-title' }, problem.title));
const tabs = el('div', { className: 'lang-tabs' });
tabs.setAttribute('role', 'group');
tabs.setAttribute('aria-label', 'Language');
for (const l of problem.languages) {
  const b = el('button', { className: 'tab', type: 'button' }, LANGS[l]);
  b.dataset.lang = l;
  tabs.append(b);
}
const editor = el('textarea', { id: 'editor', spellcheck: false });
editor.setAttribute('aria-label', 'Your code');
const actions = el('div', { className: 'actions' });
actions.append(
  el('button', { id: 'run', className: 'run', type: 'button' }, 'Run'),
  el('button', { id: 'reset', className: 'reset', type: 'button' }, 'Reset'),
  el('span', { id: 'note', className: 'note' }),
);
const result = el('div', { id: 'result' });
result.setAttribute('role', 'status');
result.setAttribute('aria-live', 'polite');
// Shown over the empty timetable until the first world is drawn.
const loading = el('p', { id: 'loading', className: 'loading' }, 'Opening the office…');
loading.setAttribute('role', 'status');
// Replaces the static "Loading the game..." text from index.html.
app.replaceChildren(header, el('p', { id: 'goal', className: 'goal' }, problem.goal), loading, el('div', { id: 'timetable' }),
  tabs, editor, actions, result, el('div', { id: 'meter' }), el('p', { className: 'meter-caption' }, DEMO_NOTE));

const tt = createTimetable($('timetable'));
let lang = 'sql';
let world = null;
let busy = false;
window.__game = { ready: false, phase: 1, world: null };

function setBusy(on) {
  busy = on;
  $('run').disabled = on;
  $('reset').disabled = on;
}

function show(kind, text) {
  $('result').className = kind;
  $('result').textContent = text;
}

function setLang(next) {
  lang = next;
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('is-active', b.dataset.lang === next));
  if (!editor.value.trim() || Object.values(STARTERS).includes(editor.value)) editor.value = STARTERS[next];
  $('note').textContent = next === 'php' ? PHP_NOTE : '';
}

const errorText = (e) => String(e?.message ?? e);

/* Boot and Reset share this. The new world is drawn before the old one is
   closed, and a failure leaves the controls working, so Reset is the retry. */
async function loadWorld() {
  const old = world;
  try {
    world = await startProblem(problem);
    tt.render(await toObjects(world));
    Object.assign(window.__game, { ready: true, world });
    show('', '');
    await old?.close().catch(() => {});
  } catch (e) {
    show('is-error', (old ? 'Reset failed: ' : 'The game could not start: ') + errorText(e) +
      '. Check your connection, then press Reset to try again (or reload the page).');
  } finally {
    loading.hidden = true;
  }
}

async function onRun() {
  if (busy) return;
  if (!world) {
    show('is-miss', NOT_READY);
    return;
  }
  const code = editor.value;
  if (!code.trim() || code === STARTERS[lang]) {
    show('is-miss', 'Write some code first.');
    return;
  }
  setBusy(true);
  try {
    show('', lang === 'php' ? 'Loading PHP, then running…' : 'Running…');
    const res = await runSolution(world, lang, code);
    tt.render(await toObjects(world));
    if (!res.ok) {
      show('is-error', res.error);
    } else {
      const grade = await gradeProblem(world, problem);
      show(grade.passed ? 'is-win' : 'is-miss', grade.passed
        ? 'Solved. The room is clear.'
        : 'Not yet: ' + grade.results.filter((x) => !x.ok).map((x) => x.name).join(' · '));
    }
  } catch (e) {
    show('is-error', errorText(e));
  } finally {
    setBusy(false);
  }
}

async function onReset() {
  if (busy) return;
  setBusy(true);
  try {
    await loadWorld();
  } finally {
    setBusy(false);
  }
}

// Controls are wired before the world opens, so they never sit there dead.
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
$('run').addEventListener('click', onRun);
$('reset').addEventListener('click', onReset);
setLang('sql');
// Demonstration values only (see DEMO_NOTE).
renderMeter($('meter'), describeSkill(
  { name: 'Overlap detection', lang: 'sql', lastMs: Date.now() - 2 * 86400000, stability: INITIAL_STABILITY * 3 }, Date.now()));
onReset();
