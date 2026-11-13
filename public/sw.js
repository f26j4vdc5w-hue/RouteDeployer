self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Roadbook', {
      body: data.body || '',
      icon: 'apple-touch-icon.png',
      data: { url: data.url || './' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data.url, self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const appWindows = windows.filter((client) => client.url.startsWith(self.registration.scope));
      const existing = appWindows.find((client) => client.focused)
        || appWindows.find((client) => client.visibilityState === 'visible')
        || appWindows[0];
      if (existing) {
        return existing.focus().then(() => {
          existing.postMessage({ type: 'ROADBOOK_OPEN_NOTIFICATION', url: target });
        });
      }
      return self.clients.openWindow(target);
    }),
  );
});
