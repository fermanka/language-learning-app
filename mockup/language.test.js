// Tests for the multi-language seams: how words are written, the validator's per-language rules.
// Run: node mockup/language.test.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { display, pluralText, sentenceOf, splitTerms } = require('./lesson.js');

const fixture = path.join(__dirname, '..', 'docs', 'lang-example');
const lesson = JSON.parse(fs.readFileSync(path.join(fixture, 'hr', 'lessons', 'les-01.json'), 'utf8'));
const noun = lesson.notes.find((n) => n.type === 'noun'), verb = lesson.notes.find((n) => n.type === 'verb');
let n = 0;
const t = (name, fn) => { fn(); n++; };

// Dutch notes keep the way they were written
t('dutch noun keeps its article', () => assert.strictEqual(display({ type: 'noun', article: 'het', lemma: 'huis' }), 'het huis'));
t('dutch plural hint unchanged', () => assert.strictEqual(pluralText({ type: 'noun', article: 'het', lemma: 'huis', plural: ['huizen'] }), '(de huizen)'));
// A noun with no article is the bare lemma; the hint line carries gender, genitive and plural
t('croatian noun is shown as the bare lemma', () => assert.strictEqual(display(noun), 'kuća'));
t('croatian noun hint has gender, genitive singular and plural', () => assert.strictEqual(pluralText(noun), '(ž., G. kuće, мн. kuće)'));
t('croatian plural-only noun says so', () => assert.strictEqual(pluralText({ type: 'noun', lemma: 'vrata', gender: 's.', gen_sg: 'vrata', plural_only: true }), '(s., G. vrata, тільки мн.)'));
t('croatian verb hint has aspect, partner and 1st person', () => assert.strictEqual(pluralText(verb), '(impf. / napisati, pišem)'));
t('a verb without a partner (no aspect pair) has no slash', () => assert.strictEqual(pluralText({ type: 'verb', lemma: 'biti', aspect: 'biaspectual', pres_1sg: 'jesam' }), '(biaspectual, jesam)'));
// Declined forms listed in "forms" are found in a sentence
t('a declined form is highlighted in a sentence', () => assert.ok(splitTerms('Živim u kući.', [noun]).some((p) => p.note === noun && p.text === 'kući')));
// Sentences: "text" for new languages, "nl" for the first
t('sentence key text', () => assert.strictEqual(sentenceOf({ text: 'Ovo je kuća.' }), 'Ovo je kuća.'));
t('sentence key nl', () => assert.strictEqual(sentenceOf({ nl: 'Dit is een huis.' }), 'Dit is een huis.'));

// Validator, run against the example folder (CONTENT_DIR) and against broken copies of it
const run = (dir) => spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'validate-content.js'), 'hr'], { env: { ...process.env, CONTENT_DIR: dir }, encoding: 'utf8' });
const ok = run(fixture);
t('validator accepts the example language folder', () => assert.strictEqual(ok.status, 0, ok.stderr));
t('validator audits the sentences of a language without the "nl" key', () => assert.ok(/level audit: every word is inside/.test(ok.stdout), ok.stdout));

function broken(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lang-test-'));
  fs.mkdirSync(path.join(dir, 'hr', 'lessons'), { recursive: true });
  fs.copyFileSync(path.join(fixture, 'hr', 'config.json'), path.join(dir, 'hr', 'config.json'));
  const L = JSON.parse(JSON.stringify(lesson));
  mutate(L);
  fs.writeFileSync(path.join(dir, 'hr', 'lessons', 'les-01.json'), JSON.stringify(L));
  const r = run(dir);
  fs.rmSync(dir, { recursive: true, force: true });
  return r;
}
t('validator rejects a gender outside the allowed values', () => { const r = broken((L) => { L.notes[0].gender = 'x'; }); assert.strictEqual(r.status, 1); assert.ok(/"gender" is "x"/.test(r.stderr), r.stderr); });
t('validator rejects a noun without genitive singular', () => { const r = broken((L) => { delete L.notes[0].gen_sg; }); assert.strictEqual(r.status, 1); assert.ok(/missing required field "gen_sg"/.test(r.stderr), r.stderr); });
t('validator rejects a note id with another language prefix', () => { const r = broken((L) => { L.notes[0].id = 'nl-0000000a'; L.reading.highlight = ['nl-0000000a']; }); assert.strictEqual(r.status, 1); assert.ok(/bad note id/.test(r.stderr), r.stderr); });
t('validator warns about a word that was never taught', () => { const r = broken((L) => { L.examples[0].text = 'Ovo je velika kuća.'; }); assert.strictEqual(r.status, 0); assert.ok(/"velika"/.test(r.stdout), r.stdout); });
t('forms make an inflected word count as taught', () => { const r = broken((L) => { L.examples[0].text = 'Ja sam u kući.'; L.service_words.push('ja', 'sam', 'u'); }); assert.ok(!/"kući"/.test(r.stdout), r.stdout); });
console.log(`language tests: ${n} passed`);
