const CACHE_NAME = "daily-routine-app-v17";

const APP_FILES = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
];

/* ==================================================
   INSTALL

   Download and cache the main application files.

   The worker does not call skipWaiting here because
   the user should choose when to activate the update.
================================================== */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_FILES);
    }),
  );
});

/* ==================================================
   ACTIVATE

   Remove old app caches after the new version becomes
   active, then take control of open app pages.
================================================== */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        );
      }),

      self.clients.claim(),
    ]),
  );
});

/* ==================================================
   UPDATE MESSAGE

   The app sends this message when the user presses
   the "Update now" button.
================================================== */

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/* ==================================================
   FETCH STRATEGY

   Use the network first so users receive current files.

   When the network is unavailable, use the cached copy
   so the application continues working offline.
================================================== */

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);

  /*
   * Do not cache external files such as Bootstrap CDN
   * resources inside this application cache.
   */
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const responseCopy = networkResponse.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseCopy);
        });

        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);

        if (cachedResponse) {
          return cachedResponse;
        }

        /*
         * Return the cached main page when an offline
         * navigation request has no exact cache match.
         */
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }

        return Response.error();
      }),
  );
});
