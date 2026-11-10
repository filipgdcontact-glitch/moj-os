// ============================================================
// Skladište: jedan interfejs, više implementacija.
//
//   adapter.mode          'cloud' | 'local'
//   adapter.start(h)      počinje sinhronizaciju; h.onCollection(coll, records, definitive),
//                         h.onSettings(settings|null, definitive), h.onError(err)
//   adapter.sync(old,new) upisuje razliku između dva stanja (dodato / izmenjeno / obrisano)
//   adapter.pending()     broj upisa u toku
//
// Za Supabase: napravi supabaseAdapter sa istim metodama
// (tabela po kolekciji, red = zapis, kolona user_id + RLS),
// i vrati ga iz createAdapter(). Ostatak aplikacije se ne menja.
// ============================================================
import { COLLECTIONS, serialize, normalizeImport } from "./core.js";

const LS_KEY = "mojos:data:v1";

export const LocalCache = {
  load() {
    try {
      const s = localStorage.getItem(LS_KEY);
      if (!s) return null;
      return normalizeImport(JSON.parse(s));
    } catch {
      return null;
    }
  },
  save(d) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(serialize(d)));
    } catch {}
  },
  clear() {
    try { localStorage.removeItem(LS_KEY); } catch {}
  },
};

export const prefs = {
  get(k, def) {
    try {
      const v = localStorage.getItem("mojos:pref:" + k);
      return v == null ? def : JSON.parse(v);
    } catch { return def; }
  },
  set(k, v) {
    try { localStorage.setItem("mojos:pref:" + k, JSON.stringify(v)); } catch {}
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (o) => JSON.parse(JSON.stringify(o));

/** localStorage — sve stanje u jednom ključu. */
export function localAdapter() {
  return {
    mode: "local",
    start(h) {
      const d = LocalCache.load();
      setTimeout(() => {
        for (const c of COLLECTIONS) h.onCollection(c, d ? Object.values(d[c]) : [], true);
        h.onSettings(d?.settings || null, true);
      }, 0);
    },
    sync(_old, nw) { LocalCache.save(nw); },
    pending: () => 0,
  };
}

/** Claude Artifact baza — privatni prostor korisnika (data/users/<id>/...). */
export async function cloudAdapter() {
  const c = window.claude;
  if (!c || typeof c.use !== "function") return null;
  const timeout = new Promise((r) => setTimeout(() => r(null), 11000));
  const got = await Promise.race([Promise.all([c.use("db"), c.use("user")]), timeout]);
  if (!got) return null;
  const [db, user] = got;
  if (!db || !user) return null;
  let uidv = null;
  try { uidv = await user.id(); } catch {}
  if (!uidv) return null;

  const root = db.doc(`data/users/${uidv}/mojos`); // dokument = podešavanja
  const col = (name) => root.collection(name);

  // Ograničavanje paralelnih upisa + redosled po dokumentu
  let active = 0, waiting = [], pendingCount = 0, onError = () => {}, onPending = () => {};
  const acquire = () => (active < 5 ? (active++, Promise.resolve()) : new Promise((r) => waiting.push(r)));
  const release = () => { active--; const n = waiting.shift(); if (n) { active++; n(); } };
  const chains = new Map();
  const run = async (fn) => {
    for (let i = 0; i < 5; i++) {
      try { return await fn(); } catch (e) {
        if (e && (e.code === "unavailable" || e.code === "resource_exhausted") && i < 4) { await sleep(500 * (i + 1) + Math.random() * 400); continue; }
        throw e;
      }
    }
  };
  const queue = (path, fn) => {
    pendingCount++; onPending(pendingCount);
    const prev = chains.get(path) || Promise.resolve();
    const next = prev.catch(() => {}).then(async () => {
      await acquire();
      try { await run(fn); } catch (e) { onError(e); } finally { release(); pendingCount--; onPending(pendingCount); }
    });
    chains.set(path, next);
    return next;
  };

  return {
    mode: "cloud",
    start(h) {
      onError = h.onError || onError;
      onPending = h.onPending || onPending;
      const unsubs = [];
      for (const name of COLLECTIONS) {
        unsubs.push(
          col(name).limit(1000).onSnapshot(
            (snap) => h.onCollection(name, snap.docs.map((d) => d.data()), !snap.metadata.fromCache),
            (e) => h.onError(e)
          )
        );
      }
      unsubs.push(root.onSnapshot((snap) => h.onSettings(snap.exists ? snap.data() : null, !snap.metadata.fromCache), (e) => h.onError(e)));
      return () => unsubs.forEach((u) => u());
    },
    sync(old, nw) {
      for (const name of COLLECTIONS) {
        const a = old[name] || {}, b = nw[name] || {};
        for (const id of Object.keys(a)) if (!b[id]) queue(`${name}/${id}`, () => col(name).doc(id).delete());
        for (const id of Object.keys(b)) if (b[id] !== a[id]) { const rec = clean(b[id]); queue(`${name}/${id}`, () => col(name).doc(id).set(rec)); }
      }
      if (nw.settings && nw.settings !== old.settings) { const s = clean(nw.settings); queue("settings", () => root.set(s)); }
      LocalCache.save(nw);
    },
    pending: () => pendingCount,
  };
}
