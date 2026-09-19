# ADR 0003: Flashcards and spaced repetition

Date: 2026-09-19
Status: accepted (decided with the learner: progress saving first, then spaced repetition in a tab between "Today" and "Texts")

## Decisions

1. **The scheduler is FSRS, through the `ts-fsrs` library.** Nobody hand-writes a scheduling algorithm.
   Dependency receipt:
   - replaces: a home-made interval algorithm;
   - size: about 700 KB unpacked in `node_modules`, one file (`dist/index.umd.js`) is loaded by the page; no other dependencies;
   - licence MIT, maintained (latest release September 2026);
   - if it is ever abandoned: the algorithm is public and the state is replayed from the complete review log (decision 3), so another implementation can be swapped in without losing history.
2. **One note gives two cards.** `nl-ua` (see the Dutch word, recall the meaning) and `ua-nl` (see the meaning, recall the Dutch word with its article). The production card of a note is introduced only after its recognition card has been reviewed once. Verbs are cards of the infinitive. The deck is made of the notes of the lessons the learner has marked done.
3. **Card state is never stored as truth.** It is derived by replaying every `card_review` event (`{card, rating 1-4, ms, t, device}`) in time order through FSRS with default parameters and no random fuzz, so the same log always gives the same state. Events written on two devices in any order give the same result. Damaged or foreign events are ignored.
4. **No optimiser in version 1.** Personal parameters need on the order of a thousand reviews; the log is complete, so it can be added later.
5. **Backlog mercy is part of version 1.** At most 10 new cards a day; at most 30 cards per session, the most overdue first; a short session of 15 cards. A missed week never turns into a wall of guilt: the queue simply shows the oldest cards first.
6. **Keyboard first.** Space reveals, then 1-4 rate (Again, Hard, Good, Easy) or Space for Good. Each rating button shows when the card would return. The Dutch side plays its audio automatically (at the speed the learner chose).
7. **Tests cover the two places where data is lost silently:** the scheduler wiring (four answers give four different futures, repeated Good answers push the interval out, a lapse is counted) and the log replay (same log same state, any order same state, damaged events ignored, derived state disposable). The tests were checked by breaking the code on purpose.

## Costs and open items

- Sentence and cloze cards (from the lessons' examples) are not in version 1.
- The page loads the library from `node_modules`, so `npm install` is needed once after cloning.
- Phone review is Phase 2 and depends on where the private progress log lives.
