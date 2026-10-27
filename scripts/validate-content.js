// Content check for lesson files. Run: node scripts/validate-content.js [lang ...]
// With no argument it checks every language folder under content/ that has a config.json.
// Fails (exit 1) on structural errors. Prints a warning for every word in a
// sentence that is outside the vocabulary learned so far (level audit).
// Vocabulary is cumulative: lesson N may use the words of lessons 1..N.
// Everything that differs between languages lives in content/<lang>/config.json (note types, allowed values, size rules).
const fs = require('fs');
const path = require('path');

const contentDir = process.env.CONTENT_DIR ? path.resolve(process.env.CONTENT_DIR) : path.join(__dirname, '..', 'content');   // CONTENT_DIR: used by the tests
let errors = 0;
const fail = (msg) => { errors++; console.error('ERROR ', msg); };

// A curly apostrophe (opa’s, typed on a phone or pasted from Word) counts as the straight one.
const tokens = (s) => s.replace(/\*\*/g, '').toLowerCase().replace(/’/g, "'").replace(/[.,!?:;()„“”«»\/]/g, ' ').split(/\s+/).filter((t) => t && !/^_+$/.test(t) && t !== '-' && t !== '->' && !/^\d+$/.test(t));   // a bare number is not vocabulary

// A sentence is stored under "text" (new languages) or "nl" (the first language kept its old key).
const sentenceOf = (e) => (e.text !== undefined ? e.text : e.nl);

// Default size rules (the first language's): from lesson 12, 8-12 examples and 8-12 items per exercise, at most 12 words per dictation attempt.
const { dictationNotes } = require('../mockup/lesson.js');
const DEFAULT_SIZE = { from_lesson: 12, examples: [8, 12], items: [8, 12], matching: [5, 12], listening: [3, 8], comprehension: [4, 10], dictation_max: 12 };

function validateLanguage(lang) {
  const langDir = path.join(contentDir, lang);
  const lessonsDir = path.join(langDir, 'lessons');
  const config = JSON.parse(fs.readFileSync(path.join(langDir, 'config.json'), 'utf8'));
  const size = { ...DEFAULT_SIZE, ...(config.size_rules || {}) };
  const idPattern = new RegExp(`^${config.lang}-[0-9a-f]{8}$`);
  if (config.lang !== lang) fail(`content/${lang}/config.json: "lang" is "${config.lang}", expected "${lang}"`);
  console.log(`== ${config.name} (${lang}) ==`);
  if (!fs.existsSync(lessonsDir)) { console.log('no lessons yet'); return; }

  const lessons = fs.readdirSync(lessonsDir).filter((f) => f.endsWith('.json')).sort().map((file) => {
    try { return { file, data: JSON.parse(fs.readFileSync(path.join(lessonsDir, file), 'utf8')) }; }
    catch (e) { fail(`${lang}/${file}: invalid JSON (${e.message})`); return null; }
  }).filter(Boolean).sort((a, b) => a.data.order - b.data.order);

  const ids = new Set();
  const known = new Set((config.always_known || []).map((w) => w.toLowerCase()));

  for (const { file, data: lesson } of lessons) {
    const where = (p) => `${lang}/${file}: ${p}`;
    if (lesson.lang !== undefined && lesson.lang !== config.lang) fail(where(`lesson "lang" is "${lesson.lang}", expected "${config.lang}"`));

    for (const n of lesson.notes) {
      if (!idPattern.test(n.id)) fail(where(`bad note id ${n.id}`));
      if (ids.has(n.id)) fail(where(`duplicate note id ${n.id}`));
      ids.add(n.id);
      const type = config.note_types[n.type];
      if (!type) { fail(where(`note ${n.id} has unknown type "${n.type}"`)); continue; }
      for (const field of type.required) if (n[field] === undefined || n[field] === '') fail(where(`${n.type} "${n.lemma}" is missing required field "${field}"`));
      for (const [field, allowed] of Object.entries(type.enums || {})) if (n[field] !== undefined && !allowed.includes(n[field])) fail(where(`${n.type} "${n.lemma}": "${field}" is "${n[field]}", allowed: ${allowed.join(', ')}`));
      if (n.check !== undefined && (typeof n.check !== 'string' || !n.check.trim() || n.check.length > 240)) fail(where(`"${n.lemma}": "check" must be a short reason (1-240 characters) for asking a native speaker`));
      if (n.ua && n.ua.length > 80) fail(where(`"${n.lemma}": "ua" is ${n.ua.length} characters. Keep it a short gloss (it is the front of a flashcard) and put the explanation in "explain_ua"`));
      // stress: the lemma with an acute accent on the stressed vowel (spávati); without the accent it must be the lemma again
      if (n.stress !== undefined) {
        const bare = n.stress.normalize('NFD').replace(new RegExp('([aeiouAEIOU])́', 'g'), '$1').normalize('NFC');
        const marks = (n.stress.normalize('NFD').match(new RegExp('[aeiouAEIOU]́', 'g')) || []).length;
        if (bare !== n.lemma.normalize('NFC') || marks < 1) fail(where(`"${n.lemma}": "stress" must be the lemma with an acute accent on a vowel (got "${n.stress}")`));
      }
      if (n.forms !== undefined && !(Array.isArray(n.forms) && n.forms.every((f) => typeof f === 'string' && f.trim()))) fail(where(`"${n.lemma}": "forms" must be a list of non-empty strings`));
    }
    for (const id of lesson.reading.highlight) if (!lesson.notes.some((n) => n.id === id)) fail(where(`reading highlight points at unknown note ${id}`));

    // vocabulary known up to and including this lesson
    (lesson.service_words || []).forEach((w) => known.add(w.toLowerCase()));
    for (const n of lesson.notes) {
      tokens(n.lemma).forEach((t) => known.add(t));
      (n.plural || []).forEach((p) => known.add(p));
      (n.forms || []).forEach((f) => tokens(f).forEach((t) => known.add(t)));   // other attested forms of the word (a declined noun, a conjugated verb)
      for (const r of n.paradigm || []) { tokens(r.pronoun).forEach((t) => known.add(t)); tokens(r.form).forEach((t) => known.add(t)); }
    }

    // sentences for the level audit; every practice item needs accepted answers
    const sentences = [];
    lesson.examples.forEach((e, i) => sentences.push([`examples[${i}]`, sentenceOf(e)]));
    lesson.reading.sentences.forEach((s, i) => sentences.push([`reading[${i}]`, sentenceOf(s)]));
    (Array.isArray(lesson.rule) ? lesson.rule : lesson.rule ? [lesson.rule] : []).forEach((rule, ri) => (rule.compare || []).forEach((c, ci) => c.examples.forEach((e, i) => sentences.push([`rule[${ri}].compare[${ci}].examples[${i}]`, sentenceOf(e)]))));
    lesson.practice.forEach((ex, ei) => {
      if (ex.type === 'comprehension') {
        const ps = ex.passage && ex.passage.paragraphs;
        if (!Array.isArray(ps) || !ps.length || ps.some((p) => typeof p !== 'string' || !p.trim())) fail(where(`practice[${ei}:comprehension] needs passage.paragraphs (a list of paragraphs)`));
        else {
          ps.forEach((p, pi) => sentences.push([`practice[${ei}:comprehension].passage[${pi}]`, p]));
          const words = ps.join(" ").split(/ +/).length;   // a long reading text: 120-350 words is the aim, outside that is only a nudge
          if (words < 120 || words > 350) console.log(`NOTE ${lang}/${file}: practice[${ei}] comprehension text has ${words} words, the aim is 120-350`);
        }
      }
      if (ex.type === 'listening') {
        // the recording: one voice (audio_text) or a dialogue (lines: [{speaker, voice, text}], voice "a" = the teacher, "b" = the second voice)
        if (ex.lines && (!Array.isArray(ex.lines) || !ex.lines.length || ex.lines.some((l) => !l.text || (l.voice && !['a', 'b'].includes(l.voice))))) fail(where(`practice[${ei}:listening] "lines" must be a list of {text, speaker?, voice? a|b}`));
        else if (!ex.audio || !(ex.audio_text || ex.lines)) fail(where(`practice[${ei}:listening] needs audio and audio_text (the recording's words) or lines`));
        else if (ex.lines) ex.lines.forEach((l, li) => sentences.push([`practice[${ei}:listening].lines[${li}]`, l.text]));
        else sentences.push([`practice[${ei}:listening].audio_text`, ex.audio_text]);
      }
      (ex.extra || []).forEach((e, i) => sentences.push([`practice[${ei}:${ex.type}].extra[${i}]`, e]));
      for (const [ii, item] of (ex.items || []).entries()) {
        const at = `practice[${ei}:${ex.type}].items[${ii}]`;
        if (ex.type === 'matching') {
          if (!item.prompt || !item.answer) fail(where(`${at} needs a prompt and an answer`));
          // a prompt with no Latin letters is a Ukrainian gloss, not text in the language being learned; only that language is level-audited
          if (/[A-Za-z]/.test(item.prompt)) sentences.push([at + ' prompt', item.prompt]);
          sentences.push([at + ' answer', item.answer]);
          continue;
        }
        if (!item.accepted || !item.accepted.length) fail(where(`${at} has no accepted answers`));
        if (item.choices !== undefined) {
          if (!['translate', 'listening', 'comprehension'].includes(ex.type)) fail(where(`${at}: "choices" is only for translate, listening and comprehension items`));
          else if (!Array.isArray(item.choices) || item.choices.length < 2 || new Set(item.choices).size !== item.choices.length) fail(where(`${at}: "choices" needs at least 2 different options`));
          else if (!item.accepted.every((a) => item.choices.includes(a))) fail(where(`${at}: every accepted answer must be one of the choices`));
          else item.choices.forEach((c) => { if (/[A-Za-z]/.test(c) && !/[\u0400-\u04FF]/.test(c)) sentences.push([at + ' choice', c]); });   // options in the language being learned are level-audited, Ukrainian ones (true / false) are not
        }
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
        } else if (ex.type === 'translate' || ex.type === 'listening' || ex.type === 'comprehension') {
          item.accepted.forEach((a) => { if (/[A-Za-z]/.test(a) && !/[\u0400-\u04FF]/.test(a)) sentences.push([at + ' answer', a]); });   // a Ukrainian answer (true / false, yes / no) is not level-audited
        }
      }
    });

    // Size rules (learner's decision): the first language from lesson 12 on, 8-12 per exercise; a language can set its own in config.size_rules.
    if (lesson.order >= size.from_lesson) {
      const inRange = (n, [lo, hi], what) => { if (n < lo || n > hi) fail(where(`${what}: ${n} items, expected ${lo}-${hi}`)); };
      inRange(lesson.examples.length, size.examples, 'examples');
      lesson.practice.forEach((ex, ei) => {
        const label = `practice[${ei}:${ex.type}]`;
        if (ex.type === 'dictation') {
          const words = dictationNotes(lesson, ex, lessons.map((l) => l.data)).length;
          if (ex.words) for (const w of ex.words) if (!dictationNotes(lesson, { words: [w] }, lessons.map((l) => l.data)).length) fail(where(`${label}: dictation word "${w}" is not a note with audio in this or an earlier lesson`));
          inRange(Math.min(words, ex.max || words), [1, size.dictation_max], label + ' (words per attempt, set "max" to limit)');
        } else if (ex.type === 'matching') inRange(ex.items.length, size.matching, label);
        else if (ex.type === 'comprehension') inRange(ex.items.length, size.comprehension || [4, 10], label);
        else if (ex.type === 'listening') inRange(ex.items.length, size.listening || [3, 8], label);
        else inRange(ex.items.length, size.items, label);
      });
    }

    // readability nudge (a warning, not an error): long rule text is heavy for a beginner
    for (const [ri, rule] of (Array.isArray(lesson.rule) ? lesson.rule : lesson.rule ? [lesson.rule] : []).entries()) {
      const long = (rule.points_ua || []).filter((p) => p.length > 300).length + (rule.summary_ua && rule.summary_ua.length > 300 ? 1 : 0);
      if (long) console.log(`NOTE ${lang}/${file}: rule card ${ri + 1} has ${long} passage(s) over 300 characters, consider trimming`);
    }

    const unknown = new Map();
    // A word typed without its diacritic (Oekraine for Oekraïne, kuca for kuća) is accepted by the level audit, so it counts as known too.
    const fold = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const knownFolded = new Set([...known].map(fold));
    for (const [at, text] of sentences) for (const t of tokens(text)) if (!known.has(t) && !knownFolded.has(fold(t))) (unknown.get(t) || unknown.set(t, []).get(t)).push(at);
    console.log(`${lang}/${file}: ${lesson.notes.length} notes, ${lesson.examples.length} examples, ${lesson.reading.sentences.length} reading sentences, ${lesson.practice.length} exercises${lesson.rule ? ', rule card' : ''}`);
    if (unknown.size) {
      console.log("WARNING words outside the vocabulary learned so far:");
      for (const [t, ats] of unknown) console.log(`  "${t}" x${ats.length}, e.g. ${ats[0]}`);
    } else console.log('level audit: every word is inside the vocabulary learned so far');
  }
}

const wanted = process.argv.slice(2);
const langs = wanted.length ? wanted : fs.readdirSync(contentDir, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(contentDir, d.name, 'config.json'))).map((d) => d.name).sort();
for (const lang of langs) validateLanguage(lang);
process.exit(errors ? 1 : 0);
