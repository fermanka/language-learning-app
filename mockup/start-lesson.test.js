// Tests for which lesson opens. Run: node mockup/start-lesson.test.js
const { startIndex } = require('./lesson.js');

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

console.log(bad ? `FAILURES: ${bad}` : 'START LESSON TESTS PASSED');
process.exit(bad ? 1 : 0);
