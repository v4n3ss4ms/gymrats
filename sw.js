const CACHE = "gym-v1";
const ASSETS = [
  "./", "index.html", "manifest.webmanifest", "css/style.css",
  "vendor/pico.2.1.1.min.css", "vendor/chart.4.5.1.min.js", "vendor/firebase.js",
  "js/main.js", "js/firebase-config.js", "js/config.js", "js/db.js", "js/auth.js", "js/state.js",
  "js/autosave.js", "js/actions.js", "js/dialogs.js", "js/model.js", "js/ui.js", "js/csv.js",
  "js/views/login.js", "js/views/today.js", "js/views/session.js", "js/views/plans.js",
  "js/views/exercises.js", "js/views/history.js", "js/views/charts.js",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(ASSETS.map((a) => c.add(a).catch(() => {})))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
