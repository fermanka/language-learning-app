# ADR 0007: A second language (Croatian) next to the first

Status: accepted (2026-10-15, the learner's request). The first language is Dutch; the second is Croatian, taught by a different teacher.

## Context

The app was built around one language. The seams were planned from the start (`content/<lang>/`, a per-language `config.json`, lesson ids like `nl-les-05`, progress and extra-practice folders split by language), but the code still assumed Dutch in a few places: where lessons were loaded from, the `de/het` article on every noun, the sentence key `nl`, "Les N" and the teacher's name in many Ukrainian texts, and the validator.

## Decision

1. **A language is a folder plus a config, not a code path.** `content/<lang>/config.json` holds the name, teacher, voice, UI words (`ui`), the allowed note types with required fields and allowed values (`note_types`, `enums`), words that are always known (`always_known`) and the size rules (`size_rules`). The validator, the page and the audio tool read it. A language with no lessons yet is not offered.
2. **One language per page load.** The build writes `lessons.<lang>.data.js` and `tenses.<lang>.data.js` for each language and a small `languages.data.js`. A selector in the header (the old "Мова" label) saves the choice and reloads. Progress, cards and recordings follow the lesson and note ids, which carry the language, so nothing is mixed. New recordings of other languages get a `<lang>-` file prefix.
3. **Note types are data.** Croatian nouns carry `gender`, `gen_sg` and `plural` instead of an article; verbs carry `aspect`, `partner`, `pres_1sg`. The page writes a grammar hint line from whichever of these fields exist; no Croatian rule lives in the code. Added types (`clitic`, `false_friend`) are only config entries.
4. **`forms`.** Any note may list its other attested forms. The level audit matches words literally and has no grammar, so a highly inflected language needs the forms of a word to be declared; the page also highlights them in the reading.
5. **Sentence key.** New languages use `text`; the first language keeps `nl` (code reads either). Renaming the old key would touch every Dutch lesson and tool for no gain.
6. **Typed answers stay diacritic-strict** (`kuca` is not `kuća`): wanted for Croatian, where the spelling is examined but the pronunciation may be relaxed.
7. **Teacher tools take the language from the lesson file** (`finish-lesson`, `gen-audio`, `curriculum-summary`): ids, folders and the voice persona follow it.

## Consequences

- Adding a third language is a config, a content folder and a teacher, plus UI words in the config. The Dutch lessons were not changed.
- The tenses tab stays Dutch-only for now: it hides itself when a language has no tenses and verbs files.
- Not yet generalised (not needed until Croatian lesson 5 and 11): the extra-practice and story checkers and `extra-needed` still read the Dutch lessons only.
- The Croatian UI headings in the config are standard words picked by the developer; the teacher confirms them.
- Alternative not chosen: two separate pages or apps. Rejected: it would duplicate the review, progress and card code.
