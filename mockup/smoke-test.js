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
const ids = ['pstore', 'pstore-text', 'pstore-btn', 'cards-stats', 'cards-stage', 'nav', 'toast', 'lesson-label', 'b1-rule', 'b1-verbs', 'b1-words', 'b1-service', 'b1-service-line', 'b2-list', 'reading-title', 'reading-title-2', 'b3-text', 'texts-copy', 'b4-body', 'progress-rows', 'all-words', 'next', 'upload-btn', 'upload-file', 'upload-note'];
ids.forEach((id) => { byId[id] = new El('div'); });
global.window = { scrollTo() {}, LESSONS: fs.readdirSync(path.join(__dirname, '..', 'content', 'nl', 'lessons')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'nl', 'lessons', f), 'utf8'))) };
global.document = { getElementById: (id) => { if (!byId[id]) throw new Error('page is missing element #' + id); return byId[id]; }, createElement: (t) => new El(t), createTextNode: (t) => new Text(t), querySelectorAll: () => [], body: new El('body'), documentElement: { setAttribute() {} } };
global.Audio = class { play() { return Promise.resolve(); } };

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
checkLesson(0);
for (let i = 1; i < N; i++) { byId['next'].onclick(); checkLesson(i); }   // Next lesson > through every lesson
const rows = byId['progress-rows'].children;
t('progress lists every lesson', rows.length === N);
t('progress: previous lessons done, last one current', rows.slice(0, N - 1).every((r) => r.textContent.includes('пройдено')) && rows[N - 1].textContent.includes('поточний'));
t('progress shows exercise results for finished lessons', rows[0].textContent.includes('вправ перевірено'));
t('words page has every lesson', byId['all-words'].children.filter((e) => e.tag === 'h3').length === N);
byId['next'].onclick();               // last lesson: must not crash
// ---- flashcards (every lesson is done at this point, so the deck holds every note twice)
const deckSize = window.LESSONS.reduce((n, L) => n + L.notes.length, 0) * 2;
byId['nav'].listeners.click({ target: { dataset: { view: 'cards' } } });   // open the Cards tab
const stage = () => byId['cards-stage'];
const press = (label) => {
  const b = stage().all().find((e) => e.tag === 'button' && e.textContent.includes(label));
  if (!b) throw new Error('no button: ' + label);
  b.onclick();
};
const reviews = () => window.progressLog.events.filter((e) => e.type === 'card_review');
t('cards: the stats line shows the whole deck', byId['cards-stats'].textContent.includes('Карток у колоді: ' + deckSize));
t('cards: new cards are capped at 10 a day', byId['cards-stats'].textContent.includes('нових на сьогодні: 10'));
press('Почати повторення');
t('cards: a card is shown with the session counter', stage().textContent.includes('Залишилось у сесії: 30'));
press('Показати відповідь');
t('cards: the rating buttons show when the card would return', stage().textContent.includes('1 · Знову') && stage().textContent.includes('4 · Легко') && /хв|дн/.test(stage().textContent));
press('3 · Добре');
t('cards: one rating is one appended card_review event', reviews().length === 1 && reviews()[0].rating === 3 && /:nl-ua$/.test(reviews()[0].card));
t('cards: the session moves on to the next card', stage().textContent.includes('Залишилось у сесії: 29'));
for (let i = 0; i < 9; i++) { press('Показати відповідь'); press('3 · Добре'); }
t('cards: after 10 new cards the daily cap ends the session', stage().textContent.includes('Готово: переглянуто карток 10'));
t('cards: the stats now show no new cards for today', byId['cards-stats'].textContent.includes('нових на сьогодні: 0'));
press('Закрити');
t('cards: back on the start screen', !!stage().all().find((e) => e.tag === 'button' && e.textContent.includes('Почати повторення')));

console.log(bad ? `FAILURES: ${bad}` : 'SMOKE TEST PASSED');
process.exit(bad ? 1 : 0);
