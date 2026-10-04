// home-ui.js: the shop window and edit mode. DOM only (no three): picking in the 3D room goes through home.view.
//
//   createHomeUi({ home, hud, wins, app, getStage }) -> { shop: { open(), close(), toggle(), isOpen }, edit: { on(), off(), toggle(), isOn, select(uid), selected } }
//
// SHOP: a floating window (stacked under the code window on a phone) listing what is for sale with its price. Buying puts
//   the thing in the owned, unplaced list. A thing you cannot afford says how much more it needs ("£20 more to go").
// EDIT MODE (the Edit button, only at home): pick a thing up (click it, or click it in the list), move it (click a tile, the
//   arrow keys, or the arrow buttons), turn it (R or the button), recolour it (swatches, where it supports it), put it
//   away, sell it back at half price. A refused placement says why (overlap, outside the room, the door, the way to the desk).
import { CATALOG, SHOP, buy, sell, place, unplace, recolour, findSpot, snap, checkPlacement, nameOf, sellPrice, priceOf, wallSlots, footOf } from './home-rules.js';
import { get as tget } from '../engine/theme.js';

const HALF_PI = Math.PI / 2;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => `£${n}`;

export function createHomeUi({ home, hud, wins, app, getStage }) {
  // ---------------------------------------------------------------- the windows
  const mk = (id, title, html) => {
    const el = document.createElement('section');
    el.id = id; el.hidden = true; el.setAttribute('aria-label', title);
    el.innerHTML = `<div class="bar" aria-label="${title}"><span class="dot"></span><span>${title.toUpperCase()}</span><span class="sp"></span><button type="button" class="hm-x" aria-label="Close ${title.toLowerCase()}">×</button></div><div class="body">${html}</div>`;
    app.appendChild(el);
    return el;
  };
  const shopEl = mk('win-shop', 'Shop', '<p class="hm-balance" id="shop-balance"></p><ul class="hm-list" id="shop-list"></ul><p class="hm-msg" id="shop-msg" role="status" aria-live="polite"></p>');
  const editEl = mk('win-edit', 'Edit room', '<div id="edit-sel"></div><h3 class="hm-h">Owned, not placed</h3><ul class="hm-list" id="edit-unplaced"></ul><p class="hm-msg" id="edit-msg" role="status" aria-live="polite"></p>');
  wins.add(shopEl, { id: 'shop', x: 0, right: 16, y: 84, w: 330, h: 450, minW: 260, minH: 200 });
  wins.add(editEl, { id: 'edit', x: 0, right: 358, y: 84, w: 300, h: 450, minW: 260, minH: 200 });
  const $ = (root, s) => root.querySelector(s);
  const say = (el, text, bad = false) => { el.textContent = text; el.classList.toggle('bad', bad); };

  // ---------------------------------------------------------------- the shop
  function renderShop() {
    const bal = home.home.balance;
    $(shopEl, '#shop-balance').textContent = `You have ${money(bal)}. Money comes only from fresh problems you solve on your own.`;
    const rows = [...SHOP].sort((a, b) => priceOf(a) - priceOf(b) || a.localeCompare(b));
    $(shopEl, '#shop-list').innerHTML = rows.map((id) => {
      const d = CATALOG[id], short = Math.max(0, d.price - bal);
      return `<li class="hm-row ${short ? 'is-short' : ''}" data-id="${id}"><span class="hm-name">${esc(d.name)}<small>${d.tiles.join('×')} tiles${d.tones ? ' · recolourable' : ''}</small></span>`
        + `<b class="hm-price">${money(d.price)}</b><button type="button" class="hm-btn" data-buy="${id}" aria-label="Buy ${esc(d.name)} for ${money(d.price)}">${short ? `${money(short)} to go` : 'Buy'}</button></li>`;
    }).join('');
  }
  shopEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-buy]');
    if (b) {
      const r = home.apply(buy(home.home, b.dataset.buy));
      if (r.ok) { say($(shopEl, '#shop-msg'), `Bought: the ${CATALOG[b.dataset.buy].name.toLowerCase()} is in your room's owned list. Open Edit to put it down.`); }
      else say($(shopEl, '#shop-msg'), r.reason, true);
      renderShop(); renderEdit();
      return;
    }
    if (e.target.closest('.hm-x')) shop.close();
  });
  const shop = {
    get isOpen() { return !shopEl.hidden; },
    open() { shopEl.hidden = false; renderShop(); hud.setShop(true); if (wins.isPhone) shopEl.scrollIntoView({ block: 'nearest' }); },
    close() { shopEl.hidden = true; hud.setShop(false); },
    toggle() { shop.isOpen ? shop.close() : shop.open(); },
  };

  // ---------------------------------------------------------------- edit mode
  let editOn = false;
  const itemOf = (uid) => home.home.items.find((i) => i.uid === uid) || null;
  const sel = () => (home.selected ? itemOf(home.selected) : null);
  const COL = { fabric: 'Blue', fabricAlt: 'Red', mint: 'Mint', coral: 'Coral', felt: 'Felt', woodLight: 'Light wood', woodDark: 'Dark wood', gold: 'Gold' };
  function renderEdit() {
    const it = sel();
    const head = $(editEl, '#edit-sel');
    if (!it || it.x === null) {
      home.selected = it && it.x !== null ? home.selected : null;
      head.innerHTML = `<p class="hm-hint">Click a thing in the room to pick it up, then click a tile, use the arrow keys, or press R to turn it.</p>`;
    } else {
      const d = CATALOG[it.id];
      head.innerHTML = `<h3 class="hm-h">${esc(nameOf(it))}</h3>
        <div class="hm-ctl" role="group" aria-label="Move ${esc(nameOf(it))}">
          <button type="button" class="hm-btn" data-move="0,-1" aria-label="Move up (away from you)">↑</button>
          <button type="button" class="hm-btn" data-move="-1,0" aria-label="Move left">←</button>
          <button type="button" class="hm-btn" data-move="0,1" aria-label="Move down (towards you)">↓</button>
          <button type="button" class="hm-btn" data-move="1,0" aria-label="Move right">→</button>
          <button type="button" class="hm-btn" data-act="rotate" title="Turn it (R)" ${d.kind === 'wall' ? 'disabled' : ''}>Rotate (R)</button>
        </div>
        ${d.tones ? `<div class="hm-sw" role="group" aria-label="Colour">${d.tones.map((t) => `<button type="button" class="hm-swatch ${it.tone === t ? 'on' : ''}" data-tone="${t}" aria-label="Colour ${COL[t] || t}" aria-pressed="${it.tone === t}" title="${COL[t] || t}" style="background:${tget(`palette.${t}`)}"></button>`).join('')}</div>` : ''}
        <div class="hm-ctl"><button type="button" class="hm-btn" data-act="away">Put away</button>
        <button type="button" class="hm-btn" data-act="sell" ${it.starter ? 'disabled title="A starter thing is worth nothing back"' : ''}>Sell for ${money(sellPrice(it))}</button>
        <button type="button" class="hm-btn" data-act="done">Done</button></div>`;
    }
    const un = home.home.items.filter((i) => i.x === null);
    $(editEl, '#edit-unplaced').innerHTML = un.length ? un.map((i) => `<li class="hm-row" data-uid="${i.uid}"><span class="hm-name">${esc(nameOf(i))}<small>${CATALOG[i.id].tiles.join('×')} tiles</small></span>`
      + `<button type="button" class="hm-btn" data-put="${i.uid}" aria-label="Place the ${esc(nameOf(i))}">Place</button><button type="button" class="hm-btn" data-sell="${i.uid}" aria-label="Sell the ${esc(nameOf(i))} for ${money(sellPrice(i))}">Sell ${money(sellPrice(i))}</button></li>`).join('')
      : '<li class="hm-empty">Nothing waiting: buy something in the shop.</li>';
  }
  function select(uid) {
    home.selected = uid; home.sync(); renderEdit(); view()?.setCursor(null);
    if (uid && editOn) say($(editEl, '#edit-msg'), `${nameOf(itemOf(uid))}: move it with the arrow keys or a click; R turns it.`);
  }
  const view = () => home.view;
  function act(r, okMsg) {
    if (r.ok) { home.apply(r); if (okMsg) say($(editEl, '#edit-msg'), okMsg); } else say($(editEl, '#edit-msg'), r.reason, true);
    renderEdit(); renderShop();
    return r;
  }
  function moveTo(spot) {
    const it = sel(); if (!it) return null;
    return act(place(home.home, it.uid, spot));
  }
  function nudge(dx, dz) {
    const it = sel(); if (!it || it.x === null) return null;
    const d = CATALOG[it.id];
    if (d.kind === 'wall') { // the next free slot in that direction
      const slots = wallSlots().filter((s) => Math.abs(s.x - it.x) > 1e-6 || Math.abs(s.z - it.z) > 1e-6);
      let best = null, bd = Infinity;
      for (const s of slots) { const vx = s.x - it.x, vz = s.z - it.z; if (vx * dx + vz * dz <= 0) continue; const dist = Math.hypot(vx, vz) + Math.abs(vx * dz) + Math.abs(vz * dx); if (dist < bd) { bd = dist; best = s; } }
      if (!best) return act({ ok: false, reason: 'There is no more wall that way.' });
      return moveTo(best);
    }
    const step = d.kind === 'top' ? 0.25 : 1;
    return moveTo({ x: it.x + dx * step, z: it.z + dz * step, rot: it.rot });
  }
  function rotate() {
    const it = sel(); if (!it || it.x === null) return null;
    if (CATALOG[it.id].kind === 'wall') return act({ ok: false, reason: 'Wall things hang flat: nothing to turn.' });
    return moveTo({ x: it.x, z: it.z, rot: it.rot + HALF_PI });
  }
  editEl.addEventListener('click', (e) => {
    if (e.target.closest('.hm-x')) { edit.off(); return; }
    const mv = e.target.closest('[data-move]');
    if (mv) { const [dx, dz] = mv.dataset.move.split(',').map(Number); nudge(dx, dz); editEl.querySelector(`[data-move="${mv.dataset.move}"]`)?.focus(); return; }
    const a = e.target.closest('[data-act]')?.dataset.act;
    const it = sel();
    if (a === 'rotate') { rotate(); editEl.querySelector('[data-act="rotate"]')?.focus(); return; }
    if (a === 'done') { select(null); return; }
    if (a === 'away' && it) { const r = act(unplace(home.home, it.uid), `The ${nameOf(it).toLowerCase()} is back in your owned list.`); if (r.ok) select(null); return; }
    if (a === 'sell' && it) { const r = act(sell(home.home, it.uid), `Sold the ${nameOf(it).toLowerCase()}.`); if (r.ok) { say($(editEl, '#edit-msg'), `Sold the ${nameOf(it).toLowerCase()} for ${money(r.refund)} (half price).`); select(null); } return; }
    const tone = e.target.closest('[data-tone]')?.dataset.tone;
    if (tone && it) { act(recolour(home.home, it.uid, tone), `Recoloured.`); return; }
    const put = e.target.closest('[data-put]')?.dataset.put;
    if (put) {
      const item = itemOf(put), spot = findSpot(home.home.items, item);
      if (!spot) { say($(editEl, '#edit-msg'), `There is no room for the ${nameOf(item).toLowerCase()} right now (every spot is taken, or would block the door or the way to your desk).`, true); return; }
      const r = act(place(home.home, put, spot), `Placed the ${nameOf(item).toLowerCase()}.`);
      if (r.ok) select(put);
      return;
    }
    const sl = e.target.closest('[data-sell]')?.dataset.sell;
    if (sl) { const item = itemOf(sl); const r = act(sell(home.home, sl)); if (r.ok) say($(editEl, '#edit-msg'), `Sold the ${nameOf(item).toLowerCase()} for ${money(r.refund)} (half price).`); }
  });

  // keyboard: arrows move the picked thing (and not the camera while one is picked), R turns it, Delete puts it away, Escape lets go
  addEventListener('keydown', (e) => {
    if (!editOn || home.mode !== 'home' || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target instanceof Element ? e.target : null;
    if (el && (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.isContentEditable || el.closest('.bar'))) return;
    const it = sel();
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    let used = false;
    if (dir && it) { nudge(...dir); used = true; }
    else if ((e.key === 'r' || e.key === 'R') && it) { rotate(); used = true; }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && it) { const r = act(unplace(home.home, it.uid), `The ${nameOf(it).toLowerCase()} is back in your owned list.`); if (r.ok) select(null); used = true; }
    else if (e.key === 'Escape') { if (it) select(null); else edit.off(); used = true; }
    if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // pointer: click a thing to pick it up, click a tile to put the picked thing there, hover to see whether it would fit
  const canvas = document.querySelector('#scene canvas');
  let down = null;
  const ground = (x, y, it) => { const v = view(), st = getStage(); return v && st ? v.ground(x, y, st.camera, canvas, it && CATALOG[it.id].kind === 'top' ? 0.6 : 0) : null; };
  canvas?.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  canvas?.addEventListener('pointerup', (e) => {
    const d = down; down = null;
    if (!editOn || home.mode !== 'home' || !d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
    const v = view(), st = getStage();
    if (!v || !st) return;
    const uid = v.pick(e.clientX, e.clientY, st.camera, canvas);
    if (uid) { select(uid); return; }
    const it = sel();
    if (!it) return;
    const g = ground(e.clientX, e.clientY, it);
    if (g) moveTo({ x: g.x, z: g.z, rot: it.rot });
  });
  canvas?.addEventListener('pointermove', (e) => {
    const it = sel();
    if (!editOn || home.mode !== 'home' || !it || e.buttons) { if (view()) view().setCursor(null); return; }
    const g = ground(e.clientX, e.clientY, it);
    if (!g) return;
    const d = CATALOG[it.id], s = snap(d, { x: g.x, z: g.z, rot: it.rot });
    const rest = home.home.items.filter((i) => i.uid !== it.uid && i.x !== null);
    const ok = checkPlacement(rest, { id: it.id, ...s }).ok;
    view()?.setCursor({ ok, foot: d.kind === 'wall' ? { x0: s.x - 0.5, x1: s.x + 0.5, z0: s.z - 0.5, z1: s.z + 0.5 } : footOf(d, s.x, s.z, s.rot) });
  });

  const edit = {
    get isOn() { return editOn; },
    get selected() { return home.selected; },
    on() {
      if (home.mode !== 'home') return;
      editOn = true; editEl.hidden = false; hud.setEdit(true); renderEdit();
      if (wins.isPhone) editEl.scrollIntoView({ block: 'nearest' });
    },
    off() { editOn = false; editEl.hidden = true; hud.setEdit(false); if (home.selected) select(null); view()?.setCursor(null); },
    toggle() { editOn ? edit.off() : edit.on(); },
    select,
  };
  // leaving the room ends edit mode
  home.onLeave = () => { if (editOn) edit.off(); };
  return { shop, edit, render() { if (shop.isOpen) renderShop(); if (editOn) renderEdit(); } };
}
