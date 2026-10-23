// Tests for the free-writing task: file format, sentence counting, reading the topic and saving the text in the learner's folder.
// Run: node mockup/story.test.js
const { validateStory, validateFeedback, countSentences, countWords, storyLocation } = require('./story.js');
const { FolderStore, fold } = require('./progress-store.js');
const { buildDigest } = require('../scripts/progress-digest.js');
const sample = require('../docs/story-example/stories/nl/les-11.json');

let bad = 0;
const t = (name, ok) => { if (!ok) { bad++; console.log('FAIL', name); } };
const clone = (o) => JSON.parse(JSON.stringify(o));
const errs = (mutate) => { const d = clone(sample); mutate(d); return validateStory(d, 'nl-les-11').errors.join(' | '); };

// ---- format
t('the documented example is valid', validateStory(sample, 'nl-les-11').errors.length === 0);
t('a file for another lesson is refused', validateStory(sample, 'nl-les-12').errors.some((e) => e.includes('"lesson"')));
t('not an object is refused', validateStory([], 'nl-les-11').errors.length === 1 && validateStory(null, 'nl-les-11').errors.length === 1);
t('a topic is required', errs((d) => { delete d.topic_ua; }).includes('topic_ua'));
t('min_sentences must be a whole number from 3 to 15', errs((d) => { d.min_sentences = 2; }).includes('min_sentences') && errs((d) => { d.min_sentences = 16; }).includes('min_sentences') && errs((d) => { d.min_sentences = '5'; }).includes('min_sentences'));
t('targets, when present, must be a non-empty list of strings', errs((d) => { d.targets_ua = []; }).includes('targets_ua') && errs((d) => { d.targets_ua = [1]; }).includes('targets_ua'));
t('topic_nl and targets are optional', validateStory({ lesson: 'nl-les-11', topic_ua: 'x', min_sentences: 5 }, 'nl-les-11').errors.length === 0);
t('a long checklist gets a warning, not an error', (() => { const d = clone(sample); d.targets_ua = ['a', 'b', 'c', 'd', 'e']; const r = validateStory(d, 'nl-les-11'); return r.errors.length === 0 && r.warnings.length === 1; })());

// ---- timed and word-based tasks
const ok2 = (o) => validateStory({ lesson: 'hr-les-52', topic_ua: 'Лист', ...o }, 'hr-les-52');
t('min_words replaces min_sentences', ok2({ min_words: 80 }).errors.length === 0);
t('min_words must be 20 to 400', ok2({ min_words: 10 }).errors.length === 1 && ok2({ min_words: 500 }).errors.length === 1);
t('minutes must be 3 to 90', ok2({ min_words: 80, minutes: 2 }).errors.length === 1 && ok2({ min_words: 80, minutes: 20 }).errors.length === 0);
t('strict needs minutes', ok2({ min_words: 80, strict: true }).errors.length === 1 && ok2({ min_words: 80, minutes: 20, strict: true }).errors.length === 0);
t('without min_words, min_sentences is still required', ok2({}).errors.length === 1);
t('countWords counts words with a letter', countWords('Dobar dan, 12 - evo! Ja sam.') === 5 && countWords('') === 0 && countWords(null) === 0 && countWords('Це текст.') === 2);

// ---- the teacher's feedback file
const fbOk = { lesson: 'hr-les-52', summary_ua: 'Добре', mistakes: [{ wrong: 'ja ide', right: 'ja idem', why_ua: 'ja + idem' }] };
t('a valid feedback file', validateFeedback(fbOk, 'hr-les-52').errors.length === 0);
t('feedback for another lesson is refused', validateFeedback(fbOk, 'hr-les-53').errors.length === 1);
t('feedback needs a summary', validateFeedback({ ...fbOk, summary_ua: '' }, 'hr-les-52').errors.length === 1);
t('a mistake needs wrong and right', validateFeedback({ ...fbOk, mistakes: [{ wrong: 'x' }] }, 'hr-les-52').errors.length === 1);
t('feedback without mistakes is fine', validateFeedback({ lesson: 'hr-les-52', summary_ua: 'Супер' }, 'hr-les-52').errors.length === 0);

// ---- counting sentences
t('counts sentences by their closing mark', countSentences('Ik eet kaas. Het is lekker! Wil jij ook?') === 3);
t('a text with no closing mark at the end still counts its last sentence', countSentences('Ik eet kaas. Het is lekker') === 2);
t('several marks in a row count once', countSentences('Echt?! Ja... Lekker.') === 3);
t('empty, spaces and stray marks count as zero', countSentences('') === 0 && countSentences('  ') === 0 && countSentences('. ! ?') === 0 && countSentences(null) === 0);
t('Ukrainian letters count as letters too', countSentences('Це речення. І ще одне.') === 2);
t('storyLocation maps a lesson id to its file', JSON.stringify(storyLocation('nl-les-11')) === '{"lang":"nl","file":"les-11.json"}' && storyLocation('weird') === null);

// ---- folder: reading the topic, saving the text
class FakeFile { constructor(d) { this.kind = 'file'; this.data = d; } async getFile() { const d = this.data; return { text: async () => d }; } async createWritable() { const f = this; return { write: async (x) => { f.data = x; }, close: async () => {} }; } }
class FakeDir {
  constructor() { this.kind = 'directory'; this.map = new Map(); }
  async getDirectoryHandle(name, o = {}) { if (!this.map.has(name)) { if (o.create) this.map.set(name, new FakeDir()); else { const e = new Error('not found'); e.name = 'NotFoundError'; throw e; } } return this.map.get(name); }
  async getFileHandle(name, o = {}) { if (!this.map.has(name)) { if (o.create) this.map.set(name, new FakeFile('')); else { const e = new Error('not found'); e.name = 'NotFoundError'; throw e; } } return this.map.get(name); }
}
(async () => {
  const root = new FakeDir();
  const store = new FolderStore(root);
  t('no stories folder: null, and the read never creates anything', (await store.readStory('nl-les-11')) === null && root.map.size === 0);
  const nl = new FakeDir(), stories = new FakeDir();
  root.map.set('stories', stories); stories.map.set('nl', nl);
  t('folder but no file for this lesson: null', (await store.readStory('nl-les-11')) === null);
  nl.map.set('les-11.json', new FakeFile(JSON.stringify(sample)));
  const got = await store.readStory('nl-les-11');
  t('the topic file is read and parsed', got && got.data && got.data.topic_ua === sample.topic_ua);
  nl.map.set('les-12.json', new FakeFile('{ not json'));
  const broken = await store.readStory('nl-les-12');
  t('unreadable JSON is reported, not hidden', broken && broken.error && broken.error.includes('not valid JSON'));
  t('a lesson id that is not a lesson gives null', (await store.readStory('nonsense')) === null);
  t('no feedback folder: null, and the read never creates anything', (await store.readFeedback('nl-les-11')) === null && !root.map.has('feedback'));
  const fbNl = new FakeDir(), fbRoot = new FakeDir();
  root.map.set('feedback', fbRoot); fbRoot.map.set('nl', fbNl);
  fbNl.map.set('les-11.json', new FakeFile(JSON.stringify({ lesson: 'nl-les-11', summary_ua: 'Добре' })));
  const fbGot = await store.readFeedback('nl-les-11');
  t('a feedback file is read and parsed', fbGot && fbGot.data && fbGot.data.summary_ua === 'Добре');
  t('feedback for a lesson without a file is null', (await store.readFeedback('nl-les-12')) === null);
  await store.saveWritten('nl-les-11.a.txt', 'Ik eet kaas.');
  await store.saveWritten('nl-les-11.b.txt', 'Ik eet brood.');
  const written = root.map.get('written');
  t('each sending is its own file in written/', written && written.map.get('nl-les-11.a.txt').data === 'Ik eet kaas.' && written.map.get('nl-les-11.b.txt').data === 'Ik eet brood.');
  t('readWritten reads back a sent file', (await store.readWritten('nl-les-11.a.txt')) === 'Ik eet kaas.');
  t('readWritten on a name never sent is null', (await store.readWritten('nl-les-11.z.txt')) === null);
  await store.saveWritten('nl-les-11.a.txt', 'Ik eet nu brood, niet kaas.');
  t('saving under an existing name overwrites it (the learner chose "overwrite" over "both")', (await store.readWritten('nl-les-11.a.txt')) === 'Ik eet nu brood, niet kaas.' && written.map.size === 2);

  // ---- progress state and the teacher's digest
  const events = [
    { t: '2026-09-24T10:00:00.000Z', type: 'story_submitted', lesson: 'nl-les-11', file: 'nl-les-11.a.txt', sentences: 5 },
    { t: '2026-09-24T11:00:00.000Z', type: 'story_submitted', lesson: 'nl-les-11', file: 'nl-les-11.b.txt', sentences: 7 },
  ];
  const st = fold(events);
  t('the latest sending is the one in the state', st.stories['nl-les-11'].file === 'nl-les-11.b.txt' && st.stories['nl-les-11'].sentences === 7);
  t('resetting the lesson does not delete a story she sent', fold([...events, { t: '2026-09-25T10:00:00.000Z', type: 'lesson_reset', lesson: 'nl-les-11' }]).stories['nl-les-11'].file === 'nl-les-11.b.txt');
  const lessons = [{ id: 'nl-les-11', order: 11, notes: [], practice: [], examples: [], reading: { sentences: [] } }];
  const digest = buildDigest(events, lessons);
  t('the digest lists both sendings with their files', digest.includes('Les 11: written/nl-les-11.a.txt (5 sentences)') && digest.includes('Les 11: written/nl-les-11.b.txt (7 sentences)'));
  const timed = buildDigest([{ t: '2026-10-25T10:00:00.000Z', type: 'story_submitted', lesson: 'nl-les-11', file: 'x.txt', sentences: 6, words: 92, seconds: 1260, minutes: 20 }], lessons);
  t('a timed text shows its words and time, and that it ran over', timed.includes('92 words') && timed.includes('21:00 of 20 min') && timed.includes('OVER the limit'));
  t('the digest says so when nothing was sent', buildDigest([{ t: '2026-09-24T10:00:00.000Z', type: 'lesson_done', lesson: 'nl-les-11' }], lessons).includes('None sent.'));

  console.log(bad ? `FAILURES: ${bad}` : 'STORY TESTS PASSED');
  process.exit(bad ? 1 : 0);
})();
