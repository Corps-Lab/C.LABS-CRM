const CACHE_NAME = "clabs-crm-static-v8";
const OFFLINE_URL = "/C.LABS-CRM/index.html";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([OFFLINE_URL, "/C.LABS-CRM/", "/C.LABS-CRM/manifest.webmanifest"])
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // App shell for navigations
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) return resp;
          return caches.match(OFFLINE_URL);
        })
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Ignore non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Network-first for static assets to avoid stale bundles after deploy
  if (["style", "script", "image", "font"].includes(request.destination)) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (!resp || !resp.ok) return caches.match(request);
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return resp;
        })
        .catch(() => caches.match(request))
    );
  }
});
