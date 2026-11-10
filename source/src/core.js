// ============================================================
// Moj OS — jezgro: datumi, modeli podataka, skladište
// ============================================================

// ---------- Datumi (lokalni "YYYY-MM-DD" stringovi) ----------
export const pad = (n) => String(n).padStart(2, "0");
export const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const today = () => toStr(new Date());
export const addDays = (s, n) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return toStr(d);
};
export const addMonths = (s, n) => {
  const d = parse(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toStr(d);
};
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5); // b - a
export const dow = (s) => (parse(s).getDay() + 6) % 7; // 0 = ponedeljak
export const weekStart = (s) => addDays(s, -dow(s));
export const monthStart = (s) => s.slice(0, 8) + "01";
export const nowISO = () => new Date().toISOString();
export const nowTime = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const toMin = (t) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const fromMin = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

export const DAYS = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota", "Nedelja"];
export const DAYS_S = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
export const MONTHS = ["januar", "februar", "mart", "april", "maj", "jun", "jul", "avgust", "septembar", "oktobar", "novembar", "decembar"];

export const fmtDay = (s) => {
  const d = parse(s);
  return `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
};
export const fmtFull = (s) => {
  const d = parse(s);
  return `${DAYS[dow(s)]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}.`;
};
export const fmtNum = (s) => {
  const d = parse(s);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
};
export const fmtRel = (s) => {
  if (!s) return "";
  const t = today();
  const k = diffDays(t, s);
  if (k === 0) return "Danas";
  if (k === 1) return "Sutra";
  if (k === -1) return "Juče";
  const d = parse(s);
  const y = d.getFullYear() !== parse(t).getFullYear() ? ` ${d.getFullYear()}.` : "";
  return `${DAYS_S[dow(s)]} ${d.getDate()}. ${MONTHS[d.getMonth()].slice(0, 3)}${y}`;
};
export const fmtWeekRange = (start) => {
  const end = addDays(start, 6);
  const a = parse(start), b = parse(end);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()}. ${MONTHS[b.getMonth()]} ${b.getFullYear()}.`;
  if (a.getFullYear() === b.getFullYear()) return `${a.getDate()}. ${MONTHS[a.getMonth()].slice(0, 3)} – ${b.getDate()}. ${MONTHS[b.getMonth()].slice(0, 3)} ${b.getFullYear()}.`;
  return `${fmtNum(start)}${a.getFullYear()}. – ${fmtNum(end)}${b.getFullYear()}.`;
};
export const fmtMonth = (s) => {
  const d = parse(s);
  const m = MONTHS[d.getMonth()];
  return `${m[0].toUpperCase()}${m.slice(1)} ${d.getFullYear()}.`;
};
export const fmtStamp = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()}. ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}. u ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fmtDuration = (m) => {
  if (!m) return "";
  const h = Math.floor(m / 60), r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${r} min` : `${h} h`;
};

// ---------- Šifarnici ----------
export const STATUS = [
  { v: "todo", l: "Za uraditi" },
  { v: "doing", l: "U toku" },
  { v: "waiting", l: "Na čekanju" },
  { v: "done", l: "Završeno" },
];
export const statusLabel = (v) => STATUS.find((s) => s.v === v)?.l || v;

export const PRIORITY = [
  { v: "low", l: "Nizak", r: 1 },
  { v: "normal", l: "Uobičajen", r: 2 },
  { v: "high", l: "Visok", r: 3 },
  { v: "urgent", l: "Hitno", r: 4 },
];
export const prioRank = (v) => PRIORITY.find((p) => p.v === v)?.r || 2;
export const prioLabel = (v) => PRIORITY.find((p) => p.v === v)?.l || v;

export const RECUR = [
  { v: "none", l: "Bez ponavljanja" },
  { v: "daily", l: "Svaki dan" },
  { v: "every2", l: "Svaki drugi dan" },
  { v: "weekly", l: "Svake nedelje" },
  { v: "monthly", l: "Svakog meseca" },
];
export const recurLabel = (v) => RECUR.find((r) => r.v === v)?.l || "Bez ponavljanja";
export const stepDate = (s, rec) => {
  if (rec === "daily") return addDays(s, 1);
  if (rec === "every2") return addDays(s, 2);
  if (rec === "weekly") return addDays(s, 7);
  if (rec === "monthly") return addMonths(s, 1);
  return s;
};

export const PROJECT_STATUS = [
  { v: "active", l: "Aktivan" },
  { v: "paused", l: "Na čekanju" },
  { v: "done", l: "Završen" },
  { v: "archived", l: "Arhiviran" },
];
export const projStatusLabel = (v) => PROJECT_STATUS.find((s) => s.v === v)?.l || v;

export const COLORS = ["#e3a73f", "#6c9cf0", "#4fbf86", "#e8716f", "#a98ce8", "#3fb8c0", "#e98c4f", "#d27aae", "#8a94a8"];

// ---------- Modeli ----------
export const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const base = (prefix, kind) => {
  const t = nowISO();
  return { id: uid(prefix), kind, createdAt: t, updatedAt: t, demo: false };
};

/** Space — šira oblast (Posao, Privatno, Učenje) */
export const makeSpace = (p = {}) => ({ ...base("s", "space"), name: "", color: COLORS[1], ...p });

/** Project — konkretna celina unutar prostora */
export const makeProject = (p = {}) => ({
  ...base("p", "project"),
  name: "", description: "", spaceId: null, status: "active", color: COLORS[0],
  startDate: today(), dueDate: null,
  ...p,
});

/** Task — zadatak sa rokom i/ili terminom rada */
export const makeTask = (p = {}) => ({
  ...base("t", "task"),
  title: "", description: "", status: "todo", priority: "normal",
  projectId: null, spaceId: null,
  dueDate: null, dueTime: null, workDate: null, workTime: null, duration: null,
  tags: [], recurrence: "none", completedAt: null, nextId: null, prevId: null,
  ...p,
});

/** Event — događaj u kalendaru */
export const makeEvent = (p = {}) => ({
  ...base("e", "event"),
  title: "", description: "", startDate: today(), startTime: "09:00", endDate: null, endTime: "10:00",
  allDay: false, location: "", projectId: null, tags: [], recurrence: "none",
  ...p,
});

/** Note — beleška (body je sanitizovan HTML) */
export const makeNote = (p = {}) => ({
  ...base("n", "note"),
  title: "", body: "", projectId: null, tags: [], pinned: false,
  ...p,
});

/** Settings */
export const makeSettings = (p = {}) => {
  const t = nowISO();
  return { id: "settings", kind: "settings", theme: "light", design: 2, sidebarCollapsed: false, version: 1, createdAt: t, updatedAt: t, ...p };
};

export const KINDS = { space: "spaces", project: "projects", task: "tasks", event: "events", note: "notes" };
export const COLLECTIONS = Object.values(KINDS);
export const kindOf = (coll) => Object.keys(KINDS).find((k) => KINDS[k] === coll);

export const emptyData = () => ({ spaces: {}, projects: {}, tasks: {}, events: {}, notes: {}, settings: null });

export const hasRecords = (d) => COLLECTIONS.some((c) => Object.keys(d[c] || {}).length);

// ---------- Ponavljanje ----------
/** Sledeći zadatak u nizu: oba datuma se pomeraju za isti interval. */
export const spawnNextTask = (t) => {
  const n = makeTask({
    ...t,
    id: uid("t"),
    status: "todo",
    completedAt: null,
    nextId: null,
    prevId: t.id,
    dueDate: t.dueDate ? stepDate(t.dueDate, t.recurrence) : null,
    workDate: t.workDate ? stepDate(t.workDate, t.recurrence) : null,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });
  return n;
};

/** Datumi početaka ponavljanja događaja koji seku opseg [from, to]. */
export const eventOccurrences = (ev, from, to) => {
  const span = ev.endDate && ev.endDate > ev.startDate ? diffDays(ev.startDate, ev.endDate) : 0;
  const lo = addDays(from, -span);
  const out = [];
  const rec = ev.recurrence || "none";
  if (rec === "none") {
    if (ev.startDate <= to && ev.startDate >= lo) out.push(ev.startDate);
    return { starts: out, span };
  }
  if (rec === "monthly") {
    const a = parse(ev.startDate), b = parse(lo);
    let i = Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() - 1);
    for (let guard = 0; guard < 400; guard++, i++) {
      const d = addMonths(ev.startDate, i);
      if (d > to) break;
      if (d >= lo) out.push(d);
    }
    return { starts: out, span };
  }
  const step = { daily: 1, every2: 2, weekly: 7 }[rec] || 7;
  let k = Math.max(0, Math.ceil(diffDays(ev.startDate, lo) / step));
  let d = addDays(ev.startDate, k * step);
  for (let guard = 0; d <= to && guard < 500; guard++) {
    out.push(d);
    d = addDays(d, step);
  }
  return { starts: out, span };
};

/**
 * Agenda: za svaki dan u opsegu lista stavki.
 * Vrste: event (događaj), work (termin rada), deadline (krajnji rok).
 */
export const isoToDay = (iso) => (iso ? toStr(new Date(iso)) : null);

/** opts.projectId: samo stavke tog projekta; opts.notes: uključi beleške (po datumu nastanka). */
export const buildAgenda = (data, from, to, opts = {}) => {
  const pid = opts.projectId || null;
  const days = {};
  for (let d = from; d <= to; d = addDays(d, 1)) days[d] = [];
  for (const ev of Object.values(data.events)) {
    if (pid && ev.projectId !== pid) continue;
    const { starts, span } = eventOccurrences(ev, from, to);
    for (const s of starts) {
      for (let j = 0; j <= span; j++) {
        const day = addDays(s, j);
        if (!days[day]) continue;
        days[day].push({
          key: `e:${ev.id}:${day}`, type: "event", id: ev.id, title: ev.title, date: day,
          time: ev.allDay || j > 0 ? null : ev.startTime,
          endTime: ev.allDay ? null : j === span ? ev.endTime : null,
          allDay: ev.allDay || (span > 0 && j > 0 && j < span),
          part: span > 0 ? { j, span } : null,
          projectId: ev.projectId, location: ev.location, recurring: ev.recurrence !== "none",
        });
      }
    }
  }
  for (const t of Object.values(data.tasks)) {
    if (pid && t.projectId !== pid) continue;
    if (t.workDate && days[t.workDate]) {
      days[t.workDate].push({
        key: `w:${t.id}`, type: "work", id: t.id, title: t.title, date: t.workDate,
        time: t.workTime, duration: t.duration, alsoDue: t.dueDate === t.workDate ? { time: t.dueTime } : null,
        projectId: t.projectId, priority: t.priority, status: t.status, recurring: t.recurrence !== "none",
      });
    }
    if (t.dueDate && days[t.dueDate] && t.dueDate !== t.workDate) {
      days[t.dueDate].push({
        key: `d:${t.id}`, type: "deadline", id: t.id, title: t.title, date: t.dueDate,
        time: t.dueTime, projectId: t.projectId, priority: t.priority, status: t.status, recurring: t.recurrence !== "none",
      });
    }
  }
  if (opts.notes) {
    for (const n of Object.values(data.notes)) {
      if (pid && n.projectId !== pid) continue;
      const day = isoToDay(n.createdAt);
      if (!days[day]) continue;
      days[day].push({ key: `n:${n.id}`, type: "note", id: n.id, title: noteTitle(n), date: day, time: null, projectId: n.projectId, pinned: n.pinned });
    }
  }
  for (const k of Object.keys(days)) days[k].sort(entrySort);
  return days;
};

export const entrySort = (a, b) => {
  const da = a.status === "done" ? 1 : 0, db = b.status === "done" ? 1 : 0;
  if (da !== db) return da - db;
  const na = a.type === "note" ? 1 : 0, nb = b.type === "note" ? 1 : 0;
  if (na !== nb) return na - nb;
  const aa = a.allDay ? 0 : 1, ab = b.allDay ? 0 : 1;
  if (aa !== ab) return aa - ab;
  const ta = a.time ? toMin(a.time) : 9999, tb = b.time ? toMin(b.time) : 9999;
  if (ta !== tb) return ta - tb;
  const pa = prioRank(a.priority), pb = prioRank(b.priority);
  if (pa !== pb) return pb - pa;
  return (a.title || "").localeCompare(b.title || "", "sr");
};

export const ENTRY_TYPE = { event: "Događaj", work: "Termin rada", deadline: "Rok", note: "Beleška" };

// ---------- Uvoz / izvoz ----------
export const serialize = (d) => ({
  app: "moj-os",
  version: 1,
  exportedAt: nowISO(),
  settings: d.settings,
  ...Object.fromEntries(COLLECTIONS.map((c) => [c, Object.values(d[c])])),
});

const ID_RE = /^[A-Za-z0-9_-]{1,120}$/;

/** Validira i normalizuje uvezeni JSON. Baca Error sa porukom za korisnika. */
export const normalizeImport = (json) => {
  if (!json || typeof json !== "object") throw new Error("Fajl ne sadrži JSON objekat.");
  if (json.app && json.app !== "moj-os") throw new Error("Ovo nije izvoz iz aplikacije Moj OS.");
  if (!COLLECTIONS.some((c) => Array.isArray(json[c]))) throw new Error("U fajlu nema prostora, projekata, zadataka, događaja ni beleški.");
  const remap = {};
  const out = emptyData();
  const makers = { spaces: makeSpace, projects: makeProject, tasks: makeTask, events: makeEvent, notes: makeNote };
  for (const c of COLLECTIONS) {
    for (const raw of Array.isArray(json[c]) ? json[c] : []) {
      if (!raw || typeof raw !== "object") continue;
      const rec = makers[c]({ ...raw });
      rec.kind = kindOf(c);
      if (!ID_RE.test(String(raw.id || ""))) {
        const nid = uid(rec.id.split("-")[0]);
        if (raw.id) remap[raw.id] = nid;
        rec.id = nid;
      }
      if (!Array.isArray(rec.tags)) rec.tags = [];
      rec.tags = rec.tags.map(String).slice(0, 30);
      out[c][rec.id] = rec;
    }
  }
  const fix = (v) => (v && remap[v]) || v;
  for (const c of COLLECTIONS)
    for (const r of Object.values(out[c])) {
      if ("projectId" in r) r.projectId = out.projects[fix(r.projectId)] ? fix(r.projectId) : null;
      if ("spaceId" in r) r.spaceId = out.spaces[fix(r.spaceId)] ? fix(r.spaceId) : null;
    }
  out.settings = makeSettings({ ...(json.settings || {}), id: "settings", kind: "settings" });
  return out;
};

// ---------- Demo podaci (relativni u odnosu na danas) ----------
export const demoData = () => {
  const t = today();
  const d = emptyData();
  // stalni ID-jevi: demo upisan sa dva uređaja istovremeno pravi iste redove, ne duplikate
  let n = 0;
  const did = (p) => `demo-${p}-${++n}`;
  const put = (r) => (d[KINDS[r.kind]][r.id] = { ...r, demo: true });
  const sWork = makeSpace({ id: did("s"),  name: "Posao", color: COLORS[1] });
  const sHome = makeSpace({ id: did("s"),  name: "Privatno", color: COLORS[2] });
  [sWork, sHome].forEach(put);
  const pPlan = makeProject({ id: did("p"),  name: "Plan za kvartal", description: "Primer projekta: ciljevi, izveštaj i sastanci za tekući kvartal.", spaceId: sWork.id, color: COLORS[0], startDate: addDays(t, -7), dueDate: addDays(t, 30) });
  const pHome = makeProject({ id: did("p"),  name: "Sređivanje stana", description: "Primer projekta: sitni kućni poslovi i nabavka.", spaceId: sHome.id, color: COLORS[2], startDate: addDays(t, -3) });
  [pPlan, pHome].forEach(put);
  [
    makeTask({ id: did("t"),  title: "Pregledati nedeljne prioritete", description: "Proći kroz otvorene zadatke i izabrati tri najvažnija za ovu nedelju.", status: "doing", priority: "high", projectId: pPlan.id, spaceId: sWork.id, workDate: t, workTime: "09:00", duration: 30, tags: ["planiranje"] }),
    makeTask({ id: did("t"),  title: "Napisati kratak izveštaj", priority: "normal", projectId: pPlan.id, spaceId: sWork.id, dueDate: addDays(t, 2), dueTime: "16:00", workDate: addDays(t, 1), workTime: "13:00", duration: 90, tags: ["pisanje"] }),
    makeTask({ id: did("t"),  title: "Odgovoriti na otvorene poruke", status: "waiting", priority: "low", spaceId: sWork.id, dueDate: addDays(t, 3) }),
    makeTask({ id: did("t"),  title: "Izmeriti prostor za policu", priority: "urgent", projectId: pHome.id, spaceId: sHome.id, dueDate: t, dueTime: "19:00" }),
    makeTask({ id: did("t"),  title: "Šetnja 30 minuta", priority: "normal", spaceId: sHome.id, workDate: t, workTime: "18:00", duration: 30, recurrence: "every2", tags: ["zdravlje"] }),
    makeTask({ id: did("t"),  title: "Napraviti listu za nabavku", status: "done", completedAt: nowISO(), projectId: pHome.id, spaceId: sHome.id, workDate: addDays(t, -1) }),
  ].forEach(put);
  put(makeEvent({ id: did("e"),  title: "Sastanak tima", description: "Kratak pregled napretka i plan za narednu nedelju.", startDate: t, startTime: "11:00", endTime: "12:00", location: "Online", projectId: pPlan.id, tags: ["sastanak"] }));
  put(makeNote({ id: did("n"),  title: "Ideje za bolji radni ritam", body: "<h3>Šta probati</h3><ul><li>Najteži zadatak ujutru</li><li>Kratka pauza na svakih 90 minuta</li><li>Petkom pregled nedelje</li></ul><p>Detaljnije: <a href=\"https://en.wikipedia.org/wiki/Time_management\">time management</a></p>", pinned: true, tags: ["navike"] }));
  put(makeNote({ id: did("n"),  title: "", body: "<p>Proveriti da li polica staje pored prozora.</p>", projectId: pHome.id }));
  d.settings = makeSettings({ demoLoaded: true });
  return d;
};

// ---------- Sanitizacija HTML-a beleški ----------
const ALLOWED = new Set(["P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "H2", "H3", "UL", "OL", "LI", "A", "SPAN"]);
export const sanitizeHtml = (html) => {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const walk = (node) => {
    for (const ch of [...node.childNodes]) {
      if (ch.nodeType === 3) continue;
      if (ch.nodeType !== 1) { ch.remove(); continue; }
      walk(ch);
      if (!ALLOWED.has(ch.tagName)) {
        if (["SCRIPT", "STYLE", "IFRAME", "OBJECT"].includes(ch.tagName)) ch.remove();
        else ch.replaceWith(...ch.childNodes);
        continue;
      }
      for (const a of [...ch.attributes]) {
        if (ch.tagName === "A" && a.name === "href" && /^(https?:|mailto:)/i.test(a.value.trim())) continue;
        ch.removeAttribute(a.name);
      }
      if (ch.tagName === "A") { ch.setAttribute("target", "_blank"); ch.setAttribute("rel", "noopener noreferrer"); }
    }
  };
  const root = doc.body.firstChild;
  walk(root);
  return root.innerHTML;
};
export const htmlToText = (html) => {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(`<div>${html.replace(/<\/(p|div|h2|h3|li)>/gi, "</$1>\n").replace(/<br\s*\/?>/gi, "\n")}</div>`, "text/html");
  return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
};
export const textToHtml = (txt) =>
  (txt || "").split(/\n/).map((l) => `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") || "<br>"}</p>`).join("");
export const noteTitle = (n) => n.title?.trim() || htmlToText(n.body).split("\n")[0].slice(0, 80) || "Beleška bez naslova";
