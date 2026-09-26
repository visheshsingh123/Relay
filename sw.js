/* ==========================================================================
   Relay — Service Worker
   App-shell caching strategy:
   - Precache the static shell (HTML/CSS/JS/manifest/icons) on install.
   - Cache-first for the shell assets (fast loads, works offline).
   - Network-first for navigations, falling back to the cached shell page
     if offline (so a full reload while offline still shows *something*
     instead of the browser's default offline error page).
   - Firestore/Firebase Auth requests are never intercepted — those go
     straight to the network and rely on Firestore's own offline cache.
   ========================================================================== */

const VERSION = "v4";
const CACHE_NAME = `relay-shell-${VERSION}`;

const SHELL_ASSETS = [
  "./",
  "./login",
  "./signup",
  "./adduser",
  "./settings",
  "./profileview",
  "./index.html",
  "./login.html",
  "./signup.html",
  "./adduser.html",
  "./settings.html",
  "./profileview.html",
  "./styles.css",
  "./landing.css",
  "./app.js",
  "./login.js",
  "./signup.js",
  "./adduser.js",
  "./settings.js",
  "./profileview.js",
  "./firebase-config.js",
  "./manifest.json",
  "./Assets/icon-192.png",
  "./Assets/icon-512.png"
];

/* ---------------------------------------------------------------------
   Install — precache the shell. Individual failures (e.g. a missing
   icon) shouldn't block the whole install, so we cache what we can.
   --------------------------------------------------------------------- */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        SHELL_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[sw] Skipping ${url}:`, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

/* ---------------------------------------------------------------------
   Activate — drop any old versioned caches.
   --------------------------------------------------------------------- */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("relay-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* ---------------------------------------------------------------------
   Fetch — Stale-While-Revalidate for 0ms instant page loads
   --------------------------------------------------------------------- */
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle same-origin GET requests. Everything else (Firebase
  // Auth, Firestore, Storage, Google APIs, cross-origin CDN scripts)
  // passes straight through to the network untouched.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Stale-While-Revalidate: Return cached version instantly (0ms),
  // while updating the cache in the background when network responds.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);
      
      const networkFetch = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      }).catch((err) => {
        return cachedResponse;
      });

      // Return cached response immediately if available, otherwise wait for network
      return cachedResponse || networkFetch;
    })
  );
});

/* ---------------------------------------------------------------------
   Push & Notification Click Event Handlers
   --------------------------------------------------------------------- */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : "./";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Relay", body: "You have a new message.", icon: "./Assets/icon-192.png" };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "./Assets/icon-192.png",
      badge: "./Assets/icon-192.png",
      tag: data.tag || "relay-msg",
      data: { url: "./" },
      vibrate: [100, 50, 100]
    })
  );
});
