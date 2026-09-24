# language-learning-app

A small web app for learning a language from a teacher's lessons, one learner at a time.
First language: Dutch, taught by an AI coach. Croatian, English and Spanish are planned.

## Status

Early. What exists today:

- `content/nl/lessons/` - eleven Dutch lessons as JSON (new material, examples, a reading text, exercises with answer keys).
- `scripts/validate-content.js` - checks every lesson file (structure, permanent ids, answer keys) and audits that a sentence never uses a word that has not been taught yet.
- `mockup/` - a plain-HTML lesson page (no build step) with audio playback, self-checking exercises, a dark and a light (papyrus) theme, a progress log, and flashcards with spaced repetition (FSRS).
- `docs/adr/` - the decisions behind the design (why data lives where it lives, the lesson file format).
- `mockup/extra-practice.js` + `docs/extra-practice-format.md` - the optional "Додаткова практика" block at the end of a lesson's practice: exercises the teacher writes for one learner into that learner's private data folder (`extra/<lang>/les-NN.json`). The page only reads them; check a file with `npm run validate:extra -- <data folder>`.

There is no server and no account system, on purpose.

## Try the mockup

```bash
npm install                           # once: installs the spaced-repetition library (ts-fsrs) into node_modules
npm run build                         # bundles the lesson JSON for the page (file:// pages cannot fetch())
npm test                              # validates the lessons, then runs the progress, flashcard and page tests
```

Then open `mockup/lesson.html` in Chrome or Edge. Audio is not part of this repository: copy
`mockup/audio-paths.example.js` to `mockup/audio-paths.local.js` and point it at your own audio folders.

## Privacy: code and content are public, the learner's data is not

- Lessons are content written by the teacher. They live in `content/` and are public.
- Everything about the learner (progress, answers, recordings, notes, photos of notes, the extra practice built from her mistakes) is **never** committed here.
  The app writes progress to a folder the learner picks, outside this repository, as an append-only log
  (one JSON event per line, one file per day per device). `.gitignore` also blocks those paths as a second layer.
- Audio files are generated or supplied separately and are not committed either.

## Lesson files

One JSON file per lesson. Every note (word) has a permanent id that is generated once and never changes, so a corrected typo
cannot orphan the learner's review history. See `docs/adr/0002-lesson-files-and-content-sources.md`.
