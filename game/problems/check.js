import { World } from '../world/world.js';

export const NO_OVERLAP_SQL = `SELECT count(*)::int AS n FROM bookings a JOIN bookings b
  ON a.room_id = b.room_id AND a.id < b.id AND a.start_at < b.end_at AND b.start_at < a.end_at`;

export async function startProblem(problem) {
  const world = await World.create(problem.world);
  if (problem.setup) await world.exec(problem.setup);
  return world;
}

const matches = (value, expect) => {
  if ('equals' in expect) return value === expect.equals;
  if ('atLeast' in expect) return value >= expect.atLeast;
  if ('atMost' in expect) return value <= expect.atMost;
  return false;
};

/* Outcome grading: a problem is passed when the world it leaves behind satisfies
   every check, however the learner got there. */
export async function gradeProblem(world, problem) {
  const results = [];
  for (const c of problem.checks) {
    let ok = false;
    let detail = '';
    try {
      const rows = await world.query(c.sql);
      const value = rows[0] ? Object.values(rows[0])[0] : undefined;
      ok = matches(value, c.expect);
      detail = String(value);
    } catch (e) {
      detail = String((e && e.message) || e);
    }
    results.push({ name: c.name, ok, detail });
  }
  return { passed: results.every((r) => r.ok), results };
}
