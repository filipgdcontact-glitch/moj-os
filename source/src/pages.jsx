// ============================================================
// Stranice: Moj dan, Planer, Zadaci, Projekti, Beleške, Podešavanja
// ============================================================
import {
  today, addDays, addMonths, weekStart, monthStart, dow, parse, diffDays, toMin, fromMin, nowTime,
  DAYS_S, DAYS, fmtFull, fmtRel, fmtWeekRange, fmtMonth, fmtNum, fmtDay, fmtDuration, fmtStamp,
  STATUS, PRIORITY, PROJECT_STATUS, buildAgenda, prioRank, statusLabel, projStatusLabel, ENTRY_TYPE,
  noteTitle, htmlToText, isoToDay, textToHtml, makeNote, serialize, normalizeImport, COLLECTIONS, sanitizeHtml,
} from "./core.js";
import { useStore } from "./store.jsx";
import { prefs } from "./storage.js";
import { useUI, Icon, PriorityTag, StatusTag, TypeTag, TypeMark, ProjectTag, SpaceTag, Tags, Check, Empty, Segmented } from "./ui.jsx";

const { useState, useMemo, useEffect, useRef, useCallback } = React;

// ---------- Prečice za otvaranje ----------
export function useOpen() {
  const { open, close, toast } = useUI();
  const { actions, data } = useStore();
  return useMemo(() => ({
    view: (kind, id, date) => open({ type: "view", kind, id, date }),
    form: (kind, initial = {}, extra = {}) => open({ type: "form", kind, initial, ...extra }),
    menu: (initial) => open({ type: "new", initial }),
    complete: (id, done, prev = "todo") => {
      const sp = actions.setTaskStatus(id, done ? "done" : prev === "done" ? "todo" : prev);
      if (done) {
        toast(sp ? `Završeno · sledeći: ${fmtRel(sp.workDate || sp.dueDate)}` : "Zadatak završen", {
          action: { label: "Poništi", fn: () => { if (sp) actions.remove("task", sp.id); actions.setTaskStatus(id, prev === "done" ? "todo" : prev); } },
        });
      }
    },
  }), [open, close, toast, actions]);
}

const entryTime = (e, data) => {
  if (e.type === "event") {
    if (e.allDay) return e.part ? "Ceo dan" : "Ceo dan";
    if (e.part && e.part.j > 0) return e.endTime ? `do ${e.endTime}` : "Ceo dan";
    return e.endTime && !e.part ? `${e.time}–${e.endTime}` : e.time;
  }
  if (e.type === "work") {
    if (!e.time) return e.duration ? fmtDuration(e.duration) : "Bez vremena";
    return e.duration ? `${e.time}–${fromMin(Math.min(toMin(e.time) + e.duration, 1439))}` : e.time;
  }
  return e.time ? `do ${e.time}` : "Ceo dan";
};

// ---------- Kartica stavke (Moj dan, projekti) ----------
export function EntryCard({ e, showDate }) {
  const { data } = useStore();
  const o = useOpen();
  const isTask = e.type !== "event";
  const t = isTask ? data.tasks[e.id] : null;
  const done = t?.status === "done";
  return (
    <div className={`entry ${done ? "is-done" : ""}`} role="button" tabIndex={0}
      onClick={() => o.view(isTask ? "task" : "event", e.id, e.date)}
      onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); o.view(isTask ? "task" : "event", e.id, e.date); } }}>
      {isTask ? <Check checked={done} onChange={(v) => o.complete(e.id, v, t.status)} label={`Završi: ${e.title}`} /> : <span className="entry-evmark"><TypeMark type="event" /></span>}
      <div className="entry-main">
        <div className="entry-title">{e.title}</div>
        <div className="entry-meta">
          <span className="mono entry-time">{showDate ? `${fmtRel(e.date)} · ` : ""}{entryTime(e, data)}</span>
          <TypeTag type={e.type} />
          {e.alsoDue && <span className="type type-deadline"><Icon n="flag" s={12} className="tm" />rok{e.alsoDue.time ? ` ${e.alsoDue.time}` : ""}</span>}
          {e.recurring && <Icon n="repeat" s={13} className="muted-ic" />}
          <ProjectTag id={e.projectId} />
        </div>
      </div>
      {isTask && <div className="entry-side"><PriorityTag v={e.priority} /><StatusTag v={e.status} /></div>}
    </div>
  );
}

// ---------- Nedeljna tabla (Moj dan + Planer) ----------
export function WeekBoard({ start, setStart, tall, projectId, withNotes }) {
  const { data } = useStore();
  const o = useOpen();
  const end = addDays(start, 6);
  const agenda = useMemo(() => buildAgenda(data, start, end, { projectId, notes: withNotes }), [data, start, end, projectId, withNotes]);
  const add = (d) => o.form("task", projectId ? { workDate: d, projectId } : { workDate: d });
  const t = today();
  const scroller = useRef(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const cur = el.querySelector(".wday.is-today");
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    if (cur && cur.offsetLeft + cur.offsetWidth > el.clientWidth) el.scrollLeft = Math.max(0, cur.offsetLeft - pad);
    else el.scrollLeft = 0;
  }, [start]);
  const isThisWeek = start === weekStart(t);
  return (
    <div className="week-wrap">
      <div className="week-nav">
        <div className="week-label">{fmtWeekRange(start)}</div>
        <div className="week-btns">
          <button className="icon-btn" onClick={() => setStart(addDays(start, -7))} aria-label="Prethodna nedelja"><Icon n="left" /></button>
          <button className="btn btn-sm" disabled={isThisWeek} onClick={() => setStart(weekStart(t))}>Danas</button>
          <button className="icon-btn" onClick={() => setStart(addDays(start, 7))} aria-label="Sledeća nedelja"><Icon n="right" /></button>
        </div>
      </div>
      <div className="week-scroll" ref={scroller}>
        <div className={`week ${tall ? "tall" : ""}`}>
          {Object.keys(agenda).map((d, i) => {
            const items = agenda[d];
            const isT = d === t;
            return (
              <section key={d} className={`wday ${isT ? "is-today" : ""} ${d < t ? "is-past" : ""} ${i >= 5 ? "is-weekend" : ""}`} aria-label={fmtFull(d)}>
                <header className="wday-head">
                  <span className="wday-dn">{DAYS_S[i]}</span>
                  <span className="wday-num">{parse(d).getDate()}</span>
                  {isT && <span className="wday-now">danas</span>}
                </header>
                <div className="wday-body" onClick={(ev) => { if (!ev.target.closest("button")) add(d); }}>
                  {items.map((e) => <WeekChip key={e.key} e={e} hideProject={!!projectId} />)}
                  <div className="wday-fill" aria-hidden="true"><Icon n="plus" s={14} /></div>
                  <button className="sr-only" onClick={() => add(d)}>Dodaj stavku za {fmtFull(d)}</button>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const viewKind = (type) => (type === "event" ? "event" : type === "note" ? "note" : "task");

function WeekChip({ e, hideProject }) {
  const { data } = useStore();
  const o = useOpen();
  const done = e.status === "done";
  const p = e.projectId && data.projects[e.projectId];
  const time = e.type === "event" ? (e.allDay ? null : e.part && e.part.j > 0 ? null : e.time) : e.time;
  return (
    <button className={`chip chip-${e.type} ${done ? "is-done" : ""}`} onClick={() => o.view(viewKind(e.type), e.id, e.date)}
      title={`${ENTRY_TYPE[e.type]}: ${e.title}`} style={p ? { "--pc": p.color } : undefined}>
      <span className="chip-top">
        <TypeMark type={e.type} />
        {time ? <span className="mono chip-time">{e.type === "deadline" ? `do ${time}` : time}</span> : <span className="chip-kind">{e.type === "event" && e.allDay ? "Ceo dan" : ENTRY_TYPE[e.type]}</span>}
        {(e.priority === "high" || e.priority === "urgent") && !done && <span className={`pmark prio-${e.priority}`} aria-label={e.priority === "urgent" ? "Hitno" : "Visok prioritet"} />}
      </span>
      <span className="chip-title">{e.title}</span>
      {p && !hideProject && <span className="chip-proj"><span className="pdot" />{p.name}</span>}
    </button>
  );
}

// ---------- Beleška iz glave ----------
function QuickCapture() {
  const { data, actions } = useStore();
  const { toast, open, close } = useUI();
  const [txt, setTxt] = useState(() => prefs.get("capture", ""));
  const [pick, setPick] = useState(false);
  const [proj, setProj] = useState("");
  const ta = useRef(null);
  useEffect(() => { prefs.set("capture", txt); }, [txt]);
  useEffect(() => { const el = ta.current; if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 260) + "px"; } }, [txt]);
  const has = txt.trim().length > 0;
  const clear = () => { setTxt(""); setPick(false); setProj(""); };
  const lines = txt.trim().split("\n");
  const saveNote = (projectId = null) => {
    const short = txt.trim().length <= 80 && lines.length === 1;
    actions.save(makeNote({ title: short ? "" : "", body: textToHtml(txt.trim()), projectId }));
    toast(projectId ? `Beleška dodata u projekat ${data.projects[projectId]?.name || ""}` : "Beleška sačuvana");
    clear();
  };
  const toTask = () => {
    let mid = null;
    mid = open({ type: "form", kind: "task", initial: { title: lines[0].slice(0, 200), description: lines.slice(1).join("\n").trim(), workDate: today() }, onSaved: () => { close(mid); clear(); } });
  };
  const projects = Object.values(data.projects).filter((p) => p.status !== "archived");
  return (
    <section className="panel capture" aria-labelledby="cap-h">
      <div className="panel-head"><h2 id="cap-h" className="h2">Beleška iz glave</h2>{has && <span className="field-hint">Ctrl + Enter = sačuvaj</span>}</div>
      <textarea id="quick-capture" ref={ta} className="input capture-in" rows={2} value={txt} placeholder="Zapiši misao pre nego što pobegne…"
        onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && has) { e.preventDefault(); saveNote(); } }} />
      {has && !pick && (
        <div className="capture-acts">
          <button className="btn btn-primary btn-sm" onClick={() => saveNote()}><Icon n="note" s={15} />Sačuvaj kao belešku</button>
          <button className="btn btn-sm" onClick={toTask}><Icon n="task" s={15} />Pretvori u zadatak</button>
          <button className="btn btn-sm" onClick={() => setPick(true)} disabled={!projects.length} title={projects.length ? "" : "Nema projekata"}><Icon n="folder" s={15} />Dodaj u projekat</button>
          <button className="btn btn-ghost btn-sm" onClick={clear}><Icon n="trash" s={15} />Obriši</button>
        </div>
      )}
      {has && pick && (
        <div className="capture-acts">
          <select id="cap-proj" className="input input-sm" value={proj} onChange={(e) => setProj(e.target.value)} aria-label="Projekat" autoFocus>
            <option value="">Izaberi projekat…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" disabled={!proj} onClick={() => saveNote(proj)}>Sačuvaj u projekat</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setPick(false)}>Nazad</button>
        </div>
      )}
    </section>
  );
}

// ---------- MOJ DAN ----------
export function TodayPage() {
  const { data } = useStore();
  const o = useOpen();
  const t = today();
  const [ws, setWs] = useState(() => weekStart(t));
  const entries = useMemo(() => buildAgenda(data, t, t)[t], [data, t]);
  const overdue = useMemo(() => Object.values(data.tasks)
    .filter((x) => x.status !== "done" && ((x.dueDate && x.dueDate < t) || (!x.dueDate && x.workDate && x.workDate < t)))
    .sort((a, b) => (a.dueDate || a.workDate).localeCompare(b.dueDate || b.workDate)), [data, t]);
  const [showLate, setShowLate] = useState(() => prefs.get("showLate", true));
  const open = entries.filter((e) => e.status !== "done").length;
  return (
    <div className="page-today">
      <div className="page-head">
        <div>
          <div className="eyebrow">{fmtFull(t)}</div>
          <h1 className="h1">Moj dan</h1>
        </div>
      </div>
      <div className="today-grid">
        <section className="panel today-list" aria-labelledby="today-h">
          <div className="panel-head">
            <h2 id="today-h" className="h2">Današnje obaveze <span className="count">{open}</span></h2>
            <button className="btn btn-sm" onClick={() => o.form("task", { workDate: t })}><Icon n="plus" s={15} />Dodaj</button>
          </div>
          {overdue.length > 0 && (
            <div className="late">
              <button className="late-toggle" aria-expanded={showLate} onClick={() => { setShowLate(!showLate); prefs.set("showLate", !showLate); }}>
                <Icon n={showLate ? "left" : "right"} s={14} style={{ transform: showLate ? "rotate(-90deg)" : "none" }} />Zaostalo <span className="count late-c">{overdue.length}</span>
              </button>
              {showLate && <div className="entries">{overdue.map((x) => (
                <EntryCard key={x.id} showDate e={{ key: x.id, type: x.dueDate ? "deadline" : "work", id: x.id, title: x.title, date: x.dueDate || x.workDate, time: x.dueDate ? x.dueTime : x.workTime, duration: x.duration, projectId: x.projectId, priority: x.priority, status: x.status, recurring: x.recurrence !== "none" }} />
              ))}</div>}
            </div>
          )}
          {entries.length ? (
            <div className="entries">{entries.map((e) => <EntryCard key={e.key} e={e} />)}</div>
          ) : (
            <Empty icon="sun" title="Danas nema zakazanih obaveza" text="Dodaj zadatak sa današnjim rokom ili terminom rada, ili zakaži događaj."
              action={<div className="empty-acts"><button className="btn btn-primary btn-sm" onClick={() => o.form("task", { workDate: t })}>Novi zadatak</button><button className="btn btn-sm" onClick={() => o.form("event", { startDate: t })}>Novi događaj</button></div>} />
          )}
        </section>
        <QuickCapture />
      </div>
      <section className="panel week-panel" aria-labelledby="week-h">
        <div className="panel-head"><h2 id="week-h" className="h2">Ova nedelja</h2><span className="legend"><TypeTag type="event" /><TypeTag type="work" /><TypeTag type="deadline" /></span></div>
        <WeekBoard start={ws} setStart={setWs} />
      </section>
    </div>
  );
}

// ---------- PLANER ----------
export function PlannerPage() {
  const [view, setView] = useState(() => prefs.get("plannerView", "week"));
  const [cur, setCur] = useState(today());
  const t = today();
  useEffect(() => prefs.set("plannerView", view), [view]);
  const step = (n) => setCur(view === "day" ? addDays(cur, n) : view === "week" ? addDays(cur, 7 * n) : addMonths(monthStart(cur), n));
  const label = view === "day" ? fmtFull(cur) : view === "week" ? fmtWeekRange(weekStart(cur)) : fmtMonth(cur);
  const isNow = view === "day" ? cur === t : view === "week" ? weekStart(cur) === weekStart(t) : monthStart(cur) === monthStart(t);
  return (
    <div>
      <div className="page-head">
        <h1 className="h1">Planer</h1>
        <Segmented value={view} onChange={setView} label="Prikaz" options={[{ v: "day", l: "Dan" }, { v: "week", l: "Nedelja" }, { v: "month", l: "Mesec" }]} />
      </div>
      {view !== "week" && (
        <div className="week-nav planner-nav">
          <div className="week-label">{label}</div>
          <div className="week-btns">
            <button className="icon-btn" onClick={() => step(-1)} aria-label="Prethodno"><Icon n="left" /></button>
            <button className="btn btn-sm" disabled={isNow} onClick={() => setCur(t)}>Danas</button>
            <button className="icon-btn" onClick={() => step(1)} aria-label="Sledeće"><Icon n="right" /></button>
          </div>
        </div>
      )}
      {view === "day" && <DayView day={cur} />}
      {view === "week" && <div className="panel week-panel"><WeekBoard start={weekStart(cur)} setStart={setCur} tall /></div>}
      {view === "month" && <MonthView cur={cur} onPick={(d) => { setCur(d); setView("day"); }} />}
      <div className="legend legend-foot"><TypeTag type="event" /><TypeTag type="work" /><TypeTag type="deadline" /></div>
    </div>
  );
}

const HOUR = 52;
function layoutLanes(items) {
  const sorted = [...items].sort((a, b) => a.s - b.s || b.e - a.e);
  let cluster = [], lanes = [], end = -1;
  const flush = () => { cluster.forEach((it) => (it.cols = lanes.length)); cluster = []; lanes = []; };
  for (const it of sorted) {
    if (it.s >= end) { flush(); end = -1; }
    let i = lanes.findIndex((e) => e <= it.s);
    if (i < 0) { i = lanes.length; lanes.push(0); }
    lanes[i] = it.e;
    it.lane = i;
    cluster.push(it);
    end = Math.max(end, it.e);
  }
  flush();
  return sorted;
}

function DayView({ day }) {
  const { data } = useStore();
  const o = useOpen();
  const entries = useMemo(() => buildAgenda(data, day, day)[day], [data, day]);
  const scroller = useRef(null);
  const [now, setNow] = useState(nowTime());
  useEffect(() => { const i = setInterval(() => setNow(nowTime()), 60000); return () => clearInterval(i); }, []);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = 7 * HOUR - 8; }, [day]);
  const allDay = entries.filter((e) => e.type === "event" && (e.allDay || !e.time));
  const untimed = entries.filter((e) => e.type !== "event" && !e.time);
  const timed = layoutLanes(entries.filter((e) => e.time && !(e.type === "event" && e.allDay)).map((e) => {
    const s = toMin(e.time);
    let en = s + 30;
    if (e.type === "event") en = e.endTime ? Math.max(toMin(e.endTime), s + 15) : 24 * 60;
    if (e.type === "work") en = s + (e.duration || 30);
    if (e.type === "deadline") en = s + 25;
    return { ...e, s, e: Math.min(en, 24 * 60) };
  }));
  const isToday = day === today();
  const clickSlot = (ev) => {
    if (ev.target !== ev.currentTarget) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const min = Math.max(0, Math.min(23 * 60 + 30, Math.floor(((ev.clientY - r.top) / HOUR) * 2) * 30));
    o.form("task", { workDate: day, workTime: fromMin(min) });
  };
  return (
    <div className="dayview">
      {(allDay.length > 0 || untimed.length > 0) && (
        <div className="panel day-top">
          {allDay.length > 0 && <div className="day-row"><div className="day-row-k">Ceo dan</div><div className="day-row-v">{allDay.map((e) => <WeekChip key={e.key} e={e} />)}</div></div>}
          {untimed.length > 0 && <div className="day-row"><div className="day-row-k">Bez vremena</div><div className="day-row-v">{untimed.map((e) => <WeekChip key={e.key} e={e} />)}</div></div>}
        </div>
      )}
      <div className="panel timeline-panel">
        <div className="timeline-scroll" ref={scroller}>
          <div className="timeline" style={{ height: 24 * HOUR }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="tl-hour" style={{ top: h * HOUR }}><span className="mono">{String(h).padStart(2, "0")}:00</span></div>
            ))}
            <div className="tl-grid" onClick={clickSlot} title="Klikni za novu stavku u tom terminu">
              {timed.map((e) => (
                <button key={e.key} className={`tl-item chip-${e.type} ${e.status === "done" ? "is-done" : ""}`}
                  style={{ top: (e.s / 60) * HOUR + 1, height: Math.max(((e.e - e.s) / 60) * HOUR - 2, 22), left: `calc(${(e.lane / e.cols) * 100}% + 2px)`, width: `calc(${100 / e.cols}% - 4px)`, "--pc": data.projects[e.projectId]?.color }}
                  onClick={() => o.view(e.type === "event" ? "event" : "task", e.id, e.date)}>
                  <span className="chip-top"><TypeMark type={e.type} /><span className="mono chip-time">{e.type === "deadline" ? `rok ${e.time}` : entryTime(e)}</span></span>
                  <span className="chip-title">{e.title}</span>
                </button>
              ))}
              {isToday && <div className="tl-now" style={{ top: (toMin(now) / 60) * HOUR }}><span className="mono">{now}</span></div>}
            </div>
          </div>
        </div>
      </div>
      <p className="field-hint center">Klikni na prazan termin za brzo dodavanje u to vreme.</p>
    </div>
  );
}

function MonthView({ cur, onPick, projectId, withNotes, bare }) {
  const { data } = useStore();
  const o = useOpen();
  const ms = monthStart(cur);
  const start = weekStart(ms);
  const end = addDays(start, 41);
  const agenda = useMemo(() => buildAgenda(data, start, end, { projectId, notes: withNotes }), [data, start, end, projectId, withNotes]);
  const t = today();
  const month = parse(ms).getMonth();
  return (
    <div className={`month ${bare ? "month-bare" : "panel"}`}>
      <div className="month-head">{DAYS_S.map((d) => <div key={d}>{d}</div>)}</div>
      <div className="month-grid">
        {Object.keys(agenda).map((d) => {
          const items = agenda[d];
          const out = parse(d).getMonth() !== month;
          return (
            <div key={d} className={`mcell ${out ? "is-out" : ""} ${d === t ? "is-today" : ""}`} role="button" tabIndex={0}
              aria-label={`${fmtFull(d)}, ${items.length} stavki`} onClick={() => onPick(d)} onKeyDown={(e) => { if (e.key === "Enter") onPick(d); }}>
              <div className="mcell-head">
                <span className="mcell-num">{parse(d).getDate()}</span>
                <button className="mcell-add" aria-label={`Dodaj za ${fmtFull(d)}`} onClick={(e) => { e.stopPropagation(); o.form("task", projectId ? { workDate: d, projectId } : { workDate: d }); }}><Icon n="plus" s={13} /></button>
              </div>
              <div className="mcell-items">
                {items.slice(0, 3).map((e) => (
                  <button key={e.key} className={`mitem chip-${e.type} ${e.status === "done" ? "is-done" : ""}`} title={`${ENTRY_TYPE[e.type]}: ${e.title}`}
                    onClick={(ev) => { ev.stopPropagation(); o.view(viewKind(e.type), e.id, e.date); }}><TypeMark type={e.type} /><span className="mitem-t">{e.title}</span></button>
                ))}
                {items.length > 3 && <span className="mmore">+{items.length - 3}</span>}
              </div>
              <div className="mcell-dots" aria-hidden="true">{items.slice(0, 4).map((e) => <i key={e.key} className={`dot-${e.type}`} />)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- ZADACI ----------
const DEF_FILTERS = { q: "", statuses: ["todo", "doing", "waiting"], priority: "all", project: "all", space: "all", tag: "all", when: "all", sort: "due" };

export function TasksPage() {
  const { data } = useStore();
  const o = useOpen();
  const [view, setView] = useState(() => prefs.get("tasksView", "list"));
  const [f, setF] = useState(() => ({ ...DEF_FILTERS, ...prefs.get("taskFilters", {}), q: "" }));
  const [showF, setShowF] = useState(false);
  useEffect(() => prefs.set("tasksView", view), [view]);
  useEffect(() => { const { q, ...rest } = f; prefs.set("taskFilters", rest); }, [f]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const t = today();
  const ws = weekStart(t);
  const allTags = useMemo(() => [...new Set(Object.values(data.tasks).flatMap((x) => x.tags || []))].sort(), [data.tasks]);
  const spaceOf = (x) => (x.projectId && data.projects[x.projectId]?.spaceId) || x.spaceId;
  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    let list = Object.values(data.tasks).filter((x) => {
      if (view === "list" && !f.statuses.includes(x.status)) return false;
      if (f.priority !== "all" && x.priority !== f.priority) return false;
      if (f.project === "none" ? x.projectId : f.project !== "all" && x.projectId !== f.project) return false;
      if (f.space !== "all" && spaceOf(x) !== f.space) return false;
      if (f.tag !== "all" && !(x.tags || []).includes(f.tag)) return false;
      const d1 = x.dueDate, d2 = x.workDate;
      if (f.when === "today" && d1 !== t && d2 !== t) return false;
      if (f.when === "week" && !([d1, d2].some((d) => d && d >= ws && d <= addDays(ws, 6)))) return false;
      if (f.when === "overdue" && !(x.status !== "done" && d1 && d1 < t)) return false;
      if (f.when === "nodate" && (d1 || d2)) return false;
      if (q && !`${x.title} ${x.description} ${(x.tags || []).join(" ")} ${data.projects[x.projectId]?.name || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const key = (x) => x.dueDate || x.workDate || "9999-99-99";
    const cmp = {
      due: (a, b) => key(a).localeCompare(key(b)) || prioRank(b.priority) - prioRank(a.priority),
      priority: (a, b) => prioRank(b.priority) - prioRank(a.priority) || key(a).localeCompare(key(b)),
      created: (a, b) => b.createdAt.localeCompare(a.createdAt),
      title: (a, b) => a.title.localeCompare(b.title, "sr"),
    }[f.sort];
    return list.sort((a, b) => (a.status === "done") - (b.status === "done") || cmp(a, b));
  }, [data, f, view, t, ws]);
  const active = ["priority", "project", "space", "tag", "when"].filter((k) => f[k] !== "all").length + (f.statuses.length !== 3 || !f.statuses.every((s) => DEF_FILTERS.statuses.includes(s)) ? 1 : 0);
  const projects = Object.values(data.projects).sort((a, b) => a.name.localeCompare(b.name, "sr"));
  const spaces = Object.values(data.spaces);
  const toggleStatus = (s) => set("statuses", f.statuses.includes(s) ? f.statuses.filter((x) => x !== s) : [...f.statuses, s]);
  return (
    <div>
      <div className="page-head">
        <h1 className="h1">Zadaci</h1>
        <div className="head-acts">
          <Segmented value={view} onChange={setView} label="Prikaz" options={[{ v: "list", l: "Lista", icon: "list" }, { v: "kanban", l: "Kanban", icon: "board" }]} />
          <button className="btn btn-primary hide-sm" onClick={() => o.form("task")}><Icon n="plus" s={16} />Zadatak</button>
        </div>
      </div>
      <div className="toolbar">
        <div className="search">
          <Icon n="search" s={16} />
          <input id="task-search" className="input" type="search" value={f.q} onChange={(e) => set("q", e.target.value)} placeholder="Pretraži zadatke, oznake, projekte" aria-label="Pretraga zadataka" />
        </div>
        <button className={`btn ${showF || active ? "btn-on" : ""}`} onClick={() => setShowF(!showF)} aria-expanded={showF}>Filteri{active ? <span className="count">{active}</span> : null}</button>
        <select id="task-sort" className="input sort" value={f.sort} onChange={(e) => set("sort", e.target.value)} aria-label="Sortiranje">
          <option value="due">Po roku</option><option value="priority">Po prioritetu</option><option value="created">Najnoviji</option><option value="title">Po nazivu</option>
        </select>
      </div>
      {showF && (
        <div className="panel filters">
          {view === "list" && (
            <div className="frow"><span className="frow-k">Status</span><div className="chips">
              {STATUS.map((s) => <button key={s.v} className={`fchip ${f.statuses.includes(s.v) ? "on" : ""}`} aria-pressed={f.statuses.includes(s.v)} onClick={() => toggleStatus(s.v)}>{s.l}</button>)}
            </div></div>
          )}
          <div className="frow"><span className="frow-k">Vreme</span><div className="chips">
            {[["all", "Sve"], ["today", "Danas"], ["week", "Ova nedelja"], ["overdue", "Kasni"], ["nodate", "Bez datuma"]].map(([v, l]) => <button key={v} className={`fchip ${f.when === v ? "on" : ""}`} aria-pressed={f.when === v} onClick={() => set("when", v)}>{l}</button>)}
          </div></div>
          <div className="fgrid">
            <label className="field"><span className="field-label">Prioritet</span>
              <select id="f-prio" className="input" value={f.priority} onChange={(e) => set("priority", e.target.value)}><option value="all">Svi</option>{PRIORITY.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}</select></label>
            <label className="field"><span className="field-label">Projekat</span>
              <select id="f-proj" className="input" value={f.project} onChange={(e) => set("project", e.target.value)}><option value="all">Svi</option><option value="none">Bez projekta</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="field"><span className="field-label">Prostor</span>
              <select id="f-space" className="input" value={f.space} onChange={(e) => set("space", e.target.value)}><option value="all">Svi</option>{spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="field"><span className="field-label">Oznaka</span>
              <select id="f-tag" className="input" value={f.tag} onChange={(e) => set("tag", e.target.value)}><option value="all">Sve</option>{allTags.map((x) => <option key={x} value={x}>#{x}</option>)}</select></label>
          </div>
          <div className="frow-end"><button className="btn btn-ghost btn-sm" onClick={() => setF({ ...DEF_FILTERS, q: f.q, sort: f.sort })}>Očisti filtere</button></div>
        </div>
      )}
      {view === "list" ? (
        filtered.length ? <div className="panel tlist">{filtered.map((x) => <TaskRow key={x.id} t={x} />)}</div> : (
          <Empty icon="checks" title={Object.keys(data.tasks).length ? "Nema zadataka za ove filtere" : "Još nema zadataka"} text={Object.keys(data.tasks).length ? "Promeni pretragu ili očisti filtere." : "Dodaj prvi zadatak i on će se pojaviti ovde i u planeru."}
            action={Object.keys(data.tasks).length ? <button className="btn btn-sm" onClick={() => setF({ ...DEF_FILTERS, sort: f.sort })}>Očisti filtere</button> : <button className="btn btn-primary btn-sm" onClick={() => o.form("task")}>Novi zadatak</button>} />
        )
      ) : <Kanban tasks={filtered} />}
    </div>
  );
}

function TaskRow({ t }) {
  const o = useOpen();
  const today_ = today();
  const late = t.status !== "done" && t.dueDate && t.dueDate < today_;
  return (
    <div className={`trow ${t.status === "done" ? "is-done" : ""}`} role="button" tabIndex={0} onClick={() => o.view("task", t.id)} onKeyDown={(e) => { if (e.key === "Enter") o.view("task", t.id); }}>
      <Check checked={t.status === "done"} onChange={(v) => o.complete(t.id, v, t.status)} label={`Završi: ${t.title}`} />
      <div className="entry-main">
        <div className="entry-title">{t.title}</div>
        <div className="entry-meta">
          {t.dueDate && <span className={`meta ${late ? "is-late" : ""}`}><Icon n="flag" s={12} />{fmtRel(t.dueDate)}{t.dueTime ? ` ${t.dueTime}` : ""}</span>}
          {t.workDate && <span className="meta"><Icon n="clock" s={12} />{fmtRel(t.workDate)}{t.workTime ? ` ${t.workTime}` : ""}</span>}
          {t.recurrence !== "none" && <Icon n="repeat" s={13} className="muted-ic" />}
          <ProjectTag id={t.projectId} />
          {!t.projectId && <SpaceTag id={t.spaceId} />}
          <Tags tags={t.tags} />
        </div>
      </div>
      <div className="entry-side"><PriorityTag v={t.priority} /><StatusTag v={t.status} /></div>
    </div>
  );
}

function Kanban({ tasks }) {
  const { actions } = useStore();
  const o = useOpen();
  const { toast } = useUI();
  const [over, setOver] = useState(null);
  const drop = (status, e) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const sp = actions.setTaskStatus(id, status);
    toast(`Premešteno: ${statusLabel(status)}`);
    if (sp) setTimeout(() => toast(`Sledeći zadatak zakazan: ${fmtRel(sp.workDate || sp.dueDate)}`), 250);
  };
  return (
    <div className="kanban-scroll">
      <div className="kanban">
        {STATUS.map((s) => {
          const col = tasks.filter((x) => x.status === s.v);
          return (
            <section key={s.v} className={`kcol ${over === s.v ? "is-over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(s.v); }} onDragLeave={() => setOver(null)} onDrop={(e) => drop(s.v, e)} aria-label={s.l}>
              <header className="kcol-head"><span className={`st-dot st-${s.v}`} />{s.l}<span className="count">{col.length}</span>
                <button className="icon-btn sm" aria-label={`Novi zadatak: ${s.l}`} onClick={() => o.form("task", { status: s.v })}><Icon n="plus" s={15} /></button></header>
              <div className="kcol-body">
                {col.map((x) => (
                  <div key={x.id} className={`kcard ${x.status === "done" ? "is-done" : ""}`} draggable role="button" tabIndex={0}
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", x.id); e.dataTransfer.effectAllowed = "move"; }}
                    onClick={() => o.view("task", x.id)} onKeyDown={(e) => { if (e.key === "Enter") o.view("task", x.id); }}>
                    <div className="kcard-title">{x.title}</div>
                    <div className="entry-meta">
                      {x.dueDate && <span className={`meta ${x.status !== "done" && x.dueDate < today() ? "is-late" : ""}`}><Icon n="flag" s={12} />{fmtRel(x.dueDate)}</span>}
                      {x.workDate && <span className="meta"><Icon n="clock" s={12} />{fmtRel(x.workDate)}</span>}
                      <PriorityTag v={x.priority} />
                    </div>
                    {x.projectId && <div className="kcard-foot"><ProjectTag id={x.projectId} /></div>}
                  </div>
                ))}
                {!col.length && <div className="kempty">Prevuci zadatak ovde</div>}
              </div>
            </section>
          );
        })}
      </div>
      <p className="field-hint">Prevuci karticu u drugu kolonu da promeniš status. Na telefonu otvori zadatak i izaberi status.</p>
    </div>
  );
}

// ---------- PROJEKTI ----------
const progressOf = (data, pid) => {
  const ts = Object.values(data.tasks).filter((t) => t.projectId === pid);
  const done = ts.filter((t) => t.status === "done").length;
  return { total: ts.length, done, pct: ts.length ? Math.round((done / ts.length) * 100) : 0 };
};

export function ProjectsPage() {
  const { data } = useStore();
  const o = useOpen();
  const { navigate } = useUI();
  const [show, setShow] = useState(() => prefs.get("projShow", "active"));
  useEffect(() => prefs.set("projShow", show), [show]);
  const spaces = Object.values(data.spaces).sort((a, b) => a.name.localeCompare(b.name, "sr"));
  const projects = Object.values(data.projects).filter((p) => show === "all" || p.status === "active" || p.status === "paused");
  const groups = [...spaces.map((s) => ({ s, ps: projects.filter((p) => p.spaceId === s.id) })), { s: null, ps: projects.filter((p) => !p.spaceId || !data.spaces[p.spaceId]) }].filter((g) => g.s || g.ps.length);
  return (
    <div>
      <div className="page-head">
        <h1 className="h1">Projekti</h1>
        <div className="head-acts">
          <Segmented value={show} onChange={setShow} label="Prikaz" options={[{ v: "active", l: "Aktivni" }, { v: "all", l: "Svi" }]} />
          <button className="btn btn-primary hide-sm" onClick={() => o.form("project")}><Icon n="plus" s={16} />Projekat</button>
        </div>
      </div>
      <div className="spaces-bar">
        <span className="frow-k">Prostori</span>
        <div className="chips">
          {spaces.map((s) => <button key={s.id} className="fchip" onClick={() => o.view("space", s.id)}><span className="sdot" style={{ borderColor: s.color }} />{s.name}</button>)}
          <button className="fchip add" onClick={() => o.form("space")}><Icon n="plus" s={13} />Prostor</button>
        </div>
      </div>
      {!Object.keys(data.projects).length ? (
        <Empty icon="folder" title="Još nema projekata" text="Projekat okuplja zadatke, događaje i beleške jedne celine, unutar prostora kao što su Posao ili Privatno."
          action={<button className="btn btn-primary btn-sm" onClick={() => o.form("project")}>Novi projekat</button>} />
      ) : groups.map((g) => (
        <section key={g.s?.id || "none"} className="pgroup">
          <h2 className="h2 pgroup-h">{g.s ? <><span className="sdot" style={{ borderColor: g.s.color }} />{g.s.name}</> : "Bez prostora"}<span className="count">{g.ps.length}</span></h2>
          {g.ps.length ? (
            <div className="pgrid">{g.ps.map((p) => <ProjectCard key={p.id} p={p} onOpen={() => navigate(`projekat-${p.id}`)} />)}</div>
          ) : <div className="pempty">Nema {show === "active" ? "aktivnih " : ""}projekata. <button className="link" onClick={() => o.form("project", { spaceId: g.s.id })}>Dodaj projekat</button></div>}
        </section>
      ))}
    </div>
  );
}

function ProjectCard({ p, onOpen }) {
  const { data } = useStore();
  const pr = progressOf(data, p.id);
  const t = today();
  const next = Object.values(data.tasks).filter((x) => x.projectId === p.id && x.status !== "done" && x.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const ev = Object.values(data.events).filter((e) => e.projectId === p.id).length;
  const nn = Object.values(data.notes).filter((n) => n.projectId === p.id).length;
  return (
    <button className="pcard" onClick={onOpen} style={{ "--pc": p.color }}>
      <div className="pcard-top"><span className="pswatch" /><span className="pcard-name">{p.name}</span>{p.status !== "active" && <span className="tag">{projStatusLabel(p.status)}</span>}</div>
      {p.description && <div className="pcard-desc">{p.description}</div>}
      <div className="progress" aria-label={`Napredak ${pr.pct}%`}><span style={{ width: `${pr.pct}%` }} /></div>
      <div className="pcard-meta">
        <span>{pr.done}/{pr.total} zadataka</span>
        {ev > 0 && <span>{ev} dog.</span>}
        {nn > 0 && <span>{nn} bel.</span>}
        {next && <span className={next.dueDate < t ? "is-late" : ""}><Icon n="flag" s={12} />{fmtRel(next.dueDate)}</span>}
        {p.dueDate && <span>rok {fmtNum(p.dueDate)}</span>}
      </div>
    </button>
  );
}

export function ProjectPage({ id }) {
  const { data, actions } = useStore();
  const o = useOpen();
  const { navigate, open, confirm, toast } = useUI();
  const p = data.projects[id];
  const [showDone, setShowDone] = useState(false);
  if (!p) return <Empty icon="folder" title="Projekat ne postoji" text="Možda je obrisan." action={<button className="btn btn-sm" onClick={() => navigate("projekti")}>Nazad na projekte</button>} />;
  const pr = progressOf(data, p.id);
  const t = today();
  const tasks = Object.values(data.tasks).filter((x) => x.projectId === p.id).sort((a, b) => (a.status === "done") - (b.status === "done") || (a.dueDate || a.workDate || "9").localeCompare(b.dueDate || b.workDate || "9"));
  const openTasks = tasks.filter((x) => x.status !== "done");
  const doneTasks = tasks.filter((x) => x.status === "done");
  const events = Object.values(data.events).filter((e) => e.projectId === p.id).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const upcoming = events.filter((e) => (e.endDate || e.startDate) >= t || e.recurrence !== "none");
  const past = events.filter((e) => !upcoming.includes(e));
  const notes = Object.values(data.notes).filter((n) => n.projectId === p.id).sort((a, b) => b.pinned - a.pinned || b.updatedAt.localeCompare(a.updatedAt));
  const edit = () => open({ type: "form", kind: "project", id: p.id });
  const remove = async () => {
    const n = tasks.length + events.length + notes.length;
    if (!(await confirm({ title: "Obrisati projekat?", message: n ? `${n} povezanih stavki ostaće sačuvano, ali bez projekta.` : "Ova radnja se ne može poništiti." }))) return;
    actions.remove("project", p.id);
    navigate("projekti");
    toast("Projekat obrisan");
  };
  const dup = () => { const c = actions.duplicate("project", p.id); toast("Projekat dupliran"); navigate(`projekat-${c.id}`); };
  return (
    <div className="projpage" style={{ "--pc": p.color }}>
      <button className="backlink" onClick={() => navigate("projekti")}><Icon n="left" s={16} />Projekti</button>
      <div className="page-head proj-head">
        <div className="proj-title">
          <div className="eyebrow"><SpaceTag id={p.spaceId} /><span className="tag">{projStatusLabel(p.status)}</span></div>
          <h1 className="h1"><span className="pswatch lg" />{p.name}</h1>
        </div>
        <div className="head-acts">
          <button className="btn btn-primary" onClick={edit}><Icon n="edit" s={16} />Uredi</button>
          <button className="icon-btn" onClick={dup} aria-label="Dupliraj projekat" title="Dupliraj"><Icon n="copy" /></button>
          <button className="icon-btn danger" onClick={remove} aria-label="Obriši projekat" title="Obriši"><Icon n="trash" /></button>
        </div>
      </div>
      <div className="panel proj-summary">
        {p.description && <p className="vdesc">{p.description}</p>}
        <div className="proj-stats">
          <div><span className="k">Napredak</span><span className="v">{pr.pct}%<small> · {pr.done} od {pr.total} zadataka</small></span></div>
          <div><span className="k">Početak</span><span className="v">{p.startDate ? fmtNum(p.startDate) + parse(p.startDate).getFullYear() + "." : "—"}</span></div>
          <div><span className="k">Rok</span><span className={`v ${p.dueDate && p.dueDate < t && p.status !== "done" ? "is-late" : ""}`}>{p.dueDate ? `${fmtNum(p.dueDate)}${parse(p.dueDate).getFullYear()}.` : "—"}{p.dueDate && p.status !== "done" && <small> · {diffDays(t, p.dueDate) >= 0 ? `još ${diffDays(t, p.dueDate)} d` : `kasni ${-diffDays(t, p.dueDate)} d`}</small>}</span></div>
        </div>
        <div className="progress"><span style={{ width: `${pr.pct}%` }} /></div>
      </div>
      <div className="proj-cols">
        <div className="proj-main">
        <section className="panel">
          <div className="panel-head"><h2 className="h2">Zadaci <span className="count">{openTasks.length}</span></h2><button className="btn btn-sm" onClick={() => o.form("task", { projectId: p.id })}><Icon n="plus" s={15} />Zadatak</button></div>
          {openTasks.length ? <div className="tlist flat">{openTasks.map((x) => <TaskRow key={x.id} t={x} />)}</div> : <div className="pempty">Nema otvorenih zadataka.</div>}
          {doneTasks.length > 0 && <>
            <button className="late-toggle" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}><Icon n="right" s={14} style={{ transform: showDone ? "rotate(90deg)" : "none" }} />Završeni <span className="count">{doneTasks.length}</span></button>
            {showDone && <div className="tlist flat">{doneTasks.map((x) => <TaskRow key={x.id} t={x} />)}</div>}
          </>}
        </section>
        </div>
        <div className="proj-side">
          <section className="panel">
            <div className="panel-head"><h2 className="h2">Događaji <span className="count">{events.length}</span></h2><button className="btn btn-sm" onClick={() => o.form("event", { projectId: p.id })}><Icon n="plus" s={15} />Događaj</button></div>
            {events.length ? <div className="entries">{[...upcoming, ...past].map((e) => (
              <button key={e.id} className={`evrow ${past.includes(e) ? "is-past" : ""}`} onClick={() => o.view("event", e.id)}>
                <span className="tm tm-event" /><span className="evrow-t">{e.title}</span><span className="mono evrow-d">{fmtRel(e.startDate)}{!e.allDay && e.startTime ? ` ${e.startTime}` : ""}</span>
              </button>))}</div> : <div className="pempty">Nema događaja.</div>}
          </section>
          <section className="panel">
            <div className="panel-head"><h2 className="h2">Beleške <span className="count">{notes.length}</span></h2><button className="btn btn-sm" onClick={() => o.form("note", { projectId: p.id })}><Icon n="plus" s={15} />Beleška</button></div>
            {notes.length ? <div className="entries">{notes.map((n) => (
              <button key={n.id} className="evrow" onClick={() => o.view("note", n.id)}>
                <Icon n={n.pinned ? "pin" : "note"} s={14} className="muted-ic" /><span className="evrow-t">{noteTitle(n)}</span><span className="mono evrow-d">{fmtRel(n.updatedAt.slice(0, 10))}</span>
              </button>))}</div> : <div className="pempty">Nema beleški.</div>}
          </section>
        </div>
      </div>
      <ProjectCalendar projectId={p.id} />
    </div>
  );
}

function ProjectCalendar({ projectId }) {
  const [view, setView] = useState(() => prefs.get("projCalView", "month"));
  const [cur, setCur] = useState(today());
  useEffect(() => prefs.set("projCalView", view), [view]);
  const t = today();
  const isNow = monthStart(cur) === monthStart(t);
  return (
    <section className="panel proj-cal" aria-labelledby="pcal-h">
      <div className="panel-head">
        <h2 id="pcal-h" className="h2">Kalendar projekta</h2>
        <Segmented value={view} onChange={setView} label="Prikaz kalendara" size="sm" options={[{ v: "week", l: "Nedelja" }, { v: "month", l: "Mesec" }]} />
      </div>
      {view === "week" ? (
        <WeekBoard start={weekStart(cur)} setStart={setCur} projectId={projectId} withNotes />
      ) : (
        <>
          <div className="week-nav">
            <div className="week-label">{fmtMonth(cur)}</div>
            <div className="week-btns">
              <button className="icon-btn" onClick={() => setCur(addMonths(monthStart(cur), -1))} aria-label="Prethodni mesec"><Icon n="left" /></button>
              <button className="btn btn-sm" disabled={isNow} onClick={() => setCur(t)}>Danas</button>
              <button className="icon-btn" onClick={() => setCur(addMonths(monthStart(cur), 1))} aria-label="Sledeći mesec"><Icon n="right" /></button>
            </div>
          </div>
          <MonthView cur={cur} projectId={projectId} withNotes bare onPick={(d) => { setCur(d); setView("week"); }} />
        </>
      )}
      <div className="legend legend-foot"><TypeTag type="event" /><TypeTag type="work" /><TypeTag type="deadline" /><TypeTag type="note" /></div>
      <p className="field-hint center">Beleške se prikazuju na dan kada su napravljene. Klik na dan otvara tu nedelju.</p>
    </section>
  );
}

// ---------- BELEŠKE ----------
export function NotesPage() {
  const { data } = useStore();
  const o = useOpen();
  const [q, setQ] = useState("");
  const [proj, setProj] = useState("all");
  const [tag, setTag] = useState("all");
  const notes = Object.values(data.notes);
  const tags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags || []))].sort(), [data.notes]);
  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return notes.filter((n) => {
      if (proj === "none" ? n.projectId : proj !== "all" && n.projectId !== proj) return false;
      if (tag !== "all" && !(n.tags || []).includes(tag)) return false;
      if (qq && !`${n.title} ${htmlToText(n.body)} ${(n.tags || []).join(" ")}`.toLowerCase().includes(qq)) return false;
      return true;
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [data.notes, q, proj, tag]);
  const pinned = list.filter((n) => n.pinned), rest = list.filter((n) => !n.pinned);
  const projects = Object.values(data.projects);
  return (
    <div>
      <div className="page-head">
        <h1 className="h1">Beleške</h1>
        <button className="btn btn-primary hide-sm" onClick={() => o.form("note")}><Icon n="plus" s={16} />Beleška</button>
      </div>
      <div className="toolbar">
        <div className="search"><Icon n="search" s={16} /><input id="note-search" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pretraži beleške" aria-label="Pretraga beleški" /></div>
        <select id="note-proj" className="input sort" value={proj} onChange={(e) => setProj(e.target.value)} aria-label="Projekat">
          <option value="all">Svi projekti</option><option value="none">Bez projekta</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {tags.length > 0 && <div className="chips tagbar">
        <button className={`fchip ${tag === "all" ? "on" : ""}`} onClick={() => setTag("all")}>Sve oznake</button>
        {tags.map((t) => <button key={t} className={`fchip ${tag === t ? "on" : ""}`} aria-pressed={tag === t} onClick={() => setTag(tag === t ? "all" : t)}>#{t}</button>)}
      </div>}
      {!notes.length ? (
        <Empty icon="note" title="Još nema beleški" text="Zapiši ideju, zapisnik ili spisak. Belešku kasnije možeš povezati sa projektom ili pretvoriti u zadatak."
          action={<button className="btn btn-primary btn-sm" onClick={() => o.form("note")}>Nova beleška</button>} />
      ) : !list.length ? (
        <Empty icon="search" title="Nema beleški za ovu pretragu" action={<button className="btn btn-sm" onClick={() => { setQ(""); setProj("all"); setTag("all"); }}>Očisti pretragu</button>} />
      ) : <>
        {pinned.length > 0 && <><h2 className="h2 sect-h"><Icon n="pin" s={15} />Prikačene</h2><div className="ngrid">{pinned.map((n) => <NoteCard key={n.id} n={n} />)}</div></>}
        {rest.length > 0 && <>{pinned.length > 0 && <h2 className="h2 sect-h">Ostale</h2>}<div className="ngrid">{rest.map((n) => <NoteCard key={n.id} n={n} />)}</div></>}
      </>}
    </div>
  );
}

function NoteCard({ n }) {
  const o = useOpen();
  const text = htmlToText(n.body);
  const excerpt = n.title ? text : text.split("\n").slice(1).join(" ");
  return (
    <button className="ncard" onClick={() => o.view("note", n.id)}>
      <div className="ncard-title">{n.pinned && <Icon n="pin" s={13} className="muted-ic" />}{noteTitle(n)}</div>
      {excerpt && <div className="ncard-body">{excerpt}</div>}
      <div className="entry-meta"><span className="meta mono">{fmtRel(n.updatedAt.slice(0, 10))}</span><ProjectTag id={n.projectId} /><Tags tags={n.tags} /></div>
    </button>
  );
}

// ---------- PODEŠAVANJA ----------
export function SettingsPage() {
  const { data, mode, actions, getData, syncState } = useStore();
  const { toast, confirm, open } = useUI();
  const theme = data.settings?.theme || "dark";
  const demoCount = COLLECTIONS.reduce((n, c) => n + Object.values(data[c]).filter((r) => r.demo).length, 0);
  const counts = { spaces: "prostora", projects: "projekata", tasks: "zadataka", events: "događaja", notes: "beleški" };
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const fileRef = useRef(null);

  const exportJson = async () => {
    const json = JSON.stringify(serialize(getData()), null, 2);
    const name = `moj-os-${today()}.json`;
    let dl = null;
    try { dl = window.claude?.use ? await Promise.race([window.claude.use("downloads"), new Promise((r) => setTimeout(() => r(null), 3000))]) : null; } catch { dl = null; }
    if (dl) {
      try { await dl.save({ filename: name, data: json }); toast("Izvoz sačuvan"); return; }
      catch (e) { if (e?.code === "declined") { toast("Izvoz otkazan"); return; } }
    }
    if (!window.claude) {
      try {
        const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast("Izvoz preuzet");
        return;
      } catch {}
    }
    open({ type: "export", json });
  };
  const doImport = async (text) => {
    let nd;
    try { nd = normalizeImport(JSON.parse(text)); }
    catch (e) { toast(e instanceof SyntaxError ? "Fajl nije ispravan JSON." : e.message, { kind: "error", duration: 5000 }); return; }
    const summary = COLLECTIONS.map((c) => `${Object.keys(nd[c]).length} ${counts[c]}`).join(", ");
    if (!(await confirm({ title: "Uvesti podatke?", message: `Uvoz zamenjuje sve trenutne podatke. U fajlu: ${summary}.`, confirmLabel: "Uvezi i zameni", danger: true }))) return;
    actions.replaceAll({ ...nd, settings: { ...nd.settings, theme: data.settings?.theme || nd.settings.theme } });
    setPaste(""); setShowPaste(false);
    toast("Podaci uvezeni");
  };
  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast("Fajl je prevelik (najviše 15 MB).", { kind: "error" }); return; }
    const r = new FileReader();
    r.onload = () => doImport(String(r.result));
    r.onerror = () => toast("Fajl nije moguće pročitati.", { kind: "error" });
    r.readAsText(file);
  };
  const removeDemo = async () => {
    if (!(await confirm({ title: "Ukloniti demo podatke?", message: `Briše se ${demoCount} primera (prostori, projekti, zadaci, događaj i beleške označeni kao demo). Stavke koje si menjao ostaju.`, confirmLabel: "Ukloni demo" }))) return;
    const n = actions.removeDemo();
    toast(`Uklonjeno ${n} demo stavki`);
  };
  const clearAll = async () => {
    if (!(await confirm({ title: "Obrisati sve podatke?", message: "Brišu se svi prostori, projekti, zadaci, događaji i beleške. Preporuka: prvo napravi izvoz.", confirmLabel: "Nastavi" }))) return;
    if (!(await confirm({ title: "Poslednja potvrda", message: "Ovo se ne može poništiti.", requireText: "OBRIŠI", confirmLabel: "Obriši sve" }))) return;
    actions.clearAll();
    toast("Svi podaci su obrisani");
  };
  return (
    <div className="settings">
      <div className="page-head"><h1 className="h1">Podešavanja</h1></div>
      <section className="panel sset">
        <h2 className="h2">Izgled</h2>
        <div className="srow"><div><b>Tema</b><div className="field-hint">Tamna je podrazumevana. „Sistem“ prati podešavanje uređaja.</div></div>
          <Segmented value={theme} onChange={(v) => actions.updateSettings({ theme: v })} label="Tema" options={[{ v: "dark", l: "Tamna" }, { v: "light", l: "Svetla" }, { v: "system", l: "Sistem" }]} />
        </div>
      </section>
      <section className="panel sset">
        <h2 className="h2">Podaci</h2>
        <div className="storage-box">
          <Icon n={mode === "cloud" ? "cloud" : "device"} s={20} />
          <div>
            <b>{mode === "cloud" ? "Čuva se na tvom Claude nalogu" : "Čuva se u ovom pregledaču"}</b>
            <div className="field-hint">{mode === "cloud"
              ? "Privatno — vidiš ih samo ti, na svakom uređaju gde otvoriš aplikaciju. Kopija se drži i u pregledaču radi brzog učitavanja."
              : "localStorage ovog pregledača. Drugi uređaji ne vide ove podatke; redovno pravi izvoz."}
              {syncState.pending > 0 && " · Čuvanje u toku…"}{syncState.error && ` · Poslednja greška: ${syncState.error}`}</div>
            <div className="field-hint mono">{COLLECTIONS.map((c) => `${Object.keys(data[c]).length} ${counts[c]}`).join(" · ")}</div>
          </div>
        </div>
        <div className="srow"><div><b>Izvoz u JSON</b><div className="field-hint">Svi prostori, projekti, zadaci, događaji, beleške i podešavanja.</div></div>
          <button className="btn" onClick={exportJson}><Icon n="download" s={16} />Izvezi</button></div>
        <div className="srow"><div><b>Uvoz iz JSON-a</b><div className="field-hint">Fajl prethodno izvezen iz aplikacije Moj OS. Zamenjuje trenutne podatke.</div></div>
          <div className="srow-acts">
            <input ref={fileRef} id="import-file" type="file" accept="application/json,.json" className="sr-only" onChange={onFile} />
            <button className="btn" onClick={() => fileRef.current?.click()}><Icon n="upload" s={16} />Izaberi fajl</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPaste(!showPaste)}>Nalepi tekst</button>
          </div></div>
        {showPaste && <div className="paste">
          <textarea id="import-paste" className="input mono" rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder='{"app":"moj-os", …}' />
          <button className="btn btn-sm" disabled={!paste.trim()} onClick={() => doImport(paste)}>Uvezi nalepljeno</button>
        </div>}
        <div className="srow"><div><b>Demo podaci</b><div className="field-hint">{demoCount ? `${demoCount} primera je trenutno u aplikaciji.` : "Nema demo podataka."}</div></div>
          {demoCount ? <button className="btn" onClick={removeDemo}>Ukloni demo podatke</button> : <button className="btn btn-ghost" onClick={() => { actions.loadDemo(); toast("Demo podaci dodati"); }}>Dodaj demo podatke</button>}</div>
        <div className="srow danger-row"><div><b>Obriši sve podatke</b><div className="field-hint">Traži dvostruku potvrdu.</div></div>
          <button className="btn btn-danger" onClick={clearAll}><Icon n="trash" s={16} />Obriši sve</button></div>
      </section>
      <section className="panel sset">
        <h2 className="h2">Prečice</h2>
        <div className="kbd-list"><span><kbd>N</kbd> Novo</span><span><kbd>Esc</kbd> Zatvori prozor</span><span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> Sačuvaj brzu belešku</span></div>
      </section>
    </div>
  );
}
