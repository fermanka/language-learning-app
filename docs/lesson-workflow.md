# How a new lesson is made

Roles: the **learner** approves plans and studies in the app. The **teacher** (an AI coach) writes all language content. The **app builder** (a developer agent) integrates it, checks it, and publishes it. Nobody but the teacher writes Dutch sentences.

## The steps

1. **Ask.** The learner asks for the next lesson.
2. **Read.** The teacher reads the earlier lessons (structure and the vocabulary taught so far) and, optionally, a digest of the learner's mistakes (`npm run digest -- <progress folder>`). The digest is a short, read-only summary; the teacher never reads or edits the raw progress log.
3. **Plan.** The teacher proposes a short plan: topic, 6-8 new words (more only when needed), the rules to teach, what to revisit. The learner approves or edits it before anything is written.
4. **Write.** The teacher writes one lesson file in the format of the previous lessons (`content/<lang>/lessons/les-NN.json`), with placeholder ids (`"NEW"`), checks the spelling and plurals of new words in a dictionary, and names her sources.
5. **Integrate.** The app builder assigns permanent ids and fills the reading highlights, then runs the validator (`npm run validate`). Errors go back to the teacher as an exact list.
6. **Voice.** Every audio file the lesson refers to must exist; missing files are generated in the teacher's voice.
7. **Test and publish.** `npm run build`, `npm test`, then commit and push after the pre-push scan (explicit `git add`, staged-diff scan for personal data and local paths, no audio or learner data staged).
8. **Back up.** Everything the lesson needs that is not in git (drafts, plans, generated audio) is copied to the learner's own private cloud storage, never to this public repository. A lesson is not finished until that copy has run and its file counts match.

## Rules the validator enforces

- Permanent, unique note ids; required fields per note type (`content/<lang>/config.json`); nouns carry `de` or `het`.
- A sentence may only use words taught in this lesson or an earlier one (cumulative level audit); `service_words` declares little words in advance.
- `ua` is a short gloss (at most 80 characters); longer explanations go in `explain_ua`.
- Optional `check` on a note: a short Ukrainian reason (1-240 characters) why the word, form or usage could not be verified. The page shows a small "?" next to the word (a click shows the reason) and lists every marked word under the "?" button at the bottom of the Words page, for a native speaker to look at. The teacher removes the field once someone has confirmed the word. Not shown on flashcards.
- Every exercise item has accepted answers; gaps and answer groups agree.
- From lesson 12: 8-12 examples, 8-12 items per exercise, at most 12 words per dictation attempt.

## Rules that are not automated

- Every word lives in exactly one lesson.
- Ukrainian glosses use the natural form ("у мене є / немає").
- A matching exercise appears about every third or fourth lesson.
- Rule cards stay short: a beginner has to read them.
- What a card shows is what its recording says. If a recording says more than the written word (an article recorded inside a phrase), the note carries `audio_text` with the spoken text and the card shows it under the word. Two notes with the same spelling (a number and an article, a verb and a possessive) are told apart on the card by a label.
