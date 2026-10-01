// make_audio.mjs: the story intro's voices and soundtrack, all made locally (no downloads).
//   node game/intro/make_audio.mjs [buildDir]          (SKIP_VOICE=1 reuses the voices already made)
// 1. one narration file per line of cues.json, spoken by Windows' built-in speech (Microsoft Zira / David Desktop),
//    the drones pitched and given a small robotic chorus with ffmpeg, saved as small mono MP3s in game/intro/voice/
//    (the page prefers them to the browser's speechSynthesis); their lengths go to voice/lengths.json
// 2. the sound effects and a soft music bed, synthesised here (seeded), for the recorded video only
// 3. ffmpeg mixes them into <buildDir>/soundtrack.wav: each line at its time, the music ducked under the voice
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.argv[2] || join(HERE, '../../.superpowers/sdd/2026-10-01-grimoire-game-phase2a/intro-build'));
const VOICE = join(HERE, 'voice');
mkdirSync(OUT, { recursive: true }); mkdirSync(VOICE, { recursive: true });
const FFMPEG = process.env.FFMPEG || 'C:/Users/lawre/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe';
const ff = (args) => execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
const cues = JSON.parse(readFileSync(join(HERE, 'cues.json'), 'utf8'));
const SR = 48000, DUR = cues.duration, N = Math.ceil(SR * DUR);

// ---------------------------------------------------------------- 1. the voices
const wavLen = (f) => { const b = readFileSync(f); return (b.length - 44) / b.readUInt32LE(28); };
const lengths = {};
for (const line of cues.lines) {
  const v = cues.voices[line.who];
  const raw = join(OUT, `raw-${line.id}.wav`), done = join(OUT, `voice-${line.id}.wav`), mp3 = join(VOICE, `${line.id}.mp3`);
  if (!process.env.SKIP_VOICE) {
    const text = line.text.replace(/'/g, "''");
    const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SelectVoice('${v.sapi}'); $s.Rate = ${v.rate | 0}; $s.SetOutputToWaveFile('${raw}'); $s.Speak('${text}'); $s.Dispose()`;
    execFileSync('powershell', ['-NoProfile', '-Command', ps]);
    // pitch without changing the length; drones get a short chorus and a little brightness
    const p = v.pitch || 1;
    const chain = [`aresample=44100`, p !== 1 ? `asetrate=${Math.round(44100 * p)},aresample=44100,atempo=${(1 / p).toFixed(4)}` : null,
      v.robot ? 'aecho=0.8:0.75:14|23:0.32|0.22,highpass=f=140,treble=g=3' : null,
      'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse',
      'loudnorm=I=-17:TP=-2:LRA=9'].filter(Boolean).join(',');
    ff(['-i', raw, '-af', chain, '-ar', '44100', '-ac', '1', done]);
    ff(['-i', done, '-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '40k', mp3]);
  }
  lengths[line.id] = +wavLen(done).toFixed(3);
  const next = cues.lines[cues.lines.indexOf(line) + 1];
  const gap = next ? next.at - (line.at + lengths[line.id]) : DUR - (line.at + lengths[line.id]);
  console.log(`${line.id.padEnd(9)} ${line.who.padEnd(8)} at ${line.at.toFixed(1)}s + ${lengths[line.id].toFixed(2)}s -> gap ${gap.toFixed(2)}s  ${statSync(mp3).size} bytes`);
}
writeFileSync(join(VOICE, 'lengths.json'), JSON.stringify(lengths, null, 1));

// ---------------------------------------------------------------- 2. synthesis (the video's sound only)
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(14), TAU = Math.PI * 2;
const sfx = new Float32Array(N), music = new Float32Array(N);
const at = (s) => Math.round(s * SR);
function add(buf, t0, dur, fn) { const i0 = at(t0), n = at(dur); for (let i = 0; i < n && i0 + i < N; i++) if (i0 + i >= 0) buf[i0 + i] += fn(i / SR, i); }
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) * d));
const bell = (buf, t0, f, amp, dec = 5, dur = 1.5) => add(buf, t0, dur, (t) => amp * env(t, 0.004, dec) * (Math.sin(TAU * f * t) + 0.35 * Math.sin(TAU * f * 2.01 * t) * Math.exp(-t * 4) + 0.12 * Math.sin(TAU * f * 3.98 * t) * Math.exp(-t * 8)));
function noiseBurst(buf, t0, dur, amp, dec, lp = 0.5) { let y = 0; add(buf, t0, dur, (t) => { y += lp * ((R() * 2 - 1) - y); return amp * y * env(t, 0.001, dec); }); }
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const SFX = {
  clatter(t) { for (let k = 0; k < 3; k++) { bell(sfx, t + k * 0.09, midi(86 + k * 3), 0.07, 14, 0.5); noiseBurst(sfx, t + k * 0.09, 0.05, 0.08, 90, 0.7); } },
  bell(t) { bell(sfx, t, midi(84), 0.14, 2.2, 2.2); },
  steps(t0, t1) { for (let t = t0, k = 0; t < t1; t += 0.5, k++) noiseBurst(sfx, t, 0.08, 0.07 + (k % 2) * 0.02, 60, 0.18); },
  door(t) { noiseBurst(sfx, t, 0.3, 0.12, 14, 0.12); add(sfx, t, 0.25, (x) => 0.06 * Math.sin(TAU * 70 * x) * env(x, 0.005, 12)); },
  clicks(t0, t1) { let t = t0; while (t < t1) { const a = 0.08 + R() * 0.06; noiseBurst(sfx, t, 0.03, a, 260, 0.7); t += 0.06 + R() * 0.08 + (R() < 0.1 ? 0.2 : 0); } },
  ping(t) { bell(sfx, t, midi(91), 0.13, 6, 1.0); bell(sfx, t + 0.09, midi(96), 0.1, 7, 1.0); },
  shimmer(t) { for (let k = 0; k < 9; k++) bell(sfx, t + k * 0.11, midi(84 + [0, 4, 7, 11, 12, 16, 19, 23, 24][k]), 0.035, 2.4, 2.4); },
  page(t) { let y = 0; add(sfx, t, 0.5, (x) => { y += 0.35 * ((R() * 2 - 1) - y); return 0.12 * y * Math.sin(Math.PI * Math.min(1, x / 0.5)); }); },
  blink(t) { bell(sfx, t, midi(79), 0.1, 9, 0.5); bell(sfx, t + 0.08, midi(91), 0.09, 8, 0.6); add(sfx, t, 0.6, (x) => 0.03 * Math.sin(TAU * (300 + 600 * x) * x) * env(x, 0.02, 5)); },
  chime(t) { bell(sfx, t, midi(88), 0.22, 3.2, 1.8); bell(sfx, t + 0.32, midi(84), 0.22, 2.4, 2.2); },
  sting(t) { [62, 69, 74, 78, 81].forEach((m, i) => bell(sfx, t + i * 0.09, midi(m), 0.11, 1.2, 4.5)); },
};
for (const [name, ...args] of cues.sfx) SFX[name](...args);
// a soft, slow music bed: warm pads (D, Bm, G, A), a quiet pluck that wakes with the drones
const CH = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]];
const BAR = 5;
for (let b = 0; b * BAR < DUR; b++) {
  const t0 = b * BAR, end = t0 >= 76 ? DUR - t0 : BAR + 1, chord = t0 >= 76 ? [50, 57, 62, 66, 69] : CH[b % 4];
  for (const m of chord) { const f = midi(m); add(music, t0, end, (x) => { const e = Math.min(1, x / 1.2) * Math.min(1, Math.max(0, (end - x) / 1.2)); return 0.03 * e * (Math.sin(TAU * f * x) + Math.sin(TAU * f * 1.004 * x + 1) + 0.2 * Math.sin(TAU * f * 2 * x)); }); }
  if (t0 >= 52 && t0 < 76) { const arp = [...chord.slice(1), chord[2] + 12]; for (let k = 0; k < 10; k++) bell(music, t0 + k * 0.5, midi(arp[k % 4] + 12), 0.025, 5, 0.9); }
}
{ let y = 0; for (let i = 0; i < N; i++) { y += 0.16 * (music[i] - y); const t = i / SR; music[i] = y * Math.min(1, t / 4, (DUR - t) / 2.5); } }
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
const files = cues.lines.map((l) => join(OUT, `voice-${l.id}.wav`));
const inputs = ['-i', join(OUT, 'music.wav'), '-i', join(OUT, 'sfx.wav'), ...files.flatMap((f) => ['-i', f])];
const vo = cues.lines.map((l, i) => `[${i + 2}:a]aresample=48000,volume=1.6,adelay=${Math.round(l.at * 1000)}:all=1[v${i}]`).join(';');
const filter = `${vo};${cues.lines.map((_, i) => `[v${i}]`).join('')}amix=inputs=${cues.lines.length}:normalize=0:duration=longest,apad=whole_dur=${DUR}[vo];`
  + '[vo]asplit=2[vo1][vo2];'
  + '[0:a][vo2]sidechaincompress=threshold=0.02:ratio=6:attack=30:release=600:makeup=1[mus];'
  + `[mus][1:a][vo1]amix=inputs=3:normalize=0:weights=1.2 0.9 1,atrim=0:${DUR},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,aformat=channel_layouts=stereo[out]`;
ff([...inputs, '-filter_complex', filter, '-map', '[out]', '-ar', '48000', join(OUT, 'soundtrack.wav')]);
console.log('wrote', join(OUT, 'soundtrack.wav'));
