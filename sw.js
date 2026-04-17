const CACHE = 'radp-v1';
const PRECACHE = ['/', '/index.html', '/icon.svg', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

const STATIC_EXTS = /\.(js|css|svg|png|jpg|jpeg|ico|woff2?|webp)(\?.*)?$/i;

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  const url = new URL(e.request.url);
  const isStatic = STATIC_EXTS.test(url.pathname)
    || PRECACHE.includes(url.pathname);

  if (!isStatic) {
    // HTML pages and anything else: always go to network so security
    // patches reach users immediately and no stale data is served.
    e.respondWith(fetch(e.request));
    return;
  }

  // Static assets: cache-first for performance.
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    }).catch(() => caches.match(e.request))
  );
});
