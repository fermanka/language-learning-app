// Tests for the listening exercise helpers and the dictation word list. Run: node mockup/listening.test.js
const { dictationNotes, isAccepted } = require('./lesson.js');
let bad = 0;
const t = (name, ok) => { if (!ok) { bad++; console.log('FAIL', name); } };

const note = (lemma, order, audio = `${lemma}.mp3`, type = 'noun') => ({ id: lemma, lemma, type, audio });
const L1 = { order: 1, notes: [note('kuća', 1), note('pas', 1, null)] };
const L2 = { order: 2, notes: [note('škola', 2), note('Dom', 2)] };
const L3 = { order: 3, notes: [note('grad', 3)] };
const all = [L1, L2, L3];

const words = (lesson, list) => dictationNotes(lesson, { words: list }, all).map((n) => n.lemma);
t('word list finds words of this and earlier lessons', words(L2, ['kuća', 'škola']).join() === 'kuća,škola');
t('word list keeps the order of the list', words(L2, ['škola', 'kuća']).join() === 'škola,kuća');
t('word list ignores a later lesson', words(L2, ['grad']).length === 0);
t('word list skips a note without audio', words(L2, ['pas']).length === 0);
t('word list is not case sensitive', words(L2, ['dom']).join() === 'Dom');
t('note_types dictation still works', dictationNotes(L1, { note_types: ['noun'] }).map((n) => n.lemma).join() === 'kuća');

// a choice is graded like a typed answer
t('a choice is accepted', isAccepted('Ne', ['Ne']));
t('a wrong choice is not accepted', !isAccepted('Da', ['Ne']));
t('an unanswered choice is not accepted', !isAccepted('', ['Ne']));

console.log(bad ? `FAILURES: ${bad}` : 'LISTENING TESTS PASSED');
process.exit(bad ? 1 : 0);
