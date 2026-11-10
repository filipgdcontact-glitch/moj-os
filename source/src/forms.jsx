// ============================================================
// Forme: posebna forma za svaku vrstu sadržaja
// ============================================================
import {
  STATUS, PRIORITY, RECUR, PROJECT_STATUS, COLORS, makeTask, makeEvent, makeNote, makeProject, makeSpace,
  today, toMin, fromMin, fmtRel, sanitizeHtml, htmlToText, makeSpace as mkSpace, nowISO,
} from "./core.js";
import { useStore } from "./store.jsx";
import { useUI, Modal, Icon, Segmented } from "./ui.jsx";

const { useState, useRef, useEffect, useMemo } = React;

// ---------- Polja ----------
export function Field({ label, error, hint, children, className = "", htmlFor }) {
  return (
    <div className={`field ${error ? "has-err" : ""} ${className}`}>
      {label && <label className="field-label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <div className="field-err">{error}</div> : hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  );
}

function ProjectSelect({ id, value, onChange, allowNone = true }) {
  const { data } = useStore();
  const spaces = Object.values(data.spaces).sort((a, b) => a.name.localeCompare(b.name, "sr"));
  const projects = Object.values(data.projects).filter((p) => p.status !== "archived" || p.id === value);
  const groups = spaces.map((s) => ({ s, ps: projects.filter((p) => p.spaceId === s.id) })).filter((g) => g.ps.length);
  const loose = projects.filter((p) => !p.spaceId || !data.spaces[p.spaceId]);
  return (
    <select id={id} className="input" value={value || ""} onChange={(e) => onChange(e.target.value || null)}>
      {allowNone && <option value="">Bez projekta</option>}
      {groups.map((g) => (
        <optgroup key={g.s.id} label={g.s.name}>
          {g.ps.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </optgroup>
      ))}
      {loose.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

function SpaceSelect({ id, value, onChange, disabled, allowNone = true }) {
  const { data } = useStore();
  const spaces = Object.values(data.spaces).sort((a, b) => a.name.localeCompare(b.name, "sr"));
  return (
    <select id={id} className="input" value={value || ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
      {allowNone && <option value="">Bez prostora</option>}
      {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
}

export function TagInput({ id, value, onChange }) {
  const { data } = useStore();
  const [txt, setTxt] = useState("");
  const all = useMemo(() => {
    const s = new Set();
    for (const c of ["tasks", "events", "notes"]) for (const r of Object.values(data[c])) (r.tags || []).forEach((t) => s.add(t));
    return [...s].sort();
  }, [data]);
  const add = (raw) => {
    const t = raw.trim().replace(/^#/, "").toLowerCase().slice(0, 30);
    if (t && !value.includes(t)) onChange([...value, t]);
    setTxt("");
  };
  const sugg = txt ? all.filter((t) => t.startsWith(txt.toLowerCase().replace(/^#/, "")) && !value.includes(t)).slice(0, 5) : [];
  return (
    <div className="taginput">
      <div className="taginput-box">
        {value.map((t) => (
          <span key={t} className="tchip">#{t}<button type="button" aria-label={`Ukloni oznaku ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}><Icon n="x" s={12} /></button></span>
        ))}
        <input id={id} className="taginput-in" value={txt} placeholder={value.length ? "" : "npr. planiranje"}
          onChange={(e) => { const v = e.target.value; if (/[,\s]$/.test(v)) add(v.slice(0, -1)); else setTxt(v); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); if (txt.trim()) add(txt); }
            else if (e.key === "Backspace" && !txt && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => txt.trim() && add(txt)} />
      </div>
      {sugg.length > 0 && (
        <div className="tagsugg">{sugg.map((t) => <button type="button" key={t} onMouseDown={(e) => { e.preventDefault(); add(t); }}>#{t}</button>)}</div>
      )}
    </div>
  );
}

function DurationInput({ id, value, onChange }) {
  return (
    <div className="dur">
      <input id={id} className="input" type="number" inputMode="numeric" min="5" max="1440" step="5" placeholder="min" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
      <div className="dur-presets">
        {[15, 30, 60, 90].map((m) => <button type="button" key={m} className={value === m ? "on" : ""} onClick={() => onChange(m)}>{m < 60 ? `${m}m` : `${m / 60}h`}</button>)}
      </div>
    </div>
  );
}

// ---------- Uređivač teksta ----------
export function RichEditor({ id, value, onChange, placeholder }) {
  const ref = useRef(null);
  const range = useRef(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("https://");
  const [, force] = useState(0);
  useEffect(() => { if (ref.current) ref.current.innerHTML = value || ""; }, []); // eslint-disable-line
  const emit = () => onChange(ref.current.innerHTML);
  const saveRange = () => {
    const s = window.getSelection();
    if (s.rangeCount && ref.current.contains(s.anchorNode)) range.current = s.getRangeAt(0).cloneRange();
  };
  const restore = () => {
    ref.current.focus();
    if (range.current) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(range.current); }
  };
  const cmd = (c, v) => { restore(); document.execCommand(c, false, v); emit(); saveRange(); force((x) => x + 1); };
  const isOn = (c) => { try { return document.queryCommandState(c); } catch { return false; } };
  const block = () => { try { return String(document.queryCommandValue("formatBlock")).toLowerCase(); } catch { return ""; } };
  const tb = (icon, label, fn, on) => (
    <button type="button" className={`rt-btn ${on ? "on" : ""}`} aria-label={label} title={label} onMouseDown={(e) => { e.preventDefault(); saveRange(); }} onClick={fn}>
      <Icon n={icon} s={16} />
    </button>
  );
  const applyLink = () => {
    const u = url.trim();
    if (!/^(https?:\/\/|mailto:)./i.test(u)) return;
    restore();
    const s = window.getSelection();
    if (s.isCollapsed) document.execCommand("insertHTML", false, `<a href="${u.replace(/"/g, "&quot;")}">${u.replace(/</g, "&lt;")}</a>`);
    else document.execCommand("createLink", false, u);
    emit(); setLinkOpen(false); setUrl("https://");
  };
  return (
    <div className="rt">
      <div className="rt-bar" role="toolbar" aria-label="Formatiranje">
        {tb("heading", "Naslov", () => cmd("formatBlock", block() === "h3" ? "p" : "h3"), block() === "h3")}
        {tb("bold", "Podebljano", () => cmd("bold"), isOn("bold"))}
        {tb("ul", "Lista", () => cmd("insertUnorderedList"), isOn("insertUnorderedList"))}
        {tb("ol", "Numerisana lista", () => cmd("insertOrderedList"), isOn("insertOrderedList"))}
        {tb("link", "Link", () => setLinkOpen((o) => !o), linkOpen)}
      </div>
      {linkOpen && (
        <div className="rt-link">
          <input id={`${id}-url`} className="input" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); setLinkOpen(false); } }} />
          <button type="button" className="btn btn-sm" onClick={applyLink}>Dodaj link</button>
        </div>
      )}
      <div id={id} ref={ref} className="rt-area prose" contentEditable suppressContentEditableWarning data-ph={placeholder}
        onInput={() => { emit(); }} onKeyUp={() => { saveRange(); force((x) => x + 1); }} onMouseUp={() => { saveRange(); force((x) => x + 1); }}
        onPaste={(e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); }} />
    </div>
  );
}

// ---------- Zajednički okvir forme ----------
function useForm(init) {
  const [f, setF] = useState(init);
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); if (errors[k]) setErrors((e) => ({ ...e, [k]: null })); };
  return { f, setF, set, errors, setErrors };
}

function FormShell({ m, top, title, onSubmit, children, typeSwitch }) {
  const { close } = useUI();
  const formId = `form-${m.mid}`;
  return (
    <Modal title={title} onClose={() => (m.onCancel ? m.onCancel() : close(m.mid))} top={top} size="md"
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={() => (m.onCancel ? m.onCancel() : close(m.mid))}>Otkaži</button>
        <button type="submit" form={formId} className="btn btn-primary">Sačuvaj</button>
      </>}>
      {typeSwitch}
      <form id={formId} className="form" noValidate onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>{children}</form>
    </Modal>
  );
}

/** Prebacivanje vrste pri novom unosu (Zadatak / Događaj / Beleška), zadržava naslov i datum. */
function TypeSwitch({ m, current, title, date, time }) {
  const { replace } = useUI();
  if (m.id) return null;
  const go = (kind) => {
    if (kind === current) return;
    const init = {};
    if (kind === "task") Object.assign(init, { title, workDate: date || null, workTime: time || null });
    if (kind === "event") Object.assign(init, { title, startDate: date || today(), startTime: time || "09:00", endTime: time ? fromMin(Math.min(toMin(time) + 60, 1439)) : "10:00" });
    if (kind === "note") Object.assign(init, { title });
    replace(m.mid, { type: "form", kind, initial: { ...(m.initial?.projectId ? { projectId: m.initial.projectId } : {}), ...init } });
  };
  return (
    <div className="typeswitch">
      <Segmented value={current} onChange={go} label="Vrsta stavke" options={[{ v: "task", l: "Zadatak", icon: "task" }, { v: "event", l: "Događaj", icon: "calendar" }, { v: "note", l: "Beleška", icon: "note" }]} />
    </div>
  );
}

// ---------- Zadatak ----------
export function TaskForm({ m, top }) {
  const { data, actions } = useStore();
  const { close, toast } = useUI();
  const existing = m.id ? data.tasks[m.id] : null;
  const { f, set, setF, errors, setErrors } = useForm(() => existing ? { ...existing } : makeTask(m.initial || {}));
  const proj = f.projectId && data.projects[f.projectId];
  const submit = () => {
    const e = {};
    const title = (f.title || "").trim();
    if (!title) e.title = "Upiši naziv zadatka.";
    else if (title.length > 200) e.title = "Naziv može imati najviše 200 znakova.";
    if (f.dueTime && !f.dueDate) e.dueDate = "Izaberi datum roka ili ukloni vreme.";
    if (f.workTime && !f.workDate) e.workDate = "Izaberi datum termina ili ukloni vreme.";
    if (f.duration != null && (!Number.isFinite(f.duration) || f.duration < 5 || f.duration > 1440)) e.duration = "Trajanje mora biti između 5 i 1440 minuta.";
    if (f.recurrence !== "none" && !f.dueDate && !f.workDate) e.recurrence = "Za ponavljanje je potreban rok ili termin rada.";
    if (f.dueDate && f.workDate && f.workDate > f.dueDate) e.workDate = "Termin rada je posle roka.";
    if (Object.keys(e).length) { setErrors(e); return; }
    const rec = { ...f, title, description: (f.description || "").trim(), spaceId: proj ? proj.spaceId : f.spaceId, dueTime: f.dueDate ? f.dueTime : null, workTime: f.workDate ? f.workTime : null };
    const spawned = actions.save(rec);
    toast(existing ? "Izmene sačuvane" : "Zadatak sačuvan");
    if (spawned) setTimeout(() => toast(`Sledeći zadatak zakazan: ${fmtRel(spawned.workDate || spawned.dueDate)}`), 250);
    m.onSaved ? m.onSaved(rec.id) : close(m.mid);
  };
  return (
    <FormShell m={m} top={top} title={existing ? "Uredi zadatak" : "Novi zadatak"} onSubmit={submit}
      typeSwitch={<TypeSwitch m={m} current="task" title={f.title} date={f.workDate || f.dueDate} time={f.workTime} />}>
      <Field label="Naziv" error={errors.title} htmlFor="t-title">
        <input id="t-title" className="input input-lg" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Šta treba uraditi?" data-autofocus maxLength={220} />
      </Field>
      <Field label="Opis i detalji" htmlFor="t-desc">
        <textarea id="t-desc" className="input" rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Opciono" />
      </Field>
      <div className="grid2">
        <Field label="Status" htmlFor="t-status">
          <select id="t-status" className="input" value={f.status} onChange={(e) => set("status", e.target.value)}>
            {STATUS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </Field>
        <Field label="Prioritet">
          <div className="prio-pick" role="radiogroup" aria-label="Prioritet">
            {PRIORITY.map((p) => (
              <button type="button" key={p.v} role="radio" aria-checked={f.priority === p.v} className={`prio-opt prio-${p.v} ${f.priority === p.v ? "on" : ""}`} onClick={() => set("priority", p.v)}>{p.l}</button>
            ))}
          </div>
        </Field>
      </div>
      <div className="grid2">
        <Field label="Projekat" htmlFor="t-proj">
          <ProjectSelect id="t-proj" value={f.projectId} onChange={(v) => set("projectId", v)} />
        </Field>
        <Field label="Prostor" htmlFor="t-space" hint={proj ? "Prati prostor projekta" : null}>
          <SpaceSelect id="t-space" value={proj ? proj.spaceId : f.spaceId} disabled={!!proj} onChange={(v) => set("spaceId", v)} />
        </Field>
      </div>
      <fieldset className="fs">
        <legend><Icon n="flag" s={14} /> Krajnji rok</legend>
        <div className="grid2 tight">
          <Field error={errors.dueDate} htmlFor="t-due"><input id="t-due" className="input" type="date" value={f.dueDate || ""} onChange={(e) => set("dueDate", e.target.value || null)} aria-label="Datum roka" /></Field>
          <Field htmlFor="t-duet"><input id="t-duet" className="input" type="time" value={f.dueTime || ""} onChange={(e) => set("dueTime", e.target.value || null)} aria-label="Vreme roka (opciono)" disabled={!f.dueDate} /></Field>
        </div>
      </fieldset>
      <fieldset className="fs">
        <legend><Icon n="clock" s={14} /> Termin rada</legend>
        <div className="grid2 tight">
          <Field error={errors.workDate} htmlFor="t-work"><input id="t-work" className="input" type="date" value={f.workDate || ""} onChange={(e) => set("workDate", e.target.value || null)} aria-label="Datum termina rada" /></Field>
          <Field htmlFor="t-workt"><input id="t-workt" className="input" type="time" value={f.workTime || ""} onChange={(e) => set("workTime", e.target.value || null)} aria-label="Vreme termina (opciono)" disabled={!f.workDate} /></Field>
        </div>
        <Field label="Trajanje (minuta)" error={errors.duration} htmlFor="t-dur">
          <DurationInput id="t-dur" value={f.duration} onChange={(v) => set("duration", v)} />
        </Field>
      </fieldset>
      <div className="grid2">
        <Field label="Ponavljanje" error={errors.recurrence} htmlFor="t-rec" hint={f.recurrence !== "none" ? "Kad završiš zadatak, pravi se sledeći." : null}>
          <select id="t-rec" className="input" value={f.recurrence} onChange={(e) => set("recurrence", e.target.value)}>
            {RECUR.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>
        </Field>
        <Field label="Oznake" htmlFor="t-tags"><TagInput id="t-tags" value={f.tags} onChange={(v) => set("tags", v)} /></Field>
      </div>
    </FormShell>
  );
}

// ---------- Događaj ----------
export function EventForm({ m, top }) {
  const { data, actions } = useStore();
  const { close, toast } = useUI();
  const existing = m.id ? data.events[m.id] : null;
  const { f, set, setF, errors, setErrors } = useForm(() => existing ? { ...existing, endDate: existing.endDate || existing.startDate } : (() => { const e = makeEvent(m.initial || {}); return { ...e, endDate: e.endDate || e.startDate }; })());
  const [endTouched, setEndTouched] = useState(!!existing);
  const setStart = (k, v) => {
    setF((x) => {
      const n = { ...x, [k]: v };
      if (!endTouched) {
        if (k === "startDate") n.endDate = v;
        if (k === "startTime" && v) n.endTime = fromMin(Math.min(toMin(v) + 60, 23 * 60 + 59));
      } else if (k === "startDate" && n.endDate && v > n.endDate) n.endDate = v;
      return n;
    });
    setErrors((e) => ({ ...e, [k]: null, end: null }));
  };
  const submit = () => {
    const e = {};
    const title = (f.title || "").trim();
    if (!title) e.title = "Upiši naziv događaja.";
    if (!f.startDate) e.startDate = "Izaberi datum početka.";
    if (!f.allDay && !f.startTime) e.startTime = "Upiši vreme početka.";
    const endDate = f.endDate || f.startDate;
    if (f.startDate && endDate < f.startDate) e.end = "Kraj ne može biti pre početka.";
    if (!f.allDay && f.startTime && f.endTime && endDate === f.startDate && toMin(f.endTime) <= toMin(f.startTime)) e.end = "Vreme završetka mora biti posle početka.";
    if (Object.keys(e).length) { setErrors(e); return; }
    const rec = { ...f, title, description: (f.description || "").trim(), location: (f.location || "").trim(), endDate: endDate === f.startDate ? null : endDate, startTime: f.allDay ? null : f.startTime, endTime: f.allDay ? null : f.endTime || fromMin(Math.min(toMin(f.startTime) + 60, 1439)) };
    actions.save(rec);
    toast(existing ? "Izmene sačuvane" : "Događaj sačuvan");
    m.onSaved ? m.onSaved(rec.id) : close(m.mid);
  };
  return (
    <FormShell m={m} top={top} title={existing ? "Uredi događaj" : "Novi događaj"} onSubmit={submit}
      typeSwitch={<TypeSwitch m={m} current="event" title={f.title} date={f.startDate} time={f.startTime} />}>
      <Field label="Naziv" error={errors.title} htmlFor="e-title">
        <input id="e-title" className="input input-lg" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Naziv događaja" data-autofocus maxLength={220} />
      </Field>
      <label className="switch">
        <input id="e-allday" type="checkbox" checked={f.allDay} onChange={(e) => set("allDay", e.target.checked)} />
        <span className="switch-ui" /> Celodnevni događaj
      </label>
      <div className="grid2 tight">
        <Field label="Početak" error={errors.startDate} htmlFor="e-sd"><input id="e-sd" className="input" type="date" value={f.startDate || ""} onChange={(e) => setStart("startDate", e.target.value)} /></Field>
        {!f.allDay && <Field label="Vreme početka" error={errors.startTime} htmlFor="e-st"><input id="e-st" className="input" type="time" value={f.startTime || ""} onChange={(e) => setStart("startTime", e.target.value)} /></Field>}
      </div>
      <div className="grid2 tight">
        <Field label="Završetak" error={errors.end} htmlFor="e-ed"><input id="e-ed" className="input" type="date" value={f.endDate || ""} onChange={(e) => { setEndTouched(true); set("endDate", e.target.value); setErrors((x) => ({ ...x, end: null })); }} /></Field>
        {!f.allDay && <Field label="Vreme završetka" htmlFor="e-et"><input id="e-et" className="input" type="time" value={f.endTime || ""} onChange={(e) => { setEndTouched(true); set("endTime", e.target.value); setErrors((x) => ({ ...x, end: null })); }} /></Field>}
      </div>
      <Field label="Lokacija" htmlFor="e-loc"><input id="e-loc" className="input" value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="Opciono" /></Field>
      <div className="grid2">
        <Field label="Projekat" htmlFor="e-proj"><ProjectSelect id="e-proj" value={f.projectId} onChange={(v) => set("projectId", v)} /></Field>
        <Field label="Ponavljanje" htmlFor="e-rec">
          <select id="e-rec" className="input" value={f.recurrence} onChange={(e) => set("recurrence", e.target.value)}>
            {RECUR.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Oznake" htmlFor="e-tags"><TagInput id="e-tags" value={f.tags} onChange={(v) => set("tags", v)} /></Field>
      <Field label="Opis" htmlFor="e-desc"><textarea id="e-desc" className="input" rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Opciono" /></Field>
    </FormShell>
  );
}

// ---------- Beleška ----------
export function NoteForm({ m, top }) {
  const { data, actions } = useStore();
  const { close, toast } = useUI();
  const existing = m.id ? data.notes[m.id] : null;
  const { f, set, errors, setErrors } = useForm(() => existing ? { ...existing } : makeNote(m.initial || {}));
  const submit = () => {
    const body = sanitizeHtml(f.body);
    const title = (f.title || "").trim();
    if (!title && !htmlToText(body)) { setErrors({ body: "Upiši naslov ili tekst beleške." }); return; }
    actions.save({ ...f, title, body });
    toast(existing ? "Izmene sačuvane" : "Beleška sačuvana");
    m.onSaved ? m.onSaved(f.id) : close(m.mid);
  };
  return (
    <FormShell m={m} top={top} title={existing ? "Uredi belešku" : "Nova beleška"} onSubmit={submit}
      typeSwitch={<TypeSwitch m={m} current="note" title={f.title} />}>
      <Field label="Naslov" htmlFor="n-title"><input id="n-title" className="input input-lg" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Opciono za kratke beleške" data-autofocus maxLength={200} /></Field>
      <Field label="Tekst" error={errors.body} htmlFor="n-body">
        <RichEditor id="n-body" value={f.body} onChange={(v) => { set("body", v); if (errors.body) setErrors({}); }} placeholder="Piši ovde…" />
      </Field>
      <div className="grid2">
        <Field label="Projekat" htmlFor="n-proj"><ProjectSelect id="n-proj" value={f.projectId} onChange={(v) => set("projectId", v)} /></Field>
        <Field label="Oznake" htmlFor="n-tags"><TagInput id="n-tags" value={f.tags} onChange={(v) => set("tags", v)} /></Field>
      </div>
      <label className="switch">
        <input id="n-pin" type="checkbox" checked={f.pinned} onChange={(e) => set("pinned", e.target.checked)} />
        <span className="switch-ui" /> Prikači na vrh
      </label>
    </FormShell>
  );
}

// ---------- Projekat ----------
export function ProjectForm({ m, top }) {
  const { data, actions } = useStore();
  const { close, toast } = useUI();
  const existing = m.id ? data.projects[m.id] : null;
  const spaces = Object.values(data.spaces);
  const { f, set, errors, setErrors } = useForm(() => existing ? { ...existing } : makeProject({ spaceId: spaces[0]?.id || null, color: COLORS[Object.keys(data.projects).length % COLORS.length], ...(m.initial || {}) }));
  const [newSpace, setNewSpace] = useState(spaces.length ? null : "");
  const submit = () => {
    const e = {};
    const name = (f.name || "").trim();
    if (!name) e.name = "Upiši naziv projekta.";
    if (newSpace !== null && !newSpace.trim()) e.space = "Upiši naziv novog prostora.";
    if (newSpace === null && !f.spaceId) e.space = "Izaberi prostor.";
    if (f.dueDate && f.startDate && f.dueDate < f.startDate) e.dueDate = "Rok je pre datuma početka.";
    if (Object.keys(e).length) { setErrors(e); return; }
    let spaceId = f.spaceId;
    if (newSpace !== null) {
      const s = makeSpace({ name: newSpace.trim(), color: COLORS[(spaces.length + 1) % COLORS.length] });
      actions.save(s);
      spaceId = s.id;
    }
    actions.save({ ...f, name, description: (f.description || "").trim(), spaceId });
    toast(existing ? "Izmene sačuvane" : "Projekat sačuvan");
    m.onSaved ? m.onSaved(f.id) : close(m.mid);
  };
  return (
    <FormShell m={m} top={top} title={existing ? "Uredi projekat" : "Novi projekat"} onSubmit={submit}>
      <Field label="Naziv" error={errors.name} htmlFor="p-name"><input id="p-name" className="input input-lg" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Naziv projekta" data-autofocus maxLength={120} /></Field>
      <Field label="Opis" htmlFor="p-desc"><textarea id="p-desc" className="input" rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Cilj i obim projekta" /></Field>
      <div className="grid2">
        <Field label="Prostor" error={errors.space} htmlFor="p-space">
          {newSpace === null ? (
            <select id="p-space" className="input" value={f.spaceId || ""} onChange={(e) => { if (e.target.value === "__new") { setNewSpace(""); } else set("spaceId", e.target.value || null); setErrors((x) => ({ ...x, space: null })); }}>
              {!f.spaceId && <option value="">Izaberi…</option>}
              {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="__new">+ Novi prostor…</option>
            </select>
          ) : (
            <div className="row-in">
              <input id="p-space" className="input" value={newSpace} onChange={(e) => { setNewSpace(e.target.value); setErrors((x) => ({ ...x, space: null })); }} placeholder="npr. Posao" />
              {spaces.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNewSpace(null)}>Postojeći</button>}
            </div>
          )}
        </Field>
        <Field label="Status" htmlFor="p-status">
          <select id="p-status" className="input" value={f.status} onChange={(e) => set("status", e.target.value)}>
            {PROJECT_STATUS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid2 tight">
        <Field label="Početak" htmlFor="p-start"><input id="p-start" className="input" type="date" value={f.startDate || ""} onChange={(e) => set("startDate", e.target.value || null)} /></Field>
        <Field label="Rok (opciono)" error={errors.dueDate} htmlFor="p-due"><input id="p-due" className="input" type="date" value={f.dueDate || ""} onChange={(e) => set("dueDate", e.target.value || null)} /></Field>
      </div>
      <Field label="Boja"><ColorPick value={f.color} onChange={(c) => set("color", c)} /></Field>
    </FormShell>
  );
}

function ColorPick({ value, onChange }) {
  return (
    <div className="colors" role="radiogroup" aria-label="Boja">
      {COLORS.map((c) => (
        <button type="button" key={c} role="radio" aria-checked={value === c} aria-label={`Boja ${c}`} className={`swatch ${value === c ? "on" : ""}`} style={{ "--c": c }} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}

// ---------- Prostor ----------
export function SpaceForm({ m, top }) {
  const { data, actions } = useStore();
  const { close, toast } = useUI();
  const existing = m.id ? data.spaces[m.id] : null;
  const { f, set, errors, setErrors } = useForm(() => existing ? { ...existing } : makeSpace({ color: COLORS[Object.keys(data.spaces).length % COLORS.length] }));
  const submit = () => {
    const name = (f.name || "").trim();
    if (!name) { setErrors({ name: "Upiši naziv prostora." }); return; }
    if (Object.values(data.spaces).some((s) => s.id !== f.id && s.name.toLowerCase() === name.toLowerCase())) { setErrors({ name: "Prostor sa tim nazivom već postoji." }); return; }
    actions.save({ ...f, name });
    toast(existing ? "Izmene sačuvane" : "Prostor sačuvan");
    m.onSaved ? m.onSaved(f.id) : close(m.mid);
  };
  return (
    <FormShell m={m} top={top} title={existing ? "Uredi prostor" : "Novi prostor"} onSubmit={submit}>
      <Field label="Naziv" error={errors.name} htmlFor="s-name" hint="Šira oblast, npr. Posao, Privatno ili Učenje"><input id="s-name" className="input input-lg" value={f.name} onChange={(e) => set("name", e.target.value)} data-autofocus maxLength={60} /></Field>
      <Field label="Boja"><ColorPick value={f.color} onChange={(c) => set("color", c)} /></Field>
    </FormShell>
  );
}
