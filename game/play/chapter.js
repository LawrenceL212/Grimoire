// chapter.js: the SISO world's opening chapter on the play page. A fresh life starts with the first-day tutorial
// (Sequel guides it, in speech bubbles by the drone); then the ladder's tickets in order (game/problems/ladder.js),
// each following the learn loop: a Learn card (3-5 lines, one example tied to the world, a live demo) on a
// concept's first meeting, then the task at its scaffold level (the editor pre-filled exactly as the card says),
// the hint ladder with its honest cost shown BEFORE opening, the worked example (runnable; using it makes the
// solve exposure, not mastery), the two-line "what you just did" recap, and the next ticket.
//
// Progress (progress.js) persists per life under one key: the current ticket, every solve with its help and
// time, the day's new concepts (the pace rule), and the Grimoire's spells. Continue (any later visit) resumes at
// the right ticket. ?new starts a new life; ?tutorial replays the tutorial (practice: nothing is recorded).
//
//   createChapter(ctx) -> { run(), reset(), state(), setNow(ms), next(), ... }   (window.__play.chapter)
import { toObjects } from '../world/views.js';
import { runSolution, getPhpRunner } from '../runners/index.js';
import { LADDER, TUTORIAL, cardById, DAILY_CAP } from '../problems/ladder.js';
import { startWorld, startShadow, baselineOf, gradeStep, castSpells, detectSpells, runQuestionSql, truthsOf } from '../problems/card.js';
import { CLOCK as CHAPTER_CLOCK } from '../world/named.js';
import { diffWorlds, rowChanges, clashPairs } from './bridge.js';
import { deriveState } from './state.js';
import { createLife, nextCardId, paceCheck, startCard, recordSolve, xpOf, helpOf, HINT_COST, solvedIds, noteHelp, helpSoFar, effectiveNow, touch } from './progress.js';
import { setDefaultStore, spellById, SPELLS, inkOf, setClock } from './spells.js';
import { createTimetable } from './timetable.js';
import { describeSkill } from '../memory/meter.js';

const LANG_NAME = { sql: 'SQL', js: 'JavaScript', php: 'PHP' };
const DRONE_NAME = { sql: 'Sequel', js: 'Jay', php: 'Hex' };
const LEVEL = { L0: 'watch it run', L1: 'change one word', L2: 'write one line', L3: 'a blank editor' };
const DAY_MS = 86400000;

export async function createChapter(ctx) {
  const { $, esc, play, wins, editor, hud, app } = ctx;
  const params = new URLSearchParams(location.search);
  let nowOverride = null; // setNow (tests): the whole game's clock moves, so the book and the stores agree
  const rawNow = () => nowOverride ?? Date.now();
  const L = ctx.life || createLife({ now }); // the page's life (main.js made it, and handled ?new)
  setDefaultStore(L.spellStore);
  const store = () => L.spellStore;
  // the clock never goes backwards: every decision (the pace rule, the meter, the spells) uses the record's
  // high-water mark when the device clock is behind it
  const now = () => effectiveNow(L.life, rawNow());
  setClock(now);
  L.life = touch(L.life, rawNow());

  // ---------------------------------------------------------------- the page's extra parts
  const thread = $('#ticket-thread');
  const said = $('#ticket-said');
  const objective = document.createElement('p');
  objective.className = 'objective'; objective.id = 'ticket-objective';
  said.after(objective);
  // the timetable window (the bookings table IS the timetable)
  const ttWin = document.createElement('section');
  ttWin.id = 'win-timetable'; ttWin.setAttribute('aria-label', 'Timetable');
  ttWin.innerHTML = '<div class="bar" aria-label="Timetable"><span class="dot"></span><span>TIMETABLE · bookings</span><span class="sp"></span><button type="button" class="tt-close" aria-label="Hide the timetable">×</button></div><div class="body tt-host"></div>';
  app.appendChild(ttWin);
  wins.add(ttWin, { id: 'timetable', right: 16, y: 84, w: 470, h: (W, H) => Math.max(260, Math.min(600, H - 100)), minW: 300, minH: 220 });
  const showTimetable = (on) => { ttWin.hidden = !on; if (on) wins.layout(); };
  showTimetable(false);
  ttWin.querySelector('.tt-close').addEventListener('click', () => showTimetable(false));
  const timetable = createTimetable(ttWin.querySelector('.tt-host'), { onPick: (id) => onPicked(id) });
  // Sequel's speech bubble (the tutorial)
  const bubble = document.createElement('div');
  bubble.id = 'sequel-say'; bubble.className = 'say'; bubble.hidden = true;
  bubble.setAttribute('role', 'dialog'); bubble.setAttribute('aria-label', 'Sequel says');
  app.appendChild(bubble);

  // ---------------------------------------------------------------- state
  let cur = null; // { kind: 'tutorial' | 'card', card, step, practice, world, shadowP, baseline, act, hint, worked, codexEarly, casts, solved, ... }
  let op = 0;
  const life = () => L.life;
  const setLife = (v) => { L.life = v; };
  const step = () => (cur?.kind === 'card' ? cur.card.steps[cur.step] : null);
  const clockOf = (card) => card?.clock || CHAPTER_CLOCK;

  function hudUpdate(objects) {
    const day = clockOf(cur?.card).slice(0, 10);
    hud.set(deriveState(objects || play.objects || {}, null, null, { day, xp: xpOf(life()), openTickets: cur && !cur.solved ? 1 : 0 }));
    const n = 1 + Math.max(0, Math.floor((now() - life().startedMs) / DAY_MS));
    hud.setClock(`Day ${n} · ${clockOf(cur?.card).slice(11, 16)}`);
    ctx.homeSync?.(); // the balance chip follows the life's home
  }

  // ---------------------------------------------------------------- the world
  async function openWorld(card, { keepPick = false } = {}) {
    const old = play.world;
    const world = await startWorld(card);
    const objects = await toObjects(world);
    play.world = world; play.objects = objects; play.clock = clockOf(card);
    const office = ctx.office;
    if (office) {
      ctx.story?.cancel();
      office.seed(objects, clockOf(card));
      office.relabel(objects.rooms);
      office.setRooms(new Set(clashPairs(objects.bookings).map((p) => p.roomId)));
      office.fx.clearTickets();
      office.resetDrones();
    }
    timetable.render(objects);
    if (!keepPick) timetable.clear();
    if (old && old !== world) old.close().catch(() => {});
    return { world, objects };
  }
  function setTicket3d(card, open) {
    const st = ctx.story;
    if (!st) return;
    const who = card.from?.name?.split(' ')[0] || 'Priya';
    st.setTicket(open, 1, { title: `TICKET ${card.id === 'tutorial' ? 'FIRST DAY' : `#${card.serve}`}`, open: () => `${who} · ${card.title || 'first day'}`, done: () => `${who} · sorted` });
  }

  // ---------------------------------------------------------------- loading a ticket
  async function loadCard(card, { practice = false } = {}) {
    const mine = ++op;
    ctx.setBusy(true, 'reset');
    play.ready = false;
    try {
      if (!practice) setLife(startCard(life(), card, now()));
      for (const s of card.spells.teach) store().introduce(s, [card.languages[0]]);
      const saved = life().cards[card.id] || {};
      cur = {
        kind: 'card', card, practice, step: practice ? 0 : Math.min(saved.step || 0, card.steps.length - 1),
        act: { picked: null, choice: null, lookup: { opened: new Set(), ran: new Set() }, reply: null, ran: false },
        // the help already used on this card comes back with it (a reload or Continue cannot wash it out)
        ...(practice ? { hint: 0, worked: false, codexEarly: false } : helpSoFar(life(), card.id)), casts: new Set(), solved: false, ranOnce: false,
        learning: !!card.learnCard && !saved.learnSeen && !practice, showLookup: false, fresh: true, predicted: null, explained: false,
      };
      const { world } = await openWorld(card);
      if (op !== mine) return;
      cur.world = world;
      cur.shadowP = card.grading === 'query' ? startShadow(card) : null;
      cur.shadowP?.catch(() => {});
      cur.baseline = await baselineOf(world, card.steps);
      if (step().interaction === 'choice' && step().options) cur.options = (await world.query(step().options)).map((r) => Object.values(r)[0]);
      setTicket3d(card, true);
      showTimetable(!!card.showTimetable);
      prepareStep();
      render();
      hudUpdate();
      ctx.show('', '');
      play.ready = true;
    } catch (e) {
      ctx.show('is-error', `The ticket could not open: ${String(e?.message ?? e)}. Check your connection, then press Reset.`);
    } finally {
      $('#loading').hidden = true;
      if (op === mine) ctx.setBusy(false);
    }
  }
  function prepareStep() {
    const s = step();
    if (!s) return;
    const langs = cur.card.languages;
    for (const b of ctx.tabs) b.hidden = !langs.includes(b.dataset.lang);
    const lang = s.lang && langs.includes(s.lang) ? s.lang : langs[0];
    ctx.setLang(lang);
    editor.value = s.starter ?? '';
    cur.act.ran = false;
  }

  // ---------------------------------------------------------------- the ticket window
  function header(card, { tutorial = false } = {}) {
    $('#ticket-id').textContent = tutorial ? 'FIRST DAY · TUTORIAL' : `TICKET #${card.serve} · ${card.id}${cur?.practice ? ' · PRACTICE' : ''}`;
    $('#ticket-who').textContent = `${card.from.name} · ${card.from.role} · ${card.from.sector}`;
    said.textContent = `“${card.says}”`;
    const pill = $('#win-ticket .pill');
    pill.textContent = cur?.solved ? 'RESOLVED ✓' : 'OPEN';
    pill.className = `pill ${cur?.solved ? 'done' : 'open'}`;
  }
  const codeBox = (code) => `<pre class="code-ex">${esc(code)}</pre>`;
  function learnHTML(card) {
    const lc = card.learnCard;
    const ex = lc.example;
    return `<section class="learn" aria-label="Learn card">
      <span class="tag">Learn · new idea</span><h3>${esc(lc.title)}</h3>
      ${lc.lines.map((l) => `<p>${esc(l)}</p>`).join('')}
      ${ex.code ? codeBox(ex.code) : ''}<p class="note">${esc(ex.note || '')}</p>
      <div class="row"><button type="button" class="btn" data-act="demo">Show me in the office</button>
      <button type="button" class="btn primary" data-act="start">Start the ticket ▸</button></div>
    </section>`;
  }
  function hintsHTML() {
    const card = cur.card;
    const opened = cur.hint;
    const rungs = HINT_COST.map((h) => {
      const open = opened >= h.level;
      const can = !open && h.level === opened + 1 && !cur.solved;
      let text = '';
      if (open) {
        if (h.level <= 2) text = card.hints[h.level - 1];
        else if (h.level === 3) text = `The Grimoire entry: “${spellById(card.hints[2])?.name || card.hints[2]}”. It is open in the book.`;
        else text = card.workedExample ? 'The worked example is below.' : 'A checkpoint has no worked example: it is all recall.';
      }
      return `<li class="${open ? 'is-open' : ''}"><button type="button" class="rung" data-act="hint" data-level="${h.level}" ${can ? '' : 'disabled'} aria-label="Hint ${h.level}, ${h.name}: ${h.costs}">
        <b>${h.level}</b> ${esc(h.name)} <small>${esc(h.costs)}</small></button>${text ? `<p class="hint-text">${esc(text)}</p>` : ''}</li>`;
    }).join('');
    return `<section class="hints" aria-label="Hints"><span class="tag">Hint ladder</span><ol>${rungs}</ol></section>`;
  }
  function workedHTML(card) {
    const w = card.workedExample;
    if (!w) return '';
    return `<section class="worked" aria-label="Worked example"><span class="tag">Worked example · practice, not mastery</span>
      ${w.code ? codeBox(w.code) : ''}<p class="note">${esc(w.note || '')}</p>
      <button type="button" class="btn" data-act="worked-run">Run the worked example</button></section>`;
  }
  function interactionHTML(s) {
    if (!s.interaction || cur.solved) return '';
    if (s.interaction === 'pick') return `<section class="ask"><p>${cur.act.picked ? `You picked booking ${cur.act.picked}.` : 'Click a block on the timetable, or a person in the office.'}</p>
      <button type="button" class="btn" data-act="timetable">Open the timetable</button></section>`;
    if (s.interaction === 'choice') {
      if (s.input === 'number') return `<section class="ask"><label>${esc(s.prompt)} <input type="number" min="0" class="answer" id="answer-number" inputmode="numeric"></label> <button type="button" class="btn primary" data-act="answer">Answer</button></section>`;
      return `<section class="ask"><p>${esc(s.prompt)}</p><div class="row">${(cur.options || []).map((o) => `<button type="button" class="btn opt" data-act="choose" data-value="${esc(o)}">${esc(o)}</button>`).join('')}</div>
        <button type="button" class="btn" data-act="timetable">Open the timetable</button></section>`;
    }
    if (s.interaction === 'reply') return `<section class="ask"><p>${esc(s.prompt)}</p><div class="col">${s.options.map((o) => `<button type="button" class="btn opt" data-act="reply" data-value="${esc(o.id)}">${esc(o.text)}</button>`).join('')}</div></section>`;
    if (s.interaction === 'lookup') return '<section class="ask"><p>Use “Look it up” below: search for what you want to do.</p></section>';
    return '';
  }
  function lookupHTML() {
    const q = (cur.lookupQ || '').trim().toLowerCase();
    const hits = q ? SPELLS.filter((s) => [s.name, s.line, ...s.keywords].some((t) => t.toLowerCase().includes(q))).slice(0, 6) : [];
    const open = cur.lookupOpen ? spellById(cur.lookupOpen) : null;
    return `<section class="lookup" aria-label="Look it up"><span class="tag">Look it up · the Grimoire's index</span>
      <input type="search" class="lookup-q" id="lookup-q" placeholder="What do you want to do? (sort, only some, count...)" value="${esc(cur.lookupQ || '')}" aria-label="Search the Grimoire">
      <ul class="lookup-hits">${hits.map((s) => `<li><button type="button" class="btn link" data-act="lookup-open" data-spell="${s.id}">${esc(s.name)}</button> <small>${esc(s.line)}</small></li>`).join('') || (q ? '<li><small>Nothing yet: try other words.</small></li>' : '')}</ul>
      ${open ? `<div class="lookup-entry" data-spell="${open.id}"><b>${esc(open.name)}</b><p>${esc(open.line)}</p>${codeBox(open.forms.sql)}<button type="button" class="btn" data-act="lookup-run">Run its example</button></div>` : ''}
    </section>`;
  }
  function solvedHTML() {
    const o = cur.outcome;
    const card = cur.card;
    const explain = card.explain && !cur.explained ? `<section class="explain" aria-label="Explain"><span class="tag">Explain it, book closed · practice, never scored</span>
        <p>${esc(card.explain.question)}</p><textarea class="explain-text" rows="3" aria-label="Your explanation"></textarea>
        <div class="row"><button type="button" class="btn" data-act="explain">Compare with a model answer</button><button type="button" class="btn link" data-act="explain-skip">Skip</button></div></section>`
      : cur.explainShown ? `<section class="explain"><span class="tag">A model answer</span><p>${esc(card.explain.model)}</p><ul>${card.explain.checklist.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></section>` : '';
    return `<p class="reply"><b>${esc(card.from.name.split(' ')[0])}:</b> “${esc(o.reply)}”</p>
      <div class="recap"><span class="tag">What you just did</span><p>${esc(card.recap[0])}</p><p>${esc(card.recap[1])}</p></div>
      <p class="credit">${esc(o.credit)}</p>${o.spells ? `<p class="credit spells">${esc(o.spells)}</p>` : ''}${o.kept ? `<p class="credit">${esc(o.kept)}</p>` : ''}
      ${explain}
      <div class="row"><button type="button" class="btn primary" data-act="next">${cur.practice ? 'Back to the chapter ▸' : 'Next ticket ▸'}</button></div>`;
  }
  function render() {
    if (!cur) return;
    if (cur.kind === 'tutorial') { renderTutorial(); return; }
    const card = cur.card, s = step();
    header(card);
    const nSteps = card.steps.length;
    objective.innerHTML = cur.solved ? '<b>Resolved.</b>'
      : `<b>${esc(s.objective)}</b> <span class="lvl">${nSteps > 1 ? `Step ${cur.step + 1} of ${nSteps} · ` : ''}${s.interaction ? '' : `${LEVEL[s.level]}`}</span>`;
    let html = '';
    if (cur.pace) html += `<section class="pace"><p>${esc(cur.pace)}</p><button type="button" class="btn" data-act="practice">Practise a solved ticket (no credit)</button></section>`;
    else if (cur.learning) html += learnHTML(card);
    else if (cur.solved) html += solvedHTML();
    else {
      if (card.calibrate && cur.predicted == null) html += `<section class="ask"><p>Before you start: will you solve this without hints?</p><div class="row">${['yes', 'not sure', 'no'].map((v) => `<button type="button" class="btn opt" data-act="predict" data-value="${v}">${v}</button>`).join('')}</div></section>`;
      if (card.lookupOnly && cur.hint < 2) html += '<p class="note">No Learn card on this one: the tool you need is in the Grimoire. Look it up by what you want to do.</p>';
      html += interactionHTML(s);
      html += hintsHTML();
      if (cur.hint >= 4) html += workedHTML(card);
      if (cur.showLookup || s.interaction === 'lookup') html += lookupHTML();
    }
    html += `<div class="tools row"><button type="button" class="btn link" data-act="timetable">Timetable</button>
      <button type="button" class="btn link" data-act="lookup">Look it up</button>
      ${card.learnCard && !cur.learning ? '<button type="button" class="btn link" data-act="relearn">Learn card</button>' : ''}
      <button type="button" class="btn link" data-act="tutorial">Replay the tutorial</button></div>`;
    thread.innerHTML = html;
    $('#win-ticket').classList.add('has-thread');
    ctx.fitTicket();
    // a new ticket or its Learn card reads from the top (the symptom first); otherwise the latest part is in view
    if (cur.learning || cur.fresh) { $('#win-ticket .body').scrollTop = 0; cur.fresh = false; }
    const q = thread.querySelector('#lookup-q');
    if (q && cur.lookupFocus) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); cur.lookupFocus = false; }
  }

  // ---------------------------------------------------------------- what the learner does in the ticket window
  thread.addEventListener('input', (e) => {
    if (e.target.id === 'lookup-q' && cur) { cur.lookupQ = e.target.value; cur.lookupFocus = true; render(); }
  });
  thread.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !cur) return;
    const a = b.dataset.act, v = b.dataset.value;
    if (cur.kind === 'tutorial') { tutorialAct(a, b); return; }
    if (a === 'start') { cur.learning = false; markLearnSeen(); render(); editor.focus(); }
    else if (a === 'demo') demo();
    else if (a === 'relearn') { cur.learning = true; render(); ctx.show('is-miss', 'Re-reading is fine, and it is free, but it never counts as progress: only producing it does.'); }
    else if (a === 'hint') openHint(Number(b.dataset.level));
    else if (a === 'worked-run') runExample(cur.card.workedExample, { worked: true });
    else if (a === 'timetable') { showTimetable(true); }
    else if (a === 'lookup') { cur.showLookup = !cur.showLookup; render(); }
    else if (a === 'lookup-open') lookupOpen(b.dataset.spell);
    else if (a === 'lookup-run') lookupRun();
    else if (a === 'choose') { cur.act.choice = v; gradeInteraction(); }
    else if (a === 'answer') { cur.act.choice = String(thread.querySelector('#answer-number')?.value ?? '').trim(); gradeInteraction(); }
    else if (a === 'reply') { cur.act.reply = v; gradeInteraction(); }
    else if (a === 'predict') { cur.predicted = v; const c = life().cards[cur.card.id]; if (c) { c.predict = v; L.save(); } render(); }
    else if (a === 'explain') { cur.explained = true; cur.explainShown = true; render(); }
    else if (a === 'explain-skip') { cur.explained = true; render(); }
    else if (a === 'next') next();
    else if (a === 'practice') practice();
    else if (a === 'tutorial') startTutorial({ replay: true });
  });
  function markLearnSeen() {
    const l = life();
    l.cards[cur.card.id] ??= { startedMs: now(), learnSeen: false, step: 0 };
    l.cards[cur.card.id].learnSeen = true;
    L.save();
  }
  // the help used is written into the life record at once, and never lowered
  function keepHelp() {
    if (cur?.kind !== 'card' || cur.practice) return;
    setLife(noteHelp(life(), cur.card.id, { hint: cur.hint, worked: cur.worked, codexEarly: cur.codexEarly }));
  }
  function openHint(level) {
    if (level !== cur.hint + 1) return;
    cur.hint = level;
    if (level >= 4) cur.worked = true; // opening the worked example is exposure, whether or not it is run
    keepHelp();
    if (level === 3) {
      const id = cur.card.hints[2];
      store().introduce(id, [cur.card.languages[0]]);
      import('./grimoire.js').then((m) => m.grimoire().open(id));
    }
    render();
    // the keyboard stays in the ticket window, on the hint just opened
    const t = [...thread.querySelectorAll('.hint-text')].pop();
    if (t && level !== 3) { t.tabIndex = -1; t.focus({ preventScroll: false }); }
  }
  // opening the Grimoire from the HUD before the first run shows the code: recorded like an early look-up
  document.getElementById('hud-grimoire')?.addEventListener('click', () => {
    if (cur?.kind !== 'card' || cur.solved || cur.ranOnce || cur.practice || cur.card.evidence === false || cur.learning) return;
    cur.codexEarly = true; keepHelp();
  }, true);

  // ---------------------------------------------------------------- the interactions of the on-ramp
  function onPicked(id) {
    if (cur?.kind === 'tutorial') { tutorialPicked(id); return; }
    if (!cur || cur.solved) return;
    const s = step();
    if (s?.interaction === 'pick') { cur.act.picked = id; gradeInteraction(); }
  }
  async function gradeInteraction() {
    const s = step();
    const g = await gradeStep(cur.card, s, { world: cur.world, act: cur.act, baseline: cur.baseline });
    play.lastGrade = g;
    if (g.passed) { ctx.sound?.cue?.('scan-ok'); await stepPassed(null, null); return; }
    const why = g.results.filter((r) => !r.ok).map((r) => r.why).filter(Boolean)[0] || 'not yet';
    ctx.show('is-miss', `Not yet: ${why}.`);
    render();
  }
  function lookupOpen(id) {
    cur.lookupOpen = id;
    cur.act.lookup.opened.add(id);
    if (!cur.ranOnce && cur.card.spells.recall.length) { cur.codexEarly = true; keepHelp(); } // producing it first is the point
    store().introduce(id, ['sql']);
    render();
  }
  async function lookupRun() {
    const sp = spellById(cur.lookupOpen);
    if (!sp) return;
    const ok = await runExample({ lang: 'sql', code: sp.forms.sql }, { lookup: true });
    if (ok) { cur.act.lookup.ran.add(sp.id); if (step()?.interaction === 'lookup') gradeInteraction(); }
  }

  // ---------------------------------------------------------------- runs
  function explainError(err) {
    const m = /at or near "([^"]+)"/.exec(err) || /(\w+) is not defined/.exec(err) || /Unexpected (?:token|identifier) '?([^'\s]+)'?/.exec(err);
    return m ? `<p class="err-help">What it could not understand: <code>${esc(m[1])}</code>. Look at that word first.</p>` : '';
  }
  // the scene acts out a run: a real change plays the story; a read-only answer lights its rows up; a value floats
  async function act(lang, res, before, after, events, changed, passed) {
    const office = ctx.office, story = ctx.story;
    if (!office || !story || ctx.glDown()) { if (office && changed) office.reconcile(after, play.clock); return; }
    office.useDrone(lang);
    ctx.setBusy(true, 'story');
    if (changed) await story.play(events, { before, after, grade: passed == null ? null : { passed }, wasOpen: true, changed });
    else if (lang === 'sql') await story.showRows(res.rows || [], after);
    else if (lang === 'js') await story.say(res.result === undefined ? 'nothing returned' : res.result);
    else await story.say((res.stdout || '').trim() || 'nothing printed');
  }
  // a question ticket's SQL: run inside a transaction that is always rolled back (card.js runQuestionSql)
  async function executeQuestion(code) {
    const before = await toObjects(play.world);
    const res = await runQuestionSql(play.world, code);
    if (!res.ok) return { res, before };
    const undone = rowChanges(before, res.after).length > 0;
    return { res, before, after: before, events: [], changed: false, undone };
  }
  async function execute(lang, code) {
    const world = play.world;
    const before = await toObjects(world);
    const res = await runSolution(world, lang, code);
    if (!res.ok) return { res, before };
    const after = await toObjects(world);
    return { res, before, after, events: diffWorlds(before, after), changed: rowChanges(before, after).length > 0 };
  }
  function outputHTML(lang, res) {
    if (lang === 'sql') return ctx.rowsTable(res.rows);
    const t = lang === 'js' ? [...(res.logs || []), res.result !== undefined ? `returned: ${res.result}` : ''].filter(Boolean).join('\n') : (res.stdout || '');
    return t ? `<pre class="out">${esc(t)}</pre>` : '';
  }
  // a Learn card demo, a worked example, or a Grimoire entry's example: it runs on the world and the office acts
  // it out; if it changed the world, the world is then put back as the ticket arrived
  async function runExample(ex, { worked = false, lookup = false } = {}) {
    if (play.busy || !ex) return false;
    if (ex.show === 'pick') { showTimetable(true); timetable.inspect(ex.id, { follow: ex.follow }); if (worked) { cur.worked = true; keepHelp(); } render(); return true; }
    if (ex.show === 'lookup') { cur.showLookup = true; cur.lookupQ = ex.search; render(); return true; }
    const mine = ++op;
    ctx.setBusy(true, 'run');
    if (worked) { cur.worked = true; keepHelp(); }
    try {
      ctx.show('is-running', ex.lang === 'php' ? 'Loading PHP, then running the example…' : 'Running the example…');
      const r = await execute(ex.lang, ex.code);
      if (op !== mine) return false;
      if (!r.res.ok) { ctx.show('is-error', r.res.error, explainError(r.res.error)); return lookup ? true : false; }
      ctx.show('is-running', 'The example ran. Watch the office…', outputHTML(ex.lang, r.res));
      await act(ex.lang, r.res, r.before, r.after, r.events, r.changed, null);
      if (op !== mine) return false;
      if (r.changed) {
        await openWorld(cur.card === TUTORIAL ? TUTORIAL : cur.card, { keepPick: true });
        cur.world = play.world;
        cur.baseline = await baselineOf(cur.world, cur.card.steps || []);
        ctx.show('is-miss', 'That was an example: the world is back as the ticket arrived.', outputHTML(ex.lang, r.res));
      } else ctx.show('is-win', worked ? 'The worked example ran. It is practice: this solve now counts as exposure, not mastery.' : 'The example ran.', outputHTML(ex.lang, r.res));
      return true;
    } catch (e) {
      ctx.show('is-error', String(e?.message ?? e)); return false;
    } finally { if (op === mine) ctx.setBusy(false); if (cur?.kind === 'card') render(); }
  }
  async function demo() { await runExample(cur.card.learnCard.example); }

  async function run() {
    if (play.busy) { play.refused++; return; }
    if (!cur || !play.world || !play.ready) { ctx.show('is-miss', 'The game is not ready yet.'); return; }
    if (cur.kind === 'tutorial') return tutorialRun();
    if (cur.solved) { ctx.show('is-miss', 'This ticket is resolved. Press Next ticket in the ticket window.'); return; }
    if (cur.learning) { cur.learning = false; markLearnSeen(); render(); }
    const s = step();
    const code = editor.value, lang = ctx.lang;
    if (!code.trim() || /^(--|\/\/) (write SQL here|`world|`\$pdo)/.test(code.trim()) && code.trim().split('\n').length === 1) { ctx.show('is-miss', 'Write some code first.'); return; }
    const mine = ++op;
    play.runs++;
    ctx.setBusy(true, 'run');
    ctx.sound?.cue?.('run');
    try {
      ctx.show('is-running', lang === 'php' ? 'Loading PHP, then running…' : 'Running…');
      // the answers are worked out from the world BEFORE his code runs
      const truths = s.interaction ? null : await truthsOf(cur.world, s);
      const question = cur.card.grading === 'query' && lang === 'sql';
      const r = question ? await executeQuestion(code) : await execute(lang, code);
      if (op !== mine) return;
      cur.ranOnce = true;
      if (!r.res.ok) { play.lastEvents = []; ctx.show('is-error', r.res.error, explainError(r.res.error)); ctx.sound?.cue?.('error'); return; }
      cur.act.ran = true;
      play.objects = r.after; play.lastEvents = r.events;
      let grade = null;
      if (!s.interaction) {
        ctx.show('is-running', 'Checking the answer…', outputHTML(lang, r.res));
        grade = await gradeStep(cur.card, s, { world: cur.world, shadow: cur.shadowP, lang, code, res: r.res, baseline: cur.baseline, act: cur.act, php: getPhpRunner, truths });
        // a question is answered from the data as it is: an answer that needed the data changed first does not count
        if (question && r.undone) grade = { passed: false, results: [{ name: 'the answer', ok: false, why: 'your code changed the data before answering. This ticket asks a question, so the change was not kept (it was rolled back): answer it from the data as it is', where: 'real' }] };
        play.lastGrade = grade;
      }
      if (op !== mine) return;
      ctx.show('is-running', r.changed ? 'Your code ran. Watch the office…' : 'Your code ran…', outputHTML(lang, r.res));
      await act(lang, r.res, r.before, r.after, r.events, r.changed, grade ? grade.passed : null);
      if (op !== mine) return;
      timetable.render(r.after);
      hudUpdate(r.after);
      const n = lang === 'sql' ? (r.res.rows || []).length : null;
      const ran = `Your code ran${n !== null ? ` and returned ${n} row${n === 1 ? '' : 's'}` : ''}${r.changed ? ', and it changed the world' : ''}${r.undone ? ' (its change to the data was rolled back: a question changes nothing)' : ''}.`;
      if (!grade) { ctx.show('is-miss', `${ran} ${s.interaction === 'pick' ? 'Now pick the booking.' : 'Now answer in the ticket window.'}`, outputHTML(lang, r.res)); render(); return; }
      if (grade.passed) { await stepPassed(code, lang, r.res); return; }
      const failed = grade.results.filter((x) => !x.ok);
      const shadowOnly = failed.length && failed.every((x) => x.where === 'shadow');
      const why = failed.map((x) => `${x.name}: ${x.why}`).filter(Boolean).slice(0, 2).join('; ');
      const tail = shadowOnly ? ' It gave the right answer here, but the same question asked of another week of data came out wrong: an answer typed in, or a rule that only fits this data, will not hold.' : '';
      const reset = r.changed && cur.card.grading === 'one-off' ? ' Reset puts the world back as the ticket arrived.' : '';
      ctx.show('is-miss', `${ran} Not yet: ${why}.${tail}${reset}`, outputHTML(lang, r.res));
      ctx.sound?.attention?.();
    } catch (e) {
      if (op === mine) { ctx.show('is-error', String(e?.message ?? e)); ctx.sound?.cue?.('error'); }
    } finally {
      if (op === mine) ctx.setBusy(false);
    }
  }

  // ---------------------------------------------------------------- a step passed; the ticket solved
  async function stepPassed(code, lang) {
    const card = cur.card, s = step();
    if (code) {
      const shown = new Set([...(card.learnCard?.example?.code ? detectSpells(card.learnCard.example.code, card.learnCard.example.lang) : []), ...card.spells.teach]);
      for (const sp of castSpells(code, lang, s.starter || '')) if (!shown.has(sp)) cur.casts.add(sp);
      cur.lang = lang;
    }
    if (cur.step < card.steps.length - 1) {
      cur.step++;
      if (!cur.practice) { const c = life().cards[card.id]; if (c) { c.step = cur.step; L.save(); } }
      prepareStep();
      cur.act.picked = null; cur.act.choice = null;
      if (step().interaction === 'choice' && step().options) cur.options = (await cur.world.query(step().options)).map((r) => Object.values(r)[0]);
      ctx.show('is-win', `Step ${cur.step} done. Next: ${step().objective}`);
      render();
      return;
    }
    solve();
  }
  function solve() {
    const card = cur.card;
    const help = helpOf({ hint: cur.hint, worked: cur.worked, codexEarly: cur.codexEarly });
    const casts = card.evidence === false ? [] : [...cur.casts];
    const r = recordSolve(life(), card, { help, lang: cur.lang || card.languages[0], casts, nowMs: now(), practice: cur.practice });
    setLife(r.life);
    const written = [], pencil = [];
    for (const sp of r.spells) {
      const before = store().getSpellState(sp.id).written;
      const st = store().recordCast(sp.id, { lang: cur.lang || 'sql', unaided: sp.unaided, outcome: sp.outcome, nowMs: now() });
      if (st?.written && !before) written.push(spellById(sp.id).name);
      else if (!st?.written) pencil.push(spellById(sp.id).name);
    }
    cur.solved = true;
    const credit = cur.practice ? 'Practice: no credit, and nothing in your Grimoire changes (a ticket you have passed is not a fresh problem).'
      : !r.first ? 'No XP this time: this ticket was already solved once.'
        : card.evidence === false ? 'Teaching ticket: no XP; XP comes from solving fresh problems on your own.'
          : help === 'clean' ? `+${r.xp} XP: a clean solve, no help.`
            : help === 'nudged' ? `+${r.xp} XP: solved with a nudge.`
              : help === 'guided' ? `+${r.xp} XP: guided (a hint named the idea).`
                : `+${r.xp} XP: you used the worked example, so this counts as exposure, not mastery.`;
    const spells = written.length ? `Written in your Grimoire, in ink: ${written.join(', ')}.` : pencil.length ? `Still in pencil: ${pencil.join(', ')} (cast it on your own, in a new problem, to write it in).` : '';
    cur.outcome = { reply: card.thanks || 'That is exactly it. Thank you!', credit, spells, kept: written.length ? 'Easy today is not the same as kept. Your Grimoire shows when this starts to fade; reviews arrive in the next update.' : (card.evidence === false ? 'Scaffolded: this one teaches; it is not evidence of what you can do on your own yet.' : '') };
    play.lastSolve = { card: card.id, help, xp: r.xp, written, spells: r.spells };
    setTicket3d(card, false);
    ctx.show('is-win', `Solved: ${card.from.name.split(' ')[0]}'s ticket is resolved.${r.xp ? ` +${r.xp} XP` : ''}`);
    ctx.sound?.cue?.('level-up');
    hudUpdate();
    render();
    // the editor goes back to the start of the code (a long line left it scrolled sideways)
    editor.el.scrollLeft = 0; editor.el.scrollTop = 0; editor.el.setSelectionRange?.(0, 0); editor.el.dispatchEvent(new Event('scroll'));
  }

  // ---------------------------------------------------------------- moving on
  async function next() {
    if (cur?.kind === 'card' && cur.card.explain && !cur.explained) cur.explained = true;
    const id = nextCardId(LADDER, life());
    if (!id) { chapterDone(); return; }
    const card = cardById(id);
    const pace = paceCheck(card, life(), now(), DAILY_CAP);
    if (!pace.ok) {
      cur = { kind: 'card', card: cur?.card || card, solved: true, pace: pace.message, step: 0, act: {}, outcome: { reply: '', credit: '' } };
      play.pace = pace;
      render();
      return;
    }
    play.pace = null;
    await loadCard(card);
  }
  async function practice() {
    const done = LADDER.filter((c) => solvedIds(life()).has(c.id) && c.steps.every((s) => !s.interaction));
    const pick = done[Math.floor((now() / 1000) % Math.max(1, done.length))] || LADDER[0];
    await loadCard(pick, { practice: true });
  }
  function chapterDone() {
    cur = { kind: 'card', card: LADDER[LADDER.length - 1], solved: true, act: {}, step: 0, outcome: { reply: '', credit: '' }, pace: 'That is the whole opening chapter: every ticket solved. JavaScript and PHP continue in the next chapter, with their own tickets. For now, practise any solved ticket (no credit), or stop here: sleep is when today\'s learning settles in.' };
    render();
  }
  async function reset() {
    if (!cur) return;
    if (play.busy && play.phase !== 'story') return;
    ctx.story?.cancel();
    if (cur.kind === 'tutorial') { await openWorld(TUTORIAL); cur.world = play.world; ctx.show('', ''); return; }
    const mine = ++op;
    ctx.setBusy(true, 'reset');
    try {
      await openWorld(cur.card);
      cur.world = play.world;
      cur.baseline = await baselineOf(cur.world, cur.card.steps);
      setTicket3d(cur.card, !cur.solved);
      hudUpdate();
      ctx.show('', 'Reset: the world is back as the ticket arrived.');
    } finally { if (op === mine) ctx.setBusy(false); }
  }

  // ---------------------------------------------------------------- the first-day tutorial (Sequel)
  const T = TUTORIAL;
  async function startTutorial({ replay = false } = {}) {
    const mine = ++op;
    ctx.setBusy(true, 'reset');
    play.ready = false;
    try {
      cur = { kind: 'tutorial', card: T, replay, t: replay ? 0 : Math.min(life().tutorial.step, T.steps.length - 1), act: {}, hinted: false, helped: false, solved: false };
      for (const b of ctx.tabs) b.hidden = b.dataset.lang !== 'sql';
      ctx.setLang('sql');
      await openWorld(T);
      if (op !== mine) return;
      cur.world = play.world;
      setTicket3d({ ...T, from: T.ticket.from, serve: 0, title: 'first day' }, true);
      enterTutorialStep();
      hudUpdate();
      play.ready = true;
    } finally { $('#loading').hidden = true; if (op === mine) ctx.setBusy(false); }
  }
  const tStep = () => T.steps[cur.t];
  function enterTutorialStep() {
    const s = tStep();
    cur.hinted = false; cur.helped = false; cur.pickedId = null;
    if (s.task === 'run') editor.value = s.starter ?? '';
    if (s.id === 'grimoire') store().introduce('select-all', ['sql']);
    $('#win-ticket').classList.toggle('pulse', s.id === 'ticket');
    renderTutorial();
    placeBubble();
  }
  function renderTutorial() {
    const s = tStep();
    header({ ...T, from: T.ticket.from, says: T.ticket.says }, { tutorial: true });
    objective.innerHTML = `<b>First day, step ${cur.t + 1} of ${T.steps.length}</b>`;
    let html = '';
    if (s.id === 'hints') {
      const rungs = HINT_COST.map((h) => `<li class="${cur.hinted && h.level === 1 ? 'is-open' : ''}"><button type="button" class="rung" data-act="t-hint" data-level="${h.level}" ${h.level === 1 && !cur.hinted ? '' : 'disabled'}><b>${h.level}</b> ${esc(h.name)} <small>${esc(h.costs)}</small></button>${cur.hinted && h.level === 1 ? '<p class="hint-text">Look at the number after room_id: it says which room.</p>' : ''}</li>`).join('');
      html += `<section class="hints"><span class="tag">Hint ladder</span><ol>${rungs}</ol></section>`;
    }
    thread.innerHTML = html;
    $('#win-ticket').classList.toggle('has-thread', !!html);
    ctx.fitTicket();
    // the bubble: Sequel's words and what to do
    const last = cur.t === T.steps.length - 1;
    let buttons = '';
    if (s.task === 'read' || !s.task || (s.task === 'pick' && cur.pickedId != null)) buttons += `<button type="button" class="btn primary" data-t="next">${last ? 'Finish: my first ticket ▸' : s.id === 'ticket' ? "I've read it ▸" : 'Next ▸'}</button>`;
    if (s.id === 'world' && cur.pickedId == null) buttons += '<button type="button" class="btn" data-t="timetable">Open the timetable</button>';
    if (s.id === 'grimoire') buttons += '<button type="button" class="btn" data-t="showme">Show me (counts as help)</button>';
    if (!last) buttons += '<button type="button" class="btn link" data-t="skip">Skip this step</button>';
    if (cur.replay) buttons += '<button type="button" class="btn link" data-t="end">End the tutorial</button>';
    let meter = '';
    if (s.id === 'meter') {
      const st = store().getSpellState('select-all'), ink = inkOf(st, now());
      // an example meter (a spell just written, kept about 3 days), clearly labelled as an example: the demonstration
      // itself is not on any meter
      const m = describeSkill({ name: 'example', lang: 'SQL', lastMs: now(), stability: 3 }, now());
      meter = `<div class="say-meter"><b>Ask for everything</b> · ${esc(ink.line)}<br><small>Example meter: a spell just written is kept about 3 days; the ink fades along this curve.</small><svg viewBox="0 0 120 40" role="img" aria-label="Example: estimated recall over the next days"><polyline points="${m.curve}" fill="none" stroke="currentColor" stroke-width="2"/></svg></div>`;
    }
    bubble.innerHTML = `<div class="say-who"><i></i>Sequel</div><p>${esc(s.say)}</p>${meter}<div class="row">${buttons}</div>`;
    bubble.hidden = false;
  }
  bubble.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (!b || cur?.kind !== 'tutorial') return;
    const a = b.dataset.t;
    if (a === 'next') tutorialNext();
    else if (a === 'skip') { if (!cur.replay) { life().tutorial.skipped.push(tStep().id); L.save(); } tutorialNext(); }
    else if (a === 'end') endTutorial();
    else if (a === 'timetable') showTimetable(true);
    else if (a === 'showme') { cur.helped = true; editor.value = 'SELECT * FROM people;'; ctx.show('is-miss', 'Shown, not cast: press Run, and the spell stays in pencil this time (help never writes a spell in).'); }
  });
  function tutorialAct(a) {
    if (a === 't-hint') { cur.hinted = true; renderTutorial(); ctx.show('is-win', 'That is the hint ladder. On a real ticket that nudge would have cost 3 XP, and the solve would count as "nudged". The cost is always shown before you open one.'); setTimeout(() => cur?.kind === 'tutorial' && tStep().id === 'hints' && tutorialNext(), 50); }
  }
  function tutorialPicked(id) {
    if (tStep().id !== 'world') return;
    cur.pickedId = id;
    ctx.show('is-win', `That is booking ${id}: one row of the bookings table. Every block, and every person in a room, is a row like it.`);
    renderTutorial();
  }
  async function tutorialRun() {
    const s = tStep();
    const code = editor.value;
    if (!code.trim()) { ctx.show('is-miss', 'Type the query first.'); return; }
    const mine = ++op;
    ctx.setBusy(true, 'run');
    try {
      const r = await execute('sql', code);
      if (op !== mine) return;
      if (!r.res.ok) { ctx.show('is-error', r.res.error, explainError(r.res.error)); return; }
      const grade = s.checks ? await gradeStep({ grading: 'one-off' }, s, { world: play.world, lang: 'sql', code, res: r.res, act: {} }) : { passed: false, results: [] };
      ctx.show('is-running', 'Watch the office…', ctx.rowsTable(r.res.rows));
      await act('sql', r.res, r.before, r.after, r.events, r.changed, null);
      if (op !== mine) return;
      if (r.changed) { await openWorld(T, { keepPick: true }); cur.world = play.world; }
      if (s.task !== 'run') { ctx.show('is-win', 'It ran. Carry on with what Sequel says.', ctx.rowsTable(r.res.rows)); return; }
      if (!grade.passed) { ctx.show('is-miss', `It ran, but it is not quite it: ${grade.results.filter((x) => !x.ok).map((x) => x.why)[0] || 'try again'}.`, ctx.rowsTable(r.res.rows)); return; }
      if (s.id === 'grimoire') {
        const unaided = !cur.helped && !cur.replay && castSpells(code, 'sql', '').includes('select-all');
        // the plan's moment, honestly labelled: a demonstration, never counted (the first real unaided cast writes it)
        store().recordCast('select-all', { lang: 'sql', demo: unaided, outcome: 'exposure', nowMs: now() });
        play.lastSolve = { card: 'tutorial', unaided };
        ctx.show('is-win', unaided ? 'Cast on your own: “Ask for everything” appears in your Grimoire as a Demonstration. It counts once you cast it on your own in a real ticket.' : cur.replay ? 'Cast. (A replay is practice: nothing new is written.)' : 'Cast with help: it stays in pencil until you cast it on your own.', ctx.rowsTable(r.res.rows));
        import('./grimoire.js').then((m) => { const g = m.grimoire(); g.open('select-all'); setTimeout(() => { g.close(); }, 2600 / Math.max(0.1, play.timeScale || 1)); });
      } else ctx.show('is-win', s.id === 'query' ? 'That is every booking: each lit-up person is one row; the others are at other times of the week.' : 'One word changed the question: now only the Studio (room 2).', ctx.rowsTable(r.res.rows));
      tutorialNext();
    } finally { if (op === mine) ctx.setBusy(false); }
  }
  function tutorialNext() {
    if (cur.t >= T.steps.length - 1) { endTutorial(); return; }
    cur.t++;
    if (!cur.replay) { life().tutorial.step = cur.t; L.save(); }
    enterTutorialStep();
  }
  async function endTutorial() {
    bubble.hidden = true;
    $('#win-ticket').classList.remove('pulse');
    if (!cur.replay) { life().tutorial.done = true; L.save(); }
    await next();
  }
  // the bubble sits by Sequel (or in a fixed place when there is no 3D view)
  function placeBubble() {
    if (bubble.hidden) return;
    const p = ctx.office && !ctx.glDown() ? ctx.office.screenOf('drone') : null;
    const W = innerWidth, H = innerHeight, bw = bubble.offsetWidth || 340, bh = bubble.offsetHeight || 160;
    let x = p ? p.x + 26 : W - bw - 16, y = p ? p.y - bh - 10 : H - bh - 16;
    // never over the timetable (its inspector is what the bubble is talking about): bottom right instead
    if (!ttWin.hidden) { const r = ttWin.getBoundingClientRect(); if (x < r.right && x + bw > r.left && y < r.bottom && y + bh > r.top) { x = W - bw - 16; y = H - bh - 16; if (y < r.bottom) x = Math.max(8, r.left - bw - 12); } }
    if (wins.isPhone) { bubble.style.left = ''; bubble.style.top = ''; bubble.classList.add('is-docked'); return; }
    bubble.classList.remove('is-docked');
    x = Math.max(8, Math.min(W - bw - 8, x)); y = Math.max(70, Math.min(H - bh - 8, y));
    bubble.style.left = `${x}px`; bubble.style.top = `${y}px`;
  }
  const bubbleTimer = setInterval(placeBubble, 300);

  // ---------------------------------------------------------------- picking people in the office
  const canvas = document.querySelector('#scene canvas');
  let down = null;
  canvas?.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  canvas?.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || !ctx.office) { down = null; return; }
    down = null;
    const id = ctx.office.pick(e.clientX, e.clientY);
    if (id != null) { showTimetable(true); timetable.inspect(id); }
  });

  // ---------------------------------------------------------------- start: the tutorial on a fresh life, else Continue
  const api = {
    run, reset, next, practice, loadCard, startTutorial,
    get current() { return cur ? { kind: cur.kind, id: cur.card?.id, step: cur.kind === 'tutorial' ? cur.t : cur.step, tutorialStep: cur.kind === 'tutorial' ? tStep().id : null, solved: !!cur.solved, learning: !!cur.learning, hint: cur.hint || 0, worked: !!cur.worked, practice: !!cur.practice, pace: cur.pace || null } : null; },
    get life() { return life(); },
    store, timetable, setNow(ms) { nowOverride = ms; }, now, ladder: LADDER, cardById,
    pickBooking(id) { showTimetable(true); return timetable.inspect(id); },
    dispose() { clearInterval(bubbleTimer); },
  };
  if (params.has('tutorial') && life().tutorial.done) await startTutorial({ replay: true });
  else if (!life().tutorial.done) await startTutorial();
  else await next();
  return api;
}
