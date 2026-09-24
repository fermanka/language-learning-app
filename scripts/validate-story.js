// Checks the teacher's writing-task files (stories/<lang>/les-NN.json) in a learner's data folder.
// Run: node scripts/validate-story.js [data-folder]   (default: ../language-app-data next to this repo)
// Fails (exit 1) on structural errors. The files are private (they live outside the repository); only the checker is public.
const fs = require('fs');
const path = require('path');
const { validateStory } = require('../mockup/story.js');

const dataDir = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'language-app-data'));
const storiesDir = path.join(dataDir, 'stories');
const lessonsDir = path.join(__dirname, '..', 'content', 'nl', 'lessons');
let errors = 0;
const fail = (m) => { errors++; console.error('ERROR ', m); };

if (!fs.existsSync(storiesDir)) { console.log(`No stories folder in ${dataDir}: nothing to check.`); process.exit(0); }
const lessonIds = new Set(fs.readdirSync(lessonsDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(lessonsDir, f), 'utf8')).id));

let files = 0;
for (const lang of fs.readdirSync(storiesDir)) {
  const dir = path.join(storiesDir, lang);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    files++;
    const where = `stories/${lang}/${file}`;
    const lessonId = `${lang}-${file.replace(/\.json$/, '')}`;
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); } catch (e) { fail(`${where}: invalid JSON (${e.message})`); continue; }
    if (!lessonIds.has(lessonId)) { fail(`${where}: there is no lesson "${lessonId}"`); continue; }
    const v = validateStory(data, lessonId);
    v.errors.forEach((m) => fail(`${where}: ${m}`));
    v.warnings.forEach((m) => console.log(`NOTE ${where}: ${m}`));
    if (!v.errors.length) console.log(`${where}: ok (${data.min_sentences}+ sentences, topic "${data.topic_ua}")`);
  }
}
if (!files) console.log('No story files found.');
process.exit(errors ? 1 : 0);
