// Moj OS — rad bez interneta. Verzija keša se menja sa svakim build-om.
const CACHE = "mojos-7f1e1feb53";
const SHELL = ["./", "index.html", "app.css?v=7f1e1feb53", "app.js?v=7f1e1feb53", "vendor/react.production.min.js", "vendor/react-dom.production.min.js", "vendor/supabase.js", "config.js?v=7f1e1feb53", "manifest.webmanifest", "icons/favicon-32.png", "icons/favicon-64.png", "icons/home-180.png", "icons/home-192.png", "icons/home-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("mojos-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put("./", c)); return r; }).catch(() => caches.match("./")));
    return;
  }
  if (url.origin === location.origin || url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok || r.type === "opaque") { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); } return r; })));
  }
});
