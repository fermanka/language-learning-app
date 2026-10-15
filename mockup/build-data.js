// Mockup helper. A page opened from disk (file://) cannot fetch() local files,
// so this wraps the lesson JSON files of every language in <script>-loadable files.
// Run: node mockup/build-data.js   (single source of truth stays content/<lang>/lessons/*.json)
//
// Writes, for every language folder under content/ that has a config.json and at least one lesson:
//   mockup/lessons.<lang>.data.js   window.LESSONS (the lessons) and window.LANG (the language's config: name, teacher, UI texts)
//   mockup/tenses.<lang>.data.js    window.TENSES and window.VERBS (null when the teacher has not written them: the tab stays hidden)
// and mockup/languages.data.js      window.LANGS: the languages the page can switch between.
// The page loads the files of ONE language (chosen in the header), see lesson.html.
const fs = require('fs');
const path = require('path');

const contentDir = path.join(__dirname, '..', 'content');
const langs = [];
for (const d of fs.readdirSync(contentDir, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const langDir = path.join(contentDir, d.name);
  const configPath = path.join(langDir, 'config.json');
  const lessonsDir = path.join(langDir, 'lessons');
  if (!fs.existsSync(configPath) || !fs.existsSync(lessonsDir)) continue;
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const lessons = fs.readdirSync(lessonsDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(lessonsDir, f), 'utf8'))).sort((a, b) => a.order - b.order);
  if (!lessons.length) continue;   // a language with no lessons yet is not offered

  const lang = { lang: config.lang, name: config.name, teacher: config.teacher, ui: config.ui || {} };
  fs.writeFileSync(path.join(__dirname, `lessons.${d.name}.data.js`), 'window.LESSONS = ' + JSON.stringify(lessons, null, 1) + ';\nwindow.LANG = ' + JSON.stringify(lang) + ';\n');
  console.log(`wrote mockup/lessons.${d.name}.data.js (${lessons.length} lessons)`);

  // The tenses tab reads two optional files written by the teacher (docs/tenses-format.md). Missing files give null: the tab stays hidden.
  const read = (f) => { const p = path.join(langDir, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
  const tenses = read('tenses.json'), verbs = read('verbs.json');
  fs.writeFileSync(path.join(__dirname, `tenses.${d.name}.data.js`), 'window.TENSES = ' + JSON.stringify(tenses) + ';\nwindow.VERBS = ' + JSON.stringify(verbs) + ';\n');
  console.log(tenses && verbs ? `wrote mockup/tenses.${d.name}.data.js (${tenses.tenses.length} tenses, ${verbs.verbs.length} verbs)` : `wrote mockup/tenses.${d.name}.data.js (no tenses.json / verbs.json yet: the tenses tab stays hidden)`);
  langs.push({ lang: config.lang, name: config.name, pill: (config.ui || {}).pill || config.name });
}
langs.sort((a, b) => (a.lang === 'nl' ? -1 : b.lang === 'nl' ? 1 : a.lang.localeCompare(b.lang)));   // the first language stays first
fs.writeFileSync(path.join(__dirname, 'languages.data.js'), 'window.LANGS = ' + JSON.stringify(langs) + ';\n');
console.log(`wrote mockup/languages.data.js (${langs.map((l) => l.lang).join(', ')})`);
