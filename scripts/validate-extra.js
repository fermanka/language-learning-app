// Checks the teacher's extra-practice files (extra/<lang>/les-NN.json) in a learner's data folder.
// Run: node scripts/validate-extra.js [data-folder]   (default: ../language-app-data next to this repo)
// Fails (exit 1) on structural errors; warns about words outside the vocabulary learned up to that lesson.
// The files hold personal practice, so they live outside the repository; only the checker is public.
const fs = require('fs');
const path = require('path');
const { validateExtra, sentencesOf } = require('../mockup/extra-practice.js');

const dataDir = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'language-app-data'));
const extraDir = path.join(dataDir, 'extra');
const lessonsDir = path.join(__dirname, '..', 'content', 'nl', 'lessons');
let errors = 0;
const fail = (m) => { errors++; console.error('ERROR ', m); };

if (!fs.existsSync(extraDir)) { console.log(`No extra practice folder in ${dataDir}: nothing to check.`); process.exit(0); }

const tokens = (s) => s.replace(/\*\*/g, '').toLowerCase().replace(/[.,!?()\/]/g, ' ').split(/\s+/).filter((t) => t && !/^_+$/.test(t) && t !== '-' && t !== '->');
const lessons = fs.readdirSync(lessonsDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(lessonsDir, f), 'utf8'))).sort((a, b) => a.order - b.order);
// same rule as the content validator: lesson N may use the words of lessons 1..N
const knownThrough = new Map();
const known = new Set(['de', 'het']);
for (const l of lessons) {
  (l.service_words || []).forEach((w) => known.add(w.toLowerCase()));
  for (const n of l.notes) {
    tokens(n.lemma).forEach((t) => known.add(t));
    (n.plural || []).forEach((p) => known.add(p));
    for (const r of n.paradigm || []) { tokens(r.pronoun).forEach((t) => known.add(t)); tokens(r.form).forEach((t) => known.add(t)); }
  }
  knownThrough.set(l.id, new Set(known));
}

let files = 0;
for (const lang of fs.readdirSync(extraDir)) {
  const dir = path.join(extraDir, lang);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    files++;
    const where = `extra/${lang}/${file}`;
    const lessonId = `${lang}-${file.replace(/\.json$/, '')}`;
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); } catch (e) { fail(`${where}: invalid JSON (${e.message})`); continue; }
    const vocab = knownThrough.get(lessonId);
    if (!vocab) { fail(`${where}: there is no lesson "${lessonId}"`); continue; }
    const v = validateExtra(data, lessonId);
    v.errors.forEach((m) => fail(`${where}: ${m}`));
    v.warnings.forEach((m) => console.log(`NOTE ${where}: ${m}`));
    if (v.errors.length) continue;
    const unknown = new Map();
    v.exercises.forEach((ex, ei) => sentencesOf(ex, `exercises[${ei}:${ex.type}]`).forEach(([at, text]) => tokens(text).forEach((t) => { if (!vocab.has(t)) (unknown.get(t) || unknown.set(t, []).get(t)).push(at); })));
    console.log(`${where}: ${v.exercises.length} exercises`);
    if (unknown.size) { console.log('WARNING words outside the vocabulary learned so far:'); for (const [t, ats] of unknown) console.log(`  "${t}" x${ats.length}, e.g. ${ats[0]}`); }
    else console.log('level audit: every word is inside the vocabulary learned so far');
  }
}
if (!files) console.log('No extra practice files found.');
process.exit(errors ? 1 : 0);
