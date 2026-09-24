// Append-only progress log. Phase 1: a folder the learner picks once (outside the public repo).
// One JSON event per line, one file per day per device: progress/2026-09-19.laptop.ndjson.
// Nothing here ever rewrites or edits a past line. Progress state is a fold over the events.
// Works in the browser (File System Access API, Chrome/Edge) and in Node (tests with a fake folder).
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ProgressStore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const pad = (n) => String(n).padStart(2, '0');
  const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // nl-les-05 -> extra/nl/les-05.json
  function extraLocation(lessonId) {
    const m = /^([a-z]{2})-(les-\d+)$/.exec(lessonId || '');
    return m ? { lang: m[1], file: `${m[2]}.json` } : null;
  }

  // Uses only the small part of the File System Access API that a fake folder can also offer.
  class FolderStore {
    constructor(rootDir, opts = {}) {
      this.root = rootDir;
      this.device = opts.device || 'laptop';
    }
    async _dir(name) { return this.root.getDirectoryHandle(name, { create: true }); }

    async append(event) {
      const t = event.t ? new Date(event.t) : new Date();
      const full = { t: t.toISOString(), device: this.device, ...event };
      const dir = await this._dir('progress');
      const fh = await dir.getFileHandle(`${dayOf(t)}.${full.device}.ndjson`, { create: true });
      const size = (await fh.getFile()).size;
      const w = await fh.createWritable({ keepExistingData: true });
      await w.seek(size);
      await w.write(JSON.stringify(full) + '\n');
      await w.close();
    }

    // Reads every day file, skips (and counts) any damaged line instead of failing.
    async readAll() {
      const dir = await this._dir('progress');
      const names = [];
      for await (const [name, handle] of dir.entries()) if (handle.kind === 'file' && name.endsWith('.ndjson')) names.push(name);
      names.sort();
      const events = [];
      let bad = 0;
      for (const name of names) {
        const text = await (await (await dir.getFileHandle(name)).getFile()).text();
        for (const line of text.split('\n')) {
          if (!line.trim()) continue;
          try { events.push(JSON.parse(line)); } catch (e) { bad++; }
        }
      }
      events.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
      return { events, bad };
    }

    // The teacher's extra practice for one lesson: extra/<lang>/les-NN.json in the learner's folder. Read-only.
    // null = no file (normal); { error } = the file is there but unreadable; { data } = parsed JSON.
    async readExtra(lessonId) {
      const at = extraLocation(lessonId);
      if (!at) return null;
      let file;
      try {
        const dir = await (await this.root.getDirectoryHandle('extra')).getDirectoryHandle(at.lang);
        file = await dir.getFileHandle(at.file);
      } catch (e) {
        if (e && e.name === 'NotFoundError') return null;
        throw e;
      }
      const text = await (await file.getFile()).text();
      try { return { data: JSON.parse(text) }; } catch (e) { return { error: `the file is not valid JSON (${e.message})` }; }
    }

    async saveRecording(name, blob) {
      const dir = await this._dir('recordings');
      const fh = await dir.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(blob);
      await w.close();
      return name;
    }
  }

  // Copies the log and the recordings from one folder to another. Never overwrites: a file the new folder already
  // has is left alone (and counted), so switching folders can neither lose nor damage history.
  async function migrate(fromRoot, toRoot) {
    let copied = 0, skipped = 0;
    for (const dirName of ['progress', 'recordings']) {
      let from;
      try { from = await fromRoot.getDirectoryHandle(dirName); } catch (e) { continue; } // nothing to copy from this folder
      const to = await toRoot.getDirectoryHandle(dirName, { create: true });
      const existing = new Set();
      for await (const [name] of to.entries()) existing.add(name);
      for await (const [name, handle] of from.entries()) {
        if (handle.kind !== 'file') continue;
        if (existing.has(name)) { skipped++; continue; }
        const file = await handle.getFile();
        const w = await (await to.getFileHandle(name, { create: true })).createWritable();
        await w.write(file);
        await w.close();
        copied++;
      }
    }
    return { copied, skipped };
  }

  // The current state is derived from the events, never stored as the source of truth.
  function fold(events) {
    const lessons = {};
    const exercises = {};
    const readings = {};   // lesson id -> the latest reading recording sent for it
    for (const e of events) {
      if (e.type === 'lesson_done') lessons[e.lesson] = { done: true, at: e.t };
      else if (e.type === 'lesson_reset') {
        // the learner started the lesson over: it is no longer done and its exercises are blank again.
        // The log itself keeps every earlier event; only the derived state forgets them.
        delete lessons[e.lesson];
        for (const key of Object.keys(exercises)) if (key.startsWith(`${e.lesson}#`)) delete exercises[key];
        delete readings[e.lesson];   // the recording file itself stays in the folder, only the "sent" mark is forgotten
      } else if (e.type === 'recording_saved') readings[e.lesson] = { file: e.file, at: e.t };
      else if (e.type === 'exercise_checked') {
        const key = `${e.lesson}#${e.exercise}`;
        const x = exercises[key] || (exercises[key] = { attempts: 0, best: 0 });
        x.attempts++;
        x.last = { ok: e.ok, total: e.total, at: e.t, wrong: e.wrong, answers: e.answers, words: e.words };
        x.best = Math.max(x.best, e.ok);
      }
    }
    return { lessons, exercises, readings };
  }

  // How far a lesson is: its exercises (each counts by the share of right answers in the latest attempt) plus reading aloud
  // (the recording sent to the teacher). 100% needs all of it. The page and the "extra practice needed" check both use this,
  // so they can never disagree about what 100% means. Extra-practice exercises are not part of it.
  function lessonProgress(lesson, state) {
    const checked = lesson.practice.map((_, k) => state.exercises[`${lesson.id}#${k}`]).filter(Boolean);
    const readDone = !!state.readings[lesson.id], parts = lesson.practice.length + 1;
    const score = checked.reduce((sum, x) => sum + x.last.ok / (x.last.total || 1), 0) + (readDone ? 1 : 0);
    return { pct: Math.round((100 * score) / parts), count: checked.length + (readDone ? 1 : 0), parts, readDone };
  }

  // Keeps events in memory, queues them until a folder is connected, and never hides a failed write.
  class ProgressLog {
    constructor(opts = {}) {
      this.device = opts.device || 'laptop';
      this.events = [];
      this.pending = [];
      this.store = null;
      this.failures = 0;
      this.onChange = () => {};
    }
    async attach(store) {
      const { events, bad } = await store.readAll();
      this.store = store;
      this.badLines = bad;
      const known = new Set(events.map((e) => e.t + '|' + e.type));
      const queued = this.pending.filter((e) => !known.has(e.t + '|' + e.type));
      this.events = events.concat(queued);
      this.pending = [];
      for (const e of queued) await this._write(e);
      this.onChange();
    }
    record(event) {
      const full = { t: new Date().toISOString(), device: this.device, ...event };
      this.events.push(full);
      if (this.store) this._write(full); else this.pending.push(full);
      this.onChange();
      return full;
    }
    async _write(full) {
      try { await this.store.append(full); } catch (e) { this.failures++; this.onChange(); }
    }
    get connected() { return !!this.store; }
    get unsaved() { return this.pending.length + this.failures; }
    state() { return fold(this.events); }
  }

  // ---- Browser only: remember the chosen folder between visits (a folder handle can live in IndexedDB).
  const handleStore = {
    _open() {
      return new Promise((resolve, reject) => {
        const r = indexedDB.open('language-app', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    },
    async get(key) {
      const db = await this._open();
      return new Promise((resolve, reject) => { const q = db.transaction('kv').objectStore('kv').get(key); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
    },
    async set(key, value) {
      const db = await this._open();
      return new Promise((resolve, reject) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(value, key); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    },
  };

  return { FolderStore, ProgressLog, fold, migrate, dayOf, handleStore, extraLocation, lessonProgress };
});
