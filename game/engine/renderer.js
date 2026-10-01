// renderer.js: the stage. One WebGL renderer, one scene, a theme-driven camera and a frame loop.
import * as THREE from 'three';
import { get, onThemeChange } from './theme.js';
import { updateTweens, tween, ease, lerp } from './kit.js';

export function createStage(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = get('light.exposure');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(get('camera.fov'), 1, 0.5, 300);
  const target = new THREE.Vector3(0, 0, 0);
  const state = { dist: 25, zoom: get('camera.zoom') };
  // User view offsets: session state only, never written to the theme.
  const view = { yaw: 0, pitch: 0, zoom: 1, yawV: 0, pitchV: 0 };
  // Pan: a ground-plane offset added to the target; session state, clamped so the target stays inside bounds.
  const pan = { x: 0, z: 0, vx: 0, vz: 0 };
  const bounds = { minX: -200, maxX: 200, minZ: -200, maxZ: 200 };
  const PITCH = [15, 75], ZOOM = [0.5, 2.5];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  let focusGen = 0;
  const callbacks = new Set();
  const lostCallbacks = new Set();
  let raf = 0, last = 0, disposed = false;

  const _pan = new THREE.Vector3(), _look = new THREE.Vector3(), _ndc = new THREE.Vector3(), _dir = new THREE.Vector3();
  function place() {
    view.pitch = clamp(get('camera.pitch') + view.pitch, PITCH[0], PITCH[1]) - get('camera.pitch');
    const p = THREE.MathUtils.degToRad(get('camera.pitch') + view.pitch), y = THREE.MathUtils.degToRad(get('camera.yaw') + view.yaw);
    const zoom = clamp(state.zoom * view.zoom, ZOOM[0], ZOOM[1]);
    const d = state.dist / zoom;
    pan.x = clamp(target.x + pan.x, bounds.minX, bounds.maxX) - target.x;
    pan.z = clamp(target.z + pan.z, bounds.minZ, bounds.maxZ) - target.z;
    camera.fov = get('camera.fov');
    camera.position.set(Math.sin(p) * Math.sin(y) * d, Math.cos(p) * d, Math.sin(p) * Math.cos(y) * d).add(target).add(_pan.set(pan.x, 0, pan.z));
    camera.lookAt(_look.copy(target).add(_pan));
    camera.updateProjectionMatrix();
  }
  function resize() {
    const w = canvas.clientWidth || canvas.width || 1, h = canvas.clientHeight || canvas.height || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    place();
  }
  const onResize = () => resize();
  addEventListener('resize', onResize);

  const offTheme = onThemeChange((path) => {
    renderer.toneMappingExposure = get('light.exposure');
    if (!path || path.startsWith('camera')) { state.zoom = get('camera.zoom'); place(); }
  });

  // Fit the whole scene (its bounding sphere) in view.
  function frameAll() {
    const box = new THREE.Box3().setFromObject(scene);
    if (box.isEmpty()) { target.set(0, 0, 0); state.dist = 25; }
    else {
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      target.copy(sphere.center);
      const vh = Math.tan(THREE.MathUtils.degToRad(get('camera.fov') / 2));
      state.dist = (sphere.radius / Math.min(vh, vh * camera.aspect)) * 1.05;
    }
    state.zoom = get('camera.zoom');
    pan.x = pan.z = pan.vx = pan.vz = 0;
    place();
  }
  // Aim at a point from a set distance (before the theme zoom), e.g. the game's own framing distance.
  function setDistance(dist, at = target) {
    target.set(at.x ?? 0, at.y ?? 0, at.z ?? 0);
    state.dist = dist;
    state.zoom = get('camera.zoom');
    place();
  }
  // Move the camera target to a point (or Object3D), optionally changing zoom. Instant under reduced motion.
  function focus(at, { zoom } = {}) {
    const to = at && at.isObject3D ? at.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(at?.x ?? 0, at?.y ?? 0, at?.z ?? 0);
    const z1 = zoom ?? state.zoom;
    const gen = ++focusGen;
    target.x += pan.x; target.z += pan.z; pan.x = pan.z = pan.vx = pan.vz = 0; // deliberate aim: start from where the eye is, drop the pan
    if (reducedMotion) { target.copy(to); state.zoom = z1; place(); return Promise.resolve(); }
    const from = target.clone(), z0 = state.zoom;
    return tween(0.6, (k) => { if (gen !== focusGen) return; target.lerpVectors(from, to, k); state.zoom = lerp(z0, z1, k); place(); }, ease.inOut);
  }

  function tick(now) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    updateTweens(dt);
    if (!reducedMotion && (Math.abs(view.yawV) > 0.01 || Math.abs(view.pitchV) > 0.01) && pointers.size === 0) {
      view.yaw += view.yawV; view.pitch += view.pitchV;
      const k = Math.exp(-6 * dt); view.yawV *= k; view.pitchV *= k;
      place();
    }
    if (!reducedMotion && (Math.abs(pan.vx) > 1e-4 || Math.abs(pan.vz) > 1e-4) && pointers.size === 0) {
      panBy(pan.vx, pan.vz);
      const k = Math.exp(-8 * dt); pan.vx *= k; pan.vz *= k;
    }
    if (held.size) keyPan(dt); else keyV.x = keyV.z = 0;
    for (const fn of [...callbacks]) fn(dt, now / 1000);
    renderer.render(scene, camera);
  }
  function frame(fn) {
    callbacks.add(fn);
    if (!raf && !disposed) { last = 0; raf = requestAnimationFrame(tick); }
    return () => callbacks.delete(fn);
  }

  // ---- user orbit / zoom: drag, one-finger touch, wheel, two-finger pinch ----
  const pointers = new Map();
  let pinch = 0;
  canvas.style.touchAction = 'none';
  const pinchDist = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const modeOf = (e) => ((e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey && e.pointerType !== 'touch')) ? 'pan' : 'orbit');
  // The point of the ground (y = 0) under a client position, or null above the horizon.
  function groundAt(cx, cy, out) {
    const r = canvas.getBoundingClientRect();
    const w = r.width || canvas.clientWidth || 1, h = r.height || canvas.clientHeight || 1;
    camera.updateMatrixWorld(true);
    _ndc.set(((cx - r.left) / w) * 2 - 1, -((cy - r.top) / h) * 2 + 1, 0.5).unproject(camera);
    _dir.copy(_ndc).sub(camera.position);
    if (_dir.y > -1e-6) return null;
    return out.copy(camera.position).addScaledVector(_dir, -camera.position.y / _dir.y);
  }
  function panBy(dx, dz) { pan.x += dx; pan.z += dz; place(); }
  const g0 = new THREE.Vector3(), g1 = new THREE.Vector3();
  // Move the target so the ground point that was under (ax, ay) is now under (bx, by).
  function panScreen(ax, ay, bx, by) {
    if (!groundAt(ax, ay, g0) || !groundAt(bx, by, g1)) return null;
    const dx = g0.x - g1.x, dz = g0.z - g1.z;
    panBy(dx, dz);
    return { dx, dz };
  }
  const onDown = (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, mode: modeOf(e) });
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    view.yawV = view.pitchV = 0; pan.vx = pan.vz = 0;
    if (e.button === 1) e.preventDefault();
    if (pointers.size === 2) pinch = pinchDist();
  };
  const onMove = (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY, mode: prev.mode };
    if (pointers.size === 1) {
      if (prev.mode === 'pan') {
        const m = panScreen(prev.x, prev.y, cur.x, cur.y);
        if (m) { pan.vx = m.dx; pan.vz = m.dz; }
      } else {
        const dy = (cur.x - prev.x) * -0.4, dp = (cur.y - prev.y) * -0.3;
        view.yaw += dy; view.pitch += dp;
        view.yawV = dy; view.pitchV = dp;
      }
    }
    if (pointers.size === 2) {
      const olds = [...pointers.entries()].map(([id, p]) => (id === e.pointerId ? prev : p));
      const news = [...pointers.entries()].map(([id, p]) => (id === e.pointerId ? cur : p));
      panScreen((olds[0].x + olds[1].x) / 2, (olds[0].y + olds[1].y) / 2, (news[0].x + news[1].x) / 2, (news[0].y + news[1].y) / 2);
    }
    pointers.set(e.pointerId, cur);
    if (pointers.size === 2) {
      const d = pinchDist();
      if (pinch > 0 && d > 0) view.zoom = clamp(view.zoom * (d / pinch), 0.1, 10);
      pinch = d;
    }
    place();
  };
  const onUp = (e) => { pointers.delete(e.pointerId); pinch = 0; };
  const noMenu = (e) => e.preventDefault();
  const noAutoscroll = (e) => { if (e.button === 1) e.preventDefault(); };
  canvas.addEventListener('contextmenu', noMenu);
  canvas.addEventListener('mousedown', noAutoscroll);
  canvas.addEventListener('auxclick', noMenu);

  // ---- WASD / arrows: smooth, frame-rate independent, relative to the view direction ----
  const held = new Set(), keyV = { x: 0, z: 0 };
  const KEYS = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r' };
  const typing = (t) => !!t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName || ''));
  const onKeyDown = (e) => {
    const k = KEYS[String(e.key).toLowerCase()];
    if (!k || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || typing(document.activeElement)) return;
    held.add(k);
    if (e.key.startsWith('Arrow')) e.preventDefault();
  };
  const onKeyUp = (e) => { const k = KEYS[String(e.key).toLowerCase()]; if (k) held.delete(k); };
  const onBlur = () => held.clear();
  function keyPan(dt) {
    const yaw = THREE.MathUtils.degToRad(get('camera.yaw') + view.yaw);
    const ix = (held.has('r') ? 1 : 0) - (held.has('l') ? 1 : 0), iz = (held.has('f') ? 1 : 0) - (held.has('b') ? 1 : 0);
    const speed = (state.dist / clamp(state.zoom * view.zoom, ZOOM[0], ZOOM[1])) * 0.6; // ground units per second
    const wx = Math.cos(yaw) * ix - Math.sin(yaw) * iz, wz = -Math.sin(yaw) * ix - Math.cos(yaw) * iz;
    const n = Math.hypot(wx, wz) || 1;
    const go = ix || iz ? speed : 0;
    const k = reducedMotion ? 1 : 1 - Math.exp(-14 * dt); // ease toward the wanted velocity
    keyV.x += ((wx / n) * go - keyV.x) * k;
    keyV.z += ((wz / n) * go - keyV.z) * k;
    if (Math.abs(keyV.x) + Math.abs(keyV.z) > 1e-5) panBy(keyV.x * dt, keyV.z * dt);
  }
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', onBlur);
  function setPanBounds(b = {}) {
    for (const k of ['minX', 'maxX', 'minZ', 'maxZ']) if (Number.isFinite(b[k])) bounds[k] = b[k];
    place();
  }
  const onWheel = (e) => { e.preventDefault(); view.zoom = clamp(view.zoom * Math.exp(-e.deltaY * 0.001), 0.1, 10); place(); };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  function resetView() { view.yaw = view.pitch = view.yawV = view.pitchV = 0; view.zoom = 1; pan.x = pan.z = pan.vx = pan.vz = 0; place(); }

  const onContextLost = (e) => { e.preventDefault(); for (const fn of [...lostCallbacks]) fn(); };
  canvas.addEventListener('webglcontextlost', onContextLost);
  const onLost = (fn) => { lostCallbacks.add(fn); return () => lostCallbacks.delete(fn); };

  function dispose() {
    disposed = true; focusGen++;
    for (const [ev, fn] of [['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onUp], ['wheel', onWheel], ['contextmenu', noMenu], ['mousedown', noAutoscroll], ['auxclick', noMenu]]) canvas.removeEventListener(ev, fn);
    removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur);
    cancelAnimationFrame(raf); raf = 0;
    removeEventListener('resize', onResize);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    offTheme(); callbacks.clear(); lostCallbacks.clear();
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch { /* already lost */ }
  }

  resize();
  return { scene, camera, renderer, frame, focus, frameAll, setDistance, onLost, resetView, setPanBounds, dispose, get panOffset() { return { x: pan.x, z: pan.z }; }, get target() { return target.clone().add(_pan.set(pan.x, 0, pan.z)); } };
}
