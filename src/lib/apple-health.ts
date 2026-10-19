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

export interface AppleHealthExportCallback {
  workoutId: string
  attemptId: string
  status: 'success' | 'cancelled' | 'error'
  errorMessage: string | null
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

function callbackUrl(origin: string, workoutId: string, attemptId: string, status: AppleHealthExportCallback['status']) {
  const url = new URL('/', origin)
  url.searchParams.set('view', 'workout-history')
  url.searchParams.set('workout', workoutId)
  url.searchParams.set('health-export', status)
  url.searchParams.set('health-attempt', attemptId)
  return url.toString()
}

export function createAppleHealthShortcutUrl(workout: WorkoutSession, attemptId: string, origin: string) {
  const parameters = new URLSearchParams({
    name: APPLE_HEALTH_SHORTCUT_NAME,
    input: 'text',
    text: JSON.stringify(createAppleHealthShortcutPayload(workout)),
    'x-success': callbackUrl(origin, workout.id, attemptId, 'success'),
    'x-cancel': callbackUrl(origin, workout.id, attemptId, 'cancelled'),
    'x-error': callbackUrl(origin, workout.id, attemptId, 'error'),
  })
  return `shortcuts://x-callback-url/run-shortcut?${parameters}`
}

export function readAppleHealthExportCallback(search: string): AppleHealthExportCallback | null {
  const parameters = new URLSearchParams(search)
  const status = parameters.get('health-export')
  const workoutId = parameters.get('workout')
  const attemptId = parameters.get('health-attempt')
  if ((status !== 'success' && status !== 'cancelled' && status !== 'error') || !workoutId || !attemptId) return null

  return {
    workoutId,
    attemptId,
    status,
    errorMessage: status === 'error' ? parameters.get('errorMessage') : null,
  }
}
