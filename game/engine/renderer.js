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
  const callbacks = new Set();
  const lostCallbacks = new Set();
  let raf = 0, last = 0, disposed = false;

  function place() {
    const p = THREE.MathUtils.degToRad(get('camera.pitch')), y = THREE.MathUtils.degToRad(get('camera.yaw'));
    const d = state.dist / state.zoom;
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
    if (reducedMotion) { target.copy(to); state.zoom = z1; place(); return Promise.resolve(); }
    const from = target.clone(), z0 = state.zoom;
    return tween(0.6, (k) => { target.lerpVectors(from, to, k); state.zoom = lerp(z0, z1, k); place(); }, ease.inOut);
  }

  function tick(now) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    updateTweens(dt);
    for (const fn of [...callbacks]) fn(dt, now / 1000);
    renderer.render(scene, camera);
  }
  function frame(fn) {
    callbacks.add(fn);
    if (!raf && !disposed) { last = 0; raf = requestAnimationFrame(tick); }
    return () => callbacks.delete(fn);
  }

  const onContextLost = (e) => { e.preventDefault(); for (const fn of [...lostCallbacks]) fn(); };
  canvas.addEventListener('webglcontextlost', onContextLost);
  const onLost = (fn) => { lostCallbacks.add(fn); return () => lostCallbacks.delete(fn); };

  function dispose() {
    disposed = true;
    cancelAnimationFrame(raf); raf = 0;
    removeEventListener('resize', onResize);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    offTheme(); callbacks.clear(); lostCallbacks.clear();
    renderer.dispose();
  }

  resize();
  return { scene, camera, renderer, frame, focus, frameAll, onLost, dispose };
}
