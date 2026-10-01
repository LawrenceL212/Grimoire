/* The audio engine: one AudioContext, created and resumed on the first user gesture (browser
   autoplay rules), with master, music and effects buses, a small generated-impulse reverb, a
   soft limiter, ducking, a calm option and a hidden-tab fade. Settings persist (try/catch).

   Graph (built the same way in a live or an OfflineAudioContext by createGraph):
     music  -> duck -> fade -> master          effects -> master
     music  -> reverb send ---\                effects -> reverb send --> convolver -> master
     master -> limiter (DynamicsCompressor) -> destination (+ analyser tap)

   Nothing here makes a sound by itself; sfx.js and music.js schedule voices into the buses. */

const KEY = 'grimoire.audio.v1';
export const AUDIO_DEFAULTS = Object.freeze({ master: 0.8, music: 0.3, effects: 0.6, muted: false, calm: false });
const CALM_EFFECTS = 0.45; // the calm option keeps effects but at under half their level

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s === 'object') {
      const out = { ...AUDIO_DEFAULTS };
      for (const k of ['master', 'music', 'effects']) if (Number.isFinite(s[k])) out[k] = Math.min(1, Math.max(0, s[k]));
      for (const k of ['muted', 'calm']) if (typeof s[k] === 'boolean') out[k] = s[k];
      return out;
    }
  } catch { /* unreadable settings fall back to the defaults */ }
  return { ...AUDIO_DEFAULTS };
}
/* Writes are coalesced (a slider drag fires dozens of changes): at most one write per 300 ms,
   always the latest values, and flushed when the page is hidden or unloaded. */
let saveTimer = null;
export function flushAudioSettings() {
  clearTimeout(saveTimer); saveTimer = null;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage off: keep going */ }
}
function saveSettings() { if (!saveTimer) saveTimer = setTimeout(flushAudioSettings, 300); }
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { if (saveTimer) flushAudioSettings(); });

let settings = loadSettings();
let ctx = null;
let graph = null;
let listening = false;
const readyWaiters = [];
const changeListeners = new Set();

/* ---- the graph, for any BaseAudioContext ---- */

/* A stereo impulse: decaying noise, darkened over time (a one-pole low-pass whose cutoff
   falls), with a short pre-delay. Small room, warm, about 1.6 s. */
export function makeImpulse(ac, seconds = 1.6, seed = 11) {
  const sr = ac.sampleRate, n = Math.floor(sr * seconds);
  const buf = ac.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    const r = rng(seed + ch * 101);
    let y = 0;
    const pre = Math.floor(sr * 0.012);
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr;
      const k = 0.55 * Math.exp(-t * 2.2) + 0.06; // brightness falls as the tail decays
      y += k * ((r() * 2 - 1) - y);
      d[i] = y * Math.exp(-t * 3.2) * 0.9;
    }
  }
  return buf;
}

export function createGraph(ac, s = AUDIO_DEFAULTS) {
  const g = (v) => { const n = ac.createGain(); n.gain.value = v; return n; };
  const master = g(0), music = g(0), effects = g(0), duck = g(1), fade = g(1);
  const musicSend = g(0.32), fxSend = g(0.2), reverbOut = g(0.9);
  const reverb = ac.createConvolver();
  reverb.normalize = true;
  reverb.buffer = makeImpulse(ac);
  const limiter = ac.createDynamicsCompressor();
  limiter.threshold.value = -4; limiter.knee.value = 4; limiter.ratio.value = 16; // a safety net, rarely touched
  limiter.attack.value = 0.002; limiter.release.value = 0.18;
  const analyser = ac.createAnalyser();
  analyser.fftSize = 2048;

  music.connect(duck); duck.connect(fade); fade.connect(master);
  fade.connect(musicSend); musicSend.connect(reverb);
  effects.connect(master); effects.connect(fxSend); fxSend.connect(reverb);
  reverb.connect(reverbOut); reverbOut.connect(master);
  master.connect(limiter); limiter.connect(ac.destination); limiter.connect(analyser);

  const out = { ctx: ac, master, music, effects, duck, fade, reverb, limiter, analyser };
  applyLevels(out, s, true);
  return out;
}

function levels(s) {
  return {
    master: s.muted ? 0 : s.master,
    music: s.music,
    effects: s.effects * (s.calm ? CALM_EFFECTS : 1),
  };
}
function applyLevels(gr, s, now = false) {
  const t = gr.ctx.currentTime, L = levels(s);
  for (const k of ['master', 'music', 'effects']) {
    const p = gr[k].gain;
    if (now) { p.value = L[k]; continue; }
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.setTargetAtTime(L[k], t, 0.06);
  }
}

/* Duck the music bus under an effect: dip to `depth` (0..1 of normal) quickly, hold, recover. */
export function duckGraph(gr, { at, depth = 0.55, hold = 0.25, release = 0.45 } = {}) {
  if (!gr) return;
  const p = gr.duck.gain, t = Math.max(at ?? gr.ctx.currentTime, gr.ctx.currentTime);
  p.cancelScheduledValues(t); // drops a pending recovery; the dip starts from wherever the curve is
  p.setTargetAtTime(depth, t, 0.025);
  p.setTargetAtTime(1, t + hold, release / 3);
}

/* ---- the live engine ---- */

function onGesture() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch { return; }
    graph = createGraph(ctx, settings);
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    ctx.addEventListener?.('statechange', () => { if (ctx.state === 'running') flushReady(); });
    // older iOS only unlocks output once a source has started inside the gesture: one silent sample
    try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); s.connect(ctx.destination); s.start(0); } catch { /* fine */ }
  }
  if (ctx.state !== 'running') ctx.resume().then(flushReady, () => {});
  else flushReady();
}
function flushReady() {
  if (!ctx || ctx.state !== 'running') return;
  while (readyWaiters.length) { try { readyWaiters.shift()(ctx, graph); } catch (e) { console.error(e); } }
}

function onVisibility() {
  if (!graph) return;
  // a context suspended or 'interrupted' (iOS calls, other tabs) is resumed when we come back
  if (!document.hidden && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().then(flushReady, () => {});
  const p = graph.fade.gain, t = ctx.currentTime;
  p.cancelScheduledValues(t);
  p.setValueAtTime(p.value, t);
  p.setTargetAtTime(document.hidden ? 0 : 1, t, document.hidden ? 0.25 : 0.5);
}

/* Install the gesture listeners (idempotent). No AudioContext exists until a gesture. */
export function initAudio() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  for (const ev of ['pointerdown', 'keydown', 'touchend', 'mousedown']) window.addEventListener(ev, onGesture, { capture: true, passive: true });
}

/* Run fn(ctx, graph) once audio is running (now, if it already is). */
export function whenReady(fn) {
  initAudio();
  if (ctx && ctx.state === 'running') fn(ctx, graph);
  else readyWaiters.push(fn);
}

export const getContext = () => ctx;
export const getGraph = () => graph;
export const isRunning = () => !!ctx && ctx.state === 'running';

export function duck(opts = {}) { if (isRunning()) duckGraph(graph, opts); }

export function getSettings() { return { ...settings }; }
export function setSettings(patch) {
  for (const k of ['master', 'music', 'effects']) if (Number.isFinite(patch[k])) settings[k] = Math.min(1, Math.max(0, patch[k]));
  for (const k of ['muted', 'calm']) if (typeof patch[k] === 'boolean') settings[k] = patch[k];
  saveSettings();
  if (graph) applyLevels(graph, settings);
  for (const fn of changeListeners) { try { fn({ ...settings }); } catch (e) { console.error(e); } }
  return getSettings();
}
export const setVolume = (bus, v) => setSettings({ [bus]: v });
export const setMuted = (m) => setSettings({ muted: !!m });
export const toggleMuted = () => setMuted(!settings.muted);
export const setCalm = (c) => setSettings({ calm: !!c });
export function resetAudioSettings() { settings = { ...AUDIO_DEFAULTS }; return setSettings({}); }
export function onAudioChange(fn) { changeListeners.add(fn); return () => changeListeners.delete(fn); }

/* RMS of the output right now (through the limiter), for tests and a level meter. */
export function outputLevel() {
  if (!graph) return 0;
  const a = graph.analyser, d = new Float32Array(a.fftSize);
  a.getFloatTimeDomainData(d);
  let s = 0; for (const v of d) s += v * v;
  return Math.sqrt(s / d.length);
}

/* ---- small shared helpers ---- */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

const noiseCache = new WeakMap();
/* Two seconds of white noise per context, reused by every noisy voice. */
export function noiseBuffer(ac) {
  let b = noiseCache.get(ac);
  if (!b) {
    b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = b.getChannelData(0), r = rng(4242);
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    noiseCache.set(ac, b);
  }
  return b;
}
