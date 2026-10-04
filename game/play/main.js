// main.js: boots the play page. The game logic (world, runners, grading, the HUD, the windows) never
// depends on the renderer: the 3D office is loaded with a dynamic import, and when WebGL is missing or
// lost the page says so over the scene and everything else keeps working.
//
// A run: snapshot the world, run the learner's code (Phase 1 runners), snapshot again, grade (Phase 1
// gradeProblem), diff the two snapshots (bridge.js), and let the office act out exactly that diff
// (story.js). The HUD is derived from the new world, the grade and the history (state.js); the ticket
// answers from the same diff and grade (ticket.js). An error changes nothing and plays nothing.
// While the story plays, Run is refused and Reset cancels the story and rebuilds the office.
//
// window.__play = { ready, busy, phase, runs, refused, world, objects, clock, map, office, story,
//   lastEvents, lastChanges, storyLog(), census(), scene: { occupants() }, stats(), bench(n), resetView(), sound }
// Sound (sound.js): the audio wakes on the first gesture; the effects follow the same real events the story
// plays (run, error, level-up are cued here; the story and the drone cue the rest).
// play.timeScale (default 1) speeds the office and the story up (tests set it; the outcome is the same).
//
// Two modes. The default is the SISO world's opening chapter (chapter.js): a fresh life starts with the first-day
// tutorial, then the ladder's tickets in order; Continue (any later visit) resumes at the right ticket. With
// ?ticket=double-booking-1 the page plays Phase 1's double-booking card on its own, as before (no chapter progress).
import { toObjects } from '../world/views.js';
import { runSolution } from '../runners/index.js';
import { startProblem, gradeProblem } from '../problems/check.js';
import { doubleBooking1 as problem } from '../problems/double-booking-1.js';
import { createHud, clashingRooms } from './hud.js';
import { diffWorlds, rowChanges, describeRows } from './bridge.js';
import { deriveState, recordSolve, creditFor } from './state.js';
import { TICKET, outcome } from './ticket.js';
import { createWindows } from './windows.js';
import { createEditor } from './editor.js';
import { mountTweakPanel } from '../engine/tweak-panel.js';
import { get as tget, onThemeChange } from '../engine/theme.js';
import { createSound } from './sound.js';
import { createLife } from './progress.js';
import { setDefaultStore } from './spells.js';
import { createHome } from './home.js';

const CLOCK = '2026-01-01T08:45:00Z'; // the office clock on Day 1: who is sitting where comes from the bookings running now
const LANGS = { sql: 'SQL', js: 'JavaScript', php: 'PHP' };
const FILES = { sql: 'bookings.sql', js: 'bookings.js', php: 'bookings.php' };
const STARTERS = {
  sql: '-- write SQL here\n',
  js: '// `world.bookings` is an array. Change it, then run.\n',
  php: '// `$pdo` is connected to a SQLite copy of the world.\n',
};
// Phase 1 Ruling 8: say plainly what PHP runs on, and what an endless loop does
const PHP_NOTE = 'PHP works on a SQLite copy of the world, and your changes are written back. An endless loop in PHP freezes this page for now, so reload if that happens.';
const GL_UNAVAILABLE = 'The 3D view could not start on this device (WebGL is not available). The ticket and the code window still work.';
const GL_LOST = 'The 3D view stopped (the graphics driver reset it). The ticket and the code window still work; reload the page to bring the office back.';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MODE = new URLSearchParams(location.search).get('ticket') === 'double-booking-1' ? 'ticket' : 'chapter';
let chapter = null; // the chapter controller (chapter.js), in chapter mode
// the life (progress.js): one record under one key, made before anything can open the Grimoire, so the HUD's
// book always shows this life's spells. ?new (chapter mode) starts a new life.
const life = createLife();
if (MODE === 'chapter' && new URLSearchParams(location.search).has('new')) life.reset();
setDefaultStore(life.spellStore);

const $ = (s) => document.querySelector(s);
const app = $('#app');
// the page's colours follow the theme too (the same palette as the scene)
const CSS_VARS = { '--ink': 'palette.ink', '--paper': 'palette.paper', '--text': 'palette.text', '--gold': 'palette.gold', '--danger': 'palette.danger', '--ok': 'palette.ok', '--bg': 'palette.bg', '--bg-glow': 'palette.bgGlow', '--code-opacity': 'ui.codeOpacity' };
function cssTheme() { for (const [v, p] of Object.entries(CSS_VARS)) document.documentElement.style.setProperty(v, String(tget(p))); }
cssTheme();
onThemeChange((p) => { if (!p || Object.values(CSS_VARS).includes(p)) cssTheme(); });
const play = window.__play = { ready: false, busy: false, phase: null, timeScale: 1, runs: 0, refused: 0, world: null, objects: null, clock: CLOCK, map: null, office: null, story: null, lastEvents: null };

// ---------------------------------------------------------------- the HUD
let tweak = null;
let focusOn = false;
let home = null; // the home room (home.js), made once the scene is up
const hud = createHud($('#hud'), {
  onReset: () => (chapter ? chapter.reset() : onReset()),
  onTweak: () => { tweak ??= mountTweakPanel(app); sound.attachPanel(tweak.panel); tweak.toggle(); },
  onFocus: () => toggleFocus(),
  onHome: () => home?.toggle(),
  onShop: () => home?.shop?.toggle(),
  onEdit: () => home?.edit?.toggle(),
});
hud.setClock('Day 1 · 08:45');

// ---------------------------------------------------------------- the windows
const wins = createWindows(app, { onChange: () => {} });
// the ticket grows to show Bea's answer, the recap and the credit, and the code window moves down under it
// (while neither has been moved by hand; a moved ticket window scrolls to the answer instead)
const TICKET_TOP = 84, TICKET_H = 196, CODE_MIN = 240;
let ticketWant = TICKET_H;
const ticketH = (W, H) => Math.max(TICKET_H, Math.min(ticketWant, H - TICKET_TOP - 12 - CODE_MIN - 16));
wins.add($('#win-ticket'), { id: 'ticket', x: 16, y: TICKET_TOP, w: 440, h: ticketH, minW: 260, minH: 110 });
wins.add($('#win-code'), { id: 'code', x: 16, y: (W, H) => TICKET_TOP + ticketH(W, H) + 12, w: 440,
  h: (W, H) => { const y = TICKET_TOP + ticketH(W, H) + 12; return Math.max(CODE_MIN, Math.min(470, H - y - 16)); }, minW: 300, minH: 240 });

// ---------------------------------------------------------------- the ticket: Bea's words, then what came of the run
$('#ticket-id').textContent = `TICKET #${TICKET.number}`;
$('#ticket-who').textContent = TICKET.who;
$('#ticket-said').textContent = `“${TICKET.symptom}”`;
const thread = $('#ticket-thread');
function setTicket(open, out = null) {
  const pill = $('#win-ticket .pill');
  pill.textContent = open ? 'OPEN' : 'RESOLVED ✓';
  pill.className = `pill ${open ? 'open' : 'done'}`;
  $('#win-ticket').classList.toggle('has-thread', !!out);
  if (!out) { thread.innerHTML = ''; fitTicket(); return; }
  if (out.resolved) {
    thread.innerHTML = `<p class="reply"><b>${esc(TICKET.from)}:</b> “${esc(out.reply)}”</p>`
      + `<div class="recap"><span class="tag">What you just did</span><p>${esc(out.recap[0])}</p><p>${esc(out.recap[1])}</p></div>`
      + `<p class="credit">${esc(out.credit)}</p>`;
  } else {
    thread.innerHTML = `<p class="still"><b>Still open.</b> ${esc(out.note)}</p>`
      + '<button type="button" class="chip" disabled title="Hints arrive in a later update">Hint · arrives in a later update</button>';
  }
  fitTicket();
}
function fitTicket() {
  const body = $('#win-ticket .body'), bar = $('#win-ticket .bar');
  ticketWant = thread.innerHTML ? bar.offsetHeight + thread.offsetTop + thread.offsetHeight + 18 : TICKET_H;
  wins.layout();
  body.scrollTop = body.scrollHeight; // the end of the answer (the credit) in view, if it still does not fit
}

// ---------------------------------------------------------------- the code window
const editor = createEditor($('#editor-host'), { onRun: () => (chapter ? chapter.run() : onRun()), label: 'Your code' });
const sound = createSound({ stage: () => stage, office: () => office, story: () => story, editor: editor.el, isBusy: () => play.busy, reducedMotion: RM });
sound.mountSpeaker($('#hud'));
let lang = 'sql';
const tabs = [...document.querySelectorAll('.lang-tab')];
function setLang(next) {
  lang = next;
  for (const b of tabs) { const on = b.dataset.lang === next; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
  if (!editor.value.trim() || Object.values(STARTERS).includes(editor.value)) editor.value = STARTERS[next];
  editor.lang = next;
  $('#code-file').textContent = FILES[next];
  $('#code-note').textContent = next === 'php' ? PHP_NOTE : '';
  $('#code-note').hidden = next !== 'php';
}
for (const b of tabs) b.addEventListener('click', () => setLang(b.dataset.lang));
$('#run').addEventListener('click', () => (chapter ? chapter.run() : onRun()));
$('#reset').addEventListener('click', () => (chapter ? chapter.reset() : onReset()));
setLang('sql');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function show(kind, text, extra = '') {
  const r = $('#result');
  r.className = kind;
  r.innerHTML = (text ? `<p>${esc(text)}</p>` : '') + extra;
}
function rowsTable(rows) {
  if (!rows || !rows.length) return '';
  const cols = Object.keys(rows[0]);
  const body = rows.slice(0, 8).map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c] ?? 'NULL')}</td>`).join('')}</tr>`).join('');
  const more = rows.length > 8 ? `<p class="more">and ${rows.length - 8} more row${rows.length - 8 === 1 ? '' : 's'}</p>` : '';
  return `<div class="rows"><table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>${more}`;
}
// phases: 'run' (the code runs: nothing else may touch the world), 'story' (the office acts it out: Run
// is refused, Reset cancels the story), 'reset' (the world is rebuilt)
function setBusy(on, phase = null) {
  play.busy = on;
  play.phase = on ? phase : null;
  $('#run').disabled = on || !play.world;
  const lockReset = on && phase !== 'story';
  $('#reset').disabled = lockReset;
  hud.setBusy(lockReset);
}

// ---------------------------------------------------------------- the 3D office (optional)
let stage = null, office = null, story = null, glDown = false;
function glMessage(text) {
  glDown = true;
  const m = $('#gl-msg');
  m.textContent = text; m.hidden = false;
  app.classList.add('no-gl');
}
async function startScene() {
  try {
    const [{ createStage }] = await Promise.all([import('../engine/renderer.js')]);
    const canvas = $('#scene canvas');
    try { stage = createStage(canvas, { reducedMotion: RM }); } catch { glMessage(GL_UNAVAILABLE); return; }
    stage.onLost(() => { glMessage(GL_LOST); story?.cancel(); }); // the run still finishes: its outcome is shown
    const [{ createOffice }, { createStory }] = await Promise.all([import('./office.js'), import('./story.js')]);
    office = createOffice(stage, { reducedMotion: RM });
    story = createStory(office, { clock: CLOCK, reducedMotion: RM, timeScale: () => play.timeScale, cue: (n, at) => sound.cue(n, at) });
    play.office = office; play.map = office.map; play.stage = stage; play.story = story;
    office.frame(wins.rects(), hudHeight());
    stage.frame((dt, t) => { if (!glDown) office.update(dt * (play.timeScale || 1), t); });
    addEventListener('resize', () => { if (office && !focusOn) office.frame(wins.rects(), hudHeight()); });
  } catch (e) {
    console.warn('the 3D office could not start', e);
    glMessage(GL_UNAVAILABLE);
  }
}
const hudHeight = () => { const h = $('#hud'); return h ? h.getBoundingClientRect().bottom + 6 : 64; };
function toggleFocus(force) {
  if (!office) return;
  focusOn = force ?? !focusOn;
  hud.setFocus(focusOn);
  const clash = [...clashingRooms(play.objects || {})][0];
  if (focusOn) office.focus(office.roomOf(clash ?? 1)?.id || 'room-1'); else office.overview();
}
addEventListener('keydown', (e) => {
  if (e.key !== 'f' && e.key !== 'F') return;
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  const el = e.target instanceof Element ? e.target : null;
  if (el && (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(el.tagName) || el.isContentEditable)) return;
  toggleFocus();
});

// ---------------------------------------------------------------- the world
let history = { solves: [] }; // kept across Reset: a ticket solved once earns nothing the second time
let op = 0; // the latest Run or Reset: an older one that finishes late touches nothing
let pendingCredit = 0; // XP a solve earned whose story Reset cut short: said after the reset
let shownLevel = null; // the level the HUD shows: going up plays level-up (never on the first show)
function showState(objects, grade) {
  const s = deriveState(objects, grade, history);
  hud.set(s);
  if (shownLevel !== null && s.level > shownLevel) sound.cue('level-up');
  shownLevel = s.level;
}
async function loadWorld() {
  const old = play.world;
  play.ready = false;
  try {
    play.world = await startProblem(problem);
    const grade = await gradeProblem(play.world, problem);
    const objects = await toObjects(play.world);
    play.objects = objects;
    showState(objects, grade);
    setTicket(!grade.passed);
    if (office) {
      office.seed(objects, CLOCK);
      const clash = clashingRooms(objects);
      office.setRooms(clash);
      office.fx.clearTickets();
      story.setTicket(!grade.passed, [...clash][0] ?? 1);
      office.resetDrones();
    }
    show('', '');
    play.ready = true;
    await old?.close().catch(() => {});
  } catch (e) {
    play.world = old && !play.world ? old : play.world;
    show('is-error', `${old ? 'Reset failed' : 'The game could not start'}: ${String(e?.message ?? e)}. Check your connection, then press Reset to try again (or reload the page).`);
  } finally {
    $('#loading').hidden = true;
  }
}

async function onRun() {
  if (play.busy) { play.refused++; return; } // one run at a time: a second press while busy is refused
  if (!play.world || !play.ready) { show('is-miss', 'The game is not ready yet.'); return; }
  const code = editor.value;
  if (!code.trim() || code === STARTERS[lang]) { show('is-miss', 'Write some code first.'); return; }
  const mine = ++op;
  play.runs++;
  setBusy(true, 'run');
  sound.cue('run');
  try {
    show('is-running', lang === 'php' ? 'Loading PHP, then running…' : 'Running…');
    const world = play.world;
    const before = await toObjects(world);
    const res = await runSolution(world, lang, code);
    if (op !== mine) return;
    if (!res.ok) { play.lastEvents = []; show('is-error', res.error); sound.cue('error'); return; } // an error changes nothing: no scene events
    const after = await toObjects(world);
    const grade = await gradeProblem(world, problem);
    if (op !== mine) return;
    const events = diffWorlds(before, after);
    const rows = rowChanges(before, after); // every table and column: decides whether anything changed at all
    const changed = rows.length > 0;
    play.lastEvents = events;
    play.lastChanges = rows;
    play.objects = after;
    const wasOpen = $('#win-ticket .pill').classList.contains('open');
    const solvedNow = grade.passed && wasOpen && changed;
    const credit = solvedNow ? creditFor(history, problem.id, { clean: true }) : 0;
    // the solve is recorded when it happens (no worked example yet: every solve is clean); if Reset cuts
    // the story short, the reset says what it earned
    if (solvedNow) { history = recordSolve(history, problem.id, { clean: true }); pendingCredit = credit || -1; }
    const out = lang === 'sql' ? rowsTable(res.rows) : (res.logs?.length || res.stdout) ? `<pre class="out">${esc((res.logs || []).join('\n') || res.stdout)}</pre>` : '';

    if (office && story && !glDown) {
      setBusy(true, 'story');
      show('is-running', events.length ? 'Your code ran. Watch the office…' : 'Your code ran…', out);
      await story.play(events, { before, after, grade, wasOpen, changed });
      // only Reset (a newer op) drops the outcome; a story stopped by a lost 3D view still reports it
      if (op !== mine) return;
    }
    pendingCredit = 0;
    showState(after, grade);
    const n = lang === 'sql' && res.rows ? res.rows.length : null;
    const ran = `Your code ran${n !== null ? ` and returned ${n} row${n === 1 ? '' : 's'}` : ''}.`;
    if (!changed) { show('is-miss', `${ran} The world did not change.`, out); return; }
    if (!office || !story || glDown) office?.reconcile(after, CLOCK);
    if (!events.length && !solvedNow) {
      show('is-miss', `${ran} No booking moved; ${describeRows(rows)}.`, out);
      return;
    }
    const said = outcome({ events, grade, before, after, lang, xp: credit });
    if (grade.passed) {
      if (wasOpen) setTicket(false, said);
      show('is-win', wasOpen ? `Solved: ${TICKET.from}'s ticket is resolved.${credit ? ` +${credit} XP` : ''}` : 'Your code ran. The ticket stays resolved.', out);
    } else {
      setTicket(true, said);
      show('is-miss', `Not yet: ${said.note}`, out);
      sound.attention();
    }
  } catch (e) {
    if (op === mine) { show('is-error', String(e?.message ?? e)); sound.cue('error'); }
  } finally {
    if (op === mine) setBusy(false);
  }
}
async function onReset() {
  if (play.busy && play.phase !== 'story') return; // the code is running: Reset waits for it
  const mine = ++op;
  story?.cancel();
  setBusy(true, 'reset');
  const credit = pendingCredit; pendingCredit = 0;
  try {
    await loadWorld();
    if (credit && play.ready) show('is-win', `Reset. Your fix had resolved ${TICKET.from}'s ticket${credit > 0 ? ` and earned +${credit} XP` : ''} before the reset; the world is back as the ticket arrived.`);
  } finally { if (op === mine) setBusy(false); }
}

// ---------------------------------------------------------------- measuring (tests and the report)
play.scene = { occupants: () => (office ? office.occupants() : []) };
play.storyLog = () => (story ? story.log : []);
play.census = () => (office ? office.census() : null);
play.stats = () => (office ? office.stats() : null);
play.bench = (n) => (office ? office.bench(n) : null);
play.resetView = () => { if (!office) return; focusOn = false; hud.setFocus(false); stage.resetView(); office.frame(wins.rects(), hudHeight()); };
play.windows = wins;
play.sound = sound;

setBusy(true);
await startScene();
home = createHome({ L: life, hud, app, getOffice: () => office, getStage: () => stage, rects: () => wins.rects(), hudHeight, RM });
play.home = home;
if (MODE === 'ticket') {
  await loadWorld();
  setBusy(false);
} else {
  // the chapter drives the same page: it gets the page's parts, never a second copy of them
  const ctx = {
    play, app, hud, wins, life, editor, sound, RM, $, esc, show, rowsTable, setBusy, fitTicket, hudHeight,
    get office() { return office; }, get story() { return story; }, get stage() { return stage; }, glDown: () => glDown,
    setLang, get lang() { return lang; }, tabs, showState: (s) => hud.set(s), homeSync: () => home?.sync(),
  };
  try {
    const { createChapter } = await import('./chapter.js');
    chapter = await createChapter(ctx);
    play.chapter = chapter;
  } catch (e) {
    console.error('the chapter could not start', e);
    show('is-error', `The game could not start: ${String(e?.message ?? e)}. Check your connection, then reload the page.`);
    $('#loading').hidden = true;
  }
}
