export async function registerServiceWorker(
  container: ServiceWorkerContainer,
  reload: () => void = () => window.location.reload(),
) {
  let reloading = false
  if (container.controller) {
    container.addEventListener('controllerchange', () => {
      if (reloading) return
      reloading = true
      reload()
    }, { once: true })
  }
  const registration = await container.register('/service-worker.js', { updateViaCache: 'none' })
  await registration.update()
}
