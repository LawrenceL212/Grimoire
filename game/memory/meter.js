import { daysSince, retrievability, statusOf, reviewBy } from './curve.js';

const DAY = 86400000;
const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);

/* Everything the learner sees about one skill, as plain data. */
export function describeSkill({ name, lang, lastMs, stability }, nowMs) {
  const days = daysSince(lastMs, nowMs);
  const r = retrievability((nowMs - lastMs) / DAY, stability);
  const status = statusOf(r);
  const ago = days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`;
  const line = status === 'due'
    ? `last used ${ago} · due now`
    : `last used ${ago} · ${status} · review by ${isoDate(reviewBy(lastMs, stability))}`;

  // The curve runs from the last use out to three stabilities, in a 120 x 40 box.
  const points = [];
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * 3 * stability;
    points.push(`${((i / 24) * 120).toFixed(1)},${((1 - retrievability(t, stability)) * 40).toFixed(1)}`);
  }
  return { name, lang, status, r, line, curve: points.join(' '),
           nowX: Math.min(120, ((nowMs - lastMs) / DAY / (3 * stability)) * 120) };
}

export function renderMeter(el, model) {
  el.className = `meter is-${model.status}`;
  el.innerHTML = `
    <div class="meter-name">${model.name} <span class="meter-lang">${model.lang}</span></div>
    <svg class="meter-curve" viewBox="0 0 120 40" role="img" aria-label="Estimated recall over time">
      <polyline points="${model.curve}" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="${model.nowX}" y1="0" x2="${model.nowX}" y2="40" stroke="currentColor" stroke-dasharray="3 3"/>
    </svg>
    <div class="meter-line">${model.line}</div>`;
}
