# ADR 0001: First scope and where data lives

Date: 2026-09-19
Status: accepted (decided with the learner)

## Decisions

1. **The first screen is the lesson page, not the flashcard review.**
   - `Today` opens the first lesson not yet marked done, in the order the teacher (Marieke) published them. It is not a calendar date.
   - The lesson page has four blocks: New material, Examples, Reading, Practice.
   - The flashcard review screen (spaced repetition, meant for the phone) is postponed until the lesson page works.
2. **Lessons are content, progress is private data, and they live in different places.**
   - Lessons (teacher-written texts, examples, exercises, answer keys) live in `content/<lang>/lessons/` in this public repo. Only the teacher writes there. The app reads it and never writes to it.
   - Progress (lessons marked done, the learner's answers, her audio recordings) lives in a folder **outside** this repo: `language-app-data/`, next to the clone. Never committed here.
3. **Chrome is the supported browser** (Edge works the same way). The app asks the browser once for permission to write into `language-app-data/` (File System Access API). Firefox is not supported in Phase 1.
4. **The storage layer sits behind a `ProgressStore` interface** with a local-folder implementation now. Moving the data later (for example a private GitHub repo, or a phone sync) is a swap, not a rewrite.
5. **The Words page is derived**, built from the lessons' new words. It is not stored anywhere.

## Why

- Code is public, so privacy of the learner's data comes entirely from where it lives. A gitignored path inside a public repo is one careless `git add -f` away from exposure, so the data folder is physically outside the working tree.
- Free-text translation cannot be graded reliably by the app. Gap-fill exercises are checked against the teacher's answer key. Translation and transformation exercises show the teacher's reference answer and the learner marks herself right or wrong.
- The app has no network in Phase 1, so it cannot send a recording to the teacher. It saves the recording locally and the learner hands it over.

## Costs and open items

- Data exists only on this laptop until Phase 2. If the laptop is lost, the history is lost. Until then: copy `language-app-data/` by hand now and then.
- Where private data lives long-term, and Phase 2 hosting, are undecided and are the learner's call.
- Who produces the pronunciation audio stays with the teacher's side. The app only plays files listed in a manifest.
