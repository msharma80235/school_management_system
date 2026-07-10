/* Education Hub service worker.
 * - Offline-tolerant app shell: navigations fall back to a cached index.html.
 * - Static assets: cache-first, so a returning user loads instantly / offline.
 * - API calls (/api, /uploads) are NEVER cached — always hit the network.
 * - Web push: shows a notification and focuses the app on click. (Backend push
 *   sending via VAPID is a documented follow-up; the handlers are ready.)
 */
const CACHE = 'edu-hub-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API or uploaded files.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads')) return;

  // App navigations: network-first, fall back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Static assets (hashed JS/CSS/images): cache-first, then populate the cache.
  event.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => cached)
    )
  );
});

// --- Web push (handlers ready; enable by sending pushes from the backend) ---
self.addEventListener('push', (event) => {
  let data = { title: 'Education Hub', body: 'You have a new notification.', url: '/' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch { /* plain text / none */ }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c);
      if (existing) { existing.navigate(target); return existing.focus(); }
      return self.clients.openWindow(target);
    })
  );
});
