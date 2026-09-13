const CACHE_NAME = "wjh-brand-v4";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/wjh-192.png",
  "/icons/wjh-512.png",
  "/icons/wjh-maskable-512.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const networkOnlyPath =
    url.pathname.startsWith("/api/") ||
    url.pathname === "/mcp" ||
    url.pathname.startsWith("/oauth/") ||
    url.pathname.startsWith("/.well-known/");
  if (url.origin !== self.location.origin || networkOnlyPath) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok && url.pathname === "/") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put("/", copy));
          }
          return response;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      cached =>
        cached ||
        fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});

self.addEventListener("push", event => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { title: "تحديث جديد في وجهة", body: event.data?.text() ?? "" };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "تحديث جديد في وجهة", {
      body: payload.body || "لديك تحديث جديد يخص أعمالك.",
      icon: "/icons/wjh-192.png",
      badge: "/icons/wjh-192.png",
      dir: "rtl",
      lang: "ar",
      tag: payload.id ? `wjh-notification-${payload.id}` : "wjh-notification",
      renotify: false,
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || "/",
    self.location.origin
  ).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(clients => {
        const existing = clients.find(client =>
          client.url.startsWith(self.location.origin)
        );
        if (existing) {
          existing.navigate(targetUrl);
          return existing.focus();
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
