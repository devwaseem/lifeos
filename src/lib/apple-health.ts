import type { WorkoutSession } from '$lib/types'

export const APPLE_HEALTH_SHORTCUT_NAME = 'Log LifeOS Workout'

export type AppleHealthExportStatus = 'pending' | 'exporting' | 'exported'

export interface AppleHealthExportRecord {
  workoutId: string
  workoutUpdatedAt: string
  status: AppleHealthExportStatus
  attemptId: string | null
  attemptedAt: string | null
  exportedAt: string | null
  lastError: string | null
}


interface AppleHealthShortcutPayload {
  schemaVersion: 1
  workoutId: string
  title: string
  activityType: 'Traditional Strength Training'
  startedAt: string
  completedAt: string
  durationSeconds: number
}

export function createPendingAppleHealthExport(workout: WorkoutSession): AppleHealthExportRecord {
  return {
    workoutId: workout.id,
    workoutUpdatedAt: workout.updatedAt,
    status: 'pending',
    attemptId: null,
    attemptedAt: null,
    exportedAt: null,
    lastError: null,
  }
}

export function isAppleHealthShortcutAvailable(navigatorLike: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>) {
  return /iPad|iPhone|iPod/.test(navigatorLike.userAgent)
    || (navigatorLike.platform === 'MacIntel' && navigatorLike.maxTouchPoints > 1)
}

export function createAppleHealthShortcutPayload(workout: WorkoutSession): AppleHealthShortcutPayload {
  if (workout.status !== 'completed' || !workout.completedAt) {
    throw new Error('Only completed workouts can be exported to Apple Health.')
  }

  const startedAt = new Date(workout.startedAt).getTime()
  const completedAt = new Date(workout.completedAt).getTime()
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt) || completedAt < startedAt) {
    throw new Error('This workout has invalid start or completion times.')
  }

  return {
    schemaVersion: 1,
    workoutId: workout.id,
    title: workout.title,
    activityType: 'Traditional Strength Training',
    startedAt: workout.startedAt,
    completedAt: workout.completedAt,
    durationSeconds: Math.round((completedAt - startedAt) / 1_000),
  }
}

export function createAppleHealthShortcutUrl(workout: WorkoutSession) {
  const payload = JSON.stringify(createAppleHealthShortcutPayload(workout))
  return `shortcuts://run-shortcut?name=${encodeURIComponent(APPLE_HEALTH_SHORTCUT_NAME)}&input=text&text=${encodeURIComponent(payload)}`
}
