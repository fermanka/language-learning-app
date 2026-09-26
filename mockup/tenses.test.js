// Tests for the tenses tab engine: the composed forms, verb lookup, and the validator of the two data files.
// The data is docs/verbs-example (test data only); the real files are written by the teacher.
// Run: node mockup/tenses.test.js
const fs = require('fs');
const path = require('path');
const T = require('./tenses.js');

const dir = path.join(__dirname, '..', 'docs', 'verbs-example');
const tenses = JSON.parse(fs.readFileSync(path.join(dir, 'tenses.json'), 'utf8'));
const verbs = JSON.parse(fs.readFileSync(path.join(dir, 'verbs.json'), 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));

let bad = 0;
const t = (name, ok) => { if (!ok) { bad++; console.log('FAIL', name); } };
const row = (verb, id) => T.conjugate(tenses, T.findVerb(verbs, verb)).find((r) => r.tense.id === id).cells;
const line = (c) => T.PERSONS.map((p) => c[p]).join(' | ');

// ---- the example data is valid
const ok = T.validate(tenses, verbs);
t('the example data has no errors', ok.errors.length === 0);
t('the example data has no warnings', ok.warnings.length === 0);

// ---- composition: a regular verb with hebben
t('regular present', line(row('werken', 'ott')) === 'werk | werkt | werkt | werken | werken | werken');
t('regular simple past', line(row('werken', 'ovt')) === 'werkte | werkte | werkte | werkten | werkten | werkten');
t('perfect with hebben', line(row('werken', 'vtt')) === 'heb gewerkt | hebt gewerkt | heeft gewerkt | hebben gewerkt | hebben gewerkt | hebben gewerkt');
t('past perfect with hebben', row('werken', 'vvt').ik === 'had gewerkt' && row('werken', 'vvt').wij === 'hadden gewerkt');
t('future with gaan', row('werken', 'ottt').hij === 'gaat werken');
t('conditional', row('werken', 'ovtt').wij === 'zouden werken');
t('rare tenses take the verb\'s own auxiliary infinitive', row('werken', 'vttt').ik === 'zal gewerkt hebben' && row('werken', 'vvtt').zij === 'zouden gewerkt hebben');

// ---- the auxiliary follows the verb
t('perfect with zijn', line(row('gaan', 'vtt')) === 'ben gegaan | bent gegaan | is gegaan | zijn gegaan | zijn gegaan | zijn gegaan');
t('past perfect with zijn', row('gaan', 'vvt').ik === 'was gegaan' && row('gaan', 'vvt').zij === 'waren gegaan');
t('rare tenses with zijn', row('gaan', 'vttt').ik === 'zal gegaan zijn' && row('gaan', 'vvtt').ik === 'zou gegaan zijn');

// ---- irregular forms come from the data, not from a rule
t('irregular simple past', line(row('eten', 'ovt')) === 'at | at | at | aten | aten | aten');
t('irregular participle', row('eten', 'vtt').hij === 'heeft gegeten');

// ---- separable verb: the prefix goes to the end in a main clause, the participle and infinitive stay whole
t('separable present', line(row('opstaan', 'ott')) === 'sta op | staat op | staat op | staan op | staan op | staan op');
t('separable simple past', row('opstaan', 'ovt').hij === 'stond op' && row('opstaan', 'ovt').wij === 'stonden op');
t('separable perfect', row('opstaan', 'vtt').ik === 'ben opgestaan');
t('separable future and conditional keep the infinitive whole', row('opstaan', 'ottt').ik === 'ga opstaan' && row('opstaan', 'ovtt').jij === 'zou opstaan');

// ---- every tense and every person gets a non-empty cell, and no slot is left open
const all = T.conjugate(tenses, verbs.verbs[0]);
t('one row per tense, in the order of the file', all.length === tenses.tenses.length && all.every((r, i) => r.tense.id === tenses.tenses[i].id));
t('no empty cell and no open brace', verbs.verbs.every((v) => T.conjugate(tenses, v).every((r) => T.PERSONS.every((p) => r.cells[p] !== '' && !/[{}]/.test(r.cells[p])))));

// ---- lookup
t('lookup ignores case and spaces', T.findVerb(verbs, '  Opstaan ') && T.findVerb(verbs, '  Opstaan ').inf === 'opstaan');
t('lookup of a verb that is not in the list gives null (the page never guesses)', T.findVerb(verbs, 'zwemmen') === null);
t('lookup of an empty text gives null', T.findVerb(verbs, '') === null && T.findVerb(verbs, '   ') === null);
t('lookup does not match a part of a verb', T.findVerb(verbs, 'stan') === null);
const dia = clone(verbs); dia.verbs[0].inf = 'reïzen'; dia.verbs[0].prefix = '';
t('a diaeresis may be left out when typing', T.findVerb(dia, 'reizen') && T.findVerb(dia, 'reizen').inf === 'reïzen');

// ---- learned tenses
const done = (n) => n <= 26;
t('a tense is learned when the lesson that teaches it is done', T.learned(tenses.tenses[0], done) && T.learned(tenses.tenses[1], done) && !T.learned(tenses.tenses[2], done));
t('a tense with no lesson is never learned', !T.learned(tenses.tenses[3], () => true));

// ---- the validator catches bad data
const errs = (mutate, which = 'both') => { const a = clone(tenses), b = clone(verbs); mutate(a, b); return T.validate(a, b).errors; };
t('missing person form in a verb', errs((a, b) => { delete b.verbs[0].past.jullie; }).some((e) => e.includes('"past"')));
t('missing participle', errs((a, b) => { delete b.verbs[1].ptc; }).some((e) => e.includes('"ptc"')));
t('unknown auxiliary of a verb', errs((a, b) => { b.verbs[0].aux = 'zullen'; }).some((e) => e.includes('"aux"')));
t('unknown slot in a template', errs((a) => { a.tenses[0].template = '{verb.present} {nothing}'; }).some((e) => e.includes('unknown slot')));
t('unknown slot kind in a template', errs((a) => { a.tenses[0].template = '{verb.future}'; }).some((e) => e.includes('unknown slot')));
t('missing auxiliary in tenses.json', errs((a) => { delete a.aux.zullen; }).some((e) => e.includes('aux "zullen"')));
t('duplicate tense id', errs((a) => { a.tenses[1].id = a.tenses[0].id; }).some((e) => e.includes('duplicate id')));
t('since_lesson must be a number or null', errs((a) => { a.tenses[0].since_lesson = 'Les 1'; }).some((e) => e.includes('since_lesson')));
t('the default verb must exist', errs((a, b) => { b.default = 'zwemmen'; }).some((e) => e.includes('"default"')));
t('a chip must exist', errs((a, b) => { b.chips = ['zwemmen']; }).some((e) => e.includes('chip')));
t('at most four chips', errs((a, b) => { b.chips = ['werken', 'gaan', 'eten', 'opstaan', 'werken']; }).some((e) => e.includes('chips')));
t('duplicate verb', errs((a, b) => { b.verbs[1].inf = 'werken'; }).some((e) => e.includes('duplicate verb')));
t('prefix must open the infinitive', errs((a, b) => { b.verbs[3].prefix = 'aan'; }).some((e) => e.includes('does not start with the prefix')));
t('a check reason must be short text', errs((a, b) => { b.verbs[2].check = ''; }).some((e) => e.includes('"check"')));
t('persons must be the six in order', errs((a) => { a.persons.reverse(); }).some((e) => e.includes('"persons"')));
t('a missing file is reported', T.validate(null, verbs).errors.length === 1 && T.validate(tenses, undefined).errors.length === 1);
const warn = clone(verbs); warn.verbs[3].ptc = 'gestaan';
t('a participle without the prefix is only a warning', T.validate(tenses, warn).errors.length === 0 && T.validate(tenses, warn).warnings.length === 1);

if (bad) process.exit(1);
console.log('TENSES TESTS PASSED');
