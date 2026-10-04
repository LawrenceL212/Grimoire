/* Helpers for the opening chapter's browser tests: play a card through the real page (the editor, Run, the
   ticket window's buttons, the timetable), with its reference solution or one of its cheats. */
export const ready = (page, timeout = 60000) =>
  page.waitForFunction(() => window.__play && window.__play.ready === true && !window.__play.busy, null, { timeout }).then(() => true, () => false);
export const current = (page) => page.evaluate(() => window.__play.chapter.current);
export const settle = async (page, timeout = 90000) => {
  await page.waitForTimeout(60);
  await page.waitForFunction(() => !window.__play.busy && !document.querySelector('#result').classList.contains('is-running'), null, { timeout });
};
export const resultText = (page) => page.evaluate(() => document.querySelector('#result').innerText);

export async function runCode(page, code, lang = 'sql') {
  const tab = page.locator(`.lang-tab[data-lang="${lang}"]`);
  if (!(await tab.evaluate((b) => b.classList.contains('on')))) await tab.click();
  await page.locator('#editor').fill(code);
  await page.click('#run');
  await settle(page);
}

// one answer for an interaction step, through the page: pick (a timetable block), choice, lookup, reply
export async function answer(page, a) {
  if ('picked' in a) {
    await page.evaluate(() => { const w = document.getElementById('win-timetable'); w.hidden = false; });
    await page.locator(`#win-timetable .tt-block[data-id="${a.picked}"]`).click();
  } else if ('choice' in a) {
    const num = page.locator('#answer-number');
    if (await num.count()) { await num.fill(String(a.choice)); await page.click('[data-act="answer"]'); }
    else await page.locator(`#ticket-thread [data-act="choose"][data-value="${a.choice}"]`).click();
  } else if ('lookup' in a) {
    const words = { 'order-by': 'sort', limit: 'first' };
    await page.locator('#lookup-q').fill(words[a.lookup] || a.lookup);
    await page.locator(`#ticket-thread [data-act="lookup-open"][data-spell="${a.lookup}"]`).click();
    await page.click('#ticket-thread [data-act="lookup-run"]');
  } else if ('cell' in a) {
    // a cell of Priya's notebook: by its line (row) or, for a cheat, by where it sits after a sort (at)
    const c = a.cell;
    await page.evaluate(() => { document.getElementById('win-notebook').hidden = false; });
    await page.locator(`#win-notebook .nb-tab[data-page="${c.page}"]`).click();
    if (c.sort) await page.locator(`#win-notebook .nb-sort[data-sort="${c.sort}"]`).click();
    if (c.at != null) await page.locator('#win-notebook tbody tr').nth(c.at).locator(`.nb-cell[data-col="${c.col}"]`).click();
    else await page.locator(`#win-notebook .nb-cell[data-row="${c.row}"][data-col="${c.col}"]`).click();
  } else if ('reply' in a) {
    await page.locator(`#ticket-thread [data-act="reply"][data-value="${a.reply}"]`).click();
  }
  await settle(page);
  await page.waitForTimeout(150);
}

// the card on screen moves past its Learn card (after watching the demo, as the learn loop asks)
export async function startCard(page, { demo = true } = {}) {
  const c = await current(page);
  if (!c.learning) return;
  if (demo) { await page.click('#ticket-thread [data-act="demo"]'); await settle(page); }
  await page.click('#ticket-thread [data-act="start"]');
}

export async function doEntry(page, card, entry) {
  if (entry.code) await runCode(page, entry.code, entry.lang || card.languages[0]);
  else await answer(page, entry.answer);
}

/* Plays the card on screen: every cheat must fail (the step does not advance; one-off cheats are Reset), then
   the reference solution for each step. Returns { cheatsFailed: [names], solved } */
export async function playCard(page, card, { cheats = true, t = null } = {}) {
  await startCard(page);
  // a card on his company is played as he sees it: resolved by his column names and his rooms' ids (M-B)
  const live = await page.evaluate(() => window.__play.chapter.card);
  if (live && live.id === card.id) card = live;
  const failed = [];
  for (let i = 0; i < card.steps.length; i++) {
    if (cheats) {
      for (const ch of card.cheats.filter((c) => (c.step ?? card.steps.length - 1) === i)) {
        await doEntry(page, card, ch);
        const c = await current(page);
        const held = c.step === i && !c.solved;
        if (held) failed.push(ch.name);
        else t?.check(`${card.id}: the cheat "${ch.name}" must fail`, false, JSON.stringify(c));
        if (card.grading === 'one-off' || ch.code?.match(/\b(UPDATE|DELETE|INSERT)\b/)) { await page.click('#reset'); await settle(page); await ready(page); }
      }
    }
    const ref = card.reference.find((r) => (r.step ?? card.steps.length - 1) === i);
    await doEntry(page, card, ref);
    const c = await current(page);
    if (!(c.solved || c.step > i)) return { failed, solved: false, at: i, result: await resultText(page) };
  }
  return { failed, solved: (await current(page)).solved };
}
export async function nextTicket(page) {
  const skip = page.locator('#ticket-thread [data-act="explain-skip"]');
  if (await skip.count()) await skip.click();
  await page.click('#ticket-thread [data-act="next"]');
  await page.waitForTimeout(100);
  await ready(page);
}
