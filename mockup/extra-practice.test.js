// Tests for the teacher's extra practice: file format, reading it from the learner's folder, and the teacher's digest.
// Run: node mockup/extra-practice.test.js
const { validateExtra, sentencesOf } = require('./extra-practice.js');
const { FolderStore, extraLocation } = require('./progress-store.js');
const { buildDigest } = require('../scripts/progress-digest.js');
const sample = require('../docs/extra-practice-example/extra/nl/les-05.json');

let bad = 0;
const t = (name, ok) => { if (!ok) { bad++; console.log('FAIL', name); } };
const clone = (o) => JSON.parse(JSON.stringify(o));
const errs = (mutate) => { const d = clone(sample); mutate(d); return validateExtra(d, 'nl-les-05').errors.join(' | '); };

// ---- format
const ok = validateExtra(sample, 'nl-les-05');
t('the documented example is valid', ok.errors.length === 0 && ok.exercises.length === sample.exercises.length);
const short = clone(sample); short.exercises = short.exercises.slice(0, 1);
const shortRes = validateExtra(short, 'nl-les-05');
t('a short set gets a warning, not an error', shortRes.errors.length === 0 && shortRes.warnings.length === 1 && shortRes.warnings[0].includes('10-20'));
t('a set of 10-20 items gets no warning', ok.warnings.length === 0);
t('a file for another lesson is refused', validateExtra(sample, 'nl-les-06').errors.some((e) => e.includes('"lesson"')));
t('not an object is refused', validateExtra([], 'nl-les-05').errors.length === 1 && validateExtra(null, 'nl-les-05').errors.length === 1);
t('an empty exercise list is refused', errs((d) => { d.exercises = []; }).includes('non-empty'));
t('a duplicate exercise id is refused', errs((d) => { d.exercises[1].id = d.exercises[0].id; }).includes('duplicate id'));
t('an id with capitals or spaces is refused', errs((d) => { d.exercises[0].id = 'Bad Id'; }).includes('"id"'));
t('dictation is not an allowed type', errs((d) => { d.exercises[0].type = 'dictation'; }).includes('unknown type'));
t('verbform needs a cue (it is the only hint on screen)', errs((d) => { delete d.exercises[3].items[0].cue; }).includes('cue'));
t('verbform needs exactly one gap', errs((d) => { d.exercises[3].items[0].text = 'no gap here'; }).includes('exactly one'));
t('gaps needs one answer list per gap', errs((d) => { d.exercises[1].items[0].accepted.pop(); }).includes('one list of answers per'));
t('gaps needs a bank', errs((d) => { delete d.exercises[1].bank; }).includes('bank'));
t('translate needs accepted answers', errs((d) => { d.exercises[0].items[0].accepted = []; }).includes('accepted'));
t('an item without a prompt is refused', errs((d) => { delete d.exercises[0].items[1].prompt; }).includes('prompt'));
const big = clone(sample); big.exercises[0].items = Array.from({ length: 25 }, (_, i) => ({ prompt: `p${i}`, accepted: [`a${i}`] }));
t('more than 20 items gets a warning', validateExtra(big, 'nl-les-05').warnings.some((w) => w.includes('10-20')) && validateExtra(big, 'nl-les-05').errors.length === 0);
t('errors leave nothing to render', validateExtra({ lesson: 'nl-les-05', exercises: [{ id: 'a', type: 'translate' }] }, 'nl-les-05').exercises.length === 0);
t('sentencesOf lists the Dutch of an exercise for the level audit', sentencesOf(sample.exercises[0], 'e0').length >= sample.exercises[0].items.length);
t('matching: a Ukrainian-only prompt is not audited as Dutch', sentencesOf({ type: 'matching', items: [{ prompt: 'вечір', answer: 'de avond' }] }, 'm').length === 1);

// ---- reading it from the learner's folder
class FakeFile { constructor(d) { this.kind = 'file'; this.data = d; } async getFile() { const d = this.data; return { text: async () => d }; } }
class FakeDir {
  constructor() { this.kind = 'directory'; this.map = new Map(); }
  async getDirectoryHandle(name) { if (!this.map.has(name)) { const e = new Error('not found'); e.name = 'NotFoundError'; throw e; } return this.map.get(name); }
  async getFileHandle(name) { if (!this.map.has(name)) { const e = new Error('not found'); e.name = 'NotFoundError'; throw e; } return this.map.get(name); }
}
(async () => {
  const root = new FakeDir();
  const store = new FolderStore(root);
  t('extraLocation maps a lesson id to its file', JSON.stringify(extraLocation('nl-les-05')) === '{"lang":"nl","file":"les-05.json"}' && extraLocation('weird') === null);
  t('no extra folder: null, and the read never creates anything', (await store.readExtra('nl-les-05')) === null && root.map.size === 0);
  const nl = new FakeDir(), extra = new FakeDir();
  root.map.set('extra', extra); extra.map.set('nl', nl);
  t('folder but no file for this lesson: null', (await store.readExtra('nl-les-05')) === null);
  nl.map.set('les-05.json', new FakeFile(JSON.stringify(sample)));
  const got = await store.readExtra('nl-les-05');
  t('the file is read and parsed', got && got.data && got.data.lesson === 'nl-les-05');
  nl.map.set('les-06.json', new FakeFile('{ not json'));
  const broken = await store.readExtra('nl-les-06');
  t('unreadable JSON is reported, not hidden', broken && broken.error && broken.error.includes('not valid JSON'));
  const denied = new FakeDir(); denied.getDirectoryHandle = async () => { const e = new Error('denied'); e.name = 'NotAllowedError'; throw e; };
  let threw = false; try { await new FolderStore(denied).readExtra('nl-les-05'); } catch (e) { threw = e.name === 'NotAllowedError'; }
  t('a real access error is not mistaken for "no file"', threw);
  t('a lesson id that is not a lesson gives null', (await store.readExtra('nonsense')) === null);

  // ---- the teacher's digest understands extra exercises
  const lessons = [{ id: 'nl-les-05', order: 5, notes: [], practice: [{ type: 'translate', items: [] }], examples: [], reading: { sentences: [] } }];
  const events = [
    { t: '2026-09-24T10:00:00.000Z', type: 'exercise_checked', lesson: 'nl-les-05', exercise: 0, kind: 'translate', ok: 1, total: 2, wrong: [] },
    { t: '2026-09-24T10:05:00.000Z', type: 'exercise_checked', lesson: 'nl-les-05', exercise: 'x:demo-verbs', kind: 'verbform', ok: 1, total: 3, wrong: [{ n: 1, answer: 'wonen', expected: 'woont' }] },
  ];
  let digest = '';
  try { digest = buildDigest(events, lessons); } catch (e) { digest = 'CRASH ' + e.message; }
  t('digest does not crash on an extra exercise id', !digest.startsWith('CRASH'));
  t('digest labels it as extra and keeps lesson exercises numbered', digest.includes('| Les 5 | extra demo-verbs |') && digest.includes('| Les 5 | 1 |'));
  t('digest lists what was missed in the extra exercise', digest.includes('exercise extra demo-verbs (verbform): expected "woont"') && digest.includes('typed: "wonen"'));

  console.log(bad ? `FAILURES: ${bad}` : 'EXTRA PRACTICE TESTS PASSED');
  process.exit(bad ? 1 : 0);
})();
