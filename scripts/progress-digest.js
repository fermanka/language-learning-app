// A short, read-only summary of the learner's progress log, written for the teacher.
// The teacher reads this digest, never the raw log, and never writes to the log.
// Usage: node scripts/progress-digest.js <progress-folder> [<lessons-folder>]
const fs = require('fs');
const path = require('path');
const F = require('ts-fsrs');
const Cards = require('../mockup/cards.js');

const display = (n) => (n.type === 'noun' ? `${n.article} ${n.lemma}` : n.lemma);
const dictationNotes = (lesson, ex) => lesson.notes.filter((n) => ex.note_types.includes(n.type) && n.dictation !== false && n.audio);

function readEvents(dir) {
  const events = [];
  let bad = 0;
  if (!fs.existsSync(dir)) return { events, bad };
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.ndjson')).sort()) {
    for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { events.push(JSON.parse(line)); } catch (e) { bad++; }
    }
  }
  events.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  return { events, bad };
}

// The answer fields of an exercise, in the order the page shows them (example rows have no field).
function fieldsOf(lesson, ex) {
  const items = (ex.items || []).filter((it) => !it.example);
  switch (ex.type) {
    case 'translate': case 'transform': return items.map((it) => ({ label: `${it.prompt} (${it.cue})`, expected: it.accepted[0] }));
    case 'verbform': return items.map((it) => ({ label: `${it.text} (${it.cue})`, expected: it.accepted[0] }));
    case 'gaps': return items.flatMap((it) => it.accepted.map((g, gi) => ({ label: `${it.text} [gap ${gi + 1}] ${it.hint}`, expected: g[0] })));
    case 'matching': return items.map((it) => ({ label: it.prompt, expected: it.answer }));
    case 'dictation': return dictationNotes(lesson, ex).map((n) => ({ label: 'dictation', expected: display(n) }));
    default: return [];
  }
}

function buildDigest(events, lessons, bad = 0) {
  events = events.slice().sort((x, y) => (x.t < y.t ? -1 : x.t > y.t ? 1 : 0)); // never trust the caller's order
  const out = ['# Progress digest (for the teacher, read-only)', ''];
  const byId = new Map(lessons.map((l) => [l.id, l]));
  if (!events.length) {
    out.push('No progress events yet: the learner has not checked an exercise, finished a lesson or reviewed a card since the folder was connected.');
    return out.join('\n') + '\n';
  }
  out.push(`Events: ${events.length} (${events[0].t.slice(0, 10)} to ${events[events.length - 1].t.slice(0, 10)}), damaged lines skipped: ${bad}`);

  const done = new Set(events.filter((e) => e.type === 'lesson_done').map((e) => e.lesson));
  out.push(`Lessons finished: ${lessons.filter((l) => done.has(l.id)).map((l) => 'Les ' + l.order).join(', ') || 'none'}`);
  const notDone = lessons.filter((l) => !done.has(l.id)).map((l) => 'Les ' + l.order);
  if (notDone.length) out.push(`Not finished: ${notDone.join(', ')}`);

  // exercises
  const checks = events.filter((e) => e.type === 'exercise_checked');
  const perEx = new Map();
  for (const e of checks) {
    const k = `${e.lesson}#${e.exercise}`;
    const x = perEx.get(k) || { lesson: e.lesson, exercise: e.exercise, kind: e.kind, attempts: 0, best: 0, last: null };
    x.attempts++; x.best = Math.max(x.best, e.ok); x.last = e; perEx.set(k, x);
  }
  out.push('', '## Exercises checked', '');
  if (!perEx.size) out.push('None yet.');
  else {
    out.push('| Lesson | Exercise | Type | Attempts | Last | Best |', '|---|---|---|---|---|---|');
    for (const x of [...perEx.values()].sort((a, b) => (byId.get(a.lesson)?.order || 0) - (byId.get(b.lesson)?.order || 0) || a.exercise - b.exercise)) {
      out.push(`| Les ${byId.get(x.lesson)?.order ?? '?'} | ${x.exercise + 1} | ${x.kind} | ${x.attempts} | ${x.last.ok}/${x.last.total} | ${x.best}/${x.last.total} |`);
    }
  }

  // most missed items
  const missed = new Map();
  for (const e of checks) {
    const lesson = byId.get(e.lesson);
    const fields = lesson && lesson.practice[e.exercise] ? fieldsOf(lesson, lesson.practice[e.exercise]) : [];
    for (const w of e.wrong || []) {
      const field = fields[w.n];
      const expected = w.expected ?? (field && field.expected);
      if (expected === undefined) continue;
      const key = `${e.lesson}#${e.exercise}#${expected}`;
      const m = missed.get(key) || { lesson: lesson ? lesson.order : '?', exercise: e.exercise, kind: e.kind, expected, label: field && field.expected === expected ? field.label : '', count: 0, typed: new Set() };
      m.count++; if (w.answer) m.typed.add(w.answer); missed.set(key, m);
    }
  }
  out.push('', '## Most missed items', '');
  if (!missed.size) out.push('None yet.');
  for (const m of [...missed.values()].sort((a, b) => b.count - a.count).slice(0, 15)) {
    out.push(`- Les ${m.lesson}, exercise ${m.exercise + 1} (${m.kind}): expected "${m.expected}", missed ${m.count}x${m.label ? `; item: ${m.label}` : ''}${m.typed.size ? `; typed: ${[...m.typed].map((s) => `"${s}"`).join(', ')}` : ''}`);
  }

  // flashcards
  const reviews = events.filter(Cards.isReview);
  out.push('', '## Flashcards', '');
  if (!reviews.length) out.push('No cards reviewed yet.');
  else {
    const deck = Cards.buildDeck(lessons);
    const notes = deck.notes;
    const states = Cards.replay(events, F);
    const again = new Map(), total = new Map();
    for (const e of reviews) { total.set(e.card, (total.get(e.card) || 0) + 1); if (e.rating === 1) again.set(e.card, (again.get(e.card) || 0) + 1); }
    out.push(`Cards reviewed: ${states.size}; in long-term review: ${[...states.values()].filter((c) => c.state === 2).length}; total lapses: ${[...states.values()].reduce((n, c) => n + c.lapses, 0)}`);
    const hard = [...again.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    if (hard.length) {
      out.push('', 'Hardest cards (most "Again" answers):');
      for (const [id, n] of hard) {
        const [noteId, dir] = id.split(':');
        const note = notes.get(noteId);
        out.push(`- ${note ? `${display(note)} (${note.ua})` : id} [${dir === 'nl-ua' ? 'Dutch -> meaning' : 'meaning -> Dutch'}]: Again ${n} of ${total.get(id)} reviews`);
      }
    }
  }

  const recs = events.filter((e) => e.type === 'recording_saved');
  out.push('', '## Reading recordings', '', recs.length ? recs.map((r) => `- ${r.t.slice(0, 10)} Les ${byId.get(r.lesson)?.order ?? '?'}: ${r.file}`).join('\n') : 'None saved.');
  return out.join('\n') + '\n';
}

module.exports = { buildDigest, readEvents, fieldsOf };

if (require.main === module) {
  const progressDir = process.argv[2];
  const lessonsDir = process.argv[3] || path.join(__dirname, '..', 'content', 'nl', 'lessons');
  if (!progressDir) { console.error('usage: node scripts/progress-digest.js <progress-folder> [<lessons-folder>]'); process.exit(2); }
  const lessons = fs.readdirSync(lessonsDir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(lessonsDir, f), 'utf8'))).sort((a, b) => a.order - b.order);
  const { events, bad } = readEvents(progressDir);
  process.stdout.write(buildDigest(events, lessons, bad));
}
