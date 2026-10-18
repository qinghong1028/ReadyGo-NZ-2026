const CACHE = 'nzdaily-shell-v4'
const rootUrl = new URL('./', self.location.href)
const manifestUrl = new URL('offline-assets.json', rootUrl)

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const response = await fetch(manifestUrl, { cache: 'no-store' })
    if (!response.ok) throw new Error('离线资源清单下载失败')
    const paths = await response.clone().json()
    if (!Array.isArray(paths) || !paths.includes('index.html')) throw new Error('离线资源清单格式不正确')
    const cache = await caches.open(CACHE)
    await cache.put(manifestUrl, response)
    const shellPaths = paths.filter((path) => path === 'index.html' || path === 'manifest.webmanifest' || path.startsWith('assets/') || path.startsWith('icon-'))
    await cache.addAll([rootUrl.href, ...shellPaths.map((path) => new URL(path, rootUrl).href)])
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith('nzdaily-shell-') && key !== CACHE).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(rootUrl.pathname)) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    const cached = await cache.match(event.request, { ignoreVary: true })
    if (cached) return cached
    if (event.request.mode === 'navigate') {
      const home = await cache.match(rootUrl, { ignoreVary: true })
      if (home) return home
    }
    try {
      const response = await fetch(event.request)
      if (response.ok) event.waitUntil(cache.put(event.request, response.clone()))
      return response
    } catch {
      return Response.error()
    }
  })())
})
