// make_audio.mjs: builds the trailer's soundtrack, all locally, no downloads.
//   node game/trailer/make_audio.mjs [outDir]
// 1. the narration: one WAV per line of cues.json, spoken by Windows' built-in speech (Microsoft Zira Desktop)
// 2. the sound effects and a soft synth music bed, synthesised here (seeded) into sfx.wav and music.wav
// 3. ffmpeg mixes them: each voice line delayed to its time, the music ducked under the voice, -16 LUFS
// Output: <outDir>/soundtrack.wav (cues.duration seconds, 48 kHz stereo).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.argv[2] || join(HERE, '../../.superpowers/sdd/2026-10-01-grimoire-game-phase2a/trailer-build'));
mkdirSync(OUT, { recursive: true });
const FFMPEG = process.env.FFMPEG || 'C:/Users/lawre/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe';
const cues = JSON.parse(readFileSync(join(HERE, 'cues.json'), 'utf8'));
const SR = 48000, DUR = cues.duration, N = Math.ceil(SR * DUR);

// ---------------------------------------------------------------- 1. narration
const voiceFiles = cues.voice.map((v, i) => join(OUT, `voice-${i + 1}.wav`));
if (!process.env.SKIP_VOICE) {
  cues.voice.forEach((v, i) => {
    const text = v.text.replace(/'/g, "''");
    const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SelectVoice('Microsoft Zira Desktop'); $s.Rate = 0; $s.SetOutputToWaveFile('${voiceFiles[i]}'); $s.Speak('${text}'); $s.Dispose()`;
    execFileSync('powershell', ['-NoProfile', '-Command', ps]);
  });
}
const voiceLen = voiceFiles.map((f) => { const b = readFileSync(f); return (b.length - 44) / b.readUInt32LE(28); });
cues.voice.forEach((v, i) => console.log(`voice ${i + 1}: ${v.at.toFixed(1)}s + ${voiceLen[i].toFixed(2)}s = ends ${(v.at + voiceLen[i]).toFixed(2)}s`));

// ---------------------------------------------------------------- 2. synthesis
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(7);
const TAU = Math.PI * 2;
const sfx = new Float32Array(N), music = new Float32Array(N);
const at = (s) => Math.round(s * SR);
// add a voice: fn(t) -> sample, for dur seconds starting at t0
function add(buf, t0, dur, fn) {
  const i0 = at(t0), n = at(dur);
  for (let i = 0; i < n && i0 + i < N; i++) if (i0 + i >= 0) buf[i0 + i] += fn(i / SR, i);
}
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) * d));
const bell = (buf, t0, f, amp, dec = 5, dur = 1.5) => add(buf, t0, dur, (t) => amp * env(t, 0.004, dec) * (Math.sin(TAU * f * t) + 0.35 * Math.sin(TAU * f * 2.01 * t) * Math.exp(-t * 4) + 0.12 * Math.sin(TAU * f * 3.98 * t) * Math.exp(-t * 8)));
function noiseBurst(buf, t0, dur, amp, dec, lp = 0.5) { let y = 0; add(buf, t0, dur, (t) => { y += lp * ((R() * 2 - 1) - y); return amp * y * env(t, 0.001, dec); }); }
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

const SFX = {
  chime(t) { bell(sfx, t, midi(88), 0.22, 3.5, 1.6); bell(sfx, t + 0.28, midi(84), 0.22, 2.6, 2.0); },
  ping(t) { bell(sfx, t, midi(93), 0.16, 7, 1.0); bell(sfx, t + 0.07, midi(100), 0.08, 9, 0.8); },
  alert(t) { for (let k = 0; k < 2; k++) { add(sfx, t + k * 0.22, 0.16, (x) => 0.13 * env(x, 0.005, 18) * Math.sign(Math.sin(TAU * (k ? 660 : 880) * x)) * 0.6 + 0.1 * env(x, 0.005, 18) * Math.sin(TAU * (k ? 660 : 880) * x)); } },
  whoosh(t) { let y = 0, y2 = 0; add(sfx, t, 1.1, (x) => { const c = 0.02 + 0.25 * Math.sin(Math.PI * Math.min(1, x / 1.1)); y += c * ((R() * 2 - 1) - y); y2 += c * (y - y2); return 0.5 * y2 * Math.sin(Math.PI * Math.min(1, x / 1.1)) ** 2; }); },
  clicks(t0, t1) {
    let t = t0;
    while (t < t1) {
      const a = 0.09 + R() * 0.07, f = 1800 + R() * 1600;
      noiseBurst(sfx, t, 0.03, a, 260, 0.7);
      add(sfx, t, 0.02, (x) => a * 0.35 * Math.sin(TAU * f * x) * Math.exp(-x * 400));
      if (R() < 0.12) { noiseBurst(sfx, t + 0.012, 0.06, a * 0.8, 90, 0.35); } // a space bar
      t += 0.055 + R() * 0.075 + (R() < 0.08 ? 0.18 : 0);
    }
  },
  run(t) { bell(sfx, t, midi(79), 0.12, 10, 0.4); bell(sfx, t + 0.09, midi(86), 0.12, 8, 0.6); },
  row(t, k) { bell(sfx, t, midi(k === 1 ? 70 : 83), k === 1 ? 0.16 : 0.1, 9, 0.6); if (k === 1) add(sfx, t, 0.35, (x) => 0.05 * Math.sin(TAU * 110 * x) * env(x, 0.01, 8)); },
  hum(t0, t1) { const d = t1 - t0; add(sfx, t0, d, (x) => { const e = Math.min(1, x / 0.4, (d - x) / 0.5); const v = 1 + 0.02 * Math.sin(TAU * 5 * x); return 0.045 * e * (Math.sin(TAU * 150 * v * x) + 0.5 * Math.sin(TAU * 300.7 * v * x) + 0.2 * Math.sin(TAU * 451 * x)); }); },
  success(t) { [72, 76, 79, 84].forEach((m, i) => bell(sfx, t + i * 0.07, midi(m), 0.14, 2.2, 2.4)); [60, 64, 67].forEach((m) => add(sfx, t, 2.2, (x) => 0.06 * env(x, 0.03, 1.4) * Math.sin(TAU * midi(m) * x))); },
  confetti(t) { for (let k = 0; k < 9; k++) { const tt = t + R() * 0.7; noiseBurst(sfx, tt, 0.05, 0.12 + R() * 0.1, 120, 0.6); } },
  coin(t) { add(sfx, t, 0.5, (x) => { const f = x < 0.07 ? midi(95) : midi(100); return 0.09 * env(x, 0.002, 7) * Math.sign(Math.sin(TAU * f * x)) * 0.5 + 0.07 * env(x, 0.002, 7) * Math.sin(TAU * f * x); }); },
  tick(t) { noiseBurst(sfx, t, 0.04, 0.16, 150, 0.8); bell(sfx, t, midi(76), 0.05, 12, 0.3); },
  fade(t) { let ph = 0; add(sfx, t, 1.8, (x) => { const f = 330 * Math.pow(0.5, x / 1.4); ph += TAU * f / SR; return 0.13 * env(x, 0.05, 1.6) * (Math.sin(ph) + 0.3 * Math.sin(ph * 2)); }); },
  build(t) { for (let k = 0; k < 7; k++) { const tt = t + k * 0.15 + R() * 0.04; let ph = 0; add(sfx, tt, 0.25, (x) => { const f = 90 + 260 * Math.exp(-x * 30); ph += TAU * f / SR; return 0.2 * env(x, 0.002, 18) * Math.sin(ph); }); noiseBurst(sfx, tt, 0.03, 0.06, 200, 0.8); } },
  sting(t) { [62, 69, 74, 78, 81].forEach((m, i) => bell(sfx, t + i * 0.09, midi(m), 0.11, 1.2, 4.5)); },
};
for (const [name, ...args] of cues.sfx) SFX[name](...args);

// music bed: warm pad chords (detuned, softened), a quiet plucked arpeggio, fading in and out
const CH = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]]; // D, Bm, G, A
const BAR = 4;
for (let b = 0; b * BAR < DUR; b++) {
  const t0 = b * BAR, chord = t0 >= 64 ? [50, 57, 62, 66, 69] : CH[b % 4];
  const len = t0 >= 64 ? DUR - t0 : BAR + 0.8;
  for (const m of chord) {
    const f = midi(m);
    add(music, t0, len, (x) => { const e = Math.min(1, x / 0.9) * Math.min(1, Math.max(0, (len - x) / 0.9)); return 0.035 * e * (Math.sin(TAU * f * x) + Math.sin(TAU * f * 1.004 * x + 1) + 0.25 * Math.sin(TAU * f * 2 * x)); });
  }
  if (t0 >= 64) continue;
  const arp = [...chord.slice(1), chord[2] + 12];
  for (let k = 0; k < 8; k++) bell(music, t0 + k * 0.5, midi(arp[k % 4] + 12), 0.03 + (k % 2 ? 0 : 0.012), 5, 0.9);
}
// soften the bed: a one-pole low-pass, then the fades (in over 3 s, out over the last 2)
{ let y = 0; for (let i = 0; i < N; i++) { y += 0.18 * (music[i] - y); const t = i / SR; music[i] = y * Math.min(1, t / 3, (DUR - t) / 2); } }

function writeWav(file, data) {
  const b = Buffer.alloc(44 + data.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + data.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i])) * 32767), 44 + i * 2);
  writeFileSync(file, b);
}
writeWav(join(OUT, 'sfx.wav'), sfx);
writeWav(join(OUT, 'music.wav'), music);

// ---------------------------------------------------------------- 3. the mix
const inputs = ['-i', join(OUT, 'music.wav'), '-i', join(OUT, 'sfx.wav'), ...voiceFiles.flatMap((f) => ['-i', f])];
const vo = cues.voice.map((v, i) => `[${i + 2}:a]aresample=48000,volume=1.9,adelay=${Math.round(v.at * 1000)}:all=1[v${i}]`).join(';');
const filter = `${vo};${cues.voice.map((_, i) => `[v${i}]`).join('')}amix=inputs=${cues.voice.length}:normalize=0:duration=longest,apad=whole_dur=${DUR}[vo];`
  + '[vo]asplit=2[vo1][vo2];'
  + '[0:a][vo2]sidechaincompress=threshold=0.02:ratio=8:attack=30:release=500:makeup=1[mus];'
  + `[mus][1:a][vo1]amix=inputs=3:normalize=0:weights=1.1 0.9 1,atrim=0:${DUR},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,aformat=channel_layouts=stereo[out]`;
execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...inputs, '-filter_complex', filter, '-map', '[out]', '-ar', '48000', join(OUT, 'soundtrack.wav')], { stdio: 'inherit' });
console.log('wrote', join(OUT, 'soundtrack.wav'));
