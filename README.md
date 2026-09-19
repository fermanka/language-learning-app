# language-learning-app

A small web app for learning a language from a teacher's lessons, one learner at a time.
First language: Dutch, taught by an AI coach. Croatian, English and Spanish are planned.

## Status

Early. What exists today:

- `content/nl/lessons/` - eleven Dutch lessons as JSON (new material, examples, a reading text, exercises with answer keys).
- `scripts/validate-content.js` - checks every lesson file (structure, permanent ids, answer keys) and audits that a sentence never uses a word that has not been taught yet.
- `mockup/` - a plain-HTML lesson page (no build step) with audio playback, self-checking exercises, a dark and a light (papyrus) theme, and a progress log.
- `docs/adr/` - the decisions behind the design (why data lives where it lives, the lesson file format).

There is no server and no account system, on purpose.

## Try the mockup

```bash
node scripts/validate-content.js      # check the lessons
node mockup/build-data.js             # bundles the lesson JSON for the page (file:// pages cannot fetch())
node mockup/progress-store.test.js    # progress log tests
node mockup/smoke-test.js             # runs the page code against a fake DOM
```

Then open `mockup/lesson.html` in Chrome or Edge. Audio is not part of this repository: copy
`mockup/audio-paths.example.js` to `mockup/audio-paths.local.js` and point it at your own audio folders.

## Privacy: code and content are public, the learner's data is not

- Lessons are content written by the teacher. They live in `content/` and are public.
- Everything about the learner (progress, answers, recordings, notes, photos of notes) is **never** committed here.
  The app writes progress to a folder the learner picks, outside this repository, as an append-only log
  (one JSON event per line, one file per day per device). `.gitignore` also blocks those paths as a second layer.
- Audio files are generated or supplied separately and are not committed either.

## Lesson files

One JSON file per lesson. Every note (word) has a permanent id that is generated once and never changes, so a corrected typo
cannot orphan the learner's review history. See `docs/adr/0002-lesson-files-and-content-sources.md`.
