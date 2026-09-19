// Mockup logic. Pure functions first (tested in Node), DOM code below.
// Folders that hold the audio files (not in this repo). Set them in audio-paths.local.js, see audio-paths.example.js.
const AUDIO_BASES = (typeof window !== 'undefined' && window.AUDIO_BASES) || [];

const norm = (s) => s.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '').trim();
const isAccepted = (value, accepted) => accepted.some((a) => norm(a) === norm(value));
const display = (n) => (n.type === 'noun' ? `${n.article} ${n.lemma}` : n.lemma);
const pluralText = (n) => {
  if (n.plural_only) return '(тільки мн.)';
  if (!n.plural || !n.plural.length) return '';
  const [first, ...rest] = n.plural;
  return `(de ${first}${rest.length ? `, також: ${rest.map((r) => 'de ' + r).join(', ')}` : ''})`;
};
const surfaces = (n) => [display(n), ...(n.plural || []).map((p) => 'de ' + p), ...(n.type === 'noun' ? [...(n.plural || []), n.lemma] : [])];

// "Ik heb **geen** boek." -> [{text:'Ik heb '}, {text:'geen', bold:true}, {text:' boek.'}]
function richParts(text) {
  return text.split('**').map((t, i) => ({ text: t, bold: i % 2 === 1 })).filter((p) => p.text);
}

// Split a sentence into plain text and highlighted note terms.
function splitTerms(sentence, notes) {
  const map = new Map();
  notes.forEach((n) => surfaces(n).forEach((s) => map.set(s.toLowerCase(), n)));
  const keys = [...map.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(?<![\\p{L}])(${keys.join('|')})(?![\\p{L}])`, 'giu');
  const out = [];
  let last = 0, m;
  while ((m = re.exec(sentence))) {
    if (m.index > last) out.push({ text: sentence.slice(last, m.index) });
    out.push({ text: m[0], note: map.get(m[0].toLowerCase()) });
    last = m.index + m[0].length;
  }
  if (last < sentence.length) out.push({ text: sentence.slice(last) });
  return out;
}

// A lesson has no rule card, one (object) or several (array).
const rulesOf = (lesson) => (Array.isArray(lesson.rule) ? lesson.rule : lesson.rule ? [lesson.rule] : []);

// A dictation can draw a limited number of words per attempt (ex.max). Fisher-Yates on a copy.
function pickDictation(notes, max, rand = Math.random) {
  if (!max || notes.length <= max) return notes;
  const pool = notes.slice();
  for (let i = pool.length - 1; i > 0; i--) { const k = Math.floor(rand() * (i + 1)); [pool[i], pool[k]] = [pool[k], pool[i]]; }
  return pool.slice(0, max);
}

// Which notes take part in the dictation exercise of a lesson.
const dictationNotes = (lesson, ex) => lesson.notes.filter((n) => ex.note_types.includes(n.type) && n.dictation !== false && n.audio);

if (typeof document === 'undefined') {
  module.exports = { AUDIO_BASES, pickDictation, rulesOf, norm, isAccepted, display, pluralText, splitTerms, richParts, dictationNotes };
} else {
  const LESSONS = window.LESSONS;
  let current = 0;
  const PS = window.ProgressStore;
  const log = new PS.ProgressLog(); // the progress log: everything the learner does is an appended event
  const isDone = (i) => !!log.state().lessons[LESSONS[i].id];
  let folderName = '';
  let rate = 1; // playback speed of all audio (1, 0.75 or 0.5)
  try { rate = Number(localStorage.getItem('audioRate')) || 1; } catch (e) { /* storage may be blocked */ }
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const rich = (parent, text) => { richParts(text).forEach((p) => parent.append(p.bold ? el('b', null, p.text) : document.createTextNode(p.text))); return parent; };
  const SPEAKER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';

  const toast = (msg) => { const t = $('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); };
  async function play(file) {
    for (const base of AUDIO_BASES) {
      try { const a = new Audio(base + encodeURIComponent(file)); a.defaultPlaybackRate = rate; a.playbackRate = rate; a.preservesPitch = true; await a.play(); return; } catch (e) { /* try next base */ }
    }
    toast('Аудіо не знайдено поруч з макетом.');
  }
  const iconBtn = (file) => { const b = el('button', 'icon'); b.title = 'Озвучка'; b.innerHTML = SPEAKER; b.onclick = () => play(file); return b; };

  function wordRow(n) {
    const li = el('li');
    li.append(el('span', 'nl', display(n)));
    li.append(el('span', 'meta', [pluralText(n), n.ua].filter(Boolean).join(' - ')));
    if (n.plural_source === 'teacher') li.append(el('span', 'opt', 'мн. додала викладачка'));
    if (n.audio) li.append(iconBtn(n.audio));
    return li;
  }

  function renderRule(L) {
    const box = $('b1-rule');
    rulesOf(L).forEach((rule, ri) => renderRuleCard(box, rule, ri));
  }
  function renderRuleCard(box, rule, ri) {
    const L = { rule };
    if (ri > 0) box.append(el('hr', 'rule-sep'));
    box.append(el('div', 'rule-title', L.rule.title_ua), el('p', 'meta rule-sum', L.rule.summary_ua));
    if (L.rule.see) box.append(el('p', 'opt', `див. ${L.rule.see}`));
    const grid = el('div', 'compare');
    L.rule.compare.forEach((c) => {
      const col = el('div', 'cmp');
      col.append(el('div', 'cmp-h', c.form), el('p', 'meta', c.when_ua));
      const ul = el('ul', 'cmp-ex');
      c.examples.forEach((e) => { const li = el('li'); rich(li, e.nl); li.append(document.createTextNode(' '), iconBtn(e.audio), el('div', 'meta', e.ua)); ul.append(li); });
      col.append(ul, el('p', 'cmp-note', c.note_ua));
      grid.append(col);
    });
    box.append(grid);
    const pts = el('ul', 'points'); L.rule.points_ua.forEach((p) => pts.append(el('li', null, p))); box.append(pts);
  }

  function renderReading(container, L) {
    const highlighted = L.notes.filter((n) => L.reading.highlight.includes(n.id));
    container.innerHTML = '';
    L.reading.sentences.forEach((s) => {
      const line = el('div', 'sentence');
      splitTerms(s.nl, highlighted).forEach((p) => {
        if (!p.note) { line.append(document.createTextNode(p.text)); return; }
        const t = el('span', 'term'); t.tabIndex = 0; t.append(document.createTextNode(p.text));
        const tip = el('span', 'tip'), box = el('div');
        const info = el('span'); info.append(document.createTextNode(p.note.ua), el('br'), el('span', 'meta', [display(p.note), pluralText(p.note)].filter(Boolean).join(' ')));
        box.append(info); if (p.note.audio) box.append(iconBtn(p.note.audio));
        tip.append(box); t.append(tip); line.append(t);
      });
      line.append(document.createTextNode(' '), iconBtn(s.audio), el('div', 'tr meta', s.ua));
      container.append(line);
    });
  }

  const blanks = (text, mk) => { const box = el('span'); text.split('___').forEach((part, i, arr) => { box.append(document.createTextNode(part)); if (i < arr.length - 1) box.append(mk(i)); }); return box; };
  const input = (cls, accepted, value) => { const i = el('input'); i.type = 'text'; i.autocomplete = 'off'; i.spellcheck = false; if (cls) i.className = cls; if (value != null) { i.value = value; i.readOnly = true; } else i.dataset.acc = JSON.stringify(accepted); return i; };

  function renderPractice(L) {
    const root = $('b4-body');
    L.practice.forEach((ex, idx) => {
      const box = el('div', 'ex');
      const h = el('h3'); h.append(el('span', 'badge', String(idx + 1)), document.createTextNode(ex.instruction_ua)); box.append(h);
      const list = ex.type === 'matching' ? el('div', 'match') : el('ol', 'items');
      if (ex.type === 'gaps') { const bank = el('div', 'bank'); ex.bank.forEach((w) => bank.append(el('span', null, w))); box.append(bank); }

      if (ex.type === 'matching') {
        // the right-hand column is shuffled deterministically, so the answer is never in the same row as its question
        const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
        const right = [...ex.items.map((i) => i.answer), ...(ex.extra || [])].sort((a, b) => hash(a) - hash(b));
        const left = el('ol', 'items'), rightOl = el('ol', 'items');
        rightOl.type = 'a';
        ex.items.forEach((it) => {
          const li = el('li', it.example ? 'example' : ''), sel = el('select');
          const opt = (value, label) => { const o = el('option', null, label); o.value = value; return o; };
          sel.append(opt('', '-'));
          right.forEach((r, i) => sel.append(opt(r, 'abcdefghij'[i])));
          if (it.example) { sel.value = it.answer; sel.disabled = true; } else sel.dataset.acc = JSON.stringify([it.answer]);
          li.append(el('span', null, it.prompt), document.createTextNode(' '), sel);
          left.append(li);
        });
        right.forEach((r) => rightOl.append(el('li', null, r)));
        list.append(left, rightOl);
      } else if (ex.type === 'dictation') {
        pickDictation(dictationNotes(L, ex), ex.max).forEach((n) => { const li = el('li', 'dict'); li.append(iconBtn(n.audio), input('', [display(n)])); list.append(li); });
      } else ex.items.forEach((it) => {
        const li = el('li', it.example ? 'example' : '');
        if (ex.type === 'translate' || ex.type === 'transform') {
          li.append(el('span', null, it.prompt), el('span', 'cue', ` (${it.cue})`));
          li.append(it.example ? input('wide', null, it.accepted[0]) : input('wide', it.accepted));
        } else if (ex.type === 'gaps') {
          li.append(el('span', 'meta', `${it.hint}  `));
          li.append(blanks(it.text, (i) => (it.example ? input('', null, it.accepted[i][0]) : input('', it.accepted[i]))));
        } else if (ex.type === 'verbform') {
          li.append(blanks(it.text, () => (it.example ? input('', null, it.accepted[0]) : input('', it.accepted))), el('span', 'cue', ` (${it.cue})`));
        }
        list.append(li);
      });
      box.append(list);

      const check = el('button', 'btn', 'Перевірити'), retry = el('button', 'btn', 'Спробувати ще'), res = el('div', 'result');
      check.onclick = () => {
        const inputs = [...list.querySelectorAll('[data-acc]')]; let ok = 0; const wrong = [];
        inputs.forEach((i, n) => {
          i.parentNode.querySelectorAll('.fix').forEach((f) => f.remove());
          const acc = JSON.parse(i.dataset.acc), good = isAccepted(i.value, acc);
          i.classList.toggle('ok', good); i.classList.toggle('bad', !good);
          if (good) ok++; else { wrong.push({ n, answer: i.value, expected: acc[0] }); i.after(el('span', 'fix', ` ${acc[0]}`)); }
        });
        res.textContent = `Вірно: ${ok} з ${inputs.length}`; res.classList.add('show');
        log.record({ type: 'exercise_checked', lesson: L.id, exercise: idx, kind: ex.type, ok, total: inputs.length, wrong });
      };
      retry.onclick = () => { list.querySelectorAll('[data-acc]').forEach((i) => { i.value = ''; i.classList.remove('ok', 'bad'); }); list.querySelectorAll('.fix').forEach((f) => f.remove()); res.classList.remove('show'); };
      box.append(check, document.createTextNode(' '), retry, res);
      root.append(box);
    });
  }

  function renderLesson(idx) {
    current = idx;
    const L = LESSONS[idx];
    ['b1-rule', 'b1-verbs', 'b1-words', 'b2-list', 'b3-text', 'texts-copy', 'b4-body'].forEach((id) => { $(id).innerHTML = ''; });
    $('lesson-label').textContent = `Les ${L.order}`;
    renderRule(L);
    L.notes.filter((n) => n.type === 'verb').forEach((v) => {
      const card = el('div', 'verbcard');
      card.append(el('div', 'rule-title', `${v.lemma} (${v.ua})`));
      const tbl = el('table', 'paradigm');
      v.paradigm.forEach((r) => {
        const tr = el('tr');
        tr.append(el('td', 'nl', r.pronoun), el('td', 'meta', r.ua), el('td', 'nl', r.form));
        const td = el('td'); td.append(iconBtn(r.audio)); tr.append(td); tbl.append(tr);
      });
      card.append(tbl); $('b1-verbs').append(card);
    });
    L.notes.filter((n) => n.type !== 'verb').forEach((n) => $('b1-words').append(wordRow(n)));
    const service = (L.service_words || []).join(', ');
    $('b1-service').textContent = service; $('b1-service-line').hidden = !service;

    L.examples.forEach((e) => { const li = el('li'); li.append(el('span', 'nl-s', e.nl), el('span', 'meta', '  ' + e.ua), document.createTextNode(' '), iconBtn(e.audio)); $('b2-list').append(li); });

    $('reading-title').textContent = $('reading-title-2').textContent = `${L.reading.title} (${L.reading.title_ua})`;
    renderReading($('b3-text'), L); renderReading($('texts-copy'), L);
    renderPractice(L);
    renderProgress();
  }

  function renderProgress() {
    const rows = $('progress-rows'); rows.innerHTML = '';
    const state = log.state();
    LESSONS.forEach((L, i) => {
      const tr = el('tr'); const td = el('td'); const b = el('button', 'btn', 'Відкрити');
      b.onclick = () => { renderLesson(i); show('today'); };
      td.append(b);
      const checked = L.practice.map((_, k) => state.exercises[`${L.id}#${k}`]).filter(Boolean);
      const pct = checked.length ? Math.round((100 * checked.reduce((s, x) => s + x.last.ok / (x.last.total || 1), 0)) / checked.length) : 0;
      tr.append(el('td', null, `Les ${L.order}`), el('td', null, isDone(i) ? 'пройдено' : i === current ? 'поточний' : 'чекає'),
        el('td', 'meta', checked.length ? `${checked.length} з ${L.practice.length} вправ перевірено · ${pct}%` : '-'), td);
      rows.append(tr);
    });
  }

  // ---- Cards tab: spaced repetition (FSRS). Card state is replayed from the review log, never stored.
  const F = window.FSRS, CardsLib = window.Cards;
  const cardCfg = { newPerDay: 10, sessionCap: 30, shortCap: 15 };
  const dutchHelpers = { display, pluralText };
  let session = null; // { left, reviewed, card, revealed, shownAt }
  const currentDeck = () => CardsLib.buildDeck(LESSONS.filter((_, i) => isDone(i)));
  const cardStates = () => CardsLib.replay(log.events, F);

  function renderCardsStats() {
    if (!F) { $('cards-stats').textContent = 'Немає бібліотеки планувальника. Виконай npm install у теці застосунку.'; return; }
    const s = CardsLib.stats(currentDeck(), cardStates(), log.events, new Date(), cardCfg);
    $('cards-stats').textContent = s.total
      ? `Карток у колоді: ${s.total} · на повторення зараз: ${s.due} · нових на сьогодні: ${s.newRoom} · вивчено: ${s.learned}`
      : 'Колода з\'явиться, коли ти позначиш перший урок пройденим.';
  }

  function startSession(cap) { session = { left: cap, reviewed: 0 }; nextCard(); }
  function nextCard() {
    const q = session.left > 0 ? CardsLib.queue(currentDeck(), cardStates(), log.events, new Date(), { newPerDay: cardCfg.newPerDay, limit: 1 }) : [];
    session.card = q[0] || null; session.revealed = false; session.shownAt = Date.now();
    renderStage();
    if (session.card) { const v = CardsLib.present(session.card, currentDeck().notes.get(session.card.noteId), dutchHelpers); if (v.front.audio) play(v.front.audio); }
  }
  function reveal() {
    session.revealed = true; renderStage();
    const v = CardsLib.present(session.card, currentDeck().notes.get(session.card.noteId), dutchHelpers);
    if (v.back.audio) play(v.back.audio);
  }
  function rateCard(r) {
    log.record({ type: 'card_review', card: session.card.id, rating: r, ms: Date.now() - session.shownAt });
    session.left--; session.reviewed++;
    nextCard();
  }

  function renderStage() {
    const stage = $('cards-stage'); stage.innerHTML = '';
    renderCardsStats();
    if (!F) return;
    const deck = currentDeck();
    if (!deck.cards.length) return;
    const box = el('div', 'fc');
    if (!session) {
      box.append(el('p', 'meta', 'Не хвилюйся, якщо карток накопичилось багато: за один раз показується не більше ' + cardCfg.sessionCap + ', найстаріші першими.'));
      const go = el('button', 'btn primary', 'Почати повторення'); go.onclick = () => startSession(cardCfg.sessionCap);
      const short = el('button', 'btn', `Коротка сесія (${cardCfg.shortCap} карток)`); short.onclick = () => startSession(cardCfg.shortCap);
      const actions = el('div', 'fc-actions'); actions.append(go, short); box.append(actions);
      stage.append(box); return;
    }
    if (!session.card) {
      const now = new Date(), states = cardStates();
      const soon = deck.cards.filter((c) => states.has(c.id) && states.get(c.id).due > now && states.get(c.id).due - now <= 20 * 60000).length;
      box.append(el('p', null, session.reviewed ? `Готово: переглянуто карток ${session.reviewed}.` : 'На зараз карток немає.'));
      if (soon) box.append(el('p', 'meta', `Ще ${soon} карток повернуться протягом 20 хвилин.`));
      const end = el('button', 'btn primary', 'Закрити'); end.onclick = () => { session = null; renderStage(); };
      const actions = el('div', 'fc-actions'); actions.append(end); box.append(actions);
      stage.append(box); return;
    }
    const c = session.card, note = deck.notes.get(c.noteId), v = CardsLib.present(c, note, dutchHelpers);
    box.append(el('div', 'fc-count', `Залишилось у сесії: ${session.left}`));
    const card = el('div', 'fc-card');
    const side = (s) => { card.append(el('div', 'fc-text', s.text)); if (s.sub) card.append(el('div', 'fc-sub', s.sub)); if (s.audio) card.append(iconBtn(s.audio)); };
    side(v.front);
    if (session.revealed) { card.append(el('hr', 'fc-hr')); side(v.back); }
    box.append(card);
    if (!session.revealed) {
      const show = el('button', 'btn primary', 'Показати відповідь (Пробіл)'); show.onclick = reveal;
      const actions = el('div', 'fc-actions'); actions.append(show); box.append(actions);
    } else {
      const now = new Date(), pv = CardsLib.previews(cardStates().get(c.id), now, F), grid = el('div', 'fc-rate');
      [['Знову', 1], ['Важко', 2], ['Добре', 3], ['Легко', 4]].forEach(([label, r]) => {
        const rb = el('button', 'btn'); rb.append(el('span', null, `${r} · ${label}`), el('small', null, CardsLib.humanize(pv[r], now))); rb.onclick = () => rateCard(r); grid.append(rb);
      });
      box.append(grid);
    }
    const stop = el('button', 'btn', 'Завершити сесію'); stop.onclick = () => { session = null; renderStage(); };
    const tail = el('div', 'fc-actions'); tail.append(stop); box.append(tail);
    stage.append(box);
  }
  if (document.addEventListener) document.addEventListener('keydown', (e) => {
    if (!session || !session.card || !$('view-cards').classList.contains('active')) return;
    if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (!session.revealed) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); reveal(); } }
    else if (['1', '2', '3', '4'].includes(e.key)) rateCard(Number(e.key));
    else if (e.key === ' ') { e.preventDefault(); rateCard(3); }
  });

  // ---- Where progress is saved
  const canPick = typeof window.showDirectoryPicker === 'function';
  let rememberedHandle = null;
  function renderStatus() {
    const box = $('pstore'), btn = $('pstore-btn');
    let msg, warn = true, showBtn = false, label = 'Підключити теку';
    if (log.connected && !log.failures) { msg = `збережено в теці «${folderName}» (${log.events.length} подій)`; warn = false; }
    else if (log.connected) { msg = `НЕ вдалося записати ${log.failures} подій, перевір теку`; showBtn = true; label = 'Обрати теку знову'; }
    else if (canPick) { msg = `не зберігається (у пам'яті ${log.events.length} подій)`; showBtn = true; if (rememberedHandle) label = 'Дозволити доступ до теки'; }
    else { msg = 'потрібен Chrome або Edge, щоб зберігати прогрес'; }
    $('pstore-text').textContent = 'Прогрес: ' + msg;
    box.classList.toggle('warn', warn);
    btn.hidden = !showBtn; btn.textContent = label;
  }
  log.onChange = () => { renderProgress(); renderStatus(); renderCardsStats(); };
  async function connect(handle) {
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') { toast('Доступ до теки не надано.'); return; }
    folderName = handle.name;
    await log.attach(new PS.FolderStore(handle, { device: 'laptop' }));
    if (log.badLines) toast(`Пошкоджених рядків у журналі пропущено: ${log.badLines}`);
    const first = LESSONS.findIndex((_, i) => !isDone(i));
    renderLesson(first === -1 ? LESSONS.length - 1 : first);   // "Today" = first lesson not marked done
  }
  $('pstore-btn').onclick = async () => {
    try {
      const handle = rememberedHandle || await window.showDirectoryPicker({ mode: 'readwrite' });
      if (!rememberedHandle) await PS.handleStore.set('dataDir', handle);
      await connect(handle);
    } catch (e) { if (e.name !== 'AbortError') toast('Не вдалося підключити теку: ' + e.message); }
  };
  (async () => {
    try {
      rememberedHandle = (await PS.handleStore.get('dataDir')) || null;
      if (rememberedHandle && (await rememberedHandle.queryPermission({ mode: 'readwrite' })) === 'granted') await connect(rememberedHandle);
    } catch (e) { /* no stored folder or no browser support: the button stays */ }
    renderStatus();
  })();

  function renderWords() {
    const root = $('all-words'); root.innerHTML = '';
    LESSONS.forEach((L) => {
      root.append(el('h3', 'sub', `Les ${L.order}`));
      const ul = el('ul', 'words');
      L.notes.filter((n) => n.type !== 'verb').forEach((n) => ul.append(wordRow(n)));
      L.notes.filter((n) => n.type === 'verb').forEach((v) => { const li = el('li'); li.append(el('span', 'nl', v.lemma), el('span', 'meta', `${v.ua} - ${[...new Set(v.paradigm.map((r) => r.form))].join(', ')}`)); ul.append(li); });
      root.append(ul);
    });
  }

  function show(view) {
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
    if (view === 'cards') renderStage();
    document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    window.scrollTo(0, 0);
  }
  $('nav').addEventListener('click', (e) => { if (e.target.dataset.view) show(e.target.dataset.view); });
  document.querySelectorAll('.toggle-tr').forEach((b) => b.onclick = () => document.body.classList.toggle('show-tr'));
  $('next').onclick = () => {
    log.record({ type: 'lesson_done', lesson: LESSONS[current].id });
    const next = LESSONS.findIndex((_, i) => i > current && !isDone(i));
    if (next === -1) { renderProgress(); toast(`Les ${LESSONS[current].order} позначено пройденим. Це останній опублікований урок.`); return; }
    renderLesson(next); window.scrollTo(0, 0); toast(`Відкрито Les ${LESSONS[next].order}.`);
  };
  const file = $('upload-file');
  $('upload-btn').onclick = () => file.click();
  file.onchange = async () => {
    const f = file.files[0];
    if (!f) return;
    if (!log.store) { $('upload-note').textContent = 'Спочатку підключи теку з прогресом (угорі), тоді запис буде збережено.'; return; }
    const L = LESSONS[current];
    const name = `les-${String(L.order).padStart(2, '0')}-${new Date().toISOString().slice(0, 10)}-${f.name}`.replace(/[^\w.\-]+/g, '_');
    try {
      await log.store.saveRecording(name, f);
      log.record({ type: 'recording_saved', lesson: L.id, file: name });
      $('upload-note').textContent = `Збережено: recordings/${name}. Скажи Марійке, що запис там.`;
    } catch (e) { $('upload-note').textContent = 'Не вдалося зберегти запис: ' + e.message; }
  };

  const markSpeed = () => document.querySelectorAll('#speed button').forEach((b) => b.classList.toggle('active', Number(b.dataset.rate) === rate));
  document.querySelectorAll('#speed button').forEach((b) => b.onclick = () => {
    rate = Number(b.dataset.rate); markSpeed();
    try { localStorage.setItem('audioRate', String(rate)); } catch (e) { /* ignore */ }
    toast(rate === 1 ? 'Озвучка: звичайна швидкість' : `Озвучка: ${String(rate).replace('.', ',')}× швидкості`);
  });
  markSpeed();

  // ---- Light (papyrus) and dark theme
  let theme = 'dark';
  try { theme = localStorage.getItem('theme') === 'light' ? 'light' : 'dark'; } catch (e) { /* ignore */ }
  const applyTheme = () => {
    if (document.documentElement) document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('#theme button').forEach((b) => b.classList.toggle('active', b.dataset.theme === theme));
  };
  document.querySelectorAll('#theme button').forEach((b) => b.onclick = () => {
    theme = b.dataset.theme; applyTheme();
    try { localStorage.setItem('theme', theme); } catch (e) { /* ignore */ }
  });
  applyTheme();

  window.progressLog = log; // handy for tests
  renderWords();
  renderLesson(0);
  renderStatus();
  renderCardsStats();
}
