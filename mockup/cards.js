// Flashcards: deck from finished lessons, review queue, and the replay of the review log through FSRS.
// The learner's card state is never stored as truth: it is derived by replaying every `card_review`
// event in time order through the scheduler (ts-fsrs). Delete the derived state, replay, get it back.
// The scheduler module is passed in (window.FSRS in the page, require('ts-fsrs') in tests).
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cards = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const RATINGS = [1, 2, 3, 4]; // Again, Hard, Good, Easy
  const TYPE_LABEL = { noun: 'іменник', verb: 'дієслово', adjective: 'прикметник', numeral: 'числівник', function: 'слово' };
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const byTime = (a, b) => (a.e.t < b.e.t ? -1 : a.e.t > b.e.t ? 1 : a.i - b.i); // stable: same instant keeps log order

  // One note gives two cards. The learner recognises the Dutch word first, and is only asked to produce it later.
  function cardsFromNote(note) {
    return [
      { id: `${note.id}:nl-ua`, noteId: note.id, dir: 'nl-ua' },
      { id: `${note.id}:ua-nl`, noteId: note.id, dir: 'ua-nl' },
    ];
  }

  function buildDeck(lessons) {
    const cards = [];
    const notes = new Map();
    for (const lesson of lessons) {
      for (const note of lesson.notes) {
        notes.set(note.id, note);
        for (const c of cardsFromNote(note)) cards.push({ ...c, lessonId: lesson.id, lessonOrder: lesson.order });
      }
    }
    return { cards, notes };
  }

  // The events that count: a review of a known rating. Anything else in the log is ignored, never fatal.
  const isReview = (e) => e && e.type === 'card_review' && typeof e.card === 'string' && RATINGS.includes(e.rating) && !Number.isNaN(Date.parse(e.t));

  // card id -> FSRS card, by replaying the log in time order.
  function replay(events, F, params) {
    const f = F.fsrs(params);
    const states = new Map();
    events.map((e, i) => ({ e, i })).filter((x) => isReview(x.e)).sort(byTime).forEach(({ e }) => {
      const now = new Date(e.t);
      const card = states.get(e.card) || F.createEmptyCard(now);
      states.set(e.card, f.next(card, now, e.rating).card);
    });
    return states;
  }

  // How many cards were first seen today (for the daily cap on new cards).
  function newToday(events, now) {
    const first = new Map();
    events.map((e, i) => ({ e, i })).filter((x) => isReview(x.e)).sort(byTime).forEach(({ e }) => { if (!first.has(e.card)) first.set(e.card, new Date(e.t)); });
    let n = 0;
    for (const d of first.values()) if (dayKey(d) === dayKey(now)) n++;
    return n;
  }

  const NEW = 0;
  const isNew = (states, id) => !states.has(id) || states.get(id).state === NEW;

  // Due reviews first (most overdue first), then new cards in lesson order, within the daily and session caps.
  function queue(deck, states, events, now, cfg) {
    const { newPerDay = 10, limit = 30 } = cfg || {};
    const due = deck.cards
      .filter((c) => !isNew(states, c.id) && states.get(c.id).due <= now)
      .sort((a, b) => states.get(a.id).due - states.get(b.id).due);
    const room = Math.max(0, newPerDay - newToday(events, now));
    const fresh = deck.cards
      .filter((c) => isNew(states, c.id))
      // production ("ua-nl") is introduced only after the learner has met the Dutch word ("nl-ua")
      .filter((c) => c.dir === 'nl-ua' || !isNew(states, `${c.noteId}:nl-ua`))
      .slice(0, room);
    return [...due, ...fresh].slice(0, Math.max(0, limit));
  }

  function stats(deck, states, events, now, cfg) {
    const { newPerDay = 10 } = cfg || {};
    const due = deck.cards.filter((c) => !isNew(states, c.id) && states.get(c.id).due <= now).length;
    const eligibleNew = deck.cards.filter((c) => isNew(states, c.id) && (c.dir === 'nl-ua' || !isNew(states, `${c.noteId}:nl-ua`))).length;
    const newRoom = Math.min(eligibleNew, Math.max(0, newPerDay - newToday(events, now)));
    const learned = deck.cards.filter((c) => !isNew(states, c.id) && states.get(c.id).state === 2).length;
    return { total: deck.cards.length, due, newRoom, learned };
  }

  // When each of the four answers would bring the card back.
  function previews(card, now, F, params) {
    const rec = F.fsrs(params).repeat(card || F.createEmptyCard(now), now);
    const out = {};
    for (const r of RATINGS) out[r] = rec[r].card.due;
    return out;
  }

  function humanize(due, now) {
    const min = Math.round((due - now) / 60000);
    if (min < 1) return '< 1 хв';
    if (min < 60) return `${min} хв`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h} год`;
    const d = Math.round(h / 24);
    if (d < 30) return `${d} дн`;
    const m = Math.round(d / 30);
    return m < 12 ? `${m} міс` : `${Math.round(m / 12)} р`;
  }

  // What to show on a card. `h` = { display, pluralText } from the page (one source of truth for how a word is written).
  function present(card, note, h) {
    const dutch = h.display(note);
    const plural = h.pluralText(note);
    if (card.dir === 'nl-ua') return { front: { text: dutch, sub: '', audio: note.audio }, back: { text: note.ua, sub: plural, audio: null } };
    return { front: { text: note.ua, sub: TYPE_LABEL[note.type] || '', audio: null }, back: { text: dutch, sub: plural, audio: note.audio } };
  }

  return { cardsFromNote, buildDeck, replay, newToday, queue, stats, previews, humanize, present, isReview, RATINGS };
});
