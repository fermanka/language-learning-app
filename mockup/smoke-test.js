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
  setAttribute() {}
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((c) => c !== this); }
  addEventListener(type, fn) { (this.listeners = this.listeners || {})[type] = fn; }
  all() { return this.children.flatMap((c) => (c instanceof El ? [c, ...c.all()] : [])); }
  querySelectorAll(sel) { return this.all().filter((e) => (sel === 'input[data-acc]' || sel === '[data-acc]' ? e.dataset.acc !== undefined : sel.startsWith('.') ? e.className.split(' ').includes(sel.slice(1)) : false)); }
}
const byId = {};
const ids = ['pstore', 'pstore-text', 'pstore-btn', 'cards-stats', 'cards-stage', 'cards-dir', 'nav', 'toast', 'lesson-label', 'b1-rule', 'b1-verbs', 'b1-words', 'b1-service', 'b1-service-line', 'b2-list', 'reading-title', 'reading-title-2', 'b3-text', 'texts-copy', 'b4-body', 'progress-rows', 'all-words', 'check-box', 'tenses-intro', 'tenses-title', 'tenses-check', 'tenses-table', 'tenses-points', 'tenses-chips', 'tenses-input', 'tenses-verbs', 'tenses-msg', 'next', 'prev', 'reset', 'upload-btn', 'upload-file', 'upload-note', 'reading-status', 'b5-extra', 'b6-story'];
ids.forEach((id) => { byId[id] = new El('div'); });
global.window = { scrollTo() {}, LESSONS: fs.readdirSync(path.join(__dirname, '..', 'content', 'nl', 'lessons')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'nl', 'lessons', f), 'utf8'))) };
global.document = { getElementById: (id) => { if (!byId[id]) throw new Error('page is missing element #' + id); return byId[id]; }, createElement: (t) => new El(t), createTextNode: (t) => new Text(t), querySelectorAll: () => [], body: new El('body'), documentElement: { setAttribute() {} } };
global.Audio = class { play() { return Promise.resolve(); } };
global.confirm = () => true;
const storage = new Map();
global.localStorage = { getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) };

// two synthetic "check" flags (a noun in the first lesson, a verb in the first lesson that has one), to test the "?" marks
window.LESSONS[0].notes.find((n) => n.type === 'noun').check = 'TEST-NOUN reason';
window.LESSONS.find((L) => L.notes.some((n) => n.type === 'verb')).notes.find((n) => n.type === 'verb').check = 'TEST-VERB reason';

window.ProgressStore = require('./progress-store.js');
window.FSRS = require('ts-fsrs');
window.Cards = require('./cards.js');
window.ExtraPractice = require('./extra-practice.js');
window.Story = require('./story.js');
window.Tenses = require('./tenses.js');   // the tenses tab, tested with the example data (the real files are written by the teacher)
window.TENSES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'verbs-example', 'tenses.json'), 'utf8'));
window.VERBS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'verbs-example', 'verbs.json'), 'utf8'));
require('./lesson.js');

let bad = 0;
const t = (name, ok) => { if (!ok) { bad++; console.log('FAIL', name); } };
const buttons = (root, label) => root.all().filter((e) => e.tag === 'button' && e.textContent === label);

function checkLesson(idx) {
  const L = window.LESSONS[idx];
  t(`lesson ${L.order}: label`, byId['lesson-label'].textContent === `Les ${L.order}`);
  t(`lesson ${L.order}: rule card ${L.rule ? 'present' : 'absent'}`, (byId['b1-rule'].children.length > 0) === !!L.rule);
  t(`lesson ${L.order}: every example has an audio button`, byId['b2-list'].children.every((li) => li.all().some((e) => e.className === 'icon')));
  // a lesson whose notes are all verbs (Les 32) highlights nothing in the reading, and must still render
  t(`lesson ${L.order}: reading terms highlighted iff the lesson lists highlights`, byId['b3-text'].all().some((e) => e.className === 'term') === (L.reading.highlight.length > 0));
  const marks = byId['b1-words'].all().concat(byId['b1-verbs'].all()).filter((e) => e.className === 'qmark');
  t(`lesson ${L.order}: one "?" per flagged word (${L.notes.filter((n) => n.check).length})`, marks.length === L.notes.filter((n) => n.check).length);
  t(`lesson ${L.order}: service line hidden iff no service words`, byId['b1-service-line'].hidden === !(L.service_words || []).length);

  const exercises = byId['b4-body'].children;
  t(`lesson ${L.order}: ${L.practice.length} exercises rendered`, exercises.length === L.practice.length);
  // cue on screen: transform and verbform need it (it is the task); translate must not show it (it gives the answer away)
  L.practice.forEach((ex, i) => {
    if (!['translate', 'transform', 'verbform'].includes(ex.type)) return;
    const cues = exercises[i].all().filter((e) => e.className === 'cue').length;
    const expected = ex.type === 'translate' ? 0 : ex.items.length;
    t(`lesson ${L.order} ex ${i + 1} (${ex.type}): ${expected} cues shown`, cues === expected);
  });
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
const chips = () => byId['all-words'].all().filter((e) => e.className.split(' ').includes('lesson-chip'));
const wordsHeading = () => byId['all-words'].children.filter((e) => e.tag === 'h3').map((e) => e.textContent).join();
const wordCount = () => byId['all-words'].children.filter((e) => e.tag === 'ul').reduce((n, ul) => n + ul.children.length, 0);
t('words page: one button per lesson, labelled Les N', chips().length === N && chips().every((c, i) => c.textContent === `Les ${window.LESSONS[i].order}`));
t('words page: it starts on the newest lesson, only that one is active', wordsHeading() === `Les ${window.LESSONS[N - 1].order}` && chips().filter((c) => c.className.includes('active')).length === 1 && chips()[N - 1].className.includes('active'));
t('words page: only the words of the chosen lesson are listed', wordCount() === window.LESSONS[N - 1].notes.length);
chips()[0].onclick();
t('words page: choosing a lesson shows that lesson and marks its button', wordsHeading() === `Les ${window.LESSONS[0].order}` && wordCount() === window.LESSONS[0].notes.length && chips()[0].className.includes('active') && !chips()[N - 1].className.includes('active'));
// the "?" marks on the Words page: one per flagged word of the chosen lesson, a click shows the reason
const qmarks = () => byId['all-words'].all().filter((e) => e.className === 'qmark');
const reasons = () => byId['all-words'].all().filter((e) => e.className.split(' ').includes('check-note'));
window.LESSONS.forEach((L, i) => { chips()[i].onclick(); t(`words page Les ${L.order}: one "?" per flagged word`, qmarks().length === L.notes.filter((n) => n.check).length && reasons().length === qmarks().length); });
chips()[0].onclick();
t('words page: a reason is hidden until the "?" is clicked, then shown, then hidden again', reasons()[0].hidden === true && (qmarks()[0].onclick(), reasons()[0].hidden === false) && reasons()[0].textContent.includes('TEST-NOUN reason') && (qmarks()[0].onclick(), reasons()[0].hidden === true));
// the list at the bottom of the Words page
const flaggedAll = window.LESSONS.flatMap((L) => L.notes.filter((n) => n.check));
const openBtn = byId['check-box'].all().find((e) => e.tag === 'button');
const checkPanel = byId['check-box'].all().find((e) => e.className === 'check-panel');
t('check list: the button shows how many words are marked', !!openBtn && openBtn.textContent.includes(`(${flaggedAll.length})`) && flaggedAll.some((n) => n.check === 'TEST-NOUN reason') && flaggedAll.some((n) => n.check === 'TEST-VERB reason'));
t('check list: it starts closed', checkPanel.hidden === true);
openBtn.onclick();
t('check list: the button opens it and every reason is in it', checkPanel.hidden === false && flaggedAll.every((n) => checkPanel.textContent.includes(n.check)));
openBtn.onclick();
t('check list: the button closes it again', checkPanel.hidden === true);
chips()[N - 1].onclick();
byId['next'].onclick();               // last lesson: must not crash
// ---- tenses tab (all lessons are done at this point)
const tRows = () => byId['tenses-table'].children.slice(1);   // the first row is the header
const cellsOf = (tr) => tr.children.slice(2).map((c) => c.textContent);   // the first cell is the tick box, the second the tense name
byId['nav'].listeners.click({ target: { dataset: { view: 'tenses' } } });   // open the Tenses tab
t('tenses: the default verb is shown', byId['tenses-title'].textContent.startsWith('werken'));
t('tenses: one header row and one row per tense', byId['tenses-table'].children.length === 1 + window.TENSES.tenses.length);
t('tenses: the header lists the six persons', byId['tenses-table'].children[0].children.slice(2).map((c) => c.textContent).join() === window.TENSES.persons.map((p) => p.label).join());
t('tenses: a tense is greyed out when it is not taught yet and normal when its lesson is done', tRows().every((tr, i) => tr.className.split(' ').includes('later') === (window.TENSES.tenses[i].since_lesson === null)));
t('tenses: the perfect row of the default verb', cellsOf(tRows()[2]).join() === 'heb gewerkt,hebt gewerkt,heeft gewerkt,hebben gewerkt,hebben gewerkt,hebben gewerkt');
t('tenses: the intro and the quick buttons are filled', byId['tenses-intro'].textContent === window.TENSES.intro_ua && byId['tenses-chips'].children.map((b) => b.textContent).join() === 'gaan,eten,opstaan' && byId['tenses-verbs'].children.length === window.VERBS.verbs.length);
const typeVerb = (v) => { byId['tenses-input'].value = v; byId['tenses-input'].listeners.input(); };
typeVerb('gaan');
t('tenses: typing a verb of the list rebuilds the table', byId['tenses-title'].textContent.startsWith('gaan') && cellsOf(tRows()[2])[0] === 'ben gegaan' && byId['tenses-msg'].hidden === true);
typeVerb('zwemmen');
t('tenses: a verb that is not in the list is refused and the table stays', byId['tenses-msg'].hidden === false && byId['tenses-msg'].textContent.includes('zwemmen') && byId['tenses-title'].textContent.startsWith('gaan'));
typeVerb('');
t('tenses: an empty field clears the message', byId['tenses-msg'].hidden === true);
byId['tenses-chips'].children.find((b) => b.textContent === 'opstaan').onclick();
t('tenses: a quick button fills the field and shows the verb', byId['tenses-input'].value === 'opstaan' && byId['tenses-title'].textContent.startsWith('opstaan') && cellsOf(tRows()[0])[0] === 'sta op' && cellsOf(tRows()[2])[0] === 'ben opgestaan');
typeVerb('eten');
t('tenses: a verb with a check reason shows a "?" and a hidden reason', byId['tenses-title'].all().some((e) => e.className === 'qmark') && byId['tenses-check'].all().some((e) => e.className.split(' ').includes('check-note') && e.hidden === true));
typeVerb('gaan');
t('tenses: a verb without a check reason shows no "?"', !byId['tenses-title'].all().some((e) => e.className === 'qmark') && byId['tenses-check'].children.length === 0);

const tick = (i) => tRows()[i].children[0].children[0];
t('tenses: every tense has a tick box, all ticked at first, and no tense is folded', tRows().every((tr, i) => tick(i).type === 'checkbox' && tick(i).checked === true) && tRows().every((tr) => !tr.className.split(' ').includes('off')));
tick(1).checked = false; tick(1).onchange();
t('tenses: unticking folds that tense (only the name stays) and remembers it', tRows()[1].className.split(' ').includes('off') && !tRows()[0].className.split(' ').includes('off') && localStorage.getItem('tensesHidden') === JSON.stringify([window.TENSES.tenses[1].id]));
typeVerb('werken');
t('tenses: a folded tense stays folded and unticked when another verb is chosen', tRows()[1].className.split(' ').includes('off') && tick(1).checked === false && tick(0).checked === true);
tick(3).checked = false; tick(3).onchange();
t('tenses: several tenses can be folded, and a tense that is greyed keeps both marks', tRows()[3].className.split(' ').includes('off') && tRows()[3].className.split(' ').includes('later') && JSON.parse(localStorage.getItem('tensesHidden')).length === 2);
tick(1).checked = true; tick(1).onchange(); tick(3).checked = true; tick(3).onchange();
t('tenses: ticking again shows the tense and forgets the choice', tRows().every((tr) => !tr.className.split(' ').includes('off')) && localStorage.getItem('tensesHidden') === '[]');

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

// ---- the deck follows the open lesson; a running card session ends when another lesson is opened
press('Почати повторення');
t('cards: a session is running', stage().textContent.includes('Залишилось у сесії'));
byId['prev'].onclick();
t('cards: opening another lesson ends the running session', !stage().textContent.includes('Залишилось у сесії'));
byId['next'].onclick();

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
byId['nav'].listeners.click({ target: { dataset: { view: 'cards' } } });
t('cards: with Les 1 open the deck holds the words of Les 1 only, although every lesson is done', byId['cards-stats'].textContent.includes('Карток у колоді: ' + window.LESSONS[0].notes.length + ' ') );
byId['nav'].listeners.click({ target: { dataset: { view: 'today' } } });
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

// ---- the upload note must follow the OPEN lesson, never keep showing a file uploaded for a different one
const secondL = window.LESSONS[1];
byId['next'].onclick();   // move to secondL, which has no recording yet
window.progressLog.record({ type: 'recording_saved', lesson: secondL.id, file: 'les-02-y.webm' });
t('upload note: shows the file just saved for the open lesson', byId['upload-note'].textContent.includes('les-02-y.webm'));
byId['prev'].onclick();   // back to firstL, which has no recording (it was reset above)
t('upload note: leaving the lesson drops the other lesson\'s file name', !byId['upload-note'].textContent.includes('les-02-y.webm'));
byId['next'].onclick();   // reopen secondL
t('upload note: its own file name is shown again when the lesson reopens', byId['upload-note'].textContent.includes('les-02-y.webm'));
byId['prev'].onclick();   // back to firstL for the next block

// ---- the open lesson survives a reload: it is remembered every time the learner moves between lessons
byId['next'].onclick(); byId['next'].onclick(); byId['prev'].onclick(); byId['prev'].onclick();
t('the lesson you moved to with Previous is the remembered one', storage.get('currentLesson') === window.LESSONS[0].id);
byId['next'].onclick();
t('...and after Next it is the next one', storage.get('currentLesson') === window.LESSONS[1].id);
byId['prev'].onclick();

// ---- extra practice: the teacher's personalised set, read from the learner's folder (stubbed here)
(async () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const sample = require('../docs/extra-practice-example/extra/nl/les-05.json');
  const L0 = window.LESSONS[0];
  const extraBox = () => byId['b5-extra'];
  const exBoxes = () => extraBox().children.filter((c) => c.className === 'ex');
  let served = (id) => ({ data: { ...sample, lesson: id } });
  window.progressLog.store = { readExtra: async (id) => served(id) };
  byId['next'].onclick(); byId['prev'].onclick(); await flush();   // reopen Les 1 with a folder connected
  t('extra: the block appears under the practice, after the lesson exercises', extraBox().textContent.includes('Додаткова практика') && exBoxes().length === sample.exercises.length && byId['b4-body'].children.length === L0.practice.length);
  const rowText = () => byId['progress-rows'].children[0].textContent;   // the row of Les 1
  const rowBefore = rowText();
  const first = exBoxes()[0], inputs = first.querySelectorAll('[data-acc]');
  inputs.forEach((inp) => { inp.value = JSON.parse(inp.dataset.acc)[0]; });
  buttons(first, 'Перевірити')[0].onclick();
  t('extra: an answer is logged under the extra exercise id', window.progressLog.events.some((e) => e.type === 'exercise_checked' && e.lesson === L0.id && e.exercise === `x:${sample.exercises[0].id}` && e.ok === inputs.length));
  t('extra: answering an extra exercise does not change the lesson percentage', rowText() === rowBefore);
  byId['next'].onclick(); byId['prev'].onclick(); await flush();
  t('extra: the saved answer is restored when the lesson reopens', exBoxes()[0].querySelectorAll('[data-acc]').every((i) => i.classList.contains('ok')));
  served = () => null;
  byId['next'].onclick(); await flush();
  t('extra: no file for a lesson means no block at all', extraBox().children.length === 0);
  served = (id) => ({ data: { lesson: 'nl-les-99', exercises: [] } });
  byId['prev'].onclick(); await flush();
  t('extra: a broken file is reported, not rendered', extraBox().textContent.includes('має помилки') && exBoxes().length === 0);
  served = () => ({ error: 'the file is not valid JSON' });
  byId['next'].onclick(); await flush();
  t('extra: an unreadable file is reported', extraBox().textContent.includes('не вдалося прочитати'));
  window.progressLog.store = null;

  // ---- free writing: the teacher's topic is read from the folder, the text is saved for her as a file, nothing is marked
  const storySample = require('../docs/story-example/stories/nl/les-11.json');
  const storyBox = () => byId['b6-story'];
  const saved = [];
  let storyServed = (id) => ({ data: { ...storySample, lesson: id } });
  window.progressLog.store = { readStory: async (id) => storyServed(id), saveWritten: async (name, text) => { saved.push({ name, text }); return name; } };
  byId['prev'].onclick(); await flush();   // the extra-practice checks above ended on Les 2: back to Les 1
  const area = () => storyBox().all().find((e) => e.tag === 'textarea');
  const sendBtn = () => buttons(storyBox(), 'Надіслати Марійке')[0];
  t('story: the topic block appears with the topic and a text field', storyBox().textContent.includes('Історія') && storyBox().textContent.includes(storySample.topic_ua) && !!area());
  t('story: the checklist of targets is shown', storySample.targets_ua.every((x) => storyBox().textContent.includes(x)));
  t('story: sending is blocked below the minimum', sendBtn().disabled === true && storyBox().textContent.includes(`Речень: 0 з ${storySample.min_sentences}`));
  area().value = 'Ik eet kaas. Het is lekker.'; area().listeners.input();
  t('story: the counter follows what she types', storyBox().textContent.includes(`Речень: 2 з ${storySample.min_sentences}`) && sendBtn().disabled === true);
  t('story: the unsent draft is remembered in the browser', storage.get(`storyDraft:${window.LESSONS[0].id}`) === area().value);
  area().value = 'Ik eet kaas. Het is lekker. Ik koop kaas. Ik heb geen brood. Dus eet ik kaas.'; area().listeners.input();
  const storyRow = () => byId['progress-rows'].children[0].textContent;
  const storyRowBefore = storyRow();
  t('story: enough sentences unlock the button', sendBtn().disabled === false);
  await sendBtn().onclick(); await flush();
  t('story: the text is saved as a file with the topic on top', saved.length === 1 && saved[0].text.startsWith(storySample.topic_ua) && saved[0].text.includes('Dus eet ik kaas.'));
  t('story: the sending is logged with its file and the number of sentences', window.progressLog.events.some((e) => e.type === 'story_submitted' && e.lesson === window.LESSONS[0].id && e.file === saved[0].name && e.sentences === 5));
  t('story: writing does not change the lesson percentage', storyRow() === storyRowBefore);
  t('story: the draft is cleared after sending', !storage.get(`storyDraft:${window.LESSONS[0].id}`));
  byId['next'].onclick(); byId['prev'].onclick(); await flush();
  t('story: reopening shows that it was sent', storyBox().textContent.includes('Надіслано') && storyBox().textContent.includes(saved[0].name));
  storyServed = () => null;
  byId['next'].onclick(); await flush();
  t('story: no file for a lesson means no block at all', storyBox().children.length === 0);
  storyServed = () => ({ data: { lesson: 'nl-les-99', topic_ua: 'x', min_sentences: 5 } });
  byId['prev'].onclick(); await flush();
  t('story: a broken file is reported, not rendered', storyBox().textContent.includes('має помилки') && !area());
  storyServed = () => ({ error: 'the file is not valid JSON' });
  byId['next'].onclick(); await flush();
  t('story: an unreadable file is reported', storyBox().textContent.includes('не вдалося прочитати'));
  window.progressLog.store = null;

  console.log(bad ? `FAILURES: ${bad}` : 'SMOKE TEST PASSED');
  process.exit(bad ? 1 : 0);
})();
