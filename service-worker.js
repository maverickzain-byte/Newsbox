/* ===========================================================
   Newsbox — service-worker.js  (v2)
   Caches the app shell so the UI loads offline. Article data
   itself lives in IndexedDB (see js/db.js), not here.

   Strategy: network-first for the app shell. Tries the network
   so edits you push to GitHub show up on next reopen; falls
   back to the cached copy only when there's no connection.
=========================================================== */
const CACHE_NAME = 'newsbox-shell-v2';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/feeds.js',
  './js/trending.js',
  './js/briefing.js',
  './js/sample-data.js',
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
    fetch(event.request).then(resp=>{
      if(resp && resp.status === 200){
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put(event.request, clone));
      }
      return resp;
    }).catch(()=> caches.match(event.request))
  );
});