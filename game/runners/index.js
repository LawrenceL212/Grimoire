import { runSql } from './sql.js';
import { runJs } from './js.js';
import { toObjects, applyObjects } from '../world/views.js';

let phpRunner = null;

/* The PHP runtime is created once. The promise is cached so two first calls
   share one runtime, and cleared on failure so a later call can try again. */
export function getPhpRunner() {
  phpRunner ??= import('./php.js')
    .then((m) => m.createPhpRunner())
    .catch((e) => { phpRunner = null; throw e; });
  return phpRunner;
}

/* One door for every language. Always resolves to { ok, ..., error? }; a bad
   answer is reported, never thrown, and never changes the world. */
export async function runSolution(world, lang, code) {
  try {
    if (lang === 'sql') return await runSql(world, code);
    if (lang === 'js') {
      const res = await runJs(code, await toObjects(world));
      if (res.ok) await applyObjects(world, res.world);
      return res;
    }
    if (lang === 'php') {
      const res = await (await getPhpRunner()).run(code, await toObjects(world));
      if (res.ok) await applyObjects(world, res.world);
      return res;
    }
    return { ok: false, error: `There is no runtime for ${lang}.` };
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

/* The product arc (milestone M-C): JavaScript and PHP READ his company and change nothing in it. They see it as
   objects under the house names (views.js toObjects; PHP through $pdo on a SQLite practice copy built from them);
   whatever the code does to that copy is reported (changedCopy) but never written back, because the write side of
   his own columns arrives with the PHP request harness (milestone M-F). Same answer shape as runSolution. */
export async function runReadOnly(world, lang, code) {
  try {
    const objects = await toObjects(world);
    const res = lang === 'js' ? await runJs(code, objects) : lang === 'php' ? await (await getPhpRunner()).run(code, objects) : null;
    if (!res) return { ok: false, error: `There is no runtime for ${lang}.` };
    const key = (o) => JSON.stringify(['rooms', 'people', 'bookings'].map((t) => (o?.[t] || []).map((r) => Object.keys(r).filter((k) => r[k] != null).sort().map((k) => [k, String(r[k])]))));
    return { ...res, changedCopy: !!(res.ok && res.world && key(res.world) !== key(objects)) };
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}
