# ADR 0002: Lesson files, and where lesson content comes from

Date: 2026-09-19
Status: accepted (decided with the learner), pilot on Les 1

## Decisions

1. **Only learned material is taken from the learner's notebook.** That means new words (with article and plural), verbs and their forms, adjectives, adverbs, and the rules. The sentences the learner wrote in her notebook are her own translation homework, they may contain errors, and they are private. They are never used as content.
2. **The teacher writes every sentence.** Examples, reading text and exercises for each lesson are written by the teacher (Marieke), using only words from lessons 1..N (the words of the current lesson and earlier ones, plus explicitly listed "service words"). The app does not author language content.
3. **A lesson is one JSON file:** `content/<lang>/lessons/les-NN.json`. JSON needs no parser dependency (browsers and Node read it natively). If coaches ever edit files by hand, revisit; YAML would then be worth a dependency receipt.
4. **Notes carry permanent ids** (`nl-` + 8 random hex characters, generated once, never changed, never derived from content). Review history will hang on these ids, so a corrected typo must not change one.
5. **Note types are data.** `content/<lang>/config.json` declares which fields each note type requires. A noun without `de`/`het` is a build error, not a warning.
6. **Every block and every exercise is optional in a lesson.** Some lessons cannot support all of them (Les 1 has no questions or negation yet, so no question/negation transform; the teacher also thinks a full reading text is thin at that level). The app shows only what a lesson contains.
7. **Two exercise kinds need no authoring:** the `dictation` exercise (listen, type the word with its article) is derived from the lesson's new words and their audio.
8. **`scripts/validate-content.js` is the gate.** It fails on structural errors and lists every word in a sentence that is outside the lesson's vocabulary. This is a level audit that does not depend on anyone remembering to do it.

## Audio

- Existing word audio stays where the teacher keeps it. New audio (verb forms, reading sentences) was generated with the teacher's voice through the existing `tts-telegram.py local ... --persona marieke --save` path and is kept, for now, in `language-app-data/drafts/audio/`, outside this repo.
- The teacher has no shell tool, so a person or the app-builder runs the generation. Where audio lives long-term (manifest, git or not) is still open.

## Costs and open items

- Verb-form and reading audio was produced by text-to-speech and has not been listened to by the teacher yet.
- Free-text answers are checked against an `accepted` list written by the teacher. For lessons with richer vocabulary this list may miss valid answers; the learner-marks-herself fallback stays available.
- The mockup resolves audio through relative paths to two sibling folders on this laptop. It is a throwaway, not the app.

## Addendum after Les 2 (2026-09-19)

9. **Rule card.** A lesson may carry an optional `rule` object: a title, a one-line summary, two comparison columns (each with the form, when it applies, 2-3 examples with the key form in `**bold**`, and a note) and short extra points. The two-column shape follows the textbook page the learner showed; Les 2 (`geen` versus `niet`) is the first lesson to use it.
10. **More note types.** `numeral` (with `digit`) and `function` (little words such as `geen`, `niet`, the article `een`). A note can set `"dictation": false`: the article `een` is spoken weakly, and its isolated audio would be the numeral, so it stays out of the dictation. The numeral `een` and the article `een` are two separate notes.
11. **Every example and reading sentence carries an audio reference**, generated with the teacher's voice. The learner listened to the Les 1 clips and approved them.
12. **Vocabulary is cumulative in the validator.** Les 2 may use the words of Les 1 and Les 2. The level audit reported no outside words for either lesson.
13. **Teacher's caution kept in the lesson, not in the app:** exercises for Les 2 deliberately avoid negation after a preposition of place with `een` (`in een huis` versus `in geen huis`). It needs its own explanation later.

## Addendum after Les 3 (2026-09-19)

14. **The teacher now writes the whole lesson file** (`les-NN.json`) herself; the app-builder only replaces the placeholder note ids with permanent ones, fills the reading highlights, runs the validator and generates any missing audio. This removed a whole class of transcription mistakes.
15. **`plural_only`** on a noun (`de kosten`): an empty `plural` list already means "no plural exists" (`de lach`), so plural-only nouns need their own flag.
16. **Highlighting matches bare forms** of a noun as well (`Hoeveel kamers`, `geen tijd`), because Dutch drops the article after a quantity word or `geen`.
17. **Audio speed** is a learner setting (1x, 0.75x, 0.5x) applied through the browser's `playbackRate` with pitch preserved. The setting is remembered on the learner's device only.
18. **Photo numbers are not page numbers.** The learner's photo N is printed page N up to photo 6, and printed page N+2 from photo 7 on, because printed pages 7 and 8 were not photographed. Drafts must cite both ("photo_7, printed page 9").

## Addendum after all 11 lessons (2026-09-19)

19. **Exercise type `matching`** (from Les 6): items with a `prompt` and an `answer`, plus optional `extra` answers that match nothing. The right-hand column is shuffled deterministically by a hash of the text; the first item is a solved example. Checking is exact against the item's answer.
20. **`rule` may be an array of cards** (from Les 7). A lesson with several rule areas gets several comparison cards; the smaller points go into `points_ua`.
21. **Three "little" note types are in use:** `function` (little words, question words, possessives, adverbs), `numeral` (cardinal and ordinal) and `adjective` (one note per form when the form changes, as `goed` / `goede`).
22. **The pipeline per lesson is now four commands:** the teacher writes `les-NN.json` (with `"id": "NEW"` placeholders), `finish-lesson.js` assigns permanent ids and fills the reading highlights, `validate-content.js` gates it, and `gen-audio.js` voices every missing file. The tools that touch the shared EA repo (`gen-audio.js`, `finish-lesson.js`) live outside this repo on purpose.
23. **Where the teacher's own lesson boundaries and the learner's notebook boundaries differ, the notebook wins for content** (for example the family words are in the audio folder of Les 8 but on the notebook pages of Les 9). Audio is found by file name, not by folder.
24. **Open, for the learner to decide:** whether the dictation of a long lesson should draw a random 8-10 words per attempt; and what the cut-off gloss of `maar` (Les 10) says.

## Addendum: progress, themes, and size of later lessons (2026-09-19)

25. **Progress is an append-only log.** `mockup/progress-store.js` writes one JSON event per line to `progress/<date>.<device>.ndjson` inside a folder the learner picks once (File System Access API, Chrome and Edge). Past lines are never rewritten. The current state (lessons done, best and last score per exercise) is a fold over the events; deleting derived state loses nothing. A damaged line is skipped and counted, never fatal. Events recorded before a folder is connected are queued and written on connect; a failed write is shown in red, never hidden.
26. **Events so far:** `lesson_done`, `exercise_checked` (with the wrong answers), `recording_saved` (the recording file itself goes to `recordings/`). Flashcard reviews will be a new event type.
27. **The folder handle is remembered** in the browser's IndexedDB; a new visit asks the browser to re-grant permission on a click.
28. **Two themes:** dark (default) and light in a warm sand ("papyrus") colour, chosen by the learner and remembered on her device only.
29. **Lessons 12 and later have smaller exercises** (the learner's decision): 8-12 examples and 8-12 items per exercise, at most 12 words per dictation attempt (`"max"` on a dictation). `validate-content.js` enforces it. Lessons 1-11 keep their sizes.
30. **Flashcards tab** sits between "Today" and "Texts". First step: it shows what the deck will contain. Spaced repetition (FSRS) is the next step.
31. **Changing the progress folder copies, never overwrites.** The "change folder" button copies the history (`progress/`) and the recordings (`recordings/`) into the new folder, skips any file the new folder already has, and then switches. The event log stays one continuous history.
32. **Backup location (learner's choice).** The progress folder can live inside the learner's own cloud-synced folder (a private folder in her Google Drive, not the shared family space), so the sync client is the backup. The log is append-only and each device writes its own day files, so two devices never write the same file.
33. **A gloss is a gloss.** `ua` is the short translation and the front or back of a flashcard, at most 80 characters (enforced). Explanations, examples and pronunciation hints go in the optional `explain_ua`, which the word list and the Words page show under the word. Lessons 3-12 were migrated mechanically: the text before the first parenthesis (or full stop) stayed in `ua`, the rest moved unchanged into `explain_ua`. No wording was changed; one gloss (`voor`, "для, за, перед") was built from the keywords of the teacher's own numbered list. The first version of lesson 12 showed why: its glosses averaged 310 characters.
34. **From lesson 12 the teacher writes the lesson herself** (no notebook needed). The flow: the learner asks for the next lesson; the teacher reads the previous lessons and the progress digest; she proposes a short plan (topic, 6-8 new words, rules, what to revisit) that the learner approves; the teacher writes the lesson file; the app-builder adds ids, runs the validator, generates audio, and commits. The teacher checks spelling and plurals of new words in a dictionary and names her sources.
35. **Pressing "check" again with the same answers is not a new attempt.** The log records an `exercise_checked` event only when the answers changed since the last check (a real session showed one wrong spelling counted four times in twelve seconds).
36. **A readability nudge.** The validator prints a NOTE (not an error) when a rule card has a passage over 300 characters.
