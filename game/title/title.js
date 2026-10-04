// title.js: the GRIMOIRE title screen at the site root (Task 14). The office at dusk drifts behind the logo; the menu
// leads into the SISO world.
//
//   Start      no SISO save: the intro (game/intro), which then opens the office (game/play)
//   Continue   a SISO save exists (game/title/saves.js decides): straight to the office
//   New game   confirms when a save exists, clears the save keys (saves.js), then plays the intro
//   Settings   volume, music, mute (game/engine/audio.js) and the colour preset (game/engine/theme.js PRESETS)
//   Watch intro  the intro, coming back here at the end
//   The old Library  library.html (the old app, moved off the root)
// Every link is relative to this page, so it works on a subpath (GitHub Pages serves the site at /Grimoire/). The
// intro only follows a ?next= that is a path on this site ("/..."), so the next path is this page's own URL resolved
// to an absolute path: '/Grimoire/game/play/index.html' when published, '/game/play/index.html' locally.
// Title music is the music engine's normal mood, started by the first gesture (never before one).
// prefers-reduced-motion: the office is drawn still (no drift, no idle animation).
//
//   window.__title = { ready, scene ('on' | 'off' | 'pending'), hasSave, startHref, reducedMotion, saveKeys, drift() (the scene turn, radians),
//                    music() (the music engine's state) }
import { SAVE_KEYS, hasSave, clearSave, localStore } from './saves.js';
import { exportSave, previewImport, applyImport, downloadSave } from '../sync/file.js';
import { localAdapter } from '../sync/local.js';

const $ = (id) => document.getElementById(id);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = localStore();
const here = (rel) => new URL(rel, location.href);
const PLAY = 'game/play/index.html';
const introHref = (nextRel) => `game/intro/index.html?next=${encodeURIComponent(here(nextRel).pathname)}`;

const api = window.__title = { ready: false, scene: 'pending', hasSave: false, startHref: '', reducedMotion: RM, saveKeys: SAVE_KEYS };

// ---------------------------------------------------------------- the menu
function refresh() {
  const saved = hasSave(store);
  api.hasSave = saved;
  const start = $('start');
  start.textContent = saved ? 'Continue' : 'Start';
  start.href = saved ? PLAY : introHref(PLAY);
  api.startHref = start.getAttribute('href');
  const note = $('save-note');
  note.hidden = !saved;
  note.textContent = saved ? 'Your company is waiting where you left it.' : '';
}
$('watch-intro').href = introHref('./');

function newGame() {
  clearSave(store);
  refresh();
  location.href = introHref(PLAY);
}
const confirmDlg = $('confirm-new');
$('new-game').addEventListener('click', () => {
  if (!hasSave(store)) { newGame(); return; }
  confirmDlg.returnValue = '';
  if (typeof confirmDlg.showModal === 'function') confirmDlg.showModal();
  else if (window.confirm('Start a new game? This clears the company\'s progress and your Grimoire.')) newGame();
});
confirmDlg.addEventListener('close', () => { if (confirmDlg.returnValue === 'clear') newGame(); });

// ---------------------------------------------------------------- settings (audio and colours)
const settingsDlg = $('settings');
let audio = null, themeMod = null;
async function loadSettingsModules() {
  if (!audio) audio = await import('../engine/audio.js').catch(() => null);
  if (!themeMod) themeMod = await import('../engine/theme.js').catch(() => null);
}
function fillSettings() {
  if (audio) {
    const s = audio.getSettings();
    $('vol-master').value = Math.round(s.master * 100); $('vol-master-out').textContent = $('vol-master').value;
    $('vol-music').value = Math.round(s.music * 100); $('vol-music-out').textContent = $('vol-music').value;
    $('mute').checked = !!s.muted;
  }
  if (themeMod) {
    const sel = $('preset');
    if (!sel.options.length) for (const name of Object.keys(themeMod.PRESETS)) sel.add(new Option(name, name));
    sel.value = currentPreset() || '';
  }
}
// which preset the saved theme matches (the last one applied is remembered beside the theme for the menu)
const PRESET_KEY = 'grimoire.title.preset.v1';
function currentPreset() { try { return store?.getItem(PRESET_KEY) || 'Warm dusk'; } catch { return 'Warm dusk'; } }
$('open-settings').addEventListener('click', async () => {
  await loadSettingsModules();
  fillSettings();
  if (typeof settingsDlg.showModal === 'function') settingsDlg.showModal(); else settingsDlg.setAttribute('open', '');
});
for (const [id, bus] of [['vol-master', 'master'], ['vol-music', 'music']]) {
  $(id).addEventListener('input', (e) => { $(`${id}-out`).textContent = e.target.value; audio?.setVolume(bus, Number(e.target.value) / 100); });
}
settingsDlg.addEventListener('close', () => audio?.flushAudioSettings?.());
$('mute').addEventListener('change', (e) => audio?.setMuted(e.target.checked));
$('preset').addEventListener('change', (e) => {
  themeMod?.applyPreset(e.target.value);
  try { store?.setItem(PRESET_KEY, e.target.value); } catch { /* storage off */ }
});

// ---------------------------------------------------------------- your game: export and import a save file
// All the rules live in game/sync (doc.js validates, merge.js merges, file.js reads and writes); this only shows them.
const local = localAdapter(store);
const importPanel = $('import-panel'), importMsg = $('import-msg');
let pendingText = null;
function importState(msg, { bad = false, choices = false, confirm = false } = {}) {
  importPanel.hidden = !msg;
  importMsg.textContent = msg || ''; importMsg.classList.toggle('bad', bad);
  $('import-choices').hidden = !choices; $('import-confirm').hidden = !confirm;
  if (!choices && !confirm) pendingText = null;
}
$('export-save').addEventListener('click', () => {
  const out = exportSave({ readLocal: local.readLocal });
  if (!out.ok) { importState(out.error, { bad: true }); return; }
  downloadSave(out);
  importState(`Saved ${out.filename}. Keep it somewhere safe, or open it on your other device.`);
});
$('import-save').addEventListener('click', () => { $('import-file').value = ''; $('import-file').click(); });
$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  let text = '';
  try { text = await file.text(); } catch { text = ''; }
  const p = previewImport(text);
  if (!p.ok) { importState(`${p.error} Nothing was changed.`, { bad: true }); return; }
  const s = p.summary;
  pendingText = text;
  importState(`This save: ${s.daysInBusiness} day${s.daysInBusiness === 1 ? '' : 's'} in business, ${s.solves} ticket${s.solves === 1 ? '' : 's'} solved, ${s.spells} spell${s.spells === 1 ? '' : 's'} written, £${s.balance} saved. Merge keeps the best of this device and the file.`, { choices: true });
});
function doImport(mode) {
  const r = applyImport(pendingText, { mode, confirmed: mode === 'replace', readLocal: local.readLocal, writeLocal: local.writeLocal });
  if (!r.ok) { importState(`${r.error} Nothing was changed.`, { bad: true }); return; }
  importState(r.changed ? (mode === 'merge' ? 'Merged. Your progress is on this device now.' : 'Replaced. This device now has the imported game.') : 'Nothing to change: this device already has all of it.');
  refresh();
}
$('import-merge').addEventListener('click', () => doImport('merge'));
$('import-replace').addEventListener('click', () => { $('import-choices').hidden = true; $('import-confirm').hidden = false; });
$('import-cancel').addEventListener('click', () => importState('Kept what is on this device.'));
$('import-replace-yes').addEventListener('click', () => doImport('replace'));
settingsDlg.addEventListener('close', () => importState(''));

// ---------------------------------------------------------------- title music: normal mood, after the first gesture
import('../engine/music.js').then((m) => { m.setMood('normal'); m.start(); api.music = () => m.musicState(); }).catch(() => { /* no sound: the title still works */ });

// ---------------------------------------------------------------- the office at dusk, behind the menu
async function startScene() {
  const canvas = $('backdrop');
  try {
    const [{ createStage }, { createOffice }] = await Promise.all([import('../engine/renderer.js'), import('../play/office.js')]);
    let stage;
    try { stage = createStage(canvas, { reducedMotion: RM }); } catch { api.scene = 'off'; return; }
    const office = createOffice(stage, { reducedMotion: RM });
    const cam = stage.camera;
    const phone = () => matchMedia('(max-width: 720px)').matches;
    // fit the office into the part of the screen the menu leaves free
    const frame = () => {
      const W = canvas.clientWidth || innerWidth, H = canvas.clientHeight || innerHeight;
      if (phone()) {
        const top = $('brand').getBoundingClientRect().bottom + 4, bottom = $('menu').getBoundingClientRect().top - 4;
        const band = Math.max(H * 0.28, bottom - top);
        office.frame([], Math.max(0, H - band));
        // the fit above sizes the office to the band but centres it at H - band / 2; centre it in the band instead
        cam.setViewOffset(W, H, 0, (H / 2) - (top + band / 2), W, H);
      } else {
        const r = $('front').getBoundingClientRect();
        office.frame([{ x: 0, y: 0, w: r.right, h: H }], 24);
      }
      cam.updateProjectionMatrix();
    };
    frame();
    addEventListener('resize', frame);
    office.update(0, 0);
    let t0 = 0;
    stage.frame((dt, t) => {
      if (RM) return; // reduced motion: a still picture
      t0 = t0 || t;
      office.update(dt, t);
      const k = t - t0;
      stage.scene.rotation.y = Math.sin(k * 0.06) * 0.16; // a slow, gentle drift around the office
    });
    $('title-app').classList.add('scene-on');
    api.drift = () => stage.scene.rotation.y;
    api.scene = 'on';
  } catch (e) {
    console.warn('the title backdrop could not start', e);
    api.scene = 'off';
  }
}

refresh();
addEventListener('pageshow', refresh); // back from the play page: Start may have become Continue
addEventListener('storage', refresh);
api.ready = true;
startScene();
