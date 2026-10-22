import type { EquipmentSettings, RoutineTemplate, SyncSettings, TrainingCycle, TrainingProfile, WorkoutSession } from '$lib/types'
import { normalizeEquipmentSettings } from '$lib/equipment-settings'
import { normalizeRoutines } from '$lib/routines'
import { normalizeTrainingCycle } from '$lib/training-cycle'
import { normalizeWorkouts } from '$lib/workouts'

interface SyncResponse {
  workouts: WorkoutSession[]
  routines: RoutineTemplate[]
  trainingCycle: TrainingCycle | null
  profile: TrainingProfile | null
  equipmentSettings: EquipmentSettings | null
  cursor: number
  syncedAt: string
}

export async function syncData(
  settings: SyncSettings,
  workouts: WorkoutSession[],
  routines: RoutineTemplate[],
  trainingCycle: TrainingCycle | null,
  profile: TrainingProfile | null = null,
  equipmentSettings: EquipmentSettings | null = null,
) {
  if (!navigator.onLine) throw new Error('You are offline. Your workout is safe on this device.')

  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (import.meta.env.DEV) headers.set('Authorization', 'Bearer lifeos-local-dev')
  const response = await fetch('/api/sync', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      deviceId: settings.deviceId,
      workouts,
      routines,
      trainingCycle,
      profile,
      equipmentSettings,
      cursor: settings.syncCursor,
    }),
  })

  if (!response.ok) {
    const message = response.status === 401
      ? 'Your Cloudflare Access session has expired. Reload to sign in again.'
      : 'Sync failed. Your local data has not been changed.'
    throw new Error(message)
  }
  if (!response.headers.get('Content-Type')?.includes('application/json')) {
    throw new Error('Your Cloudflare Access session has expired. Reload to sign in again.')
  }

  return response.json() as Promise<SyncResponse>
}

export function mergeWorkouts(local: WorkoutSession[], remote: WorkoutSession[]) {
  const normalizedLocal = normalizeWorkouts(local)
  const normalizedRemote = normalizeWorkouts(remote)
  const merged = new Map(normalizedLocal.map((workout) => [workout.id, workout]))
  normalizedRemote.forEach((workout) => {
    const existing = merged.get(workout.id)
    if (!existing || workout.updatedAt > existing.updatedAt) merged.set(workout.id, workout)
  })
  return Array.from(merged.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

export function mergeRoutines(local: RoutineTemplate[], remote: RoutineTemplate[]) {
  const normalizedLocal = normalizeRoutines(local)
  const normalizedRemote = normalizeRoutines(remote)
  const merged = new Map(normalizedLocal.map((routine) => [routine.id, routine]))
  normalizedRemote.forEach((routine) => {
    const existing = merged.get(routine.id)
    if (!existing || routine.updatedAt > existing.updatedAt) merged.set(routine.id, routine)
  })
  return Array.from(merged.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function mergeTrainingCycle(local: TrainingCycle | null, remote: TrainingCycle | null) {
  const normalizedLocal = local ? normalizeTrainingCycle(local) : null
  const normalizedRemote = remote ? normalizeTrainingCycle(remote) : null
  if (!normalizedLocal) return normalizedRemote
  if (!normalizedRemote) return normalizedLocal
  return normalizedRemote.updatedAt > normalizedLocal.updatedAt ? normalizedRemote : normalizedLocal
}

export function mergeTrainingProfile(local: TrainingProfile | null, remote: TrainingProfile | null) {
  if (!local) return remote
  if (!remote) return local
  return remote.updatedAt > local.updatedAt ? remote : local
}

export function mergeEquipmentSettings(local: EquipmentSettings | null, remote: EquipmentSettings | null) {
  if (!local) return remote ? normalizeEquipmentSettings(remote) : null
  if (!remote) return normalizeEquipmentSettings(local)
  return normalizeEquipmentSettings(remote.updatedAt > local.updatedAt ? remote : local)
}
