/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker'

const worker = self as unknown as ServiceWorkerGlobalScope
const cacheName = `lifeos-${version}`
const appShellUrl = '/'
const offlineAssets = Array.from(new Set([...build, ...files, ...prerendered]))
const offlineAssetPaths = new Set(offlineAssets)

worker.addEventListener('install', (event) => {
  event.waitUntil(Promise.all([
    caches.open(cacheName).then((cache) => cache.addAll(offlineAssets)),
    worker.skipWaiting(),
  ]))
})

worker.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)))),
    worker.clients.claim(),
  ]))
})

worker.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== worker.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }

  if (offlineAssetPaths.has(url.pathname)) {
    event.respondWith(caches.open(cacheName).then(async (cache) => (
      await cache.match(request, { ignoreSearch: true }) ?? await fetch(request)
    )))
  }
})

async function handleNavigation(request: Request) {
  try {
    const response = await fetch(request)
    if (response.ok && new URL(response.url).origin === worker.location.origin) {
      const cache = await caches.open(cacheName)
      await cache.put(appShellUrl, response.clone())
    }
    return response
  } catch {
    const cachedShell = await caches.match(appShellUrl)
    return cachedShell ?? new Response('LifeOS is unavailable offline until it has been opened once online.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}
