// Tests for the order of the dictation words. Run: node mockup/dictation.test.js
const fs = require('fs');
const path = require('path');
const { pickDictation, dictationNotes } = require('./lesson.js');

let bad = 0;
const t = (name, ok) => { if (!ok) { bad++; console.log('FAIL', name); } };

const lessonsDir = path.join(__dirname, '..', 'content', 'nl', 'lessons');
const lessons = fs.readdirSync(lessonsDir).sort().map((f) => JSON.parse(fs.readFileSync(path.join(lessonsDir, f), 'utf8')));
const notes = lessons[0].notes.filter((n) => ['noun', 'function'].includes(n.type));

// a word list that fits in one attempt (no "max" cut-off) must still not come in lesson order
let sameOrder = 0;
for (let i = 0; i < 50; i++) if (pickDictation(notes).every((n, k) => n === notes[k])) sameOrder++;
t('without a limit the words are shuffled (never always in lesson order)', sameOrder < 5);
t('without a limit no word is lost or doubled', pickDictation(notes).length === notes.length && new Set(pickDictation(notes)).size === notes.length);

// with a limit that is larger than the list, the same holds
sameOrder = 0;
for (let i = 0; i < 50; i++) if (pickDictation(notes, 12).every((n, k) => n === notes[k])) sameOrder++;
t('with a limit larger than the list the words are still shuffled', sameOrder < 5);

// with a smaller limit, a random subset of exactly that size
const some = pickDictation(notes, 5);
t('a smaller limit picks exactly that many different words', some.length === 5 && new Set(some).size === 5 && some.every((n) => notes.includes(n)));

// the input list is never changed
const copy = notes.slice();
pickDictation(notes, 5);
t('the original list keeps its order', notes.every((n, k) => n === copy[k]));

// a fixed random source gives a fixed order (so the function itself is predictable to test)
const fixed = pickDictation([1, 2, 3, 4], 0, () => 0).join();
t('deterministic with a fixed random source', fixed === '2,3,4,1');

// every lesson: the dictation still has words
t('every lesson with a dictation has words to dictate', lessons.every((L) => L.practice.filter((e) => e.type === 'dictation').every((e) => dictationNotes(L, e).length > 0)));

console.log(bad ? `FAILURES: ${bad}` : 'DICTATION TESTS PASSED');
process.exit(bad ? 1 : 0);
