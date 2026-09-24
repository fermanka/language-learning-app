// Extra practice: exercise sets the teacher writes for one learner into the learner's PRIVATE data folder
// (extra/<lang>/les-NN.json), never into this repository. The page only reads them.
// Same exercise shapes as lesson practice, so the page reuses its renderer and grader. Format: docs/extra-practice-format.md
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ExtraPractice = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const TYPES = ['translate', 'transform', 'verbform', 'gaps', 'matching'];   // dictation needs lesson notes and audio
  const ID = /^[a-z0-9][a-z0-9-]*$/;
  const str = (v) => typeof v === 'string' && v.trim() !== '';
  const strList = (v) => Array.isArray(v) && v.length > 0 && v.every(str);
  const gapCount = (text) => (text.match(/___/g) || []).length;

  // Returns { errors, warnings, exercises }. Errors mean the page must not render the set; warnings are for the teacher.
  function validateExtra(data, lessonId) {
    const errors = [], warnings = [];
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { errors: ['the file is not a JSON object'], warnings, exercises: [] };
    if (data.lesson !== lessonId) errors.push(`"lesson" is ${JSON.stringify(data.lesson)}, expected "${lessonId}"`);
    if (!Array.isArray(data.exercises) || !data.exercises.length) { errors.push('"exercises" must be a non-empty list'); return { errors, warnings, exercises: [] }; }
    const seen = new Set();
    let items = 0;
    data.exercises.forEach((ex, ei) => {
      const at = `exercises[${ei}]`, bad = (m) => errors.push(`${at}: ${m}`);
      if (!ex || typeof ex !== 'object') { bad('not an object'); return; }
      if (!str(ex.id) || !ID.test(ex.id)) bad(`"id" must be lowercase letters, digits and dashes (got ${JSON.stringify(ex.id)})`);
      else if (seen.has(ex.id)) bad(`duplicate id "${ex.id}"`);
      else seen.add(ex.id);
      if (!TYPES.includes(ex.type)) { bad(`unknown type ${JSON.stringify(ex.type)} (allowed: ${TYPES.join(', ')})`); return; }
      if (!str(ex.instruction_ua)) bad('"instruction_ua" is missing');
      if (!Array.isArray(ex.items) || !ex.items.length) { bad('"items" must be a non-empty list'); return; }
      if (ex.type === 'gaps' && !strList(ex.bank)) bad('gaps needs a "bank" (list of words)');
      ex.items.forEach((it, ii) => {
        const iat = `${at}.items[${ii}]`, ibad = (m) => errors.push(`${iat}: ${m}`);
        if (!it || typeof it !== 'object') { ibad('not an object'); return; }
        if (!it.example) items++;
        if (ex.type === 'matching') { if (!str(it.prompt) || !str(it.answer)) ibad('needs "prompt" and "answer"'); return; }
        if (ex.type === 'translate' || ex.type === 'transform') { if (!str(it.prompt)) ibad('needs "prompt"'); if (!strList(it.accepted)) ibad('needs "accepted" (list of answers)'); }
        else if (ex.type === 'verbform') {
          if (!str(it.text) || gapCount(it.text) !== 1) ibad('needs "text" with exactly one ___');
          if (!str(it.cue)) ibad('needs "cue" (the infinitive; it is the only hint on screen)');
          if (!strList(it.accepted)) ibad('needs "accepted" (list of answers)');
        } else if (ex.type === 'gaps') {
          if (!str(it.text)) ibad('needs "text"');
          else if (!Array.isArray(it.accepted) || it.accepted.length !== gapCount(it.text) || !it.accepted.every(strList)) ibad('"accepted" needs one list of answers per ___');
          if (!str(it.hint)) ibad('needs "hint"');
        }
      });
    });
    if (!errors.length && (items < 10 || items > 20)) warnings.push(`${items} items in total, the plan is 10-20`);
    return { errors, warnings, exercises: errors.length ? [] : data.exercises };
  }

  // Dutch sentences of one exercise, for the level audit ([where, text] pairs).
  function sentencesOf(ex, at) {
    const out = [];
    if (ex.type === 'matching') (ex.extra || []).forEach((e, i) => out.push([`${at}.extra[${i}]`, e]));
    (ex.items || []).forEach((it, ii) => {
      const w = `${at}.items[${ii}]`;
      if (ex.type === 'matching') { if (/[A-Za-z]/.test(it.prompt)) out.push([w + ' prompt', it.prompt]); out.push([w + ' answer', it.answer]); }
      else if (ex.type === 'translate') it.accepted.forEach((a) => out.push([w + ' answer', a]));
      else if (ex.type === 'transform') { out.push([w, it.prompt]); it.accepted.forEach((a) => out.push([w + ' answer', a])); }
      else if (ex.type === 'verbform') out.push([w, it.text]);
      else if (ex.type === 'gaps') { out.push([w, it.text]); it.accepted.forEach((g) => g.forEach((a) => out.push([w + ' answer', a]))); }
    });
    return out;
  }

  return { validateExtra, sentencesOf, TYPES };
});
