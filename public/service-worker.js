// public/service-worker.js

const CACHE_NAME   = 'visitas-ei-v1'
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// ── Instala e pré-cacheia o shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  )
  self.skipWaiting()
})

// ── Ativa e limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Estratégia por rota
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Firestore / Firebase: network-only (não cacheia dados sensíveis)
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com')
  ) {
    event.respondWith(fetch(request))
    return
  }

  // Assets estáticos (JS/CSS/fontes): cache-first
  if (
    request.destination === 'script' ||
    request.destination === 'style'  ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(res => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          return res
        })
      })
    )
    return
  }

  // Navegação (HTML): network-first, fallback para shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    )
    return
  }

  // Default: network-first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})
