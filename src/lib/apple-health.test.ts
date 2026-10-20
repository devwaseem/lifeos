import { describe, expect, it } from 'vitest'
import { createAppleHealthShortcutPayload, createAppleHealthShortcutUrl } from '$lib/apple-health'
import type { WorkoutSession } from '$lib/types'

const completedWorkout: WorkoutSession = {
  id: 'workout-123',
  title: 'Push & Pull',
  routineId: null,
  cycleSlotId: null,
  status: 'completed',
  startedAt: '2026-10-20T10:00:00.000Z',
  completedAt: '2026-10-20T11:15:30.000Z',
  updatedAt: '2026-10-20T11:15:30.000Z',
  notes: '',
  sessionRpe: 8,
  checkIn: null,
  exercises: [],
}

describe('Apple Health shortcut export', () => {
  it('creates a bounded workout-summary payload', () => {
    expect(createAppleHealthShortcutPayload(completedWorkout)).toEqual({
      schemaVersion: 1,
      workoutId: 'workout-123',
      title: 'Push & Pull',
      activityType: 'Traditional Strength Training',
      startedAt: '2026-10-20T10:00:00.000Z',
      completedAt: '2026-10-20T11:15:30.000Z',
      durationSeconds: 4530,
    })
  })

  it('encodes the payload without an HTTPS callback that would open Safari', () => {
    const shortcutUrl = createAppleHealthShortcutUrl(completedWorkout)
    expect(shortcutUrl).toContain('name=Log%20LifeOS%20Workout')
    expect(shortcutUrl).not.toContain('name=Log+LifeOS+Workout')
    const url = new URL(shortcutUrl)
    expect(url.protocol).toBe('shortcuts:')
    expect(url.hostname).toBe('run-shortcut')
    expect(JSON.parse(url.searchParams.get('text') ?? '')).toMatchObject({ workoutId: 'workout-123' })
    expect(url.searchParams.has('x-success')).toBe(false)
    expect(url.searchParams.has('x-cancel')).toBe(false)
    expect(url.searchParams.has('x-error')).toBe(false)
  })

})
