/**
 * Service Worker for Flappy Bird Arcade PWA
 * Provides offline shell caching and fast load times.
 */

const CACHE_NAME = 'flappy-bird-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/icon.svg',
  '/js/main.js',
  '/js/bird.js',
  '/js/pipes.js',
  '/js/audio.js',
  '/js/coins.js',
  '/js/powers.js',
  '/js/network.js',
  '/js/achievements.js',
  '/js/custom_skins.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass cache for API endpoints and WebRTC/Socket.io
  if (url.pathname.startsWith('/api/') || url.pathname.includes('socket.io') || url.pathname.includes('peerjs')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
