const CACHE_NAME = 'humanevo-premium-studio-v3-10-9';
const SHELL = [
  './', './index.html', './boot.js', './login.css', './login.js', './painel.html', './demo-profissional.html', './styles.css', './config.js', './cloud.js', './app.js',
  './ATUALIZAR_HUMANEVO_V3_10_9.html', './portal-paciente.html', './ATUALIZAR_PORTAL_PACIENTE.html', './demo-paciente.html', './diagnostico-supabase.html', './patient.css', './patient.js', './manifest.webmanifest', './favicon.ico',
  './assets/logo-humanevo.svg', './assets/qr-acesso-mobile.png', './assets/login-hologram.gif',
  './assets/icons/pwa-192.png', './assets/icons/pwa-512.png',
  './assets/icons/pwa-maskable-192.png', './assets/icons/pwa-maskable-512.png',
  './assets/icons/apple-touch-icon.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    let fallback = './index.html';
    if (url.pathname.endsWith('/portal-paciente.html') || url.pathname.endsWith('/portal-paciente') || url.pathname.endsWith('/portal')) fallback = './portal-paciente.html';
    else if (url.pathname.endsWith('/demo-profissional.html') || url.pathname.endsWith('/demo-profissional')) fallback = './demo-profissional.html';
    else if (url.pathname.endsWith('/demo-paciente.html') || url.pathname.endsWith('/demo-paciente')) fallback = './demo-paciente.html';
    else if (url.pathname.endsWith('/painel.html') || url.pathname.endsWith('/painel')) fallback = './painel.html';
    event.respondWith(fetch(event.request, { redirect: 'follow', cache: 'no-store' }).catch(() => caches.match(fallback)));
    return;
  }
  const isCode = /\.(?:js|css)$/.test(url.pathname);
  if (isCode) {
    event.respondWith(fetch(event.request, {cache:'no-store'}).then(response => {
      const copy=response.clone(); caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)); return response;
    }).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    return response;
  })));
});
