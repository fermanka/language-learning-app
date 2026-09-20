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

## Amendment 2026-09-20 (decided with the learner after using the tab)

- **Recognition cards only, for now.** The reverse card (meaning -> Dutch) is switched off (`production: false` in the page's card settings). Because it became available right after the first review of a word, it came up as the very next card, so the learner saw the same word again straight away. The reverse cards' review history stays in the log, so switching them back on loses nothing.
- **Flow.** The Dutch word is shown first; Space shows the meaning. The four difficulty buttons (Again, Hard, Good, Easy; keys 1-4) only mark a choice, nothing moves on. **Next card** (Space or Enter) writes one review with the chosen difficulty, or **Easy** when none was chosen. Ending the session keeps a difficulty that was already chosen; a card that was only looked at is not counted. This replaces the earlier "1-4 rates immediately, Space rates Good" (decision 6).
- **The deck holds every word up to the lesson being worked on, including it.** Not only the lessons marked done. "The lesson being worked on" is the one after the furthest lesson marked done; browsing an earlier lesson does not shrink the deck and looking at a later one does not grow it, so no word from a later lesson ever appears.
- **New cards are mixed** across those lessons and across word types (nouns, verbs, adjectives, numerals, question words and the rest), instead of arriving in lesson order (which always left the verbs, the last notes of a lesson, for last). The order is a stable hash of the card and the date: the same all day, different tomorrow, no `Math.random`.
- **Sessions are 10-15 cards:** a normal session of 15, a short one of 10 (was 30 and 15). The cap of 10 new cards a day is unchanged.
- **Two sub-sections in the Cards tab (the learner's choice, option A: a switch at the top): "Dutch -> Ukrainian" and "Ukrainian -> Dutch".** The reverse cards are back, but only inside their own section, so a session never leaves its direction and a word cannot come back reversed right after its first review (the original problem). Each direction has its own statistics, its own queue, its own allowance of 10 new cards a day and its own FSRS schedule (the card ids differ). A word enters "Ukrainian -> Dutch" only after its first review in "Dutch -> Ukrainian". Switching direction ends the running session and keeps a difficulty that was already chosen. The chosen direction is remembered in the browser.
- **15 cards a day per direction (30 for both), and a "Хочу ще" button (decided with the learner).** The day's portion is 15 cards in each direction (due first, then new words, up to 15 new); when it is used up the tab says so and offers "Хочу ще (+15 карток)". Pressing it writes a `cards_more` event `{dir}` to the log (so it survives a reload and is derived, never stored) and widens today's allowance of that direction, and its allowance of new words, by another 15. After the due and new cards, an extended day also offers learned cards that are not due yet and were not shown today (soonest first), so "Хочу ще" always has something to show until the whole deck has been shown. It only ever affects the direction that is open, and only today. A session is at most 15 cards (short: 10); the cap of 10 new a day is replaced by these 15.
