// file.js: the save as a file you can carry between devices (phone to laptop with no account), and take back.
//
//   exportSave({ readLocal?, now? }) -> { ok, filename: 'grimoire-save-YYYY-MM-DD.json', text } | { ok: false, error }
//   previewImport(text, { now? }) -> { ok, error?, summary: { daysInBusiness, solves, spells, balance } }
//   localSummary({ readLocal?, now? }) -> summary | null     the same summary of what is on THIS device (shown beside the file's
//        before a Replace, so the player sees what would be lost)
//   fileTooBig(bytes)     check File.size BEFORE reading the file; the cap (MAX_BYTES) is on bytes, not characters
//   applyImport(text, { mode = 'merge', confirmed, readLocal?, writeLocal?, now? }) -> { ok, mode, error?, changed, notices[] }
//        The default writer (local.js) keeps the previous save as a backup first, so any import can be undone with
//        restoreBackup().
//        merge (the default, recommended): the file and this device's save are merged (merge.js): neither loses anything
//        replace: this device's save becomes the file; the CALLER must have asked the player and passes confirmed: true,
//                 otherwise nothing happens
// Everything goes through doc.js, so a bad, oversize or tampered file is refused (or clamped by the real validators)
// and a refused file writes NOTHING. Nothing here throws. The file is the portable document itself.
//   daysInBusiness: days from the day the company started to its latest moment, counted inclusively
//   solves: tickets solved; spells: spells written in ink; balance: the home's balance in pounds
import { checkDoc, toDoc, fromDoc, canon, MAX_BYTES } from './doc.js';
import { mergeDetailed } from './merge.js';
import { localAdapter } from './local.js';

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');

export const fileTooBig = (bytes) => !(bytes <= MAX_BYTES);

export function exportSave({ readLocal = localAdapter().readLocal, now = Date.now } = {}) {
  const state = readLocal();
  const doc = state ? toDoc(state, { now: now() }) : null;
  if (!doc) return { ok: false, error: 'There is no game on this device to export yet.' };
  const d = new Date(now());
  const text = JSON.stringify(doc);
  if (fileTooBig(new TextEncoder().encode(text).length)) return { ok: false, error: 'This save is too large to export.' };
  return { ok: true, filename: `grimoire-save-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`, text };
}

function parse(text, now) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'That file is empty.' };
  if (new TextEncoder().encode(text).length > MAX_BYTES) return { ok: false, error: 'That file is far too large to be a Grimoire save.' };
  let raw;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'That file is not a Grimoire save (it is not readable).' }; }
  return checkDoc(raw, { now });
}

export const summaryOf = (doc) => {
  const life = doc.siso.life;
  return {
    daysInBusiness: Math.max(1, Math.floor(((life.highMs || 0) - (life.startedMs || 0)) / DAY) + 1),
    solves: new Set(life.solves.filter((s) => !s.practice).map((s) => s.card)).size,
    spells: Object.values(doc.siso.spells).filter((r) => r.written).length,
    balance: life.home?.balance ?? 0,
  };
};

export function localSummary({ readLocal = localAdapter().readLocal, now = Date.now } = {}) {
  try {
    const state = readLocal();
    const doc = state ? toDoc(state, { now: now() }) : null;
    return doc ? summaryOf(doc) : null;
  } catch { return null; }
}

export function previewImport(text, { now = Date.now } = {}) {
  const r = parse(text, now());
  if (!r.ok) return { ok: false, error: r.error, summary: null };
  return { ok: true, summary: summaryOf(r.doc) };
}

export function applyImport(text, { mode = 'merge', confirmed = false, readLocal, writeLocal, now = Date.now } = {}) {
  try {
    const ad = readLocal && writeLocal ? { readLocal, writeLocal } : localAdapter();
    const r = parse(text, now());
    const fail = (error) => ({ ok: false, mode, error, changed: false, notices: [] });
    if (!r.ok) return fail(r.error);
    if (mode !== 'merge' && mode !== 'replace') return fail('Unknown import mode.');
    if (mode === 'replace' && confirmed !== true) return fail('Replacing needs the confirmation of the player first.');
    const state = ad.readLocal();
    const local = state ? toDoc(state, { now: now() }) : null;
    let next = r.doc, notices = [...r.notices];
    if (mode === 'merge' && local) { const m = mergeDetailed(local, r.doc, { now: now() }); next = m.doc; notices = m.notices; }
    // an unreadable local save (state null or toDoc null) still counts as "something is there": the writer backs up the raw text
    const changed = !local || canon(local.siso) !== canon(next.siso);
    if (changed) {
      const back = fromDoc(next, { now: now() });
      if (!back.ok || ad.writeLocal(back.state) === false) return fail('This device could not store the save. Nothing was changed.');
    }
    return { ok: true, mode, changed, notices };
  } catch (e) {
    return { ok: false, mode, error: 'The save could not be imported.', changed: false, notices: [] };
  }
}

// download the file through a Blob link (browser only)
export function downloadSave({ filename, text }) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
