// status.js: a tiny sync status chip. Hidden when there is no backend (the game just plays), so step 2 can mount it on
// the title and the play page and it costs nothing until a cloud exists.
//
//   describeStatus(status) -> { text, tone }     pure
//   createStatusChip(sync) -> HTMLElement        sync = createSync(...); the chip follows sync.onStatus
//   chip.destroy() stops listening.  Colours come from the page's CSS variables with fallbacks; text carries the meaning.
export const STATUS_TEXT = Object.freeze({
  idle: { text: '', tone: 'idle' },
  offline: { text: 'Offline: saved on this device', tone: 'warn' },
  syncing: { text: 'Syncing...', tone: 'busy' },
  synced: { text: 'Saved to the cloud', tone: 'ok' },
  error: { text: 'Could not sync: will retry', tone: 'warn' },
});
export const describeStatus = (s) => STATUS_TEXT[s] || STATUS_TEXT.idle;

export function createStatusChip(sync, doc = globalThis.document) {
  const el = doc.createElement('span');
  el.className = 'sync-chip';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.style.cssText = 'display:inline-block;padding:2px 10px;border-radius:999px;font:12px/1.6 system-ui,sans-serif;border:1px solid var(--line,#6b5a3a);color:var(--muted,#c9b98f)';
  el.hidden = true;
  const paint = (s) => {
    const d = describeStatus(s);
    el.hidden = !sync.hasBackend || s === 'idle';
    el.textContent = d.text; el.dataset.tone = d.tone; el.dataset.status = s;
  };
  const stop = sync.onStatus((s) => paint(s));
  el.destroy = stop;
  return el;
}
