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

t('queue: a card is not due until its interval has passed; one shown today waits for tomorrow', () => {
  const d = C.buildDeck(lessons.slice(0, 1));
  const id = d.cards[0].id;
  const events = [review(id, 3, '2026-09-20T09:00:00.000Z')];
  const states = C.replay(events, F);
  assert(states.get(id).due <= at('2026-09-20T09:11:00Z'), 'the scheduler itself would show it again after ten minutes');
  const early = C.queue(d, states, events, at('2026-09-20T09:05:00Z'), { newPerDay: 0, limit: 50 });
  const sameDay = C.queue(d, states, events, at('2026-09-20T09:11:00Z'), { newPerDay: 0, limit: 50 });
  const nextDay = C.queue(d, states, events, at('2026-09-21T09:00:00Z'), { newPerDay: 0, limit: 50 });
  assert(!early.some((c) => c.id === id), 'not yet due after 5 minutes');
  assert(!sameDay.some((c) => c.id === id), 'due by the scheduler, but it was shown today, so it waits for tomorrow');
  assert(nextDay.some((c) => c.id === id), 'offered again the next day');
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

// ---------------------------------------------------------------- production cards switched off
t('deck without production: one recognition card per note, no reverse cards', () => {
  const full = C.buildDeck(lessons.slice(0, 2)), lean = C.buildDeck(lessons.slice(0, 2), { production: false });
  assert(lean.cards.length * 2 === full.cards.length && lean.cards.every((c) => c.dir === 'nl-ua'), `${lean.cards.length} vs ${full.cards.length}`);
});

t('deck without production: the word just reviewed does not come back as its reverse card', () => {
  const d = C.buildDeck(lessons.slice(0, 1), { production: false });
  const now = at('2026-09-20T09:00:00Z');
  const first = C.queue(d, C.replay([], F), [], now, { limit: 1 })[0];
  const ev = [review(first.id, 4, now.toISOString())];
  const next = C.queue(d, C.replay(ev, F), ev, at('2026-09-20T09:00:05Z'), { limit: 1 })[0];
  assert(next && next.noteId !== first.noteId && next.dir === 'nl-ua', 'the next card must be a different word');
});

t('deck without production: reverse-card reviews already in the log are ignored, not fatal', () => {
  const d = C.buildDeck(lessons.slice(0, 1), { production: false });
  const noteId = d.cards[0].noteId;
  const ev = [review(`${noteId}:nl-ua`, 3, '2026-09-20T09:00:00Z'), review(`${noteId}:ua-nl`, 3, '2026-09-20T09:01:00Z')];
  const states = C.replay(ev, F);
  const s = C.stats(d, states, ev, at('2026-09-21T09:00:00Z'), {});
  assert(s.total === d.cards.length && Number.isFinite(s.due), JSON.stringify(s));
});

// ---------------------------------------------------------------- mixed order of new cards (verbs among the nouns)
t('mixed new cards: verbs show up among the first ten, not only after all the nouns', () => {
  const d = C.buildDeck(lessons.slice(0, 5), { production: false });
  const noteType = (c) => d.notes.get(c.noteId).type;
  const firstTen = (mix, day) => C.queue(d, new Map(), [], at(`2026-09-${day}T09:00:00Z`), { limit: 10, newPerDay: 10, mix }).map(noteType);
  assert(firstTen(false, '20').filter((x) => x === 'verb').length === 0, 'lesson order: Les 1 has no verbs among its first ten notes');
  const verbDays = ['20', '21', '22', '23', '24'].filter((day) => firstTen(true, day).includes('verb')).length;
  assert(verbDays >= 4, `mixed: verbs among the first ten on only ${verbDays} of 5 days`);
});

t('mixed new cards: same order all day, a different one tomorrow, no card twice', () => {
  const d = C.buildDeck(lessons.slice(0, 5), { production: false });
  const ids = (iso) => C.queue(d, new Map(), [], at(iso), { limit: 10, newPerDay: 10, mix: true }).map((c) => c.id);
  const morning = ids('2026-09-20T07:00:00Z'), evening = ids('2026-09-20T20:00:00Z'), tomorrow = ids('2026-09-21T07:00:00Z');
  assert(morning.join() === evening.join(), 'the order changed during the day');
  assert(morning.join() !== tomorrow.join(), 'the order is the same tomorrow');
  assert(new Set(morning).size === 10);
});

t('mixed new cards: the daily cap and due cards still come first', () => {
  const d = C.buildDeck(lessons.slice(0, 2), { production: false });
  const now = at('2026-09-20T09:00:00Z');
  const first = C.queue(d, new Map(), [], now, { limit: 1, mix: true })[0];
  const ev = [review(first.id, 3, now.toISOString())];
  const later = at('2026-09-22T09:00:00Z');                      // two days on, the card is due again
  const q = C.queue(d, C.replay(ev, F), ev, later, { limit: 30, newPerDay: 10, mix: true });
  assert(q[0].id === first.id, 'the due card comes before every new one');
  assert(q.length === 1 + 10, `due + 10 new expected, got ${q.length}`);
});

// ---------------------------------------------------------------- two directions, each with its own queue and allowance
t('directions: each direction asks only its own cards', () => {
  const d = C.buildDeck(lessons.slice(0, 2));
  const now = at('2026-09-20T09:00:00Z');
  const a = C.queue(d, new Map(), [], now, { limit: 30, dir: 'nl-ua' }), b = C.queue(d, new Map(), [], now, { limit: 30, dir: 'ua-nl' });
  assert(a.length > 0 && a.every((c) => c.dir === 'nl-ua'));
  assert(b.length === 0, 'nothing is asked in the reverse direction before the Dutch word was seen');
});

t('directions: a word reviewed in Dutch -> Ukrainian becomes available in Ukrainian -> Dutch, not the other way round', () => {
  const d = C.buildDeck(lessons.slice(0, 1));
  const now = at('2026-09-20T09:00:00Z');
  const first = C.queue(d, new Map(), [], now, { limit: 1, dir: 'nl-ua' })[0];
  const ev = [review(first.id, 4, now.toISOString())];
  const rev = C.queue(d, C.replay(ev, F), ev, at('2026-09-20T09:00:05Z'), { limit: 30, dir: 'ua-nl' });
  assert(rev.length === 1 && rev[0].id === `${first.noteId}:ua-nl` && rev[0].dir === 'ua-nl');
  const fwd = C.queue(d, C.replay(ev, F), ev, at('2026-09-20T09:00:05Z'), { limit: 30, dir: 'nl-ua' });
  assert(fwd.every((c) => c.noteId !== first.noteId), 'the word does not come back in its own direction');
});

t('directions: the daily allowance of new cards is counted per direction', () => {
  const d = C.buildDeck(lessons.slice(0, 3));
  const now = at('2026-09-20T09:00:00Z');
  const fwd = C.queue(d, new Map(), [], now, { limit: 10, newPerDay: 10, dir: 'nl-ua' });
  const ev = fwd.map((c, i) => review(c.id, 4, new Date(now.getTime() + i * 1000).toISOString()));
  const later = at('2026-09-20T10:00:00Z');
  assert(C.newToday(ev, later, 'nl-ua') === 10 && C.newToday(ev, later, 'ua-nl') === 0 && C.newToday(ev, later) === 10);
  assert(C.stats(d, C.replay(ev, F), ev, later, { newPerDay: 10, dir: 'nl-ua' }).newRoom === 0, 'Dutch -> Ukrainian allowance is used up');
  assert(C.stats(d, C.replay(ev, F), ev, later, { newPerDay: 10, dir: 'ua-nl' }).newRoom === 10, 'Ukrainian -> Dutch has its own 10');
});

t('directions: statistics count the cards of one direction only', () => {
  const d = C.buildDeck(lessons.slice(0, 2));
  const both = C.stats(d, new Map(), [], at('2026-09-20T09:00:00Z'), {});
  const one = C.stats(d, new Map(), [], at('2026-09-20T09:00:00Z'), { dir: 'nl-ua' });
  assert(one.total * 2 === both.total, `${one.total} vs ${both.total}`);
});

// ---------------------------------------------------------------- 15 a day per direction, and "Хочу ще"
const dayReviews = (cards, iso0) => cards.map((c, i) => review(c.id, 4, new Date(at(iso0).getTime() + i * 1000).toISOString()));
const more = (dir, iso) => ({ type: 'cards_more', dir, t: iso });

t('a day: 15 cards a direction, then the queue is empty until more is asked', () => {
  const d = C.buildDeck(lessons.slice(0, 3));
  const now = at('2026-09-20T09:00:00Z');
  const first = C.queue(d, new Map(), [], now, { limit: 30, newPerDay: 15, perDay: 15, dir: 'nl-ua' });
  assert(first.length === 15, `first portion: ${first.length}`);
  const ev = dayReviews(first, '2026-09-20T09:00:00Z');
  const later = at('2026-09-20T10:00:00Z'), states = C.replay(ev, F);
  assert(C.queue(d, states, ev, later, { limit: 30, newPerDay: 15, perDay: 15, dir: 'nl-ua' }).length === 0, 'nothing more today');
  const s = C.stats(d, states, ev, later, { newPerDay: 15, perDay: 15, dir: 'nl-ua' });
  assert(s.shown === 15 && s.allowance === 15 && s.remaining === 0 && s.newRoom === 0, JSON.stringify(s));
  assert(C.queue(d, C.replay(ev, F), ev, at('2026-09-21T09:00:00Z'), { limit: 30, newPerDay: 15, perDay: 15, dir: 'nl-ua' }).length > 0, 'a new day starts a new portion');
});

t('a day: the other direction has its own 15', () => {
  const d = C.buildDeck(lessons.slice(0, 3));
  const now = at('2026-09-20T09:00:00Z');
  const fwd = C.queue(d, new Map(), [], now, { limit: 30, newPerDay: 15, perDay: 15, dir: 'nl-ua' });
  const ev = dayReviews(fwd, '2026-09-20T09:00:00Z');
  const rev = C.queue(d, C.replay(ev, F), ev, at('2026-09-20T10:00:00Z'), { limit: 30, newPerDay: 15, perDay: 15, dir: 'ua-nl' });
  assert(rev.length === 15 && rev.every((c) => c.dir === 'ua-nl'), `reverse portion: ${rev.length}`);
});

t('want more: one more portion of 15 in that direction only, and new words continue', () => {
  const d = C.buildDeck(lessons.slice(0, 3));
  const now = at('2026-09-20T09:00:00Z');
  const fwd = C.queue(d, new Map(), [], now, { limit: 30, newPerDay: 15, perDay: 15, dir: 'nl-ua' });
  const ev = dayReviews(fwd, '2026-09-20T09:00:00Z').concat([more('nl-ua', '2026-09-20T10:00:00Z')]);
  const later = at('2026-09-20T10:05:00Z'), states = C.replay(ev, F);
  const q = C.queue(d, states, ev, later, { limit: 30, newPerDay: 15, perDay: 15, dir: 'nl-ua' });
  assert(q.length === 15, `second portion: ${q.length}`);
  assert(q.every((c) => !fwd.some((f) => f.id === c.id)), 'the extra portion holds words that were not shown today');
  const s = C.stats(d, states, ev, later, { newPerDay: 15, perDay: 15, dir: 'nl-ua' });
  assert(s.allowance === 30 && s.remaining === 15 && s.more === 1);
  assert(C.stats(d, states, ev, later, { newPerDay: 15, perDay: 15, dir: 'ua-nl' }).allowance === 15, 'the other direction is not widened');
  assert(C.queue(d, states, ev, at('2026-09-21T10:00:00Z'), { limit: 30, newPerDay: 15, perDay: 15, dir: 'nl-ua' }).length === 15, 'tomorrow is back to one portion');
});

t('want more: learned words that were not shown today come back, soonest first, never the ones shown today', () => {
  const d = C.buildDeck(lessons.slice(0, 1), { production: false });     // 15 words
  const cardsAll = d.cards;
  const yesterday = dayReviews(cardsAll, '2026-09-19T09:00:00Z');          // all learned yesterday, none due today
  const today = at('2026-09-20T09:00:00Z');
  const cfg = { limit: 30, newPerDay: 0, perDay: 15, dir: 'nl-ua' };
  assert(C.queue(d, C.replay(yesterday, F), yesterday, today, cfg).length === 0, 'nothing due, nothing new: nothing offered without asking');
  const ev = yesterday.concat([review(cardsAll[3].id, 4, '2026-09-20T09:30:00Z'), more('nl-ua', '2026-09-20T09:31:00Z')]);
  const states = C.replay(ev, F), now2 = at('2026-09-20T09:40:00Z');
  const q = C.queue(d, states, ev, now2, cfg);
  assert(q.length === cardsAll.length - 1, `expected ${cardsAll.length - 1}, got ${q.length}`);
  assert(!q.some((c) => c.id === cardsAll[3].id), 'a card already shown today is not offered again');
  for (let i = 1; i < q.length; i++) assert(states.get(q[i - 1].id).due <= states.get(q[i].id).due, 'soonest due first');
});

t('want more: spare counts what could still be offered; a malformed cards_more is ignored', () => {
  const d = C.buildDeck(lessons.slice(0, 1), { production: false });
  const now = at('2026-09-20T09:00:00Z');
  const all = dayReviews(d.cards, '2026-09-20T08:00:00Z');                  // everything already shown today
  const s = C.stats(d, C.replay(all, F), all, now, { newPerDay: 15, perDay: 15, dir: 'nl-ua' });
  assert(s.spare === 0 && s.remaining === 0, JSON.stringify(s));
  const bad = [{ type: 'cards_more', t: '2026-09-20T08:30:00Z' }, { type: 'cards_more', dir: 'xx', t: '2026-09-20T08:30:00Z' }];
  assert(C.moreToday(bad, now, 'nl-ua') === 0, 'no direction / unknown direction does not count');
  const empty = C.stats(d, new Map(), [], now, { newPerDay: 15, perDay: 15, dir: 'nl-ua' });
  assert(empty.spare === d.cards.length && empty.remaining === 15);
});

// ---------------------------------------------------------------- every card of the day is a different one
t('different words: a card shown today comes back today neither in the session nor after "Хочу ще"', () => {
  const d = C.buildDeck(lessons.slice(0, 1), { production: false });
  const cfg = { limit: 30, newPerDay: 15, perDay: 15, dir: 'nl-ua' };
  const first = d.cards[0];
  // rated "Знову" at 09:00: the scheduler alone would bring it back at 09:01
  let ev = [review(first.id, 1, '2026-09-20T09:00:00Z')];
  assert(C.replay(ev, F).get(first.id).due <= at('2026-09-20T09:05:00Z'), 'precondition: the scheduler would show it again within minutes');
  assert(!C.queue(d, C.replay(ev, F), ev, at('2026-09-20T09:05:00Z'), cfg).some((c) => c.id === first.id), 'not again in the same session');
  ev = ev.concat([more('nl-ua', '2026-09-20T09:10:00Z')]);
  assert(!C.queue(d, C.replay(ev, F), ev, at('2026-09-20T09:15:00Z'), cfg).some((c) => c.id === first.id), 'not in the extra portion either');
  assert(C.stats(d, C.replay(ev, F), ev, at('2026-09-20T09:15:00Z'), cfg).due === 0, 'and it is not counted as due today');
  assert(C.queue(d, C.replay(ev, F), ev, at('2026-09-21T09:00:00Z'), cfg).some((c) => c.id === first.id), 'tomorrow it is back');
});

t('different words: the first portion and the extra portion never share a card', () => {
  const d = C.buildDeck(lessons.slice(0, 3), { production: false });
  const cfg = { limit: 30, newPerDay: 15, perDay: 15, dir: 'nl-ua' };
  const first = C.queue(d, new Map(), [], at('2026-09-20T09:00:00Z'), cfg);
  // every word of the first portion rated "Знову" (they all come due again within a minute)
  const ev = first.map((c, i) => review(c.id, 1, new Date(at('2026-09-20T09:00:00Z').getTime() + i * 1000).toISOString())).concat([more('nl-ua', '2026-09-20T09:30:00Z')]);
  const second = C.queue(d, C.replay(ev, F), ev, at('2026-09-20T09:35:00Z'), cfg);
  assert(second.length === 15 && second.every((c) => !first.some((f) => f.id === c.id)), 'fifteen other words');
});

console.log(bad ? `FAILURES: ${bad}` : 'CARDS TESTS PASSED');
process.exit(bad ? 1 : 0);
