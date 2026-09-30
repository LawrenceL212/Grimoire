const DAY = 86400000;

/* Ebbinghaus-style forgetting: recall R = exp(-t / S), where t is the days since
   the skill was last used and S is its stability in days. A skill is "fresh"
   above 90% estimated recall, "fading" down to 70%, and "due" below that. */
export const INITIAL_STABILITY = 3;
export const THRESHOLDS = { fresh: 0.9, fading: 0.7 };

export const daysSince = (lastMs, nowMs) => Math.max(0, Math.floor((nowMs - lastMs) / DAY));

export const retrievability = (elapsedDays, stabilityDays) => Math.exp(-elapsedDays / stabilityDays);

export const statusOf = (r) => (r >= THRESHOLDS.fresh ? 'fresh' : r >= THRESHOLDS.fading ? 'fading' : 'due');

export const reviewBy = (lastMs, stabilityDays, threshold = THRESHOLDS.fading) =>
  lastMs + -Math.log(threshold) * stabilityDays * DAY;

/* A clean solve makes the memory last much longer; a solve that needed help
   makes it last a little longer; a failure resets it, so the skill returns soon. */
export function nextStability(stabilityDays, outcome) {
  if (outcome === 'clean') return stabilityDays * 2.5;
  if (outcome === 'assisted') return stabilityDays * 1.2;
  return INITIAL_STABILITY / 2;
}
