// Network-first app shell; authenticated backend traffic is never intercepted.
const CACHE_NAME = "ratechotui-v14";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./sleeping-cat.gif",
  "./theme-dog-1.svg",
  "./theme-dog-2.svg",
  "./theme-dog-3.svg",
  "./theme-dog-4.svg",
  "./theme-dog-5.svg",
  "./theme-goat-1.svg",
  "./theme-goat-2.svg",
  "./theme-goat-3.svg",
  "./theme-goat-4.svg",
  "./theme-goat-5.svg",
  "./theme-otter-1.svg",
  "./theme-otter-2.svg",
  "./theme-otter-3.svg",
  "./theme-otter-4.svg",
  "./theme-otter-5.svg",
  "./backend-client.js",
  "./ragdoll-rating-1.png",
  "./ragdoll-rating-2.png",
  "./ragdoll-rating-3.png",
  "./ragdoll-rating-4.png",
  "./ragdoll-rating-5.png",
  "./meme-rating-1.jpg",
  "./meme-rating-2.jpg",
  "./meme-rating-3.jpg",
  "./meme-rating-4.jpg",
  "./meme-rating-5.png",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png",
  "./favicon-64.png"
];
const ASSET_URLS = new Set(ASSETS.map(asset => new URL(asset, self.location).href));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('ratechotui-') && k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  url.search = '';
  if (!ASSET_URLS.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        await cache.put(url.href, response.clone());
        return response;
      }
      return await cache.match(url.href) || response;
    } catch (err) {
      return await cache.match(url.href) || Response.error();
    }
  })());
});
