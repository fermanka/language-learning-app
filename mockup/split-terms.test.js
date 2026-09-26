// Tests for splitTerms(): it cuts a sentence into plain text and highlighted note terms.
// Regression: with NO notes (a lesson that highlights nothing in its reading) it used to loop forever.
// Run: node mockup/split-terms.test.js
const { splitTerms } = require('./lesson.js');

let bad = 0;
const t = (name, ok) => { if (!ok) { bad++; console.log('FAIL', name); } };
const join = (parts) => parts.map((p) => (p.note ? `[${p.text}]` : p.text)).join('');

const noun = { id: 'a', type: 'noun', article: 'de', lemma: 'tafel', plural: ['tafels'] };

t('no notes: the sentence comes back as one plain piece (and does not hang)', JSON.stringify(splitTerms('Ik heb gewerkt.', [])) === JSON.stringify([{ text: 'Ik heb gewerkt.' }]));
t('no notes and an empty sentence: nothing', splitTerms('', []).length === 0);
t('a term in the sentence is marked (with its article)', join(splitTerms('De tafel is groot.', [noun])) === '[De tafel] is groot.');
t('a bare lemma is marked too', join(splitTerms('Ik zie tafel.', [noun])) === 'Ik zie [tafel].');
t('a plural is found too', join(splitTerms('Twee tafels.', [noun])) === 'Twee [tafels].');
t('a sentence without the term stays plain', join(splitTerms('Het bed is klein.', [noun])) === 'Het bed is klein.');
t('a part of a longer word is not marked', join(splitTerms('De tafelpoot.', [noun])) === 'De tafelpoot.');

if (bad) process.exit(1);
console.log('SPLIT TERMS TESTS PASSED');
