// Which lessons are waiting for the teacher's extra practice? Read-only.
// A lesson that reached 100% (all exercises + the reading recording) means the NEXT lesson's extra-practice set can be
// written, from the learner's fresh results. Lists every such lesson whose set does not exist yet.
// Run: node scripts/extra-needed.js [data-folder]   (default: ../language-app-data next to this repo)
// Prints one line per needed set, or a single "nothing to do" line. Always exits 0: it only reports.
const fs = require('fs');
const path = require('path');
const { fold, lessonProgress } = require('../mockup/progress-store.js');
const { readEvents } = require('./progress-digest.js');

const FIRST_EXTRA_LESSON = 5;   // extra practice starts with Les 5 (decided with the learner)

// lessons: sorted by order; state: fold(events); hasSet(lessonId): does an extra file exist for that lesson?
function needed(lessons, state, hasSet) {
  const out = [];
  lessons.forEach((L, i) => {
    const next = lessons[i + 1];
    if (!next || next.order < FIRST_EXTRA_LESSON) return;
    if (lessonProgress(L, state).pct < 100 || hasSet(next.id)) return;
    out.push({ done: L, next });
  });
  return out;
}

module.exports = { needed, FIRST_EXTRA_LESSON };

if (require.main === module) {
  const dataDir = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'language-app-data'));
  const lessonsDir = path.join(__dirname, '..', 'content', 'nl', 'lessons');
  const lessons = fs.readdirSync(lessonsDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(lessonsDir, f), 'utf8'))).sort((a, b) => a.order - b.order);
  const { events } = readEvents(path.join(dataDir, 'progress'));
  const hasSet = (id) => { const m = /^([a-z]{2})-(les-\d+)$/.exec(id); return !!m && fs.existsSync(path.join(dataDir, 'extra', m[1], `${m[2]}.json`)); };
  const list = needed(lessons, fold(events), hasSet);
  if (!list.length) console.log('Extra practice: nothing to do (every lesson at 100% already has the set for the next lesson).');
  for (const { done, next } of list) console.log(`Extra practice needed: Les ${done.order} is at 100%, no set yet for Les ${next.order} (${next.id}).`);
}
