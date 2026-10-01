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
//   lastEvents, storyLog(), census(), scene: { occupants() }, stats(), bench(n), resetView() }
import { toObjects } from '../world/views.js';
import { runSolution } from '../runners/index.js';
import { startProblem, gradeProblem } from '../problems/check.js';
import { doubleBooking1 as problem } from '../problems/double-booking-1.js';
import { createHud, clashingRooms } from './hud.js';
import { diffWorlds } from './bridge.js';
import { deriveState, recordSolve, creditFor } from './state.js';
import { TICKET, outcome } from './ticket.js';
import { createWindows } from './windows.js';
import { createEditor } from './editor.js';
import { mountTweakPanel } from '../engine/tweak-panel.js';
import { get as tget, onThemeChange } from '../engine/theme.js';

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

const $ = (s) => document.querySelector(s);
const app = $('#app');
// the page's colours follow the theme too (the same palette as the scene)
const CSS_VARS = { '--ink': 'palette.ink', '--paper': 'palette.paper', '--text': 'palette.text', '--gold': 'palette.gold', '--danger': 'palette.danger', '--ok': 'palette.ok', '--bg': 'palette.bg', '--bg-glow': 'palette.bgGlow', '--code-opacity': 'ui.codeOpacity' };
function cssTheme() { for (const [v, p] of Object.entries(CSS_VARS)) document.documentElement.style.setProperty(v, String(tget(p))); }
cssTheme();
onThemeChange((p) => { if (!p || Object.values(CSS_VARS).includes(p)) cssTheme(); });
const play = window.__play = { ready: false, busy: false, phase: null, runs: 0, refused: 0, world: null, objects: null, clock: CLOCK, map: null, office: null, story: null, lastEvents: null };

// ---------------------------------------------------------------- the HUD
let tweak = null;
let focusOn = false;
const hud = createHud($('#hud'), {
  onReset: () => onReset(),
  onTweak: () => { tweak ??= mountTweakPanel(app); tweak.toggle(); },
  onFocus: () => toggleFocus(),
});
hud.setClock('Day 1 · 08:45');

// ---------------------------------------------------------------- the windows
const wins = createWindows(app, { onChange: () => {} });
wins.add($('#win-ticket'), { id: 'ticket', x: 16, y: 84, w: 440, h: 196, minW: 260, minH: 110 });
wins.add($('#win-code'), { id: 'code', x: 16, y: 292, w: 440, h: (W, H) => Math.max(300, Math.min(470, H - 292 - 16)), minW: 300, minH: 240 });

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
  if (!out) { thread.innerHTML = ''; return; }
  if (out.resolved) {
    thread.innerHTML = `<p class="reply"><b>${esc(TICKET.from)}:</b> “${esc(out.reply)}”</p>`
      + `<div class="recap"><span class="tag">What you just did</span><p>${esc(out.recap[0])}</p><p>${esc(out.recap[1])}</p></div>`
      + `<p class="credit">${esc(out.credit)}</p>`;
  } else {
    thread.innerHTML = `<p class="still"><b>Still open.</b> ${esc(out.note)}</p>`
      + '<button type="button" class="chip" disabled title="Hints arrive in a later update">Hint · arrives in a later update</button>';
  }
  const body = $('#win-ticket .body');
  body.scrollTop = Math.max(0, thread.offsetTop - 8); // the answer in view, the symptom a scroll away
}

// ---------------------------------------------------------------- the code window
const editor = createEditor($('#editor-host'), { onRun: () => onRun(), label: 'Your code' });
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
$('#run').addEventListener('click', () => onRun());
$('#reset').addEventListener('click', () => onReset());
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
    stage.onLost(() => { glMessage(GL_LOST); story?.cancel(); });
    const [{ createOffice }, { createStory }] = await Promise.all([import('./office.js'), import('./story.js')]);
    office = createOffice(stage, { reducedMotion: RM });
    story = createStory(office, { clock: CLOCK, reducedMotion: RM });
    play.office = office; play.map = office.map; play.stage = stage; play.story = story;
    office.frame(wins.rects(), hudHeight());
    stage.frame((dt, t) => { if (!glDown) office.update(dt, t); });
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
  const name = play.objects?.rooms?.find((r) => r.id === clash)?.name || 'Room 1';
  if (focusOn) office.focus(name); else office.overview();
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
const clashRoomName = (objects) => {
  const id = [...clashingRooms(objects)][0];
  return objects.rooms?.find((r) => r.id === id)?.name || null;
};
const showState = (objects, grade) => hud.set(deriveState(objects, grade, history));
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
      office.setRooms(new Set(objects.rooms.filter((r) => clash.has(r.id)).map((r) => r.name)));
      office.fx.clearTickets();
      story.setTicket(!grade.passed, clashRoomName(objects) || 'Room 1');
      office.drone.reset(); office.drone.root.position.copy(office.rest);
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
  try {
    show('is-running', lang === 'php' ? 'Loading PHP, then running…' : 'Running…');
    const world = play.world;
    const before = await toObjects(world);
    const res = await runSolution(world, lang, code);
    if (op !== mine) return;
    if (!res.ok) { play.lastEvents = []; show('is-error', res.error); return; } // an error changes nothing: no scene events
    const after = await toObjects(world);
    const grade = await gradeProblem(world, problem);
    if (op !== mine) return;
    const events = diffWorlds(before, after);
    play.lastEvents = events;
    play.objects = after;
    const wasOpen = $('#win-ticket .pill').classList.contains('open');
    const solvedNow = grade.passed && wasOpen && events.length > 0;
    const credit = solvedNow ? creditFor(history, problem.id, { clean: true }) : 0;
    if (solvedNow) history = recordSolve(history, problem.id, { clean: true }); // no worked example yet: every solve is clean
    const out = lang === 'sql' ? rowsTable(res.rows) : (res.logs?.length || res.stdout) ? `<pre class="out">${esc((res.logs || []).join('\n') || res.stdout)}</pre>` : '';

    if (office && story && !glDown) {
      setBusy(true, 'story');
      show('is-running', events.length ? 'Your code ran. Watch the office…' : 'Your code ran…', out);
      const r = await story.play(events, { before, after, grade, wasOpen });
      if (r.cancelled || op !== mine) return;
    }
    showState(after, grade);
    if (!events.length) {
      const n = lang === 'sql' && res.rows ? res.rows.length : null;
      show('is-miss', `Your code ran${n !== null ? ` and returned ${n} row${n === 1 ? '' : 's'}` : ''}. The world did not change.`, out);
      return;
    }
    const said = outcome({ events, grade, before, after, lang, xp: credit });
    if (grade.passed) {
      if (wasOpen) setTicket(false, said);
      show('is-win', wasOpen ? `Solved: ${TICKET.from}'s ticket is resolved.${credit ? ` +${credit} XP` : ''}` : 'Your code ran. The ticket stays resolved.', out);
    } else {
      setTicket(true, said);
      show('is-miss', `Not yet: ${said.note}`, out);
    }
  } catch (e) {
    if (op === mine) show('is-error', String(e?.message ?? e));
  } finally {
    if (op === mine) setBusy(false);
  }
}
async function onReset() {
  if (play.busy && play.phase !== 'story') return; // the code is running: Reset waits for it
  const mine = ++op;
  story?.cancel();
  setBusy(true, 'reset');
  try { await loadWorld(); } finally { if (op === mine) setBusy(false); }
}

// ---------------------------------------------------------------- measuring (tests and the report)
play.scene = { occupants: () => (office ? office.occupants() : []) };
play.storyLog = () => (story ? story.log : []);
play.census = () => (office ? office.census() : null);
play.stats = () => (office ? office.stats() : null);
play.bench = (n) => (office ? office.bench(n) : null);
play.resetView = () => { if (!office) return; focusOn = false; hud.setFocus(false); stage.resetView(); office.frame(wins.rects(), hudHeight()); };
play.windows = wins;

setBusy(true);
await startScene();
await loadWorld();
setBusy(false);
