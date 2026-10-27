# Native-speaker check: confirming or correcting the "?" words

A note with a `check` field shows a "?" (the teacher could not verify it). Yulia can now settle each one in the app, with no name or date shown.

- Click the "?": under the reason there are **✓ Підтверджено** and **✎ Виправити** (a field for the right form, then Зберегти).
- The same buttons are in the list "? Слова для перевірки" at the bottom of the Words page, which also has **Скопіювати список для носія** (lesson, word, gloss, reason, one per line, to send to a speaker).
- Confirmed: the "?" disappears at once. Corrected: the "?" disappears and the word shows "Виправлення записано: ...". The corrections are also listed in the panel until they are put into the lesson.
- Decisions are events `{ "type": "note_verified", "note": <note id>, "status": "ok" | "fix", "fix": "..." }` in the progress folder (append-only, the latest one for a note wins). Lessons are not touched by the app.

Putting decisions into the lessons (run from the app repo):

```
node ../language-app-data/tools/apply-verification.js ../language-app-data --dry
node ../language-app-data/tools/apply-verification.js ../language-app-data
```

`ok` decisions: the script removes the `check` field. `fix` decisions: only listed; the teacher and the developer put the corrected form into the lemma, forms, examples and dictation, regenerate the audio of changed words, then run the script with `--clear-fixes`.
