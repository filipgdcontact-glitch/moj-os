// ============================================================
// Prilozi: slike i PDF uz zadatke, beleške i projekte
// ============================================================
import { KINDS, fmtSize, fmtStamp } from "./core.js";
import { useStore } from "./store.jsx";
import { useUI, Icon, Modal } from "./ui.jsx";
import { getClient, uploadAttachment, signedUrls } from "./supabase.js";
import { useAuth } from "./auth.jsx";

const { useState, useEffect, useRef, useCallback } = React;

export function Attachments({ kind, id, compact }) {
  const { data, actions, getData } = useStore();
  const { open, toast, confirm } = useUI();
  const auth = useAuth();
  const rec = data[KINDS[kind]][id];
  const list = rec?.attachments || [];
  const enabled = !!(auth.enabled && auth.user && getClient());
  const [urls, setUrls] = useState({});
  const [busy, setBusy] = useState([]); // imena fajlova u otpremanju
  const [over, setOver] = useState(false);
  const [err, setErr] = useState(null);
  const input = useRef(null);
  const key = list.map((a) => a.id).join(",");

  useEffect(() => {
    if (!enabled || !list.length) return;
    let alive = true;
    const paths = list.flatMap((a) => [a.thumb || a.path, a.type === "application/pdf" || !a.thumb ? null : a.path]).filter(Boolean);
    signedUrls(paths).then((u) => alive && setUrls(u)).catch((e) => alive && setErr(e.message));
    const t = setInterval(() => signedUrls(paths).then((u) => alive && setUrls(u)).catch(() => {}), 45 * 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, [enabled, key]); // eslint-disable-line

  const addFiles = useCallback(async (files) => {
    files = [...files].slice(0, 10);
    if (!files.length) return;
    setErr(null);
    setBusy((b) => [...b, ...files.map((f) => f.name)]);
    let ok = 0;
    for (const f of files) {
      try {
        const meta = await uploadAttachment(kind, id, f);
        const cur = getData()[KINDS[kind]][id];
        if (!cur) break;
        actions.save({ ...cur, attachments: [...(cur.attachments || []), meta] });
        ok++;
      } catch (e) {
        setErr(e.message);
      } finally {
        setBusy((b) => { const i = b.indexOf(f.name); return i < 0 ? b : [...b.slice(0, i), ...b.slice(i + 1)]; });
      }
    }
    if (ok) toast(ok === 1 ? "Prilog dodat" : `Dodato priloga: ${ok}`);
  }, [kind, id, actions, getData, toast]);

  const remove = async (a) => {
    if (!(await confirm({ title: "Obrisati prilog?", message: `„${a.name}“ se trajno briše.`, confirmLabel: "Obriši" }))) return;
    const cur = getData()[KINDS[kind]][id];
    actions.save({ ...cur, attachments: (cur.attachments || []).filter((x) => x.id !== a.id) });
    toast("Prilog obrisan");
  };

  if (!rec) return null;
  if (!enabled) {
    if (!list.length && compact) return null;
    return (
      <div className="att">
        <div className="att-head"><span className="vrow-k"><Icon n="attach" s={15} />Prilozi</span></div>
        <div className="field-hint">Slike i PDF prilozi rade kad si prijavljen na svoj nalog u verziji sa sinhronizacijom.</div>
      </div>
    );
  }
  return (
    <div className={`att ${over ? "is-over" : ""}`}
      onDragOver={(e) => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
      onDrop={(e) => { if (e.dataTransfer.files?.length) { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); } }}>
      <div className="att-head">
        <span className="vrow-k"><Icon n="attach" s={15} />Prilozi{list.length > 0 && <span className="count">{list.length}</span>}</span>
        <input ref={input} id={`att-in-${id}`} type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <button type="button" className="btn btn-sm" onClick={() => input.current?.click()}><Icon n="plus" s={15} />Dodaj</button>
      </div>
      {(list.length > 0 || busy.length > 0) ? (
        <div className="att-grid">
          {list.map((a) => {
            const isPdf = a.type === "application/pdf";
            const thumbUrl = urls[a.thumb || a.path];
            return (
              <div key={a.id} className={`att-item ${isPdf ? "is-file" : ""}`}>
                {isPdf ? (
                  <a className="att-file" href={urls[a.path] || undefined} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (!urls[a.path]) e.preventDefault(); }}>
                    <span className="att-pdf">PDF</span>
                    <span className="att-name"><b>{a.name}</b><small>{fmtSize(a.size)}</small></span>
                  </a>
                ) : (
                  <button type="button" className="att-img" onClick={() => open({ type: "image", kind, id, aid: a.id })} title={a.name}>
                    {thumbUrl ? <img src={thumbUrl} alt={a.name} loading="lazy" /> : <span className="att-ph" />}
                  </button>
                )}
                <button type="button" className="att-x" aria-label={`Obriši ${a.name}`} title="Obriši" onClick={() => remove(a)}><Icon n="x" s={13} /></button>
              </div>
            );
          })}
          {busy.map((n, i) => (
            <div key={`b${i}`} className="att-item is-busy" title={n}><span className="att-spin" /><small>Otpremanje…</small></div>
          ))}
        </div>
      ) : (
        <button type="button" className="att-drop" onClick={() => input.current?.click()}>
          <Icon n="upload" s={18} /><span>Prevuci slike ili PDF ovde, ili klikni da izabereš</span>
        </button>
      )}
      {err && <div className="field-err" role="alert">{err}</div>}
    </div>
  );
}

/** Slika preko celog prozora, sa listanjem kroz slike istog zapisa. */
export function ImageModal({ m, top }) {
  const { data } = useStore();
  const { close } = useUI();
  const rec = data[KINDS[m.kind]][m.id];
  const imgs = (rec?.attachments || []).filter((a) => a.type !== "application/pdf");
  const [idx, setIdx] = useState(() => Math.max(0, imgs.findIndex((a) => a.id === m.aid)));
  const [url, setUrl] = useState(null);
  const a = imgs[idx];
  useEffect(() => {
    if (!a) return;
    let alive = true;
    setUrl(null);
    signedUrls([a.path]).then((u) => alive && setUrl(u[a.path])).catch(() => {});
    return () => { alive = false; };
  }, [a?.path]);
  useEffect(() => {
    const on = (e) => {
      if (e.key === "ArrowRight") setIdx((i) => Math.min(i + 1, imgs.length - 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [imgs.length]);
  if (!a) return null;
  return (
    <Modal top={top} onClose={() => close(m.mid)} size="lg" className="img-modal"
      title={<span className="img-title">{a.name}<small>{fmtSize(a.size)}{a.w ? ` · ${a.w}×${a.h}` : ""} · {fmtStamp(a.createdAt)}</small></span>}>
      <div className="img-stage">
        {url ? <img src={url} alt={a.name} /> : <span className="att-spin" />}
        {imgs.length > 1 && <>
          <button className="img-nav prev" disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label="Prethodna slika"><Icon n="left" /></button>
          <button className="img-nav next" disabled={idx === imgs.length - 1} onClick={() => setIdx(idx + 1)} aria-label="Sledeća slika"><Icon n="right" /></button>
        </>}
      </div>
      <div className="img-foot">
        {imgs.length > 1 && <span className="field-hint">{idx + 1} / {imgs.length}</span>}
        {url && <a className="btn btn-sm" href={url} target="_blank" rel="noopener noreferrer"><Icon n="download" s={15} />Otvori original</a>}
      </div>
    </Modal>
  );
}
