import { runSql } from './sql.js';
import { runJs } from './js.js';
import { toObjects, applyObjects } from '../world/views.js';

let phpRunner = null;

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
      phpRunner ??= await (await import('./php.js')).createPhpRunner();
      const res = await phpRunner.run(code, await toObjects(world));
      if (res.ok) await applyObjects(world, res.world);
      return res;
    }
    return { ok: false, error: `There is no runtime for ${lang}.` };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}
