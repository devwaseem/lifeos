import { afterEach, describe, expect, it, vi } from 'vitest'
import { syncData } from './sync'
import type { SyncSettings, TrainingCycle } from './types'

const staleDuplicateCycle: TrainingCycle = {
  id: 'primary-training-cycle',
  name: 'PPL',
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-20T08:00:00.000Z',
  deletedAt: null,
  currentIndex: 0,
  trainingDaysBeforeRest: 3,
  slots: [
    { id: 'slot-push-a', routineId: 'push-a' },
    { id: 'slot-pull-a', routineId: 'pull-a' },
    { id: 'slot-leg-a', routineId: 'leg-a' },
    { id: 'slot-leg-a-duplicate', routineId: 'leg-a' },
  ],
}

const repairedCycle: TrainingCycle = {
  ...staleDuplicateCycle,
  updatedAt: '2026-10-21T08:00:00.000Z',
  slots: [
    { id: 'slot-push-a', routineId: 'push-a' },
    { id: 'slot-pull-a', routineId: 'pull-a' },
    { id: 'slot-leg-a', routineId: 'leg-a' },
    { id: 'slot-leg-b', routineId: 'leg-b' },
  ],
}

const settings: SyncSettings = { deviceId: 'existing-browser', lastSyncedAt: '2026-10-20T08:00:00.000Z', syncCursor: 42 }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sync recovery', () => {
  it('omits a stale duplicate cycle and pulls the server snapshot instead', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({
      workouts: [],
      routines: [],
      trainingCycle: repairedCycle,
      profile: null,
      equipmentSettings: null,
      cursor: 43,
      syncedAt: '2026-10-21T08:00:00.000Z',
    }))
    vi.stubGlobal('fetch', fetch)

    const response = await syncData(settings, [], [], staleDuplicateCycle)
    const [, request] = fetch.mock.calls[0]
    const body = JSON.parse(String(request?.body))
    expect(body.trainingCycle).toBeNull()
    expect(body.cursor).toBeNull()
    expect(staleDuplicateCycle.slots.map((slot) => slot.routineId)).toEqual(['push-a', 'pull-a', 'leg-a', 'leg-a'])
    expect(response.replaceInvalidTrainingCycle).toBe(true)
  })
})
