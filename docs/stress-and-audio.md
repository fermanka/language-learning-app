# Word stress and where audio is used (new Croatian lessons, 64 and later)

Decided by Yulia, 2026-10-27: she reads Croatian well; what she needs is to know which syllable is stressed.

## Stress

A word note may carry `stress`: the lemma with an acute accent on the stressed vowel, e.g. `"lemma": "spavati", "stress": "spávati"`.
The accent is only a position mark (no pitch accent). The word list and the verb card show the stressed form instead of the plain lemma;
answers, dictation and flashcards still use `lemma`. `validate-content.js` checks that removing the accent gives back the lemma exactly and
that at least one vowel carries it. Multi-word lemmas: mark each stressed word.

## Audio

From Lekcija 64 the teacher leaves `audio` out of:
- example sentences, reading sentences and rule-card examples (the app shows no speaker button where there is no `audio`; `gen-audio.js` skips them);

and keeps it only where hearing is the task:
- the word notes (`audio` on a note),
- `listening` exercises, `comprehension` passages with `audio`, and dictation words.

Earlier lessons keep the audio they already have.
