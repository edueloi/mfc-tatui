/* Service worker do MFC Tatuí: deixa o app instalável e abre o "casco" mesmo sem internet.
 * Nunca guarda respostas da API (dados financeiros/pessoais): só arquivos estáticos. Suba a versão para forçar atualização. */
const VERSION = 'mfc-v1';
const SHELL = ['/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

const isStatic = (url) => url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/site/') && /\.(?:png|jpe?g|webp|css|js)$/.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Páginas: rede primeiro; offline, devolve o último casco do app guardado.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok && !url.pathname.startsWith('/site/')) caches.open(VERSION).then((cache) => cache.put('/app-shell', response.clone()));
        return response;
      }).catch(() => caches.match('/app-shell').then((cached) => cached || new Response('Sem conexão. Abra o app novamente quando estiver online.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })))
    );
    return;
  }

  // Arquivos estáticos (JS/CSS com hash, ícones, imagens do site): cache primeiro.
  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) caches.open(VERSION).then((cache) => cache.put(request, response.clone()));
        return response;
      }))
    );
  }
});
