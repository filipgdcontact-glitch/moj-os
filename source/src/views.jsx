// ============================================================
// Pregledi (read-only) + usmeravanje modala
// ============================================================
import {
  STATUS, fmtFull, fmtRel, fmtStamp, fmtDuration, recurLabel, prioLabel, statusLabel, noteTitle, sanitizeHtml, htmlToText,
  projStatusLabel, today, fmtDay,
} from "./core.js";
import { useStore } from "./store.jsx";
import { useUI, Modal, Icon, PriorityTag, StatusTag, ProjectTag, SpaceTag, Tags, ConfirmModal } from "./ui.jsx";
import { TaskForm, EventForm, NoteForm, ProjectForm, SpaceForm } from "./forms.jsx";

const { useState } = React;

export function renderModal(m, top) {
  switch (m.type) {
    case "confirm": return <ConfirmModal m={m} top={top} />;
    case "view": return <ViewModal m={m} top={top} />;
    case "form": return <FormModal m={m} top={top} />;
    case "new": return <NewMenu m={m} top={top} />;
    case "export": return <ExportModal m={m} top={top} />;
    default: return null;
  }
}

function FormModal({ m, top }) {
  const C = { task: TaskForm, event: EventForm, note: NoteForm, project: ProjectForm, space: SpaceForm }[m.kind];
  return C ? <C key={`${m.kind}-${m.mid}`} m={m} top={top} /> : null;
}

/** Zajedničke akcije pregleda. Uredi zamenjuje pregled formom; posle čuvanja vraća pregled. */
function useViewActions(m, kind, label) {
  const { actions } = useStore();
  const { replace, close, toast, confirm, navigate } = useUI();
  const back = () => replace(m.mid, { type: "view", kind, id: m.id, date: m.date });
  return {
    edit: () => replace(m.mid, { type: "form", kind, id: m.id, onCancel: back, onSaved: back }),
    duplicate: () => {
      const c = actions.duplicate(kind, m.id);
      if (c) { toast(`${label} dupliran${label === "Beleška" ? "a" : ""}`); replace(m.mid, { type: "view", kind, id: c.id }); }
    },
    remove: async (extra) => {
      const ok = await confirm({ title: `Obrisati ${label.toLowerCase()}?`, message: extra || "Ova radnja se ne može poništiti." });
      if (!ok) return;
      actions.remove(kind, m.id);
      close(m.mid);
      toast(`${label} obrisan${label === "Beleška" ? "a" : ""}`);
    },
    close: () => close(m.mid),
  };
}

function ViewModal({ m, top }) {
  const C = { task: TaskView, event: EventView, note: NoteView, space: SpaceView }[m.kind];
  return C ? <C m={m} top={top} /> : null;
}

function Row({ icon, label, children }) {
  if (children == null || children === false || children === "") return null;
  return (
    <div className="vrow">
      <div className="vrow-k"><Icon n={icon} s={15} />{label}</div>
      <div className="vrow-v">{children}</div>
    </div>
  );
}

function Gone({ m, top }) {
  const { close } = useUI();
  return <Modal title="Stavka ne postoji" onClose={() => close(m.mid)} top={top} size="sm"><p className="muted">Ova stavka je obrisana ili premeštena.</p></Modal>;
}

function ViewFoot({ a, extra, done }) {
  return (
    <div className="vfoot">
      <div className="vfoot-main">
        <button className="btn btn-primary" onClick={a.edit}><Icon n="edit" s={16} />Uredi</button>
        {done}
        {extra}
      </div>
      <div className="vfoot-side">
        <button className="icon-btn" onClick={a.duplicate} aria-label="Dupliraj" title="Dupliraj"><Icon n="copy" /></button>
        <button className="icon-btn danger" onClick={() => a.remove()} aria-label="Obriši" title="Obriši"><Icon n="trash" /></button>
        <button className="btn btn-ghost" onClick={a.close}>Zatvori</button>
      </div>
    </div>
  );
}

// ---------- Zadatak ----------
function TaskView({ m, top }) {
  const { data, actions } = useStore();
  const { toast } = useUI();
  const t = data.tasks[m.id];
  const a = useViewActions(m, "task", "Zadatak");
  if (!t) return <Gone m={m} top={top} />;
  const setStatus = (s) => {
    const sp = actions.setTaskStatus(t.id, s);
    toast(s === "done" ? "Zadatak završen" : `Status: ${statusLabel(s)}`);
    if (sp) setTimeout(() => toast(`Sledeći zadatak zakazan: ${fmtRel(sp.workDate || sp.dueDate)}`), 250);
  };
  const overdue = t.status !== "done" && t.dueDate && t.dueDate < today();
  return (
    <Modal top={top} onClose={a.close} title={<span className="vkind"><Icon n="task" s={15} />Zadatak</span>}
      footer={<ViewFoot a={a} done={t.status !== "done"
        ? <button className="btn btn-ok" onClick={() => setStatus("done")}><Icon n="check" s={16} />Završi</button>
        : <button className="btn" onClick={() => setStatus("todo")}><Icon n="undo" s={16} />Vrati u rad</button>} />}>
      <h2 className={`vtitle ${t.status === "done" ? "is-done" : ""}`}>{t.title}</h2>
      <div className="vtags">
        <StatusTag v={t.status} />
        <PriorityTag v={t.priority} always />
        {overdue && <span className="tag tag-late">Kasni</span>}
        {t.recurrence !== "none" && <span className="tag"><Icon n="repeat" s={12} />{recurLabel(t.recurrence)}</span>}
      </div>
      {t.description && <p className="vdesc">{t.description}</p>}
      <div className="vstatus" role="radiogroup" aria-label="Promeni status">
        {STATUS.map((s) => (
          <button key={s.v} role="radio" aria-checked={t.status === s.v} className={`vst st-${s.v} ${t.status === s.v ? "on" : ""}`} onClick={() => t.status !== s.v && setStatus(s.v)}>{s.l}</button>
        ))}
      </div>
      <div className="vrows">
        <Row icon="flag" label="Rok">{t.dueDate && <>{fmtFull(t.dueDate)}{t.dueTime && <b className="mono"> · {t.dueTime}</b>}</>}</Row>
        <Row icon="clock" label="Termin rada">{t.workDate && <>{fmtFull(t.workDate)}{t.workTime && <b className="mono"> · {t.workTime}</b>}</>}</Row>
        <Row icon="clock" label="Trajanje">{t.duration ? fmtDuration(t.duration) : null}</Row>
        <Row icon="folder" label="Projekat">{t.projectId && data.projects[t.projectId] && <ProjectTag id={t.projectId} link />}</Row>
        <Row icon="layers" label="Prostor">{(t.projectId ? data.projects[t.projectId]?.spaceId : t.spaceId) && <SpaceTag id={t.projectId ? data.projects[t.projectId]?.spaceId : t.spaceId} />}</Row>
        <Row icon="tag" label="Oznake">{t.tags?.length ? <Tags tags={t.tags} /> : null}</Row>
      </div>
      <div className="vmeta">Napravljeno {fmtStamp(t.createdAt)}{t.completedAt && <> · Završeno {fmtStamp(t.completedAt)}</>}</div>
    </Modal>
  );
}

// ---------- Događaj ----------
function EventView({ m, top }) {
  const { data } = useStore();
  const e = data.events[m.id];
  const a = useViewActions(m, "event", "Događaj");
  if (!e) return <Gone m={m} top={top} />;
  const multi = e.endDate && e.endDate > e.startDate;
  return (
    <Modal top={top} onClose={a.close} title={<span className="vkind"><span className="tm tm-event" />Događaj</span>} footer={<ViewFoot a={a} />}>
      <h2 className="vtitle">{e.title}</h2>
      <div className="vtags">
        {e.allDay && <span className="tag">Ceo dan</span>}
        {e.recurrence !== "none" && <span className="tag"><Icon n="repeat" s={12} />{recurLabel(e.recurrence)}</span>}
      </div>
      <div className="vwhen">
        <div className="vwhen-d">{fmtFull(e.startDate)}{multi && <> – {fmtFull(e.endDate)}</>}</div>
        {!e.allDay && <div className="vwhen-t mono">{e.startTime}{e.endTime && ` – ${e.endTime}`}</div>}
        {m.date && e.recurrence !== "none" && m.date !== e.startDate && <div className="field-hint">Prikazano ponavljanje: {fmtFull(m.date)}</div>}
      </div>
      {e.description && <p className="vdesc">{e.description}</p>}
      <div className="vrows">
        <Row icon="map" label="Lokacija">{e.location}</Row>
        <Row icon="folder" label="Projekat">{e.projectId && data.projects[e.projectId] && <ProjectTag id={e.projectId} link />}</Row>
        <Row icon="tag" label="Oznake">{e.tags?.length ? <Tags tags={e.tags} /> : null}</Row>
      </div>
      <div className="vmeta">Napravljeno {fmtStamp(e.createdAt)} · Izmenjeno {fmtStamp(e.updatedAt)}</div>
    </Modal>
  );
}

// ---------- Beleška ----------
function NoteView({ m, top }) {
  const { data, actions } = useStore();
  const { replace, toast } = useUI();
  const n = data.notes[m.id];
  const a = useViewActions(m, "note", "Beleška");
  if (!n) return <Gone m={m} top={top} />;
  const toTask = () => {
    const text = htmlToText(n.body);
    replace(m.mid, { type: "form", kind: "task", initial: { title: noteTitle(n).slice(0, 200), description: n.title ? text : text.split("\n").slice(1).join("\n").trim(), projectId: n.projectId, tags: n.tags } });
  };
  return (
    <Modal top={top} onClose={a.close} size="lg" title={<span className="vkind"><Icon n="note" s={15} />Beleška</span>}
      footer={<ViewFoot a={a} extra={<>
        <button className="btn" onClick={toTask}><Icon n="task" s={16} />Pretvori u zadatak</button>
        <button className={`icon-btn ${n.pinned ? "on" : ""}`} aria-pressed={n.pinned} aria-label={n.pinned ? "Otkači" : "Prikači"} title={n.pinned ? "Otkači" : "Prikači"} onClick={() => { actions.togglePin(n.id); toast(n.pinned ? "Beleška otkačena" : "Beleška prikačena"); }}><Icon n="pin" /></button>
      </>} />}>
      {n.title && <h2 className="vtitle">{n.title}</h2>}
      <div className="vtags">
        {n.pinned && <span className="tag"><Icon n="pin" s={12} />Prikačeno</span>}
        {n.projectId && data.projects[n.projectId] && <ProjectTag id={n.projectId} link />}
        <Tags tags={n.tags} />
      </div>
      <div className="prose note-body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(n.body) || "<p class='muted'>Bez teksta.</p>" }} />
      <div className="vmeta">Napravljeno {fmtStamp(n.createdAt)} · Izmenjeno {fmtStamp(n.updatedAt)}</div>
    </Modal>
  );
}

// ---------- Prostor ----------
function SpaceView({ m, top }) {
  const { data } = useStore();
  const { toast } = useUI();
  const s = data.spaces[m.id];
  const a = useViewActions(m, "space", "Prostor");
  if (!s) return <Gone m={m} top={top} />;
  const projects = Object.values(data.projects).filter((p) => p.spaceId === s.id);
  const looseTasks = Object.values(data.tasks).filter((t) => t.spaceId === s.id && !t.projectId);
  const remove = () => {
    if (projects.length) { toast("Prvo premesti ili obriši projekte iz ovog prostora.", { kind: "error" }); return; }
    a.remove(looseTasks.length ? `${looseTasks.length} zadataka ostaće bez prostora.` : undefined);
  };
  return (
    <Modal top={top} onClose={a.close} size="sm" title={<span className="vkind"><Icon n="layers" s={15} />Prostor</span>} footer={<ViewFoot a={{ ...a, remove }} />}>
      <h2 className="vtitle"><span className="sdot big" style={{ borderColor: s.color }} />{s.name}</h2>
      <div className="vrows">
        <Row icon="folder" label="Projekti">{projects.length ? projects.map((p) => <ProjectTag key={p.id} id={p.id} link />) : "Nema projekata"}</Row>
        <Row icon="task" label="Zadaci van projekta">{String(looseTasks.length)}</Row>
      </div>
    </Modal>
  );
}

// ---------- Meni "+ Novo" ----------
function NewMenu({ m, top }) {
  const { replace, close } = useUI();
  const items = [
    { kind: "task", icon: "task", l: "Zadatak", d: "Sa rokom ili terminom rada" },
    { kind: "event", icon: "calendar", l: "Događaj", d: "Sastanak, obaveza u kalendaru" },
    { kind: "note", icon: "note", l: "Beleška", d: "Misao, ideja, zapis" },
    { kind: "project", icon: "folder", l: "Projekat", d: "Celina sa zadacima i beleškama" },
  ];
  return (
    <Modal title="Novo" onClose={() => close(m.mid)} top={top} size="sm">
      <div className="newmenu">
        {items.map((it, i) => (
          <button key={it.kind} className="newitem" data-autofocus={i === 0 || undefined} onClick={() => replace(m.mid, { type: "form", kind: it.kind, initial: m.initial || {} })}>
            <span className={`newitem-ic ni-${it.kind}`}><Icon n={it.icon} s={18} /></span>
            <span><b>{it.l}</b><small>{it.d}</small></span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ---------- Izvoz (rezervna varijanta: kopiranje) ----------
function ExportModal({ m, top }) {
  const { close, toast } = useUI();
  const copy = async () => {
    try { await navigator.clipboard.writeText(m.json); toast("JSON kopiran"); }
    catch { const el = document.getElementById("export-json"); el.focus(); el.select(); toast("Označeno — kopiraj sa Ctrl/Cmd + C"); }
  };
  return (
    <Modal title="Izvoz podataka" onClose={() => close(m.mid)} top={top} size="md"
      footer={<><button className="btn btn-ghost" onClick={() => close(m.mid)}>Zatvori</button><button className="btn btn-primary" onClick={copy} data-autofocus><Icon n="copy" s={16} />Kopiraj JSON</button></>}>
      <p className="muted">Preuzimanje fajla nije dostupno u ovom prikazu. Kopiraj tekst ispod i sačuvaj ga kao <span className="mono">moj-os.json</span>.</p>
      <textarea id="export-json" className="input mono export-ta" readOnly value={m.json} rows={12} />
    </Modal>
  );
}
