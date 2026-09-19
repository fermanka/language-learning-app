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

    async saveRecording(name, blob) {
      const dir = await this._dir('recordings');
      const fh = await dir.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(blob);
      await w.close();
      return name;
    }
  }

  // The current state is derived from the events, never stored as the source of truth.
  function fold(events) {
    const lessons = {};
    const exercises = {};
    for (const e of events) {
      if (e.type === 'lesson_done') lessons[e.lesson] = { done: true, at: e.t };
      else if (e.type === 'exercise_checked') {
        const key = `${e.lesson}#${e.exercise}`;
        const x = exercises[key] || (exercises[key] = { attempts: 0, best: 0 });
        x.attempts++;
        x.last = { ok: e.ok, total: e.total, at: e.t };
        x.best = Math.max(x.best, e.ok);
      }
    }
    return { lessons, exercises };
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

  return { FolderStore, ProgressLog, fold, dayOf, handleStore };
});
