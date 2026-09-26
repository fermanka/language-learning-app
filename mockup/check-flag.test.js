// Tests for the "check with a native speaker" flag: flaggedNotes() picks exactly the notes that carry a "check" reason.
// Run: node mockup/check-flag.test.js
const { flaggedNotes } = require('./lesson.js');

let bad = 0;
const t = (name, ok) => { if (!ok) { bad++; console.log('FAIL', name); } };

const lessons = [
  { order: 1, notes: [{ id: 'a', lemma: 'huis' }, { id: 'b', lemma: 'tuin', check: 'plural not confirmed' }] },
  { order: 2, notes: [{ id: 'c', lemma: 'lopen' }] },
  { order: 3, notes: [{ id: 'd', lemma: 'wilden', check: 'form not in the dictionary' }, { id: 'e', lemma: 'fiets', check: '' }, { id: 'f', lemma: 'trein', check: 'stress' }] },
];
const got = flaggedNotes(lessons);
t('only notes with a non-empty check are listed', got.map((g) => g.note.id).join() === 'b,d,f');
t('each entry carries the lesson number', got.map((g) => g.order).join() === '1,3,3');
t('lesson order and note order are kept', got[1].note.lemma === 'wilden' && got[2].note.lemma === 'trein');
t('no flagged notes gives an empty list', flaggedNotes([{ order: 1, notes: [{ id: 'x', lemma: 'y' }] }]).length === 0);

if (bad) process.exit(1);
console.log('CHECK FLAG TESTS PASSED');
