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
      const existing = windows.find((client) => 'focus' in client);
      if (existing) {
        return existing.navigate(target).then((client) => (client || existing).focus());
      }
      return self.clients.openWindow(target);
    }),
  );
});
