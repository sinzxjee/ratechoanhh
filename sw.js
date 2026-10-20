// Network-first app shell; authenticated backend traffic is never intercepted.
const CACHE_NAME = "ratechotui-v22";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./sleeping-cat.gif",
  "./meme-cat-extra-01.webp",
  "./meme-cat-extra-02.webp",
  "./meme-cat-extra-03.webp",
  "./meme-cat-extra-04.webp",
  "./meme-cat-extra-05.webp",
  "./meme-cat-extra-06.webp",
  "./meme-cat-extra-07.webp",
  "./meme-cat-extra-08.webp",
  "./meme-cat-extra-09.webp",
  "./meme-cat-extra-10.webp",
  "./meme-cat-extra-11.webp",
  "./meme-cat-extra-12.webp",
  "./meme-cat-extra-13.webp",
  "./meme-cat-extra-14.webp",
  "./meme-cat-extra-15.webp",
  "./meme-cat-extra-16.webp",
  "./meme-cat-extra-17.webp",
  "./meme-cat-extra-18.webp",
  "./meme-cat-extra-19.webp",
  "./meme-cat-extra-20.webp",
  "./meme-dog-extra-01.webp",
  "./meme-dog-extra-02.webp",
  "./meme-dog-extra-03.webp",
  "./meme-dog-extra-04.webp",
  "./meme-dog-extra-05.webp",
  "./meme-dog-1.jpg",
  "./meme-dog-2.png",
  "./meme-dog-3.jpg",
  "./meme-dog-4.jpg",
  "./meme-dog-5.png",
  "./meme-goat-1.jpg",
  "./meme-goat-2.jpg",
  "./meme-goat-3.jpg",
  "./meme-goat-4.jpg",
  "./meme-goat-5.jpg",
  "./meme-otter-1.jpg",
  "./meme-otter-2.jpg",
  "./meme-otter-3.jpg",
  "./meme-otter-4.jpg",
  "./meme-otter-5.jpg",
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
