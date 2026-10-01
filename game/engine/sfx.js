/* Synthesised sound effects: warm, soft, short. Every effect is built from oscillators, a shared
   noise buffer, filters and gain envelopes, so nothing is downloaded.

     play(name, { pan, gain })   one-shot effect (no-op returning null before the first gesture,
                                 or when the same effect played under 60 ms ago)
     startLoop('drone-hum') / setLoopParam('drone-hum', 'speed', 0..1) / stopLoop('drone-hum')
     synth(ctx, out, name, t0)   the pure builder, for any (Offline)AudioContext; returns the end time
     createLoop(ctx, out, name, t0) the loop builder, same idea

   Design notes for each sound are next to its builder. Levels are set so that through the effects
   bus at its default 60% the loudest effect peaks well below full scale. */
import { whenReady, getGraph, isRunning, duckGraph, initAudio, getSettings, midiHz, noiseBuffer, rng } from './audio.js';

export const EFFECTS = Object.freeze(['door-chime', 'ticket-pop', 'alert', 'type-click', 'run', 'scan-ok', 'scan-fail', 'success',
  'coin', 'confetti-pop', 'error', 'reopen', 'level-up', 'ui-click', 'window-open', 'window-close']);
export const LOOPS = Object.freeze(['drone-hum']);
export const MAX_EFFECT_SECONDS = 1.2;
const MIN_GAP_MS = 60;
const FX_LEVEL = 2.5; // the voice peaks below are relative; this sets the overall effect loudness

/* ---- voice primitives ---- */

/* A gain envelope: silence, a linear attack to `peak`, an exponential fall to near-silence at `end`. */
function envelope(p, t0, peak, attack, end) {
  p.setValueAtTime(0, t0);
  p.linearRampToValueAtTime(peak, t0 + attack);
  p.exponentialRampToValueAtTime(0.0001, end);
  p.setValueAtTime(0, end + 0.005);
}

function tone(V, { type = 'sine', f, to, glide, t, attack = 0.004, dur, peak, lp, q = 0.7, detune = 0 }) {
  const ac = V.ac, o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + (glide ?? dur));
  o.detune.value = detune;
  envelope(g.gain, t, peak, attack, t + dur);
  let head = o;
  if (lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = q; o.connect(fl); head = fl; }
  head.connect(g); g.connect(V.out);
  o.start(t); o.stop(t + dur + 0.02);
  V.track(o, t + dur + 0.02);
  return o;
}

/* A soft bell: a sine fundamental with a quieter octave and a faint twelfth that die away faster,
   so it starts with a little shimmer and settles into a pure, warm tone. */
function bell(V, t, f, peak, dur) {
  tone(V, { f, t, attack: 0.003, dur, peak });
  tone(V, { f: f * 2.0, t, attack: 0.002, dur: dur * 0.45, peak: peak * 0.28, detune: 3 });
  tone(V, { f: f * 3.0, t, attack: 0.002, dur: dur * 0.2, peak: peak * 0.09 });
}

/* Filtered noise: `type` filter at f (sweeping to f2), envelope as above. */
function noise(V, { t, dur, peak, attack = 0.002, type = 'bandpass', f, f2, q = 1 }) {
  const ac = V.ac, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuffer(ac); s.loop = true; // looped, so a random offset never runs off the end
  fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  envelope(g.gain, t, peak, attack, t + dur);
  s.connect(fl); fl.connect(g); g.connect(V.out);
  const off = V.r() * 1.9;
  s.start(t, off); s.stop(t + dur + 0.02);
  V.track(s, t + dur + 0.02);
}

function voiceSet(ac, out, seed) {
  const V = { ac, out, r: rng(seed), end: 0, last: null };
  V.track = (src, end) => { if (end >= V.end) { V.end = end; V.last = src; } };
  return V;
}

/* ---- the effects ---- */
const m = midiHz;
const BUILD = {
  /* Door chime: a two-note "ding-dong" a major third down (B5 then G5), soft bells, 0.2 s apart. */
  'door-chime'(V, t) { bell(V, t, m(83), 0.2, 0.75); bell(V, t + 0.2, m(79), 0.22, 0.95); },

  /* Ticket pop: a round sine blip gliding up 520 -> 880 Hz in 45 ms, with a tiny low-passed
     noise "pop" under it. */
  'ticket-pop'(V, t) {
    tone(V, { f: 520, to: 880, glide: 0.045, t, attack: 0.003, dur: 0.16, peak: 0.24 });
    noise(V, { t, dur: 0.04, peak: 0.1, type: 'lowpass', f: 1800 });
  },

  /* Alert: two gentle triangle notes (A5, E5) through a 2.6 kHz low-pass; noticeable, never shrill. */
  'alert'(V, t) {
    tone(V, { type: 'triangle', f: m(81), t, attack: 0.008, dur: 0.22, peak: 0.2, lp: 2600 });
    tone(V, { type: 'triangle', f: m(76), t: t + 0.17, attack: 0.008, dur: 0.32, peak: 0.2, lp: 2600 });
    tone(V, { f: m(69), t, attack: 0.01, dur: 0.45, peak: 0.06 });
  },

  /* Type click: a 15 ms band-passed noise tick (2-4 kHz, random) plus a faint sine tick; very quiet. */
  'type-click'(V, t) {
    noise(V, { t, dur: 0.018, peak: 0.05, f: 2000 + V.r() * 2000, q: 1.6, attack: 0.001 });
    tone(V, { f: 1500 + V.r() * 500, t, attack: 0.001, dur: 0.012, peak: 0.015 });
  },

  /* Run: an air swoosh (band-pass noise sweeping 400 -> 2200 Hz) and a rising pluck G5 -> D6. */
  'run'(V, t) {
    noise(V, { t, dur: 0.3, peak: 0.07, attack: 0.08, f: 400, f2: 2200, q: 1.2 });
    tone(V, { type: 'triangle', f: m(79), t: t + 0.05, dur: 0.22, peak: 0.16, lp: 3000 });
    tone(V, { type: 'triangle', f: m(86), t: t + 0.14, dur: 0.38, peak: 0.16, lp: 3000 });
  },

  /* Scan ok: two quick soft sine blips up a fourth (E6 -> A6): a friendly "beep-bip". */
  'scan-ok'(V, t) {
    tone(V, { f: m(88), t, attack: 0.003, dur: 0.09, peak: 0.14 });
    tone(V, { f: m(93), t: t + 0.08, attack: 0.003, dur: 0.18, peak: 0.14 });
  },

  /* Scan fail: two low triangle notes falling a minor third (A4 -> F#4), low-passed at 1.4 kHz,
     the second sagging slightly in pitch. Disappointed, not alarming. */
  'scan-fail'(V, t) {
    tone(V, { type: 'triangle', f: m(69), t, attack: 0.01, dur: 0.16, peak: 0.2, lp: 1400 });
    tone(V, { type: 'triangle', f: m(66), to: m(65.5), t: t + 0.15, attack: 0.01, dur: 0.32, peak: 0.2, lp: 1400 });
  },

  /* Success: a warm C major chord. A soft triangle pad (C4 E4 G4, 30 ms attack, low-passed 1.8 kHz)
     under bells arpeggiated upward (C5 E5 G5 C6, 60 ms apart). */
  'success'(V, t) {
    for (const n of [60, 64, 67]) tone(V, { type: 'triangle', f: m(n), t, attack: 0.03, dur: 1.1, peak: 0.075, lp: 1800 });
    [72, 76, 79, 84].forEach((n, i) => bell(V, t + i * 0.06, m(n), 0.13, 0.95 - i * 0.04));
  },

  /* Coin: the classic two-step B5 -> E6, but in rounded sine/triangle, with a quick decay. */
  'coin'(V, t) {
    tone(V, { type: 'triangle', f: m(83), t, attack: 0.002, dur: 0.08, peak: 0.16, lp: 5000 });
    bell(V, t + 0.07, m(88), 0.17, 0.45);
  },

  /* Confetti pop: a soft "thup" (sine dropping 220 -> 70 Hz plus low-passed noise), then a sprinkle
     of eight tiny high crackles over half a second. */
  'confetti-pop'(V, t) {
    tone(V, { f: 220, to: 70, glide: 0.08, t, attack: 0.002, dur: 0.12, peak: 0.3 });
    noise(V, { t, dur: 0.06, peak: 0.14, type: 'lowpass', f: 1200 });
    for (let k = 0; k < 8; k++) noise(V, { t: t + 0.06 + V.r() * 0.5, dur: 0.03, peak: 0.025 + V.r() * 0.02, type: 'highpass', f: 4500 + V.r() * 3000 });
  },

  /* Error: soft. Two sine/triangle notes falling E4 -> C4, low-passed at 900 Hz, gentle 12 ms attack. */
  'error'(V, t) {
    tone(V, { type: 'triangle', f: m(64), t, attack: 0.012, dur: 0.2, peak: 0.18, lp: 900 });
    tone(V, { type: 'triangle', f: m(60), t: t + 0.16, attack: 0.012, dur: 0.38, peak: 0.18, lp: 900 });
  },

  /* Reopen: a ticket comes back. A soft wooden knock (band-passed noise at 700 Hz) then a triangle
     note that glides down C5 -> G4: "oh, one more thing". */
  'reopen'(V, t) {
    noise(V, { t, dur: 0.05, peak: 0.16, f: 700, q: 3 });
    noise(V, { t: t + 0.12, dur: 0.05, peak: 0.12, f: 650, q: 3 });
    tone(V, { type: 'triangle', f: m(72), to: m(67), glide: 0.35, t: t + 0.2, attack: 0.02, dur: 0.6, peak: 0.16, lp: 2000 });
  },

  /* Level up: a quick bell arpeggio up the major chord (C5 E5 G5 C6 E6, 70 ms apart) over a soft
     G3-C4 triangle bed, with a faint high shimmer (high-passed noise at 7 kHz). */
  'level-up'(V, t) {
    for (const n of [55, 60]) tone(V, { type: 'triangle', f: m(n), t, attack: 0.04, dur: 1.1, peak: 0.06, lp: 1500 });
    [72, 76, 79, 84, 88].forEach((n, i) => bell(V, t + i * 0.07, m(n), 0.11, 0.8 - i * 0.03));
    noise(V, { t: t + 0.25, dur: 0.8, peak: 0.018, attack: 0.2, type: 'highpass', f: 7000 });
  },

  /* UI click: a tiny soft tick, 1.2 kHz sine for 25 ms plus a 6 ms noise tick. */
  'ui-click'(V, t) {
    tone(V, { f: 1200, t, attack: 0.001, dur: 0.025, peak: 0.07 });
    noise(V, { t, dur: 0.008, peak: 0.04, f: 3500, q: 1 });
  },

  /* Window open: a short upward swish (noise 600 -> 2400 Hz) and a sine blip 660 -> 990 Hz. */
  'window-open'(V, t) {
    noise(V, { t, dur: 0.18, peak: 0.06, attack: 0.05, f: 600, f2: 2400, q: 1.4 });
    tone(V, { f: 660, to: 990, glide: 0.08, t: t + 0.03, dur: 0.16, peak: 0.1 });
  },

  /* Window close: the mirror image, down (noise 2400 -> 600 Hz, sine 880 -> 587 Hz). */
  'window-close'(V, t) {
    noise(V, { t, dur: 0.16, peak: 0.05, attack: 0.04, f: 2400, f2: 600, q: 1.4 });
    tone(V, { f: 880, to: 587, glide: 0.08, t: t + 0.02, dur: 0.14, peak: 0.09 });
  },
};

/* Build one effect into `out` starting at t0. Returns { end, last } (last = the source that stops last). */
export function synth(ac, out, name, t0 = ac.currentTime, { seed = (Math.random() * 1e9) | 0 } = {}) {
  const b = BUILD[name];
  if (!b) throw new Error(`unknown effect: ${name}`);
  const lvl = ac.createGain(); lvl.gain.value = FX_LEVEL; lvl.connect(out);
  const V = voiceSet(ac, lvl, seed);
  b(V, t0);
  return { end: V.end, last: V.last };
}

/* ---- the drone hum loop ----
   Two detuned sawtooths (f and 2f + a hair) through a resonant-free low-pass, a sine sub-octave,
   and band-passed "propeller air" noise; a 6 Hz amplitude wobble. Speed 0..1 moves the pitch
   90 -> 160 Hz, opens the filter 450 -> 1150 Hz and lifts the level. */
export function createLoop(ac, out, name = 'drone-hum', t0 = ac.currentTime) {
  if (name !== 'drone-hum') throw new Error(`unknown loop: ${name}`);
  const level = ac.createGain(); level.gain.setValueAtTime(0, t0);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5;
  const a = ac.createOscillator(); a.type = 'sawtooth';
  const b = ac.createOscillator(); b.type = 'sawtooth'; b.detune.value = 7;
  const sub = ac.createOscillator(); sub.type = 'sine';
  const subG = ac.createGain(); subG.gain.value = 0.6;
  const bG = ac.createGain(); bG.gain.value = 0.35;
  const wob = ac.createOscillator(); wob.frequency.value = 6;
  const wobG = ac.createGain(); wobG.gain.value = 0.12;
  const trem = ac.createGain(); trem.gain.value = 1;
  const air = ac.createBufferSource(); air.buffer = noiseBuffer(ac); air.loop = true;
  const airF = ac.createBiquadFilter(); airF.type = 'bandpass'; airF.Q.value = 0.9; airF.frequency.value = 1300;
  const airG = ac.createGain();
  a.connect(lp); b.connect(bG); bG.connect(lp); sub.connect(subG); subG.connect(trem); lp.connect(trem);
  wob.connect(wobG); wobG.connect(trem.gain);
  air.connect(airF); airF.connect(airG); airG.connect(level);
  trem.connect(level); level.connect(out);
  const srcs = [a, b, sub, wob, air];
  for (const s of srcs) s.start(t0);

  let speed = 0.3;
  function apply(t, tc = 0.12) {
    const f = 90 + 70 * speed;
    a.frequency.setTargetAtTime(f, t, tc);
    b.frequency.setTargetAtTime(f * 2.003, t, tc);
    sub.frequency.setTargetAtTime(f / 2, t, tc);
    lp.frequency.setTargetAtTime(450 + 700 * speed, t, tc);
    airG.gain.setTargetAtTime(0.25 + 0.5 * speed, t, tc);
    wob.frequency.setTargetAtTime(5 + 3 * speed, t, tc);
  }
  const f0 = 90 + 70 * speed;
  a.frequency.value = f0; b.frequency.value = f0 * 2.003; sub.frequency.value = f0 / 2; lp.frequency.value = 450 + 700 * speed;
  airG.gain.value = 0.25 + 0.5 * speed;
  apply(t0, 0.01);
  level.gain.setTargetAtTime(0.09, t0, 0.15); // fade in
  let stopped = false;
  return {
    set(param, v, t = ac.currentTime) {
      if (stopped) return;
      if (param === 'speed') { speed = Math.min(1, Math.max(0, +v || 0)); apply(t); }
      else if (param === 'level') level.gain.setTargetAtTime(0.09 * Math.max(0, +v), t, 0.1);
    },
    stop(t = ac.currentTime, fade = 0.35) {
      if (stopped) return t; stopped = true;
      level.gain.cancelScheduledValues(t);
      level.gain.setTargetAtTime(0, t, fade / 4);
      for (const s of srcs) s.stop(t + fade + 0.05);
      a.onended = () => { try { level.disconnect(); } catch { /* gone */ } };
      return t + fade + 0.05;
    },
    get speed() { return speed; },
    get level() { return level.gain.value; },
  };
}

/* ---- the live API ---- */
const lastPlayed = new Map();
const loops = new Map();
const DUCK = {
  'type-click': 0, 'ui-click': 0,
  'ticket-pop': 0.75, 'run': 0.75, 'scan-ok': 0.8, 'window-open': 0.8, 'window-close': 0.8,
};
const QUIET_WHEN_CALM = new Set(['type-click']);

function chain(ac, bus, pan = 0, gain = 1, alwaysPan = false) {
  const g = ac.createGain(); g.gain.value = gain;
  let head = g, panner = null;
  if ((pan || alwaysPan) && ac.createStereoPanner) { panner = ac.createStereoPanner(); panner.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(panner); head = panner; }
  head.connect(bus);
  return { input: g, panner, dispose() { try { g.disconnect(); if (head !== g) head.disconnect(); } catch { /* gone */ } } };
}

/* Play an effect now. Returns { name, end, ended: Promise } or null (not running yet, throttled,
   or skipped by the calm option). */
export function play(name, { pan = 0, gain = 1 } = {}) {
  if (!BUILD[name]) throw new Error(`unknown effect: ${name}`);
  initAudio();
  if (!isRunning()) return null;
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? -1e9) < MIN_GAP_MS) return null;
  if (getSettings().calm && QUIET_WHEN_CALM.has(name)) return null;
  lastPlayed.set(name, now);
  const gr = getGraph(), ac = gr.ctx, t = ac.currentTime + 0.005;
  const c = chain(ac, gr.effects, pan, gain);
  const r = synth(ac, c.input, name, t);
  const depth = DUCK[name] ?? 0.5;
  if (depth) duckGraph(gr, { at: t, depth, hold: Math.min(0.6, r.end - t) });
  const ended = new Promise((res) => { r.last.onended = () => { c.dispose(); res(); }; });
  return { name, end: r.end, ended };
}

/* Loops fade out while the tab is hidden and back in when it returns. */
let loopVisibilityHooked = false;
function hookLoopVisibility() {
  if (loopVisibilityHooked || typeof document === 'undefined') return;
  loopVisibilityHooked = true;
  document.addEventListener('visibilitychange', () => {
    for (const e of loops.values()) if (!e.pending) e.loop.set('level', document.hidden ? 0 : 1);
  });
}

export function startLoop(name = 'drone-hum', { pan = 0, speed } = {}) {
  initAudio();
  hookLoopVisibility();
  if (loops.has(name)) { if (speed != null) setLoopParam(name, 'speed', speed); return name; }
  const entry = { pending: true, pan, speed };
  loops.set(name, entry);
  whenReady((ac, gr) => {
    if (loops.get(name) !== entry) return; // stopped before audio was ready
    entry.chain = chain(ac, gr.effects, entry.pan, 1, true); // a loop can move: it always has a panner
    entry.loop = createLoop(ac, entry.chain.input, name, ac.currentTime);
    entry.pending = false;
    if (entry.speed != null) entry.loop.set('speed', entry.speed);
    if (document.hidden) entry.loop.set('level', 0);
  });
  return name;
}
export function setLoopParam(name, param, value) {
  const e = loops.get(name);
  if (!e) return;
  if (e.pending) { if (param === 'speed') e.speed = value; else if (param === 'pan') e.pan = value; return; }
  if (param === 'pan') { const p = e.chain.panner; if (p) p.pan.setTargetAtTime(Math.max(-1, Math.min(1, +value || 0)), p.context.currentTime, 0.08); return; }
  e.loop.set(param, value);
}
export function stopLoop(name = 'drone-hum') {
  const e = loops.get(name);
  if (!e) return;
  loops.delete(name);
  if (e.pending) return;
  const end = e.loop.stop();
  setTimeout(() => e.chain.dispose(), Math.max(0, (end - e.chain.input.context.currentTime) * 1000) + 100);
}
export const loopRunning = (name = 'drone-hum') => loops.has(name);
export function loopState(name = 'drone-hum') { const e = loops.get(name); return e && !e.pending ? { speed: e.loop.speed, level: e.loop.level } : null; }
