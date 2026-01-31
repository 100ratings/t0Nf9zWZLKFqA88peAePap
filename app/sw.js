const CACHE_NAME = 'sethidraw-v6.1.2';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=6.1.2',
  './app.js?v=6.1.2',
  './manifest.json?v=2',
  './favicon.ico?v=2',
  './apple-touch-icon.png?v=2',
  './icons/icon-192.png?v=2',
  './icons/icon-512.png?v=2'
];

// Instalação: Salva todos os arquivos no cache imediatamente
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Força a ativação imediata
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching all assets');
      return cache.addAll(ASSETS);
    })
  );
});

// Ativação: Assume o controle da página no mesmo segundo e limpa caches antigos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      self.clients.claim(), // Assume controle imediato dos clientes
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', key);
              return caches.delete(key);
            }
          })
        );
      })
    ])
  );
});

// Estratégia Cache-First: Tenta o cache primeiro, depois a rede
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      // Retorna o cache se encontrar, senão busca na rede
      return response || fetch(e.request).then((fetchResponse) => {
        // Se for um request válido, salva no cache dinamicamente
        if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
          return fetchResponse;
        }
        const responseToCache = fetchResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseToCache);
        });
        return fetchResponse;
      });
    }).catch(() => {
      // Fallback para quando não há cache nem rede
      if (e.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
