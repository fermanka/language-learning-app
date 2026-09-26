// Mockup helper. A page opened from disk (file://) cannot fetch() local files,
// so this wraps all lesson JSON files in a <script>-loadable file.
// Run: node mockup/build-data.js   (single source of truth stays content/nl/lessons/*.json)
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'content', 'nl', 'lessons');
const lessons = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).sort((a, b) => a.order - b.order);
fs.writeFileSync(path.join(__dirname, 'lessons.data.js'), 'window.LESSONS = ' + JSON.stringify(lessons, null, 1) + ';\n');
console.log(`wrote mockup/lessons.data.js (${lessons.length} lessons)`);

// The tenses tab reads two optional files written by the teacher (docs/tenses-format.md). Missing files give null: the tab stays hidden.
const read = (f) => { const p = path.join(__dirname, '..', 'content', 'nl', f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
const tenses = read('tenses.json'), verbs = read('verbs.json');
fs.writeFileSync(path.join(__dirname, 'tenses.data.js'), 'window.TENSES = ' + JSON.stringify(tenses) + ';\nwindow.VERBS = ' + JSON.stringify(verbs) + ';\n');
console.log(tenses && verbs ? `wrote mockup/tenses.data.js (${tenses.tenses.length} tenses, ${verbs.verbs.length} verbs)` : 'wrote mockup/tenses.data.js (no tenses.json / verbs.json yet: the tenses tab stays hidden)');
