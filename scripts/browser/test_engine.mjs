/* Engine and theme: export surface, themed materials, presets, persistence, stage. */
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const PAGE = 'game/engine/test.html';

const KIT = ['toon', 'toonOwn', 'rbox', 'sphere', 'capsule', 'cyl', 'cone', 'ico', 'torus', 'outlineMat', 'setOutlines', 'setToon',
  'part', 'bakeStatic', 'canvasTex', 'glowTex', 'blobTex', 'glow', 'floorGlow', 'ease', 'tween', 'wait', 'updateTweens', 'killTweens',
  'lerp', 'damp', 'dampAngle', 'rr', 'themed'];
const THEME = ['theme', 'DEFAULTS', 'PRESETS', 'SCHEMA', 'get', 'set', 'applyPreset', 'resetTheme', 'onThemeChange'];

// ---- first page: surface, themed, presets, persistence, stage ----
const { page, errors, close } = await openGame(PAGE);
await page.waitForLoadState('load');
const r = await page.evaluate(async ({ KIT, THEME }) => {
  const out = {};
  try {
    const kit = await import('./kit.js');
    const th = await import('./theme.js');
    const tp = await import('./tweak-panel.js');
    const rd = await import('./renderer.js');
    out.kitMissing = KIT.filter((k) => !(k in kit));
    out.themeMissing = THEME.filter((k) => !(k in th));
    out.presets = Object.keys(th.PRESETS);
    out.hasPanel = typeof tp.mountTweakPanel === 'function';
    out.hasStage = typeof rd.createStage === 'function';

    const m = kit.themed('palette.gold');
    const before = m.color.getHexString();
    let fired = null;
    const off = th.onThemeChange((p) => { fired = p; });
    th.set('palette.gold', '#ff0000');
    out.themedBefore = before;
    out.themedAfter = m.color.getHexString();
    out.fired = fired;
    off();
    fired = 'still';
    th.set('palette.gold', '#00ff00');
    out.unsubscribed = fired === 'still';
    th.set('palette.gold', '#ff0000'); // left persisted for the reload check

    const bg0 = th.get('palette.bg');
    th.applyPreset('Night lab');
    out.bgChanged = th.get('palette.bg') !== bg0 && th.get('palette.bg') === th.PRESETS['Night lab'].palette.bg;
    th.resetTheme();
    out.resetGold = th.get('palette.gold') === th.DEFAULTS.palette.gold;
    th.set('palette.gold', '#ff0000');

    // stage
    const canvas = document.getElementById('c');
    const stage = rd.createStage(canvas, { reducedMotion: true });
    out.stageKeys = ['scene', 'camera', 'renderer', 'frame', 'focus', 'frameAll', 'onLost', 'dispose'].filter((k) => !(k in stage));
    let frames = 0;
    stage.frame(() => { frames++; });
    await new Promise((res) => setTimeout(res, 400));
    out.frames = frames;
    stage.frameAll();
    await stage.focus({ x: 1, y: 0, z: 2 }, { zoom: 1.5 });
    stage.dispose();

    const panel = tp.mountTweakPanel(document.getElementById('root'));
    out.panelHidden = panel.panel.hidden;
    dispatchEvent(new KeyboardEvent('keydown', { key: 't' }));
    out.panelShownByT = !panel.panel.hidden;
  } catch (e) { out.error = String(e && e.stack || e); }
  return out;
}, { KIT, THEME });

t.check('the modules load', !r.error, r.error);
t.check('kit exports the spike surface plus themed', r.kitMissing?.length === 0, JSON.stringify(r.kitMissing));
t.check('theme exports its surface', r.themeMissing?.length === 0, JSON.stringify(r.themeMissing));
t.check('the four presets exist', JSON.stringify(r.presets) === JSON.stringify(['Warm dusk', 'Bright day', 'Night lab', 'Cozy paper']), JSON.stringify(r.presets));
t.check('set() recolours a themed material', r.themedBefore !== r.themedAfter && r.themedAfter === 'ff0000', `${r.themedBefore} -> ${r.themedAfter}`);
t.check('onThemeChange fires with the path and unsubscribes', r.fired === 'palette.gold' && r.unsubscribed === true, String(r.fired));
t.check('applyPreset(Night lab) changes palette.bg', r.bgChanged === true);
t.check('resetTheme restores defaults', r.resetGold === true);
t.check('createStage returns the documented members', r.stageKeys?.length === 0 && r.hasStage && r.hasPanel, JSON.stringify(r.stageKeys));
t.check('the stage frame loop runs', r.frames > 2, String(r.frames));
t.check('the tweak panel opens on the T key', r.panelHidden === true && r.panelShownByT === true);

// ---- orbit, zoom, hotkey guard, idempotent mount ----
const o = await page.evaluate(async () => {
  const th = await import('./theme.js'); const rd = await import('./renderer.js'); const tp = await import('./tweak-panel.js');
  th.resetTheme();
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:640px;height:400px';
  document.getElementById('root').appendChild(canvas);
  const stage = rd.createStage(canvas, { reducedMotion: true });
  const out = {};
  // floors and contact shadows are spaced for a near plane of 0.5 (closer planes z-fight at game distance)
  out.near = [stage.camera.near];
  stage.frameAll(); out.near.push(stage.camera.near);
  stage.setDistance(80); out.near.push(stage.camera.near);
  const pos = () => stage.camera.position.clone();
  const dist = () => stage.camera.position.length();
  const ev = (type, id, x, y) => canvas.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true }));
  stage.frameAll();
  const p0 = pos(), d0 = dist();
  ev('pointerdown', 1, 100, 100); ev('pointermove', 1, 160, 130); ev('pointerup', 1, 160, 130);
  out.dragMoved = pos().distanceTo(p0) > 0.01;
  const pitchOf = () => Math.acos(stage.camera.position.y / dist()) * 180 / Math.PI;
  ev('pointerdown', 1, 0, 0); ev('pointermove', 1, 0, 5000); ev('pointerup', 1, 0, 5000);
  out.pitchMin = pitchOf();
  ev('pointerdown', 1, 0, 5000); ev('pointermove', 1, 0, -10000); ev('pointerup', 1, 0, -10000);
  out.pitchMax = pitchOf();
  const d1 = dist();
  canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -400, bubbles: true, cancelable: true }));
  out.wheelIn = dist() < d1;
  for (let i = 0; i < 40; i++) canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -800, bubbles: true, cancelable: true }));
  out.zoomRatio = d0 / dist();
  ev('pointerdown', 1, 0, 0); ev('pointerdown', 2, 100, 0); ev('pointermove', 2, 200, 0); ev('pointerup', 1, 0, 0); ev('pointerup', 2, 200, 0);
  stage.resetView();
  out.resetOk = pos().distanceTo(p0) < 1e-6;
  out.maxZoomRatio = 2.5 / th.get('camera.zoom');
  stage.dispose();

  const inp = document.createElement('div'); inp.contentEditable = 'true'; document.body.appendChild(inp);
  const panel = tp.mountTweakPanel(document.getElementById('root'));
  const again = tp.mountTweakPanel(document.getElementById('root'));
  out.idempotent = panel === again && document.querySelectorAll('.gm-tweak-btn').length === 1;
  const was = panel.panel.hidden;
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
  out.editableIgnored = panel.panel.hidden === was;
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
  out.bodyToggles = panel.panel.hidden !== was;
  panel.unmount();
  th.set('palette.gold', '#ff0000');
  return out;
});
t.check('the stage camera keeps its near plane at 0.5 (floors and contact shadows rely on it)', o.near.every((n) => n === 0.5), JSON.stringify(o.near));
t.check('dragging the canvas orbits the camera', o.dragMoved === true);
t.check('pitch stays within 15..75 degrees', o.pitchMin >= 14.9 && o.pitchMax <= 75.1 && o.pitchMin < 16 && o.pitchMax > 74, `${o.pitchMin} ${o.pitchMax}`);
t.check('the wheel zooms, bounded', o.wheelIn === true && o.zoomRatio <= o.maxZoomRatio + 0.01, `${o.zoomRatio} <= ${o.maxZoomRatio}`);
t.check('resetView restores the default camera', o.resetOk === true);
t.check('mountTweakPanel is idempotent', o.idempotent === true);
t.check('T is ignored in a contenteditable, works on the body', o.editableIgnored === true && o.bodyToggles === true, JSON.stringify(o));

// ---- persistence across a reload ----
await page.reload({ waitUntil: 'load' });
const persisted = await page.evaluate(async () => {
  const th = await import('./theme.js');
  const kit = await import('./kit.js');
  return { gold: th.get('palette.gold'), mat: kit.themed('palette.gold').color.getHexString(), key: localStorage.getItem('grimoire.theme.v1') !== null };
});
t.check('a saved theme survives a reload', persisted.gold === '#ff0000' && persisted.mat === 'ff0000' && persisted.key, JSON.stringify(persisted));
t.check('no page errors on the first page', errors.length === 0, errors.join(' | '));
await close();

// ---- a throwing localStorage must not break boot ----
const blocked = await openGame(PAGE, {
  beforeGoto: (p) => p.addInitScript(() => {
    const boom = () => { throw new Error('storage blocked'); };
    Object.defineProperty(window, 'localStorage', { get: boom, configurable: true });
  }),
});
await blocked.page.waitForLoadState('load');
const b = await blocked.page.evaluate(async () => {
  try {
    const th = await import('./theme.js');
    const kit = await import('./kit.js');
    th.set('palette.gold', '#123456');
    return { ok: true, gold: th.get('palette.gold'), mat: kit.themed('palette.gold').color.getHexString(), def: th.DEFAULTS.palette.gold };
  } catch (e) { return { ok: false, error: String(e) }; }
});
t.check('a throwing localStorage does not break boot or set()', b.ok && b.gold === '#123456' && b.mat === '123456', JSON.stringify(b));
t.check('no page errors with storage blocked', blocked.errors.length === 0, blocked.errors.join(' | '));
await blocked.close();

t.finish();
