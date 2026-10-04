// account.js: the Account section of the title screen's Settings. All the rules live in game/sync (firebase.js talks to
// Firebase, session.js decides what may be merged and keeps the backup); this file only shows them.
//
//   guest        "Playing as a guest" + Sign in / Create account (the SDK is loaded only when one is pressed)
//   form         email + password, an error line (role=alert), a busy state, Forgot password?
//   choice       a save from another account (or a guest game) meets a cloud game: the player decides; the default is
//                the safe one (keep the cloud game, download the local game as a backup file)
//   signed in    the email, the sync chip, Sync now, Sign out (the game stays on this device)
// A player with an earlier session gets the SDK loaded at startup (so the game syncs); a guest never does.
import * as fb from '../sync/firebase.js';
import { createSession } from '../sync/session.js';
import { downloadSave } from '../sync/file.js';
import { localStore } from './saves.js';

const $ = (id) => document.getElementById(id);

export function initAccount({ refresh = () => {}, api = {} } = {}) {
  const storage = localStore();
  const session = createSession({ fb, storage });
  api.sync = session;
  let mode = 'signin', busy = false, current = null, chipMounted = false;
  const PANELS = ['out', 'form', 'choice', 'in'];
  const show = (name) => {
    for (const p of PANELS) $(`acct-${p}`).hidden = p !== name;
    $('acct-restore-row').hidden = !session.hasBackup();
  };
  const msg = (t) => { $('acct-msg').textContent = t || ''; };
  const err = (t) => { $('acct-error').textContent = t || ''; };
  function setBusy(on, label) {
    busy = on;
    for (const id of ['acct-submit', 'acct-signin', 'acct-create', 'acct-sync', 'acct-signout', 'acct-keep', 'acct-merge', 'acct-choice-cancel', 'acct-forgot']) {
      const b = $(id); b.disabled = on; b.setAttribute('aria-busy', on ? 'true' : 'false');
    }
    $('account').setAttribute('aria-busy', on ? 'true' : 'false');
    if (on) msg(label || 'Working...');
  }
  function openForm(m) {
    mode = m; err(''); $('acct-reset-msg').textContent = ''; msg('');
    $('acct-submit').textContent = m === 'create' ? 'Create account' : 'Sign in';
    $('acct-pass').autocomplete = m === 'create' ? 'new-password' : 'current-password';
    show('form');
    fb.loadSdk().catch(() => {}); // the SDK is loaded now, not before: a guest never pays for it
    $('acct-email').focus();
  }
  function showIn() {
    $('acct-who').textContent = current?.email || '';
    if (!chipMounted) { chipMounted = true; session.mountChip($('acct-chip-slot')); }
    show('in');
  }

  async function finish(account, choice) {
    current = account;
    setBusy(true, choice ? 'Setting up your game...' : 'Signing in...');
    let res;
    try { res = await session.connect(account, choice); } catch { res = { ok: false, error: 'Something went wrong. Your game is safe on this device' }; }
    setBusy(false); msg('');
    if (res.needsChoice) { show('choice'); $('acct-keep').focus(); return; }
    showIn();
    if (res.backupFile) { try { downloadSave(res.backupFile); } catch { /* the backup key still holds it */ } }
    if (!res.ok) msg(`${res.error} Press Sync now to try again.`);
    else if (res.backupFile) msg(`The game that was on this device was downloaded as ${res.backupFile.filename} and is also kept as a backup. This device now has the game from your account.`);
    else if (!res.synced) msg(res.error || 'No connection: your game is saved on this device and will sync later');
    else msg('Signed in. Your game is in sync.');
    refresh();
  }

  async function submit() {
    if (busy) return;
    const email = $('acct-email').value.trim(), pass = $('acct-pass').value;
    if (!email) { err('Type your email'); $('acct-email').focus(); return; }
    if (!pass) { err('Type your password'); $('acct-pass').focus(); return; }
    err(''); setBusy(true, mode === 'create' ? 'Creating your account...' : 'Signing in...');
    const r = mode === 'create' ? await fb.createAccount(email, pass) : await fb.signIn(email, pass);
    $('acct-pass').value = '';
    if (!r.ok) { setBusy(false); msg(''); err(r.error); return; }
    await finish(r.account);
  }

  $('acct-signin').addEventListener('click', () => openForm('signin'));
  $('acct-create').addEventListener('click', () => openForm('create'));
  $('acct-cancel').addEventListener('click', () => { err(''); $('acct-pass').value = ''; show('out'); });
  $('acct-submit').addEventListener('click', submit);
  // inside the Settings dialog's own form, Enter would close the dialog: it moves on or submits instead
  $('acct-email').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('acct-pass').focus(); } });
  $('acct-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  $('acct-forgot').addEventListener('click', async () => {
    const email = $('acct-email').value.trim();
    if (!email) { err('Type your email first, then press Forgot password?'); $('acct-email').focus(); return; }
    err(''); await fb.sendReset(email);
    $('acct-reset-msg').textContent = 'If that email has an account, a reset link is on its way.';
  });
  $('acct-keep').addEventListener('click', () => finish(current, 'aside'));
  $('acct-merge').addEventListener('click', () => finish(current, 'merge'));
  $('acct-choice-cancel').addEventListener('click', async () => { setBusy(true, 'Signing out...'); await session.disconnect(); current = null; setBusy(false); msg('Signed out. Nothing was changed on this device.'); show('out'); });
  $('acct-sync').addEventListener('click', async () => {
    if (busy) return;
    if (!session.engine()) { await finish(current); return; }
    setBusy(true, 'Syncing...');
    const r = await session.syncNow();
    setBusy(false);
    msg(r?.ok ? 'In sync.' : (r?.error || 'No connection: your game is saved on this device and will sync later'));
    refresh();
  });
  $('acct-signout').addEventListener('click', async () => {
    if (busy) return;
    setBusy(true, 'Signing out...');
    await session.disconnect();
    current = null; setBusy(false);
    show('out'); msg('Signed out. Your game is still on this device, and it is no longer syncing.');
  });
  $('acct-restore').addEventListener('click', () => {
    const r = session.restoreBackup();
    msg(r.ok ? 'Restored the save from before the last sync. If you are signed in, the next sync merges your cloud game back in, so sign out first to keep this one.' : r.error);
    refresh(); show($('acct-in').hidden ? ($('acct-form').hidden ? ($('acct-choice').hidden ? 'out' : 'choice') : 'form') : 'in');
  });
  $('settings').addEventListener('close', () => { if (!busy) { $('acct-pass').value = ''; err(''); if (!$('acct-form').hidden) show('out'); } });

  show('out');
  // an earlier session: bring the SDK in now so this player's game syncs (guests skip all of this)
  if (session.hint()) {
    (async () => {
      const account = await fb.getAccount();
      if (!account) return;
      await finish(account);
    })().catch(() => {});
  }
  return session;
}
