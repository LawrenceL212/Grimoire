// firebase.js: Firebase Auth + Firestore behind the sync engine's backend interface. The SDK is NOT loaded until it is
// needed (the account dialog was opened, or a previous session exists): guests and offline players never pay for it.
//
//   loadSdk()                      -> { auth, db, fa, fs }  (cached; a failed load is not cached, so it can be retried)
//   getAccount()                   -> Promise<{ uid, email } | null>   the current user, once Firebase has said who it is
//   signIn / createAccount(email, password) -> { ok, account } | { ok: false, error }   plain-English errors
//   signOutNow() / sendReset(email)         -> { ok, error? }
//   firebaseBackend(uid, { store? })        -> { pull(), push(doc) } on the Firestore document games/{uid}
//   mapError(e)                    -> a plain-English message for any Firebase / network error
// The game stores NO token: Firebase's own persistence keeps the session. Credentials are never logged or kept.
// The document is EXACTLY { schema, updatedAt, siso } (the Firestore rules allow those three keys and only the owner).
// push() runs in a transaction: read the remote doc, merge it with ours (mergeSaves), write the merge, so a write from
// another device between our pull and our push is never lost.
import { FIREBASE_CONFIG, FIREBASE_VERSION } from './firebase-config.js';
import { checkDoc } from './doc.js';
import { mergeSaves } from './merge.js';

const BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;
const OFFLINE = 'No connection: your game is saved on this device and will sync later';
const MESSAGES = {
  'auth/wrong-password': 'Wrong email or password',
  'auth/invalid-credential': 'Wrong email or password',
  'auth/invalid-login-credentials': 'Wrong email or password',
  'auth/user-not-found': 'Wrong email or password',
  'auth/email-already-in-use': 'That email is already in use',
  'auth/weak-password': 'Password must be at least 6 characters',
  'auth/invalid-email': 'That does not look like an email address',
  'auth/missing-password': 'Type your password',
  'auth/missing-email': 'Type your email',
  'auth/too-many-requests': 'Too many tries. Wait a little and try again',
  'auth/user-disabled': 'This account has been disabled',
  'auth/network-request-failed': OFFLINE,
  'unavailable': OFFLINE,
  'deadline-exceeded': OFFLINE,
  'permission-denied': 'The cloud refused this save. Sign out and sign in again, or check that the Firestore rules are published',
  'invalid-remote': 'The game in your account could not be read, so nothing was uploaded',
  'unauthenticated': 'You are signed out. Sign in again to sync',
  'resource-exhausted': 'The cloud is busy. It will try again soon',
  'sdk-load': OFFLINE,
};
export function mapError(e) {
  const code = String(e?.code || '').replace(/^firestore\//, '');
  if (MESSAGES[code]) return MESSAGES[code];
  const msg = String(e?.message || e || '');
  if (/offline|network|failed to (fetch|load)/i.test(msg)) return OFFLINE;
  return 'Something went wrong. Your game is safe on this device';
}
const fail = (e) => ({ ok: false, error: mapError(e) });

// ---------------------------------------------------------------- the SDK, loaded on demand
let sdkP = null;
export function loadSdk(importer = (u) => import(/* @vite-ignore */ u)) {
  if (sdkP) return sdkP;
  sdkP = (async () => {
    try {
      const [app, fa, fs] = await Promise.all([importer(`${BASE}firebase-app.js`), importer(`${BASE}firebase-auth.js`), importer(`${BASE}firebase-firestore.js`)]);
      const a = app.initializeApp(FIREBASE_CONFIG);
      const auth = fa.getAuth(a);
      // the same persistence as library.html, so the Library and the game can share one login
      try { if (fa.setPersistence && fa.browserLocalPersistence) await fa.setPersistence(auth, fa.browserLocalPersistence); } catch { /* the default persistence is fine */ }
      return { auth, db: fs.getFirestore(a), fa, fs };
    } catch (e) { sdkP = null; const err = new Error('sdk-load'); err.code = 'sdk-load'; err.cause = e; throw err; }
  })();
  return sdkP;
}
const user = (u) => (u ? { uid: u.uid, email: u.email || '' } : null);

export async function getAccount() {
  try {
    const { auth, fa } = await loadSdk();
    return await new Promise((resolve) => {
      let off = null, done = false;
      const fin = (v) => { if (done) return; done = true; try { off?.(); } catch { /* ignore */ } resolve(v); };
      off = fa.onAuthStateChanged(auth, (u) => fin(user(u)), () => fin(null));
      if (done) { try { off?.(); } catch { /* ignore */ } }
    });
  } catch { return null; }
}
export async function signIn(email, password) {
  try { const { auth, fa } = await loadSdk(); const c = await fa.signInWithEmailAndPassword(auth, String(email), String(password)); return { ok: true, account: user(c.user) }; } catch (e) { return fail(e); }
}
export async function createAccount(email, password) {
  try { const { auth, fa } = await loadSdk(); const c = await fa.createUserWithEmailAndPassword(auth, String(email), String(password)); return { ok: true, account: user(c.user) }; } catch (e) { return fail(e); }
}
export async function signOutNow() {
  try { const { auth, fa } = await loadSdk(); await fa.signOut(auth); return { ok: true }; } catch (e) { return fail(e); }
}
export async function sendReset(email) {
  try { const { auth, fa } = await loadSdk(); await fa.sendPasswordResetEmail(auth, String(email)); } catch { /* the answer is the same whatever happened: never reveal whether an email has an account */ }
  return { ok: true };
}

// ---------------------------------------------------------------- the backend
// store: { read(path) -> data | null, transact(path, fn(current | null) -> next | null) -> Promise }  (injected in tests)
export function sdkStore() {
  const ref = (s, path) => s.fs.doc(s.db, ...path);
  return {
    async read(path) { const s = await loadSdk(); const snap = await s.fs.getDoc(ref(s, path)); return snap.exists() ? snap.data() : null; },
    async transact(path, fn) {
      const s = await loadSdk();
      await s.fs.runTransaction(s.db, async (tx) => {
        const r = ref(s, path);
        const snap = await tx.get(r);
        const next = fn(snap.exists() ? snap.data() : null);
        if (next) tx.set(r, next);
      });
    },
  };
}
// exactly the three keys, plain data (Firestore refuses undefined)
const exact = (d) => JSON.parse(JSON.stringify({ schema: d.schema, updatedAt: d.updatedAt, siso: d.siso }));

export function firebaseBackend(uid, { store = sdkStore(), now = () => Date.now() } = {}) {
  const path = ['games', String(uid)];
  const wrap = (e) => { const err = new Error(mapError(e)); err.code = e?.code; return err; };
  return {
    async pull() {
      let raw;
      try { raw = await store.read(path); } catch (e) { throw wrap(e); }
      return raw == null ? null : exact(raw);
    },
    async push(doc) {
      try {
        await store.transact(path, (current) => {
          let remote = null;
          if (current != null) {
            const r = checkDoc(current, { now: now() });
            if (!r.ok) throw Object.assign(new Error('invalid remote'), { code: 'invalid-remote' }); // never overwrite what cannot be read
            remote = r.doc;
          }
          const merged = mergeSaves(doc, remote, { now: now() }) || doc;
          return exact(merged);
        });
      } catch (e) { throw wrap(e); }
    },
  };
}
