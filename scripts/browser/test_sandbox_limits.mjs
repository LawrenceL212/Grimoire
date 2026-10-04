/* Sandbox hardening: row and field caps, validated worker replies, capped output, PHP recycling after bridge use. */
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame();
const r = await page.evaluate(async () => {
  const out = {};
  const { World } = await import('/game/world/world.js');
  const { applyObjects, toObjects } = await import('/game/world/views.js');
  const { runSolution } = await import('/game/runners/index.js');
  const { runJs } = await import('/game/runners/js.js');
  const { createPhpRunner } = await import('/game/runners/php.js');
  const { getSandbox } = await import('/game/sandbox/client.js');
  const sb = getSandbox();
  const empty = { rooms: [], people: [], bookings: [] };
  const w = await World.create({ rooms: 3, people: 5, bookings: 20 });
  const counts = async () => JSON.stringify([await w.count('rooms'), await w.count('people'), await w.count('bookings')]);
  const before = await counts();
  const timed = async (f) => { const t0 = performance.now(); const v = await f(); return [v, Math.round(performance.now() - t0)]; };

  // 1. caps
  let [res, ms] = await timed(() => runSolution(w, 'js', 'world.rooms = Array.from({ length: 100000 }, (_, i) => ({ name: "r" + i, capacity: 1 }));'));
  out.bigJs = { ok: res.ok, error: res.error, ms, same: (await counts()) === before };
  [res, ms] = await timed(() => runSolution(w, 'js', 'world.rooms = Array.from({ length: 2500000 }, () => ({}));'));
  out.hugeJs = { ok: res.ok, error: res.error, ms, same: (await counts()) === before };
  out.longStr = await runSolution(w, 'js', 'world.rooms[0].name = "x".repeat(501);');
  out.nan = await runSolution(w, 'js', 'world.rooms[0].capacity = NaN;');
  out.nested = await runSolution(w, 'js', 'world.rooms[0].name = { a: { b: 1 } };');
  out.sameAfterBad = (await counts()) === before;
  try { await applyObjects(w, { rooms: Array.from({ length: 100000 }, () => ({ name: 'x', capacity: 1 })) }); out.applyBig = 'accepted'; }
  catch (e) { out.applyBig = String(e.message); }
  out.applySame = (await counts()) === before;
  const php = await createPhpRunner();
  [res, ms] = await timed(() => php.run('for ($i = 0; $i < 6000; $i++) $pdo->exec("INSERT INTO rooms (name, capacity) VALUES (\'r\', 1)");', empty));
  out.bigPhp = { ok: res.ok, error: res.error };
  [res, ms] = await timed(() => runSolution(w, 'js', 'world.rooms = Array.from({ length: 4999 }, (_, i) => ({ name: "r" + i, capacity: 1, evil: "dropped" }));'));
  out.okJs = { ok: res.ok, error: res.error, ms, rooms: await w.count('rooms') };
  out.cols = (await w.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'rooms'")).map((x) => x.column_name).sort().join();

  // 2. replies from the worker
  const forged = [];
  for (const code of ['self.postMessage(5); await new Promise(() => {});', 'self.postMessage({ ok: true, id: 99, result: "forged" }); await new Promise(() => {});',
    'self.postMessage(JSON.parse(\'{"__proto__":{"ok":true}}\')); await new Promise(() => {});', 'self.postMessage({ ok: "yes" }); await new Promise(() => {});']) {
    const x = await runJs(code, empty, { timeoutMs: 1500 });
    forged.push({ ok: x.ok, error: x.error, result: x.result, timedOut: x.timedOut, next: (await runJs('return 3;', empty)).result });
  }
  out.forged = forged;
  out.phpForged = await php.run('vrzno_run("postMessage", [5]); echo "after";', empty);
  out.phpAfterForged = await php.run('echo 1;', empty);

  // 3. output caps and the runtime-only fatal check
  out.logs = await runJs('for (let i = 0; i < 20; i++) console.log("x".repeat(500000)); return 1;', empty);
  out.logsLen = (out.logs.logs || []).join('').length;
  const frame0 = sb.inspect('php').frame;
  out.aborted = await php.run('echo "Aborted"; echo "Out of memory";', empty);
  out.abortedSameFrame = sb.inspect('php')?.frame === frame0;
  out.bigOut = await php.run('echo str_repeat("x", 5000000);', empty);

  // 4. recycle after bridge use
  await sb.warm('php');
  const frame1 = sb.inspect('php').frame;
  out.bridge = await php.run('$v = new Vrzno(); $v->onmessage = null; echo "poisoned";', empty);
  out.bridgeRecycled = !sb.inspect('php') || sb.inspect('php').frame !== frame1;
  out.afterBridge = await php.run('echo 2;', empty);
  return out;
});

const j = JSON.stringify;
t.check('100k rooms from JS: fast plain error, world unchanged', r.bigJs.ok === false && /too many rows/i.test(r.bigJs.error) && r.bigJs.ms < 4000 && r.bigJs.same, j(r.bigJs));
t.check('2.5M empty rows from JS: refused fast, world unchanged', r.hugeJs.ok === false && /too many rows/i.test(r.hugeJs.error) && r.hugeJs.ms < 4000 && r.hugeJs.same, j(r.hugeJs));
t.check('a string over 500 characters is refused', r.longStr.ok === false, j(r.longStr).slice(0, 200));
t.check('NaN is refused', r.nan.ok === false, j(r.nan).slice(0, 200));
t.check('a nested object as a field is refused', r.nested.ok === false, j(r.nested).slice(0, 200));
t.check('bad answers wrote nothing', r.sameAfterBad);
t.check('applyObjects itself refuses 100k rows and writes nothing', /too many rows/i.test(r.applyBig) && r.applySame, r.applyBig);
t.check('PHP returning 6000 rows is refused', r.bigPhp.ok === false && /too many rows/i.test(r.bigPhp.error), j(r.bigPhp));
t.check('4,999 rows succeed; unknown keys are dropped', r.okJs.ok === true && r.okJs.rooms === 4999 && r.cols === 'capacity,id,name', j([r.okJs, r.cols]));
for (const [i, f] of r.forged.entries()) {
  t.check(`forged worker reply #${i + 1} is handled cleanly and the next run works`,
    (i === 1 ? f.ok === true && !f.timedOut : f.ok === false && typeof f.error === 'string') && f.next === 3, j(f));
}
t.check('a PHP worker posting a bare number does not break the host', r.phpForged.ok === true && r.phpAfterForged.ok === true && r.phpAfterForged.stdout.trim() === '1', j([r.phpForged, r.phpAfterForged]).slice(0, 300));
t.check('console.log output is capped', r.logsLen <= 1100000, String(r.logsLen));
t.check('printing "Aborted" does not recycle the PHP sandbox', r.aborted.ok === true && r.abortedSameFrame, j(r.aborted).slice(0, 200));
t.check('5 MB of PHP output is refused as too much', r.bigOut.ok === false, j(r.bigOut).slice(0, 200));
t.check('using the bridge recycles the PHP sandbox', r.bridgeRecycled);
t.check('replacing onmessage through the bridge does not break the next run', r.afterBridge.ok === true && r.afterBridge.stdout.trim() === '2', j(r.afterBridge).slice(0, 300));
const unexpected = errors.filter((e) => !/Refused to evaluate|access to the Indexed Database API is denied|ExitStatus/.test(e));
t.check('no unexpected page errors', unexpected.length === 0, unexpected.join(' | '));
await close();
t.finish();
