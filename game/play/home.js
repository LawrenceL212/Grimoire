// home.js: the home room's controller on the play page. It ties the life record's `home` (home-rules.js: balance,
// owned things, where they stand), the 3D room (home-view.js) and the HUD together. The shop and edit mode live in
// home-ui.js and use this controller's apply().
//
//   createHome({ L, hud, app, getOffice, getStage, rects, hudHeight, RM }) -> {
//     mode              'office' | 'home'
//     home              the current home record (life.home)
//     setMode(mode)     switch the 3D scene (a short fade; none with reduced motion); the code and ticket windows stay
//     toggle()
//     apply(result)     a result of home-rules.js (buy, sell, place, ...): ok -> stored in the life and shown; returns the result
//     sync()            the balance chip and the room follow the life (the chapter calls it after a solve)
//     view              the 3D room (null until the first visit)
//   }

// (home-view.js, which needs three, is loaded with a dynamic import on the first visit, so a missing WebGL never stops the page)
const FADE_MS = 220;
export function createHome({ L, hud, app, getOffice, getStage, rects, hudHeight, RM = false, onMode } = {}) {
  let mode = 'office', view = null, busy = null;
  const api = {
    get mode() { return mode; },
    get home() { return L.life.home; },
    get view() { return view; },
    sync() {
      hud.setBalance(L.life.home.balance);
      view?.sync(L.life.home.items, api.selected ?? null);
    },
    apply(result) {
      if (result?.ok && result.home) { L.life = { ...L.life, home: result.home }; api.sync(); }
      return result;
    },
    selected: null,
    toggle() { return api.setMode(mode === 'home' ? 'office' : 'home'); },
    async setMode(next) {
      if (next === mode && !busy) return;
      if (busy) await busy;
      if (next === mode) return;
      busy = (async () => {
        const office = getOffice();
        const fade = document.getElementById('home-fade');
        const dim = async (on) => { if (RM || !fade) return; fade.classList.toggle('on', on); await new Promise((r) => setTimeout(r, FADE_MS)); };
        await dim(true);
        mode = next;
        if (office) {
          if (next === 'home') {
            view ??= (await import('./home-view.js')).createHomeView(getStage());
            view.sync(L.life.home.items, api.selected);
            office.map.root.visible = false; view.show(true);
            office.setFocusBox(view.bounds);
          } else {
            view?.show(false); office.map.root.visible = true;
            office.setFocusBox();
          }
          office.frame(rects(), hudHeight());
        }
        hud.setHome(next === 'home');
        onMode?.(next);
        await dim(false);
      })();
      await busy; busy = null;
    },
  };
  api.sync();
  return api;
}
