import { describe, expect, it } from 'vitest'
import { createAppleHealthShortcutPayload, createAppleHealthShortcutUrl, readAppleHealthExportCallback } from '$lib/apple-health'
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

  it('encodes the payload and distinct completion callbacks', () => {
    const shortcutUrl = createAppleHealthShortcutUrl(completedWorkout, 'attempt-456', 'https://lifeos.example')
    expect(shortcutUrl).toContain('name=Log%20LifeOS%20Workout')
    expect(shortcutUrl).not.toContain('name=Log+LifeOS+Workout')
    const url = new URL(shortcutUrl)
    expect(url.protocol).toBe('shortcuts:')
    expect(url.hostname).toBe('x-callback-url')
    expect(url.pathname).toBe('/run-shortcut')
    expect(JSON.parse(url.searchParams.get('text') ?? '')).toMatchObject({ workoutId: 'workout-123' })
    expect(url.searchParams.get('x-success')).toContain('health-export=success')
    expect(url.searchParams.get('x-cancel')).toContain('health-export=cancelled')
    expect(url.searchParams.get('x-error')).toContain('health-export=error')
  })

  it('parses a matching callback and rejects unrelated URLs', () => {
    expect(readAppleHealthExportCallback('?workout=workout-123&health-export=error&health-attempt=attempt-456&errorMessage=Missing+shortcut')).toEqual({
      workoutId: 'workout-123',
      attemptId: 'attempt-456',
      status: 'error',
      errorMessage: 'Missing shortcut',
    })
    expect(readAppleHealthExportCallback('?view=history')).toBeNull()
  })
})
