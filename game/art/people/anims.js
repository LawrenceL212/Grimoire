// people/anims.js: poses and expressions. Pure maths on plain objects; people.js applies them to the bones.
//
//   STATES                  the states a Person can play
//   legIK(hy, hz, ay, az)   two-bone leg in the side plane: { hip, knee } (bone rotation.x values)
//   walkLegs(phase, w)      the walk cycle's legs, scaled by w (0 = standing still)
//   legExtent(hip, knee)    how far below the hip joint the sole reaches (to plant the lower foot)
//   upper(state, c)         the upper body (spine, head, arms) for a state; c = { t, sit, walk, phase, rm, seed }
//   EXPRESSIONS, STATE_FACE, EMOTE_FACE   the face for each expression, state and emote
//
// Joint keys are 'bone.axis' (rotation, radians), e.g. 'shL.x'. L is the person's left (+X).
// Signs: rotation.x < 0 swings a limb forward; a knee > 0 bends; for the L arm, rotation.z > 0 lifts it out sideways.
import { DIM } from './rig.js';

export const STATES = Object.freeze(['idle', 'walk', 'sit', 'type', 'talk', 'celebrate', 'frustrated', 'carry', 'wave']);
const { thigh: LT, shin: LS, sole: SOLE } = DIM;

export function legIK(hy, hz, ay, az) {
  const dy = ay - hy, dz = az - hz;
  let d = Math.hypot(dy, dz);
  d = Math.min(Math.max(d, Math.abs(LT - LS) + 1e-3), LT + LS - 1e-4);
  const alpha = Math.atan2(dz, -dy); // forward of straight down
  const beta = Math.acos(Math.min(1, Math.max(-1, (LT * LT + d * d - LS * LS) / (2 * LT * d))));
  const inner = Math.acos(Math.min(1, Math.max(-1, (LT * LT + LS * LS - d * d) / (2 * LT * LS))));
  return { hip: -(alpha + beta), knee: Math.PI - inner };
}
// the seated legs on a seat of height h (the hip joint sits DIM.seatDrop - DIM.hipDrop above it); feet on the floor
// with the knee near a right angle, or dangling when the seat is too high to reach the floor
export function seatedLegs(h, t, rm) {
  const hy = h + DIM.seatDrop - DIM.hipDrop, dy = hy - SOLE;
  if (dy > LT + LS - 0.03) { // too high: legs hang over the edge and swing a little
    const k = rm ? 0 : Math.sin(t * 2.2) * 0.12;
    return { 'hipL.x': -1.45, 'kneeL.x': 1.35 + k, 'hipR.x': -1.45, 'kneeR.x': 1.35 - k, dangle: true };
  }
  const f = Math.min(0.3, Math.max(0.03, Math.sqrt(Math.max(0, LT * LT + LS * LS - dy * dy))));
  const { hip, knee } = legIK(hy, 0, SOLE, f);
  return { 'hipL.x': hip, 'kneeL.x': knee, 'hipR.x': hip, 'kneeR.x': knee };
}
export function walkLegs(phase, w) {
  const s = Math.sin(phase), c = Math.cos(phase), A = 0.46 * w;
  const lift = (x) => (0.06 + 0.75 * Math.max(0, x)) * w;
  return { 'hipL.x': -s * A, 'hipR.x': s * A, 'kneeL.x': lift(c), 'kneeR.x': lift(-c) };
}
export const legExtent = (hip, knee) => LT * Math.cos(hip) + LS * Math.cos(hip + knee) + SOLE;

// ---------------------------------------------------------------- upper body
const S = { L: 1, R: -1 };
function arms(fn) { const o = {}; for (const k of ['L', 'R']) Object.assign(o, fn(k, S[k])); return o; }

export function upper(state, c) {
  const { t, sit, walk, phase, rm, seed } = c;
  const sw = Math.sin(phase) * walk;
  switch (state) {
    case 'type': return {
      'spine.x': 0.14, 'spine.y': 0, 'head.x': -0.06 - 0.16 * Math.max(0, Math.sin(t * 0.45 + seed)) + Math.sin(t * 0.8 + seed) * 0.03, 'head.y': Math.sin(t * 0.5 + seed) * 0.08,
      ...arms((k, s) => {
        const tap = Math.max(0, Math.sin(t * 15 + (s > 0 ? 0 : Math.PI) + Math.sin(t * 3.1) * 1.5));
        return { [`sh${k}.x`]: -0.72, [`sh${k}.z`]: -s * 0.1, [`sh${k}.y`]: s * 0.15, [`el${k}.x`]: -1.0 + tap * 0.14, [`hand${k}.x`]: 0.35 - tap * 0.25 };
      }),
    };
    case 'talk': return {
      'spine.x': 0.03, 'head.x': Math.sin(t * 3.6) * 0.07 - 0.05, 'head.y': Math.sin(t * 0.9 + seed) * 0.18, 'head.z': Math.sin(t * 1.3) * 0.05,
      'shR.x': -0.4 + Math.sin(t * 2.7) * 0.14, 'shR.z': -0.28, 'elR.x': -1.3 + Math.sin(t * 4.1) * 0.25, 'handR.x': 0.2,
      'shL.x': -0.18 + Math.sin(t * 2.1 + 1) * 0.1, 'shL.z': 0.25 + Math.sin(t * 1.7) * 0.06, 'elL.x': -0.95 + Math.sin(t * 3.3) * 0.2,
    };
    case 'celebrate': return {
      'spine.x': -0.1, 'head.x': -0.3, 'head.y': 0, 'head.z': rm ? 0 : Math.sin(t * 7) * 0.08,
      ...arms((k, s) => ({ [`sh${k}.z`]: s * 2.55, [`sh${k}.x`]: -0.2, [`el${k}.x`]: -0.3 - (rm ? 0 : Math.max(0, Math.sin(t * 9 + s)) * 0.35), [`el${k}.z`]: 0 })),
    };
    case 'frustrated': {
      const shake = rm ? 0 : Math.sin(t * 5.5) * 0.28;
      const seated = {
        'spine.x': 0.22, 'head.x': 0.3, 'head.y': shake,
        ...arms((k, s) => ({ [`sh${k}.x`]: -2.35, [`sh${k}.z`]: s * 0.5, [`el${k}.x`]: -2.0, [`hand${k}.x`]: -0.2 })),
      };
      const standing = {
        'spine.x': 0.06, 'head.x': -0.12, 'head.y': shake,
        ...arms((k, s) => ({ [`sh${k}.x`]: 0.18 + (rm ? 0 : Math.max(0, Math.sin(t * 7 + s)) * 0.14), [`sh${k}.z`]: s * 0.3, [`el${k}.x`]: -0.55, [`hand${k}.x`]: 0.3 })),
      };
      return mix(standing, seated, sit);
    }
    case 'carry': return {
      'spine.x': -0.05, 'head.x': 0.02,
      ...arms((k, s) => ({ [`sh${k}.x`]: -0.95 + sw * 0.04, [`sh${k}.z`]: s * 0.06, [`el${k}.x`]: -0.62, [`hand${k}.x`]: 0.15, [`hand${k}.z`]: -s * 0.35 })),
    };
    case 'wave': return {
      'head.z': 0.12, 'head.x': -0.12, 'spine.z': -0.06,
      'shR.z': -2.4, 'shR.x': -0.3, 'elR.x': -0.45, 'elR.z': -Math.sin(t * 8) * 0.5, 'handR.x': 0,
    };
    default: return {}; // idle, walk, sit: the base pose
  }
}
// the pose under every state: arms hang (or swing when walking, or rest on the lap when seated); head glances round
export function base(c) {
  const { t, sit, walk, phase, seed } = c;
  const sw = Math.sin(phase) * walk;
  const standing = {
    'spine.x': 0.05 * walk, 'spine.y': Math.sin(phase) * 0.1 * walk, 'spine.z': 0,
    'head.x': -0.08 - walk * 0.02, 'head.y': Math.sin(t * 0.43 + seed * 2) * 0.3 * (1 - walk), 'head.z': Math.sin(t * 0.7 + seed) * 0.05 * (1 - walk),
    ...arms((k, s) => ({ [`sh${k}.x`]: 0.04 + s * sw * 0.5, [`sh${k}.y`]: 0, [`sh${k}.z`]: s * 0.1, [`el${k}.x`]: -0.18 - 0.25 * walk, [`el${k}.z`]: 0, [`hand${k}.x`]: 0, [`hand${k}.z`]: 0 })),
  };
  if (sit <= 0) return standing;
  const glance = Math.max(0, Math.sin(t * 0.37 + seed));
  const seated = {
    ...standing, 'spine.x': 0.02, 'spine.y': 0, 'head.x': -0.14 - 0.2 * glance, 'head.y': Math.sin(t * 0.43 + seed * 2) * 0.2,
    ...arms((k, s) => ({ [`sh${k}.x`]: -0.42, [`sh${k}.z`]: s * 0.1, [`el${k}.x`]: -0.8, [`hand${k}.x`]: 0.2 })),
  };
  return mix(standing, seated, sit);
}
export function mix(a, b, k) {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const o = { ...a };
  for (const key of Object.keys(b)) o[key] = (a[key] ?? 0) + (b[key] - (a[key] ?? 0)) * k;
  return o;
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
