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
  const PITCH = [15, 75], ZOOM = [0.5, 2.5];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  let focusGen = 0;
  const callbacks = new Set();
  const lostCallbacks = new Set();
  let raf = 0, last = 0, disposed = false;

  function place() {
    view.pitch = clamp(get('camera.pitch') + view.pitch, PITCH[0], PITCH[1]) - get('camera.pitch');
    const p = THREE.MathUtils.degToRad(get('camera.pitch') + view.pitch), y = THREE.MathUtils.degToRad(get('camera.yaw') + view.yaw);
    const zoom = clamp(state.zoom * view.zoom, ZOOM[0], ZOOM[1]);
    const d = state.dist / zoom;
    camera.fov = get('camera.fov');
    camera.position.set(Math.sin(p) * Math.sin(y) * d, Math.cos(p) * d, Math.sin(p) * Math.cos(y) * d).add(target);
    camera.lookAt(target);
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
    place();
  }
  // Move the camera target to a point (or Object3D), optionally changing zoom. Instant under reduced motion.
  function focus(at, { zoom } = {}) {
    const to = at && at.isObject3D ? at.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(at?.x ?? 0, at?.y ?? 0, at?.z ?? 0);
    const z1 = zoom ?? state.zoom;
    const gen = ++focusGen;
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
  const onDown = (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    view.yawV = view.pitchV = 0;
    if (pointers.size === 2) pinch = pinchDist();
  };
  const onMove = (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pointers.size === 1) {
      const dy = (cur.x - prev.x) * -0.4, dp = (cur.y - prev.y) * -0.3;
      view.yaw += dy; view.pitch += dp;
      view.yawV = dy; view.pitchV = dp;
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
  const onWheel = (e) => { e.preventDefault(); view.zoom = clamp(view.zoom * Math.exp(-e.deltaY * 0.001), 0.1, 10); place(); };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  function resetView() { view.yaw = view.pitch = view.yawV = view.pitchV = 0; view.zoom = 1; place(); }

  const onContextLost = (e) => { e.preventDefault(); for (const fn of [...lostCallbacks]) fn(); };
  canvas.addEventListener('webglcontextlost', onContextLost);
  const onLost = (fn) => { lostCallbacks.add(fn); return () => lostCallbacks.delete(fn); };

  function dispose() {
    disposed = true; focusGen++;
    for (const [ev, fn] of [['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onUp], ['wheel', onWheel]]) canvas.removeEventListener(ev, fn);
    cancelAnimationFrame(raf); raf = 0;
    removeEventListener('resize', onResize);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    offTheme(); callbacks.clear(); lostCallbacks.clear();
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch { /* already lost */ }
  }

  resize();
  return { scene, camera, renderer, frame, focus, frameAll, onLost, resetView, dispose };
}
