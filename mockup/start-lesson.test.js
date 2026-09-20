// Tests for which lesson opens. Run: node mockup/start-lesson.test.js
const { startIndex, frontierIndex } = require('./lesson.js');

let bad = 0;
const t = (name, ok) => { if (!ok) { bad++; console.log('FAIL', name); } };

const lessons = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
const done = (set) => (i) => set.includes(lessons[i].id);

t('the lesson the learner was on is reopened, even if an earlier one is not done', startIndex(lessons, 'a', done(['a'])) === 0);
t('a later lesson that was open is reopened too', startIndex(lessons, 'c', done(['a', 'b'])) === 2);
t('nothing remembered: the first lesson that is not done', startIndex(lessons, null, done(['a', 'b'])) === 2);
t('nothing remembered and nothing done: the first lesson', startIndex(lessons, null, done([])) === 0);
t('nothing remembered and everything done: the last lesson', startIndex(lessons, null, done(['a', 'b', 'c', 'd'])) === 3);
t('a remembered lesson that no longer exists falls back to the first not done', startIndex(lessons, 'gone', done(['a'])) === 1);

// which lessons feed the flashcard deck: everything up to the lesson being worked on, nothing after it
t('deck frontier: nothing done yet, the deck is Les 1', frontierIndex(lessons, done([])) === 0);
t('deck frontier: lessons 1-3 done, the one being worked on is Les 4', frontierIndex(lessons, done(['a', 'b', 'c'])) === 3);
t('deck frontier: everything done, the last lesson', frontierIndex(lessons, done(['a', 'b', 'c', 'd'])) === 3);
t('deck frontier: a gap in the done lessons does not pull it back', frontierIndex(lessons, done(['a', 'c'])) === 3);
t('deck frontier: a reset first lesson does not shrink it when later ones are done', frontierIndex(lessons, done(['b', 'c'])) === 3);

console.log(bad ? `FAILURES: ${bad}` : 'START LESSON TESTS PASSED');
process.exit(bad ? 1 : 0);
