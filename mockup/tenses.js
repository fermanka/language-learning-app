// Tenses tab: composes the table of Dutch tenses for ONE verb from the teacher's data files. Format: docs/tenses-format.md
//   content/nl/tenses.json  the tenses, their templates and the auxiliary verbs (hebben, zijn, gaan, zullen)
//   content/nl/verbs.json   the verbs the learner may look up: finite forms, participle, auxiliary
// This file holds only the FORMULAS (which template slot is filled with which form). Every Dutch word comes from the data,
// so a wrong form can only be a wrong data entry, which the teacher can see and fix; the page never guesses a form by rule.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Tenses = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const PERSONS = ['ik', 'jij', 'hij', 'wij', 'jullie', 'zij'];
  const AUX_NAMES = ['hebben', 'zijn', 'gaan', 'zullen'];   // the auxiliary verbs every tenses.json must describe
  const str = (v) => typeof v === 'string' && v.trim() !== '';
  const allPersons = (o) => o && typeof o === 'object' && PERSONS.every((p) => str(o[p]));

  // Slots a template may use: {verb.present} {verb.past} {prefix} {ptc} {inf}
  // {aux.present} {aux.past} {aux.inf} (the verb's OWN auxiliary: hebben or zijn) and {<name>.present|past|inf} for hebben, zijn, gaan, zullen.
  const SLOT = /\{([a-z]+)(?:\.([a-z]+))?\}/g;
  function slotOk(a, b) {
    if (!b) return ['prefix', 'ptc', 'inf'].includes(a);
    if (a === 'verb') return b === 'present' || b === 'past';
    return (a === 'aux' || AUX_NAMES.includes(a)) && ['present', 'past', 'inf'].includes(b);
  }

  // Returns { errors, warnings } for the two data files. Errors mean the tab must stay hidden.
  function validate(tenses, verbs) {
    const errors = [], warnings = [];
    if (!tenses || typeof tenses !== 'object') return { errors: ['tenses.json is missing or not an object'], warnings };
    if (!verbs || typeof verbs !== 'object') return { errors: ['verbs.json is missing or not an object'], warnings };

    if (!str(tenses.intro_ua)) errors.push('tenses: "intro_ua" is missing');
    if (tenses.points_ua !== undefined && !(Array.isArray(tenses.points_ua) && tenses.points_ua.every(str))) errors.push('tenses: "points_ua" must be a list of texts');
    if (!Array.isArray(tenses.persons) || tenses.persons.length !== PERSONS.length || !tenses.persons.every((p, i) => p && p.id === PERSONS[i] && str(p.label))) errors.push('tenses: "persons" must list ' + PERSONS.join(', ') + ' in this order, each with a "label"');

    const aux = tenses.aux || {};
    for (const name of AUX_NAMES) {
      const a = aux[name];
      if (!a) { errors.push(`tenses: aux "${name}" is missing`); continue; }
      if (!str(a.inf)) errors.push(`tenses: aux "${name}" has no "inf"`);
      if (!allPersons(a.present)) errors.push(`tenses: aux "${name}" needs "present" forms for ${PERSONS.join(', ')}`);
      if (!allPersons(a.past)) errors.push(`tenses: aux "${name}" needs "past" forms for ${PERSONS.join(', ')}`);
    }

    if (!Array.isArray(tenses.tenses) || tenses.tenses.length === 0) errors.push('tenses: "tenses" must be a non-empty list');
    else {
      const seen = new Set();
      tenses.tenses.forEach((t, i) => {
        const at = `tenses[${i}]${t && t.id ? ` (${t.id})` : ''}`;
        if (!t || !str(t.id)) { errors.push(`${at}: "id" is missing`); return; }
        if (seen.has(t.id)) errors.push(`${at}: duplicate id`);
        seen.add(t.id);
        for (const f of ['name_nl', 'name_ua', 'formula_ua', 'freq_ua']) if (!str(t[f])) errors.push(`${at}: "${f}" is missing`);
        if (!(t.since_lesson === null || Number.isInteger(t.since_lesson))) errors.push(`${at}: "since_lesson" must be a lesson number or null (not taught yet)`);
        if (!str(t.template)) errors.push(`${at}: "template" is missing`);
        else for (const m of t.template.matchAll(SLOT)) if (!slotOk(m[1], m[2])) errors.push(`${at}: unknown slot ${m[0]} in the template`);
        if (str(t.template) && t.template.replace(SLOT, '').match(/[{}]/)) errors.push(`${at}: the template has a stray brace`);
      });
    }

    if (!Array.isArray(verbs.verbs) || verbs.verbs.length === 0) errors.push('verbs: "verbs" must be a non-empty list');
    else {
      const infs = new Set();
      verbs.verbs.forEach((v, i) => {
        const at = `verbs[${i}]${v && v.inf ? ` (${v.inf})` : ''}`;
        if (!v || !str(v.inf)) { errors.push(`${at}: "inf" is missing`); return; }
        if (infs.has(v.inf)) errors.push(`${at}: duplicate verb`);
        infs.add(v.inf);
        if (!str(v.ua)) errors.push(`${at}: "ua" is missing`); else if (v.ua.length > 80) errors.push(`${at}: "ua" is longer than 80 characters`);
        if (!['hebben', 'zijn'].includes(v.aux)) errors.push(`${at}: "aux" must be hebben or zijn`);
        if (!allPersons(v.present)) errors.push(`${at}: "present" needs forms for ${PERSONS.join(', ')}`);
        if (!allPersons(v.past)) errors.push(`${at}: "past" needs forms for ${PERSONS.join(', ')}`);
        if (!str(v.ptc)) errors.push(`${at}: "ptc" (participle) is missing`);
        if (v.prefix !== undefined && typeof v.prefix !== 'string') errors.push(`${at}: "prefix" must be a text (empty when the verb does not separate)`);
        if (str(v.prefix)) {
          if (!v.inf.startsWith(v.prefix)) errors.push(`${at}: the infinitive does not start with the prefix "${v.prefix}"`);
          if (str(v.ptc) && !v.ptc.startsWith(v.prefix)) warnings.push(`${at}: the participle does not start with the prefix "${v.prefix}", is it right?`);
        }
        if (v.check !== undefined && (!str(v.check) || v.check.length > 240)) errors.push(`${at}: "check" must be a short reason (1-240 characters)`);
      });
      if (!str(verbs.default) || !infs.has(verbs.default)) errors.push('verbs: "default" must be one of the listed verbs');
      if (verbs.chips !== undefined) {
        if (!Array.isArray(verbs.chips) || verbs.chips.length > 4) errors.push('verbs: "chips" must be a list of at most 4 verbs');
        else for (const c of verbs.chips) if (!infs.has(c)) errors.push(`verbs: chip "${c}" is not in the list`);
      }
    }
    return { errors, warnings };
  }

  // The value of one template slot for a verb and a person (undefined when the data lacks it).
  function slotValue(a, b, verb, aux, person) {
    if (!b) return a === 'prefix' ? (verb.prefix || '') : a === 'ptc' ? verb.ptc : verb.inf;
    if (a === 'verb') return verb[b][person];
    const name = a === 'aux' ? verb.aux : a;
    const src = aux[name];
    if (!src) return undefined;
    return b === 'inf' ? src.inf : src[b][person];
  }

  // The table for one verb: [{ tense, cells: { ik: 'werk', ... } }] in the order of tenses.json. A cell is the verb group
  // WITHOUT the pronoun (the column header carries it), for example "heb gewerkt" or "sta op".
  function conjugate(tenses, verb) {
    return tenses.tenses.map((tense) => {
      const cells = {};
      for (const p of PERSONS) cells[p] = tense.template.replace(SLOT, (_, a, b) => slotValue(a, b, verb, tenses.aux, p) || '').replace(/\s+/g, ' ').trim();
      return { tense, cells };
    });
  }

  // What the learner typed to a verb of the list: case and spaces do not matter, a diaeresis may be left out.
  const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const findVerb = (verbs, text) => (str(text) ? verbs.verbs.find((v) => fold(v.inf) === fold(text)) || null : null);

  // A tense counts as learned when the lesson that teaches it is done; null means "not taught yet".
  const learned = (tense, isLessonDone) => tense.since_lesson !== null && isLessonDone(tense.since_lesson);

  return { PERSONS, AUX_NAMES, validate, conjugate, findVerb, learned };
});
