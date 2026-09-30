// people/anims.js: poses and expressions. Pure maths on plain objects; people.js applies them to the bones.
//
//   STATES                  the states a Person can play
//   legIK(hy, hz, ay, az, out?)  two-bone leg in the side plane: { hip, knee } (bone rotation.x values)
//   walkLegs(phase, w, out)       the walk cycle's legs, scaled by w (0 = standing still)
//   seatedLegs(h, t, rm, out)     the legs on a seat of height h; returns true when they dangle
//   legExtent(hip, knee)          how far below the hip joint the sole reaches (to plant the lower foot)
//   base(c, out), upper(state, c, out)  the upper body (spine, head, arms); c = { t, sit, walk, phase, rm, seed }
//   blendInto(dst, src, k)        dst += (src - dst) * k, in place (no allocation per frame anywhere here)
//   EXPRESSIONS, STATE_FACE, EMOTE_FACE   the face for each expression, state and emote
//
// Joint keys are 'bone.axis' (rotation, radians), e.g. 'shL.x'. L is the person's left (+X).
// Signs: rotation.x < 0 swings a limb forward; a knee > 0 bends; for the L arm, rotation.z > 0 lifts it out sideways.
import { DIM } from './rig.js';

export const STATES = Object.freeze(['idle', 'walk', 'sit', 'type', 'talk', 'celebrate', 'frustrated', 'carry', 'wave']);
const { thigh: LT, shin: LS, sole: SOLE } = DIM;

// Every function writes into an object the caller owns (no allocation per frame).
const IK = { hip: 0, knee: 0 };
export function legIK(hy, hz, ay, az, out = IK) {
  const dy = ay - hy, dz = az - hz;
  let d = Math.hypot(dy, dz);
  d = Math.min(Math.max(d, Math.abs(LT - LS) + 1e-3), LT + LS - 1e-4);
  const alpha = Math.atan2(dz, -dy); // forward of straight down
  const beta = Math.acos(Math.min(1, Math.max(-1, (LT * LT + d * d - LS * LS) / (2 * LT * d))));
  const inner = Math.acos(Math.min(1, Math.max(-1, (LT * LT + LS * LS - d * d) / (2 * LT * LS))));
  out.hip = -(alpha + beta); out.knee = Math.PI - inner;
  return out;
}
// the seated legs on a seat of height h (the hip joint sits DIM.seatDrop - DIM.hipDrop above it); feet on the floor
// with the knee near a right angle, or dangling when the seat is too high to reach the floor. Returns true if dangling.
export function seatedLegs(h, t, rm, out) {
  const hy = h + DIM.seatDrop - DIM.hipDrop, dy = hy - SOLE;
  if (dy > LT + LS - 0.03) { // too high: legs hang over the edge and swing a little
    const k = rm ? 0 : Math.sin(t * 2.2) * 0.12;
    out['hipL.x'] = -1.45; out['kneeL.x'] = 1.35 + k; out['hipR.x'] = -1.45; out['kneeR.x'] = 1.35 - k;
    return true;
  }
  const f = Math.min(0.3, Math.max(0.03, Math.sqrt(Math.max(0, LT * LT + LS * LS - dy * dy))));
  const { hip, knee } = legIK(hy, 0, SOLE, f);
  out['hipL.x'] = hip; out['kneeL.x'] = knee; out['hipR.x'] = hip; out['kneeR.x'] = knee;
  return false;
}
export function walkLegs(phase, w, out) {
  const s = Math.sin(phase), c = Math.cos(phase), A = 0.46 * w;
  out['hipL.x'] = -s * A; out['hipR.x'] = s * A;
  out['kneeL.x'] = (0.06 + 0.75 * Math.max(0, c)) * w; out['kneeR.x'] = (0.06 + 0.75 * Math.max(0, -c)) * w;
  return out;
}
export const legExtent = (hip, knee) => LT * Math.cos(hip) + LS * Math.cos(hip + knee) + SOLE;

// ---------------------------------------------------------------- upper body
const SIDES = [['L', 1], ['R', -1]];
const K = {}; // interned 'shL.x' style keys
const key = (b, k, ax) => K[b + k + ax] || (K[b + k + ax] = b + k + '.' + ax);
const scratchA = {}, scratchB = {};

// writes the state's pose into out (only the keys the state moves); returns false for the base-only states
export function upper(state, c, out) {
  const { t, sit, walk, phase, rm, seed } = c;
  const sw = Math.sin(phase) * walk;
  switch (state) {
    case 'type':
      out['spine.x'] = 0.14; out['spine.y'] = 0;
      out['head.x'] = -0.06 - 0.16 * Math.max(0, Math.sin(t * 0.45 + seed)) + Math.sin(t * 0.8 + seed) * 0.03; out['head.y'] = Math.sin(t * 0.5 + seed) * 0.08;
      for (const [k, s] of SIDES) {
        const tap = Math.max(0, Math.sin(t * 15 + (s > 0 ? 0 : Math.PI) + Math.sin(t * 3.1) * 1.5));
        out[key('sh', k, 'x')] = -0.72; out[key('sh', k, 'z')] = -s * 0.1; out[key('sh', k, 'y')] = s * 0.15;
        out[key('el', k, 'x')] = -1.0 + tap * 0.14; out[key('hand', k, 'x')] = 0.35 - tap * 0.25;
      }
      return true;
    case 'talk':
      out['spine.x'] = 0.03; out['head.x'] = Math.sin(t * 3.6) * 0.07 - 0.05; out['head.y'] = Math.sin(t * 0.9 + seed) * 0.18; out['head.z'] = Math.sin(t * 1.3) * 0.05;
      out['shR.x'] = -0.4 + Math.sin(t * 2.7) * 0.14; out['shR.z'] = -0.28; out['elR.x'] = -1.3 + Math.sin(t * 4.1) * 0.25; out['handR.x'] = 0.2;
      out['shL.x'] = -0.18 + Math.sin(t * 2.1 + 1) * 0.1; out['shL.z'] = 0.25 + Math.sin(t * 1.7) * 0.06; out['elL.x'] = -0.95 + Math.sin(t * 3.3) * 0.2;
      return true;
    case 'celebrate':
      out['spine.x'] = -0.1; out['head.x'] = -0.3; out['head.y'] = 0; out['head.z'] = rm ? 0 : Math.sin(t * 7) * 0.08;
      for (const [k, s] of SIDES) {
        out[key('sh', k, 'z')] = s * 2.55; out[key('sh', k, 'x')] = -0.2;
        out[key('el', k, 'x')] = -0.3 - (rm ? 0 : Math.max(0, Math.sin(t * 9 + s)) * 0.35); out[key('el', k, 'z')] = 0;
      }
      return true;
    case 'frustrated': {
      const shake = rm ? 0 : Math.sin(t * 5.5) * 0.28;
      const a = scratchA, b = scratchB; // standing: fists down, head up; seated: hands on the head
      a['spine.x'] = 0.06; a['head.x'] = -0.12; a['head.y'] = shake;
      b['spine.x'] = 0.22; b['head.x'] = 0.3; b['head.y'] = shake;
      for (const [k, s] of SIDES) {
        a[key('sh', k, 'x')] = 0.18 + (rm ? 0 : Math.max(0, Math.sin(t * 7 + s)) * 0.14); a[key('sh', k, 'z')] = s * 0.3; a[key('el', k, 'x')] = -0.55; a[key('hand', k, 'x')] = 0.3;
        b[key('sh', k, 'x')] = -2.35; b[key('sh', k, 'z')] = s * 0.5; b[key('el', k, 'x')] = -2.0; b[key('hand', k, 'x')] = -0.2;
      }
      for (const k in a) out[k] = a[k] + (b[k] - a[k]) * sit;
      return true;
    }
    case 'carry':
      out['spine.x'] = -0.05; out['head.x'] = 0.02;
      for (const [k, s] of SIDES) {
        out[key('sh', k, 'x')] = -0.95 + sw * 0.04; out[key('sh', k, 'z')] = s * 0.06; out[key('el', k, 'x')] = -0.62;
        out[key('hand', k, 'x')] = 0.15; out[key('hand', k, 'z')] = -s * 0.35;
      }
      return true;
    case 'wave':
      out['head.z'] = 0.12; out['head.x'] = -0.12; out['spine.z'] = -0.06;
      out['shR.z'] = -2.4; out['shR.x'] = -0.3; out['elR.x'] = -0.45; out['elR.z'] = -Math.sin(t * 8) * 0.5; out['handR.x'] = 0;
      return true;
    default: return false; // idle, walk, sit: the base pose
  }
}
// the pose under every state, written into out (every upper-body key): arms hang (or swing when walking,
// or rest on the lap when seated); the head glances round
export function base(c, out) {
  const { t, sit, walk, phase, seed } = c;
  const sw = Math.sin(phase) * walk;
  out['spine.x'] = 0.05 * walk; out['spine.y'] = Math.sin(phase) * 0.1 * walk; out['spine.z'] = 0;
  out['head.x'] = -0.08 - walk * 0.02; out['head.y'] = Math.sin(t * 0.43 + seed * 2) * 0.3 * (1 - walk); out['head.z'] = Math.sin(t * 0.7 + seed) * 0.05 * (1 - walk);
  for (const [k, s] of SIDES) {
    out[key('sh', k, 'x')] = 0.04 + s * sw * 0.5; out[key('sh', k, 'y')] = 0; out[key('sh', k, 'z')] = s * 0.1;
    out[key('el', k, 'x')] = -0.18 - 0.25 * walk; out[key('el', k, 'z')] = 0; out[key('hand', k, 'x')] = 0; out[key('hand', k, 'z')] = 0;
  }
  if (sit <= 0) return out;
  const glance = Math.max(0, Math.sin(t * 0.37 + seed));
  lerpKey(out, 'spine.x', 0.02, sit); lerpKey(out, 'spine.y', 0, sit);
  lerpKey(out, 'head.x', -0.14 - 0.2 * glance, sit); lerpKey(out, 'head.y', Math.sin(t * 0.43 + seed * 2) * 0.2, sit);
  for (const [k, s] of SIDES) {
    lerpKey(out, key('sh', k, 'x'), -0.42, sit); lerpKey(out, key('sh', k, 'z'), s * 0.1, sit);
    lerpKey(out, key('el', k, 'x'), -0.8, sit); lerpKey(out, key('hand', k, 'x'), 0.2, sit);
  }
  return out;
}
function lerpKey(o, k, v, w) { o[k] += (v - o[k]) * w; }
// blends src into dst in place, by k (keys dst lacks count as 0)
export function blendInto(dst, src, k) {
  if (k <= 0) return dst;
  const w = Math.min(1, k);
  for (const key in src) { const a = dst[key] ?? 0; dst[key] = a + (src[key] - a) * w; }
  return dst;
}

// ---------------------------------------------------------------- faces
// eye: [width, height] scale; happy: closed "^ ^" eyes; brow: [raise, inner-up tilt, one-sided raise];
// mouth weights; glance: [up, sideways] eye shift in radians on the head
export const EXPRESSIONS = {
  neutral: { eye: [1, 1], happy: 0, brow: [0, 0, 0], mouth: { smile: 1 }, glance: [0, 0] },
  happy: { eye: [1, 1], happy: 1, brow: [0.012, 0.1, 0], mouth: { grin: 1 }, glance: [0, 0] },
  worried: { eye: [0.95, 1.08], happy: 0, brow: [0.01, 0.42, 0], mouth: { frown: 0.8 }, glance: [0, 0] },
  frustrated: { eye: [1.05, 0.62], happy: 0, brow: [-0.012, -0.5, 0], mouth: { frown: 1.1 }, glance: [0, 0] },
  surprised: { eye: [1.2, 1.35], happy: 0, brow: [0.03, 0.12, 0], mouth: { o: 1.1 }, glance: [0, 0] },
  thinking: { eye: [1, 0.85], happy: 0, brow: [0.01, 0.05, 0.03], mouth: { flat: 0.9 }, glance: [0.06, 0.08] },
  focused: { eye: [1, 0.82], happy: 0, brow: [-0.004, -0.12, 0], mouth: { flat: 0.8 }, glance: [-0.02, 0] },
};
export const STATE_FACE = { idle: 'neutral', walk: 'neutral', sit: 'neutral', type: 'focused', talk: 'neutral', celebrate: 'happy', frustrated: 'frustrated', carry: 'neutral', wave: 'happy' };
export const EMOTES = Object.freeze(['bang', 'q', 'dots', 'ok', 'no']);
export const EMOTE_ALIAS = { '!': 'bang', bang: 'bang', '?': 'q', q: 'q', '…': 'dots', '...': 'dots', dots: 'dots', '✓': 'ok', ok: 'ok', '✗': 'no', x: 'no', no: 'no' };
export const EMOTE_FACE = { bang: 'surprised', q: 'thinking', dots: 'worried', ok: 'happy', no: 'frustrated' };
