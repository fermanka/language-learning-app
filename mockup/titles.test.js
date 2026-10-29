// Tests for the short lesson names in the Progress list. Run: node mockup/titles.test.js
const { shortLessonTitle } = require('./lesson.js');
let bad = 0;
const t = (name, ok) => { if (!ok) { bad++; console.log('FAIL', name); } };

const rule = (title) => ({ rule: [{ title_ua: title }], reading: { title_ua: 'Читання' } });
t('title_ua of the lesson wins', shortLessonTitle({ title_ua: 'Майбутній час', ...rule('Інше') }) === 'Майбутній час');
t('otherwise the first rule card', shortLessonTitle(rule('Майбутній час: ću, ćeš, će')) === 'Майбутній час: ću, ćeš, će');
t('a single rule object works too', shortLessonTitle({ rule: { title_ua: 'Один' }, reading: { title_ua: 'Читання' } }) === 'Один');
t('without a rule card the reading title', shortLessonTitle({ reading: { title_ua: 'Миша у вині' } }) === 'Миша у вині');
t('brackets are dropped', shortLessonTitle(rule('Час: sati (sedam sati, osam i deset)')) === 'Час: sati');
const long = shortLessonTitle(rule('Числа 6-20: šest, sedam, osam, devet, dvanaest, petnaest'));
t('a long title is cut at a comma and ends with an ellipsis', long === 'Числа 6-20: šest, sedam, osam, devet…' && long.length <= 45);
t('a short title is not touched', shortLessonTitle(rule('Короткий')) === 'Короткий');
t('a lesson with nothing gives an empty string', shortLessonTitle({ reading: {} }) === '');

console.log(bad ? `FAILURES: ${bad}` : 'TITLE TESTS PASSED');
process.exit(bad ? 1 : 0);
