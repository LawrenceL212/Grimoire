// windows.js: floating windows over the scene. On a desktop they drag by their title bar, resize by the
// grip in the corner, come to the front when touched, stay on screen when the viewport shrinks, and
// remember where they were (localStorage, try/catch: a blocked or corrupt store falls back to the
// default). On a phone (narrow viewport) the same elements are stacked panels under the scene.
//
//   createWindows(host, { phoneQuery, storageKey, onChange }) -> {
//     add(el, { id, x, y, w, h, minW, minH, right }) -> win   el has a .bar child (the handle) and gets a .grip
//     layout()           re-clamp every window to the viewport (called on resize)
//     rects()            [{ id, x, y, w, h }] of the floating windows (empty on a phone)
//     isPhone            true while the phone layout is on
//     reset()            forget stored positions and go back to the defaults
//   }
//   A default may be given from the right edge (right: 16 means 16 px from the right).
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const EDGE = 8; // a window keeps at least this far inside the viewport

export function createWindows(host, { phoneQuery = '(max-width: 720px)', storageKey = 'grimoire.play.windows.v1', onChange } = {}) {
  const wins = new Map();
  const mq = matchMedia(phoneQuery);
  let z = 10;
  let stored = {};
  try {
    const s = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (s && typeof s === 'object' && !Array.isArray(s)) stored = s;
  } catch { stored = {}; }
  const valid = (r) => r && ['x', 'y', 'w', 'h'].every((k) => typeof r[k] === 'number' && Number.isFinite(r[k]));
  function save() {
    const out = {};
    for (const [id, w] of wins) if (w.moved) out[id] = { x: w.x, y: w.y, w: w.w, h: w.h };
    try { localStorage.setItem(storageKey, JSON.stringify(out)); } catch { /* storage blocked: positions last this visit */ }
  }
  const area = () => ({ W: host.clientWidth || innerWidth, H: host.clientHeight || innerHeight });

  function apply(w) {
    const { el } = w;
    if (mq.matches) { el.style.left = el.style.top = el.style.width = el.style.height = ''; return; }
    const { W, H } = area();
    w.w = clamp(w.w, w.minW, Math.max(w.minW, W - EDGE * 2));
    w.h = clamp(w.h, w.minH, Math.max(w.minH, H - EDGE * 2));
    w.x = clamp(w.x, EDGE, Math.max(EDGE, W - w.w - EDGE));
    w.y = clamp(w.y, EDGE, Math.max(EDGE, H - w.h - EDGE));
    Object.assign(el.style, { left: `${w.x}px`, top: `${w.y}px`, width: `${w.w}px`, height: `${w.h}px` });
  }
  function front(w) { w.el.style.zIndex = String(++z); }

  function drag(w, e, mode) {
    if (mq.matches || e.button > 0) return;
    if (mode === 'move' && e.target.closest('button, input, select, textarea, a, [data-nodrag]')) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, x0 = w.x, y0 = w.y, w0 = w.w, h0 = w.h;
    const target = e.currentTarget;
    try { target.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    w.el.classList.add(mode === 'move' ? 'is-dragging' : 'is-sizing');
    const move = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (mode === 'move') { w.x = x0 + dx; w.y = y0 + dy; } else { w.w = w0 + dx; w.h = h0 + dy; }
      apply(w);
      onChange?.();
    };
    const up = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      w.el.classList.remove('is-dragging', 'is-sizing');
      w.moved = true; save(); onChange?.();
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  }
  // keyboard: with the title bar focused, arrows move the window (Shift: resize), 10 px a step
  function keys(w, e) {
    if (mq.matches) return;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    if (e.shiftKey) { w.w += d[0] * 10; w.h += d[1] * 10; } else { w.x += d[0] * 10; w.y += d[1] * 10; }
    apply(w); w.moved = true; save(); onChange?.();
  }

  // the default place, worked out for the viewport as it is now (a window never moved follows it)
  function defOf(o) {
    const { W, H } = area();
    const h = typeof o.h === 'function' ? o.h(W, H) : o.h;
    return { w: o.w, h, x: o.right !== undefined ? W - o.right - o.w : o.x, y: o.y };
  }
  function add(el, o) {
    const s = stored[o.id];
    const w = { id: o.id, el, o, minW: o.minW ?? 240, minH: o.minH ?? 120, moved: valid(s), ...(valid(s) ? s : defOf(o)) };
    el.classList.add('win');
    const bar = el.querySelector('.bar');
    bar.tabIndex = 0;
    bar.setAttribute('aria-label', `${bar.getAttribute('aria-label') || o.id} window: drag, or use the arrow keys to move it (Shift to resize)`);
    const grip = document.createElement('div');
    grip.className = 'grip'; grip.setAttribute('aria-hidden', 'true');
    el.appendChild(grip);
    bar.addEventListener('pointerdown', (e) => drag(w, e, 'move'));
    grip.addEventListener('pointerdown', (e) => drag(w, e, 'size'));
    bar.addEventListener('keydown', (e) => keys(w, e));
    el.addEventListener('pointerdown', () => front(w), true);
    wins.set(o.id, w);
    apply(w); front(w);
    return w;
  }
  function layout() {
    host.classList.toggle('is-phone', mq.matches);
    for (const w of wins.values()) { if (!w.moved) Object.assign(w, defOf(w.o)); apply(w); }
    onChange?.();
  }
  mq.addEventListener?.('change', layout);
  addEventListener('resize', layout);
  host.classList.toggle('is-phone', mq.matches);
  return {
    add, layout,
    get isPhone() { return mq.matches; },
    rects() { return mq.matches ? [] : [...wins.values()].map(({ id, x, y, w, h }) => ({ id, x, y, w, h })); },
    reset() { for (const w of wins.values()) { Object.assign(w, defOf(w.o)); w.moved = false; apply(w); } save(); onChange?.(); },
  };
}
