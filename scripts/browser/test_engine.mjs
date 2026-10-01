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

// ---- panning: middle / right / shift drag, two fingers, keys, bounds, reset ----
const pn = await page.evaluate(async () => {
  const th = await import('./theme.js'); const rd = await import('./renderer.js');
  th.resetTheme();
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:400px';
  document.getElementById('root').appendChild(canvas);
  const stage = rd.createStage(canvas, { reducedMotion: true });
  stage.frame(() => {});
  const V = stage.camera.position.constructor;
  const out = {};
  const ground = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    stage.camera.updateMatrixWorld(true);
    const p = new V(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1, 0.5).unproject(stage.camera);
    const d = p.sub(stage.camera.position);
    return stage.camera.position.clone().addScaledVector(d, -stage.camera.position.y / d.y);
  };
  const ev = (type, id, x, y, extra = {}) => canvas.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, ...extra }));
  const tgt = () => stage.target;
  const drag = (init, a, b) => {
    stage.resetView(); stage.frameAll();
    const t0 = tgt(), g = ground(a[0], a[1]);
    ev('pointerdown', 1, a[0], a[1], init); ev('pointermove', 1, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, init); ev('pointermove', 1, b[0], b[1], init); ev('pointerup', 1, b[0], b[1], init);
    const g2 = ground(b[0], b[1]);
    return { moved: tgt().distanceTo(t0), flat: Math.abs(tgt().y - t0.y), err: g.distanceTo(g2) };
  };
  stage.setPanBounds({ minX: -1e3, maxX: 1e3, minZ: -1e3, maxZ: 1e3 });
  out.middle = drag({ button: 1 }, [320, 260], [400, 200]);
  out.right = drag({ button: 2 }, [320, 260], [250, 300]);
  out.shift = drag({ button: 0, shiftKey: true }, [320, 260], [380, 330]);
  out.plain = (() => { stage.resetView(); stage.frameAll(); const t0 = tgt(); ev('pointerdown', 1, 320, 260); ev('pointermove', 1, 400, 200); ev('pointerup', 1, 400, 200); return tgt().distanceTo(t0); })();
  // at another orbit angle and zoom
  stage.resetView(); stage.frameAll();
  ev('pointerdown', 1, 10, 10); ev('pointermove', 1, 130, 60); ev('pointerup', 1, 130, 60);
  canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -500, bubbles: true, cancelable: true }));
  { const t0 = tgt(), g = ground(300, 250); const i = { button: 1 };
    ev('pointerdown', 1, 300, 250, i); ev('pointermove', 1, 360, 280, i); ev('pointerup', 1, 360, 280, i);
    out.tilted = { moved: tgt().distanceTo(t0), err: g.distanceTo(ground(360, 280)) }; }
  // two fingers: midpoint pans, distance zooms
  stage.resetView(); stage.frameAll();
  { const t0 = tgt(), d0 = stage.camera.position.distanceTo(tgt());
    ev('pointerdown', 1, 280, 200, { pointerType: 'touch' }); ev('pointerdown', 2, 360, 200, { pointerType: 'touch' });
    ev('pointermove', 1, 280, 240); ev('pointermove', 2, 360, 240); // both fingers move down: pan only
    const t1 = tgt(); out.twoPan = t1.distanceTo(t0); out.twoPanZoom = Math.abs(stage.camera.position.distanceTo(t1) - d0);
    ev('pointermove', 1, 240, 240); ev('pointermove', 2, 400, 240); // spread: zoom
    out.twoZoom = stage.camera.position.distanceTo(tgt()) < d0 - 0.01;
    ev('pointerup', 1, 240, 240); ev('pointerup', 2, 400, 240); }
  // keys
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  stage.resetView(); stage.frameAll();
  { const t0 = tgt();
    dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true })); await wait(300); dispatchEvent(new KeyboardEvent('keyup', { key: 'd', bubbles: true }));
    out.keyD = tgt().distanceTo(t0);
    const t1 = tgt();
    dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })); await wait(300); dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', bubbles: true }));
    out.keyUp = tgt().distanceTo(t1);
    const t2 = tgt();
    dispatchEvent(new KeyboardEvent('keydown', { key: 'w', ctrlKey: true, bubbles: true })); await wait(200); dispatchEvent(new KeyboardEvent('keyup', { key: 'w', bubbles: true }));
    out.keyCtrl = tgt().distanceTo(t2);
    const ta = document.createElement('textarea'); document.body.appendChild(ta); ta.focus();
    const t3 = tgt();
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true })); await wait(200); ta.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', bubbles: true }));
    out.keyTextarea = tgt().distanceTo(t3); ta.remove(); }
  // bounds, reset, focus
  stage.resetView(); stage.frameAll();
  stage.setPanBounds({ minX: -1, maxX: 1, minZ: -1, maxZ: 1 });
  { const i = { button: 1 };
    for (let k = 0; k < 6; k++) { ev('pointerdown', 1, 100, 350, i); ev('pointermove', 1, 600, 50, i); ev('pointerup', 1, 600, 50, i); }
    const t = tgt(); out.clamped = Math.abs(t.x) <= 1.0001 && Math.abs(t.z) <= 1.0001 && (Math.abs(t.x) > 0.5 || Math.abs(t.z) > 0.5);
    stage.resetView(); const r = tgt(); out.resetPan = Math.abs(r.x) < 1e-6 && Math.abs(r.z) < 1e-6 && stage.panOffset.x === 0;
    stage.setPanBounds({ minX: -1e3, maxX: 1e3, minZ: -1e3, maxZ: 1e3 });
    ev('pointerdown', 1, 100, 350, i); ev('pointermove', 1, 600, 50, i); ev('pointerup', 1, 600, 50, i);
    out.hadPan = Math.hypot(stage.panOffset.x, stage.panOffset.z) > 1;
    await stage.focus({ x: 0, y: 0, z: 0 }); out.focusPan = Math.hypot(stage.panOffset.x, stage.panOffset.z) === 0 && tgt().length() < 1e-6;
    ev('pointerdown', 1, 100, 350, i); ev('pointermove', 1, 600, 50, i); ev('pointerup', 1, 600, 50, i);
    stage.frameAll(); out.framePan = Math.hypot(stage.panOffset.x, stage.panOffset.z) === 0; }
  // the context menu is suppressed on the canvas only
  const cm = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); canvas.dispatchEvent(cm);
  const cm2 = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); document.body.dispatchEvent(cm2);
  out.menuCanvas = cm.defaultPrevented; out.menuBody = cm2.defaultPrevented;
  stage.dispose();
  th.set('palette.gold', '#ff0000'); // left persisted for the reload check
  return out;
});
t.check('middle-drag pans along the ground, the grabbed point stays under the cursor', pn.middle.moved > 0.05 && pn.middle.flat < 1e-6 && pn.middle.err < 0.02, JSON.stringify(pn.middle));
t.check('right-drag pans the same way', pn.right.moved > 0.05 && pn.right.flat < 1e-6 && pn.right.err < 0.02, JSON.stringify(pn.right));
t.check('shift + left drag pans, plain left drag still orbits only', pn.shift.moved > 0.05 && pn.shift.err < 0.02 && pn.plain < 1e-6, JSON.stringify([pn.shift, pn.plain]));
t.check('panning holds at a tilted, zoomed view', pn.tilted.moved > 0.02 && pn.tilted.err < 0.02, JSON.stringify(pn.tilted));
t.check('two fingers pan by their midpoint and pinch zooms', pn.twoPan > 0.05 && pn.twoPanZoom < 1e-3 && pn.twoZoom === true, JSON.stringify([pn.twoPan, pn.twoPanZoom, pn.twoZoom]));
t.check('WASD and arrow keys pan; Ctrl+W and typing in a textarea do not', pn.keyD > 0.05 && pn.keyUp > 0.05 && pn.keyCtrl < 1e-6 && pn.keyTextarea < 1e-6, JSON.stringify([pn.keyD, pn.keyUp, pn.keyCtrl, pn.keyTextarea]));
t.check('pan bounds clamp the target', pn.clamped === true, JSON.stringify(pn.clamped));
t.check('resetView, focus and frameAll clear the pan', pn.resetPan === true && pn.hadPan === true && pn.focusPan === true && pn.framePan === true, JSON.stringify([pn.resetPan, pn.hadPan, pn.focusPan, pn.framePan]));
t.check('the context menu is suppressed on the canvas only', pn.menuCanvas === true && pn.menuBody === false, JSON.stringify([pn.menuCanvas, pn.menuBody]));

// ---- panning, round 2: key guards, horizon rays, frame-rate independent inertia ----
const p2 = await page.evaluate(async () => {
  const th = await import('./theme.js'); const rd = await import('./renderer.js');
  th.resetTheme();
  const out = {};
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const mk = (rm) => {
    const canvas = document.createElement('canvas'); canvas.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:400px';
    document.getElementById('root').appendChild(canvas);
    return { canvas, stage: rd.createStage(canvas, { reducedMotion: rm }) };
  };
  const evOn = (canvas) => (type, id, x, y, extra = {}) => canvas.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, ...extra }));
  // key guards
  {
    const { stage } = mk(true); stage.frame(() => {}); stage.setPanBounds({ minX: -1e3, maxX: 1e3, minZ: -1e3, maxZ: 1e3 });
    stage.resetView(); stage.frameAll();
    const key = async (el, type, key) => { const e = new KeyboardEvent(type, { key, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e; };
    const run = async (el) => { const t0 = stage.target; await key(el, 'keydown', 'ArrowLeft'); await wait(250); await key(el, 'keyup', 'ArrowLeft'); return stage.target.distanceTo(t0); };
    const bar = document.createElement('div'); bar.tabIndex = 0; document.body.appendChild(bar);
    bar.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') e.preventDefault(); });
    out.keyHandled = await run(bar);
    const sl = document.createElement('div'); sl.setAttribute('role', 'slider'); sl.tabIndex = 0; document.body.appendChild(sl);
    out.keySlider = await run(sl);
    const bt = document.createElement('button'); document.body.appendChild(bt);
    out.keyButton = await run(bt);
    bt.focus(); out.keyFocusedButton = await run(bt); // a focused plain button (a HUD button after a click) pans
    const tw = document.createElement('div'); tw.className = 'gm-tweak'; const tb = document.createElement('button'); tw.appendChild(tb); document.body.appendChild(tw);
    tb.focus(); out.keyTweakButton = await run(tb); tw.remove();
    const mi = document.createElement('button'); mi.setAttribute('role', 'menuitem'); document.body.appendChild(mi); mi.focus();
    out.keyMenuItem = await run(mi); mi.remove();
    const ti = document.createElement('input'); document.body.appendChild(ti); ti.focus(); out.keyInput = await run(ti); ti.remove();
    out.keyBody = await run(document.body);
    bar.remove(); sl.remove(); bt.remove(); stage.dispose();
  }
  // a ray just under the horizon must not fling the camera
  {
    const { canvas, stage } = mk(true); const ev = evOn(canvas);
    stage.setPanBounds({ minX: -1e4, maxX: 1e4, minZ: -1e4, maxZ: 1e4 });
    th.set('camera.fov', 110);
    stage.frameAll();
    ev('pointerdown', 1, 0, 5000, { button: 0 }); ev('pointermove', 1, 0, -10000); ev('pointerup', 1, 0, -10000); // pitch to the maximum
    const V = stage.camera.position.constructor;
    const overGround = (cy) => { stage.camera.updateMatrixWorld(true); const p = new V(0, -(cy / 400) * 2 + 1, 0.5).unproject(stage.camera); return p.sub(stage.camera.position).y < -1e-6; };
    let row = 0; while (row < 400 && !overGround(row)) row++;
    const d = stage.camera.position.distanceTo(stage.target), t0 = stage.target;
    const i = { button: 1 };
    ev('pointerdown', 1, 320, row + 1, i); ev('pointermove', 1, 320, row + 3, i); ev('pointerup', 1, 320, row + 3, i);
    out.horizon = { row, moved: stage.target.distanceTo(t0), d };
    stage.dispose();
  }
  // inertia: the same distance at 30 fps and at 144 fps
  {
    const { canvas, stage } = mk(false); const ev = evOn(canvas);
    stage.setPanBounds({ minX: -1e3, maxX: 1e3, minZ: -1e3, maxZ: 1e3 });
    th.resetTheme();
    const coast = (fps) => {
      stage.resetView(); stage.frameAll();
      const i = { button: 1 };
      ev('pointerdown', 1, 320, 260, i); ev('pointermove', 1, 340, 250, i); ev('pointermove', 1, 360, 240, i); ev('pointerup', 1, 360, 240, i);
      const t0 = stage.target;
      for (let k = 0; k < fps * 1.5; k++) stage.advance(1 / fps);
      return stage.target.distanceTo(t0);
    };
    out.coast30 = coast(30); out.coast144 = coast(144);
    // held still before release: no fling
    stage.resetView(); stage.frameAll();
    const i = { button: 1 };
    ev('pointerdown', 1, 320, 260, i); ev('pointermove', 1, 360, 240, i); await wait(150); ev('pointerup', 1, 360, 240, i);
    const t0 = stage.target; for (let k = 0; k < 60; k++) stage.advance(1 / 60);
    out.heldStill = stage.target.distanceTo(t0);
    stage.dispose();
  }
  th.set('palette.gold', '#ff0000'); // left persisted for the reload check
  return out;
});
t.check('a keydown another handler already took (a window title bar) does not pan', p2.keyHandled < 1e-6, String(p2.keyHandled));
t.check('arrow keys pan from the body or a plain (focused) button, not from a slider, menu item, tweak-panel button or text input', p2.keySlider < 1e-6 && p2.keyButton > 0.05 && p2.keyFocusedButton > 0.05 && p2.keyTweakButton < 1e-6 && p2.keyMenuItem < 1e-6 && p2.keyInput < 1e-6 && p2.keyBody > 0.05, JSON.stringify([p2.keySlider, p2.keyButton, p2.keyFocusedButton, p2.keyTweakButton, p2.keyMenuItem, p2.keyInput, p2.keyBody]));
t.check('a drag just under the horizon does not fling the camera', p2.horizon.moved < p2.horizon.d * 2, JSON.stringify(p2.horizon));
t.check('pan inertia coasts the same distance at 30 and 144 fps', p2.coast30 > 0.05 && Math.abs(p2.coast30 - p2.coast144) / p2.coast30 < 0.1, `${p2.coast30} ${p2.coast144}`);
t.check('holding still before release leaves no fling', p2.heldStill < 1e-6, String(p2.heldStill));

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
