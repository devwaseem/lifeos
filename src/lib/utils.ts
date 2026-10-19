import type { WorkoutSession } from '$lib/types'

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export function formatDuration(startedAt: string, completedAt: string | null, now = Date.now()) {
  const end = completedAt ? new Date(completedAt).getTime() : now
  const minutes = Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 60_000))
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`
}

export function formatElapsed(startedAt: string, now = Date.now()) {
  const totalSeconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1_000))
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  const clock = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return hours > 0 ? `${hours}:${clock}` : clock
}

export function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function getWorkoutVolume(workout: WorkoutSession) {
  return workout.exercises.reduce(
    (total, exercise) => total + exercise.sets.reduce((sum, set) => {
      if (!set.completed || set.weight === null || set.reps === null) return sum
      return sum + set.weight * set.reps
    }, 0),
    0,
  )
}

export function getLiveWorkoutVolume(workout: WorkoutSession) {
  return workout.exercises.reduce(
    (total, exercise) => total + exercise.sets.reduce(
      (sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0),
      0,
    ),
    0,
  )
}

export function getWorkoutSetCount(workout: WorkoutSession) {
  return workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)
}

export function getCompletedSetCount(workout: WorkoutSession) {
  return workout.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => set.completed).length,
    0,
  )
}

export function formatVolume(value: number) {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(value)
}

export function newId() {
  return crypto.randomUUID()
}
