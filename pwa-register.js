/* ==========================================================================
   Relay — Service Worker Registration
   Included on every page. Fails silently and harmlessly on browsers
   without service worker support, or when served from a context that
   disallows registration (e.g. file:// during local testing).
   ========================================================================== */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("[pwa] Service worker registration failed:", err);
    });
  });
}
