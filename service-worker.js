/*
  service-worker.js
  - Very small cache-first service worker used by the prototype
  - Caches a few core assets at install and serves cached responses when available
*/

const CACHE_NAME = 'fernway-v1'; // versioned cache name for easy updates
const ASSETS_TO_CACHE = [
  '/',           // root HTML
  '/index.html', // main page
  '/styles.css', // CSS
  '/app.js'      // application script
];

// Install event: populate the cache with core assets
self.addEventListener('install', (e)=>{
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  // Activate worker immediately after installation
  self.skipWaiting();
});

// Activate event: take control of uncontrolled clients
self.addEventListener('activate', (e)=>{
  e.waitUntil(self.clients.claim());
});

// Fetch handler: respond from cache if possible, otherwise fall back to network
self.addEventListener('fetch', (e)=>{
  const req = e.request;
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});
