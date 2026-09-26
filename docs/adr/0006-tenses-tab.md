# ADR 0006: Tenses tab with a conjugation table for one verb

Status: accepted (2026-09-26, the learner's request). Format: `docs/tenses-format.md`.

## Context

The learner asked for a table of the Dutch tenses, as English grammar books have, and for a field where she can type an infinitive and see the table conjugate it. Dutch verbs cannot all be conjugated by one rule: regular verbs follow the 't kofschip, irregular ones (`eten` gives `at`, `gegeten`) and `zijn` verbs do not, and separable verbs put the prefix in different places. A rule engine would silently produce wrong forms such as `eette`, which is worse than showing nothing.

## Decision

1. **Data-first, no guessing.** The teacher writes a verb file (`verbs.json`) with every form in full and a tenses file (`tenses.json`) with the templates and the four auxiliary verbs. The page only fills templates. A verb that is not in the list gets a message, not a guess.
2. **All Dutch words live in the data.** The code (`mockup/tenses.js`) contains only formulas and slot names, no Dutch word. A wrong form is a wrong data entry, visible in a public file and marked with `check` for a native speaker.
3. **The table follows the learner.** A tense whose lesson is not done yet is greyed out ("пізніше"), so she sees what is learned and what is next. The tab stays hidden until both data files exist and pass validation.
4. **Quick buttons and a default verb** are data too (`chips`, `default`), so the teacher chooses the contrasts.

## Consequences

- One extra job for the teacher: write the two files and add a verb whenever a new lesson brings one. This is small next to a lesson.
- A missing verb is a data gap, not a bug. A later "ask the teacher to add this verb" button is postponed by the learner's decision.
- The rare tenses can be shown greyed out, so the table is also a small overview of the whole system, not only of what is taught.
- Alternative not chosen: a rule-based conjugator with a table of exceptions. Rejected for the wrong-form risk above.
