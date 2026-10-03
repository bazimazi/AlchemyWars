// This script is compiled separately with WebWorker globals.
const worker = self as unknown as ServiceWorkerGlobalScope;
const CACHE = 'alchemy-wars-v9-runs';
worker.addEventListener('install', event => event.waitUntil(fetch('./assets/offline-files.json').then(response => response.json()).then(files => caches.open(CACHE).then(cache => cache.addAll(files)))));
worker.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('alchemy-wars-') && key !== CACHE).map(key => caches.delete(key)))).then(() => worker.clients.claim())));
worker.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== worker.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
    return response;
  }).catch(async () => (await caches.match(event.request)) ?? Response.error()));
});
