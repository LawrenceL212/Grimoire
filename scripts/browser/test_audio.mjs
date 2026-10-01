/* Audio engine, effects and music: gesture gating, every effect plays and ends, throttling,
   ducking, focus thinning, mute, persistence, hidden-tab fade, and offline-rendered levels
   (nothing clips; music sits at least 12 dB under the success effect).
   Set AUDIO_DEMO_OUT=<file.wav> to also save the 30 s demo render. */
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const PAGE = 'game/engine/audio-test.html';
const db = (x) => 20 * Math.log10(Math.max(1e-9, x));

const g = await openGame(PAGE, {
  beforeGoto: (page) => page.addInitScript(() => {
    window.__acMade = 0;
    const Real = window.AudioContext;
    window.AudioContext = class extends Real { constructor(...a) { super(...a); window.__acMade++; } };
  }),
});
const { page, errors } = g;
await page.waitForFunction(() => window.audioTest);

// ---- before a gesture ----
const pre = await page.evaluate(() => {
  const { audio, sfx, music } = window.audioTest;
  const played = sfx.play('ui-click');
  music.start();
  return { made: window.__acMade, ctx: audio.getContext() === null, played, playing: music.isPlaying() };
});
t.check('no AudioContext before a gesture', pre.made === 0 && pre.ctx, JSON.stringify(pre));
t.check('effects and music wait quietly for the gesture', pre.played === null && !pre.playing);

// ---- the gesture ----
await page.mouse.click(5, 5);
await page.waitForFunction(() => window.audioTest.audio.isRunning(), null, { timeout: 5000 }).catch(() => {});
const post = await page.evaluate(() => ({ made: window.__acMade, state: window.audioTest.audio.getContext()?.state, playing: window.audioTest.music.isPlaying() }));
t.check('after a click there is one running AudioContext', post.made === 1 && post.state === 'running', JSON.stringify(post));
t.check('music requested before the gesture starts after it', post.playing);

// ---- every effect plays and ends ----
const fx = await page.evaluate(async () => {
  const { sfx } = window.audioTest;
  const out = {};
  for (const name of sfx.EFFECTS) {
    try {
      const t0 = performance.now();
      const h = sfx.play(name, { pan: Math.random() - 0.5 });
      if (!h) { out[name] = 'not played'; continue; }
      const ok = await Promise.race([h.ended.then(() => true), new Promise((r) => setTimeout(() => r(false), 4000))]);
      const ms = performance.now() - t0;
      out[name] = ok ? (ms < 2500 ? 'ok' : `slow ${Math.round(ms)} ms`) : 'never ended';
    } catch (e) { out[name] = 'threw ' + e.message; }
  }
  return out;
});
const bad = Object.entries(fx).filter(([, v]) => v !== 'ok');
t.check(`all ${Object.keys(fx).length} effects play without throwing and end`, Object.keys(fx).length === 16 && !bad.length, JSON.stringify(bad));

const thr = await page.evaluate(async () => {
  const { sfx } = window.audioTest;
  await new Promise((r) => setTimeout(r, 100));
  const a = !!sfx.play('coin'), b = !!sfx.play('coin'), c = !!sfx.play('ui-click');
  await new Promise((r) => setTimeout(r, 80));
  const d = !!sfx.play('coin');
  let unknown = false; try { sfx.play('nope'); } catch { unknown = true; }
  return { a, b, c, d, unknown };
});
t.check('the same effect twice within 60 ms plays once; other effects and later plays go through', thr.a && !thr.b && thr.c && thr.d, JSON.stringify(thr));
t.check('an unknown effect name throws', thr.unknown);

const loop = await page.evaluate(async () => {
  const { sfx } = window.audioTest;
  sfx.startLoop('drone-hum', { speed: 0.1 });
  await new Promise((r) => setTimeout(r, 300));
  const running = sfx.loopRunning('drone-hum');
  sfx.setLoopParam('drone-hum', 'speed', 1);
  await new Promise((r) => setTimeout(r, 200));
  sfx.stopLoop('drone-hum');
  return { running, after: sfx.loopRunning('drone-hum') };
});
t.check('the drone hum loop starts, takes a speed and stops', loop.running && !loop.after, JSON.stringify(loop));

// ---- music: ducking, focus, mute, hidden tab ----
const mus = await page.evaluate(async () => {
  const { audio, sfx, music } = window.audioTest;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const gr = audio.getGraph();
  await sleep(3000); // fade-in
  const out = { state: music.musicState() };
  out.levelPlaying = audio.outputLevel();
  out.duckBefore = gr.duck.gain.value;
  sfx.play('success');
  await sleep(150);
  out.duckDuring = gr.duck.gain.value;
  await sleep(1800);
  out.duckAfter = gr.duck.gain.value;

  const live = music.liveMusic();
  out.densNormal = live.density();
  music.setMood('focus');
  await sleep(600);
  out.densFocus = live.density();
  out.hatsFocus = live.layers.hats.gain.value;
  out.cutFocus = live.keysFilter.frequency.value;
  music.setMood('celebrate');
  await sleep(400);
  out.densCelebrate = live.density();
  out.cutCelebrate = live.keysFilter.frequency.value;
  music.setMood('normal');
  music.typing(300);
  out.typingMood = live.state().mood;
  await sleep(500);
  out.afterTypingMood = live.state().mood;
  music.setDistrict('lab');
  out.district = live.state().district;
  music.setDistrict('somewhere-new');
  out.hashed = live.state().district;

  audio.setMuted(true);
  await sleep(500);
  out.levelMuted = audio.outputLevel();
  audio.setMuted(false);
  await sleep(600);
  out.levelUnmuted = audio.outputLevel();

  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
  await sleep(1200);
  out.fadeHidden = gr.fade.gain.value;
  delete document.hidden; delete document.visibilityState;
  document.dispatchEvent(new Event('visibilitychange'));
  await sleep(2500);
  out.fadeVisible = gr.fade.gain.value;

  music.stop();
  out.stopped = !music.isPlaying();
  return out;
});
t.check('music starts and is audible', mus.state.playing && mus.levelPlaying > 0.002, `rms ${mus.levelPlaying.toFixed(4)}`);
t.check('an effect ducks the music, and it recovers', mus.duckBefore > 0.95 && mus.duckDuring < 0.75 && mus.duckAfter > 0.9, `${mus.duckBefore.toFixed(2)} -> ${mus.duckDuring.toFixed(2)} -> ${mus.duckAfter.toFixed(2)}`);
t.check("setMood('focus') lowers the density, silences hats and darkens the keys", mus.densFocus < mus.densNormal * 0.6 && mus.hatsFocus < 0.05 && mus.cutFocus < 1200, `density ${mus.densNormal.toFixed(1)} -> ${mus.densFocus.toFixed(1)}, hats ${mus.hatsFocus.toFixed(3)}, cut ${Math.round(mus.cutFocus)}`);
t.check("setMood('celebrate') brightens", mus.densCelebrate > mus.densNormal && mus.cutCelebrate > 2000, `density ${mus.densCelebrate.toFixed(1)}, cut ${Math.round(mus.cutCelebrate)}`);
t.check('typing() focuses, then returns to normal when idle', mus.typingMood === 'focus' && mus.afterTypingMood === 'normal', `${mus.typingMood} -> ${mus.afterTypingMood}`);
t.check('setDistrict picks a profile (unknown names hash to one)', mus.district === 'lab' && !!mus.hashed, `${mus.district}, ${mus.hashed}`);
t.check('mute stops the output, unmute brings it back', mus.levelMuted < 1e-4 && mus.levelUnmuted > 0.001, `${mus.levelMuted.toExponential(1)} / ${mus.levelUnmuted.toFixed(4)}`);
t.check('a hidden tab fades the music out, and back in when visible', mus.fadeHidden < 0.05 && mus.fadeVisible > 0.9, `${mus.fadeHidden.toFixed(3)} / ${mus.fadeVisible.toFixed(3)}`);
t.check('music stops', mus.stopped);

// ---- the scheduler: stalls, pauses, long sessions, typing vs celebrate, coalesced writes ----
const sch = await page.evaluate(async () => {
  const { audio, sfx, music } = window.audioTest;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  // a 30 s stall: the stubbed clock jumps from 0 to 30 s between two ticks
  {
    const ac = new OfflineAudioContext(2, 48000, 48000);
    let now = 0;
    const m = music.createMusic(ac, ac.destination, { seed: 1, manual: true, clock: () => now });
    m.start(0.1);
    const b0 = m.state().bars, e0 = m.state().events;
    now = 30;
    out.stallBars = m.tick();
    out.stallEvents = m.state().events - e0;
    out.stallSkipped = m.state().skipped;
    now = 30.2;
    out.nextTickBars = m.tick();
    out.b0 = b0;
  }
  // three simulated minutes, ticking every 0.25 s like the live timer: voices alive stay flat
  {
    const sr = 22050, secs = 180, ac = new OfflineAudioContext(1, sr * secs, sr);
    const m = music.createMusic(ac, ac.destination, { seed: 8, manual: true });
    const samples = [];
    for (let t = 0.25; t < secs; t += 0.25) {
      ac.suspend(t).then(() => { m.tick(); samples.push([t, m.state().active]); ac.resume(); });
    }
    m.start(0.05);
    await ac.startRendering();
    await sleep(50);
    const win = (a, b) => Math.max(...samples.filter(([t]) => t >= a && t < b).map(([, v]) => v));
    out.activeMinute1 = win(10, 60); out.activeMinute3 = win(120, 180);
    out.longBars = m.state().bars; out.longSkipped = m.state().skipped;
  }
  // live: muted or hidden pauses scheduling and the drone fades while hidden
  await sleep(100);
  music.start();
  await sleep(1500);
  const live = music.liveMusic();
  audio.setMuted(true);
  await sleep(300);
  const mb = live.state().bars;
  await sleep(3800);
  out.mutedBars = live.state().bars - mb; out.mutedPaused = live.state().paused;
  audio.setMuted(false);
  await sleep(500);
  out.unmutedBars = live.state().bars - mb;
  sfx.startLoop('drone-hum', { speed: 0.5 });
  await sleep(600);
  out.droneVisible = sfx.loopState().level;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
  await sleep(300);
  const hb = live.state().bars;
  await sleep(3600);
  out.hiddenBars = live.state().bars - hb;
  out.droneHidden = sfx.loopState().level;
  delete document.hidden;
  document.dispatchEvent(new Event('visibilitychange'));
  await sleep(700);
  out.droneBack = sfx.loopState().level;
  out.visibleBars = live.state().bars - hb;
  sfx.stopLoop('drone-hum');
  // typing during a celebrate never cuts it short
  music.setMood('celebrate');
  music.typing(200);
  await sleep(400);
  out.celebrateKept = live.state().mood; out.celebrateBase = live.state().baseMood;
  music.stop();
  // a slider drag: 60 changes, few writes, the last value kept
  let writes = 0;
  const real = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (k === 'grimoire.audio.v1') writes++; return real.call(this, k, v); };
  for (let i = 0; i <= 60; i++) { audio.setVolume('music', i / 100); await sleep(5); }
  await sleep(400);
  Storage.prototype.setItem = real;
  out.writes = writes;
  out.stored = JSON.parse(localStorage.getItem('grimoire.audio.v1')).music;
  audio.resetAudioSettings();
  return out;
});
t.check('after a 30 s stall, one bar is scheduled (missed bars dropped), then nothing until it is due', sch.stallBars === 1 && sch.nextTickBars === 0 && sch.stallSkipped === 1 && sch.stallEvents < 40, `bars ${sch.stallBars}, events ${sch.stallEvents}, next tick ${sch.nextTickBars}`);
t.check('a three-minute session keeps the live voice count flat', sch.activeMinute3 <= Math.max(60, sch.activeMinute1 * 1.3) && sch.longBars > 50 && sch.longSkipped === 0, `max alive ${sch.activeMinute1} (minute 1) vs ${sch.activeMinute3} (minute 3), ${sch.longBars} bars`);
t.check('muted: no new bars are scheduled; unmuted: it resumes', sch.mutedBars === 0 && sch.mutedPaused && sch.unmutedBars >= 1, `muted +${sch.mutedBars}, after unmute +${sch.unmutedBars}`);
t.check('hidden tab: no new bars, the drone hum fades, both return when visible', sch.hiddenBars === 0 && sch.droneHidden < 0.01 && sch.droneVisible > 0.05 && sch.droneBack > 0.05 && sch.visibleBars >= 1, `bars +${sch.hiddenBars}/+${sch.visibleBars}, drone ${sch.droneVisible.toFixed(3)} -> ${sch.droneHidden.toFixed(4)} -> ${sch.droneBack.toFixed(3)}`);
t.check('the typing idle timer does not cut a celebrate short', sch.celebrateKept === 'celebrate' && sch.celebrateBase === 'normal', `${sch.celebrateKept}, returns to ${sch.celebrateBase}`);
t.check('slider drags coalesce storage writes and keep the last value', sch.writes <= 3 && sch.stored === 0.6, `${sch.writes} writes for 61 changes, stored ${sch.stored}`);

// ---- persistence ----
await page.evaluate(() => { const { audio } = window.audioTest; audio.setVolume('music', 0.42); audio.setVolume('effects', 0.5); audio.setCalm(true); });
await page.reload();
await page.waitForFunction(() => window.audioTest);
const per = await page.evaluate(() => window.audioTest.audio.getSettings());
t.check('volumes, mute and calm persist across a reload', per.music === 0.42 && per.effects === 0.5 && per.calm === true && per.muted === false, JSON.stringify(per));
await page.evaluate(() => localStorage.setItem('grimoire.audio.v1', '{not json'));
await page.reload();
await page.waitForFunction(() => window.audioTest);
const bro = await page.evaluate(() => window.audioTest.audio.getSettings());
t.check('unreadable settings fall back to the defaults (music 30%, effects 60%)', bro.music === 0.3 && bro.effects === 0.6 && !bro.calm && !bro.muted, JSON.stringify(bro));
await page.mouse.click(5, 5);
const calm = await page.evaluate(async () => {
  const { audio, sfx } = window.audioTest;
  await new Promise((r) => setTimeout(r, 200));
  audio.setCalm(true);
  await new Promise((r) => setTimeout(r, 500));
  const eff = audio.getGraph().effects.gain.value, click = sfx.play('type-click');
  audio.resetAudioSettings();
  return { eff, click };
});
t.check('calm audio lowers the effects and drops the typing clicks', calm.eff < 0.6 * 0.5 && calm.click === null, JSON.stringify(calm));

// ---- offline renders: levels ----
const off = await page.evaluate(async () => {
  const { audio, sfx, music } = window.audioTest;
  const sr = 48000;
  const stats = (buf, from = 0, to = buf.length) => {
    let peak = 0, sum = 0, n = 0, lastLoud = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = from; i < to; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += d[i] * d[i]; n++; if (v > 0.001 && i > lastLoud) lastLoud = i; }
    }
    return { peak, rms: Math.sqrt(sum / n), lastLoud: lastLoud / buf.sampleRate };
  };
  const out = { fx: {} };
  for (const name of sfx.EFFECTS) {
    const ac = new OfflineAudioContext(2, sr * 2, sr);
    const gr = audio.createGraph(ac, audio.AUDIO_DEFAULTS);
    const r = sfx.synth(ac, gr.effects, name, 0.05, { seed: 3 });
    const full = stats(await ac.startRendering());
    const dry = new OfflineAudioContext(1, sr * 2, sr);
    const gain = dry.createGain(); gain.gain.value = audio.AUDIO_DEFAULTS.effects; gain.connect(dry.destination);
    sfx.synth(dry, gain, name, 0, { seed: 3 });
    const d = stats(await dry.startRendering(), 0, Math.round(sr * 1.2));
    const dd = stats(await (async () => { const a = new OfflineAudioContext(1, sr * 2, sr); const gg = a.createGain(); gg.gain.value = 0.6; gg.connect(a.destination); sfx.synth(a, gg, name, 0, { seed: 3 }); return a.startRendering(); })());
    out.fx[name] = { peak: full.peak, rmsWindow: d.rms, sounding: dd.lastLoud, scheduled: r.end - 0.05 };
  }
  // the success RMS over the first 1.2 s through the whole graph
  {
    const ac = new OfflineAudioContext(2, sr * 1.2, sr);
    const gr = audio.createGraph(ac, audio.AUDIO_DEFAULTS);
    sfx.synth(ac, gr.effects, 'success', 0, { seed: 3 });
    out.success = stats(await ac.startRendering());
  }
  // 10 s of music through the whole graph (no fade-in), for each mood, and two districts
  for (const [mood, district] of [['normal', 'office'], ['celebrate', 'gym'], ['focus', 'office'], ['normal', 'hall']]) {
    const ac = new OfflineAudioContext(2, sr * 10, sr);
    const gr = audio.createGraph(ac, audio.AUDIO_DEFAULTS);
    const m = music.createMusic(ac, gr.music, { seed: 99, mood, district });
    m.render(0, 10);
    out[`music_${mood}_${district}`] = stats(await ac.startRendering(), Math.round(sr * 0.5));
  }
  // density: events per bar, normal vs focus, same seed
  {
    const ac = new OfflineAudioContext(2, sr, sr);
    const a = music.createMusic(ac, ac.destination, { seed: 5, mood: 'normal' });
    const b = music.createMusic(ac, ac.destination, { seed: 5, mood: 'focus' });
    a.renderBars(0, 8); b.renderBars(0, 8);
    out.eventsNormal = a.state().events / 8; out.eventsFocus = b.state().events / 8;
  }
  // the drone loop at full speed for 3 s
  {
    const ac = new OfflineAudioContext(2, sr * 3, sr);
    const gr = audio.createGraph(ac, audio.AUDIO_DEFAULTS);
    const l = sfx.createLoop(ac, gr.effects, 'drone-hum', 0); l.set('speed', 1, 0.5); l.stop(2.6);
    out.drone = stats(await ac.startRendering());
  }
  // the demo mix
  { const { buffer } = await window.audioTest.renderDemo(30); out.demo = stats(buffer); out.demoLen = buffer.duration; }
  return out;
});
const fxRows = Object.entries(off.fx);
const clip = fxRows.filter(([, s]) => !(s.peak < 0.98));
t.check('no effect clips through the full graph (peak < 0.98)', !clip.length, clip.length ? JSON.stringify(clip) : `loudest ${Math.max(...fxRows.map(([, s]) => s.peak)).toFixed(2)}`);
const long = fxRows.filter(([, s]) => !(s.scheduled <= 1.2 && s.sounding <= 1.2));
t.check('every effect is shorter than 1.2 s (scheduled and measured, dry)', !long.length, long.length ? JSON.stringify(long) : `longest ${Math.max(...fxRows.map(([, s]) => s.sounding)).toFixed(2)} s`);
const musics = Object.entries(off).filter(([k]) => k.startsWith('music_'));
t.check('10 s of music never clips in any mood or district', musics.every(([, s]) => s.peak < 0.98), musics.map(([k, s]) => `${k.slice(6)} ${s.peak.toFixed(2)}`).join(', '));
const loudest = Math.max(...musics.map(([, s]) => s.rms));
const gap = db(off.success.rms) - db(loudest);
t.check('music RMS sits at least 12 dB under the success effect', gap >= 12, `success ${db(off.success.rms).toFixed(1)} dBFS, loudest music ${db(loudest).toFixed(1)} dBFS, gap ${gap.toFixed(1)} dB`);
t.check('focus music is quieter than normal', off.music_focus_office.rms < off.music_normal_office.rms, `${db(off.music_focus_office.rms).toFixed(1)} vs ${db(off.music_normal_office.rms).toFixed(1)} dBFS`);
t.check('focus music schedules far fewer notes per bar', off.eventsFocus < off.eventsNormal * 0.6, `${off.eventsNormal.toFixed(1)} -> ${off.eventsFocus.toFixed(1)}`);
t.check('the drone hum never clips', off.drone.peak < 0.98 && off.drone.rms > 0.003, `peak ${off.drone.peak.toFixed(2)}, ${db(off.drone.rms).toFixed(1)} dBFS`);
t.check('the 30 s demo renders without clipping', off.demoLen >= 29.9 && off.demo.peak < 0.98, `peak ${off.demo.peak.toFixed(2)}, ${db(off.demo.rms).toFixed(1)} dBFS`);
t.note('effect levels', fxRows.map(([k, s]) => `${k} ${s.peak.toFixed(2)}/${db(s.rmsWindow).toFixed(0)}dB/${s.sounding.toFixed(2)}s`).join('; '));

if (process.env.AUDIO_DEMO_OUT) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#demo')]);
  await dl.saveAs(process.env.AUDIO_DEMO_OUT);
  t.note('demo saved', process.env.AUDIO_DEMO_OUT);
}

t.check('no page errors', errors.length === 0, errors.join(' | '));
await g.close();
t.finish();
