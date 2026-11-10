// ============================================================
// Prijava (samo samostalna verzija sa Supabase podešavanjima)
// ============================================================
import { getClient, supabaseAdapter, authError } from "./supabase.js";
import { localAdapter, LocalCache, prefs } from "./storage.js";
import { Icon } from "./ui.jsx";

const { createContext, useContext, useEffect, useMemo, useState, useCallback } = React;
const AuthCtx = createContext({ enabled: false });
export const useAuth = () => useContext(AuthCtx);

export function AuthGate({ children }) {
  const sb = useMemo(() => getClient(), []);
  const [session, setSession] = useState(undefined); // undefined = proveravam
  const [localOnly, setLocalOnly] = useState(() => prefs.get("localOnly", false));
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!sb) return;
    let alive = true;
    sb.auth.getSession().then(({ data }) => alive && setSession(data.session || null)).catch(() => alive && setSession(null));
    const { data: sub } = sb.auth.onAuthStateChange((ev, s) => {
      if (ev === "PASSWORD_RECOVERY") setRecovery(true);
      setSession((old) => (old?.user?.id === s?.user?.id && old ? old : s || null));
    });
    return () => { alive = false; sub?.subscription?.unsubscribe(); };
  }, [sb]);

  const signOut = useCallback(async () => {
    try { await sb.auth.signOut(); } catch {}
    LocalCache.clear();
    try { localStorage.removeItem("mojos:sb:queue"); } catch {}
    location.reload();
  }, [sb]);
  const useLocal = useCallback(() => { prefs.set("localOnly", true); setLocalOnly(true); }, []);
  const askLogin = useCallback(() => { prefs.set("localOnly", false); location.reload(); }, []);

  const uid = session?.user?.id;
  const makeAdapter = useMemo(() => {
    if (!sb) return undefined;
    if (uid) return async () => supabaseAdapter(sb, session.user);
    return async () => localAdapter();
  }, [sb, uid]); // eslint-disable-line

  if (!sb) return <AuthCtx.Provider value={{ enabled: false }}>{children(undefined, "default")}</AuthCtx.Provider>;
  if (session === undefined) return <Splash />;
  if (recovery && session) return <NewPassword sb={sb} onDone={() => setRecovery(false)} />;
  if (!session && !localOnly) return <Login sb={sb} onLocal={useLocal} />;
  const value = { enabled: true, user: session?.user || null, signOut, askLogin };
  return <AuthCtx.Provider value={value}>{children(makeAdapter, uid || "local")}</AuthCtx.Provider>;
}

function Splash() {
  return <div className="auth-wrap"><div className="auth-card auth-splash"><span className="brand-logo big" aria-hidden="true" /><p className="field-hint">Učitavanje…</p></div></div>;
}

/** Greška koju Supabase vraća u adresi posle klika na link iz e-maila. */
function readLinkError() {
  const raw = (location.hash || "").replace(/^#/, "") + "&" + (location.search || "").replace(/^\?/, "");
  const q = new URLSearchParams(raw);
  const code = q.get("error_code") || q.get("error");
  if (!code) return null;
  try { history.replaceState(null, "", location.pathname); } catch {}
  if (code === "otp_expired") return "Link iz e-maila je istekao ili je već iskorišćen. Pošalji novi link ispod.";
  return (q.get("error_description") || "Link iz e-maila nije važeći.").replace(/\+/g, " ");
}

function Login({ sb, onLocal }) {
  const [mode, setMode] = useState("in"); // in | up | reset
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(() => readLinkError());
  const [canResend, setCanResend] = useState(() => !!err);
  const [info, setInfo] = useState(null);
  const redirect = location.origin + location.pathname;
  const resend = async () => {
    const em = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return setErr("Upiši e-mail adresu na koju treba poslati novi link.");
    setBusy(true); setErr(null);
    const { error } = await sb.auth.resend({ type: "signup", email: em, options: { emailRedirectTo: redirect } });
    setBusy(false);
    if (error) setErr(authError(error));
    else { setInfo(`Poslali smo novi link za potvrdu na ${em}. Otvori najnoviju poruku.`); setCanResend(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setInfo(null);
    const em = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return setErr("Upiši ispravnu e-mail adresu.");
    if (mode !== "reset" && pw.length < 6) return setErr("Lozinka mora imati najmanje 6 znakova.");
    if (mode === "up" && pw !== pw2) return setErr("Lozinke se ne poklapaju.");
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await sb.auth.signInWithPassword({ email: em, password: pw });
        if (error) throw error;
      } else if (mode === "up") {
        const { data, error } = await sb.auth.signUp({ email: em, password: pw, options: { emailRedirectTo: redirect } });
        if (error) throw error;
        if (!data.session) {
          if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error("already registered");
          setInfo(`Poslali smo link za potvrdu na ${em}. Otvori ga, pa se vrati ovde i prijavi se.`);
          setMode("in"); setPw2("");
        }
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(em, { redirectTo: redirect });
        if (error) throw error;
        setInfo(`Ako nalog postoji, poslali smo link za novu lozinku na ${em}.`);
        setMode("in");
      }
    } catch (x) {
      setErr(authError(x));
      if (/not confirmed/i.test(x?.message || "")) setCanResend(true);
    } finally {
      setBusy(false);
    }
  };
  const title = { in: "Prijava", up: "Novi nalog", reset: "Nova lozinka" }[mode];
  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="auth-brand"><span className="brand-logo big" aria-hidden="true" /><div><b>Moj OS</b><span className="field-hint">Podaci se sinhronizuju na svim tvojim uređajima.</span></div></div>
        {mode !== "reset" && (
          <div className="seg auth-seg" role="tablist">
            <button type="button" role="tab" aria-selected={mode === "in"} className={mode === "in" ? "on" : ""} onClick={() => { setMode("in"); setErr(null); }}>Prijava</button>
            <button type="button" role="tab" aria-selected={mode === "up"} className={mode === "up" ? "on" : ""} onClick={() => { setMode("up"); setErr(null); setInfo(null); }}>Novi nalog</button>
          </div>
        )}
        {mode === "reset" && <h1 className="h2">{title}</h1>}
        {info && <div className="auth-info"><Icon n="check" s={16} />{info}</div>}
        <label className="field"><span className="field-label">E-mail</span>
          <input id="auth-email" className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></label>
        {mode !== "reset" && <label className="field"><span className="field-label">Lozinka</span>
          <input id="auth-pw" className="input" type="password" autoComplete={mode === "up" ? "new-password" : "current-password"} value={pw} onChange={(e) => setPw(e.target.value)} /></label>}
        {mode === "up" && <label className="field"><span className="field-label">Ponovi lozinku</span>
          <input id="auth-pw2" className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>}
        {err && <div className="field-err" role="alert">{err}</div>}
        <button className="btn btn-primary auth-submit" disabled={busy}>{busy ? "Sačekaj…" : mode === "in" ? "Prijavi se" : mode === "up" ? "Napravi nalog" : "Pošalji link"}</button>
        {canResend && mode !== "reset" && <button type="button" className="btn auth-submit" disabled={busy} onClick={resend}>Pošalji ponovo link za potvrdu</button>}
        <div className="auth-links">
          {mode === "in" && <button type="button" className="link" onClick={() => { setMode("reset"); setErr(null); setInfo(null); }}>Zaboravljena lozinka?</button>}
          {mode === "reset" && <button type="button" className="link" onClick={() => { setMode("in"); setErr(null); }}>Nazad na prijavu</button>}
          <button type="button" className="link muted-link" onClick={onLocal}>Koristi bez naloga (samo ovaj uređaj)</button>
        </div>
      </form>
    </div>
  );
}

function NewPassword({ sb, onDone }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 6) return setErr("Lozinka mora imati najmanje 6 znakova.");
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setErr(authError(error)); else onDone();
  };
  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1 className="h2">Postavi novu lozinku</h1>
        <label className="field"><span className="field-label">Nova lozinka</span>
          <input id="auth-newpw" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></label>
        {err && <div className="field-err" role="alert">{err}</div>}
        <button className="btn btn-primary auth-submit" disabled={busy}>Sačuvaj lozinku</button>
      </form>
    </div>
  );
}
