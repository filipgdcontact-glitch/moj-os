// ============================================================
// Centralno stanje + akcije. Sve izmene idu kroz mutate(fn):
// fn prima staro stanje i vraća novo; adapter upisuje razliku.
// ============================================================
import {
  KINDS, COLLECTIONS, emptyData, hasRecords, demoData, makeSettings, nowISO, uid, spawnNextTask,
} from "./core.js";
import { LocalCache, localAdapter, cloudAdapter } from "./storage.js";

const { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } = React;
const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const putRec = (d, rec) => {
  const c = KINDS[rec.kind];
  return { ...d, [c]: { ...d[c], [rec.id]: rec } };
};
const delRec = (d, kind, id) => {
  const c = KINDS[kind];
  if (!d[c][id]) return d;
  const m = { ...d[c] };
  delete m[id];
  return { ...d, [c]: m };
};

/** Završavanje zadatka uz logiku ponavljanja (sledeći zadatak se pravi samo jednom). */
const withStatus = (d, task, status) => {
  const prev = d.tasks[task.id];
  let t = { ...task, status };
  if (status === "done") {
    t.completedAt = prev?.status === "done" && prev.completedAt ? prev.completedAt : nowISO();
    if (t.recurrence && t.recurrence !== "none" && !t.nextId && (t.dueDate || t.workDate)) {
      const next = spawnNextTask(t);
      t.nextId = next.id;
      d = putRec(d, next);
      return { d: putRec(d, t), spawned: next };
    }
  } else {
    t.completedAt = null;
  }
  return { d: putRec(d, t), spawned: null };
};

export function StoreProvider({ children, makeAdapter }) {
  const [data, setData] = useState(() => LocalCache.load() || emptyData());
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState("init");
  const [syncState, setSyncState] = useState({ pending: 0, error: null, stale: false, fatal: null });
  const dataRef = useRef(data);
  const adapterRef = useRef(null);

  const commit = useCallback((nw, sync = true) => {
    const old = dataRef.current;
    if (nw === old) return;
    dataRef.current = nw;
    setData(nw);
    if (sync && adapterRef.current) adapterRef.current.sync(old, nw);
  }, []);

  const mutate = useCallback((fn) => {
    const r = fn(dataRef.current);
    commit(r);
    return r;
  }, [commit]);

  // ---------- Pokretanje: oblak ako je dostupan, inače localStorage ----------
  useEffect(() => {
    let stop = null, cancelled = false;
    (async () => {
      let adapter = null;
      try { adapter = makeAdapter ? await makeAdapter() : await cloudAdapter(); } catch { adapter = null; }
      if (cancelled) return;
      if (!adapter) adapter = localAdapter();
      adapterRef.current = adapter;
      setMode(adapter.mode);

      const cache = LocalCache.load();
      let decided = false;
      const definitive = new Set();
      const staleTimer = setTimeout(() => {
        if (!decided) { decided = true; setReady(true); setSyncState((s) => ({ ...s, stale: true })); }
      }, 10000);

      const finish = () => {
        if (decided) return;
        decided = true;
        clearTimeout(staleTimer);
        setReady(true);
        setSyncState((s) => ({ ...s, stale: false }));
      };

      stop = adapter.start({
        onCollection(coll, records, def) {
          const prev = dataRef.current[coll];
          const m = {};
          for (const r of records) {
            if (!r || !r.id) continue;
            const old = prev[r.id];
            m[r.id] = old && old.updatedAt === r.updatedAt ? old : r;
          }
          commit({ ...dataRef.current, [coll]: m }, false);
          if (def) definitive.add(coll);
        },
        onSettings(s, def) {
          if (s) commit({ ...dataRef.current, settings: s }, false);
          if (!def || decided) return;
          if (!s) {
            // Prvo pokretanje na ovom skladištu: prenesi lokalne podatke ili ubaci demo.
            const start = cache && adapter.mode !== "local" && COLLECTIONS.some((c) => Object.values(cache[c]).some((r) => !r.demo)) ? { ...cache, settings: makeSettings({ ...(cache.settings || {}), id: "settings" }) } : demoData();
            const empty = emptyData();
            dataRef.current = empty;
            commit(start);
          }
          finish();
        },
        onError(e) {
          if (e?.fatal) { decided = true; clearTimeout(staleTimer); setReady(true); setSyncState((st) => ({ ...st, fatal: e.message })); return; }
          setSyncState((st) => ({ ...st, error: e ? e.message || "Greška pri čuvanju" : null }));
        },
        onPending(n) {
          setSyncState((st) => ({ ...st, pending: n, error: n === 0 ? st.error : st.error }));
        },
      });
    })();
    return () => { cancelled = true; if (typeof stop === "function") stop(); };
  }, [commit, makeAdapter]);

  // ---------- Akcije ----------
  const actions = useMemo(() => {
    const touch = (rec, keepDemo) => ({ ...rec, updatedAt: nowISO(), demo: keepDemo ? rec.demo : false });
    return {
      save(rec) {
        // čuvanje iz forme; za zadatke proverava prelazak u "Završeno"
        let spawned = null;
        mutate((d) => {
          if (rec.kind === "task") {
            const r = withStatus(d, touch(rec), rec.status);
            spawned = r.spawned;
            return r.d;
          }
          return putRec(d, touch(rec));
        });
        return spawned;
      },
      setTaskStatus(id, status) {
        let spawned = null;
        mutate((d) => {
          const t = d.tasks[id];
          if (!t || t.status === status) return d;
          const r = withStatus(d, touch(t, true), status);
          spawned = r.spawned;
          return r.d;
        });
        return spawned;
      },
      togglePin(id) {
        mutate((d) => (d.notes[id] ? putRec(d, touch({ ...d.notes[id], pinned: !d.notes[id].pinned }, true)) : d));
      },
      duplicate(kind, id) {
        const src = dataRef.current[KINDS[kind]][id];
        if (!src) return null;
        const t = nowISO();
        const copy = { ...src, id: uid(src.id.split("-")[0]), createdAt: t, updatedAt: t, demo: false };
        if (kind === "task") Object.assign(copy, { title: `${src.title} (kopija)`, status: src.status === "done" ? "todo" : src.status, completedAt: null, nextId: null, prevId: null });
        else if (kind === "project" || kind === "space") copy.name = `${src.name} (kopija)`;
        else if (kind === "note") Object.assign(copy, { title: src.title ? `${src.title} (kopija)` : "", pinned: false });
        else copy.title = `${src.title} (kopija)`;
        mutate((d) => putRec(d, copy));
        return copy;
      },
      remove(kind, id) {
        mutate((d) => {
          let n = delRec(d, kind, id);
          if (kind === "project") {
            for (const c of ["tasks", "events", "notes"])
              for (const r of Object.values(n[c])) if (r.projectId === id) n = putRec(n, { ...r, projectId: null, updatedAt: nowISO() });
          }
          if (kind === "space") {
            for (const r of Object.values(n.tasks)) if (r.spaceId === id) n = putRec(n, { ...r, spaceId: null, updatedAt: nowISO() });
          }
          if (kind === "task") {
            for (const r of Object.values(n.tasks)) if (r.nextId === id || r.prevId === id) n = putRec(n, { ...r, nextId: r.nextId === id ? null : r.nextId, prevId: r.prevId === id ? null : r.prevId });
          }
          return n;
        });
      },
      updateSettings(patch) {
        mutate((d) => ({ ...d, settings: { ...(d.settings || makeSettings()), ...patch, updatedAt: nowISO() } }));
      },
      replaceAll(nd) {
        mutate(() => ({ ...nd, settings: { ...(nd.settings || makeSettings()), updatedAt: nowISO() } }));
      },
      removeDemo() {
        let count = 0;
        mutate((d) => {
          const n = { ...d };
          for (const c of COLLECTIONS) {
            const m = {};
            for (const r of Object.values(d[c])) {
              if (r.demo && !(c === "spaces" && Object.values(d.projects).some((p) => !p.demo && p.spaceId === r.id))) count++;
              else m[r.id] = r;
            }
            n[c] = m;
          }
          for (const c of ["tasks", "events", "notes", "projects"])
            for (const r of Object.values(n[c])) {
              const pBad = "projectId" in r && r.projectId && !n.projects[r.projectId];
              const sBad = "spaceId" in r && r.spaceId && !n.spaces[r.spaceId];
              if (pBad || sBad) n[c] = { ...n[c], [r.id]: { ...r, projectId: pBad ? null : r.projectId, spaceId: sBad ? null : r.spaceId, updatedAt: nowISO() } };
            }
          n.settings = { ...(d.settings || makeSettings()), demoLoaded: false, updatedAt: nowISO() };
          return n;
        });
        return count;
      },
      clearAll() {
        mutate((d) => ({ ...emptyData(), settings: { ...(d.settings || makeSettings()), demoLoaded: false, updatedAt: nowISO() } }));
      },
      loadDemo() {
        mutate((d) => {
          const demo = demoData();
          const n = { ...d };
          for (const c of COLLECTIONS) n[c] = { ...d[c], ...demo[c] };
          n.settings = { ...(d.settings || makeSettings()), demoLoaded: true, updatedAt: nowISO() };
          return n;
        });
      },
    };
  }, [mutate]);

  const value = useMemo(() => ({ data, ready, mode, syncState, actions, getData: () => dataRef.current }), [data, ready, mode, syncState, actions]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
