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
