// Tests for the progress log without a browser, on an in-memory fake folder.
// Run: node mockup/progress-store.test.js
const { FolderStore, ProgressLog, fold, migrate } = require('./progress-store.js');

class FakeFile {
  constructor() { this.kind = 'file'; this.data = ''; }
  async getFile() { const d = this.data; return { size: d.length, text: async () => d }; }
  async createWritable(opts = {}) {
    const f = this; let buf = opts.keepExistingData ? f.data : ''; let pos = buf.length;
    return { seek: async (p) => { pos = p; }, write: async (chunk) => { const s = typeof chunk === 'string' ? chunk : (chunk && chunk.text ? await chunk.text() : '[binary]'); buf = buf.slice(0, pos) + s; pos = buf.length; }, close: async () => { f.data = buf; } };
  }
}
class FakeDir {
  constructor() { this.kind = 'directory'; this.map = new Map(); }
  async getDirectoryHandle(name, o = {}) { if (!this.map.has(name)) { if (!o.create) throw new Error('not found'); this.map.set(name, new FakeDir()); } return this.map.get(name); }
  async getFileHandle(name, o = {}) { if (!this.map.has(name)) { if (!o.create) throw new Error('not found'); this.map.set(name, new FakeFile()); } return this.map.get(name); }
  async *entries() { for (const e of this.map.entries()) yield e; }
}

let bad = 0;
const t = (name, ok) => { if (!ok) { bad++; console.log('FAIL', name); } };

(async () => {
  const root = new FakeDir();
  const store = new FolderStore(root, { device: 'laptop' });

  // append + read back in order, one file per day per device
  await store.append({ type: 'lesson_done', lesson: 'nl-les-01', t: '2026-09-19T10:00:00.000Z' });
  await store.append({ type: 'exercise_checked', lesson: 'nl-les-02', exercise: 1, ok: 3, total: 5, t: '2026-09-19T10:05:00.000Z' });
  await store.append({ type: 'exercise_checked', lesson: 'nl-les-02', exercise: 1, ok: 5, total: 5, t: '2026-09-20T09:00:00.000Z' });
  const progressDir = await root.getDirectoryHandle('progress');
  const files = [...progressDir.map.keys()].sort();
  t('one file per day per device', files.join() === '2026-09-19.laptop.ndjson,2026-09-20.laptop.ndjson');
  let r = await store.readAll();
  t('three events read back in time order', r.events.length === 3 && r.events[0].type === 'lesson_done' && r.events[2].ok === 5 && r.bad === 0);

  // append never rewrites: earlier lines stay byte-identical
  const before = progressDir.map.get('2026-09-19.laptop.ndjson').data;
  await store.append({ type: 'lesson_done', lesson: 'nl-les-03', t: '2026-09-19T11:00:00.000Z' });
  const after = progressDir.map.get('2026-09-19.laptop.ndjson').data;
  t('append-only: old lines unchanged', after.startsWith(before) && after.length > before.length);

  // a damaged line is skipped and counted, the rest survives
  progressDir.map.get('2026-09-19.laptop.ndjson').data += '{"type":"lesson_done","lesson":"nl-les-9\n';
  r = await store.readAll();
  t('damaged line skipped and counted', r.bad === 1 && r.events.length === 4);

  // state is a fold over the events
  const s = fold(r.events);
  t('fold: lessons 1 and 3 done', s.lessons['nl-les-01'].done && s.lessons['nl-les-03'].done && !s.lessons['nl-les-02']);
  t('fold: exercise best/attempts/last', s.exercises['nl-les-02#1'].best === 5 && s.exercises['nl-les-02#1'].attempts === 2 && s.exercises['nl-les-02#1'].last.ok === 5);

  // deleting the derived state loses nothing: a fresh store reads the same log
  const again = new FolderStore(root, { device: 'laptop' });
  t('a fresh store sees the same history', (await again.readAll()).events.length === 4);

  // ProgressLog: events recorded before a folder is connected are queued, then written; nothing is lost or doubled
  const log = new ProgressLog();
  log.record({ type: 'lesson_done', lesson: 'nl-les-05' });
  log.record({ type: 'exercise_checked', lesson: 'nl-les-05', exercise: 0, ok: 2, total: 4 });
  t('unsaved counter before connecting', !log.connected && log.unsaved === 2);
  const root2 = new FakeDir();
  await log.attach(new FolderStore(root2));
  t('queue flushed on connect', log.unsaved === 0 && (await new FolderStore(root2).readAll()).events.length === 2);
  log.record({ type: 'lesson_done', lesson: 'nl-les-06' });
  await new Promise((res) => setTimeout(res, 5));
  t('later events go straight to the folder', (await new FolderStore(root2).readAll()).events.length === 3);
  t('state from the log', log.state().lessons['nl-les-06'].done && log.state().exercises['nl-les-05#0'].last.ok === 2);

  // a folder that fails to write is reported, not hidden
  const broken = { readAll: async () => ({ events: [], bad: 0 }), append: async () => { throw new Error('disk full'); } };
  const log2 = new ProgressLog();
  await log2.attach(broken);
  log2.record({ type: 'lesson_done', lesson: 'nl-les-01' });
  await new Promise((res) => setTimeout(res, 5));
  t('failed write is counted as unsaved', log2.failures === 1 && log2.unsaved === 1);

  // recording is written into its own folder
  await store.saveRecording('les-01-2026-09-19.webm', 'blob');
  t('recording saved under recordings/', (await root.getDirectoryHandle('recordings')).map.has('les-01-2026-09-19.webm'));

  // switching folders: history and recordings are copied, nothing is overwritten
  const oldRoot = new FakeDir();
  const oldStore = new FolderStore(oldRoot);
  await oldStore.append({ type: 'lesson_done', lesson: 'nl-les-01', t: '2026-09-19T10:00:00.000Z' });
  await oldStore.append({ type: 'lesson_done', lesson: 'nl-les-02', t: '2026-09-20T10:00:00.000Z' });
  await oldStore.saveRecording('les-01-x.webm', 'voice');
  const newRoot = new FakeDir();
  const moved = await migrate(oldRoot, newRoot);
  t('migrate: both day files and the recording are copied', moved.copied === 3 && moved.skipped === 0);
  const newEvents = (await new FolderStore(newRoot).readAll()).events;
  t('migrate: the new folder holds the same history', newEvents.length === 2 && newEvents[1].lesson === 'nl-les-02');
  const movedRecording = await (await (await newRoot.getDirectoryHandle('recordings')).getFileHandle('les-01-x.webm')).getFile();
  t('migrate: the recording arrives with its content', (await movedRecording.text()) === 'voice');

  const busyRoot = new FakeDir();
  const busyStore = new FolderStore(busyRoot);
  await busyStore.append({ type: 'lesson_done', lesson: 'nl-les-09', t: '2026-09-19T08:00:00.000Z' });   // same day file name as in oldRoot
  const intoBusy = await migrate(oldRoot, busyRoot);
  const busyEvents = (await new FolderStore(busyRoot).readAll()).events;
  t('migrate: a file the target already has is never overwritten', intoBusy.skipped === 1 && intoBusy.copied === 2 && busyEvents.some((e) => e.lesson === 'nl-les-09'));
  const twice = await migrate(oldRoot, newRoot);
  t('migrate: running it twice copies nothing new', twice.copied === 0 && twice.skipped === 3);
  const empty = await migrate(new FakeDir(), new FakeDir());
  t('migrate: an empty source is fine', empty.copied === 0 && empty.skipped === 0);

  // starting a lesson over: derived state forgets it, the log keeps everything, the next check starts fresh
  const resetEvents = [
    { type: 'lesson_done', lesson: 'nl-les-04', t: '2026-09-20T10:00:00.000Z' },
    { type: 'exercise_checked', lesson: 'nl-les-04', exercise: 0, ok: 3, total: 4, answers: ['a', 'b', 'c', 'd'], t: '2026-09-20T10:01:00.000Z' },
    { type: 'exercise_checked', lesson: 'nl-les-05', exercise: 0, ok: 2, total: 4, t: '2026-09-20T10:02:00.000Z' },
    { type: 'lesson_reset', lesson: 'nl-les-04', t: '2026-09-20T11:00:00.000Z' },
  ];
  const afterReset = fold(resetEvents);
  t('reset: the lesson is no longer done and its exercises are gone', !afterReset.lessons['nl-les-04'] && !afterReset.exercises['nl-les-04#0']);
  t('reset: another lesson is untouched', afterReset.exercises['nl-les-05#0'].last.ok === 2);
  const fresh = fold(resetEvents.concat([{ type: 'exercise_checked', lesson: 'nl-les-04', exercise: 0, ok: 4, total: 4, answers: ['w', 'x', 'y', 'z'], t: '2026-09-20T12:00:00.000Z' }]));
  t('reset: a new attempt after it starts from one and keeps its answers', fresh.exercises['nl-les-04#0'].attempts === 1 && fresh.exercises['nl-les-04#0'].last.answers.join('') === 'wxyz');
  t('the last attempt keeps the stored answers', fold(resetEvents.slice(0, 2)).exercises['nl-les-04#0'].last.answers.length === 4);

  // the reading recording is part of the lesson's practice: it is remembered, and forgotten (not deleted) on reset
  const readEvents = [
    { type: 'recording_saved', lesson: 'nl-les-06', file: 'les-06-a.webm', t: '2026-09-20T10:00:00.000Z' },
    { type: 'recording_saved', lesson: 'nl-les-06', file: 'les-06-b.webm', t: '2026-09-20T10:30:00.000Z' },
  ];
  t('reading: the latest recording of a lesson is remembered', fold(readEvents).readings['nl-les-06'].file === 'les-06-b.webm' && !fold(readEvents).readings['nl-les-07']);
  t('reading: a reset forgets the "sent" mark', !fold(readEvents.concat([{ type: 'lesson_reset', lesson: 'nl-les-06', t: '2026-09-20T11:00:00.000Z' }])).readings['nl-les-06']);
  t('reading: a recording sent after a reset counts again', fold(readEvents.concat([{ type: 'lesson_reset', lesson: 'nl-les-06', t: '2026-09-20T11:00:00.000Z' }, { type: 'recording_saved', lesson: 'nl-les-06', file: 'les-06-c.webm', t: '2026-09-20T12:00:00.000Z' }])).readings['nl-les-06'].file === 'les-06-c.webm');

  console.log(bad ? `FAILURES: ${bad}` : 'PROGRESS STORE TESTS PASSED');
  process.exit(bad ? 1 : 0);
})();
