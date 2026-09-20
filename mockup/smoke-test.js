// Smoke test for the mockup without a browser: runs lesson.js against a tiny fake DOM.
// Run: node mockup/smoke-test.js
const fs = require('fs');
const path = require('path');

class Text { constructor(t) { this.textContent = t; } }
class El {
  constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.className = ''; this.parentNode = null; this._text = ''; this.hidden = false; this.value = ''; this.files = [];
    const set = new Set(); this.classList = { add: (c) => set.add(c), remove: (...c) => c.forEach((x) => set.delete(x)), toggle: (c, on) => { (on === undefined ? !set.has(c) : on) ? set.add(c) : set.delete(c); }, contains: (c) => set.has(c) }; }
  set innerHTML(v) { this.children = []; this._html = v; }
  set textContent(v) { this._text = v; this.children = []; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  append(...nodes) { nodes.forEach((n) => { const node = typeof n === 'string' ? new Text(n) : n; if (node instanceof El) node.parentNode = this; this.children.push(node); }); }
  after() {}
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((c) => c !== this); }
  addEventListener(type, fn) { (this.listeners = this.listeners || {})[type] = fn; }
  all() { return this.children.flatMap((c) => (c instanceof El ? [c, ...c.all()] : [])); }
  querySelectorAll(sel) { return this.all().filter((e) => (sel === 'input[data-acc]' || sel === '[data-acc]' ? e.dataset.acc !== undefined : sel.startsWith('.') ? e.className.split(' ').includes(sel.slice(1)) : false)); }
}
const byId = {};
const ids = ['pstore', 'pstore-text', 'pstore-btn', 'cards-stats', 'cards-stage', 'cards-dir', 'nav', 'toast', 'lesson-label', 'b1-rule', 'b1-verbs', 'b1-words', 'b1-service', 'b1-service-line', 'b2-list', 'reading-title', 'reading-title-2', 'b3-text', 'texts-copy', 'b4-body', 'progress-rows', 'all-words', 'next', 'prev', 'reset', 'upload-btn', 'upload-file', 'upload-note', 'reading-status'];
ids.forEach((id) => { byId[id] = new El('div'); });
global.window = { scrollTo() {}, LESSONS: fs.readdirSync(path.join(__dirname, '..', 'content', 'nl', 'lessons')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'nl', 'lessons', f), 'utf8'))) };
global.document = { getElementById: (id) => { if (!byId[id]) throw new Error('page is missing element #' + id); return byId[id]; }, createElement: (t) => new El(t), createTextNode: (t) => new Text(t), querySelectorAll: () => [], body: new El('body'), documentElement: { setAttribute() {} } };
global.Audio = class { play() { return Promise.resolve(); } };
global.confirm = () => true;
const storage = new Map();
global.localStorage = { getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)) };

window.ProgressStore = require('./progress-store.js');
window.FSRS = require('ts-fsrs');
window.Cards = require('./cards.js');
require('./lesson.js');

let bad = 0;
const t = (name, ok) => { if (!ok) { bad++; console.log('FAIL', name); } };
const buttons = (root, label) => root.all().filter((e) => e.tag === 'button' && e.textContent === label);

function checkLesson(idx) {
  const L = window.LESSONS[idx];
  t(`lesson ${L.order}: label`, byId['lesson-label'].textContent === `Les ${L.order}`);
  t(`lesson ${L.order}: rule card ${L.rule ? 'present' : 'absent'}`, (byId['b1-rule'].children.length > 0) === !!L.rule);
  t(`lesson ${L.order}: every example has an audio button`, byId['b2-list'].children.every((li) => li.all().some((e) => e.className === 'icon')));
  t(`lesson ${L.order}: reading terms highlighted`, byId['b3-text'].all().some((e) => e.className === 'term'));
  t(`lesson ${L.order}: service line hidden iff no service words`, byId['b1-service-line'].hidden === !(L.service_words || []).length);

  const exercises = byId['b4-body'].children;
  t(`lesson ${L.order}: ${L.practice.length} exercises rendered`, exercises.length === L.practice.length);
  exercises.forEach((box, i) => {
    const inputs = box.querySelectorAll('[data-acc]');
    const [check, retry] = buttons(box, 'Перевірити').concat(buttons(box, 'Спробувати ще'));
    const result = box.all().find((e) => e.className === 'result');
    // all correct
    inputs.forEach((inp) => { inp.value = JSON.parse(inp.dataset.acc)[0]; });
    check.onclick();
    t(`lesson ${L.order} ex ${i + 1}: all-correct -> "${result.textContent}"`, result.textContent === `Вірно: ${inputs.length} з ${inputs.length}` && inputs.every((x) => x.classList.contains('ok')));
    // all wrong
    inputs.forEach((inp) => { inp.value = 'xxx'; });
    check.onclick();
    t(`lesson ${L.order} ex ${i + 1}: all-wrong -> "${result.textContent}"`, result.textContent === `Вірно: 0 з ${inputs.length}` && inputs.every((x) => x.classList.contains('bad')));
    retry.onclick();
    t(`lesson ${L.order} ex ${i + 1}: retry clears`, inputs.every((x) => x.value === '' && !x.classList.contains('bad')) && !result.classList.contains('show'));
  });
  console.log(`lesson ${L.order}: ${exercises.length} exercises, ${byId['b4-body'].querySelectorAll('[data-acc]').length} answer fields checked`);
}

// every audio reference must resolve to a real file through the mockup's own list of folders
const localPaths = path.join(__dirname, 'audio-paths.local.js');
const AUDIO_BASES = fs.existsSync(localPaths) ? new Function('window', fs.readFileSync(localPaths, 'utf8') + '; return window.AUDIO_BASES;')({}) : [];
const refs = new Set();
window.LESSONS.forEach((L) => { L.notes.forEach((n) => { if (n.audio) refs.add(n.audio); (n.paradigm || []).forEach((r) => refs.add(r.audio)); }); L.examples.forEach((e) => refs.add(e.audio)); L.reading.sentences.forEach((e) => refs.add(e.audio)); (Array.isArray(L.rule) ? L.rule : L.rule ? [L.rule] : []).forEach((rule) => (rule.compare || []).forEach((c) => c.examples.forEach((e) => refs.add(e.audio)))); });
const unresolved = [...refs].filter((f) => !AUDIO_BASES.some((b) => fs.existsSync(path.join(__dirname, decodeURIComponent(b), f))));
if (AUDIO_BASES.length) t('every audio reference resolves via the mockup base list (' + refs.size + ' files)', unresolved.length === 0);
else console.log('audio path check skipped: no mockup/audio-paths.local.js on this machine');
if (unresolved.length) console.log('unresolved audio:', unresolved.join(', '));

const N = window.LESSONS.length;
t('cards: on Les 1 with nothing done the deck already holds the words of Les 1 (and no later lesson)', byId['cards-stats'].textContent.includes('Карток у колоді: ' + window.LESSONS[0].notes.length));
checkLesson(0);
for (let i = 1; i < N; i++) { byId['next'].onclick(); checkLesson(i); }   // Next lesson > through every lesson
const rows = byId['progress-rows'].children;
t('progress lists every lesson', rows.length === N);
t('progress: previous lessons done, last one current', rows.slice(0, N - 1).every((r) => r.textContent.includes('пройдено')) && rows[N - 1].textContent.includes('поточний'));
t('progress shows exercise results for finished lessons', rows[0].textContent.includes('частин практики виконано'));
t('words page has every lesson', byId['all-words'].children.filter((e) => e.tag === 'h3').length === N);
byId['next'].onclick();               // last lesson: must not crash
// ---- flashcards (every lesson is done at this point, so the deck holds every note once)
const deckSize = window.LESSONS.reduce((n, L) => n + L.notes.length, 0);   // one card per note: the reverse cards are switched off
byId['nav'].listeners.click({ target: { dataset: { view: 'cards' } } });   // open the Cards tab
const stage = () => byId['cards-stage'];
const press = (label) => {
  const b = stage().all().find((e) => e.tag === 'button' && e.textContent.includes(label));
  if (!b) throw new Error('no button: ' + label);
  b.onclick();
};
const reviews = () => window.progressLog.events.filter((e) => e.type === 'card_review');
t('cards: the stats line shows the whole deck', byId['cards-stats'].textContent.includes('Карток у колоді: ' + deckSize));
t('cards: up to 15 new cards a day in one direction', byId['cards-stats'].textContent.includes('нових на сьогодні: 15') && byId['cards-stats'].textContent.includes('сьогодні показано: 0 з 15'));
press('Почати повторення');
t('cards: a card is shown with the session counter', stage().textContent.includes('Залишилось у сесії: 15'));
t('cards: the Dutch word comes first, the meaning is hidden until Space', stage().all().some((e) => e.className === 'fc-text') && !stage().all().some((e) => e.className === 'fc-hr'));
press('Показати відповідь');
t('cards: the rating buttons show when the card would return', stage().textContent.includes('1 · Знову') && stage().textContent.includes('4 · Легко') && /хв|дн/.test(stage().textContent));
t('cards: there is a Next card button after the answer is shown', !!stage().all().find((e) => e.tag === 'button' && e.textContent.includes('Наступна картка')));
press('2 · Важко');
t('cards: choosing a difficulty does not move on: no event, same card, same counter', reviews().length === 0 && stage().textContent.includes('Залишилось у сесії: 15') && stage().textContent.includes('Обрано: Важко'));
press('Наступна картка');
t('cards: Next card writes the chosen difficulty as one card_review event', reviews().length === 1 && reviews()[0].rating === 2 && /:nl-ua$/.test(reviews()[0].card));
t('cards: the session moves on to the next card', stage().textContent.includes('Залишилось у сесії: 14'));
press('Показати відповідь');
t('cards: without a choice the card is announced as Easy', stage().textContent.includes('«Легко»'));
press('Наступна картка');
t('cards: Next card without a chosen difficulty counts as Easy', reviews().length === 2 && reviews()[1].rating === 4);
press('Показати відповідь'); press('1 · Знову'); press('Завершити сесію');
t('cards: ending the session keeps a difficulty that was already chosen', reviews().length === 3 && reviews()[2].rating === 1);
press('Почати повторення'); press('Показати відповідь'); press('Завершити сесію');
t('cards: ending the session does not count a card that was only looked at', reviews().length === 3);
press('Почати повторення');
for (let i = 0; i < 12; i++) { press('Показати відповідь'); press('Наступна картка'); }
t('cards: after 15 cards the daily allowance of the direction ends the session', stage().textContent.includes('Готово: переглянуто карток 12') && stage().textContent.includes('Норму виконано') && reviews().length === 15);
t('cards: the same word never comes back in the session (fifteen different cards, all Dutch -> Ukrainian)', new Set(reviews().map((e) => e.card)).size === 15 && reviews().every((e) => /:nl-ua$/.test(e.card)));
t('cards: the finished screen offers "Хочу ще"', !!stage().all().find((e) => e.tag === 'button' && e.textContent.includes('Хочу ще')));
t('cards: the stats now show no new cards for today', byId['cards-stats'].textContent.includes('нових на сьогодні: 0'));
press('Закрити');
t('cards: back on the start screen it says today\'s allowance is done', stage().textContent.includes('Норму на сьогодні виконано'));

// ---- two directions: Dutch -> Ukrainian (done above) and Ukrainian -> Dutch, each with its own allowance and schedule
byId['cards-dir'].listeners.click({ target: { dataset: { dir: 'ua-nl' } } });
t('cards: the reverse direction has its own statistics and its own daily 15', byId['cards-stats'].textContent.includes('Карток у колоді: ' + deckSize) && byId['cards-stats'].textContent.includes('нових на сьогодні: 15') && byId['cards-stats'].textContent.includes('сьогодні показано: 0 з 15'));
t('cards: the choice of direction is remembered', storage.get('cardsDir') === 'ua-nl');
press('Почати повторення');
t('cards: in the reverse direction the Ukrainian side comes first (a type label under it)', stage().all().some((e) => e.className === 'fc-sub'));
press('Показати відповідь'); press('Наступна картка');
const rev = () => reviews().filter((e) => /:ua-nl$/.test(e.card));
t('cards: a reverse review is written to the log as ua-nl', rev().length === 1);
t('cards: the reverse card is of a word already seen in the Dutch -> Ukrainian direction', reviews().some((e) => e.card === rev()[0].card.replace(':ua-nl', ':nl-ua')));
press('Показати відповідь'); press('2 · Важко');
byId['cards-dir'].listeners.click({ target: { dataset: { dir: 'nl-ua' } } });
t('cards: switching direction ends the session and keeps the difficulty already chosen', rev().length === 2 && reviews()[reviews().length - 1].rating === 2);
t('cards: back in Dutch -> Ukrainian the start screen shows and its own allowance is still used up', stage().textContent.includes('Норму на сьогодні виконано') && byId['cards-stats'].textContent.includes('нових на сьогодні: 0'));
t('cards: the fifteen Dutch -> Ukrainian reviews are untouched by the reverse ones', reviews().filter((e) => /:nl-ua$/.test(e.card)).length === 15);

// ---- "Хочу ще": one more portion of 15 today, in the direction that is open
const moreEvents = (dir) => window.progressLog.events.filter((e) => e.type === 'cards_more' && e.dir === dir);
t('cards: with the allowance used up the start screen offers "Хочу ще" and no normal start', !!stage().all().find((e) => e.tag === 'button' && e.textContent.includes('Хочу ще')) && !stage().all().find((e) => e.tag === 'button' && e.textContent === 'Почати повторення'));
press('Хочу ще');
t('cards: "Хочу ще" writes one cards_more event for the open direction only', moreEvents('nl-ua').length === 1 && moreEvents('ua-nl').length === 0);
t('cards: and starts a fresh portion of 15 in the same direction', stage().textContent.includes('Залишилось у сесії: 15'));
t('cards: the statistics show the widened day (30 for this direction)', byId['cards-stats'].textContent.includes('сьогодні показано: 15 з 30'));
press('Показати відповідь'); press('Наступна картка');
t('cards: the extra card is a Dutch -> Ukrainian card, the 16th of the day in this direction', /:nl-ua$/.test(reviews()[reviews().length - 1].card) && reviews().filter((e) => /:nl-ua$/.test(e.card)).length === 16);
press('Завершити сесію');

// ---- saved answers, previous lesson, reset (every lesson is done and the last one is open here)
const lastL = window.LESSONS[N - 1], evs = () => window.progressLog.events;
const doneEvents = (id) => evs().filter((e) => e.type === 'lesson_done' && e.lesson === id);
t('lesson_done is recorded once per lesson', doneEvents(lastL.id).length === 1);
byId['next'].onclick();
t('Next on a lesson that is already done does not record it again', doneEvents(lastL.id).length === 1);
byId['prev'].onclick();
t('Previous opens the lesson before', byId['lesson-label'].textContent === 'Les ' + window.LESSONS[N - 2].order);
const restored = byId['b4-body'].children.every((box) => {
  const inputs = box.querySelectorAll('[data-acc]');
  const result = box.all().find((e) => e.className === 'result');
  return inputs.length && inputs.every((x) => x.value === 'xxx' && x.classList.contains('bad')) && result.classList.contains('show') && result.textContent === `Вірно: 0 з ${inputs.length}`;
});
t('a lesson that was worked through comes back with its saved answers and results (dictation included)', restored);
for (let i = 0; i < N; i++) byId['prev'].onclick();
t('Previous stops at Les 1 and is hidden there', byId['lesson-label'].textContent === 'Les 1' && byId['prev'].classList.contains('invisible'));
byId['next'].onclick(); t('Previous button shows again after Les 1', !byId['prev'].classList.contains('invisible'));
byId['prev'].onclick();
// an attempt logged before answers were stored: the wrong answer is known, a right one is filled from the accepted list
const firstTotal = byId['b4-body'].children[0].querySelectorAll('[data-acc]').length;
window.progressLog.record({ type: 'exercise_checked', lesson: window.LESSONS[0].id, exercise: 0, kind: 'translate', ok: firstTotal - 1, total: firstTotal, wrong: [{ n: 0, answer: 'foo', expected: 'x' }] });
byId['next'].onclick(); byId['prev'].onclick();
const oldInputs = byId['b4-body'].children[0].querySelectorAll('[data-acc]');
t('an old attempt without stored answers still restores what it can', oldInputs[0].value === 'foo' && oldInputs[0].classList.contains('bad') && oldInputs[1].classList.contains('ok'));
byId['reset'].onclick();
const st = window.progressLog.state();
t('reset: the lesson is no longer done', !st.lessons[window.LESSONS[0].id]);
t('reset: its exercises are blank again', byId['b4-body'].querySelectorAll('[data-acc]').every((x) => x.value === '' && !x.classList.contains('bad')));
t('reset: other lessons keep their saved answers', !!st.exercises[window.LESSONS[1].id + '#0'] && !!st.lessons[window.LESSONS[1].id]);
t('reset: the log keeps the old events, nothing is deleted', evs().some((e) => e.type === 'exercise_checked' && e.lesson === window.LESSONS[0].id) && evs().some((e) => e.type === 'lesson_reset'));

// ---- the reading recording is part of the practice: without it a lesson cannot reach 100%
const firstL = window.LESSONS[0];
const rowOf = (L) => byId['progress-rows'].children.find((r) => r.textContent.includes(`Les ${L.order}`));
window.progressLog.record({ type: 'lesson_reset', lesson: firstL.id });
firstL.practice.forEach((ex, k) => window.progressLog.record({ type: 'exercise_checked', lesson: firstL.id, exercise: k, kind: ex.type, ok: 4, total: 4, wrong: [], answers: [] }));
t('reading: every exercise perfect but no recording is not 100%', !rowOf(firstL).textContent.includes('100%') && rowOf(firstL).textContent.includes('немає запису читання'));
t('reading: the open lesson says the recording is still missing', byId['reading-status'].textContent.includes('ще не надіслано'));
window.progressLog.record({ type: 'recording_saved', lesson: firstL.id, file: 'les-01-x.webm' });
t('reading: with the recording sent the same lesson reaches 100%', rowOf(firstL).textContent.includes('100%') && !rowOf(firstL).textContent.includes('немає запису читання'));
t('reading: the status line shows it was sent', byId['reading-status'].textContent.includes('запис надіслано'));
byId['reset'].onclick();
t('reading: a reset makes the recording count as missing again', !rowOf(firstL).textContent.includes('100%') && byId['reading-status'].textContent.includes('ще не надіслано'));

// ---- the open lesson survives a reload: it is remembered every time the learner moves between lessons
byId['next'].onclick(); byId['next'].onclick(); byId['prev'].onclick(); byId['prev'].onclick();
t('the lesson you moved to with Previous is the remembered one', storage.get('currentLesson') === window.LESSONS[0].id);
byId['next'].onclick();
t('...and after Next it is the next one', storage.get('currentLesson') === window.LESSONS[1].id);
byId['prev'].onclick();

console.log(bad ? `FAILURES: ${bad}` : 'SMOKE TEST PASSED');
process.exit(bad ? 1 : 0);
