// ============================================================
// UI osnova: ikone, modali, toast poruke, potvrde, zajedničke oznake
// ============================================================
import { prioLabel, statusLabel, ENTRY_TYPE } from "./core.js";
import { useStore } from "./store.jsx";

const { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } = React;

// ---------- Ikone (stroke, 24x24) ----------
const P = {
  sun: "M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3l-1.4-1.4M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  calendar: "M8 3v4M16 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  checks: "M4 6h2l1 1 2-2M4 12h2l1 1 2-2M4 18h2l1 1 2-2M12 6h8M12 12h8M12 18h8",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  note: "M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M8 12h8M8 16h6",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z",
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6L6 18",
  left: "M15 18l-6-6 6-6",
  right: "M9 18l6-6-6-6",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  copy: "M9 9h10v10H9zM5 15V5h10",
  pin: "M9 4h6l-1 6 4 3v2H6v-2l4-3zM12 15v6",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  map: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  repeat: "M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  menu: "M4 6h16M4 12h16M4 18h16",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  board: "M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z",
  sidebar: "M4 4h16v16H4zM9 4v16",
  dot: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  ring: "M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z",
  tag: "M3 12V4h8l10 10-8 8zM7.5 7.5h.01",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  bold: "M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z",
  heading: "M6 4v16M18 4v16M6 12h12",
  ul: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  ol: "M10 6h10M10 12h10M10 18h10M4 5l1-1v4M4 13.5a1.2 1.2 0 1 1 2 1L4 17h2",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  upload: "M12 20V9M7 14l5-5 5 5M5 4h14",
  cloud: "M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z",
  device: "M5 4h14v11H5zM2 19h20",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  task: "M5 4h14v16H5zM8.5 12l2.5 2.5 4.5-5",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
};
export function Icon({ n, s = 18, className = "", style }) {
  return (
    <svg className={`ic ${className}`} width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
      <path d={P[n] || P.dot} />
    </svg>
  );
}

// ---------- Kontekst interfejsa ----------
const UICtx = createContext(null);
export const useUI = () => useContext(UICtx);

let seq = 0;
export function UIProvider({ children, renderModal }) {
  const [modals, setModals] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [route, setRouteState] = useState(() => parseHash());
  const modalsRef = useRef(modals);
  modalsRef.current = modals;

  useEffect(() => {
    const on = () => setRouteState(parseHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const navigate = useCallback((r) => {
    const h = "#" + r;
    if (location.hash !== h) location.hash = r;
    setRouteState(parseHash(h));
    window.scrollTo({ top: 0 });
  }, []);

  const open = useCallback((m) => {
    const id = ++seq;
    setModals((ms) => [...ms, { ...m, mid: id }]);
    return id;
  }, []);
  const close = useCallback((mid) => {
    setModals((ms) => {
      const target = mid == null ? ms[ms.length - 1] : ms.find((m) => m.mid === mid);
      if (target?.onDismiss) target.onDismiss();
      return mid == null ? ms.slice(0, -1) : ms.filter((m) => m.mid !== mid);
    });
  }, []);
  const replace = useCallback((mid, m) => {
    setModals((ms) => ms.map((x) => (x.mid === mid ? { ...m, mid } : x)));
  }, []);
  const closeAll = useCallback(() => setModals([]), []);

  const toast = useCallback((msg, opts = {}) => {
    const id = ++seq;
    setToasts((ts) => [...ts.slice(-2), { id, msg, ...opts }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), opts.duration || 3200);
  }, []);

  const confirm = useCallback(
    (o) =>
      new Promise((resolve) => {
        let done = false;
        const fin = (v) => { if (!done) { done = true; resolve(v); } };
        open({ type: "confirm", ...o, resolve: fin, onDismiss: () => fin(false) });
      }),
    [open]
  );

  // Escape zatvara gornji modal
  useEffect(() => {
    const on = (e) => {
      if (e.key === "Escape" && modalsRef.current.length) {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [close]);

  useEffect(() => {
    document.documentElement.style.overflow = modals.length ? "hidden" : "";
  }, [modals.length]);

  const value = useMemo(() => ({ open, close, replace, closeAll, toast, confirm, route, navigate }), [open, close, replace, closeAll, toast, confirm, route, navigate]);
  return (
    <UICtx.Provider value={value}>
      {children}
      {modals.map((m, i) => (
        <React.Fragment key={m.mid}>{renderModal(m, i === modals.length - 1)}</React.Fragment>
      ))}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind || ""}`}>
            <Icon n={t.kind === "error" ? "x" : "check"} s={16} />
            <span>{t.msg}</span>
            {t.action && (
              <button className="toast-act" onClick={() => { t.action.fn(); setToasts((ts) => ts.filter((x) => x.id !== t.id)); }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </UICtx.Provider>
  );
}

const ROUTES = ["dan", "planer", "zadaci", "projekti", "beleske", "podesavanja"];
function parseHash(h = location.hash) {
  const s = (h || "").replace(/^#/, "");
  if (s.startsWith("projekat-")) return { page: "projekat", id: s.slice(9) };
  return { page: ROUTES.includes(s) ? s : "dan" };
}

// ---------- Modal ----------
export function Modal({ title, onClose, children, footer, size = "md", top = true, labelledBy, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!top || !ref.current) return;
    const el = ref.current.querySelector("[data-autofocus]") || ref.current.querySelector(".modal-close");
    el?.focus({ preventScroll: true });
  }, [top]);
  return (
    <div className={`overlay ${top ? "" : "under"}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className={`modal modal-${size} ${className}`} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Zatvori"><Icon n="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ m, top }) {
  const { close } = useUI();
  const [text, setText] = useState("");
  const ok = !m.requireText || text.trim().toUpperCase() === m.requireText;
  const finish = (v) => { m.resolve(v); close(m.mid); };
  return (
    <Modal title={m.title || "Da li si siguran?"} onClose={() => finish(false)} size="sm" top={top}
      footer={<>
        <button className="btn btn-ghost" onClick={() => finish(false)}>Otkaži</button>
        <button className={`btn ${m.danger === false ? "btn-primary" : "btn-danger"}`} disabled={!ok} onClick={() => finish(true)} data-autofocus={!m.requireText || undefined}>{m.confirmLabel || "Obriši"}</button>
      </>}>
      <p className="confirm-text">{m.message}</p>
      {m.requireText && (
        <label className="field">
          <span className="field-label">Upiši <b>{m.requireText}</b> za potvrdu</span>
          <input id="confirm-text" className="input" value={text} onChange={(e) => setText(e.target.value)} data-autofocus autoComplete="off" />
        </label>
      )}
    </Modal>
  );
}

// ---------- Oznake ----------
export function PriorityTag({ v, always }) {
  if (!v || (v === "normal" && !always)) return null;
  return <span className={`tag prio-${v}`}><span className="prio-bars" aria-hidden="true"><i /><i /><i /></span>{prioLabel(v)}</span>;
}
export function StatusTag({ v }) {
  return <span className={`tag st st-${v}`}>{statusLabel(v)}</span>;
}
export function TypeTag({ type }) {
  return <span className={`type type-${type}`}><TypeMark type={type} />{ENTRY_TYPE[type]}</span>;
}
export function TypeMark({ type }) {
  if (type === "deadline") return <Icon n="flag" s={13} className="tm" />;
  if (type === "note") return <Icon n="note" s={13} className="tm tm-note" />;
  return <span className={`tm tm-${type}`} aria-hidden="true" />;
}
export function ProjectTag({ id, link }) {
  const { data } = useStore();
  const { navigate, closeAll } = useUI();
  const p = id && data.projects[id];
  if (!p) return null;
  const inner = <><span className="pdot" style={{ background: p.color }} />{p.name}</>;
  if (link) return <button className="ptag ptag-link" onClick={(e) => { e.stopPropagation(); closeAll(); navigate(`projekat-${p.id}`); }}>{inner}</button>;
  return <span className="ptag">{inner}</span>;
}
export function SpaceTag({ id }) {
  const { data } = useStore();
  const s = id && data.spaces[id];
  if (!s) return null;
  return <span className="ptag"><span className="sdot" style={{ borderColor: s.color }} />{s.name}</span>;
}
export function Tags({ tags }) {
  if (!tags?.length) return null;
  return <span className="tags">{tags.map((t) => <span key={t} className="hashtag">#{t}</span>)}</span>;
}
export function Check({ checked, onChange, label }) {
  return (
    <button className={`check ${checked ? "on" : ""}`} role="checkbox" aria-checked={checked} aria-label={label}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}>
      <span className="check-box"><Icon n="check" s={14} /></span>
    </button>
  );
}
export function Empty({ icon = "check", title, text, action }) {
  return (
    <div className="empty">
      <div className="empty-ic"><Icon n={icon} s={20} /></div>
      <div className="empty-title">{title}</div>
      {text && <div className="empty-text">{text}</div>}
      {action}
    </div>
  );
}
export function Segmented({ value, options, onChange, label, size }) {
  return (
    <div className={`seg ${size || ""}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} role="radio" aria-checked={value === o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>
          {o.icon && <Icon n={o.icon} s={15} />}<span>{o.l}</span>
        </button>
      ))}
    </div>
  );
}
