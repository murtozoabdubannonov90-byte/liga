/* Hisobchi Liga — oflayn kesh.
   Sahifa: tarmoqdan, lekin 5 soniyada javob bo'lmasa — keshdagisi (sekin internetda oq ekran bo'lib turmasin).
   Fayllar (assets/*, nomi xeshli): keshdan, bo'lmasa tarmoqdan. Eski versiya fayllari serverda bir necha versiya saqlanadi. */
const CACHE = "hisobchi-liga-v5-20261031d";
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./index.html", "./manifest.json", "./icon-192.png"])).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
function netFirst(req, ms) {
  return new Promise((resolve) => {
    let done = false;
    const fallback = () => caches.match("./index.html").then((hit) => hit || fetch(req));
    const tm = setTimeout(() => { if (!done) { done = true; resolve(fallback()); } }, ms);
    fetch(req).then((res) => {
      if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then((x) => x.put("./index.html", c)); }
      if (!done) { done = true; clearTimeout(tm); resolve(res); }
    }).catch(() => { if (!done) { done = true; clearTimeout(tm); resolve(fallback()); } });
  });
}
self.addEventListener("fetch", (e) => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;     // supabase, telegram va boshqalar — keshsiz
  if (r.mode === "navigate") { e.respondWith(netFirst(r, 5000)); return; }
  if (u.pathname.endsWith("/sw.js")) return;
  e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => { if (res.ok && /\/assets\//.test(u.pathname)) { const c = res.clone(); caches.open(CACHE).then((x) => x.put(r, c)); } return res; })));
});
self.addEventListener("notificationclick", (e) => { e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((l) => { for (const c of l) if ("focus" in c) return c.focus(); return clients.openWindow("./"); })); });
