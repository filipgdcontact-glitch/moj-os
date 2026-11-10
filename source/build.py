import subprocess, pathlib
light = """--bg: #f4f5f8; --surface: #ffffff; --surface-2: #f3f5f8; --surface-3: #e9ecf2;
  --line: #e2e6ed; --line-2: #d2d8e2; --text: #141924; --text-2: #4a5367; --muted: #6b7489;
  --accent: #a96b10; --accent-ink: #ffffff; --accent-soft: rgba(169,107,16,.11); --accent-line: rgba(169,107,16,.45);
  --ev: #2f72c4; --wk: #138891; --dl: #c84846; --ok: #23955d; --danger: #c84846; --hi: #c4651f; --violet: #7a5cc9;
  --shadow: 0 1px 2px rgba(20,25,36,.06), 0 6px 18px rgba(20,25,36,.06); --shadow-lg: 0 18px 50px rgba(20,25,36,.18);
  --overlay: rgba(20,25,36,.35); --toast-act: #f0bf6a; color-scheme: light;"""
blocks = f""":root[data-app-theme="light"] {{ {light} }}
@media (prefers-color-scheme: light) {{ :root[data-app-theme="system"]:not([data-theme="dark"]) {{ {light} }} }}
:root[data-app-theme="system"][data-theme="light"] {{ {light} }}"""
css = pathlib.Path("src/style.css").read_text().replace("%%LIGHT_BLOCKS%%", blocks)
subprocess.run(["npx","esbuild","src/app.jsx","--bundle","--format=iife","--target=es2019","--minify","--jsx-factory=React.createElement","--jsx-fragment=React.Fragment","--outfile=dist/app.js","--log-level=warning"],check=True)
js = pathlib.Path("dist/app.js").read_text().replace("</script","<\\/script")
html = f"""<title>Moj OS</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Lični operativni sistem za obaveze, vreme, projekte i beleške.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap">
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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap">
<link rel="stylesheet" href="app.css?v={ver}">
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
</head>
<body>
<div id="root"></div>
<script>window.MOJOS_STANDALONE = true;</script>
<script src="vendor/react.production.min.js"></script>
<script src="vendor/react-dom.production.min.js"></script>
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
shell = ["./", "index.html", f"app.css?v={ver}", f"app.js?v={ver}", "vendor/react.production.min.js", "vendor/react-dom.production.min.js", "manifest.webmanifest", "icons/favicon-32.png", "icons/favicon-64.png", "icons/home-180.png", "icons/home-192.png", "icons/home-512.png"]
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
    e.respondWith(fetch(req).then((r) => {{ const c = r.clone(); caches.open(CACHE).then((x) => x.put("./", c)); return r; }}).catch(() => caches.match("./")));
    return;
  }}
  if (url.origin === location.origin || url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com")) {{
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {{ if (r.ok || r.type === "opaque") {{ const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); }} return r; }})));
  }}
}});
""")
(site / ".nojekyll").write_text("")
print("site ok", ver)
