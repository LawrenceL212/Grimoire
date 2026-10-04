/* Learner SQL runs in one transaction: if any statement fails, everything the
   script did is rolled back, so a half-working answer never half-changes the
   world. */
export async function runSql(world, code) {
  try {
    await world.exec('BEGIN');
    const results = await world.exec(code);
    await world.exec('COMMIT');
    const sets = results.filter((r) => r.fields && r.fields.length);
    const last = sets[sets.length - 1];
    return { ok: true, rows: last ? last.rows : [], query: !!last, stdout: last ? JSON.stringify(last.rows) : '(no rows)' }; // query: it asked for rows (a CREATE returns none)
  } catch (e) {
    try { await world.exec('ROLLBACK'); } catch { /* nothing to roll back */ }
    return { ok: false, error: String((e && e.message) || e) };
  }
}
