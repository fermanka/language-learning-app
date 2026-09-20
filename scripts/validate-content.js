// Content check for lesson files. Run: node scripts/validate-content.js
// Fails (exit 1) on structural errors. Prints a warning for every word in a
// sentence that is outside the vocabulary learned so far (level audit).
// Vocabulary is cumulative: lesson N may use the words of lessons 1..N.
const fs = require('fs');
const path = require('path');

const langDir = path.join(__dirname, '..', 'content', 'nl');
const lessonsDir = path.join(langDir, 'lessons');
const config = JSON.parse(fs.readFileSync(path.join(langDir, 'config.json'), 'utf8'));
let errors = 0;
const fail = (msg) => { errors++; console.error('ERROR ', msg); };

const tokens = (s) => s.replace(/\*\*/g, '').toLowerCase().replace(/[.,!?()\/]/g, ' ').split(/\s+/).filter((t) => t && !/^_+$/.test(t) && t !== '-' && t !== '->');

const lessons = fs.readdirSync(lessonsDir).filter((f) => f.endsWith('.json')).sort().map((file) => {
  try { return { file, data: JSON.parse(fs.readFileSync(path.join(lessonsDir, file), 'utf8')) }; }
  catch (e) { fail(`${file}: invalid JSON (${e.message})`); return null; }
}).filter(Boolean).sort((a, b) => a.data.order - b.data.order);

const ids = new Set();
const known = new Set(['de', 'het']);

for (const { file, data: lesson } of lessons) {
  const where = (p) => `${file}: ${p}`;

  for (const n of lesson.notes) {
    if (!/^nl-[0-9a-f]{8}$/.test(n.id)) fail(where(`bad note id ${n.id}`));
    if (ids.has(n.id)) fail(where(`duplicate note id ${n.id}`));
    ids.add(n.id);
    const type = config.note_types[n.type];
    if (!type) { fail(where(`note ${n.id} has unknown type "${n.type}"`)); continue; }
    for (const field of type.required) if (n[field] === undefined || n[field] === '') fail(where(`${n.type} "${n.lemma}" is missing required field "${field}"`));
    if (n.type === 'noun' && !['de', 'het'].includes(n.article)) fail(where(`noun "${n.lemma}" has no de/het article`));
    if (n.ua && n.ua.length > 80) fail(where(`"${n.lemma}": "ua" is ${n.ua.length} characters. Keep it a short gloss (it is the front of a flashcard) and put the explanation in "explain_ua"`));
  }
  for (const id of lesson.reading.highlight) if (!lesson.notes.some((n) => n.id === id)) fail(where(`reading highlight points at unknown note ${id}`));

  // vocabulary known up to and including this lesson
  (lesson.service_words || []).forEach((w) => known.add(w.toLowerCase()));
  for (const n of lesson.notes) {
    tokens(n.lemma).forEach((t) => known.add(t));
    (n.plural || []).forEach((p) => known.add(p));
    for (const r of n.paradigm || []) { tokens(r.pronoun).forEach((t) => known.add(t)); tokens(r.form).forEach((t) => known.add(t)); }
  }

  // sentences for the level audit; every practice item needs accepted answers
  const sentences = [];
  lesson.examples.forEach((e, i) => sentences.push([`examples[${i}]`, e.nl]));
  lesson.reading.sentences.forEach((s, i) => sentences.push([`reading[${i}]`, s.nl]));
  (Array.isArray(lesson.rule) ? lesson.rule : lesson.rule ? [lesson.rule] : []).forEach((rule, ri) => (rule.compare || []).forEach((c, ci) => c.examples.forEach((e, i) => sentences.push([`rule[${ri}].compare[${ci}].examples[${i}]`, e.nl]))));
  lesson.practice.forEach((ex, ei) => {
    (ex.extra || []).forEach((e, i) => sentences.push([`practice[${ei}:${ex.type}].extra[${i}]`, e]));
    for (const [ii, item] of (ex.items || []).entries()) {
      const at = `practice[${ei}:${ex.type}].items[${ii}]`;
      if (ex.type === 'matching') {
        if (!item.prompt || !item.answer) fail(where(`${at} needs a prompt and an answer`));
        sentences.push([at + ' prompt', item.prompt], [at + ' answer', item.answer]);
        continue;
      }
      if (!item.accepted || !item.accepted.length) fail(where(`${at} has no accepted answers`));
      if (ex.type === 'gaps') {
        const gaps = (item.text.match(/___/g) || []).length;
        if (gaps !== item.accepted.length) fail(where(`${at} has ${gaps} gaps but ${item.accepted.length} answer groups`));
        sentences.push([at, item.text]);
        item.accepted.forEach((g) => g.forEach((a) => sentences.push([at + ' answer', a])));
      } else if (ex.type === 'verbform') {
        sentences.push([at, item.text]);
      } else if (ex.type === 'transform') {
        sentences.push([at, item.prompt]);
        item.accepted.forEach((a) => sentences.push([at + ' answer', a]));
      } else if (ex.type === 'translate') {
        item.accepted.forEach((a) => sentences.push([at + ' answer', a]));
      }
    }
  });

  // From lesson 12 on (learner's decision): 8-12 examples and 8-12 items per exercise, not 18-20.
  if (lesson.order >= 12) {
    const inRange = (n, lo, hi, what) => { if (n < lo || n > hi) fail(where(`${what}: ${n} items, expected ${lo}-${hi} (lesson 12 and later)`)); };
    inRange(lesson.examples.length, 8, 12, 'examples');
    lesson.practice.forEach((ex, ei) => {
      const label = `practice[${ei}:${ex.type}]`;
      if (ex.type === 'dictation') {
        const words = lesson.notes.filter((n) => ex.note_types.includes(n.type) && n.dictation !== false && n.audio).length;
        inRange(Math.min(words, ex.max || words), 1, 12, label + ' (words per attempt, set "max" to limit)');
      } else if (ex.type === 'matching') inRange(ex.items.length, 5, 12, label);
      else inRange(ex.items.length, 8, 12, label);
    });
  }

  // readability nudge (a warning, not an error): long rule text is heavy for a beginner
  for (const [ri, rule] of (Array.isArray(lesson.rule) ? lesson.rule : lesson.rule ? [lesson.rule] : []).entries()) {
    const long = (rule.points_ua || []).filter((p) => p.length > 300).length + (rule.summary_ua && rule.summary_ua.length > 300 ? 1 : 0);
    if (long) console.log(`NOTE ${file}: rule card ${ri + 1} has ${long} passage(s) over 300 characters, consider trimming`);
  }

  const unknown = new Map();
  for (const [at, text] of sentences) for (const t of tokens(text)) if (!known.has(t)) (unknown.get(t) || unknown.set(t, []).get(t)).push(at);
  console.log(`${file}: ${lesson.notes.length} notes, ${lesson.examples.length} examples, ${lesson.reading.sentences.length} reading sentences, ${lesson.practice.length} exercises${lesson.rule ? ', rule card' : ''}`);
  if (unknown.size) {
    console.log("WARNING words outside the vocabulary learned so far:");
    for (const [t, ats] of unknown) console.log(`  "${t}" x${ats.length}, e.g. ${ats[0]}`);
  } else console.log('level audit: every word is inside the vocabulary learned so far');
}
process.exit(errors ? 1 : 0);
