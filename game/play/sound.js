// sound.js: the play page's sound. It plays the engine's synthesised effects on the page's real events
// and runs the music bed; it never looks at the expected answer.
//
//   createSound({ stage, office, story, editor, isBusy, reducedMotion }) -> sound
//     stage/office/story are getters (the 3D office loads later, and may never load)
//     .cue(name, at?)      an effect now, panned from a scene point [x, y, z] (story.js and main.js call this)
//     .mountSpeaker(hudEl) the HUD's mute button (aria-pressed, label follows the state)
//     .attachPanel(panelEl) the volume sliders (master, music, effects), calm audio and mute in the tweak panel
//     .attention()         the ticket still needs attention (a failed check): alert, unless a red scan just said it
//     .log                 every effect asked for, in order: { name, played, at } (tests read it)
//
// What drives what:
//   story.js cues  door-chime (someone comes in or goes out of the front door), scan-ok (a room calms),
//                  alert (a room starts to clash)
//   main.js cues   run (code submitted), error (the code failed), level-up (the level went up)
//   watched here   the drone: its hum follows its real speed while it is busy (pitch and pan), its scan
//                  verdicts (scan-ok / scan-fail when the beam turns green or red), its celebration (coin and
//                  confetti-pop); the ticket card: ticket-pop when one appears, success when it is stamped
//                  RESOLVED (the music celebrates), reopen when it goes back to OPEN; the editor: a quiet
//                  type-click per keystroke and the music in focus while typing; ui-click on the HUD and
//                  code-window buttons; window-open / window-close when the tweak panel or the Grimoire opens.
import * as audio from '../engine/audio.js';
import * as sfx from '../engine/sfx.js';
import * as music from '../engine/music.js';

const HUM_TOP_SPEED = 3.2; // scene units a second that count as full speed for the hum's pitch
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ICON_ON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5m0-5-5 5"/></svg>';
const WINDOWS = '.gm-tweak, .gm-book-overlay';
const CLICKY = '#hud button, .lang-tab, #win-code #reset, .gm-tweak-btn, .gm-tweak button';

export function createSound({ stage = () => null, office = () => null, story = () => null, editor = null, isBusy = () => false, reducedMotion = false } = {}) {
  audio.initAudio();
  music.setDistrict('office');
  music.start(); // waits for the first gesture
  const log = [];

  // pan: where the point is across the screen (the camera's view), gently
  function panOf(at) {
    const cam = stage()?.camera;
    if (!at || !cam) return 0;
    const [x, y, z] = at;
    const v = cam.matrixWorldInverse.elements, p = cam.projectionMatrix.elements;
    const vx = v[0] * x + v[4] * y + v[8] * z + v[12], vy = v[1] * x + v[5] * y + v[9] * z + v[13];
    const vz = v[2] * x + v[6] * y + v[10] * z + v[14];
    const cx = p[0] * vx + p[4] * vy + p[8] * vz + p[12], cw = p[3] * vx + p[7] * vy + p[11] * vz + p[15];
    return cw > 1e-6 ? clamp((cx / cw) * 0.7, -0.75, 0.75) : 0;
  }
  const worldOf = (obj) => { if (!obj) return null; obj.updateWorldMatrix?.(true, false); const e = obj.matrixWorld.elements; return [e[12], e[13], e[14]]; };

  function cue(name, at = null, { gain = 1 } = {}) {
    const h = sfx.play(name, { pan: panOf(at), gain });
    log.push({ name, played: !!h, at: performance.now() });
    if (log.length > 400) log.splice(0, log.length - 400);
    if (name === 'success' && h) music.setMood('celebrate');
    return h;
  }

  // ---- the editor: quiet keys, focused music ----
  editor?.addEventListener('input', () => { cue('type-click', null, { gain: 0.8 }); music.typing(); });

  // ---- buttons and windows ----
  document.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest(CLICKY) : null;
    if (b && b.id !== 'hud-sound' && !b.disabled) cue('ui-click');
  }, true);
  new MutationObserver((rows) => {
    for (const r of rows) {
      const el = r.target;
      if (!(el instanceof Element) || !el.matches(WINDOWS)) continue;
      if (r.oldValue === null && el.hidden) cue('window-close');
      else if (r.oldValue !== null && !el.hidden) cue('window-open');
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'], attributeOldValue: true });

  // ---- when sound wakes up with a ticket waiting, say so once ----
  audio.whenReady(() => setTimeout(() => {
    const t = story()?.ticket;
    if (t && t.state === 'OPEN' && !isBusy()) cue('alert', worldOf(t.root));
  }, 350));

  // ---- watching the drone and the ticket card, every frame ----
  let hum = false, idleFor = 0, last = null, lastT = 0, verdictSaid = false, droneState = 'idle';
  let card = null, cardState = null;
  function watch(now) {
    requestAnimationFrame(watch);
    const dt = lastT ? Math.min(0.25, (now - lastT) / 1000) : 0;
    lastT = now;
    const o = office(), s = story();
    if (o?.drone) {
      const d = o.drone, pos = worldOf(d.root);
      // the hum: on while the drone is busy, its pitch from how fast it really moves
      if (d.state !== 'idle') {
        idleFor = 0;
        const v = last && dt > 0 ? Math.hypot(pos[0] - last[0], pos[2] - last[2]) / dt : 0;
        if (!hum) { sfx.startLoop('drone-hum', { speed: 0.2, pan: panOf(pos) }); hum = true; }
        sfx.setLoopParam('drone-hum', 'speed', clamp(v / HUM_TOP_SPEED, 0, 1));
        sfx.setLoopParam('drone-hum', 'pan', panOf(pos));
      } else if (hum && (idleFor += dt) > 0.35) { sfx.stopLoop('drone-hum'); hum = false; }
      last = pos;
      // a scan's verdict, the moment the beam turns
      if (d.state === 'scan') {
        if (d.verdict === true || d.verdict === false) { if (!verdictSaid) { cue(d.verdict ? 'scan-ok' : 'scan-fail', pos); verdictSaid = true; } }
        else verdictSaid = false;
      } else verdictSaid = false;
      // the celebration: coins and (with motion) confetti
      if (d.state === 'celebrate' && droneState !== 'celebrate') {
        cue('coin', pos);
        if (!reducedMotion) setTimeout(() => cue('confetti-pop', worldOf(d.root)), 160);
      }
      droneState = d.state;
    }
    // the ticket card: appears, resolved, reopened
    const t = s?.ticket || null;
    if (t !== card) {
      card = t; cardState = t?.state ?? null;
      if (t && t.state === 'OPEN') cue('ticket-pop', worldOf(t.root));
    } else if (t && t.state !== cardState) {
      const was = cardState; cardState = t.state;
      if (t.state === 'RESOLVED') cue('success', worldOf(t.root));
      else if (was === 'RESOLVED' && t.state === 'OPEN') cue('reopen', worldOf(t.root));
    }
  }
  requestAnimationFrame(watch);

  // ---- the speaker button ----
  function mountSpeaker(hudEl) {
    const right = hudEl.querySelector('.hud-right') || hudEl;
    if (!document.getElementById('hud-sound-css')) {
      // the button's own look; on a phone the HUD's buttons may wrap to a second row rather than overflow
      const st = document.createElement('style'); st.id = 'hud-sound-css';
      st.textContent = '#hud-sound{display:inline-flex;align-items:center;justify-content:center;padding:0 10px;color:var(--gold)}#hud-sound.is-on{color:var(--ink)}'
        + '@media (max-width:720px){#hud-sound{padding:0 8px}#hud .hud-right{flex-wrap:wrap;row-gap:6px}}';
      document.head.appendChild(st);
    }
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'hud-btn hud-sound'; b.id = 'hud-sound';
    const paint = () => {
      const m = audio.getSettings().muted;
      b.innerHTML = m ? ICON_OFF : ICON_ON;
      b.setAttribute('aria-pressed', String(m));
      b.setAttribute('aria-label', m ? 'Sound off: turn sound on' : 'Sound on: mute');
      b.title = m ? 'Sound is off (click to turn it on)' : 'Mute sound';
      b.classList.toggle('is-on', m);
    };
    b.addEventListener('click', () => { audio.toggleMuted(); paint(); if (!audio.getSettings().muted) cue('ui-click'); });
    audio.onAudioChange(paint);
    paint();
    right.insertBefore(b, right.querySelector('button'));
    return b;
  }

  // ---- the volumes in the tweak panel ----
  function attachPanel(panel) {
    if (!panel || panel.querySelector('.gm-sound')) return;
    const box = document.createElement('div');
    box.className = 'gm-sound';
    box.innerHTML = '<h4>Sound</h4>'
      + [['master', 'Master'], ['music', 'Music'], ['effects', 'Effects']].map(([k, l]) =>
        `<div class="tw"><label for="gm-snd-${k}">${l}</label><input id="gm-snd-${k}" data-snd="${k}" type="range" min="0" max="1" step="0.01"><output></output></div>`).join('')
      + '<div class="tw"><label for="gm-snd-calm" title="Softer effects, no typing clicks">Calm audio</label><input id="gm-snd-calm" data-snd="calm" type="checkbox"><output></output></div>'
      + '<div class="tw"><label for="gm-snd-muted">Mute</label><input id="gm-snd-muted" data-snd="muted" type="checkbox"><output></output></div>';
    const fields = panel.querySelector('.fields');
    panel.insertBefore(box, fields || null);
    const sync = () => {
      const s = audio.getSettings();
      for (const i of box.querySelectorAll('[data-snd]')) {
        const k = i.dataset.snd;
        if (i.type === 'checkbox') i.checked = !!s[k];
        else { i.value = s[k]; i.nextElementSibling.textContent = `${Math.round(s[k] * 100)}%`; }
      }
    };
    for (const i of box.querySelectorAll('[data-snd]')) {
      i.addEventListener('input', () => {
        const k = i.dataset.snd;
        audio.setSettings({ [k]: i.type === 'checkbox' ? i.checked : parseFloat(i.value) });
      });
    }
    audio.onAudioChange(sync);
    sync();
  }

  /* the ticket still needs attention after a run (the checks failed): an alert, unless the drone's red
     scan already said so a moment ago */
  function attention() {
    const now = performance.now();
    if (log.some((e) => e.name === 'scan-fail' && e.played && now - e.at < 2500)) return null;
    const t = story()?.ticket;
    return cue('alert', t ? worldOf(t.root) : null);
  }

  return { cue, attention, mountSpeaker, attachPanel, log, panOf };
}
