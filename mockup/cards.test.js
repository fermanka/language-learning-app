// Tests for the two places where silent data loss lives: the scheduler wiring and the log replay.
// Uses the real ts-fsrs. Run: node mockup/cards.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const F = require('ts-fsrs');
const C = require('./cards.js');

let bad = 0;
const t = (name, fn) => { try { fn(); } catch (e) { bad++; console.log('FAIL', name, '\n   ', e.message.split('\n')[0]); } };
const at = (iso) => new Date(iso);
const review = (card, rating, iso) => ({ type: 'card_review', card, rating, t: iso });

// ---------------------------------------------------------------- 1. scheduler wiring
t('scheduler: a new card, four answers, four different futures (Again < Hard < Good < Easy)', () => {
  const now = at('2026-09-20T09:00:00Z');
  const p = C.previews(null, now, F);
  assert(p[1] < p[2] && p[2] < p[3] && p[3] < p[4], JSON.stringify(p));
  assert(p[1] > now, 'even "Again" is in the future');
});

t('scheduler: repeated Good answers push the next review further and further out', () => {
  const f = F.fsrs();
  let now = at('2026-09-20T09:00:00Z');
  let card = F.createEmptyCard(now);
  let last = 0;
  for (let i = 0; i < 6; i++) {
    card = f.next(card, now, F.Rating.Good).card;
    const gap = card.due - now;
    assert(gap >= last, `interval shrank at step ${i}: ${gap} < ${last}`);
    last = gap;
    now = card.due;                        // the learner comes back exactly when the card is due
  }
  assert(last > 5 * 24 * 3600 * 1000, 'after six good reviews the gap is more than five days');
});

t('scheduler: forgetting a mature card counts a lapse and puts it back into learning', () => {
  const f = F.fsrs();
  let now = at('2026-09-20T09:00:00Z');
  let card = F.createEmptyCard(now);
  for (let i = 0; i < 4; i++) { card = f.next(card, now, F.Rating.Good).card; now = card.due; }
  const before = card.lapses;
  const after = f.next(card, now, F.Rating.Again).card;
  assert.strictEqual(after.lapses, before + 1);
  assert(after.due - now < 24 * 3600 * 1000, 'due again within a day');
});

// ---------------------------------------------------------------- 2. log replay
const log = [
  review('n1:nl-ua', 3, '2026-09-20T09:00:00.000Z'),
  review('n2:nl-ua', 1, '2026-09-20T09:01:00.000Z'),
  review('n1:nl-ua', 3, '2026-09-20T09:11:00.000Z'),
  review('n1:nl-ua', 4, '2026-09-22T10:00:00.000Z'),
  review('n2:nl-ua', 3, '2026-09-20T09:03:00.000Z'),
];
const snapshot = (states) => JSON.stringify([...states.entries()].sort().map(([k, v]) => [k, v.due, v.stability, v.reps, v.lapses, v.state]));

t('replay: the same log always gives the same state (fuzz is off)', () => {
  assert.strictEqual(snapshot(C.replay(log, F)), snapshot(C.replay(log, F)));
});

t('replay: events written in any order (two devices, late sync) give the same state', () => {
  const shuffled = [log[4], log[2], log[0], log[3], log[1]];
  assert.strictEqual(snapshot(C.replay(shuffled, F)), snapshot(C.replay(log, F)));
});

t('replay: derived state is disposable, deleting it and replaying restores it', () => {
  const first = snapshot(C.replay(log, F));
  const fresh = snapshot(C.replay(JSON.parse(JSON.stringify(log)), F)); // nothing carried over, only the log
  assert.strictEqual(first, fresh);
});

t('replay: reviewing a card really moves it (2 reps, not 0 or 1)', () => {
  const s = C.replay(log, F);
  assert.strictEqual(s.get('n1:nl-ua').reps, 3);
  assert.strictEqual(s.get('n2:nl-ua').reps, 2);
});

t('replay: damaged or foreign events are ignored, never fatal, never counted', () => {
  const noisy = [...log, { type: 'lesson_done', lesson: 'x', t: '2026-09-20T09:00:00Z' }, { type: 'card_review', card: 'n3:nl-ua', rating: 9, t: '2026-09-20T09:00:00Z' },
    { type: 'card_review', rating: 3, t: '2026-09-20T09:00:00Z' }, { type: 'card_review', card: 'n4:nl-ua', rating: 3, t: 'not a date' }, null];
  assert.strictEqual(snapshot(C.replay(noisy, F)), snapshot(C.replay(log, F)));
});

t('replay: two reviews at the very same instant keep their log order', () => {
  const a = [review('n1:nl-ua', 1, '2026-09-20T09:00:00Z'), review('n1:nl-ua', 3, '2026-09-20T09:00:00Z')];
  const b = [review('n1:nl-ua', 3, '2026-09-20T09:00:00Z'), review('n1:nl-ua', 1, '2026-09-20T09:00:00Z')];
  assert.notStrictEqual(snapshot(C.replay(a, F)), snapshot(C.replay(b, F)));
});

// ---------------------------------------------------------------- 3. deck and queue
const lessons = JSON.parse('[' + fs.readdirSync(path.join(__dirname, '..', 'content', 'nl', 'lessons')).sort().map((f) => fs.readFileSync(path.join(__dirname, '..', 'content', 'nl', 'lessons', f), 'utf8')).join(',') + ']');

t('deck: two cards per note, only from the lessons given', () => {
  const d = C.buildDeck(lessons.slice(0, 2));
  const notes = lessons[0].notes.length + lessons[1].notes.length;
  assert.strictEqual(d.cards.length, notes * 2);
  assert(d.cards.every((c) => c.lessonOrder <= 2));
  assert.strictEqual(new Set(d.cards.map((c) => c.id)).size, d.cards.length, 'card ids are unique');
});

t('queue: at most 10 new cards a day, recognition first, production only after recognition', () => {
  const d = C.buildDeck(lessons.slice(0, 3));
  const now = at('2026-09-20T09:00:00Z');
  const q = C.queue(d, new Map(), [], now, { newPerDay: 10, limit: 50 });
  assert.strictEqual(q.length, 10);
  assert(q.every((c) => c.dir === 'nl-ua'), 'no production card before its recognition card was reviewed');
});

t('queue: the daily cap counts what was already introduced today', () => {
  const d = C.buildDeck(lessons.slice(0, 3));
  const now = at('2026-09-20T15:00:00Z');
  const first10 = C.queue(d, new Map(), [], now, { newPerDay: 10, limit: 50 });
  const events = first10.slice(0, 4).map((c, i) => review(c.id, 3, `2026-09-20T09:0${i}:00.000Z`));
  const states = C.replay(events, F);
  const q = C.queue(d, states, events, now, { newPerDay: 10, limit: 50 });
  assert.strictEqual(C.newToday(events, now), 4);
  assert.strictEqual(q.filter((c) => !states.has(c.id)).length, 6, 'only 6 new cards left for today');
});

t('queue: a card is not due until its interval has passed, then it comes back', () => {
  const d = C.buildDeck(lessons.slice(0, 1));
  const id = d.cards[0].id;
  const events = [review(id, 3, '2026-09-20T09:00:00.000Z')];
  const states = C.replay(events, F);
  const early = C.queue(d, states, events, at('2026-09-20T09:05:00Z'), { newPerDay: 0, limit: 50 });
  const later = C.queue(d, states, events, at('2026-09-20T09:11:00Z'), { newPerDay: 0, limit: 50 });
  assert(!early.some((c) => c.id === id), 'not yet due after 5 minutes');
  assert(later.some((c) => c.id === id), 'due after 11 minutes');
});

t('queue: the most overdue card comes first, and the session cap is respected', () => {
  const d = C.buildDeck(lessons.slice(0, 1));
  const [a, b, c] = d.cards;
  const events = [review(b.id, 3, '2026-09-10T09:00:00Z'), review(a.id, 3, '2026-09-12T09:00:00Z'), review(c.id, 3, '2026-09-11T09:00:00Z')];
  const states = C.replay(events, F);
  const q = C.queue(d, states, events, at('2026-10-30T09:00:00Z'), { newPerDay: 0, limit: 2 });
  assert.strictEqual(q.length, 2);
  assert.strictEqual(q[0].id, b.id);
});

t('production card appears once the recognition card has been reviewed', () => {
  const d = C.buildDeck(lessons.slice(0, 1));
  const first = d.cards[0];
  const events = [review(first.id, 3, '2026-09-20T09:00:00Z')];
  const states = C.replay(events, F);
  const q = C.queue(d, states, events, at('2026-09-21T09:00:00Z'), { newPerDay: 10, limit: 50 });
  assert(q.some((c) => c.id === `${first.noteId}:ua-nl`), 'production card is now available');
});

t('what a card shows: recognition shows Dutch, production shows the meaning', () => {
  const d = C.buildDeck(lessons.slice(0, 1));
  const helpers = { display: (n) => (n.type === 'noun' ? `${n.article} ${n.lemma}` : n.lemma), pluralText: () => '' };
  const rec = C.present(d.cards[0], d.notes.get(d.cards[0].noteId), helpers);
  const prod = C.present(d.cards[1], d.notes.get(d.cards[1].noteId), helpers);
  assert.strictEqual(rec.front.text, 'de man');
  assert.strictEqual(rec.back.text, 'чоловік');
  assert.strictEqual(prod.front.text, 'чоловік');
  assert.strictEqual(prod.back.text, 'de man');
  assert(rec.front.audio && prod.back.audio && !rec.back.audio && !prod.front.audio, 'audio sits on the Dutch side');
});

t('interval labels are human', () => {
  const now = at('2026-09-20T09:00:00Z');
  assert.strictEqual(C.humanize(at('2026-09-20T09:00:20Z'), now), '< 1 хв');
  assert.strictEqual(C.humanize(at('2026-09-20T09:10:00Z'), now), '10 хв');
  assert.strictEqual(C.humanize(at('2026-09-20T12:00:00Z'), now), '3 год');
  assert.strictEqual(C.humanize(at('2026-09-23T09:00:00Z'), now), '3 дн');
});

console.log(bad ? `FAILURES: ${bad}` : 'CARDS TESTS PASSED');
process.exit(bad ? 1 : 0);
