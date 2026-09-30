// main.js: boots the play page. The game logic (world, runners, grading, the HUD, the windows) never
// depends on the renderer: the 3D office is loaded with a dynamic import, and when WebGL is missing or
// lost the page says so over the scene and everything else keeps working.
//
// window.__play = { ready, busy, world, objects, clock, map, office, scene: { occupants() }, stats(), bench(n), resetView() }
// Task 9 wires the real ticket and the story (bridge.js, state.js, story.js) where this file marks SEAM.
import { toObjects } from '../world/views.js';
import { runSolution } from '../runners/index.js';
import { startProblem, gradeProblem } from '../problems/check.js';
import { doubleBooking1 as problem } from '../problems/double-booking-1.js';
import { createHud, summarise, clashingRooms } from './hud.js';
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
const play = window.__play = { ready: false, busy: false, world: null, objects: null, clock: CLOCK, map: null, office: null };

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
wins.add($('#win-ticket'), { id: 'ticket', x: 16, y: 84, w: 440, h: 150, minW: 260, minH: 110 });
wins.add($('#win-code'), { id: 'code', x: 16, y: 246, w: 440, h: (W, H) => Math.max(300, Math.min(470, H - 246 - 16)), minW: 300, minH: 240 });

// ---------------------------------------------------------------- the ticket (SEAM: Task 9 presents it as Bea's ticket)
$('#ticket-id').textContent = 'TICKET #1';
$('#ticket-who').textContent = problem.title;
$('#ticket-said').textContent = problem.goal;
function setTicket(open) {
  const pill = $('#win-ticket .pill');
  pill.textContent = open ? 'OPEN' : 'RESOLVED ✓';
  pill.className = `pill ${open ? 'open' : 'done'}`;
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
function setBusy(on) {
  play.busy = on;
  $('#run').disabled = on || !play.world;
  $('#reset').disabled = on;
  hud.setBusy(on);
}

// ---------------------------------------------------------------- the 3D office (optional)
let stage = null, office = null, glDown = false;
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
    stage.onLost(() => { glMessage(GL_LOST); });
    const { createOffice } = await import('./office.js');
    office = createOffice(stage, { reducedMotion: RM });
    play.office = office; play.map = office.map; play.stage = stage;
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
let xp = 0;
const solved = new Set();
async function refresh(grade) {
  const objects = await toObjects(play.world);
  play.objects = objects;
  const open = grade ? !grade.passed : true;
  hud.set(summarise(objects, { openTickets: open ? 1 : 0, xp }));
  setTicket(open);
  if (office) {
    office.seed(objects, CLOCK); // SEAM: Task 9 plays the diff instead of re-seating everyone
    const clashIds = clashingRooms(objects);
    office.setRooms(new Set(objects.rooms.filter((r) => clashIds.has(r.id)).map((r) => r.name)));
  }
  return objects;
}
async function loadWorld() {
  const old = play.world;
  play.ready = false;
  try {
    play.world = await startProblem(problem);
    const grade = await gradeProblem(play.world, problem);
    await refresh(grade);
    if (office) { office.drone.reset(); office.drone.root.position.copy(office.rest); }
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
  if (play.busy) return;
  if (!play.world || !play.ready) { show('is-miss', 'The game is not ready yet.'); return; }
  const code = editor.value;
  if (!code.trim() || code === STARTERS[lang]) { show('is-miss', 'Write some code first.'); return; }
  setBusy(true);
  try {
    show('is-running', lang === 'php' ? 'Loading PHP, then running…' : 'Running…');
    const before = JSON.stringify(play.objects);
    const res = await runSolution(play.world, lang, code);
    if (!res.ok) { show('is-error', res.error); return; } // an error changes nothing: no scene events
    const grade = await gradeProblem(play.world, problem);
    const first = grade.passed && !solved.has(problem.id);
    if (first) { solved.add(problem.id); xp += 10; }
    const objects = await refresh(grade);
    const changed = JSON.stringify(objects) !== before;
    const out = lang === 'sql' ? rowsTable(res.rows) : (res.logs?.length || res.stdout) ? `<pre class="out">${esc((res.logs || []).join('\n') || res.stdout)}</pre>` : '';
    if (grade.passed) {
      show('is-win', `Solved. The room is clear.${first ? ' +10 XP' : ''}`, out);
      if (office && changed) office.drone.celebrate(); // SEAM: Task 9's story replaces this minimal reaction
    } else if (!changed) {
      show('is-miss', 'Your code ran. Nothing in the world changed.', out);
    } else {
      show('is-miss', `Not yet: ${grade.results.filter((x) => !x.ok).map((x) => x.name).join(' · ')}`, out);
    }
  } catch (e) {
    show('is-error', String(e?.message ?? e));
  } finally {
    setBusy(false);
  }
}
async function onReset() {
  if (play.busy) return;
  setBusy(true);
  try { await loadWorld(); } finally { setBusy(false); }
}

// ---------------------------------------------------------------- measuring (tests and the report)
play.scene = { occupants: () => (office ? office.occupants() : []) };
play.stats = () => (office ? office.stats() : null);
play.bench = (n) => (office ? office.bench(n) : null);
play.resetView = () => { if (!office) return; focusOn = false; hud.setFocus(false); stage.resetView(); office.frame(wins.rects(), hudHeight()); };
play.windows = wins;

setBusy(true);
await startScene();
await loadWorld();
setBusy(false);
