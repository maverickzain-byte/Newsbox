/* ===========================================================
   Newsbox — service-worker.js
   Caches the app shell so the UI loads offline. Article data
   itself lives in IndexedDB (see js/db.js), not here.
=========================================================== */
const CACHE_NAME = 'newsbox-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/feeds.js',
  './js/trending.js',
  './js/briefing.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event)=>{
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL_FILES)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', (event)=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', (event)=>{
  const url = new URL(event.request.url);
  // Only handle same-origin GET requests (app shell). Feed/API calls pass through to network.
  if(event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached=>{
      const networkFetch = fetch(event.request).then(resp=>{
        if(resp && resp.status === 200){
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(event.request, clone));
        }
        return resp;
      }).catch(()=>cached);
      return cached || networkFetch;
    })
  );
});
