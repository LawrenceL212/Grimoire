// theme.js: EVERY visual constant of the game lives in this one object.
// The tweak panel edits it live; materials made with kit.themed() follow it.

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
    // floor tiles (game/art/materials.js): each pattern is drawn in greys and multiplied by its colour
    floorWood: '#a0714a',
    floorCarpet: '#6a5a86',
    floorLino: '#c2ae86',
    floorConcrete: '#9a948a',
    floorRubber: '#5a6068',
    floorCeramic: '#d3dcd6',
    wall: '#5a4533',
    base: '#1f1813',      // diorama slab
    // furniture and props (game/art/furniture.js)
    woodLight: '#b98555', // desk tops, shelves, frames
    woodDark: '#6b4529',  // carcasses, legs, trims
    metal: '#3b3632',     // dark metal and plastic: bases, bezels, fittings
    chrome: '#b9b3a8',    // bright metal: handles, frames, gas lifts
    fabric: '#4f6d85',    // upholstery
    fabricAlt: '#a4493b', // accent fabric: cushions, rug, coats, the vending machine
    plastic: '#e8dfcc',   // off-white plastic: cabinets, the water cooler, mugs
    leaf: '#4f8a45',
    leafLight: '#86b65a',
    pot: '#b8643f',       // terracotta
    sheet: '#f2ead8',     // paper sheets, notes, labels
    cork: '#b58a58',      // cork and cardboard
    glass: '#86c4e0',     // glass and water
    bulb: '#ffd98a',      // lit bulbs and lamps
    plaster: '#c8b394',   // the upper wall (palette.wall is its panelling)
  },
  shirts: {
    ada: '#d9a441',
    bea: '#5d8fb3',
    cy: '#b8574c',
    dev: '#6fbf8b',
    mo: '#8f6fb0',
  },
  camera: { pitch: 32, yaw: 6, zoom: 1.12, fov: 30 },       // pitch = degrees from straight down
  light: { sun: 2.9, sunColor: '#ffcf94', hemi: 1.45, lamps: 1.0, shadowSoft: 3, dusk: 0.3, exposure: 1.2, rim: 0.9, rimColor: '#8f86ff', contact: 0.7 },
  world: { tileFill: 0.92, tileHeight: 0.22 },
  chars: { scale: 1.25 },
  drone: { scale: 1.4, speed: 1.0, trail: 56 },
  anim: { speed: 1.0 },
  ui: { hudScale: 1.0, codeOpacity: 0.94 },
  toggles: { outlines: true, toon: true, fog: false, glow: true },
};

export const PRESETS = {
  'Warm dusk': {}, // the DEFAULTS, floor colours included
  'Bright day': {
    palette: { bg: '#7f929c', bgGlow: '#c3d0d6', tileA: '#5b4a3b', tileB: '#665342', tileWood: '#a4764b', wall: '#7b6450', base: '#3d3027',
      floorWood: '#b8864f', floorCarpet: '#5f7f9a', floorLino: '#d6c6a0', floorConcrete: '#aaa49a', floorRubber: '#5c636c', floorCeramic: '#e8eeea',
      woodLight: '#c79563', woodDark: '#7a5233', metal: '#434a52', chrome: '#c9ccd0', fabric: '#3f7ba6', fabricAlt: '#d0663f', plastic: '#f2efe8',
      leaf: '#4d9a48', leafLight: '#8fca5c', pot: '#c46e45', sheet: '#fbf8f0', cork: '#c49a66', glass: '#96d2ec', bulb: '#fff0c0', plaster: '#e3d6c0' },
    light: { sun: 3.4, sunColor: '#fff2dc', hemi: 1.7, lamps: 0.35, dusk: 0.0, shadowSoft: 2 },
    toggles: { fog: false },
  },
  'Night lab': {
    palette: { bg: '#07090d', bgGlow: '#1b2533', gold: '#e3b456', tileA: '#1b1d22', tileB: '#22252b', tileWood: '#4a3a2e', wall: '#2c2c33', base: '#101116',
      floorWood: '#5e4633', floorCarpet: '#343c5c', floorLino: '#6a6452', floorConcrete: '#55555a', floorRubber: '#34383f', floorCeramic: '#7f8c8e',
      woodLight: '#8a6a4e', woodDark: '#4a3528', metal: '#2a2d33', chrome: '#8e96a3', fabric: '#3c4f73', fabricAlt: '#7d3b4a', plastic: '#b9bcc4',
      leaf: '#3a7050', leafLight: '#5fa07a', pot: '#8a5a48', sheet: '#cfd3dc', cork: '#8a7058', glass: '#6fb4d8', bulb: '#b8d8ff', plaster: '#5c5f6b' },
    light: { sun: 0.7, sunColor: '#8ea6ff', hemi: 0.55, lamps: 1.8, dusk: 1.0, shadowSoft: 4 },
    toggles: { fog: true },
  },
  'Cozy paper': {
    palette: { bg: '#d9c9a8', bgGlow: '#fff3da', tileA: '#c9b48f', tileB: '#d4c09b', tileWood: '#b3855b', wall: '#8c6f55', base: '#6b5540',
      floorWood: '#c29260', floorCarpet: '#a27266', floorLino: '#e2d1a8', floorConcrete: '#b8ae9c', floorRubber: '#6a645c', floorCeramic: '#f1e9d8',
      woodLight: '#c99a6a', woodDark: '#8a5f3e', metal: '#5a4f45', chrome: '#cfc3b0', fabric: '#7a8f6a', fabricAlt: '#c0705a', plastic: '#f4ead6',
      leaf: '#6b9a52', leafLight: '#a3c46e', pot: '#c27a52', sheet: '#fbf3e2', cork: '#c9a270', glass: '#9fd0d8', bulb: '#ffe4b0', plaster: '#eadbc0' },
    light: { sun: 2.7, sunColor: '#ffe6c0', hemi: 1.6, lamps: 0.6, dusk: 0.15, shadowSoft: 5 },
    toggles: { fog: false },
  },
};

const KEY = 'grimoire.theme.v1';
const clone = (o) => JSON.parse(JSON.stringify(o));
function deepMerge(into, from) {
  for (const k of Object.keys(from || {})) {
    if (from[k] && typeof from[k] === 'object' && !Array.isArray(from[k])) deepMerge(into[k] ??= {}, from[k]);
    else into[k] = from[k];
  }
  return into;
}

export const theme = clone(DEFAULTS);
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (saved && typeof saved === 'object') deepMerge(theme, saved);
} catch { /* storage blocked or corrupt: defaults only */ }

const listeners = new Set();
export function onThemeChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(path) { for (const fn of [...listeners]) { try { fn(path, theme); } catch (e) { console.error(e); } } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(theme)); } catch { /* ignore */ } }

export function get(path) { return path.split('.').reduce((o, k) => o?.[k], theme); }
export function set(path, v) {
  const ks = path.split('.'); const last = ks.pop();
  ks.reduce((o, k) => (o[k] ??= {}), theme)[last] = v;
  save(); emit(path);
}
export function resetTheme() { deepMerge(theme, clone(DEFAULTS)); save(); emit(''); }
export function applyPreset(name) { deepMerge(theme, clone(DEFAULTS)); deepMerge(theme, clone(PRESETS[name] || {})); save(); emit(''); }

// Schema the tweak panel is generated from (also the list in the report).
export const SCHEMA = [
  ['Palette', [
    ['palette.bg', 'color', 'Background / sky'], ['palette.bgGlow', 'color', 'Sky haze'],
    ['palette.tileA', 'color', 'Floor tile A'], ['palette.tileB', 'color', 'Floor tile B'], ['palette.tileWood', 'color', 'Room floor'],
    ['palette.floorWood', 'color', 'Floor: wood'], ['palette.floorCarpet', 'color', 'Floor: carpet'], ['palette.floorLino', 'color', 'Floor: lino'],
    ['palette.floorConcrete', 'color', 'Floor: concrete'], ['palette.floorRubber', 'color', 'Floor: gym rubber'], ['palette.floorCeramic', 'color', 'Floor: ceramic'],
    ['palette.wall', 'color', 'Walls: panelling'], ['palette.plaster', 'color', 'Walls: plaster'], ['palette.base', 'color', 'Diorama base'],
    ['palette.gold', 'color', 'Gold accent'], ['palette.danger', 'color', 'Danger'], ['palette.ok', 'color', 'OK'],
    ['palette.ink', 'color', 'UI ink'], ['palette.paper', 'color', 'UI paper'], ['palette.text', 'color', 'UI text'],
  ]],
  ['Furniture', [
    ['palette.woodLight', 'color', 'Wood: light'], ['palette.woodDark', 'color', 'Wood: dark'],
    ['palette.metal', 'color', 'Dark metal'], ['palette.chrome', 'color', 'Bright metal'],
    ['palette.fabric', 'color', 'Fabric'], ['palette.fabricAlt', 'color', 'Accent fabric'], ['palette.plastic', 'color', 'Plastic'],
    ['palette.leaf', 'color', 'Leaves'], ['palette.leafLight', 'color', 'Young leaves'], ['palette.pot', 'color', 'Terracotta'],
    ['palette.sheet', 'color', 'Paper sheets'], ['palette.cork', 'color', 'Cork and cardboard'], ['palette.glass', 'color', 'Glass and water'],
    ['palette.bulb', 'color', 'Lamp bulbs'],
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
    ['light.contact', 'range', 'Contact shadows', 0, 1, 0.01],
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
