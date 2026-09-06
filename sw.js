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

const VERSION = "v1";
const CACHE_NAME = `relay-shell-${VERSION}`;

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./login.html",
  "./signup.html",
  "./app.html",
  "./adduser.html",
  "./settings.html",
  "./styles.css",
  "./landing.css",
  "./app.js",
  "./login.js",
  "./signup.js",
  "./adduser.js",
  "./settings.js",
  "./firebase-config.js",
  "./manifest.json",
  "./Assets/icon.png",
  "./Assets/icon.png",
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
   Fetch
   --------------------------------------------------------------------- */
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle same-origin GET requests. Everything else (Firebase
  // Auth, Firestore, Storage, Google APIs, cross-origin CDN scripts)
  // passes straight through to the network untouched.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Navigations: network-first, falling back to the cached page (or
  // the cached index.html) when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("./index.html");
        })
    );
    return;
  }

  // Static assets (CSS/JS/images): cache-first, refreshing the cache
  // in the background when the network succeeds.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
