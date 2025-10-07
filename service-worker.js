// service-worker.js
const CACHE_NAME = 'raspored-cache-v2'; // <-- !! AŽURIRAJ AKO SI MIJENJAO DATOTEKE !!
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/raspored2.json',
  '/manifest.json',
  '/192velicinaSlika.png',              // <-- !! USKLADI PUTANJU S MANIFESTOM I STVARNOM LOKACIJOM !!
  '/512velicinaSlika.png',              // <-- !! USKLADI PUTANJU S MANIFESTOM I STVARNOM LOKACIJOM !!
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
];

// Instalacija
self.addEventListener('install', event => {
  console.log('SW Install (Cache:', CACHE_NAME, ')');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW Caching core files...');
        const requests = urlsToCache.map(url => new Request(url, { cache: 'reload' }));
        return cache.addAll(requests);
      })
      .then(() => self.skipWaiting())
      .catch(error => console.error('SW Cache addAll failed:', error))
  );
});

// Aktivacija
self.addEventListener('activate', event => {
  console.log('SW Activate (Cache:', CACHE_NAME, ')');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('SW Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) return cachedResponse; // Iz keša
                return fetch(event.request).catch(error => { // S mreže
                     console.warn('SW Network fetch failed:', event.request.url, error);
                     // Ovdje možeš dodati fallback ako želiš
                });
            })
    );
});