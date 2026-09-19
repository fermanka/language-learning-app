// Tests for the progress digest. Run: node scripts/progress-digest.test.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildDigest, readEvents, fieldsOf } = require('./progress-digest.js');

const lessons = fs.readdirSync(path.join(__dirname, '..', 'content', 'nl', 'lessons')).sort()
  .map((f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'nl', 'lessons', f), 'utf8'))).sort((a, b) => a.order - b.order);
const les3 = lessons[2];
const gapsIdx = les3.practice.findIndex((p) => p.type === 'gaps');
const gapsFields = fieldsOf(les3, les3.practice[gapsIdx]);
let bad = 0;
const t = (name, fn) => { try { fn(); } catch (e) { bad++; console.log('FAIL', name, '\n   ', e.message.split('\n')[0]); } };

t('an empty log says so plainly and does not crash', () => {
  const d = buildDigest([], lessons);
  assert(d.includes('No progress events yet'));
});

const wrongAt = (n, answer, expected) => ({ n, answer, ...(expected ? { expected } : {}) });
const events = [
  { type: 'lesson_done', lesson: lessons[0].id, t: '2026-09-20T09:00:00.000Z' },
  { type: 'exercise_checked', lesson: les3.id, exercise: gapsIdx, kind: 'gaps', ok: 9, total: 11, wrong: [wrongAt(0, 'Woont'), wrongAt(2, 'hebt')], t: '2026-09-20T10:00:00.000Z' },
  { type: 'exercise_checked', lesson: les3.id, exercise: gapsIdx, kind: 'gaps', ok: 10, total: 11, wrong: [wrongAt(0, 'Woon')], t: '2026-09-21T10:00:00.000Z' },
  { type: 'card_review', card: `${les3.notes[0].id}:nl-ua`, rating: 1, t: '2026-09-21T11:00:00.000Z' },
  { type: 'card_review', card: `${les3.notes[0].id}:nl-ua`, rating: 1, t: '2026-09-21T11:05:00.000Z' },
  { type: 'card_review', card: `${les3.notes[1].id}:nl-ua`, rating: 3, t: '2026-09-21T11:06:00.000Z' },
  { type: 'recording_saved', lesson: lessons[0].id, file: 'les-01-2026-09-20-x.webm', t: '2026-09-20T12:00:00.000Z' },
];
const digest = buildDigest(events, lessons, 2);

t('the header counts events, the date range and damaged lines', () => assert(digest.includes('Events: 7 (2026-09-20 to 2026-09-21), damaged lines skipped: 2')));
t('finished and unfinished lessons are listed', () => assert(digest.includes('Lessons finished: Les 1') && digest.includes('Not finished: Les 2')));
t('exercise table shows attempts, last and best score', () => assert(/\| Les 3 \| \d+ \| gaps \| 2 \| 10\/11 \| 10\/11 \|/.test(digest), digest));
t('the most missed item is the one missed twice, with the item text and what was typed', () => {
  const top = digest.split('## Most missed items')[1].split('\n').find((l) => l.startsWith('- '));
  assert(top.includes(`expected "${gapsFields[0].expected}"`) && top.includes('missed 2x') && top.includes('"Woont"') && top.includes('"Woon"'), top);
  assert(top.includes(gapsFields[0].label.slice(0, 12)), 'item text is shown');
});
t('an event that carries the expected answer is used even when the item cannot be looked up', () => {
  const d = buildDigest([{ type: 'exercise_checked', lesson: 'nl-les-99', exercise: 0, kind: 'dictation', ok: 0, total: 1, wrong: [wrongAt(3, 'de kat', 'de kaas')], t: '2026-09-20T10:00:00Z' }], lessons);
  assert(d.includes('expected "de kaas"') && d.includes('"de kat"'));
});
t('the hardest card shows the word, its meaning and the direction', () => {
  const n = les3.notes[0];
  assert(digest.includes(`${n.type === 'noun' ? n.article + ' ' + n.lemma : n.lemma} (${n.ua}) [Dutch -> meaning]: Again 2 of 2 reviews`), digest);
});
t('recordings are listed', () => assert(digest.includes('Les 1: les-01-2026-09-20-x.webm')));
t('reading a folder skips damaged lines and counts them', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-'));
  fs.writeFileSync(path.join(dir, '2026-09-20.laptop.ndjson'), JSON.stringify(events[0]) + '\n{"broken\n' + JSON.stringify(events[1]) + '\n');
  const r = readEvents(dir);
  assert.strictEqual(r.events.length, 2); assert.strictEqual(r.bad, 1);
  fs.rmSync(dir, { recursive: true, force: true });
  assert.deepStrictEqual(readEvents(path.join(dir, 'missing')), { events: [], bad: 0 });
});
t('the digest holds no raw log lines', () => assert(!/"type":/.test(digest)));

console.log(bad ? `FAILURES: ${bad}` : 'DIGEST TESTS PASSED');
process.exit(bad ? 1 : 0);
