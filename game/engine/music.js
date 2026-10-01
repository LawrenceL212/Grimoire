/* Generative lo-fi music bed: soft electric-piano chords, a gentle sine bass, brushed drums and
   the odd bell note, at 70-78 bpm. A seeded random walk picks the chords (a Markov table of
   jazz-pop moves: I-vi-ii-V, IV-iii-vi ...), voicings follow the nearest-note rule, and the rhythm
   of every layer is re-rolled each bar, so it never repeats audibly.

   Adaptive:
     setMood('focus')     thins out while the learner types: no hats or bells, darker keys,
                          bass holds roots, softer kick (layer gains move at once, notes from the next bar)
     setMood('celebrate') brightens for two bars after a solve (bells, open filter, arpeggios), then
                          returns to the mood it came from
     setDistrict(name)    shifts key, tempo and instrumentation (office, lab, gym, school, clinic,
                          hall, coworking; any other name hashes to one of them)
     typing()             a convenience: focus now, back to normal after 6 s without typing

   createMusic(ctx, out, opts) builds the same instrument into any (Offline)AudioContext; the
   module-level start()/stop() drive one live instance on the engine's music bus. */
import { whenReady, initAudio, getSettings, midiHz, noiseBuffer, rng } from './audio.js';

export const DISTRICTS = Object.freeze({
  office:    { root: 41, bpm: 74, mode: 'major',  keys: 'rhodes', cut: 1.0, hats: 1.0, bell: 1.0, swing: 0.6 },
  lab:       { root: 38, bpm: 76, mode: 'dorian', keys: 'glass',  cut: 1.2, hats: 0.8, bell: 1.4, swing: 0.58 },
  gym:       { root: 43, bpm: 78, mode: 'major',  keys: 'rhodes', cut: 1.1, hats: 1.3, bell: 0.7, swing: 0.56, kick: 1.25 },
  school:    { root: 36, bpm: 76, mode: 'major',  keys: 'pluck',  cut: 1.15, hats: 1.0, bell: 1.2, swing: 0.6 },
  clinic:    { root: 39, bpm: 70, mode: 'major',  keys: 'pad',    cut: 0.85, hats: 0.5, bell: 0.8, swing: 0.62, kick: 0.7 },
  hall:      { root: 46, bpm: 72, mode: 'major',  keys: 'pad',    cut: 0.95, hats: 0.6, bell: 1.1, swing: 0.6 },
  coworking: { root: 45, bpm: 75, mode: 'dorian', keys: 'rhodes', cut: 1.0, hats: 1.15, bell: 0.9, swing: 0.6 },
});
const DISTRICT_NAMES = Object.keys(DISTRICTS);
export const MOODS = Object.freeze(['normal', 'focus', 'celebrate']);

const MOOD = {
  //          keys filter  layer gains                         note probabilities
  normal:    { cut: 1500, keys: 1, bass: 1, drums: 1, hats: 1, bell: 1,   pHat: 0.8,  pBell: 0.1,  pRehit: 0.45, pWalk: 0.5, arp: 0,   vel: 1 },
  focus:     { cut: 950,  keys: 0.85, bass: 0.9, drums: 0.6, hats: 0, bell: 0, pHat: 0,    pBell: 0,    pRehit: 0,    pWalk: 0,   arp: 0,   vel: 0.8 },
  celebrate: { cut: 2800, keys: 1.1, bass: 1, drums: 1, hats: 1.2, bell: 1.4, pHat: 0.95, pBell: 0.35, pRehit: 0.6, pWalk: 0.7, arp: 0.7, vel: 1.08 },
};
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10] };
// degrees 0..5 (I ii iii IV V vi); vii is never used
const NEXT = { 0: [3, 5, 1, 2, 3, 5], 1: [4, 4, 2, 0], 2: [5, 3, 1], 3: [4, 2, 0, 1, 4], 4: [0, 0, 5, 2], 5: [1, 3, 4, 1, 2] };
const PENTA = { major: [0, 2, 4, 7, 9], dorian: [0, 3, 5, 7, 10] };

function hashName(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
export function districtProfile(name) {
  if (DISTRICTS[name]) return { name, ...DISTRICTS[name] };
  const k = DISTRICT_NAMES[hashName(name) % DISTRICT_NAMES.length];
  return { name: k, ...DISTRICTS[k] };
}

export function createMusic(ac, out, { seed = (Math.random() * 1e9) | 0, mood = 'normal', district = 'office',
  clock = () => ac.currentTime, shouldPause = () => false, manual = false } = {}) {
  const r = rng(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const gain = (v, to) => { const g = ac.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };

  // instrument buses
  const MUSIC_LEVEL = 0.35; // the bed sits well under the effects even before the bus volume
  const output = gain(1, gain(MUSIC_LEVEL, out));
  const keysF = ac.createBiquadFilter(); keysF.type = 'lowpass'; keysF.Q.value = 0.4; keysF.frequency.value = MOOD[mood].cut;
  const keysTrem = gain(1); const keys = gain(1);
  keys.connect(keysF); keysF.connect(keysTrem); keysTrem.connect(output);
  const trem = ac.createOscillator(); trem.frequency.value = 4.2; const tremD = gain(0.12); trem.connect(tremD); tremD.connect(keysTrem.gain); trem.start();
  const bassF = ac.createBiquadFilter(); bassF.type = 'lowpass'; bassF.frequency.value = 380; bassF.Q.value = 0.5;
  const bass = gain(1); bass.connect(bassF); bassF.connect(output);
  const drums = gain(1, output), hats = gain(1, output), bells = gain(1, output);
  const layer = { keys, bass, drums, hats, bell: bells };

  const st = {
    mood, baseMood: mood === 'celebrate' ? 'normal' : mood, celebrateBars: mood === 'celebrate' ? 2 : 0,
    district: districtProfile(district), degree: 0, voicing: [], bassLast: 0, melody: 2,
    bars: 0, events: 0, eventsLastBar: 0, appliedMood: null, active: 0, skipped: 0, paused: false,
  };

  function applyMood(t, tc = 0.25) {
    const M = MOOD[st.mood], D = st.district;
    keysF.frequency.setTargetAtTime(M.cut * D.cut, t, tc);
    for (const k of Object.keys(layer)) {
      let v = M[k];
      if (k === 'hats') v *= D.hats; if (k === 'bell') v *= D.bell; if (k === 'drums') v *= D.kick ?? 1;
      layer[k].gain.setTargetAtTime(v, t, tc);
    }
    st.appliedMood = st.mood;
  }
  applyMood(ac.currentTime, 0.01);

  /* ---- voices ----
     Each note is a small subgraph hanging off a long-lived layer bus; when its last source ends,
     every node of the note is disconnected so nothing accumulates over a long session. */
  function count() { st.events++; }
  function voiceScope() {
    const nodes = []; let sounding = 0;
    return {
      gain(v, to) { const g = gain(v, to); nodes.push(g); return g; },
      node(n) { nodes.push(n); return n; },
      run(s, t, end, offset) {
        nodes.push(s); sounding++; st.active++;
        s.onended = () => {
          st.active--;
          if (--sounding === 0) for (const n of nodes) { try { n.disconnect(); } catch { /* gone */ } }
        };
        if (offset != null) s.start(t, offset); else s.start(t);
        s.stop(end);
        return s;
      },
    };
  }
  function env(p, t, peak, a, hold, decayTc, len) {
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(peak, t + a);
    p.setTargetAtTime(peak * hold, t + a, decayTc);
    p.setTargetAtTime(0, t + len, 0.12);
  }
  function osc(V, type, f, t, end, to, detune = 0) {
    const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune;
    o.connect(to); return V.run(o, t, end);
  }
  /* Keys. rhodes: sine + a quickly fading 2x "tine" + a quiet triangle; glass: sine + 3x partial;
     pluck: triangle with a short decay; pad: two detuned triangles, slow attack. */
  function keyNote(n, t, len, vel) {
    count();
    const V = voiceScope(), f = midiHz(n), g = V.gain(0, keys), kind = st.district.keys, end = t + len + 0.8;
    if (kind === 'pad') {
      env(g.gain, t, 0.05 * vel, 0.35, 0.8, 1.2, len);
      osc(V, 'triangle', f, t, end, g, -6); osc(V, 'triangle', f, t, end, g, 6);
      return;
    }
    if (kind === 'pluck') {
      env(g.gain, t, 0.07 * vel, 0.006, 0.05, 0.3, len);
      osc(V, 'triangle', f, t, end, g); osc(V, 'sine', f * 2, t, end, g);
      return;
    }
    env(g.gain, t, 0.065 * vel, 0.008, 0.3, 0.6, len);
    osc(V, 'sine', f, t, end, g);
    osc(V, 'triangle', f, t, end, V.gain(0.25, g));
    const bark = V.gain(0, g);
    bark.gain.setValueAtTime(0, t); bark.gain.linearRampToValueAtTime(kind === 'glass' ? 0.35 : 0.45, t + 0.004); bark.gain.setTargetAtTime(0, t + 0.004, kind === 'glass' ? 0.25 : 0.08);
    osc(V, 'sine', f * (kind === 'glass' ? 3 : 2), t, Math.min(end, t + 1.5), bark);
  }
  function bassNote(n, t, len, vel) {
    count();
    const V = voiceScope(), f = midiHz(n), g = V.gain(0, bass), end = t + len + 0.5;
    env(g.gain, t, 0.2 * vel, 0.015, 0.55, 0.4, len);
    osc(V, 'sine', f, t, end, g); osc(V, 'triangle', f, t, end, V.gain(0.22, g));
  }
  function kick(t, vel) {
    count();
    const V = voiceScope(), g = V.gain(0, drums);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22 * vel, t + 0.004); g.gain.setTargetAtTime(0, t + 0.01, 0.07);
    const o = ac.createOscillator(); o.frequency.setValueAtTime(78, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    o.connect(g); V.run(o, t, t + 0.45);
  }
  function brush(t, vel, { f = 2600, q = 0.6, a = 0.015, tc = 0.06, len = 0.35, peak = 0.06, to = drums } = {}) {
    count();
    const V = voiceScope();
    const s = ac.createBufferSource(); s.buffer = noiseBuffer(ac); s.loop = true; // looped: no end-of-buffer click
    const fl = V.node(ac.createBiquadFilter()); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
    const g = V.gain(0, to);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak * vel, t + a); g.gain.setTargetAtTime(0, t + a, tc);
    s.connect(fl); fl.connect(g); V.run(s, t, t + len, r() * 1.9);
  }
  function hat(t, vel) { brush(t, vel, { f: 7500, q: 0.8, a: 0.002, tc: 0.018, len: 0.12, peak: 0.03, to: hats }); }
  function bellNote(n, t, vel) {
    count();
    const V = voiceScope(), f = midiHz(n), g = V.gain(0, bells);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.04 * vel, t + 0.004); g.gain.setTargetAtTime(0, t + 0.004, 0.35);
    osc(V, 'sine', f, t, t + 1.8, g); osc(V, 'sine', f * 2, t, t + 0.6, V.gain(0.15, g));
  }

  /* ---- harmony ---- */
  function chordPcs(degree) {
    const sc = SCALES[st.district.mode];
    return [0, 2, 4, 6].map((k) => sc[(degree + k) % 7] + 12 * Math.floor((degree + k) / 7));
  }
  function voice(pcs) {
    // nearest-note voicing around the previous centre, inside C4-G5-ish
    const centre = st.voicing.length ? st.voicing.reduce((a, b) => a + b, 0) / st.voicing.length : 62;
    const base = st.district.root + 12;
    const notes = pcs.map((p) => {
      let n = base + p; while (n < centre - 6) n += 12; while (n > centre + 6) n -= 12;
      return Math.max(52, Math.min(76, n));
    }).sort((a, b) => a - b);
    return [...new Set(notes)];
  }

  /* ---- one bar ---- */
  function scheduleBar(t) {
    if (st.mood === 'celebrate') { if (st.celebrateBars-- <= 0) st.mood = st.baseMood; }
    if (st.appliedMood !== st.mood) applyMood(t);
    const M = MOOD[st.mood], D = st.district, beat = 60 / D.bpm, bar = beat * 4;
    const ev0 = st.events;
    const sw = (eighth) => (Math.floor(eighth / 2) + (eighth % 2 ? D.swing : 0)) * beat; // swung eighth offset
    const hum = () => r() * 0.012; // a little human timing (late only, never before the bar)

    // the chord: hold for two bars sometimes in focus
    if (st.bars > 0 && !(st.mood === 'focus' && r() < 0.5)) st.degree = pick(NEXT[st.degree]);
    const pcs = chordPcs(st.degree);
    let v = voice(pcs);
    if (st.mood === 'focus' && v.length > 3) v = v.filter((_, i) => i !== 2); // thinner voicing
    st.voicing = v;
    const vel = M.vel * (0.85 + r() * 0.2);

    // keys
    if (M.arp && r() < M.arp) {
      const seq = [...v, v[1] + 12, v[2] + 12];
      for (let e = 0; e < 8; e++) keyNote(seq[e % seq.length], t + sw(e) + hum(), beat * 0.9, vel * 0.8);
      keyNote(v[0], t, bar * 0.9, vel * 0.5);
    } else {
      v.forEach((n, i) => keyNote(n, t + i * 0.018 + hum(), bar * 0.62, vel));
      if (r() < M.pRehit) {
        const at = pick([3, 5, 6]);
        v.forEach((n, i) => keyNote(n, t + sw(at) + i * 0.014 + hum(), beat * 1.2, vel * 0.6));
      }
    }

    // bass
    const root = D.root + chordPcs(st.degree)[0] % 12 + (chordPcs(st.degree)[0] >= 12 ? 12 : 0);
    const low = root > D.root + 7 ? root - 12 : root;
    if (st.mood === 'focus') bassNote(low, t, bar * 0.85, 0.85);
    else {
      bassNote(low, t + hum(), beat * 1.6, 1);
      bassNote(r() < 0.5 ? low + 7 : low, t + sw(4) + hum(), beat * 1.1, 0.8);
      if (r() < M.pWalk) bassNote(low + pick([2, 5, -1, 7]), t + sw(7) + hum(), beat * 0.45, 0.6);
    }
    st.bassLast = low;

    // drums
    const kv = (D.kick ?? 1) * (st.mood === 'focus' ? 0.75 : 1);
    kick(t, kv);
    if (st.mood !== 'focus') { if (r() < 0.7) kick(t + sw(5), kv * 0.7); }
    else if (r() < 0.5) kick(t + 2 * beat, kv * 0.6);
    for (const b of [1, 3]) brush(t + b * beat + hum(), st.mood === 'focus' ? 0.6 : 0.9 + r() * 0.2);
    if (st.mood !== 'focus' && r() < 0.5) brush(t + sw(pick([3, 6, 7])), 0.35, { f: 3200, tc: 0.03 }); // ghost
    if (r() < (st.mood === 'focus' ? 0.25 : 0.55)) brush(t + beat * pick([0, 2]), 0.5, { f: 4200, q: 0.5, a: 0.22, tc: 0.12, len: 0.8, peak: 0.035 }); // a brush sweep
    for (let e = 0; e < 8; e++) if (r() < M.pHat) hat(t + sw(e) + hum(), (e % 2 ? 0.6 : 1) * (0.7 + r() * 0.4));

    // bells: a random walk on the pentatonic, an octave above the keys
    const pent = PENTA[D.mode];
    for (let e = 0; e < 8; e++) {
      if (r() >= M.pBell) continue;
      st.melody = Math.max(0, Math.min(9, st.melody + pick([-2, -1, -1, 1, 1, 2])));
      const n = D.root + 24 + pent[st.melody % 5] + 12 * Math.floor(st.melody / 5);
      bellNote(n, t + sw(e) + hum(), 0.7 + r() * 0.4);
    }

    st.bars++;
    st.eventsLastBar = st.events - ev0;
    return bar;
  }

  /* ---- live scheduling (look-ahead) and offline rendering ---- */
  /* The timer only ever schedules the bar that starts within LOOKAHEAD. If the timer was throttled
     or the main thread stalled (nextBar already in the past), the missed bars are dropped and the
     grid restarts from now: never a backlog of bars landing at once. While paused (hidden tab,
     muted) nothing new is scheduled; on return the grid restarts the same way (the engine's
     visibility/mute fades bring the sound back in). */
  const LOOKAHEAD = 1.6;
  let timer = null, nextBar = 0, stopped = false, started = false;
  function tick() {
    if (stopped || !started) return 0;
    if (shouldPause()) { st.paused = true; return 0; }
    st.paused = false;
    const now = clock();
    if (nextBar < now) { st.skipped++; nextBar = now + 0.05; }
    let n = 0;
    while (nextBar < now + LOOKAHEAD && n < 2) { nextBar += scheduleBar(nextBar); n++; }
    return n;
  }
  return {
    start(at = clock() + 0.1) {
      started = true;
      nextBar = at; output.gain.setValueAtTime(0, at); output.gain.linearRampToValueAtTime(1, at + 2.5);
      tick(); if (!manual) timer = setInterval(tick, 200);
    },
    /* one scheduler step (the live timer calls this; tests drive it by hand); returns bars scheduled */
    tick,
    /* schedule `seconds` of music from t0 (for an OfflineAudioContext); returns the bar count */
    render(t0, seconds) { let t = t0; const n0 = st.bars; while (t < t0 + seconds) t += scheduleBar(t); return st.bars - n0; },
    /* the next `bars` bars from t0, returns their end time (offline use: change mood between calls) */
    renderBars(t0, bars) { let t = t0; for (let i = 0; i < bars; i++) t += scheduleBar(t); return t; },
    stop(fade = 0.8) {
      stopped = true; clearInterval(timer); timer = null;
      const t = ac.currentTime;
      output.gain.cancelScheduledValues(t); output.gain.setValueAtTime(output.gain.value, t); output.gain.setTargetAtTime(0, t, fade / 4);
      setTimeout(() => { try { trem.stop(); output.disconnect(); } catch { /* gone */ } }, fade * 1000 + 3500);
    },
    /* `at` lets an offline render change mood at a bar boundary; live calls apply at once */
    setMood(m, at = ac.currentTime) {
      if (!MOOD[m]) throw new Error(`unknown mood: ${m}`);
      if (m === 'celebrate') { if (st.mood !== 'celebrate') st.baseMood = st.mood; st.celebrateBars = 2; }
      else st.baseMood = m;
      st.mood = m;
      applyMood(Math.max(at, ac.currentTime), m === 'focus' ? 0.15 : 0.3);
    },
    setDistrict(name) { st.district = districtProfile(name); st.voicing = []; applyMood(ac.currentTime, 0.8); },
    density() { const M = MOOD[st.mood]; return 8 * M.pHat * (st.district.hats) + 8 * M.pBell + 4 * M.pRehit + 2 * M.pWalk + 8 * M.arp + 6; },
    /* what the mood returns to after celebrate (the typing idle timer uses this) */
    setBaseMood(m) { if (MOOD[m] && m !== 'celebrate') st.baseMood = m; },
    state() {
      return { mood: st.mood, baseMood: st.baseMood, district: st.district.name, bars: st.bars, events: st.events, eventsLastBar: st.eventsLastBar,
        density: this.density(), playing: !!timer, active: st.active, skipped: st.skipped, paused: st.paused };
    },
    layers: layer, keysFilter: keysF, output,
  };
}

/* ---- the live instance ---- */
let live = null, wanted = false, wantedMood = 'normal', wantedDistrict = 'office', typingTimer = null;

export function start({ seed } = {}) {
  initAudio();
  if (wanted) return;
  wanted = true;
  whenReady((ac, gr) => {
    if (!wanted || live) return;
    live = createMusic(ac, gr.music, { seed, mood: wantedMood, district: wantedDistrict,
      shouldPause: () => document.hidden || getSettings().muted });
    live.start();
  });
}
export function stop() {
  wanted = false;
  if (live) { live.stop(); live = null; }
}
export function setMood(m) {
  if (!MOOD[m]) throw new Error(`unknown mood: ${m}`);
  if (m !== 'celebrate') wantedMood = m;
  if (live) live.setMood(m);
}
export function setDistrict(name) { wantedDistrict = String(name); if (live) live.setDistrict(wantedDistrict); }
/* Typing focuses the music; idle for idleMs returns it to normal. A celebrate in progress is never
   cut short: typing during it (or the idle return) only changes the mood celebrate returns to. */
export function typing(idleMs = 6000) {
  const celebrating = () => live && live.state().mood === 'celebrate';
  if (celebrating()) live.setBaseMood('focus');
  else if (live) live.setMood('focus');
  else wantedMood = 'focus';
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    wantedMood = 'normal';
    if (celebrating()) live.setBaseMood('normal');
    else if (live) live.setMood('normal');
  }, idleMs);
}
export const isPlaying = () => !!live;
export const musicState = () => (live ? live.state() : { mood: wantedMood, district: wantedDistrict, playing: false, wanted });
export const liveMusic = () => live;
