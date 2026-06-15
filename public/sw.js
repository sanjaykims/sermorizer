/* Sermorizer service worker — push notifications only.

   Deliberately NO fetch/caching handler: Next.js serves hashed, immutable
   assets, and a caching SW would risk serving stale builds. This SW exists so
   the server can notify the user when a summary/translation finishes while the
   app is closed or the phone is locked — the one thing page-level
   Notifications can't do once the page is frozen. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Sermorizer";
  const body = data.body || "Your sermon summary is ready.";
  const url = data.url || "/";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192",
      badge: "/icon-192",
      tag: "sermorizer",
      renotify: true,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Defence-in-depth: only ever navigate to our own origin. Today the server
  // sends safe relative paths, but a future change (or a forged push payload)
  // shouldn't be able to redirect the user off-site via a notification click.
  const raw = (event.notification.data && event.notification.data.url) || "/";
  let target = "/";
  try {
    const parsed = new URL(raw, self.location.origin);
    if (parsed.origin === self.location.origin) {
      target = parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    /* fall through to "/" */
  }
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ("focus" in client) {
            client.navigate(target).catch(() => {});
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
