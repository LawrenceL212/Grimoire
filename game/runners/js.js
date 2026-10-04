import { getSandbox } from '../sandbox/client.js';

/* Learner JavaScript runs in a Web Worker inside a sandboxed iframe (opaque origin, no network; see
   game/sandbox/). The worker gets a copy of the world objects; whatever it leaves in `world` is what the caller
   writes back. A runaway loop costs the learner a message, not the page: the host stops its worker at timeoutMs,
   and the parent destroys the whole iframe if even that fails. */
export function runJs(code, world, { timeoutMs = 2000 } = {}) {
  return getSandbox().run('js', code, { world, timeoutMs });
}
