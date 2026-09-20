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

  // opts.production === false leaves out the "ua-nl" cards: only "see the Dutch word, recall the meaning" is asked.
  // Their review history stays in the log, so switching them back on later loses nothing.
  function buildDeck(lessons, opts = {}) {
    const production = opts.production !== false;
    const cards = [];
    const notes = new Map();
    for (const lesson of lessons) {
      for (const note of lesson.notes) {
        notes.set(note.id, note);
        for (const c of cardsFromNote(note)) if (production || c.dir === 'nl-ua') cards.push({ ...c, lessonId: lesson.id, lessonOrder: lesson.order });
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

  // A direction is "nl-ua" (Dutch -> Ukrainian) or "ua-nl" (Ukrainian -> Dutch); no direction = both together.
  // Each direction has its own daily allowance of new cards, its own queue and its own statistics.
  const inDir = (dir) => (c) => !dir || c.dir === dir;
  const cardDir = (id) => id.slice(id.lastIndexOf(':') + 1);

  // How many cards were first seen today (for the daily cap on new cards), in one direction or in all.
  function newToday(events, now, dir) {
    const first = new Map();
    events.map((e, i) => ({ e, i })).filter((x) => isReview(x.e) && (!dir || cardDir(x.e.card) === dir)).sort(byTime).forEach(({ e }) => { if (!first.has(e.card)) first.set(e.card, new Date(e.t)); });
    let n = 0;
    for (const d of first.values()) if (dayKey(d) === dayKey(now)) n++;
    return n;
  }

  // "Хочу ще": the learner asked for one more portion today in one direction. Counted from the log, never stored.
  const isMore = (e) => e && e.type === 'cards_more' && (e.dir === 'nl-ua' || e.dir === 'ua-nl') && !Number.isNaN(Date.parse(e.t));
  const moreToday = (events, now, dir) => (dir ? events.filter((e) => isMore(e) && e.dir === dir && dayKey(new Date(e.t)) === dayKey(now)).length : 0);

  // The reviews done today (in one direction or in all): how many cards were shown, and which ones.
  function shownToday(events, now, dir) {
    const list = events.filter((e) => isReview(e) && (!dir || cardDir(e.card) === dir) && dayKey(new Date(e.t)) === dayKey(now));
    return { count: list.length, ids: new Set(list.map((e) => e.card)) };
  }

  const NEW = 0;
  const isNew = (states, id) => !states.has(id) || states.get(id).state === NEW;

  // A stable "random" order: the same for one card on one day (so a session never reshuffles under the learner),
  // a different one the next day. No Math.random on purpose: the same log and the same day give the same queue.
  // FNV-1a for the text, then a murmur3 finaliser so that a change of day reshuffles EVERYTHING (a plain rolling hash
  // would add the same offset to every card and only rotate the order).
  const strHash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const finish = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; };
  const mixKey = (id, now) => finish((strHash(id) ^ Math.imul(strHash(dayKey(now)), 2654435761)) >>> 0);

  // Order: due reviews (most overdue first), then new cards, then, only after "Хочу ще" today, learned cards that are not
  // due yet and were not shown today (soonest first). A daily allowance (cfg.perDay cards per direction) ends the day's
  // portion; every "Хочу ще" adds another portion of the same size and widens the new-cards allowance the same way.
  // New cards come in lesson order, or (cfg.mix) mixed across all lessons and word types, verbs among the nouns.
  function queue(deck, states, events, now, cfg) {
    const { newPerDay = 10, limit = 30, mix = false, dir, perDay } = cfg || {};
    const cards = deck.cards.filter(inDir(dir));
    const more = moreToday(events, now, dir);
    const shown = shownToday(events, now, dir);
    const cap = perDay === undefined ? limit : Math.min(limit, Math.max(0, perDay * (1 + more) - shown.count));
    // A card shown today in this direction is never offered again the same day, even when the scheduler would bring it
    // back in a few minutes (after "Знову", "Важко" or "Добре" on a new word): every card of the day is a different one.
    const due = cards
      .filter((c) => !isNew(states, c.id) && states.get(c.id).due <= now && !shown.ids.has(c.id))
      .sort((a, b) => states.get(a.id).due - states.get(b.id).due);
    const room = Math.max(0, newPerDay * (1 + more) - newToday(events, now, dir));
    const fresh = cards
      .filter((c) => isNew(states, c.id))
      // production ("ua-nl") is introduced only after the learner has met the Dutch word ("nl-ua")
      .filter((c) => c.dir === 'nl-ua' || !isNew(states, `${c.noteId}:nl-ua`));
    if (mix) fresh.sort((a, b) => mixKey(a.id, now) - mixKey(b.id, now));
    fresh.splice(room);
    const extra = more > 0
      ? cards.filter((c) => !isNew(states, c.id) && states.get(c.id).due > now && !shown.ids.has(c.id)).sort((a, b) => states.get(a.id).due - states.get(b.id).due)
      : [];
    return [...due, ...fresh, ...extra].slice(0, Math.max(0, cap));
  }

  function stats(deck, states, events, now, cfg) {
    const { newPerDay = 10, dir, perDay } = cfg || {};
    const cards = deck.cards.filter(inDir(dir));
    const more = moreToday(events, now, dir);
    const shown = shownToday(events, now, dir);
    const due = cards.filter((c) => !isNew(states, c.id) && states.get(c.id).due <= now && !shown.ids.has(c.id)).length;
    const eligibleNew = cards.filter((c) => isNew(states, c.id) && (c.dir === 'nl-ua' || !isNew(states, `${c.noteId}:nl-ua`))).length;
    const newRoom = Math.min(eligibleNew, Math.max(0, newPerDay * (1 + more) - newToday(events, now, dir)));
    const learned = cards.filter((c) => !isNew(states, c.id) && states.get(c.id).state === 2).length;
    const allowance = perDay === undefined ? null : perDay * (1 + more);
    const remaining = allowance === null ? null : Math.max(0, allowance - shown.count);
    // what "Хочу ще" could still offer today: new cards that may be introduced, and learned cards not shown today
    const spare = cards.filter((c) => (isNew(states, c.id) ? c.dir === 'nl-ua' || !isNew(states, `${c.noteId}:nl-ua`) : !shown.ids.has(c.id))).length;
    return { total: cards.length, due, newRoom, learned, shown: shown.count, allowance, remaining, more, spare };
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

  return { cardsFromNote, buildDeck, replay, newToday, moreToday, shownToday, queue, stats, previews, humanize, present, isReview, RATINGS };
});
