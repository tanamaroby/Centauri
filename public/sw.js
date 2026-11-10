/* Centauri service worker: offline app shell + ticket file cache. */
const VERSION = "centauri-v2";
const SHELL = `${VERSION}-shell`;
const FILES = `${VERSION}-files`;
const PRECACHE = ["/", "/timeline", "/trips", "/add", "/offline.html", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE.map(async (u) => {
            const res = await fetch(u, { credentials: "same-origin" });
            if (res.ok && !res.redirected) await cache.put(u, res);
          }),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Ticket files never change: cache-first so passes open offline at the gate.
  if (url.pathname === "/api/files") {
    event.respondWith(
      caches.open(FILES).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Other API data is cached by the app itself (React Query + localStorage).
  if (url.pathname.startsWith("/api/")) return;

  // Hashed build assets: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(SHELL).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Pages: network-first, fall back to the cached copy, then to the offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/")) || caches.match("/offline.html")),
    );
  }
});
