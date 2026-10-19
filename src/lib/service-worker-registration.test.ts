import { describe, expect, it, vi } from 'vitest'
import { registerServiceWorker } from './service-worker-registration'

describe('service worker registration', () => {
  it('bypasses the HTTP cache, checks immediately, and reloads an existing installation after activation', async () => {
    const update = vi.fn(async () => undefined)
    const reload = vi.fn()
    let controllerChange: (() => void) | undefined
    const container = {
      controller: {},
      addEventListener: vi.fn((event: string, listener: () => void) => {
        if (event === 'controllerchange') controllerChange = listener
      }),
      register: vi.fn(async () => ({ update })),
    }

    await registerServiceWorker(container as unknown as ServiceWorkerContainer, reload)

    expect(container.register).toHaveBeenCalledWith('/service-worker.js', { updateViaCache: 'none' })
    expect(update).toHaveBeenCalledOnce()
    controllerChange?.()
    controllerChange?.()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('does not reload a page when the service worker is being installed for the first time', async () => {
    const reload = vi.fn()
    const container = {
      controller: null,
      addEventListener: vi.fn(),
      register: vi.fn(async () => ({ update: vi.fn(async () => undefined) })),
    }

    await registerServiceWorker(container as unknown as ServiceWorkerContainer, reload)

    expect(container.addEventListener).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })
})
