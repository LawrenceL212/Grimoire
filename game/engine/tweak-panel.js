// tweak-panel.js: a self-contained "tweak the look" panel generated from theme.SCHEMA.
// mountTweakPanel(root) adds a gear button and a panel (toggled by the T key) to root.
import { theme, SCHEMA, PRESETS, get, set, applyPreset, resetTheme, onThemeChange } from './theme.js';

const CSS = `
.gm-tweak-btn{position:absolute;right:12px;bottom:12px;z-index:30;width:36px;height:36px;border-radius:8px;border:1px solid #3a3026;background:#221c17;color:#efe6d2;cursor:pointer;font:18px system-ui,sans-serif}
.gm-tweak-btn:hover{border-color:#d9a441}
.gm-tweak{position:absolute;right:12px;bottom:56px;z-index:31;width:300px;max-height:70%;overflow:auto;padding:8px 10px 12px;border-radius:10px;border:1px solid #3a3026;background:#1d1915;color:#efe6d2;font:12px system-ui,sans-serif}
.gm-tweak[hidden]{display:none}
.gm-tweak .top{display:flex;gap:6px;margin-bottom:6px}
.gm-tweak select,.gm-tweak button{font:12px system-ui,sans-serif;color:#efe6d2;background:#221c17;border:1px solid #3a3026;border-radius:6px;padding:5px 7px;cursor:pointer}
.gm-tweak select{flex:1;min-width:0}
.gm-tweak h4{margin:12px 0 4px;font:700 10.5px system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#d9a441}
.gm-tweak .tw{display:grid;grid-template-columns:1fr 110px 36px;gap:6px;align-items:center;margin:3px 0}
`;

export function mountTweakPanel(root = document.body) {
  if (!document.getElementById('gm-tweak-css')) {
    const st = document.createElement('style'); st.id = 'gm-tweak-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const btn = document.createElement('button');
  btn.className = 'gm-tweak-btn'; btn.type = 'button'; btn.title = 'Tweak the look (T)'; btn.setAttribute('aria-label', 'Tweak the look'); btn.textContent = '⚙';
  const panel = document.createElement('section');
  panel.className = 'gm-tweak'; panel.hidden = true; panel.setAttribute('aria-label', 'Tweak the look');
  panel.innerHTML = '<div class="top"><select aria-label="Preset"></select><button type="button" data-act="copy">Copy settings</button><button type="button" data-act="reset">Reset</button></div><div class="fields"></div>';
  root.append(btn, panel);

  const fields = panel.querySelector('.fields');
  const presetEl = panel.querySelector('select');
  const inputs = {};
  const fmt = (v) => (typeof v === 'number' ? (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2)) : '');
  for (const [group, rows] of SCHEMA) {
    const h = document.createElement('h4'); h.textContent = group; fields.appendChild(h);
    for (const [path, type, label, min, max, step] of rows) {
      const row = document.createElement('div'); row.className = 'tw';
      const id = 'gm-tw-' + path.replace('.', '-');
      const lab = document.createElement('label'); lab.htmlFor = id; lab.title = path; lab.textContent = label;
      const inp = document.createElement('input'); inp.id = id;
      const out = document.createElement('output');
      if (type === 'color') inp.type = 'color';
      else if (type === 'bool') inp.type = 'checkbox';
      else Object.assign(inp, { type: 'range', min, max, step });
      inp.addEventListener('input', () => {
        const v = type === 'bool' ? inp.checked : type === 'range' ? parseFloat(inp.value) : inp.value;
        set(path, v);
      });
      row.append(lab, inp, out); fields.appendChild(row);
      inputs[path] = { inp, out, type };
    }
  }
  function sync() {
    for (const [p, f] of Object.entries(inputs)) {
      const v = get(p);
      if (f.type === 'bool') f.inp.checked = !!v; else f.inp.value = v;
      f.out.textContent = fmt(v);
    }
  }
  const off = onThemeChange((p) => { if (!p) sync(); else if (inputs[p]) { inputs[p].out.textContent = fmt(get(p)); } });

  presetEl.innerHTML = '<option value="">Preset…</option>' + Object.keys(PRESETS).map((n) => `<option>${n}</option>`).join('');
  presetEl.addEventListener('change', () => { if (presetEl.value) applyPreset(presetEl.value); });
  panel.querySelector('[data-act="reset"]').addEventListener('click', () => { resetTheme(); presetEl.value = ''; });
  const copyBtn = panel.querySelector('[data-act="copy"]');
  copyBtn.addEventListener('click', async () => {
    const txt = JSON.stringify(theme, null, 2);
    try { await navigator.clipboard.writeText(txt); copyBtn.textContent = 'Copied!'; }
    catch {
      const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); copyBtn.textContent = 'Copied!'; } catch { copyBtn.textContent = 'Copy failed'; }
      ta.remove();
    }
    setTimeout(() => { copyBtn.textContent = 'Copy settings'; }, 1400);
  });

  const toggle = (force) => { const show = force ?? panel.hidden; panel.hidden = !show; if (show) sync(); };
  btn.addEventListener('click', () => toggle());
  const onKey = (e) => {
    if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) toggle();
  };
  addEventListener('keydown', onKey);
  sync();
  return { toggle, sync, panel, button: btn, unmount() { off(); removeEventListener('keydown', onKey); btn.remove(); panel.remove(); } };
}
