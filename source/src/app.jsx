// ============================================================
// Moj OS — okvir aplikacije i navigacija
// ============================================================
import { StoreProvider, useStore } from "./store.jsx";
import { UIProvider, useUI, Icon, Modal, ProjectAvatar } from "./ui.jsx";
import { renderModal } from "./views.jsx";
import { TodayPage, PlannerPage, TasksPage, ProjectsPage, ProjectPage, NotesPage, SettingsPage, ReviewPage } from "./pages.jsx";
import { prefs } from "./storage.js";
import { AuthGate, useAuth } from "./auth.jsx";

document.documentElement.setAttribute("data-app-theme", prefs.get("theme", "light"));

const { useEffect, useState } = React;
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const NAV = [
  { r: "dan", l: "Moj dan", i: "home" },
  { r: "planer", l: "Planer", i: "calendar" },
  { r: "zadaci", l: "Zadaci", i: "checks" },
  { r: "projekti", l: "Projekti", i: "folder" },
  { r: "beleske", l: "Beleške", i: "note" },
  { r: "pregled", l: "Nedeljni pregled", i: "review" },
  { r: "podesavanja", l: "Podešavanja", i: "settings" },
];
const MOBILE_MAIN = ["dan", "planer", "zadaci"];

function MoreMenu({ m, top }) {
  const { close, navigate, route } = useUI();
  return (
    <Modal title="Više" onClose={() => close(m.mid)} top={top} size="sm" className="sheet-more">
      <div className="newmenu">
        {NAV.filter((n) => !MOBILE_MAIN.includes(n.r)).map((n, i) => (
          <button key={n.r} className={`newitem ${route.page === n.r || (n.r === "projekti" && route.page === "projekat") ? "is-active" : ""}`} data-autofocus={i === 0 || undefined} onClick={() => { close(m.mid); navigate(n.r); }}>
            <span className="newitem-ic"><Icon n={n.i} s={18} /></span><span><b>{n.l}</b></span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function SyncBadge({ compact }) {
  const { mode, syncState, ready } = useStore();
  let label = "Učitavanje…", icon = "cloud", cls = "";
  if (ready) {
    if (mode === "supabase") {
      if (syncState.error) { label = "Nije sačuvano — čeka vezu"; cls = "warn"; }
      else if (syncState.pending > 0) { label = "Čuvanje…"; cls = "busy"; }
      else { label = "Sinhronizovano"; }
    } else if (mode === "cloud") {
      if (syncState.pending > 0) { label = "Čuvanje…"; cls = "busy"; }
      else if (syncState.stale) { label = "Sinhronizacija kasni"; cls = "warn"; }
      else { label = "Sačuvano na nalogu"; }
    } else { label = "Sačuvano lokalno"; icon = "device"; }
  }
  return <div className={`sync ${cls}`} title={label}><Icon n={icon} s={15} />{!compact && <span>{label}</span>}</div>;
}

function Shell() {
  const { data, ready, syncState, actions } = useStore();
  const { route, navigate, open } = useUI();
  const [collapsed, setCollapsed] = useState(() => prefs.get("collapsed", false));
  const theme = data.settings?.theme || "light";
  // Redizajn 2: jednom prebaci na svetlu temu (kasnije se bira u Podešavanjima)
  useEffect(() => {
    if (ready && data.settings && data.settings.design !== 2) actions.updateSettings({ design: 2, theme: "light" });
  }, [ready, data.settings, actions]);
  useEffect(() => { document.documentElement.setAttribute("data-app-theme", theme); prefs.set("theme", theme); }, [theme]);
  useEffect(() => prefs.set("collapsed", collapsed), [collapsed]);
  useEffect(() => {
    const on = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!document.querySelector(".search-modal")) open({ type: "search" });
        return;
      }
      const isSlash = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey;
      if ((e.key.toLowerCase() !== "n" && !isSlash) || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (el && (el.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(el.tagName))) return;
      if (document.querySelector(".overlay")) return;
      e.preventDefault();
      open({ type: isSlash ? "search" : "new" });
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [open]);

  const active = route.page === "projekat" ? "projekti" : route.page;
  const page = !ready ? <Loading /> : syncState.fatal ? <Fatal msg={syncState.fatal} /> : {
    dan: <TodayPage />, planer: <PlannerPage />, zadaci: <TasksPage />, projekti: <ProjectsPage />,
    projekat: <ProjectPage id={route.id} />, beleske: <NotesPage />, pregled: <ReviewPage />, podesavanja: <SettingsPage />,
  }[route.page];
  const title = NAV.find((n) => n.r === active)?.l || "Moj OS";

  return (
    <div className={`app ${collapsed ? "is-collapsed" : ""}`}>
      <aside className="sidebar" aria-label="Glavna navigacija">
        <div className="brand">
          <span className="brand-logo" aria-hidden="true" />
          <span className="brand-text"><span className="brand-name">Moj OS</span><span className="brand-sub">Lični prostor</span></span>
          <ThemeToggle />
          <button className="icon-btn collapse-btn" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Proširi meni" : "Skupi meni"} title={collapsed ? "Proširi meni" : "Skupi meni"}><Icon n="sidebar" /></button>
        </div>
        <button className="side-search" onClick={() => open({ type: "search" })} disabled={!ready} title="Pretraga">
          <Icon n="search" s={18} /><span className="side-search-l">Pretraga</span>
          <span className="side-search-k"><kbd>{IS_MAC ? "⌘K" : "Ctrl K"}</kbd><kbd>/</kbd></span>
        </button>
        <button className="btn btn-primary new-btn" onClick={() => open({ type: "new" })} disabled={!ready} title="Novo (N)"><Icon n="plus" s={17} /><span>Novo</span></button>
        <div className="side-label">Glavni meni</div>
        <nav className="nav">
          {NAV.map((n) => (
            <a key={n.r} href={`#${n.r}`} className={`nav-item ${active === n.r ? "is-active" : ""}`} aria-current={active === n.r ? "page" : undefined}
              onClick={(e) => { e.preventDefault(); navigate(n.r); }} title={collapsed ? n.l : undefined}>
              <Icon n={n.i} s={19} /><span>{n.l}</span>
            </a>
          ))}
        </nav>
        <SideProjects collapsed={collapsed} />
        <div className="sidebar-foot"><SyncBadge compact={collapsed} /></div>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="brand-logo sm" aria-hidden="true" />
          <ThemeToggle />
          <span className="topbar-title">{title}</span>
          <button className="icon-btn" onClick={() => open({ type: "search" })} aria-label="Pretraga"><Icon n="search" /></button>
          <SyncBadge compact />
        </header>
        <main className="page" id="main">{page}</main>
      </div>

      <nav className="bottomnav" aria-label="Navigacija">
        {NAV.filter((n) => MOBILE_MAIN.includes(n.r)).slice(0, 2).map((n) => <BottomItem key={n.r} n={n} active={active} navigate={navigate} />)}
        <button className="bn-new" onClick={() => open({ type: "new" })} disabled={!ready} aria-label="Novo"><Icon n="plus" s={24} /></button>
        <BottomItem n={NAV[2]} active={active} navigate={navigate} />
        <button className={`bn-item ${!MOBILE_MAIN.includes(active) ? "is-active" : ""}`} onClick={() => open({ type: "more" })} aria-label="Više">
          <Icon n="menu" s={21} /><span>{!MOBILE_MAIN.includes(active) ? title : "Više"}</span>
        </button>
      </nav>
    </div>
  );
}

function ThemeToggle() {
  const { data, actions } = useStore();
  const theme = data.settings?.theme || "light";
  const sysDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && sysDark());
  const label = dark ? "Uključi svetlu temu" : "Uključi tamnu temu";
  return (
    <button className={`theme-toggle ${dark ? "is-dark" : ""}`} role="switch" aria-checked={dark} aria-label={label} title={label}
      onClick={() => actions.updateSettings({ theme: dark ? "light" : "dark" })}>
      <span className="tt-knob"><Icon n={dark ? "moon" : "sun"} s={13} /></span>
    </button>
  );
}

function SideProjects({ collapsed }) {
  const { data } = useStore();
  const { route, navigate, open } = useUI();
  const list = Object.values(data.projects).filter((p) => p.status === "active").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 7);
  return (
    <div className="side-projects">
      <div className="side-label side-label-row">
        <span>Projekti</span>
        <button className="icon-btn xs" onClick={() => open({ type: "form", kind: "project" })} aria-label="Novi projekat" title="Novi projekat"><Icon n="plus" s={15} /></button>
      </div>
      {list.length ? list.map((p) => (
        <a key={p.id} href={`#projekat-${p.id}`} className={`nav-item nav-proj ${route.page === "projekat" && route.id === p.id ? "is-active" : ""}`}
          onClick={(e) => { e.preventDefault(); navigate(`projekat-${p.id}`); }} title={collapsed ? p.name : undefined}>
          <ProjectAvatar p={p} size="sm" /><span>{p.name}</span>
        </a>
      )) : !collapsed && <div className="side-empty">Nema aktivnih projekata</div>}
    </div>
  );
}

function BottomItem({ n, active, navigate }) {
  return (
    <a href={`#${n.r}`} className={`bn-item ${active === n.r ? "is-active" : ""}`} aria-current={active === n.r ? "page" : undefined} onClick={(e) => { e.preventDefault(); navigate(n.r); }}>
      <Icon n={n.i} s={21} /><span>{n.l}</span>
    </a>
  );
}

function Fatal({ msg }) {
  const auth = useAuth();
  return (
    <div className="panel fatal">
      <h1 className="h2"><Icon n="cloud" s={18} />Podaci nisu dostupni</h1>
      <p>{msg}</p>
      <div className="head-acts">
        <button className="btn btn-primary" onClick={() => location.reload()}>Pokušaj ponovo</button>
        {auth.enabled && auth.user && <button className="btn btn-ghost" onClick={auth.signOut}>Odjavi se</button>}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="loading">
      <div className="sk sk-h" /><div className="sk" /><div className="sk" /><div className="sk sk-short" />
      <p className="field-hint">Učitavanje podataka…</p>
    </div>
  );
}

const modalRenderer = (m, top) => (m.type === "more" ? <MoreMenu m={m} top={top} /> : renderModal(m, top));

function App() {
  return (
    <AuthGate>
      {(makeAdapter, key) => (
        <StoreProvider key={key} makeAdapter={makeAdapter}>
          <UIProvider renderModal={modalRenderer}>
            <Shell />
          </UIProvider>
        </StoreProvider>
      )}
    </AuthGate>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

if (window.MOJOS_STANDALONE && "serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
