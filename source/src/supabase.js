// ============================================================
// Supabase: klijent, prijava i adapter skladišta.
// Tabela public.records (user_id, coll, id, data jsonb, updated_at), RLS po korisniku.
// Isti interfejs kao ostali adapteri: start(h), sync(old, new), pending().
// ============================================================
import { COLLECTIONS } from "./core.js";
import { LocalCache } from "./storage.js";

const QUEUE_KEY = "mojos:sb:queue";
const ALL = [...COLLECTIONS, "settings"];
const clean = (o) => JSON.parse(JSON.stringify(o));

export const supabaseConfig = () => {
  const c = window.MOJOS_CONFIG || {};
  if (!window.MOJOS_STANDALONE || !c.supabaseUrl || !c.supabaseKey || !window.supabase?.createClient) return null;
  return c;
};

let client = null;
export const getClient = () => {
  const c = supabaseConfig();
  if (!c) return null;
  if (!client) client = window.supabase.createClient(c.supabaseUrl, c.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "mojos-auth" },
  });
  return client;
};

/** Poruke grešaka za korisnika (srpski). */
export const authError = (e) => {
  const m = (e?.message || "").toLowerCase();
  if (m.includes("invalid login")) return "Pogrešan e-mail ili lozinka.";
  if (m.includes("email not confirmed")) return "E-mail još nije potvrđen. Otvori link iz poruke koju si dobio.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Nalog sa ovim e-mailom već postoji. Prijavi se.";
  if (m.includes("password") && m.includes("6")) return "Lozinka mora imati najmanje 6 znakova.";
  if (m.includes("rate limit") || m.includes("too many")) return "Previše pokušaja. Sačekaj minut pa probaj ponovo.";
  if (m.includes("invalid") && m.includes("email")) return "E-mail adresa nije ispravna.";
  if (m.includes("fetch") || m.includes("network")) return "Nema veze sa serverom. Proveri internet.";
  return e?.message || "Nešto nije u redu. Probaj ponovo.";
};

export const dbError = (e) => {
  if (!e) return null;
  if (e.code === "PGRST205" || e.code === "42P01" || /could not find the table/i.test(e.message || "")) return "Baza nije podešena: tabela „records“ ne postoji. Pokreni SQL iz supabase/schema.sql.";
  if (/fetch|network/i.test(e.message || "")) return "Nema veze sa serverom — izmene čekaju i biće sačuvane kad se veza vrati.";
  return e.message || "Greška pri čuvanju";
};

/** Adapter za Supabase. Upisi idu u red (localStorage), pa se šalju u paketima; preživljavaju gubitak veze. */
export function supabaseAdapter(sb, user) {
  const uid = user.id;
  let queue = {};
  try { queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || "{}"); if (queue.__uid !== uid) queue = {}; } catch { queue = {}; }
  delete queue.__uid;
  const saveQueue = () => { try { localStorage.setItem(QUEUE_KEY, JSON.stringify({ ...queue, __uid: uid })); } catch {} };

  let h = null, timer = null, flushing = false, channel = null, retry = null;
  const state = Object.fromEntries(ALL.map((c) => [c, new Map()]));
  const pendingCount = () => Object.keys(queue).length;
  const notifyPending = () => h?.onPending?.(pendingCount());

  const emit = (coll, def) => {
    if (coll === "settings") h.onSettings(state.settings.get("settings") || null, def);
    else h.onCollection(coll, [...state[coll].values()], def);
  };

  const flush = async () => {
    if (flushing) return;
    const keys = Object.keys(queue);
    if (!keys.length) { notifyPending(); return; }
    flushing = true;
    const batch = keys.map((k) => [k, queue[k]]);
    try {
      const ups = batch.filter(([, q]) => q.op === "set").map(([, q]) => ({ user_id: uid, coll: q.coll, id: q.id, data: q.data, updated_at: new Date().toISOString() }));
      for (let i = 0; i < ups.length; i += 400) {
        const { error } = await sb.from("records").upsert(ups.slice(i, i + 400), { onConflict: "user_id,coll,id" });
        if (error) throw error;
      }
      const dels = batch.filter(([, q]) => q.op === "del");
      const byColl = {};
      for (const [, q] of dels) (byColl[q.coll] ||= []).push(q.id);
      for (const [coll, ids] of Object.entries(byColl)) {
        for (let i = 0; i < ids.length; i += 200) {
          const { error } = await sb.from("records").delete().eq("user_id", uid).eq("coll", coll).in("id", ids.slice(i, i + 200));
          if (error) throw error;
        }
      }
      // ukloni iz reda samo ono što je poslato (u međuvremenu je moglo stići novo)
      for (const [k, q] of batch) if (queue[k] === q || (queue[k] && queue[k].v === q.v)) delete queue[k];
      saveQueue();
      h?.onError?.(null);
    } catch (e) {
      h?.onError?.({ message: dbError(e) });
      clearTimeout(retry);
      retry = setTimeout(flush, 15000);
    } finally {
      flushing = false;
      notifyPending();
      if (Object.keys(queue).some((k) => !batch.find(([b]) => b === k))) schedule();
    }
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(flush, 350); };
  let ver = 0;
  const enqueue = (coll, id, op, data) => { queue[`${coll}/${id}`] = { coll, id, op, data, v: ++ver + ":" + Date.now() }; };

  const loadAll = async () => {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from("records").select("coll,id,data").eq("user_id", uid).range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    for (const c of ALL) state[c].clear();
    for (const r of rows) if (state[r.coll]) state[r.coll].set(r.id, r.data);
    // lokalne izmene koje još nisu poslate imaju prednost
    for (const q of Object.values(queue)) {
      if (!state[q.coll]) continue;
      if (q.op === "set") state[q.coll].set(q.id, q.data); else state[q.coll].delete(q.id);
    }
  };

  return {
    mode: "supabase",
    start(handlers) {
      h = handlers;
      let stopped = false;
      (async () => {
        try {
          await loadAll();
          if (stopped) return;
          for (const c of COLLECTIONS) emit(c, true);
          emit("settings", true);
          notifyPending();
          if (pendingCount()) schedule();
        } catch (e) {
          h.onError({ message: dbError(e), fatal: true });
          return;
        }
        channel = sb.channel(`records-${uid}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "records", filter: `user_id=eq.${uid}` }, (p) => {
            const row = p.eventType === "DELETE" ? p.old : p.new;
            const coll = row?.coll;
            if (!coll || !state[coll]) return;
            const k = `${coll}/${row.id}`;
            if (queue[k]) return; // naša izmena još čeka; ona ima prednost
            if (p.eventType === "DELETE") state[coll].delete(row.id);
            else state[coll].set(row.id, row.data);
            emit(coll, true);
          })
          .subscribe((status) => {
            if (status === "SUBSCRIBED" && !stopped) {
              // posle ponovnog povezivanja povuci sve što je propušteno
              loadAll().then(() => { if (!stopped) { for (const c of COLLECTIONS) emit(c, true); emit("settings", true); } }).catch(() => {});
            }
          });
      })();
      const onOnline = () => flush();
      const onVisible = () => { if (document.visibilityState === "visible") { flush(); loadAll().then(() => { for (const c of COLLECTIONS) emit(c, true); emit("settings", true); }).catch(() => {}); } };
      window.addEventListener("online", onOnline);
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        stopped = true;
        clearTimeout(timer); clearTimeout(retry);
        window.removeEventListener("online", onOnline);
        document.removeEventListener("visibilitychange", onVisible);
        if (channel) sb.removeChannel(channel);
      };
    },
    sync(old, nw) {
      for (const coll of COLLECTIONS) {
        const a = old[coll] || {}, b = nw[coll] || {};
        for (const id of Object.keys(a)) if (!b[id]) { state[coll].delete(id); enqueue(coll, id, "del"); }
        for (const id of Object.keys(b)) if (b[id] !== a[id]) { const d = clean(b[id]); state[coll].set(id, d); enqueue(coll, id, "set", d); }
      }
      if (nw.settings && nw.settings !== old.settings) { const d = clean(nw.settings); state.settings.set("settings", d); enqueue("settings", "settings", "set", d); }
      saveQueue();
      notifyPending();
      LocalCache.save(nw);
      schedule();
    },
    pending: pendingCount,
  };
}
