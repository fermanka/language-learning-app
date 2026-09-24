# ADR 0004: Extra practice written by the teacher for one learner

Date: 2026-09-24
Status: accepted (decided with the learner)

## Context

The teacher used to wait for the results of the learner's earlier lessons before writing the next ones, so that the errors could be worked into the coming lessons. That made lesson writing depend on the learner's progress. The learner proposed the opposite: the lessons stay generic and can be written ahead, and a separate block at the end of the practice holds sentences chosen for her own mistakes.

## Decisions

1. **A sub-block "Додаткова практика" at the end of the practice of a lesson, from Les 5 on.** 10 to 20 items, in any mix of the existing exercise types (translate, transform, verbform, gaps, matching), chosen by the teacher from where and how the learner actually goes wrong. The teacher replaces the set as errors change.
2. **It is private, so it lives in the learner's data folder, not in this repository.** A set of sentences built from someone's mistakes is data about her. The file is `extra/<lang>/les-NN.json` next to `progress/` and `recordings/` (for example `language-app-data/extra/nl/les-05.json`). Only the format, the validator and a synthetic example (`docs/extra-practice-example/`) are public.
3. **Same ownership rule as content:** the teacher writes the file, the page only reads it, the page never writes into `extra/`. The learner's answers go into the progress log like any other exercise, under the id `x:<exercise id>`, so the teacher's digest shows what was missed and the loop closes.
4. **Same exercise shapes as lesson practice.** The page reuses the renderer and the grader; nothing new to learn or to break. Dictation is not allowed (it needs a lesson's notes and audio). Every exercise has a permanent lowercase `id`, so its answer history survives when the teacher rewrites the set.
5. **Optional.** The block appears only when the file exists. It does not count towards a lesson's percentage and never blocks "lesson done". A missing file is normal and shows nothing.
6. **Failures are visible.** A file that is not valid JSON, or fails the format check, is reported under the practice ("скажи Марійке") instead of being ignored or half-drawn.
7. **Checked before it reaches the learner.** `npm run validate:extra` (or `node scripts/validate-extra.js <data-folder>`) checks the format and runs the same level audit as lessons: a sentence may only use the words of lessons 1..N for `les-NN.json`. The teacher has no shell, so this is run for her.

## Costs and open items

- Extra practice exists only on the machine that holds the private folder. For phone review (Phase 2) it belongs to the open question of where private data lives.
- Resetting a lesson also blanks the saved answers of its extra exercises on screen (the log keeps them), because the reset clears every exercise of that lesson.
- The teacher's agent instructions do not yet describe this workflow; until they do, the format document `docs/extra-practice-format.md` is what she is pointed at.

## Amendment 2026-09-24: when a set is written

- **Trigger.** When lesson N reaches 100% (all its exercises at full marks in the latest attempt, plus the reading recording), the extra-practice set for lesson N+1 can be written from the learner's fresh results. Sets exist from Les 5 on, so the first trigger is Les 4 at 100%.
- **`npm run extra:needed`** (`scripts/extra-needed.js`) lists the lessons waiting for a set. It uses the same `lessonProgress()` function as the page, so "100%" means one thing in both places.
- **Semi-automatic on purpose.** The page is static and cannot start the teacher, and a scheduled job writing learner-facing content unseen was judged premature. The check runs at the start of the learner's assistant session; the assistant reports what is needed and asks before the teacher is asked to write.
