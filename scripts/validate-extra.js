// Checks the teacher's extra-practice files (extra/<lang>/les-NN.json) in a learner's data folder.
// Run: node scripts/validate-extra.js [data-folder]   (default: ../language-app-data next to this repo)
// Fails (exit 1) on structural errors; warns about words outside the vocabulary learned up to that lesson.
// The files hold personal practice, so they live outside the repository; only the checker is public.
const fs = require('fs');
const path = require('path');
const { validateExtra, sentencesOf } = require('../mockup/extra-practice.js');

const dataDir = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'language-app-data'));
const extraDir = path.join(dataDir, 'extra');
const contentDir = path.join(__dirname, '..', 'content');
let errors = 0;
const fail = (m) => { errors++; console.error('ERROR ', m); };

if (!fs.existsSync(extraDir)) { console.log(`No extra practice folder in ${dataDir}: nothing to check.`); process.exit(0); }

// Same tokenising rule as the content validator: a bare number is not vocabulary.
const tokens = (s) => s.replace(/\*\*/g, '').toLowerCase().replace(/’/g, "'").replace(/[.,!?:;()\/]/g, ' ').split(/\s+/).filter((t) => t && !/^_+$/.test(t) && t !== '-' && t !== '->' && !/^\d+$/.test(t));
// The vocabulary known up to each lesson of one language (lesson N may use the words of lessons 1..N), built from that language's own lessons.
const vocabCache = {};
function vocabFor(lang) {
  if (vocabCache[lang]) return vocabCache[lang];
  const lessonsDir = path.join(contentDir, lang, 'lessons');
  const knownThrough = new Map();
  vocabCache[lang] = knownThrough;
  if (!fs.existsSync(lessonsDir)) return knownThrough;
  const cfgFile = path.join(contentDir, lang, 'config.json');
  const cfg = fs.existsSync(cfgFile) ? JSON.parse(fs.readFileSync(cfgFile, 'utf8')) : {};
  const lessons = fs.readdirSync(lessonsDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(lessonsDir, f), 'utf8'))).sort((a, b) => a.order - b.order);
  const known = new Set((cfg.always_known || []).map((w) => w.toLowerCase()));
  for (const l of lessons) {
    (l.service_words || []).forEach((w) => known.add(w.toLowerCase()));
    for (const n of l.notes) {
      tokens(n.lemma).forEach((t) => known.add(t));
      (Array.isArray(n.plural) ? n.plural : []).forEach((p) => known.add(p));
      (n.forms || []).forEach((f) => tokens(f).forEach((t) => known.add(t)));
      for (const r of n.paradigm || []) { tokens(r.pronoun).forEach((t) => known.add(t)); tokens(r.form).forEach((t) => known.add(t)); }
    }
    knownThrough.set(l.id, new Set(known));
  }
  return knownThrough;
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
    const vocab = vocabFor(lang).get(lessonId);
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
