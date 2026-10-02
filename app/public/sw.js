/* Hisobchi Liga 2.0 — oflayn kesh: sahifa — tarmoqdan (bo'lmasa keshdan), fayllar — keshdan */
const CACHE = "hisobchi-liga-v2-1";
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./index.html", "./manifest.json", "./icon-192.png"])).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url); if (u.hostname.includes("supabase.co") || u.hostname.includes("telegram.org")) return;
  if (r.mode === "navigate") { e.respondWith(fetch(r).then((res) => { const c = res.clone(); caches.open(CACHE).then((x) => x.put("./index.html", c)); return res; }).catch(() => caches.match("./index.html"))); return; }
  e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => { if (res.ok && u.origin === location.origin) { const c = res.clone(); caches.open(CACHE).then((x) => x.put(r, c)); } return res; })));
});
self.addEventListener("notificationclick", (e) => { e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((l) => { for (const c of l) if ("focus" in c) return c.focus(); return clients.openWindow("./"); })); });
