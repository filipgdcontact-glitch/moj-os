import subprocess, pathlib
dark = """--bg: #111113; --side: #161618; --surface: #19191c; --surface-2: #1f1f23; --surface-3: #28282d;
  --line: #26262b; --line-2: #34343b; --text: #f4f4f5; --text-2: #b4b4bc; --muted: #7c7c86;
  --primary: #f4f4f5; --primary-ink: #18181b; --accent: #8f80ff; --accent-ink: #ffffff; --accent-soft: rgba(143,128,255,.14); --accent-line: rgba(143,128,255,.45);
  --ev: #6aa1ff; --wk: #a593ff; --dl: #ff7b7b; --ok: #4cc77f; --danger: #ff7b7b; --hi: #f2a93b; --violet: #a593ff;
  --shadow: 0 1px 2px rgba(0,0,0,.4); --shadow-md: 0 4px 14px rgba(0,0,0,.35); --shadow-lg: 0 24px 60px rgba(0,0,0,.55);
  --overlay: rgba(0,0,0,.55); --toast-bg: #f4f4f5; --toast-fg: #18181b; --toast-act: #6d5bf6; color-scheme: dark;"""
blocks = f""":root[data-app-theme="dark"] {{ {dark} }}
@media (prefers-color-scheme: dark) {{ :root[data-app-theme="system"]:not([data-theme="light"]) {{ {dark} }} }}
:root[data-app-theme="system"][data-theme="dark"] {{ {dark} }}"""
css = pathlib.Path("src/style.css").read_text().replace("%%THEME_BLOCKS%%", blocks)
subprocess.run(["npx","esbuild","src/app.jsx","--bundle","--format=iife","--target=es2019","--minify","--jsx-factory=React.createElement","--jsx-fragment=React.Fragment","--outfile=dist/app.js","--log-level=warning"],check=True)
js = pathlib.Path("dist/app.js").read_text().replace("</script","<\\/script")
html = f"""<title>Moj OS</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Lični operativni sistem za obaveze, vreme, projekte i beleške.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>
{css}
</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>
{js}
</script>
"""
import base64
b64 = lambda n: "data:image/png;base64," + base64.b64encode(pathlib.Path(f"assets/icon-{n}.png").read_bytes()).decode()
icons = f'<link rel="icon" type="image/png" sizes="32x32" href="{b64(32)}">\n<link rel="icon" type="image/png" sizes="64x64" href="{b64(64)}">\n<link rel="apple-touch-icon" href="{b64(180)}">\n'
html = html.replace('<meta name="description"', icons + '<meta name="description"', 1)
html = html.replace("<style>\n", "<style>\n:root { --logo: url(\"" + b64(64) + "\"); }\n", 1)
pathlib.Path("dist/moj-os.html").write_text(html)
print(len(html))

# ============================================================
# Samostalna verzija (GitHub Pages / bilo koji statički hosting) → site/
# ============================================================
import shutil, hashlib, json as _json
site = pathlib.Path("site"); 
if site.exists(): shutil.rmtree(site)
(site / "icons").mkdir(parents=True); (site / "vendor").mkdir()
for n in (32, 64): shutil.copy(f"assets/icon-{n}.png", site / "icons" / f"favicon-{n}.png")
for n in (180, 192, 512): shutil.copy(f"assets/home-{n}.png", site / "icons" / f"home-{n}.png")
shutil.copy("node_modules/react/umd/react.production.min.js", site / "vendor/react.production.min.js")
shutil.copy("node_modules/react-dom/umd/react-dom.production.min.js", site / "vendor/react-dom.production.min.js")
shutil.copy("node_modules/@supabase/supabase-js/dist/umd/supabase.js", site / "vendor/supabase.js")
(site / "config.js").write_text("""// Moj OS — podešavanja povezivanja.
// Publishable (anon) ključ je namenjen pregledaču; podatke štite RLS pravila u bazi (supabase/schema.sql).
window.MOJOS_CONFIG = {
  supabaseUrl: "https://vbdybjhjyqwgocnseoro.supabase.co",
  supabaseKey: "sb_publishable_na_PzTYm4V6pf-49Joi6mQ_m0lM8QCE",
};
""")
shutil.copytree("supabase", site / "supabase")
(site / "app.js").write_text(pathlib.Path("dist/app.js").read_text())
(site / "app.css").write_text(':root { --logo: url("icons/favicon-64.png"); }\n' + css)
ver = hashlib.sha1((css + js).encode()).hexdigest()[:10]
index = f"""<!doctype html>
<html lang="sr-Latn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Moj OS</title>
<meta name="description" content="Lični operativni sistem za obaveze, vreme, projekte i beleške.">
<meta name="theme-color" content="#111723">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="icon" type="image/png" sizes="64x64" href="icons/favicon-64.png">
<link rel="apple-touch-icon" sizes="180x180" href="icons/home-180.png">
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Moj OS">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="app.css?v={ver}">
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
</head>
<body>
<div id="root"></div>
<script>window.MOJOS_STANDALONE = true;</script>
<script src="vendor/react.production.min.js"></script>
<script src="vendor/react-dom.production.min.js"></script>
<script src="vendor/supabase.js"></script>
<script src="config.js?v={ver}"></script>
<script src="app.js?v={ver}"></script>
</body>
</html>
"""
(site / "index.html").write_text(index)
(site / "manifest.webmanifest").write_text(_json.dumps({
  "name": "Moj OS", "short_name": "Moj OS", "lang": "sr-Latn",
  "description": "Lični operativni sistem za obaveze, vreme, projekte i beleške.",
  "start_url": "./", "scope": "./", "display": "standalone",
  "background_color": "#0b0f17", "theme_color": "#111723",
  "icons": [
    {"src": "icons/home-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
    {"src": "icons/home-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
    {"src": "icons/home-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
  ]
}, ensure_ascii=False, indent=2))
shell = ["./", "index.html", f"app.css?v={ver}", f"app.js?v={ver}", "vendor/react.production.min.js", "vendor/react-dom.production.min.js", "vendor/supabase.js", f"config.js?v={ver}", "manifest.webmanifest", "icons/favicon-32.png", "icons/favicon-64.png", "icons/home-180.png", "icons/home-192.png", "icons/home-512.png"]
(site / "sw.js").write_text(f"""// Moj OS — rad bez interneta. Verzija keša se menja sa svakim build-om.
const CACHE = "mojos-{ver}";
const SHELL = {_json.dumps(shell)};
self.addEventListener("install", (e) => {{ e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); }});
self.addEventListener("activate", (e) => {{ e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("mojos-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); }});
self.addEventListener("fetch", (e) => {{
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate") {{
    e.respondWith(fetch(req, {{ cache: "no-cache" }}).then((r) => {{ const c = r.clone(); caches.open(CACHE).then((x) => x.put("./", c)); return r; }}).catch(() => caches.match("./")));
    return;
  }}
  if (url.origin === location.origin || url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com")) {{
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {{ if (r.ok || r.type === "opaque") {{ const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); }} return r; }})));
  }}
}});
""")
(site / ".nojekyll").write_text("")
print("site ok", ver)
