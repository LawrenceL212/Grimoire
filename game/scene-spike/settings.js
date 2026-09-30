// settings.js: EVERY visual constant of the spike lives in this one object.
// The tweak panel edits it live; later it can become the game's theme file.

export const DEFAULTS = {
  palette: {
    bg: '#16120f',        // page / sky base
    bgGlow: '#4a3322',    // warm haze behind the diorama
    ink: '#14110f',
    paper: '#1d1915',
    text: '#efe6d2',
    gold: '#d9a441',
    danger: '#e2574c',
    ok: '#6fbf8b',
    tileA: '#4a3b2f',     // hallway checker
    tileB: '#5b4939',
    tileWood: '#8a5c3a',  // room floors
    wall: '#5a4533',
    base: '#1f1813',      // diorama slab
  },
  shirts: {
    ada: '#d9a441',
    bea: '#5d8fb3',
    cy: '#b8574c',
    dev: '#6fbf8b',
    mo: '#8f6fb0',
  },
  camera: { pitch: 32, yaw: 6, zoom: 1.12, fov: 30 },       // pitch = degrees from straight down
  light: { sun: 2.9, sunColor: '#ffcf94', hemi: 1.45, lamps: 1.0, shadowSoft: 3, dusk: 0.3, exposure: 1.2, rim: 0.9, rimColor: '#8f86ff' },
  world: { tileFill: 0.92, tileHeight: 0.22 },
  chars: { scale: 1.25 },
  drone: { scale: 1.4, speed: 1.0, trail: 56 },
  anim: { speed: 1.0 },
  ui: { hudScale: 1.0, codeOpacity: 0.94 },
  toggles: { outlines: true, toon: true, fog: false, glow: true },
};

export const PRESETS = {
  'Warm dusk': {},
  'Bright day': {
    palette: { bg: '#7f929c', bgGlow: '#c3d0d6', tileA: '#5b4a3b', tileB: '#665342', tileWood: '#a4764b', wall: '#7b6450', base: '#3d3027' },
    light: { sun: 3.4, sunColor: '#fff2dc', hemi: 1.7, lamps: 0.35, dusk: 0.0, shadowSoft: 2 },
    toggles: { fog: false },
  },
  'Night lab': {
    palette: { bg: '#07090d', bgGlow: '#1b2533', gold: '#e3b456', tileA: '#1b1d22', tileB: '#22252b', tileWood: '#4a3a2e', wall: '#2c2c33', base: '#101116' },
    light: { sun: 0.7, sunColor: '#8ea6ff', hemi: 0.55, lamps: 1.8, dusk: 1.0, shadowSoft: 4 },
    toggles: { fog: true },
  },
  'Cozy paper': {
    palette: { bg: '#d9c9a8', bgGlow: '#fff3da', tileA: '#c9b48f', tileB: '#d4c09b', tileWood: '#b3855b', wall: '#8c6f55', base: '#6b5540' },
    light: { sun: 2.7, sunColor: '#ffe6c0', hemi: 1.6, lamps: 0.6, dusk: 0.15, shadowSoft: 5 },
    toggles: { fog: false },
  },
};

const KEY = 'grimoire.sceneSpike.settings.v3';
const clone = (o) => JSON.parse(JSON.stringify(o));
function deepMerge(into, from) {
  for (const k of Object.keys(from || {})) {
    if (from[k] && typeof from[k] === 'object' && !Array.isArray(from[k])) deepMerge(into[k] ??= {}, from[k]);
    else if (k in into || typeof into === 'object') into[k] = from[k];
  }
  return into;
}

export const settings = clone(DEFAULTS);
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (saved) deepMerge(settings, saved);
} catch { /* storage blocked: defaults only */ }

let saveTimer = 0;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ } }, 200);
}
export function resetSettings() { deepMerge(settings, clone(DEFAULTS)); save(); }
export function applyPreset(name) { deepMerge(settings, clone(DEFAULTS)); deepMerge(settings, clone(PRESETS[name] || {})); save(); }
export function get(path) { return path.split('.').reduce((o, k) => o[k], settings); }
export function set(path, v) { const ks = path.split('.'); const last = ks.pop(); ks.reduce((o, k) => o[k], settings)[last] = v; save(); }

// Schema the tweak panel is generated from (also the list in the report).
export const SCHEMA = [
  ['Palette', [
    ['palette.bg', 'color', 'Background / sky'], ['palette.bgGlow', 'color', 'Sky haze'],
    ['palette.tileA', 'color', 'Floor tile A'], ['palette.tileB', 'color', 'Floor tile B'], ['palette.tileWood', 'color', 'Room floor'],
    ['palette.wall', 'color', 'Walls'], ['palette.base', 'color', 'Diorama base'],
    ['palette.gold', 'color', 'Gold accent'], ['palette.danger', 'color', 'Danger'], ['palette.ok', 'color', 'OK'],
    ['palette.ink', 'color', 'UI ink'], ['palette.paper', 'color', 'UI paper'], ['palette.text', 'color', 'UI text'],
  ]],
  ['Characters', [
    ['shirts.ada', 'color', 'Ada shirt'], ['shirts.bea', 'color', 'Bea shirt'], ['shirts.cy', 'color', 'Cy shirt'], ['shirts.dev', 'color', 'Dev shirt'], ['shirts.mo', 'color', 'Mo shirt (desk)'],
    ['chars.scale', 'range', 'Character scale', 0.6, 1.6, 0.01],
  ]],
  ['Camera', [
    ['camera.pitch', 'range', 'Pitch (deg from top)', 5, 75, 0.5], ['camera.yaw', 'range', 'Yaw (deg)', -180, 180, 0.5],
    ['camera.zoom', 'range', 'Zoom', 0.5, 2.2, 0.01], ['camera.fov', 'range', 'Field of view', 15, 70, 0.5],
  ]],
  ['Light', [
    ['light.sun', 'range', 'Sun intensity', 0, 6, 0.05], ['light.sunColor', 'color', 'Sun colour'],
    ['light.hemi', 'range', 'Sky fill', 0, 3, 0.05], ['light.lamps', 'range', 'Lamp strength', 0, 3, 0.05],
    ['light.shadowSoft', 'range', 'Shadow softness', 0, 10, 0.1], ['light.dusk', 'range', 'Time of dusk', 0, 1, 0.01],
    ['light.exposure', 'range', 'Exposure', 0.4, 2.2, 0.01],
    ['light.rim', 'range', 'Rim light', 0, 3, 0.05], ['light.rimColor', 'color', 'Rim colour'],
  ]],
  ['World', [
    ['world.tileFill', 'range', 'Tile size (fill)', 0.7, 1.0, 0.005], ['world.tileHeight', 'range', 'Tile thickness', 0.05, 0.6, 0.01],
  ]],
  ['Drone', [
    ['drone.scale', 'range', 'Drone size', 0.5, 2, 0.01], ['drone.speed', 'range', 'Drone speed', 0.4, 3, 0.05], ['drone.trail', 'range', 'Trail length', 0, 120, 1],
  ]],
  ['Motion & UI', [
    ['anim.speed', 'range', 'Animation speed', 0.2, 3, 0.05], ['ui.hudScale', 'range', 'HUD scale', 0.7, 1.5, 0.01], ['ui.codeOpacity', 'range', 'Code window opacity', 0.4, 1, 0.01],
  ]],
  ['Look', [
    ['toggles.outlines', 'bool', 'Outlines'], ['toggles.toon', 'bool', 'Toon shading'], ['toggles.fog', 'bool', 'Fog'], ['toggles.glow', 'bool', 'Glow (fake bloom)'],
  ]],
];
