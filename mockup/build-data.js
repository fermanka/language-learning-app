// Mockup helper. A page opened from disk (file://) cannot fetch() local files,
// so this wraps all lesson JSON files in a <script>-loadable file.
// Run: node mockup/build-data.js   (single source of truth stays content/nl/lessons/*.json)
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'content', 'nl', 'lessons');
const lessons = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).sort((a, b) => a.order - b.order);
fs.writeFileSync(path.join(__dirname, 'lessons.data.js'), 'window.LESSONS = ' + JSON.stringify(lessons, null, 1) + ';\n');
console.log(`wrote mockup/lessons.data.js (${lessons.length} lessons)`);
