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
      const { data: sd } = await sb.auth.getSession();
      if (sd.session && sd.session.expires_at * 1000 < Date.now() + 60000) await sb.auth.refreshSession();
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

  const api = {
    mode: "supabase",
    start(handlers) {
      h = handlers;
      let stopped = false, lastOk = 0;
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
        subscribe();
        lastOk = Date.now();
        h.onSynced?.(lastOk);
      })();

      // Realtime: ako veza padne, napravi novu i povuci propušteno
      const subscribe = () => {
        if (stopped) return;
        if (channel) { try { sb.removeChannel(channel); } catch {} channel = null; }
        channel = sb.channel(`records-${uid}-${Date.now()}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "records", filter: `user_id=eq.${uid}` }, (p) => {
            const row = p.eventType === "DELETE" ? p.old : p.new;
            const coll = row?.coll;
            if (!coll || !state[coll]) return;
            const k = `${coll}/${row.id}`;
            if (queue[k]) return; // naša izmena još čeka; ona ima prednost
            if (p.eventType === "DELETE") state[coll].delete(row.id);
            else state[coll].set(row.id, row.data);
            emit(coll, true);
            lastOk = Date.now(); h.onSynced?.(lastOk);
          })
          .subscribe((status) => {
            if (stopped) return;
            if (status === "SUBSCRIBED") refresh("realtime");
            else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              clearTimeout(resub);
              resub = setTimeout(subscribe, 4000);
            }
          });
      };

      // Osvežavanje: prvo obnovi prijavu (token ističe za sat vremena), pa povuci sve iz baze
      let refreshing = null, fails = 0, resub = null;
      const refresh = (why) => {
        if (stopped) return Promise.resolve();
        if (refreshing) return refreshing;
        refreshing = (async () => {
          try {
            const { data } = await sb.auth.getSession();
            if (!data.session) throw new Error("Prijava je istekla. Prijavi se ponovo.");
            if (data.session.expires_at * 1000 < Date.now() + 60000) await sb.auth.refreshSession();
            await flush();
            await loadAll();
            if (stopped) return;
            for (const c of COLLECTIONS) emit(c, true);
            emit("settings", true);
            fails = 0;
            lastOk = Date.now();
            h.onSynced?.(lastOk);
            h.onError?.(null);
          } catch (e) {
            fails++;
            if (/jwt|token|expired/i.test(e?.message || "")) { try { await sb.auth.refreshSession(); } catch {} }
            if (fails >= 2) h.onError?.({ message: dbError(e) });
          } finally {
            refreshing = null;
          }
        })();
        return refreshing;
      };
      api.refresh = refresh;
      const onOnline = () => refresh("online");
      const onVisible = () => { if (document.visibilityState === "visible") refresh("visible"); };
      const onFocus = () => { if (Date.now() - lastOk > 20000) refresh("focus"); };
      // sigurnosna mreža: dok je aplikacija otvorena i vidljiva, proveri bazu svakih 60 s
      const poll = setInterval(() => { if (document.visibilityState === "visible" && Date.now() - lastOk > 55000) refresh("poll"); }, 60000);
      const { data: authSub } = sb.auth.onAuthStateChange((ev, sess) => {
        if (ev === "TOKEN_REFRESHED" && sess?.access_token) { try { sb.realtime.setAuth(sess.access_token); } catch {} }
      });
      window.addEventListener("online", onOnline);
      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        stopped = true;
        clearTimeout(timer); clearTimeout(retry); clearTimeout(resub); clearInterval(poll);
        authSub?.subscription?.unsubscribe();
        window.removeEventListener("online", onOnline);
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onVisible);
        if (channel) sb.removeChannel(channel);
      };
    },
    sync(old, nw) {
      const gone = [];
      for (const coll of ["tasks", "notes", "projects", "events"]) {
        const a = old[coll] || {}, b = nw[coll] || {};
        for (const id of Object.keys(a)) {
          if (!a[id].attachments?.length) continue;
          const keep = new Set(filesOf(b[id]));
          for (const f of filesOf(a[id])) if (!keep.has(f)) gone.push(f);
        }
      }
      if (gone.length) removeFiles(gone);
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
    refresh: () => Promise.resolve(),
  };
  return api;
}

// ============================================================
// Prilozi (Supabase Storage, bucket „prilozi“, privatno)
// ============================================================
export const BUCKET = "prilozi";
export const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPT = /^(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf)$/;

export const storageError = (e) => {
  const m = (e?.message || e?.error || "").toLowerCase();
  if (m.includes("bucket not found") || m.includes("row-level security") || m.includes("unauthorized")) return "Prilozi još nisu podešeni u Supabase-u. Pokreni SQL iz supabase/storage.sql.";
  if (m.includes("maximum allowed size") || m.includes("too large") || m.includes("payload")) return "Fajl je prevelik (najviše 15 MB).";
  if (m.includes("mime") || m.includes("not supported")) return "Dozvoljene su samo slike i PDF fajlovi.";
  if (m.includes("fetch") || m.includes("network")) return "Nema veze sa serverom. Probaj ponovo kad se veza vrati.";
  return e?.message || "Otpremanje nije uspelo.";
};

const canvasBlob = (canvas, q) => new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", q));
async function resizeImage(file, maxSide, quality) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return { blob: await canvasBlob(c, quality), w, h, srcW: Math.round(w / scale), srcH: Math.round(h / scale) };
}

/** Priprema fajl: velike slike smanjuje na 2560 px (JPEG), pravi sličicu od 480 px. */
export async function prepareFile(file) {
  const type = file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "");
  if (!ACCEPT.test(type)) throw new Error("Dozvoljene su samo slike (JPG, PNG, WebP, GIF, HEIC) i PDF.");
  if (type === "application/pdf" || type === "image/gif") {
    if (file.size > MAX_BYTES) throw new Error("Fajl je prevelik (najviše 15 MB).");
    return { main: file, type, ext: type === "application/pdf" ? "pdf" : "gif", thumb: null };
  }
  try {
    const big = file.size > 1.5 * 1024 * 1024;
    const full = await resizeImage(file, 2560, 0.86);
    const useOrig = !big && full.srcW <= 2560 && full.srcH <= 2560 && /jpeg|png|webp/.test(type);
    const thumb = await resizeImage(file, 480, 0.8);
    const main = useOrig ? file : full.blob;
    if (main.size > MAX_BYTES) throw new Error("Fajl je prevelik (najviše 15 MB).");
    return { main, type: useOrig ? type : "image/jpeg", ext: useOrig ? type.split("/")[1].replace("jpeg", "jpg") : "jpg", thumb: thumb.blob, w: full.srcW, h: full.srcH };
  } catch (e) {
    if (/prevelik/.test(e.message)) throw e;
    if (file.size > MAX_BYTES) throw new Error("Fajl je prevelik (najviše 15 MB).");
    return { main: file, type, ext: (file.name.split(".").pop() || "img").toLowerCase().slice(0, 5), thumb: null };
  }
}

export async function uploadAttachment(kind, recId, file) {
  const sb = getClient();
  if (!sb) throw new Error("Prilozi rade samo kad si prijavljen.");
  const { data } = await sb.auth.getSession();
  const uidv = data.session?.user?.id;
  if (!uidv) throw new Error("Prijavi se ponovo.");
  const prep = await prepareFile(file);
  const aid = `a-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const base = `${uidv}/${kind}/${recId}/${aid}`;
  const path = `${base}.${prep.ext}`;
  const up = await sb.storage.from(BUCKET).upload(path, prep.main, { contentType: prep.type, cacheControl: "3600", upsert: false });
  if (up.error) throw new Error(storageError(up.error));
  let thumb = null;
  if (prep.thumb) {
    const t = await sb.storage.from(BUCKET).upload(`${base}-t.jpg`, prep.thumb, { contentType: "image/jpeg", cacheControl: "3600", upsert: false });
    if (!t.error) thumb = `${base}-t.jpg`;
  }
  return { id: aid, name: file.name.slice(0, 160) || "fajl", type: prep.type, size: prep.main.size, path, thumb, w: prep.w || null, h: prep.h || null, createdAt: new Date().toISOString() };
}

const urlCache = new Map(); // path -> { url, exp }
export async function signedUrls(paths) {
  const sb = getClient();
  if (!sb || !paths.length) return {};
  const now = Date.now();
  const need = paths.filter((p) => !(urlCache.get(p)?.exp > now + 60000));
  if (need.length) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(need, 3600);
    if (error) throw new Error(storageError(error));
    for (const r of data || []) if (r.signedUrl && !r.error) urlCache.set(r.path, { url: r.signedUrl, exp: now + 3600 * 1000 });
  }
  return Object.fromEntries(paths.map((p) => [p, urlCache.get(p)?.url || null]));
}

export async function removeFiles(paths) {
  const sb = getClient();
  if (!sb || !paths.length) return;
  for (let i = 0; i < paths.length; i += 100) await sb.storage.from(BUCKET).remove(paths.slice(i, i + 100)).catch(() => {});
  paths.forEach((p) => urlCache.delete(p));
}
const filesOf = (rec) => (rec?.attachments || []).flatMap((a) => [a.path, a.thumb].filter(Boolean));
