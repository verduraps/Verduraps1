/* ================================================================
   VERDAPP – SERVICE WORKER
   Versión: 1.0
   Estrategia: Cache-first (offline completo)
================================================================ */

const CACHE_NAME = 'verdapp-v3';

// Archivos a cachear en la instalación
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

/* ── INSTALACIÓN: Pre-cachear archivos esenciales ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-cacheando assets...');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

/* ── ACTIVACIÓN: Limpiar caches viejos ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Eliminando cache viejo:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

/* ── FETCH: Cache-first con fallback a red ── */
self.addEventListener('fetch', event => {
  // Solo manejar peticiones GET
  if (event.request.method !== 'GET') return;

  // Para Google Fonts, usar estrategia stale-while-revalidate
  if (event.request.url.includes('fonts.googleapis.com') ||
      event.request.url.includes('fonts.gstatic.com')) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Para el resto: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          // Solo cachear respuestas válidas
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Offline y no hay cache: devolver página principal
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/index.html');
          }
        });
    })
  );
});

/* ── Stale-While-Revalidate para fuentes ── */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then(response => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || networkFetch;
}

/* ── Mensaje de versión ── */
self.addEventListener('message', event => {
  if (event.data === 'getVersion') {
    event.source.postMessage({ version: CACHE_NAME });
  }
});
