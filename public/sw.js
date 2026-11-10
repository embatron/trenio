/* Message pushes only. Pages stay on the network so a deploy is not cached as the app. */
self.addEventListener("push", (event) => {
  const fallback = {
    title: "Trenio",
    body: "Вам написали на Trenio",
    url: "/account/messages",
    tag: "message",
  };
  let payload = fallback;
  try {
    if (event.data) payload = { ...fallback, ...event.data.json() };
  } catch {
    payload = fallback;
  }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const focused = windows.some((client) => client.focused);
    if (focused) return;
    await self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag,
      data: { url: payload.url },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/account/messages";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    for (const client of windows) {
      if (samePlace(client.url, target) && "focus" in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
    return undefined;
  }));
});

function samePlace(current, target) {
  try {
    const left = new URL(current);
    const right = new URL(target, left.origin);
    return left.pathname === right.pathname;
  } catch {
    return false;
  }
}
