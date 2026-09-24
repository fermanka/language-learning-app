// Tests for the "extra practice needed" check. Run: node scripts/extra-needed.test.js
const { needed } = require('./extra-needed.js');
const { fold } = require('../mockup/progress-store.js');

let bad = 0;
const t = (name, ok) => { if (!ok) { bad++; console.log('FAIL', name); } };

const lesson = (order) => ({ id: `nl-les-${String(order).padStart(2, '0')}`, order, practice: [{}, {}] });   // 2 exercises + reading = 3 parts
const lessons = [1, 2, 3, 4, 5, 6, 7].map(lesson);
const done = (order, perfect = true) => [0, 1].map((k) => ({ t: `2026-09-2${order}T10:0${k}:00.000Z`, type: 'exercise_checked', lesson: lessons[order - 1].id, exercise: k, ok: perfect || k === 0 ? 4 : 1, total: 4, wrong: [] }));
const recorded = (order) => ({ t: `2026-09-2${order}T11:00:00.000Z`, type: 'recording_saved', lesson: lessons[order - 1].id, file: 'x.m4a' });
const at100 = (order) => [...done(order), recorded(order)];
const none = () => false;
const ids = (list) => list.map((x) => `${x.done.order}>${x.next.order}`).join();

t('nothing done: nothing needed', needed(lessons, fold([]), none).length === 0);
t('Les 4 at 100% and no set for Les 5: Les 5 is needed', ids(needed(lessons, fold(at100(4)), none)) === '4>5');
t('the set for Les 5 already exists: nothing needed', needed(lessons, fold(at100(4)), (id) => id === 'nl-les-05').length === 0);
t('Les 5 at 100%: the set for Les 6 is needed', ids(needed(lessons, fold(at100(5)), (id) => id === 'nl-les-05')) === '5>6');
t('Les 3 at 100%: no set is written for Les 4 (extra practice starts at Les 5)', needed(lessons, fold(at100(3)), none).length === 0);
t('all exercises perfect but no reading recording: not 100%, nothing needed', needed(lessons, fold(done(5)), none).length === 0);
t('recording sent but an exercise is not perfect: nothing needed', needed(lessons, fold([...done(5, false), recorded(5)]), none).length === 0);
t('the last lesson at 100% has no next lesson: nothing needed', needed(lessons, fold(at100(7)), none).length === 0);
t('two finished lessons without sets are both listed, in order', ids(needed(lessons, fold([...at100(4), ...at100(5)]), none)) === '4>5,5>6');
t('extra-practice answers do not make a lesson 100%', needed(lessons, fold([{ t: '2026-09-24T10:00:00.000Z', type: 'exercise_checked', lesson: lessons[4].id, exercise: 'x:demo', ok: 4, total: 4, wrong: [] }, recorded(5)]), none).length === 0);

console.log(bad ? `FAILURES: ${bad}` : 'EXTRA NEEDED TESTS PASSED');
process.exit(bad ? 1 : 0);
