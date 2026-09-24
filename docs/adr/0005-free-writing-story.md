# ADR 0005: Free writing ("Історія") at the end of the practice

Date: 2026-09-24
Status: accepted (decided with the learner; the teacher proposed the start lesson)

## Context

Every exercise so far has a right answer the page can check. The learner asked for a task where she has to compose sentences herself: a short story on a topic the teacher sets, written in a text field and then checked by the teacher for mistakes and coherence. Composing forces word order and articles to work without a prompt.

## Decisions

1. **A block "Історія" at the very end of the practice**, after the extra practice. Optional: it appears only when the teacher has written a topic for that lesson, does not count towards a lesson's 100% and never blocks "lesson done".
2. **From Les 11 on.** Before it the learner has no connecting words (`want`, `dus`, `daarna`, `ook`, `vandaag`), so five sentences would be a list, not a story. The teacher may add topics to lessons 11-17 afterwards.
3. **The topic is private teacher-written data**, like the extra practice: `stories/<lang>/les-NN.json` in the learner's data folder, read-only for the page, checked by `npm run validate:story`. Format: `docs/story-format.md`.
4. **No automatic marking.** The page counts sentences and locks the button until the minimum is reached; the checking is the teacher's job.
5. **The text is saved as a file** (`written/<lesson>.<timestamp>.txt`, one new file per sending, never overwritten) so the teacher can quote the learner's own words; the progress log only gets a `story_submitted` event (file name and sentence count), not the text. The learner's writing stays out of the public repository like every other personal file.
6. **The digest lists sendings** so the teacher knows a new text is waiting.
7. **Failures are visible.** A topic file that is unreadable or invalid is reported under the practice; a failed save leaves the text in the field.

## Costs and open items

- Checking is delayed: the learner tells the teacher (through the assistant) that a text is there. The page cannot start the teacher, same as for recordings.
- The page does not audit the words of the learner's text against the lessons learned so far. The teacher notes words outside the known vocabulary as "words she wanted" for future lessons.
- The text can only be sent from the computer that holds the folder; the phone stays flashcards-only.
- A sent story cannot be reloaded into the field; a new version is written from scratch or from the browser draft.
