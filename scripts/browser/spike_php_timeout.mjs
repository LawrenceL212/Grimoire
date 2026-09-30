/* Finding, not pass/fail: can a runaway PHP script be interrupted? If not, the
   PHP track must run php-wasm in a Worker that can be terminated (Phase 2). */
import { openGame } from './game_lib.mjs';

const { page, close } = await openGame();
const attempt = page.evaluate(async () => {
  const { createPhpRunner } = await import('/game/runners/php.js');
  const php = await createPhpRunner();
  const t0 = performance.now();
  const res = await php.run('while (true) {}', { rooms: [], people: [], bookings: [] });
  return { ok: res.ok, error: res.error, ms: Math.round(performance.now() - t0) };
});
const verdict = await Promise.race([
  attempt,
  new Promise((r) => setTimeout(() => r('HUNG'), 25000)),
]);
if (verdict === 'HUNG') {
  console.log('..  PHP infinite loop: NOT interruptible from the main thread (page hung 25 s)');
  console.log('..  => Phase 2 must run php-wasm in a Worker and terminate it on timeout');
} else {
  console.log('..  PHP infinite loop: interrupted after ' + verdict.ms + ' ms - ' + JSON.stringify(verdict.error));
  console.log('..  => set_time_limit works in php-wasm; a Worker is still the safer isolation');
}
await close().catch(() => {});
process.exit(0);
