// public/service-worker.js

const CACHE_NAME = 'visitas-ei-v2'
const SHELL_ASSETS = ['/', '/index.html', '/manifest.json']

self.addEventListener('install', event => {
  event.waitUntil(
      caches.open(CACHE_NAME).then(cache =>
          Promise.all(
              SHELL_ASSETS.map(url =>
                  cache.add(url).catch(() => null)
              )
          )
      )
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
      caches.keys().then(keys =>
          Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event

  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/@') || url.pathname.includes('/node_modules/')) return
  if (url.search.includes('t=') || url.search.includes('v=')) return

  if (request.mode === 'navigate') {
    event.respondWith(
        fetch(request).catch(async () => {
          const cached = await caches.match('/index.html')
          return cached || Response.error()
        })
    )
    return
  }

  if (['script', 'style', 'font', 'image'].includes(request.destination)) {
    event.respondWith(
        caches.match(request).then(cached => {
          if (cached) return cached
          return fetch(request).then(res => {
            if (res && res.ok && res.status === 200) {
              const clone = res.clone()
              caches.open(CACHE_NAME).then(cache => cache.put(request, clone)).catch(() => {})
            }
            return res
          }).catch(() => Response.error())
        })
    )
  }
})